import { describe, expect, it } from "vitest";
import {
  buildPurchaseTransaction,
  buildSaleTransaction,
  normalizeExpenseForPersistence,
} from "@/lib/finance/transactions";

describe("deterministic transaction rules", () => {
  it("purchase increases stock and calculates total cost", () => {
    expect(
      buildPurchaseTransaction({
        currentStock: 10,
        quantity: 5,
        unitCostCents: 400,
      }),
    ).toEqual({
      nextStock: 15,
      totalCostCents: 2000,
      movementQuantity: 5,
    });
  });

  it("sale reduces stock and uses cost snapshot", () => {
    expect(
      buildSaleTransaction({
        product: {
          id: "product_1",
          active: true,
          currentStock: 15,
          unitCostCents: 400,
          salePriceCents: 700,
        },
        quantity: 3,
        unitPriceCents: null,
      }),
    ).toEqual({
      nextStock: 12,
      item: {
        productId: "product_1",
        quantity: 3,
        unitPriceCents: 700,
        unitCostSnapshotCents: 400,
        totalAmountCents: 2100,
        totalCostCents: 1200,
      },
      movementQuantity: 3,
    });
  });

  it("sale uses informed unit price when provided", () => {
    const product = {
      id: "product_1",
      active: true,
      currentStock: 5,
      unitCostCents: 300,
      salePriceCents: 700,
    };

    expect(
      buildSaleTransaction({
        product,
        quantity: 2,
        unitPriceCents: 250,
      }),
    ).toMatchObject({
      item: {
        productId: "product_1",
        quantity: 2,
        unitPriceCents: 250,
        unitCostSnapshotCents: 300,
        totalAmountCents: 500,
        totalCostCents: 600,
      },
      nextStock: 3,
    });
    expect(product.salePriceCents).toBe(700);
  });

  it("sale blocks inactive product and negative stock", () => {
    expect(() =>
      buildSaleTransaction({
        product: {
          id: "product_1",
          active: false,
          currentStock: 15,
          unitCostCents: 400,
          salePriceCents: 700,
        },
        quantity: 3,
        unitPriceCents: null,
      }),
    ).toThrow(/inativo/i);

    expect(() =>
      buildSaleTransaction({
        product: {
          id: "product_1",
          active: true,
          currentStock: 2,
          unitCostCents: 400,
          salePriceCents: 700,
        },
        quantity: 3,
        unitPriceCents: null,
      }),
    ).toThrow(/estoque insuficiente/i);
  });

  it("normalizes confirmed and unconfirmed expenses for persistence", () => {
    expect(normalizeExpenseForPersistence({ amountCents: 500, confirmed: true })).toEqual({
      amountCents: 500,
      confirmed: true,
    });
    expect(normalizeExpenseForPersistence({ amountCents: 500, confirmed: false })).toEqual({
      amountCents: 500,
      confirmed: false,
    });
  });
});
