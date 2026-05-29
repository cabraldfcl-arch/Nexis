import { describe, expect, it } from "vitest";
import {
  calculateDemoCurrentStocks,
  createDemoTimestamp,
  demoExpenses,
  demoProducts,
  demoPurchases,
  demoSales,
} from "../prisma/demo-seed-data.mjs";

describe("demo seed data", () => {
  it("keeps reset-demo populated with fictitious presentation data", () => {
    expect(demoProducts).toHaveLength(4);
    expect(demoPurchases).toHaveLength(4);
    expect(demoSales).toHaveLength(3);
    expect(demoExpenses).toHaveLength(4);
  });

  it("defines the expected fictitious demo products", () => {
    expect(demoProducts.map((product) => product.name)).toEqual([
      "Refrigerante lata",
      "Água mineral",
      "Bolo de pote",
      "Salgado assado",
    ]);
  });

  it("keeps product stock coherent with purchases and sales", () => {
    const stocks = calculateDemoCurrentStocks();

    for (const product of demoProducts) {
      expect(product.currentStock).toBe(String(stocks[product.key]));
    }
  });

  it("creates low-stock product, purchases and sales with item snapshots", () => {
    expect(demoProducts.some((product) => Number(product.currentStock) < Number(product.minimumStock))).toBe(true);
    expect(demoPurchases.length).toBeGreaterThanOrEqual(2);
    expect(demoSales.length).toBeGreaterThanOrEqual(3);

    for (const sale of demoSales) {
      expect(sale.items.length).toBeGreaterThan(0);

      for (const item of sale.items) {
        expect(item.unitPriceCents).toBeGreaterThan(0);
        expect(item.unitCostSnapshotCents).toBeGreaterThan(0);
        expect(item.totalAmountCents).toBe(item.quantity * item.unitPriceCents);
        expect(item.totalCostCents).toBe(item.quantity * item.unitCostSnapshotCents);
      }
    }
  });

  it("keeps pending expenses out of net profit inputs", () => {
    const confirmedExpensesTotal = demoExpenses
      .filter((expense) => expense.confirmed)
      .reduce((total, expense) => total + expense.amountCents, 0);
    const allExpensesTotal = demoExpenses.reduce((total, expense) => total + expense.amountCents, 0);

    expect(demoExpenses.filter((expense) => expense.confirmed)).toHaveLength(3);
    expect(demoExpenses.some((expense) => !expense.confirmed)).toBe(true);
    expect(confirmedExpensesTotal).toBeLessThan(allExpensesTotal);
  });

  it("keeps demo records inside today even just after midnight", () => {
    const now = new Date(2026, 4, 25, 0, 6, 0);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const oldestDemoRecord = createDemoTimestamp(now, 260);
    const recentDemoRecord = createDemoTimestamp(now, 35);

    expect(oldestDemoRecord.getTime()).toBeGreaterThanOrEqual(startOfToday.getTime());
    expect(oldestDemoRecord.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(recentDemoRecord.getTime()).toBeGreaterThanOrEqual(startOfToday.getTime());
    expect(recentDemoRecord.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(recentDemoRecord.getTime()).toBeGreaterThan(oldestDemoRecord.getTime());
  });
});
