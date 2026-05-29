import { z } from "zod";
import { getAiAssistantConfig, requireConfiguredAiAssistantConfig, type AiAssistantEnv } from "./ai-config";
import { AiAssistantError, type AiAssistantErrorCode } from "./ai-errors";
import type { ParsedAssistantMessage } from "./intent-schema";
import { nexisAssistantSchemaName, nexisAssistantSystemPrompt } from "./nexis-system-prompt";
import { parseAssistantMessage } from "./parse-message";
import { createOpenAiCompatibleProvider, type AiAssistantProvider } from "./provider";
import { allExpenseCategoryValues } from "@/lib/validation/expense";
import { productUnitValues } from "@/lib/validation/product";

export type ExternalAssistantProvider = AiAssistantProvider;

export type ExternalAssistantContext = {
  activeProducts: {
    aliases?: string[];
    currentStock: number;
    name: string;
    salePriceCents: number;
    unitCostCents: number;
  }[];
  expenseCategories: string[];
  financialSummary: {
    lowStockProducts: {
      currentStock: number;
      minimumStock: number;
      name: string;
    }[];
    month: ExternalAssistantPeriodSummary;
    today: ExternalAssistantPeriodSummary;
  } | null;
};

export type ExternalAssistantPeriodSummary = {
  confirmedExpensesCents: number;
  costOfGoodsSoldCents: number;
  grossProfitCents: number;
  netProfitCents: number;
  pendingExpensesCents?: number;
  revenueCents: number;
  salesCount: number;
};

export type ResolvedAssistantMessage = {
  ai?: ExternalAssistantResponse;
  fallbackReason?: AiAssistantErrorCode;
  parsed: ParsedAssistantMessage;
  source: "external-ai" | "rule-based";
};

type ResolveOptions = {
  context?: ExternalAssistantContext | (() => Promise<ExternalAssistantContext>);
  env?: AiAssistantEnv;
  provider?: ExternalAssistantProvider;
};

const confidenceThreshold = 0.7;
const positiveQuantitySchema = z.number().finite().positive();
const positiveCentsSchema = z.number().int().positive();
const nonNegativeQuantitySchema = z.number().finite().nonnegative();
const nonNegativeCentsSchema = z.number().int().nonnegative();
const externalCommercialUnitFields = {
  priceBasis: z.string().trim().min(1).optional(),
  unit: z.enum(productUnitValues).optional(),
  unitLabel: z.string().trim().min(1).optional(),
};

const externalQuestionSchema = z.object({
  intent: z.enum([
    "sales",
    "profit",
    "grossProfit",
    "netProfit",
    "dailySummary",
    "expenses",
    "inventory",
    "purchases",
    "topProducts",
    "lowStock",
    "cashFlow",
  ]),
  period: z.enum(["today", "month"]),
  productName: z.string().trim().min(1).optional(),
});

const externalDraftSchema = z.discriminatedUnion("type", [
  z.object({
    productName: z.string().trim().min(1),
    quantity: positiveQuantitySchema,
    type: z.literal("sale"),
    unitPriceCents: positiveCentsSchema.nullable(),
    ...externalCommercialUnitFields,
  }),
  z.object({
    productName: z.string().trim().min(1),
    quantity: positiveQuantitySchema,
    type: z.literal("purchase"),
    unitCostCents: positiveCentsSchema,
    ...externalCommercialUnitFields,
  }),
  z.object({
    missingFields: z.tuple([z.literal("unitCostCents")]),
    productName: z.string().trim().min(1),
    quantity: positiveQuantitySchema,
    type: z.literal("partial_purchase"),
    ...externalCommercialUnitFields,
  }),
  z.object({
    amountCents: positiveCentsSchema,
    productName: z.string().trim().min(1),
    quantity: positiveQuantitySchema,
    type: z.literal("ambiguous_purchase_cost"),
    ...externalCommercialUnitFields,
  }),
  z.object({
    amountCents: positiveCentsSchema,
    category: z.enum(allExpenseCategoryValues),
    description: z.string().trim().min(2),
    type: z.literal("expense"),
  }),
  z.object({
    productName: z.string().trim().min(1),
    quantity: positiveQuantitySchema,
    reason: z.string().trim().min(2),
    type: z.literal("stock_loss"),
  }),
  z.object({
    productName: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(2),
    targetType: z.enum(["expense", "purchase", "sale"]),
    type: z.literal("cancellation"),
  }),
  z.object({
    category: z.string().trim().min(1).nullable().optional(),
    initialStock: nonNegativeQuantitySchema,
    minimumStock: nonNegativeQuantitySchema,
    name: z.string().trim().min(2),
    salePriceCents: nonNegativeCentsSchema,
    type: z.literal("product"),
    unit: z.enum(productUnitValues),
    unitCostCents: nonNegativeCentsSchema,
  }),
]);

const externalEntitiesSchema = z
  .object({
    amountCents: nonNegativeCentsSchema.optional(),
    amountKind: z.enum(["ambiguous", "total", "unit"]).optional(),
    expenseCategory: z.string().trim().min(1).optional(),
    minimumStock: nonNegativeQuantitySchema.optional(),
    priceBasis: z.string().trim().min(1).optional(),
    productName: z.string().trim().min(1).optional(),
    quantity: nonNegativeQuantitySchema.optional(),
    salePriceCents: nonNegativeCentsSchema.optional(),
    unit: z.enum(productUnitValues).optional(),
    unitLabel: z.string().trim().min(1).optional(),
    unitCostCents: nonNegativeCentsSchema.optional(),
    variant: z.string().trim().min(1).optional(),
  })
  .strict();

const externalAmbiguitySchema = z
  .object({
    options: z.array(z.string().trim().min(1)).max(10).optional(),
    reason: z.enum(["intent", "multiple_actions", "product", "value"]).optional(),
    requiresDbLookup: z.boolean().optional(),
  })
  .strict();

export const externalAssistantResponseSchema = z
  .object({
    ambiguity: externalAmbiguitySchema.optional(),
    confidence: z.number().min(0).max(1),
    draft: externalDraftSchema.optional(),
    draftCandidate: externalDraftSchema.optional(),
    entities: externalEntitiesSchema.optional(),
    explanation: z.string().trim().max(800).optional().default(""),
    intent: z.enum([
      "question",
      "social",
      "sale_draft",
      "purchase_draft",
      "partial_purchase",
      "ambiguous_purchase_cost",
      "expense_draft",
      "stock_loss_draft",
      "cancellation_draft",
      "product_draft",
      "unknown",
    ]),
    missingFields: z.array(z.string().trim().min(1)).max(12).optional().default([]),
    needsReview: z.boolean(),
    nextQuestion: z.string().trim().max(500).optional(),
    question: externalQuestionSchema.optional(),
    sensitiveProductWarning: z.boolean().optional().default(false),
    serviceUnsupported: z.boolean().optional().default(false),
    userMessage: z.string().trim().min(1).max(500),
  })
  .superRefine((response, ctx) => {
    if (response.confidence < confidenceThreshold && !response.needsReview) {
      ctx.addIssue({
        code: "custom",
        message: "Respostas com baixa confiança precisam de revisão.",
        path: ["needsReview"],
      });
    }

    if (response.intent === "question" && !response.question) {
      ctx.addIssue({ code: "custom", message: "Pergunta sem intenção estruturada.", path: ["question"] });
    }

    if (response.intent === "sale_draft") {
      validateDraft(response.draft ?? response.draftCandidate, "sale", response.needsReview, ctx);
    }

    if (response.intent === "purchase_draft") {
      validateDraft(response.draft ?? response.draftCandidate, "purchase", response.needsReview, ctx);
    }

    if (response.intent === "partial_purchase") {
      validateDraft(response.draft ?? response.draftCandidate, "partial_purchase", response.needsReview, ctx);
    }

    if (response.intent === "ambiguous_purchase_cost") {
      validateDraft(response.draft ?? response.draftCandidate, "ambiguous_purchase_cost", response.needsReview, ctx);
    }

    if (response.intent === "expense_draft") {
      validateDraft(response.draft ?? response.draftCandidate, "expense", response.needsReview, ctx);
    }

    if (response.intent === "stock_loss_draft") {
      validateDraft(response.draft ?? response.draftCandidate, "stock_loss", response.needsReview, ctx);
    }

    if (response.intent === "cancellation_draft") {
      validateDraft(response.draft ?? response.draftCandidate, "cancellation", response.needsReview, ctx);
    }

    if (response.intent === "product_draft") {
      validateDraft(response.draft ?? response.draftCandidate, "product", response.needsReview, ctx);
    }
  });

export type ExternalAssistantResponse = z.infer<typeof externalAssistantResponseSchema>;

export async function resolveAssistantMessageWithExternalAi(
  userMessage: string,
  options: ResolveOptions = {},
): Promise<ResolvedAssistantMessage> {
  const config = getAiAssistantConfig(options.env);

  if (!config.enabled) {
    return ruleBasedResult(userMessage);
  }

  if (!config.configured) {
    return ruleBasedResult(userMessage, "AI_ASSISTANT_NOT_CONFIGURED");
  }

  try {
    const provider = options.provider ?? createOpenAiCompatibleProvider(requireConfiguredAiAssistantConfig(config));
    const context = await resolveContext(options.context);
    const rawResponse = await provider.completeJson({
      context,
      schemaName: nexisAssistantSchemaName,
      systemPrompt: nexisAssistantSystemPrompt,
      userMessage,
    });
    const finalResponse = config.reviewPassEnabled
      ? await provider.completeJson({
        context,
        schemaName: nexisAssistantSchemaName,
        systemPrompt: nexisAssistantSystemPrompt,
        userMessage: buildReviewPassUserMessage(userMessage, rawResponse),
      })
      : rawResponse;
    const parsedResponse = externalAssistantResponseSchema.safeParse(finalResponse);

    if (!parsedResponse.success) {
      throw new AiAssistantError("AI_ASSISTANT_INVALID_RESPONSE", "IA externa retornou resposta invalida.");
    }

    const parsed = toParsedAssistantMessage(parsedResponse.data, userMessage);
    const ruleBasedParsed = parseAssistantMessage(userMessage);

    if (shouldPreferRuleBased(ruleBasedParsed, parsed)) {
      return {
        ai: parsedResponse.data,
        fallbackReason: "AI_ASSISTANT_INVALID_RESPONSE",
        parsed: ruleBasedParsed,
        source: "rule-based",
      };
    }

    if (parsed.kind === "unknown") {
      return bestAvailableUnknownResult(userMessage, parsedResponse.data);
    }

    return {
      ai: parsedResponse.data,
      parsed,
      source: "external-ai",
    };
  } catch (error) {
    return ruleBasedResult(userMessage, aiFallbackReason(error));
  }
}

function buildReviewPassUserMessage(originalMessage: string, firstResponse: unknown): string {
  return [
    "Revise a interpretacao abaixo antes de devolver o JSON final.",
    "Use o mesmo contrato estruturado, o contexto de produtos/estoque enviado pelo backend e as regras deterministicas.",
    "Se houver produto ambiguo, campo faltante, valor inseguro ou operacao critica sem certeza, retorne pergunta ou unknown com needsReview=true.",
    "Nao salve nada e nao invente productId, custo, preco, estoque ou produto existente.",
    `Mensagem original do usuario: ${originalMessage}`,
    `Primeira resposta JSON: ${JSON.stringify(firstResponse)}`,
  ].join("\n");
}

function validateDraft(
  draft: z.infer<typeof externalDraftSchema> | undefined,
  expectedType:
    | "ambiguous_purchase_cost"
    | "cancellation"
    | "expense"
    | "partial_purchase"
    | "product"
    | "purchase"
    | "sale"
    | "stock_loss",
  needsReview: boolean,
  ctx: z.RefinementCtx,
): void {
  if (!draft || draft.type !== expectedType) {
    ctx.addIssue({
      code: "custom",
      message: "Rascunho critico ausente ou com tipo incorreto.",
      path: ["draft"],
    });
  }

  if (!needsReview) {
    ctx.addIssue({
      code: "custom",
      message: "Rascunho critico precisa de revisao.",
      path: ["needsReview"],
    });
  }
}

async function resolveContext(
  context: ExternalAssistantContext | (() => Promise<ExternalAssistantContext>) | undefined,
): Promise<ExternalAssistantContext> {
  if (typeof context === "function") {
    return context();
  }

  return context ?? {
    activeProducts: [],
    expenseCategories: [],
    financialSummary: null,
  };
}

function toParsedAssistantMessage(response: ExternalAssistantResponse, userMessage: string): ParsedAssistantMessage {
  const draft = response.draft ?? response.draftCandidate;

  if (response.confidence < confidenceThreshold || response.intent === "unknown") {
    return { kind: "unknown", message: response.userMessage };
  }

  if (response.intent === "question" && response.question) {
    return {
      kind: "question",
      intent: response.question.intent,
      period: response.question.period,
      productName: response.question.productName,
    };
  }

  if (response.intent === "social") {
    return {
      kind: "social",
      message: response.userMessage,
    };
  }

  if (response.intent === "sale_draft" && draft?.type === "sale") {
    return {
      kind: "sale",
      productName: draft.productName,
      quantity: draft.quantity,
      ...externalParsedUnitFields(draft),
      unitPriceCents: hasExplicitSalePrice(userMessage) ? draft.unitPriceCents : null,
    };
  }

  if (response.intent === "purchase_draft" && draft?.type === "purchase") {
    return {
      kind: "purchase",
      productName: draft.productName,
      quantity: draft.quantity,
      ...externalParsedUnitFields(draft),
      unitCostCents: draft.unitCostCents,
    };
  }

  if (response.intent === "partial_purchase" && draft?.type === "partial_purchase") {
    return {
      kind: "partial_purchase",
      productName: draft.productName,
      quantity: draft.quantity,
      missingFields: ["unitCostCents"],
      ...externalParsedUnitFields(draft),
    };
  }

  if (response.intent === "ambiguous_purchase_cost" && draft?.type === "ambiguous_purchase_cost") {
    return {
      amountCents: draft.amountCents,
      kind: "ambiguous_purchase_cost",
      productName: draft.productName,
      quantity: draft.quantity,
      ...externalParsedUnitFields(draft),
    };
  }

  if (response.intent === "expense_draft" && draft?.type === "expense") {
    return {
      amountCents: draft.amountCents,
      category: draft.category,
      description: draft.description,
      kind: "expense",
    };
  }

  if (response.intent === "stock_loss_draft" && draft?.type === "stock_loss") {
    return {
      kind: "stock_loss",
      productName: draft.productName,
      quantity: draft.quantity,
      reason: draft.reason,
    };
  }

  if (response.intent === "cancellation_draft" && draft?.type === "cancellation") {
    return {
      kind: "cancellation",
      productName: draft.productName,
      reason: draft.reason,
      targetType: draft.targetType,
    };
  }

  if (response.intent === "product_draft" && draft?.type === "product") {
    return {
      category: draft.category ?? null,
      initialStock: draft.initialStock,
      kind: "product",
      minimumStock: draft.minimumStock,
      missingFields: [],
      name: draft.name,
      salePriceCents: draft.salePriceCents,
      unit: draft.unit,
      unitCostCents: draft.unitCostCents,
    };
  }

  return { kind: "unknown", message: response.userMessage };
}

function externalParsedUnitFields(
  draft: { priceBasis?: string; unit?: (typeof productUnitValues)[number]; unitLabel?: string },
): { priceBasis?: string; unit?: (typeof productUnitValues)[number]; unitLabel?: string } {
  const fields: { priceBasis?: string; unit?: (typeof productUnitValues)[number]; unitLabel?: string } = {};

  if (draft.priceBasis) {
    fields.priceBasis = draft.priceBasis;
  }

  if (draft.unit) {
    fields.unit = draft.unit;
  }

  if (draft.unitLabel) {
    fields.unitLabel = draft.unitLabel;
  }

  return fields;
}

function hasExplicitSalePrice(userMessage: string): boolean {
  const normalized = userMessage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /r\$|\bpor\b|\bcada\b|\btotal\b|\b(?:real|reais)\b|\bpreco\b|\bvalor\b|\ba\s+(?:r\$|\d|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/.test(
    normalized,
  );
}

function shouldPreferRuleBased(ruleBased: ParsedAssistantMessage, parsed: ParsedAssistantMessage): boolean {
  if (ruleBased.kind === "unknown") {
    return false;
  }

  if (parsed.kind === "unknown") {
    return true;
  }

  if (ruleBased.kind !== parsed.kind) {
    return true;
  }

  if (ruleBased.kind === "ambiguous_purchase_cost" && parsed.kind === "ambiguous_purchase_cost") {
    return (
      ruleBased.amountCents !== parsed.amountCents ||
      productNamesConflict(ruleBased.productName, parsed.productName) ||
      ruleBased.quantity !== parsed.quantity ||
      commercialUnitFieldsConflict(ruleBased, parsed)
    );
  }

  if (ruleBased.kind === "question" && parsed.kind === "question") {
    return (
      ruleBased.intent !== parsed.intent ||
      ruleBased.period !== parsed.period ||
      ruleBased.productName !== parsed.productName
    );
  }

  if (ruleBased.kind === "sale" && parsed.kind === "sale") {
    return (
      productNamesConflict(ruleBased.productName, parsed.productName) ||
      ruleBased.quantity !== parsed.quantity ||
      ruleBased.unitPriceCents !== parsed.unitPriceCents ||
      commercialUnitFieldsConflict(ruleBased, parsed)
    );
  }

  if (ruleBased.kind === "purchase" && parsed.kind === "purchase") {
    return (
      productNamesConflict(ruleBased.productName, parsed.productName) ||
      ruleBased.quantity !== parsed.quantity ||
      ruleBased.unitCostCents !== parsed.unitCostCents ||
      commercialUnitFieldsConflict(ruleBased, parsed)
    );
  }

  if (ruleBased.kind === "partial_purchase" && parsed.kind === "partial_purchase") {
    return (
      productNamesConflict(ruleBased.productName, parsed.productName) ||
      ruleBased.quantity !== parsed.quantity ||
      ruleBased.missingFields.join("|") !== parsed.missingFields.join("|") ||
      commercialUnitFieldsConflict(ruleBased, parsed)
    );
  }

  if (ruleBased.kind === "social" && parsed.kind === "social") {
    return ruleBased.message !== parsed.message;
  }

  if (ruleBased.kind === "expense" && parsed.kind === "expense") {
    return ruleBased.amountCents !== parsed.amountCents || ruleBased.category !== parsed.category;
  }

  if (ruleBased.kind === "stock_loss" && parsed.kind === "stock_loss") {
    return (
      ruleBased.productName !== parsed.productName ||
      ruleBased.quantity !== parsed.quantity ||
      ruleBased.reason !== parsed.reason
    );
  }

  if (ruleBased.kind === "cancellation" && parsed.kind === "cancellation") {
    return (
      ruleBased.targetType !== parsed.targetType ||
      ruleBased.productName !== parsed.productName ||
      ruleBased.reason !== parsed.reason
    );
  }

  if (ruleBased.kind === "product" && parsed.kind === "product") {
    return (
      ruleBased.name !== parsed.name ||
      ruleBased.unit !== parsed.unit ||
      ruleBased.unitCostCents !== parsed.unitCostCents ||
      ruleBased.salePriceCents !== parsed.salePriceCents ||
      ruleBased.initialStock !== parsed.initialStock ||
      ruleBased.minimumStock !== parsed.minimumStock ||
      ruleBased.missingFields.join("|") !== parsed.missingFields.join("|")
    );
  }

  return false;
}

function commercialUnitFieldsConflict(
  ruleBased: { priceBasis?: string; unit?: string; unitLabel?: string },
  parsed: { priceBasis?: string; unit?: string; unitLabel?: string },
): boolean {
  return (
    optionalTextFieldConflict(ruleBased.priceBasis, parsed.priceBasis) ||
    optionalTextFieldConflict(ruleBased.unit, parsed.unit) ||
    optionalTextFieldConflict(ruleBased.unitLabel, parsed.unitLabel)
  );
}

function optionalTextFieldConflict(ruleBased?: string, parsed?: string): boolean {
  if (!ruleBased || !parsed) {
    return false;
  }

  return normalizeComparableText(ruleBased) !== normalizeComparableText(parsed);
}

function productNamesConflict(ruleBasedName: string, parsedName: string): boolean {
  const ruleTokens = comparableProductTokens(ruleBasedName);
  const parsedTokens = comparableProductTokens(parsedName);

  if (ruleTokens.length === 0 || parsedTokens.length === 0) {
    return normalizeComparableText(ruleBasedName) !== normalizeComparableText(parsedName);
  }

  return !ruleTokens.some((token) => parsedTokens.includes(token));
}

function comparableProductTokens(value: string): string[] {
  return normalizeComparableText(value)
    .split(" ")
    .map((token) => (token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token))
    .filter((token) => token.length > 1 && !["a", "as", "de", "da", "das", "do", "dos", "e", "o", "os"].includes(token));
}

function normalizeComparableText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bestAvailableUnknownResult(
  userMessage: string,
  response: ExternalAssistantResponse,
): ResolvedAssistantMessage {
  const fallback = parseAssistantMessage(userMessage);

  if (fallback.kind !== "unknown") {
    return {
      ai: response,
      fallbackReason: "AI_ASSISTANT_INVALID_RESPONSE",
      parsed: fallback,
      source: "rule-based",
    };
  }

  return {
    ai: response,
    parsed: { kind: "unknown", message: response.userMessage },
    source: "external-ai",
  };
}

function ruleBasedResult(userMessage: string, fallbackReason?: AiAssistantErrorCode): ResolvedAssistantMessage {
  return {
    fallbackReason,
    parsed: parseAssistantMessage(userMessage),
    source: "rule-based",
  };
}

function aiFallbackReason(error: unknown): AiAssistantErrorCode {
  if (error instanceof AiAssistantError) {
    return error.code;
  }

  return "AI_ASSISTANT_HTTP_ERROR";
}
