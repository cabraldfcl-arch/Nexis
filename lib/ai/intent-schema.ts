import type { ExpenseCategoryValue } from "@/lib/validation/expense";
import type { ProductUnitValue } from "@/lib/validation/product";

export const questionIntentValues = [
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
] as const;
export const questionPeriodValues = ["today", "month"] as const;

export type AssistantQuestionIntent = (typeof questionIntentValues)[number];
export type AssistantQuestionPeriod = (typeof questionPeriodValues)[number];

export type ParsedQuestion = {
  kind: "question";
  intent: AssistantQuestionIntent;
  period: AssistantQuestionPeriod;
  productName?: string;
};

export type ParsedCommercialUnitFields = {
  priceBasis?: string;
  unit?: ProductUnitValue;
  unitLabel?: string;
};

export type ParsedSaleDraftRequest = {
  kind: "sale";
  productName: string;
  quantity: number;
  unitPriceCents: number | null;
} & ParsedCommercialUnitFields;

export type ParsedPurchaseDraftRequest = {
  kind: "purchase";
  productName: string;
  quantity: number;
  unitCostCents: number;
} & ParsedCommercialUnitFields;

export type ParsedPartialPurchaseRequest = {
  kind: "partial_purchase";
  productName: string;
  quantity: number;
  missingFields: ["unitCostCents"];
} & ParsedCommercialUnitFields;

export type ParsedAmbiguousPurchaseCostRequest = {
  amountCents: number;
  kind: "ambiguous_purchase_cost";
  productName: string;
  quantity: number;
} & ParsedCommercialUnitFields;

export type ParsedExpenseDraftRequest = {
  kind: "expense";
  description: string;
  category: ExpenseCategoryValue;
  amountCents: number;
};

export type ParsedStockLossDraftRequest = {
  kind: "stock_loss";
  productName: string;
  quantity: number;
  reason: string;
};

export type ParsedCancellationRequest = {
  kind: "cancellation";
  targetType: "expense" | "purchase" | "sale";
  productName?: string;
  reason: string;
};

export const productDraftMissingFieldValues = [
  "name",
  "unitCostCents",
  "salePriceCents",
  "initialStock",
  "minimumStock",
] as const;

export type ProductDraftMissingField = (typeof productDraftMissingFieldValues)[number];

export type ParsedProductDraftRequest = {
  kind: "product";
  name: string | null;
  category: string | null;
  initialStockSource?: "purchase";
  unit: ProductUnitValue;
  unitCostCents: number | null;
  salePriceCents: number | null;
  initialStock: number | null;
  minimumStock: number | null;
  missingFields: ProductDraftMissingField[];
};

export type ParsedUnknownMessage = {
  kind: "unknown";
  message: string;
};

export type ParsedSocialMessage = {
  kind: "social";
  message: string;
};

export type ParsedAssistantMessage =
  | ParsedQuestion
  | ParsedSaleDraftRequest
  | ParsedPurchaseDraftRequest
  | ParsedPartialPurchaseRequest
  | ParsedAmbiguousPurchaseCostRequest
  | ParsedExpenseDraftRequest
  | ParsedStockLossDraftRequest
  | ParsedCancellationRequest
  | ParsedProductDraftRequest
  | ParsedSocialMessage
  | ParsedUnknownMessage;
