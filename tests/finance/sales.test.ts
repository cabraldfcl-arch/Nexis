import { describe, expect, it } from "vitest";
import {
  calculateCostOfGoodsSoldCents,
  calculateRevenueCents,
  calculateSaleItemProfitMetrics,
  calculateSaleItemTotals,
  calculateSaleTotalCents,
  calculateProfitPercent,
} from "@/lib/finance";

describe("finance sales rules", () => {
  it("calculates revenue from one confirmed sale of R$ 21,00", () => {
    expect(
      calculateRevenueCents([
        {
          confirmed: true,
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
      ]),
    ).toBe(2100);
  });

  it("calculates revenue from multiple confirmed sales", () => {
    expect(
      calculateRevenueCents([
        {
          confirmed: true,
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
        {
          confirmed: true,
          items: [
            {
              quantity: 2,
              unitPriceCents: 750,
              unitCostSnapshotCents: 300,
              totalAmountCents: 1500,
              totalCostCents: 600,
            },
          ],
          totalAmountCents: 1500,
        },
      ]),
    ).toBe(3600);
  });

  it("ignores unconfirmed sales for revenue and cost", () => {
    const sales = [
      {
        confirmed: false,
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
    ];

    expect(calculateRevenueCents(sales)).toBe(0);
    expect(calculateCostOfGoodsSoldCents(sales)).toBe(0);
  });

  it("calculates cost of goods sold using the sale cost snapshot", () => {
    expect(
      calculateCostOfGoodsSoldCents([
        {
          confirmed: true,
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
      ]),
    ).toBe(1200);
  });

  it("keeps calculated sale totals consistent with quantity and snapshots", () => {
    expect(
      calculateSaleItemTotals({
        quantity: 3,
        unitPriceCents: 700,
        unitCostSnapshotCents: 400,
      }),
    ).toEqual({ revenueCents: 2100, costCents: 1200 });

    expect(
      calculateSaleTotalCents({
        confirmed: true,
        items: [
          { quantity: 3, unitPriceCents: 700, unitCostSnapshotCents: 400 },
          { quantity: 2, unitPriceCents: 750, unitCostSnapshotCents: 300 },
        ],
      }),
    ).toBe(3600);
  });

  it("calculates product profit, margin, markup and below-cost signal", () => {
    expect(
      calculateSaleItemProfitMetrics({
        quantity: 2,
        unitPriceCents: 800,
        unitCostSnapshotCents: 500,
      }),
    ).toEqual({
      belowCost: false,
      grossProfitCents: 600,
      marginPercent: 37.5,
      markupMultiplier: 1.6,
      unitProfitCents: 300,
    });

    expect(
      calculateSaleItemProfitMetrics({
        quantity: 1,
        unitPriceCents: 300,
        unitCostSnapshotCents: 500,
      }),
    ).toMatchObject({
      belowCost: true,
      grossProfitCents: -200,
      marginPercent: expect.closeTo(-66.666, 2),
      markupMultiplier: 0.6,
      unitProfitCents: -200,
    });
  });

  it("calculates general profit percentage from revenue", () => {
    expect(calculateProfitPercent({ profitCents: 2500, revenueCents: 10000 })).toBe(25);
    expect(calculateProfitPercent({ profitCents: -500, revenueCents: 10000 })).toBe(-5);
    expect(calculateProfitPercent({ profitCents: 0, revenueCents: 0 })).toBeNull();
  });

  it("rejects invalid sale inputs with understandable errors", () => {
    expect(() =>
      calculateSaleItemTotals({
        quantity: -3,
        unitPriceCents: 700,
        unitCostSnapshotCents: 400,
      }),
    ).toThrow(/quantidade/i);

    expect(() =>
      calculateSaleItemTotals({
        quantity: 3,
        unitPriceCents: 700,
        unitCostSnapshotCents: 400,
        totalAmountCents: 2000,
      }),
    ).toThrow(/total da venda/i);
  });
});
