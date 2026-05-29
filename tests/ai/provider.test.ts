import { describe, expect, it } from "vitest";
import { getAiAssistantConfig, requireConfiguredAiAssistantConfig } from "@/lib/ai/ai-config";
import { AiAssistantError } from "@/lib/ai/ai-errors";
import { createOpenAiCompatibleProvider } from "@/lib/ai/provider";

function configuredTestProvider(fetchImpl: typeof fetch) {
  const config = requireConfiguredAiAssistantConfig(
    getAiAssistantConfig({
      AI_ASSISTANT_ENABLED: "true",
      AI_API_KEY: "test-key",
      AI_BASE_URL: "https://example.test/v1",
      AI_MODEL: "demo-model",
      AI_PROVIDER: "openai-compatible",
      AI_TIMEOUT_MS: "50",
    }),
  );

  return createOpenAiCompatibleProvider(config, fetchImpl);
}

describe("openai-compatible AI provider", () => {
  it("posts a chat/completions request and parses JSON content", async () => {
    const calls: { body: unknown; headers: HeadersInit | undefined; url: string }[] = [];
    const provider = configuredTestProvider((async (url, init) => {
      calls.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
        headers: init?.headers,
        url: String(url),
      });

      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confidence: 0.95,
                explanation: "Pergunta identificada.",
                intent: "question",
                needsReview: true,
                question: { intent: "sales", period: "today" },
                userMessage: "Vou consultar as vendas de hoje.",
              }),
            },
          },
        ],
      });
    }) as typeof fetch);

    const result = await provider.completeJson({
      context: { activeProducts: [], expenseCategories: [], financialSummary: null },
      schemaName: "nexis_assistant_response",
      systemPrompt: "Retorne JSON.",
      userMessage: "quanto vendi hoje?",
    });

    expect(result).toMatchObject({
      intent: "question",
      question: { intent: "sales", period: "today" },
    });
    expect(calls[0]?.url).toBe("https://example.test/v1/chat/completions");
    expect(calls[0]?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.stringify(calls[0]?.body)).not.toContain("test-key");
  });

  it("sends an explicit no-wrapper output contract to the model", async () => {
    const calls: { body: unknown }[] = [];
    const provider = configuredTestProvider((async (_url, init) => {
      calls.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confidence: 0.95,
                explanation: "Pergunta identificada.",
                intent: "question",
                needsReview: true,
                question: { intent: "sales", period: "today" },
                userMessage: "Vou consultar as vendas de hoje.",
              }),
            },
          },
        ],
      });
    }) as typeof fetch);

    await provider.completeJson({
      context: { activeProducts: [], expenseCategories: [], financialSummary: null },
      schemaName: "nexis_assistant_response",
      systemPrompt: "Retorne JSON.",
      userMessage: "quanto vendi hoje?",
    });

    const requestBody = calls[0]?.body as {
      messages?: { content: string; role: string }[];
    };
    const userPayload = JSON.parse(String(requestBody.messages?.[1]?.content)) as {
      outputContract?: {
        optionalTopLevelKeys?: string[];
        conditionalRequirements?: Record<string, unknown>;
        forbiddenTopLevelKeys?: string[];
        requiredTopLevelKeys?: string[];
      };
    };

    expect(userPayload.outputContract?.requiredTopLevelKeys).toEqual([
      "confidence",
      "intent",
      "needsReview",
      "userMessage",
    ]);
    expect(userPayload.outputContract?.forbiddenTopLevelKeys).toEqual(
      expect.arrayContaining(["response", "context"]),
    );
    expect(userPayload.outputContract?.optionalTopLevelKeys).toEqual(
      expect.arrayContaining(["entities", "missingFields", "ambiguity", "nextQuestion", "draftCandidate"]),
    );
    expect(userPayload.outputContract?.conditionalRequirements).toMatchObject({
      expense_draft: { required: ["draft"] },
      purchase_draft: { required: ["draft"] },
      question: { required: ["question"] },
      sale_draft: { required: ["draft"] },
    });
  });

  it("rejects invalid JSON from the model with a controlled error", async () => {
    const provider = configuredTestProvider((async () =>
      Response.json({
        choices: [{ message: { content: "isto nao e json" } }],
      })) as typeof fetch);

    await expect(
      provider.completeJson({
        context: { activeProducts: [], expenseCategories: [], financialSummary: null },
        schemaName: "nexis_assistant_response",
        systemPrompt: "Retorne JSON.",
        userMessage: "vendi algo",
      }),
    ).rejects.toMatchObject({ code: "AI_ASSISTANT_INVALID_RESPONSE" });
  });

  it("applies timeout to external HTTP calls", async () => {
    const provider = configuredTestProvider(((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as typeof fetch);

    await expect(
      provider.completeJson({
        context: { activeProducts: [], expenseCategories: [], financialSummary: null },
        schemaName: "nexis_assistant_response",
        systemPrompt: "Retorne JSON.",
        userMessage: "quanto vendi hoje?",
      }),
    ).rejects.toMatchObject({ code: "AI_ASSISTANT_TIMEOUT" });
  });

  it("does not expose API keys in controlled provider errors", async () => {
    const provider = configuredTestProvider((async () =>
      Response.json({ error: "bad request" }, { status: 400 })) as typeof fetch);

    try {
      await provider.completeJson({
        context: { activeProducts: [], expenseCategories: [], financialSummary: null },
        schemaName: "nexis_assistant_response",
        systemPrompt: "Retorne JSON.",
        userMessage: "quanto vendi hoje?",
      });
      throw new Error("Expected provider call to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(AiAssistantError);
      expect(error instanceof Error ? error.message : String(error)).not.toContain("test-key");
    }
  });
});
