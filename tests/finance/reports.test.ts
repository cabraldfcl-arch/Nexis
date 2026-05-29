import { describe, expect, it } from "vitest";
import * as financeReports from "@/lib/finance/reports";
import { generateFinancialSummary } from "@/lib/finance";

const summarizeInventory = (
  financeReports as {
    summarizeInventory?: (products: unknown) => unknown;
  }
).summarizeInventory;
const summarizePurchases = (
  financeReports as {
    summarizePurchases?: (input: unknown) => unknown;
  }
).summarizePurchases;
const summarizeTopProducts = (
  financeReports as {
    summarizeTopProducts?: (input: unknown) => unknown;
  }
).summarizeTopProducts;

const period = {
  start: new Date("2026-05-01T00:00:00.000Z"),
  end: new Date("2026-05-31T23:59:59.999Z"),
};

describe("finance report summaries", () => {
  it("generates a deterministic period summary from in-memory data", () => {
    const summary = generateFinancialSummary({
      period,
      sales: [
        {
          confirmed: true,
          occurredAt: new Date("2026-05-10T12:00:00.000Z"),
          items: [
            {
              quantity: 3,
              unitPriceCents: 700,
              unitCostSnapshotCents: 400,
              totalAmountCents: 2100,
              totalCostCents: 1200,
            },
          ],
          totalAmountCents: 2100,
        },
      ],
      expenses: [
        { amountCents: 500, confirmed: true, occurredAt: new Date("2026-05-11T12:00:00.000Z") },
        { amountCents: 9999, confirmed: false, occurredAt: new Date("2026-05-12T12:00:00.000Z") },
      ],
      stockItems: [
        { currentStock: 4, minimumStock: 10 },
        { currentStock: 10, minimumStock: 10 },
      ],
    });

    expect(summary).toEqual({
      revenueCents: 2100,
      costOfGoodsSoldCents: 1200,
      grossProfitCents: 900,
      confirmedExpensesCents: 500,
      pendingExpensesCents: 9999,
      netProfitCents: 400,
      lowStockCount: 1,
    });
  });

  it("filters sales and expenses outside the requested period", () => {
    const summary = generateFinancialSummary({
      period,
      sales: [
        {
          confirmed: true,
          occurredAt: new Date("2026-04-30T23:59:59.999Z"),
          items: [{ quantity: 3, unitPriceCents: 700, unitCostSnapshotCents: 400 }],
        },
      ],
      expenses: [
        { amountCents: 500, confirmed: true, occurredAt: new Date("2026-06-01T00:00:00.000Z") },
      ],
      stockItems: [],
    });

    expect(summary).toEqual({
      revenueCents: 0,
      costOfGoodsSoldCents: 0,
      grossProfitCents: 0,
      confirmedExpensesCents: 0,
      pendingExpensesCents: 0,
      netProfitCents: 0,
      lowStockCount: 0,
    });
  });

  it("rejects invalid report periods", () => {
    expect(() =>
      generateFinancialSummary({
        period: {
          start: new Date("2026-06-01T00:00:00.000Z"),
          end: new Date("2026-05-01T00:00:00.000Z"),
        },
        sales: [],
        expenses: [],
        stockItems: [],
      }),
    ).toThrow(/periodo/i);
  });

  it("summarizes current inventory directly from product stock", () => {
    expect(
      summarizeInventory?.([
        { active: true, currentStock: 3, id: "agua", minimumStock: 10, name: "Água mineral" },
        { active: true, currentStock: 23, id: "refri", minimumStock: 12, name: "Refrigerante lata" },
        { active: false, currentStock: 0, id: "old", minimumStock: 10, name: "Produto inativo" },
      ]),
    ).toEqual({
      lowStockCount: 1,
      lowStockProducts: [{ currentStock: 3, id: "agua", minimumStock: 10, name: "Água mineral" }],
      products: [
        { currentStock: 3, id: "agua", minimumStock: 10, name: "Água mineral" },
        { currentStock: 23, id: "refri", minimumStock: 12, name: "Refrigerante lata" },
      ],
      totalActiveProducts: 2,
    });
  });

  it("summarizes purchases in a period from purchase records", () => {
    expect(
      summarizePurchases?.({
        period,
        purchases: [
          {
            productName: "Água mineral",
            purchasedAt: new Date("2026-05-10T12:00:00.000Z"),
            quantity: 25,
            totalCostCents: 2500,
            unitCostCents: 100,
          },
          {
            productName: "Refrigerante lata",
            purchasedAt: new Date("2026-05-11T12:00:00.000Z"),
            quantity: 30,
            totalCostCents: 10500,
            unitCostCents: 350,
          },
          {
            productName: "Compra antiga",
            purchasedAt: new Date("2026-04-30T12:00:00.000Z"),
            quantity: 1,
            totalCostCents: 9999,
            unitCostCents: 9999,
          },
        ],
      }),
    ).toMatchObject({
      count: 2,
      totalCostCents: 13000,
    });
  });

  it("summarizes top products in a period from sale items", () => {
    expect(
      summarizeTopProducts?.({
        period,
        saleItems: [
          {
            occurredAt: new Date("2026-05-10T12:00:00.000Z"),
            productId: "agua",
            productName: "Água mineral",
            quantity: 22,
            totalAmountCents: 6600,
            totalCostCents: 2200,
            unitCostSnapshotCents: 100,
            unitPriceCents: 300,
          },
          {
            occurredAt: new Date("2026-05-10T13:00:00.000Z"),
            productId: "refri",
            productName: "Refrigerante lata",
            quantity: 7,
            totalAmountCents: 4900,
            totalCostCents: 2450,
            unitCostSnapshotCents: 350,
            unitPriceCents: 700,
          },
          {
            occurredAt: new Date("2026-04-30T12:00:00.000Z"),
            productId: "old",
            productName: "Venda antiga",
            quantity: 100,
            unitCostSnapshotCents: 1,
            unitPriceCents: 1,
          },
        ],
      }),
    ).toMatchObject({
      items: [
        {
          grossProfitCents: 4400,
          productId: "agua",
          productName: "Água mineral",
          quantity: 22,
          revenueCents: 6600,
        },
        {
          grossProfitCents: 2450,
          productId: "refri",
          productName: "Refrigerante lata",
          quantity: 7,
          revenueCents: 4900,
        },
      ],
    });
  });
});
