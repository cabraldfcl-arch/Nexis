import { describe, expect, it } from "vitest";
import { answerQuestionFromSummary } from "@/lib/ai/answer-question";
import {
  externalAssistantResponseSchema,
  resolveAssistantMessageWithExternalAi,
  type ExternalAssistantContext,
  type ExternalAssistantProvider,
} from "@/lib/ai/external-assistant";
import { AiAssistantError } from "@/lib/ai/ai-errors";
import { buildDashboardSummary } from "@/lib/dashboard/summary";

const baseContext: ExternalAssistantContext = {
  activeProducts: [
    {
      currentStock: 3,
      name: "Água mineral",
      salePriceCents: 300,
      unitCostCents: 100,
    },
  ],
  expenseCategories: ["PACKAGING_MATERIAL", "UTILITIES", "OTHER"],
  financialSummary: {
    lowStockProducts: [{ currentStock: 3, minimumStock: 10, name: "Água mineral" }],
    month: {
      confirmedExpensesCents: 0,
      costOfGoodsSoldCents: 1200,
      grossProfitCents: 900,
      netProfitCents: 900,
      revenueCents: 2100,
      salesCount: 1,
    },
    today: {
      confirmedExpensesCents: 0,
      costOfGoodsSoldCents: 1200,
      grossProfitCents: 900,
      netProfitCents: 900,
      revenueCents: 2100,
      salesCount: 1,
    },
  },
};

const configuredEnv = {
  AI_ASSISTANT_ENABLED: "true",
  AI_API_KEY: "test-key",
  AI_BASE_URL: "https://example.test/v1",
  AI_MODEL: "demo-model",
  AI_PROVIDER: "openai-compatible",
};

function providerReturning(value: unknown): ExternalAssistantProvider {
  return {
    completeJson: async () => value,
    name: "test-provider",
  };
}

describe("external assistant resolver", () => {
  it("uses rule-based fallback when external AI is disabled", async () => {
    let called = false;
    const result = await resolveAssistantMessageWithExternalAi("quanto vendi hoje?", {
      context: baseContext,
      env: { AI_ASSISTANT_ENABLED: "false" },
      provider: {
        completeJson: async () => {
          called = true;
          return {};
        },
        name: "should-not-run",
      },
    });

    expect(called).toBe(false);
    expect(result.source).toBe("rule-based");
    expect(result.parsed).toEqual({ kind: "question", intent: "sales", period: "today" });
  });

  it("uses rule-based fallback when AI is enabled but missing API key", async () => {
    const result = await resolveAssistantMessageWithExternalAi("vendi 2 águas por 3 reais", {
      context: baseContext,
      env: {
        AI_ASSISTANT_ENABLED: "true",
        AI_BASE_URL: "https://example.test/v1",
        AI_MODEL: "demo-model",
      },
      provider: providerReturning({}),
    });

    expect(result.fallbackReason).toBe("AI_ASSISTANT_NOT_CONFIGURED");
    expect(result.source).toBe("rule-based");
    expect(result.parsed).toMatchObject({
      kind: "sale",
      productName: "águas",
      quantity: 2,
      unitPriceCents: 300,
    });
  });

  it("can run a second review pass before accepting an external AI draft", async () => {
    const calls: Array<{ userMessage: string }> = [];
    const provider: ExternalAssistantProvider = {
      completeJson: async (request) => {
        calls.push({ userMessage: request.userMessage });

        if (calls.length === 1) {
          return { firstPass: "needs review" };
        }

        return {
          confidence: 0.92,
          draft: {
            productName: "Água mineral",
            quantity: 2,
            type: "sale",
            unitPriceCents: 300,
          },
          explanation: "Rascunho revisado contra o contexto.",
          intent: "sale_draft",
          needsReview: true,
          userMessage: "Confira a venda antes de salvar.",
        };
      },
      name: "test-provider",
    };

    const result = await resolveAssistantMessageWithExternalAi("vendi 2 águas por 3 reais", {
      context: baseContext,
      env: { ...configuredEnv, AI_ASSISTANT_REVIEW_PASS_ENABLED: "true" },
      provider,
    });

    expect(calls).toHaveLength(2);
    expect(calls[1].userMessage).toContain("Primeira resposta JSON");
    expect(result.source).toBe("external-ai");
    expect(result.parsed).toMatchObject({
      kind: "sale",
      productName: "Água mineral",
      quantity: 2,
      unitPriceCents: 300,
    });
  });

  it("keeps a no-price sale as a registered-price draft request", async () => {
    const result = await resolveAssistantMessageWithExternalAi("vendi 2 águas", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.92,
        draft: {
          productName: "Água mineral",
          quantity: 2,
          type: "sale",
          unitPriceCents: 300,
        },
        explanation: "Rascunho de venda identificado.",
        intent: "sale_draft",
        needsReview: true,
        userMessage: "Confira a venda antes de salvar.",
      }),
    });

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toMatchObject({
      kind: "sale",
      productName: "Água mineral",
      quantity: 2,
      unitPriceCents: null,
    });
  });

  it("normalizes AI sale price to null when the user did not say a price", async () => {
    const result = await resolveAssistantMessageWithExternalAi("lance duas águas vendidas", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.92,
        draft: {
          productName: "Água mineral",
          quantity: 2,
          type: "sale",
          unitPriceCents: 300,
        },
        explanation: "Rascunho de venda identificado.",
        intent: "sale_draft",
        needsReview: true,
        userMessage: "Confira a venda antes de salvar.",
      }),
    });

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toMatchObject({
      kind: "sale",
      productName: "Água mineral",
      quantity: 2,
      unitPriceCents: null,
    });
  });

  it("falls back safely when AI returns invalid structured output", async () => {
    const result = await resolveAssistantMessageWithExternalAi("vendi 2 águas por 3 reais", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.99,
        draft: { productName: "Água mineral", quantity: 2, type: "sale" },
        explanation: "Rascunho incompleto.",
        intent: "sale_draft",
        needsReview: true,
        userMessage: "Confira a venda.",
      }),
    });

    expect(result.fallbackReason).toBe("AI_ASSISTANT_INVALID_RESPONSE");
    expect(result.source).toBe("rule-based");
    expect(result.parsed).toMatchObject({
      kind: "sale",
      quantity: 2,
      unitPriceCents: 300,
    });
  });

  it("accepts a reviewed AI sale draft as a draft request, never as a persisted write", async () => {
    const result = await resolveAssistantMessageWithExternalAi("lance duas águas vendidas a tres", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.92,
        draft: {
          productName: "Água mineral",
          quantity: 2,
          type: "sale",
          unitPriceCents: 300,
        },
        explanation: "Rascunho de venda identificado.",
        intent: "sale_draft",
        needsReview: true,
        userMessage: "Confira a venda antes de salvar.",
      }),
    });

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toEqual({
      kind: "sale",
      productName: "Água mineral",
      quantity: 2,
      unitPriceCents: 300,
    });
  });

  it("accepts a reviewed AI sale draft with null price so the backend can apply the registered price", async () => {
    const result = await resolveAssistantMessageWithExternalAi("lance duas águas vendidas", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.92,
        draft: {
          productName: "Água mineral",
          quantity: 2,
          type: "sale",
          unitPriceCents: null,
        },
        explanation: "Rascunho de venda identificado.",
        intent: "sale_draft",
        needsReview: true,
        userMessage: "Confira a venda antes de salvar.",
      }),
    });

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toEqual({
      kind: "sale",
      productName: "Água mineral",
      quantity: 2,
      unitPriceCents: null,
    });
  });

  it("accepts a reviewed AI product draft as a draft request, never as a persisted write", async () => {
    const result = await resolveAssistantMessageWithExternalAi("cadastrar Coca lata custo 3 venda 6 estoque 20 mínimo 5", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.92,
        draft: {
          category: null,
          initialStock: 20,
          minimumStock: 5,
          name: "Coca lata",
          salePriceCents: 600,
          type: "product",
          unit: "UNIT",
          unitCostCents: 300,
        },
        explanation: "Rascunho de produto identificado.",
        intent: "product_draft",
        needsReview: true,
        userMessage: "Confira o produto antes de salvar.",
      }),
    });

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toEqual({
      category: null,
      initialStock: 20,
      kind: "product",
      minimumStock: 5,
      missingFields: [],
      name: "Coca lata",
      salePriceCents: 600,
      unit: "UNIT",
      unitCostCents: 300,
    });
  });

  it("accepts a reviewed AI partial purchase as a continuation request, never as a persisted write", async () => {
    const result = await resolveAssistantMessageWithExternalAi("coloca 5 coca cola que eu comprei no estoque", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.92,
        draft: {
          missingFields: ["unitCostCents"],
          productName: "Coca-Cola",
          quantity: 5,
          type: "partial_purchase",
        },
        explanation: "Entrada de estoque incompleta identificada.",
        intent: "partial_purchase",
        needsReview: true,
        userMessage: "Preciso saber quanto voce pagou por unidade.",
      }),
    });

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toEqual({
      kind: "partial_purchase",
      missingFields: ["unitCostCents"],
      productName: "Coca-Cola",
      quantity: 5,
    });
  });

  it("accepts a social external response without producing a draft or report", async () => {
    const result = await resolveAssistantMessageWithExternalAi("olá boa tarde", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.95,
        explanation: "Cumprimento simples.",
        intent: "social",
        needsReview: true,
        userMessage:
          "Boa tarde! Posso te ajudar a cadastrar produtos, registrar compras, vendas, despesas ou consultar lucro e estoque.",
      }),
    });

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toEqual({
      kind: "social",
      message:
        "Boa tarde! Posso te ajudar a cadastrar produtos, registrar compras, vendas, despesas ou consultar lucro e estoque.",
    });
  });

  it("accepts a reviewed AI ambiguous purchase amount as a clarification request", async () => {
    const result = await resolveAssistantMessageWithExternalAi("comprei 5 refrigerantes por 20 reais", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.92,
        draft: {
          amountCents: 2000,
          productName: "refrigerantes",
          quantity: 5,
          type: "ambiguous_purchase_cost",
        },
        explanation: "Valor de compra ambiguo.",
        intent: "ambiguous_purchase_cost",
        needsReview: true,
        userMessage: "Esses R$ 20 foram o total da compra ou o valor de cada unidade?",
      }),
    });

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toEqual({
      amountCents: 2000,
      kind: "ambiguous_purchase_cost",
      productName: "refrigerantes",
      quantity: 5,
    });
  });

  it("accepts the v2 intelligence contract with entities, missing fields and draftCandidate", async () => {
    const result = await resolveAssistantMessageWithExternalAi(
      "quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma",
      {
        context: baseContext,
        env: configuredEnv,
        provider: providerReturning({
          ambiguity: { requiresDbLookup: true },
          confidence: 0.91,
          draftCandidate: {
            productName: "Coca Cola lata",
            quantity: 10,
            type: "purchase",
            unitCostCents: 420,
          },
          entities: {
            amountKind: "unit",
            productName: "Coca Cola lata",
            quantity: 10,
            unitCostCents: 420,
            variant: "lata",
          },
          explanation: "Entrada/cadastro seguro com custo unitario extraido.",
          intent: "purchase_draft",
          missingFields: ["salePriceCents", "minimumStock"],
          needsReview: true,
          nextQuestion: "Por quanto voce vende cada unidade?",
          userMessage: "Vou preparar o cadastro seguro e perguntar o preco de venda.",
        }),
      },
    );

    expect(result.source).toBe("external-ai");
    expect(result.parsed).toEqual({
      kind: "purchase",
      productName: "Coca Cola lata",
      quantity: 10,
      unitCostCents: 420,
    });
  });

  it("rejects external product drafts with missing critical values", async () => {
    const result = await resolveAssistantMessageWithExternalAi("cadastrar produto refrigerante", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.92,
        draft: {
          name: "refrigerante",
          type: "product",
          unit: "UNIT",
        },
        explanation: "Rascunho de produto incompleto.",
        intent: "product_draft",
        needsReview: true,
        userMessage: "Preciso de mais dados.",
      }),
    });

    expect(result.fallbackReason).toBe("AI_ASSISTANT_INVALID_RESPONSE");
    expect(result.source).toBe("rule-based");
    expect(result.parsed).toMatchObject({
      kind: "product",
      missingFields: ["unitCostCents", "salePriceCents", "initialStock", "minimumStock"],
      name: "refrigerante",
    });
  });

  it("rejects critical AI drafts without review flag", () => {
    const parsed = externalAssistantResponseSchema.safeParse({
      confidence: 0.9,
      draft: {
        productName: "Água mineral",
        quantity: 2,
        type: "sale",
        unitPriceCents: 300,
      },
      explanation: "Venda identificada.",
      intent: "sale_draft",
      needsReview: false,
      userMessage: "Venda pronta.",
    });

    expect(parsed.success).toBe(false);
  });

  it("keeps deterministic finance as source of truth even if AI explanation invents numbers", async () => {
    const result = await resolveAssistantMessageWithExternalAi("quanto foi meu lucro hoje?", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.9,
        explanation: "Voce lucrou R$ 9.999,00.",
        intent: "question",
        needsReview: true,
        question: { intent: "profit", period: "today" },
        userMessage: "Vou consultar o lucro de hoje.",
      }),
    });
    const summary = buildDashboardSummary({
      now: new Date(2026, 4, 22, 12, 0, 0, 0),
      expenses: [],
      products: [],
      sales: [
        {
          id: "sale_today",
          items: [
            {
              quantity: 3,
              totalAmountCents: 2100,
              totalCostCents: 1200,
              unitCostSnapshotCents: 400,
              unitPriceCents: 700,
            },
          ],
          soldAt: new Date(2026, 4, 22, 10, 0, 0, 0),
          totalAmountCents: 2100,
        },
      ],
    });

    if (result.parsed.kind !== "question") {
      throw new Error("Expected a question intent.");
    }

    const answer = answerQuestionFromSummary(result.parsed, summary);

    expect(answer.value).toBe("R$ 9,00");
    expect(answer.body).not.toContain("9.999");
  });

  it("prefers deterministic parsing when external AI conflicts with a known financial question", async () => {
    const result = await resolveAssistantMessageWithExternalAi("quanto foi meu lucro hoje?", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.9,
        explanation: "Pergunta identificada.",
        intent: "question",
        needsReview: true,
        question: { intent: "sales", period: "today" },
        userMessage: "Vou consultar as vendas de hoje.",
      }),
    });

    expect(result.fallbackReason).toBe("AI_ASSISTANT_INVALID_RESPONSE");
    expect(result.source).toBe("rule-based");
    expect(result.parsed).toEqual({ kind: "question", intent: "profit", period: "today" });
  });

  it("prefers deterministic clarification when purchase cost is ambiguous", async () => {
    const result = await resolveAssistantMessageWithExternalAi("comprei 5 refrigerantes por 20 reais", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.9,
        draft: {
          productName: "Coca-Cola",
          quantity: 5,
          type: "purchase",
          unitCostCents: 2000,
        },
        explanation: "Compra identificada.",
        intent: "purchase_draft",
        needsReview: true,
        userMessage: "Confira a compra antes de salvar.",
      }),
    });

    expect(result.fallbackReason).toBe("AI_ASSISTANT_INVALID_RESPONSE");
    expect(result.source).toBe("rule-based");
    expect(result.parsed).toEqual({
      amountCents: 2000,
      kind: "ambiguous_purchase_cost",
      productName: "refrigerantes",
      quantity: 5,
    });
  });

  it("prefers deterministic parsing when external AI changes the purchased product name", async () => {
    const result = await resolveAssistantMessageWithExternalAi("comprei 5 águas por 2 reais cada", {
      context: baseContext,
      env: configuredEnv,
      provider: providerReturning({
        confidence: 0.9,
        draft: {
          productName: "Suco de uva",
          quantity: 5,
          type: "purchase",
          unitCostCents: 200,
        },
        explanation: "Compra identificada.",
        intent: "purchase_draft",
        needsReview: true,
        userMessage: "Confira a compra antes de salvar.",
      }),
    });

    expect(result.fallbackReason).toBe("AI_ASSISTANT_INVALID_RESPONSE");
    expect(result.source).toBe("rule-based");
    expect(result.parsed).toMatchObject({
      kind: "purchase",
      productName: "águas",
      quantity: 5,
      unitCostCents: 200,
    });
  });

  it("falls back when the provider fails instead of surfacing raw errors", async () => {
    const provider: ExternalAssistantProvider = {
      completeJson: async () => {
        throw new AiAssistantError("AI_ASSISTANT_HTTP_ERROR", "Falha controlada do provedor.");
      },
      name: "failing-provider",
    };

    const result = await resolveAssistantMessageWithExternalAi("gastei 35 com embalagem", {
      context: baseContext,
      env: configuredEnv,
      provider,
    });

    expect(result.fallbackReason).toBe("AI_ASSISTANT_HTTP_ERROR");
    expect(result.source).toBe("rule-based");
    expect(result.parsed).toMatchObject({
      amountCents: 3500,
      category: "PACKAGING_MATERIAL",
      kind: "expense",
    });
  });
});
