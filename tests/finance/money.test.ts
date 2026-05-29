import { describe, expect, it } from "vitest";
import {
  calculateLineTotalCents,
  formatCentsToBRL,
  validateNonNegativeMoneyCents,
  validateQuantity,
} from "@/lib/finance";

describe("finance money rules", () => {
  it("keeps money as integer cents and calculates line totals without floats", () => {
    expect(calculateLineTotalCents({ quantity: 3, unitAmountCents: 700 })).toBe(2100);
    expect(calculateLineTotalCents({ quantity: 1.5, unitAmountCents: 400 })).toBe(600);
  });

  it("formats cents as Brazilian currency only for presentation boundaries", () => {
    expect(formatCentsToBRL(2100)).toBe("R$ 21,00");
  });

  it("rejects invalid money values", () => {
    expect(() => validateNonNegativeMoneyCents(-1, "preco")).toThrow(/preco/i);
    expect(() => validateNonNegativeMoneyCents(10.5, "preco")).toThrow(/centavos inteiros/i);
    expect(() => validateNonNegativeMoneyCents(Number.NaN, "preco")).toThrow(/preco/i);
    expect(() => validateNonNegativeMoneyCents(Number.POSITIVE_INFINITY, "preco")).toThrow(/preco/i);
  });

  it("rejects invalid quantities and invisible rounding", () => {
    expect(() => validateQuantity(-1, "quantidade")).toThrow(/quantidade/i);
    expect(() => validateQuantity(Number.NaN, "quantidade")).toThrow(/quantidade/i);
    expect(() => validateQuantity(Number.POSITIVE_INFINITY, "quantidade")).toThrow(/quantidade/i);
    expect(() => calculateLineTotalCents({ quantity: 0.5, unitAmountCents: 333 })).toThrow(
      /centavos inteiros/i,
    );
  });
});
