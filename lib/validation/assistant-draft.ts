import { z } from "zod";
import { calculateLineTotalCents } from "@/lib/finance";
import { allExpenseCategoryValues } from "./expense";
import { productUnitValues } from "./product";

const positiveQuantitySchema = z.number().finite().positive();
const positiveCentsSchema = z.number().int().positive();
const nonNegativeCentsSchema = z.number().int().nonnegative();
const stockQuantitySchema = z.number().finite().nonnegative();

export const saleDraftSchema = z
  .object({
    type: z.literal("sale"),
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: positiveQuantitySchema,
    registeredSalePriceCents: positiveCentsSchema,
    unitPriceCents: positiveCentsSchema,
    unitCostSnapshotCents: nonNegativeCentsSchema,
    totalAmountCents: positiveCentsSchema,
    totalCostCents: nonNegativeCentsSchema,
    estimatedGrossProfitCents: z.number().int(),
    stockBefore: stockQuantitySchema,
    stockAfter: stockQuantitySchema,
    stockImpact: z.number().finite().negative(),
  })
  .superRefine((draft, ctx) => {
    const totalAmountCents = calculateLineTotalCents({
      quantity: draft.quantity,
      unitAmountCents: draft.unitPriceCents,
      quantityFieldName: "quantidade vendida",
      unitAmountFieldName: "preco de venda",
    });

    if (draft.totalAmountCents !== totalAmountCents) {
      ctx.addIssue({
        code: "custom",
        message: "Total da venda inconsistente.",
        path: ["totalAmountCents"],
      });
    }

    const totalCostCents = calculateLineTotalCents({
      quantity: draft.quantity,
      unitAmountCents: draft.unitCostSnapshotCents,
      quantityFieldName: "quantidade vendida",
      unitAmountFieldName: "custo para voce",
    });

    if (draft.totalCostCents !== totalCostCents) {
      ctx.addIssue({
        code: "custom",
        message: "Custo estimado da venda inconsistente.",
        path: ["totalCostCents"],
      });
    }

    if (draft.estimatedGrossProfitCents !== draft.totalAmountCents - draft.totalCostCents) {
      ctx.addIssue({
        code: "custom",
        message: "Lucro estimado da venda inconsistente.",
        path: ["estimatedGrossProfitCents"],
      });
    }

    if (draft.stockAfter !== draft.stockBefore + draft.stockImpact) {
      ctx.addIssue({
        code: "custom",
        message: "Estoque apos a venda inconsistente.",
        path: ["stockAfter"],
      });
    }

    if (draft.stockImpact !== -draft.quantity) {
      ctx.addIssue({
        code: "custom",
        message: "Impacto de estoque da venda deve ser negativo.",
        path: ["stockImpact"],
      });
    }
  });

export const purchaseDraftSchema = z
  .object({
    type: z.literal("purchase"),
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: positiveQuantitySchema,
    unitCostCents: positiveCentsSchema,
    totalCostCents: positiveCentsSchema,
    stockImpact: z.number().finite().positive(),
  })
  .superRefine((draft, ctx) => {
    const totalCostCents = calculateLineTotalCents({
      quantity: draft.quantity,
      unitAmountCents: draft.unitCostCents,
      quantityFieldName: "quantidade comprada",
      unitAmountFieldName: "custo por unidade",
    });

    if (draft.totalCostCents !== totalCostCents) {
      ctx.addIssue({
        code: "custom",
        message: "Total da compra inconsistente.",
        path: ["totalCostCents"],
      });
    }

    if (draft.stockImpact !== draft.quantity) {
      ctx.addIssue({
        code: "custom",
        message: "Impacto de estoque da compra deve ser positivo.",
        path: ["stockImpact"],
      });
    }
  });

export const expenseDraftSchema = z.object({
  type: z.literal("expense"),
  description: z.string().trim().min(2),
  category: z.enum(allExpenseCategoryValues),
  amountCents: positiveCentsSchema,
  confirmed: z.literal(false),
  paidAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Data invalida."),
});

export const stockLossDraftSchema = z
  .object({
    type: z.literal("stock_loss"),
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: positiveQuantitySchema,
    reason: z.string().trim().min(2),
    unitCostSnapshotCents: nonNegativeCentsSchema,
    totalCostCents: nonNegativeCentsSchema,
    stockBefore: stockQuantitySchema,
    stockAfter: stockQuantitySchema,
    stockImpact: z.number().finite().negative(),
  })
  .superRefine((draft, ctx) => {
    const totalCostCents = calculateLineTotalCents({
      quantity: draft.quantity,
      unitAmountCents: draft.unitCostSnapshotCents,
      quantityFieldName: "quantidade perdida",
      unitAmountFieldName: "custo para voce",
    });

    if (draft.totalCostCents !== totalCostCents) {
      ctx.addIssue({
        code: "custom",
        message: "Custo estimado da perda inconsistente.",
        path: ["totalCostCents"],
      });
    }

    if (draft.stockAfter !== draft.stockBefore + draft.stockImpact) {
      ctx.addIssue({
        code: "custom",
        message: "Estoque apos a perda inconsistente.",
        path: ["stockAfter"],
      });
    }

    if (draft.stockImpact !== -draft.quantity) {
      ctx.addIssue({
        code: "custom",
        message: "Impacto de estoque da perda deve ser negativo.",
        path: ["stockImpact"],
      });
    }
  });

export const cancellationDraftSchema = z.object({
  type: z.literal("cancellation"),
  targetType: z.enum(["expense", "purchase", "sale", "stock_loss"]),
  targetId: z.string().min(1),
  targetLabel: z.string().min(1),
  reason: z.string().trim().min(2),
  stockImpact: z.number().finite(),
  amountImpactCents: z.number().int(),
});

export const productDraftSchema = z.object({
  type: z.literal("product"),
  name: z.string().trim().min(2),
  category: z.string().trim().min(1).nullable(),
  unit: z.enum(productUnitValues),
  unitCostCents: nonNegativeCentsSchema,
  salePriceCents: nonNegativeCentsSchema,
  initialStock: stockQuantitySchema,
  minimumStock: stockQuantitySchema,
});

export const assistantDraftSchema = z.union([
  saleDraftSchema,
  purchaseDraftSchema,
  expenseDraftSchema,
  stockLossDraftSchema,
  cancellationDraftSchema,
  productDraftSchema,
]);

export const assistantQuestionSchema = z.object({
  type: z.literal("question"),
  intent: z.enum(["sales", "profit", "expenses", "lowStock"]),
  period: z.enum(["today", "month"]),
});

export type SaleDraft = z.infer<typeof saleDraftSchema>;
export type PurchaseDraft = z.infer<typeof purchaseDraftSchema>;
export type ExpenseDraft = z.infer<typeof expenseDraftSchema>;
export type StockLossDraft = z.infer<typeof stockLossDraftSchema>;
export type CancellationDraft = z.infer<typeof cancellationDraftSchema>;
export type ProductDraft = z.infer<typeof productDraftSchema>;
export type AssistantDraft = z.infer<typeof assistantDraftSchema>;
