import { describe, expect, it } from "vitest";
import { getDashboardPeriods } from "@/lib/dashboard/periods";
import { buildDashboardSummary } from "@/lib/dashboard/summary";

const now = new Date(2026, 4, 22, 15, 30, 0, 0);

describe("dashboard periods", () => {
  it("builds local today and current-month periods until now", () => {
    expect(getDashboardPeriods(now)).toEqual({
      today: {
        start: new Date(2026, 4, 22, 0, 0, 0, 0),
        end: now,
      },
      month: {
        start: new Date(2026, 4, 1, 0, 0, 0, 0),
        end: now,
      },
    });
  });
});

describe("dashboard summary", () => {
  it("returns zeros when the period has no sales, expenses or low stock products", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [],
      expenses: [],
      products: [],
    });

    expect(summary.today).toMatchObject({
      salesCount: 0,
      revenueCents: 0,
      costOfGoodsSoldCents: 0,
      grossProfitCents: 0,
      confirmedExpensesCents: 0,
      netProfitCents: 0,
      lowStockCount: 0,
    });
    expect(summary.month).toMatchObject({
      salesCount: 0,
      revenueCents: 0,
      costOfGoodsSoldCents: 0,
      grossProfitCents: 0,
      confirmedExpensesCents: 0,
      netProfitCents: 0,
      lowStockCount: 0,
    });
    expect(summary.lowStockProducts).toEqual([]);
  });

  it("uses Sale totals, SaleItem costs and confirmed expenses for deterministic profit", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [
        {
          id: "sale_today",
          soldAt: new Date(2026, 4, 22, 10, 0, 0, 0),
          totalAmountCents: 2100,
          items: [
            {
              quantity: 3,
              unitPriceCents: 700,
              unitCostSnapshotCents: 400,
              totalAmountCents: 2100,
              totalCostCents: 1200,
            },
          ],
        },
      ],
      expenses: [
        {
          id: "expense_confirmed",
          paidAt: new Date(2026, 4, 22, 11, 0, 0, 0),
          amountCents: 500,
          confirmed: true,
        },
        {
          id: "expense_pending",
          paidAt: new Date(2026, 4, 22, 12, 0, 0, 0),
          amountCents: 9999,
          confirmed: false,
        },
      ],
      products: [],
    });

    expect(summary.today).toMatchObject({
      salesCount: 1,
      revenueCents: 2100,
      costOfGoodsSoldCents: 1200,
      grossProfitCents: 900,
      confirmedExpensesCents: 500,
      netProfitCents: 400,
    });
  });

  it("counts only active products below minimum stock and keeps at most five products", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [],
      expenses: [],
      products: [
        { id: "active_low_1", name: "Agua", currentStock: 2, minimumStock: 5, active: true },
        { id: "inactive_low", name: "Inativo", currentStock: 1, minimumStock: 5, active: false },
        { id: "equal_minimum", name: "Igual", currentStock: 5, minimumStock: 5, active: true },
        { id: "active_low_2", name: "Refrigerante", currentStock: 0, minimumStock: 2, active: true },
        { id: "active_low_3", name: "Bolo", currentStock: 1, minimumStock: 3, active: true },
        { id: "active_low_4", name: "Cafe", currentStock: 1, minimumStock: 4, active: true },
        { id: "active_low_5", name: "Acucar", currentStock: 1, minimumStock: 6, active: true },
        { id: "active_low_6", name: "Leite", currentStock: 1, minimumStock: 7, active: true },
      ],
    });

    expect(summary.month.lowStockCount).toBe(6);
    expect(summary.lowStockProducts).toEqual([
      { id: "active_low_1", name: "Agua", currentStock: 2, minimumStock: 5 },
      { id: "active_low_2", name: "Refrigerante", currentStock: 0, minimumStock: 2 },
      { id: "active_low_3", name: "Bolo", currentStock: 1, minimumStock: 3 },
      { id: "active_low_4", name: "Cafe", currentStock: 1, minimumStock: 4 },
      { id: "active_low_5", name: "Acucar", currentStock: 1, minimumStock: 6 },
    ]);
  });

  it("filters sales and expenses by today and current month", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [
        {
          id: "previous_month",
          soldAt: new Date(2026, 3, 30, 23, 59, 59, 999),
          totalAmountCents: 5000,
          items: [
            {
              quantity: 1,
              unitPriceCents: 5000,
              unitCostSnapshotCents: 1000,
              totalAmountCents: 5000,
              totalCostCents: 1000,
            },
          ],
        },
        {
          id: "same_month_previous_day",
          soldAt: new Date(2026, 4, 10, 8, 0, 0, 0),
          totalAmountCents: 1500,
          items: [
            {
              quantity: 1,
              unitPriceCents: 1500,
              unitCostSnapshotCents: 600,
              totalAmountCents: 1500,
              totalCostCents: 600,
            },
          ],
        },
        {
          id: "today",
          soldAt: new Date(2026, 4, 22, 9, 0, 0, 0),
          totalAmountCents: 900,
          items: [
            {
              quantity: 1,
              unitPriceCents: 900,
              unitCostSnapshotCents: 300,
              totalAmountCents: 900,
              totalCostCents: 300,
            },
          ],
        },
      ],
      expenses: [
        {
          id: "previous_month_expense",
          paidAt: new Date(2026, 3, 30, 23, 59, 59, 999),
          amountCents: 800,
          confirmed: true,
        },
        {
          id: "month_expense",
          paidAt: new Date(2026, 4, 10, 10, 0, 0, 0),
          amountCents: 400,
          confirmed: true,
        },
        {
          id: "today_expense",
          paidAt: new Date(2026, 4, 22, 14, 0, 0, 0),
          amountCents: 100,
          confirmed: true,
        },
      ],
      products: [],
    });

    expect(summary.today).toMatchObject({
      salesCount: 1,
      revenueCents: 900,
      costOfGoodsSoldCents: 300,
      grossProfitCents: 600,
      confirmedExpensesCents: 100,
      netProfitCents: 500,
    });
    expect(summary.month).toMatchObject({
      salesCount: 2,
      revenueCents: 2400,
      costOfGoodsSoldCents: 900,
      grossProfitCents: 1500,
      confirmedExpensesCents: 500,
      netProfitCents: 1000,
    });
  });
});
