import { describe, expect, it } from "vitest";
import {
  assistantDraftSchema,
  assistantQuestionSchema,
  cancellationDraftSchema,
  expenseDraftSchema,
  productDraftSchema,
  purchaseDraftSchema,
  saleDraftSchema,
  stockLossDraftSchema,
} from "@/lib/validation/assistant-draft";

describe("assistant sale draft validation", () => {
  it("accepts a valid sale draft", () => {
    expect(
      saleDraftSchema.parse({
        type: "sale",
        productId: "product_1",
        productName: "Refrigerante",
        quantity: 3,
        registeredSalePriceCents: 700,
        unitPriceCents: 700,
        unitCostSnapshotCents: 400,
        totalAmountCents: 2100,
        totalCostCents: 1200,
        estimatedGrossProfitCents: 900,
        stockBefore: 10,
        stockAfter: 7,
        stockImpact: -3,
      }),
    ).toMatchObject({ type: "sale", totalAmountCents: 2100 });
  });

  it("requires price, cost, profit and stock evidence for sale confirmation", () => {
    const parsed = saleDraftSchema.safeParse({
      type: "sale",
      productId: "product_1",
      productName: "Água mineral",
      quantity: 2,
      unitPriceCents: 300,
      totalAmountCents: 600,
      stockImpact: -2,
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a complete sale confirmation summary with changed price and estimated profit", () => {
    const parsed = saleDraftSchema.safeParse({
      type: "sale",
      productId: "product_1",
      productName: "Água mineral",
      quantity: 2,
      registeredSalePriceCents: 300,
      unitPriceCents: 250,
      unitCostSnapshotCents: 100,
      totalAmountCents: 500,
      totalCostCents: 200,
      estimatedGrossProfitCents: 300,
      stockBefore: 3,
      stockAfter: 1,
      stockImpact: -2,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects sale draft with negative quantity", () => {
    expect(() =>
      saleDraftSchema.parse({
        type: "sale",
        productId: "product_1",
        productName: "Refrigerante",
        quantity: -1,
        registeredSalePriceCents: 700,
        unitPriceCents: 700,
        unitCostSnapshotCents: 400,
        totalAmountCents: 700,
        totalCostCents: 400,
        estimatedGrossProfitCents: 300,
        stockBefore: 10,
        stockAfter: 9,
        stockImpact: -1,
      }),
    ).toThrow();
  });

  it("rejects sale draft with zero unit price", () => {
    expect(() =>
      saleDraftSchema.parse({
        type: "sale",
        productId: "product_1",
        productName: "Refrigerante",
        quantity: 1,
        registeredSalePriceCents: 700,
        unitPriceCents: 0,
        unitCostSnapshotCents: 400,
        totalAmountCents: 0,
        totalCostCents: 400,
        estimatedGrossProfitCents: -400,
        stockBefore: 10,
        stockAfter: 9,
        stockImpact: -1,
      }),
    ).toThrow();
  });
});

describe("assistant purchase, expense and question validation", () => {
  it("rejects purchase draft with negative cost", () => {
    expect(() =>
      purchaseDraftSchema.parse({
        type: "purchase",
        productId: "product_1",
        productName: "Refrigerante",
        quantity: 10,
        unitCostCents: -400,
        totalCostCents: 4000,
        stockImpact: 10,
      }),
    ).toThrow();
  });

  it("rejects purchase draft with zero unit cost", () => {
    expect(() =>
      purchaseDraftSchema.parse({
        type: "purchase",
        productId: "product_1",
        productName: "Refrigerante",
        quantity: 10,
        unitCostCents: 0,
        totalCostCents: 0,
        stockImpact: 10,
      }),
    ).toThrow();
  });

  it("rejects expense draft with zero amount", () => {
    expect(() =>
      expenseDraftSchema.parse({
        type: "expense",
        description: "energia",
        category: "UTILITIES",
        amountCents: 0,
        confirmed: false,
        paidAt: "2026-05-22T12:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects question with invalid intent", () => {
    expect(() => assistantQuestionSchema.parse({ type: "question", intent: "cash", period: "today" })).toThrow();
  });

  it("accepts the assistant draft union for purchase", () => {
    expect(
      assistantDraftSchema.parse({
        type: "purchase",
        productId: "product_1",
        productName: "Refrigerante",
        quantity: 2,
        unitCostCents: 400,
        totalCostCents: 800,
        stockImpact: 2,
      }),
    ).toMatchObject({ type: "purchase" });
  });

  it("accepts stock loss and cancellation drafts through the assistant draft union", () => {
    expect(
      stockLossDraftSchema.parse({
        type: "stock_loss",
        productId: "product_1",
        productName: "Água mineral 500 ml",
        quantity: 3,
        reason: "estouraram no freezer",
        unitCostSnapshotCents: 150,
        totalCostCents: 450,
        stockBefore: 31,
        stockAfter: 28,
        stockImpact: -3,
      }),
    ).toMatchObject({ stockAfter: 28, type: "stock_loss" });

    expect(
      cancellationDraftSchema.parse({
        type: "cancellation",
        targetType: "sale",
        targetId: "sale_1",
        targetLabel: "Venda de Água mineral 500 ml",
        reason: "solicitado pelo usuário",
        stockImpact: 5,
        amountImpactCents: -1250,
      }),
    ).toMatchObject({ targetType: "sale", type: "cancellation" });

    expect(
      assistantDraftSchema.parse({
        type: "stock_loss",
        productId: "product_1",
        productName: "Água mineral 500 ml",
        quantity: 1,
        reason: "quebrou",
        unitCostSnapshotCents: 150,
        totalCostCents: 150,
        stockBefore: 10,
        stockAfter: 9,
        stockImpact: -1,
      }),
    ).toMatchObject({ type: "stock_loss" });
  });
});

describe("assistant product draft validation", () => {
  it("accepts a valid product draft", () => {
    expect(
      productDraftSchema.parse({
        type: "product",
        name: "Coca lata",
        category: null,
        unit: "UNIT",
        unitCostCents: 300,
        salePriceCents: 600,
        initialStock: 20,
        minimumStock: 5,
      }),
    ).toMatchObject({ type: "product", name: "Coca lata" });
  });

  it("accepts product draft through the assistant draft union", () => {
    expect(
      assistantDraftSchema.parse({
        type: "product",
        name: "Queijo",
        category: "Laticinios",
        unit: "KG",
        unitCostCents: 2000,
        salePriceCents: 3500,
        initialStock: 10,
        minimumStock: 2,
      }),
    ).toMatchObject({ type: "product", unit: "KG" });
  });

  it("rejects invalid product draft values", () => {
    const validDraft = {
      type: "product",
      name: "Produto teste",
      category: null,
      unit: "UNIT",
      unitCostCents: 100,
      salePriceCents: 300,
      initialStock: 5,
      minimumStock: 1,
    } as const;

    expect(() => productDraftSchema.parse({ ...validDraft, name: "" })).toThrow();
    expect(() => productDraftSchema.parse({ ...validDraft, unitCostCents: -1 })).toThrow();
    expect(() => productDraftSchema.parse({ ...validDraft, salePriceCents: -1 })).toThrow();
    expect(() => productDraftSchema.parse({ ...validDraft, initialStock: -1 })).toThrow();
    expect(() => productDraftSchema.parse({ ...validDraft, minimumStock: -1 })).toThrow();
  });
});
