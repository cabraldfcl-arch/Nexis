import { describe, expect, it } from "vitest";
import {
  calculateConfirmedExpensesCents,
  calculateGrossProfitCents,
  calculateNetProfitCents,
} from "@/lib/finance";

describe("finance profit rules", () => {
  it("calculates gross profit from revenue and cost of goods sold", () => {
    expect(
      calculateGrossProfitCents({
        revenueCents: 2100,
        costOfGoodsSoldCents: 1200,
      }),
    ).toBe(900);
  });

  it("calculates net profit with only confirmed expenses", () => {
    const confirmedExpensesCents = calculateConfirmedExpensesCents([
      { amountCents: 500, confirmed: true },
      { amountCents: 9999, confirmed: false },
    ]);

    expect(confirmedExpensesCents).toBe(500);
    expect(
      calculateNetProfitCents({
        grossProfitCents: 900,
        confirmedExpensesCents,
      }),
    ).toBe(400);
  });

  it("rejects invalid expense and profit inputs", () => {
    expect(() => calculateConfirmedExpensesCents([{ amountCents: -500, confirmed: true }])).toThrow(
      /despesa/i,
    );
    expect(() =>
      calculateGrossProfitCents({
        revenueCents: Number.POSITIVE_INFINITY,
        costOfGoodsSoldCents: 1200,
      }),
    ).toThrow(/faturamento/i);
  });
});
