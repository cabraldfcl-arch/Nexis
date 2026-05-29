import type { ConfiguredAiAssistantConfig } from "./ai-config";
import { AiAssistantError } from "./ai-errors";
import { expenseCategoryValues } from "@/lib/validation/expense";
import { productUnitValues } from "@/lib/validation/product";

export type AiAssistantProviderRequest = {
  context: unknown;
  schemaName: string;
  systemPrompt: string;
  userMessage: string;
};

export type AiAssistantProvider = {
  completeJson(request: AiAssistantProviderRequest): Promise<unknown>;
  name: string;
};

export function createOpenAiCompatibleProvider(
  config: ConfiguredAiAssistantConfig,
  fetchImpl: typeof fetch = fetch,
): AiAssistantProvider {
  return {
    name: config.provider,
    async completeJson(request) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchImpl(resolveChatCompletionsUrl(config.baseUrl), {
          body: JSON.stringify({
            messages: [
              { content: request.systemPrompt, role: "system" },
              {
                content: JSON.stringify({
                  context: request.context,
                  expectedSchema: request.schemaName,
                  outputContract: {
                    allowedIntents: [
                      "question",
                      "social",
                      "sale_draft",
                      "purchase_draft",
                      "partial_purchase",
                      "ambiguous_purchase_cost",
                      "expense_draft",
                      "product_draft",
                      "unknown",
                    ],
                    assistantArchitecture: {
                      requiredReasoningOrder: [
                        "intent",
                        "confidence",
                        "entities",
                        "product ambiguity",
                        "sensitive/service flags",
                        "missingFields",
                        "nextQuestion",
                        "draftCandidate",
                      ],
                      confidenceLabels: ["HIGH", "MEDIUM", "LOW"],
                    },
                    conditionalRequirements: {
                      ambiguous_purchase_cost: { required: ["draft"] },
                      expense_draft: { required: ["draft"] },
                      partial_purchase: { required: ["draft"] },
                      product_draft: { required: ["draft"] },
                      purchase_draft: { required: ["draft"] },
                      question: { required: ["question"] },
                      sale_draft: { required: ["draft"] },
                    },
                    draftShapes: {
                      expense: {
                        required: ["type", "description", "category", "amountCents"],
                        type: "expense",
                      },
                      purchase: {
                        required: ["type", "productName", "quantity", "unitCostCents"],
                        type: "purchase",
                      },
                      partial_purchase: {
                        required: ["type", "productName", "quantity", "missingFields"],
                        type: "partial_purchase",
                      },
                      ambiguous_purchase_cost: {
                        required: ["type", "productName", "quantity", "amountCents"],
                        type: "ambiguous_purchase_cost",
                      },
                      product: {
                        required: [
                          "type",
                          "name",
                          "unit",
                          "unitCostCents",
                          "salePriceCents",
                          "initialStock",
                          "minimumStock",
                        ],
                        type: "product",
                      },
                      sale: {
                        required: ["type", "productName", "quantity", "unitPriceCents"],
                        type: "sale",
                      },
                    },
                    allowedExpenseCategories: [...expenseCategoryValues],
                    allowedProductUnits: [...productUnitValues],
                    forbiddenTopLevelKeys: ["response", "context", "result", "data"],
                    optionalTopLevelKeys: [
                      "entities",
                      "missingFields",
                      "ambiguity",
                      "nextQuestion",
                      "draftCandidate",
                      "sensitiveProductWarning",
                      "serviceUnsupported",
                    ],
                    requiredTopLevelKeys: ["confidence", "intent", "needsReview", "userMessage"],
                    rules: [
                      "Return exactly one top-level JSON object.",
                      "Do not wrap the answer in response, context, result or data.",
                      "Use entities for extracted product, quantity, cost, sale price, amount kind, unit and variant.",
                      "Use missingFields and nextQuestion when a safe draft cannot be completed yet.",
                      "Use ambiguity when product, value, intent or multiple actions need clarification.",
                      "For financial questions, return intent=question and the question object only; never calculate the final value.",
                      "For greetings and short capability questions, return intent=social; never return a financial report for social chat.",
                      "For sale, purchase and expense drafts, set needsReview=true.",
                      "For partial purchases or stock entries without unit cost, return intent=partial_purchase and missingFields=['unitCostCents']; never invent the cost.",
                      "For purchase cost, cada/cada uma/cada unidade/por unidade means unit cost.",
                      "For commercial units, preserve quantity unit and price basis when explicit: kg/quilo, grama, litro/ml, metro/m2/m3, caixa/saco/fardo/pacote/duzia/unidade.",
                      "When unit is omitted, only suggest common product units for obvious products and keep the result reviewable.",
                      "If a purchase amount can be total or unit value, return intent=ambiguous_purchase_cost with amountCents and ask for clarification.",
                      "If multiple active products can match the user wording, do not choose silently; ask for disambiguation.",
                      "For sensitive fictitious product names, only create financial/cadastral drafts, set sensitiveProductWarning=true and never provide use, dose, application or mixing instructions.",
                      "For service revenue without stock support, set serviceUnsupported=true and return unknown instead of forcing a physical product or stock movement.",
                    ],
                  },
                  userMessage: request.userMessage,
                }),
                role: "user",
              },
            ],
            model: config.model,
            response_format: { type: "json_object" },
            temperature: 0,
          }),
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new AiAssistantError(
            "AI_ASSISTANT_HTTP_ERROR",
            `Provedor de IA retornou status ${response.status}.`,
          );
        }

        const body = await parseJsonBody(response);
        const content = extractMessageContent(body);

        return parseJsonContent(content);
      } catch (error) {
        if (error instanceof AiAssistantError) {
          throw error;
        }

        if (isAbortError(error)) {
          throw new AiAssistantError("AI_ASSISTANT_TIMEOUT", "Tempo limite da IA externa excedido.", {
            cause: error,
          });
        }

        throw new AiAssistantError("AI_ASSISTANT_HTTP_ERROR", "Falha controlada ao chamar IA externa.", {
          cause: error,
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function resolveChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/g, "");

  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  return `${normalized}/chat/completions`;
}

async function parseJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new AiAssistantError("AI_ASSISTANT_INVALID_RESPONSE", "Resposta da IA nao era JSON valido.", {
      cause: error,
    });
  }
}

function extractMessageContent(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "choices" in body &&
    Array.isArray(body.choices) &&
    body.choices[0] &&
    typeof body.choices[0] === "object" &&
    "message" in body.choices[0] &&
    body.choices[0].message &&
    typeof body.choices[0].message === "object" &&
    "content" in body.choices[0].message &&
    typeof body.choices[0].message.content === "string"
  ) {
    return body.choices[0].message.content;
  }

  throw new AiAssistantError("AI_ASSISTANT_INVALID_RESPONSE", "Resposta da IA veio em formato inesperado.");
}

function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new AiAssistantError("AI_ASSISTANT_INVALID_RESPONSE", "Conteudo da IA nao era JSON valido.", {
      cause: error,
    });
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
