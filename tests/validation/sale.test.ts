import { describe, expect, it } from "vitest";
import { validateSaleInput } from "@/lib/validation/sale";

const validSale = {
  productId: "product_1",
  quantity: "3",
  unitPrice: "7",
};

describe("sale validation", () => {
  it("accepts a valid sale and calculates total amount", () => {
    expect(validateSaleInput(validSale)).toEqual({
      productId: "product_1",
      quantity: 3,
      unitPriceCents: 700,
      totalAmountCents: 2100,
    });
  });

  it("allows empty price so the product current sale price can be used", () => {
    expect(validateSaleInput({ ...validSale, unitPrice: "" })).toEqual({
      productId: "product_1",
      quantity: 3,
      unitPriceCents: null,
      totalAmountCents: null,
    });
  });

  it("rejects empty product id", () => {
    expect(() => validateSaleInput({ ...validSale, productId: "" })).toThrow(/produto/i);
  });

  it("rejects zero or negative quantity", () => {
    expect(() => validateSaleInput({ ...validSale, quantity: "0" })).toThrow(/quantidade vendida/i);
    expect(() => validateSaleInput({ ...validSale, quantity: "-1" })).toThrow(/quantidade vendida/i);
  });

  it("rejects negative price", () => {
    expect(() => validateSaleInput({ ...validSale, unitPrice: "-1" })).toThrow(/preco/i);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => validateSaleInput({ ...validSale, quantity: Number.NaN })).toThrow(/quantidade vendida/i);
    expect(() => validateSaleInput({ ...validSale, unitPrice: Number.POSITIVE_INFINITY })).toThrow(/preco/i);
  });

  it("rejects totals that would create fractional cents", () => {
    expect(() => validateSaleInput({ ...validSale, quantity: "0,5", unitPrice: "3,33" })).toThrow(
      /centavos inteiros/i,
    );
  });
});
