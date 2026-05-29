import { describe, expect, it } from "vitest";
import {
  applyStockMovements,
  calculateStockAfterPurchase,
  calculateStockAfterSale,
  countLowStockProducts,
  hasLowStock,
} from "@/lib/finance";

describe("finance stock rules", () => {
  it("increases stock after a purchase", () => {
    expect(calculateStockAfterPurchase({ currentStock: 10, quantityPurchased: 5 })).toBe(15);
  });

  it("reduces stock after a sale", () => {
    expect(calculateStockAfterSale({ currentStock: 15, quantitySold: 3 })).toBe(12);
  });

  it("applies only confirmed stock adjustments", () => {
    expect(
      applyStockMovements({
        initialStock: 10,
        movements: [
          { type: "purchase", quantity: 5, confirmed: true },
          { type: "sale", quantity: 3, confirmed: true },
          { type: "adjustment", quantity: 2, direction: "increase", confirmed: false },
          { type: "adjustment", quantity: 1, direction: "decrease", confirmed: true },
        ],
      }),
    ).toBe(11);
  });

  it("alerts only when stock is below the minimum", () => {
    expect(hasLowStock({ currentStock: 4, minimumStock: 10 })).toBe(true);
    expect(hasLowStock({ currentStock: 10, minimumStock: 10 })).toBe(false);
  });

  it("counts low-stock products", () => {
    expect(
      countLowStockProducts([
        { currentStock: 4, minimumStock: 10 },
        { currentStock: 10, minimumStock: 10 },
        { currentStock: 0, minimumStock: 1 },
      ]),
    ).toBe(2);
  });

  it("rejects invalid stock inputs with understandable errors", () => {
    expect(() => calculateStockAfterPurchase({ currentStock: 10, quantityPurchased: -1 })).toThrow(
      /quantidade comprada/i,
    );
    expect(() => calculateStockAfterSale({ currentStock: 2, quantitySold: 3 })).toThrow(
      /estoque insuficiente/i,
    );
    expect(() => hasLowStock({ currentStock: Number.NaN, minimumStock: 10 })).toThrow(/estoque/i);
  });
});
