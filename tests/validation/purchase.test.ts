import { describe, expect, it } from "vitest";
import { validatePurchaseInput } from "@/lib/validation/purchase";

const validPurchase = {
  productId: "product_1",
  quantity: "2,5",
  unitCost: "4",
  supplier: "Fornecedor teste",
};

describe("purchase validation", () => {
  it("accepts a valid purchase and calculates total cost", () => {
    expect(validatePurchaseInput(validPurchase)).toEqual({
      productId: "product_1",
      quantity: 2.5,
      unitCostCents: 400,
      totalCostCents: 1000,
      supplier: "Fornecedor teste",
    });
  });

  it("converts packaged purchases into unit quantity and unit cost", () => {
    expect(
      validatePurchaseInput({
        productId: "product_1",
        quantity: "",
        unitCost: "",
        supplier: "",
        packageQuantity: "2",
        unitsPerPackage: "12",
        packageCost: "18,00",
      }),
    ).toEqual({
      productId: "product_1",
      quantity: 24,
      unitCostCents: 150,
      totalCostCents: 3600,
      supplier: null,
    });
  });

  it("treats empty supplier as null", () => {
    expect(validatePurchaseInput({ ...validPurchase, supplier: "   " }).supplier).toBeNull();
  });

  it("rejects empty product id", () => {
    expect(() => validatePurchaseInput({ ...validPurchase, productId: " " })).toThrow(/produto/i);
  });

  it("rejects zero or negative quantity", () => {
    expect(() => validatePurchaseInput({ ...validPurchase, quantity: "0" })).toThrow(/quantidade comprada/i);
    expect(() => validatePurchaseInput({ ...validPurchase, quantity: "-1" })).toThrow(/quantidade comprada/i);
  });

  it("rejects negative cost", () => {
    expect(() => validatePurchaseInput({ ...validPurchase, unitCost: "-1" })).toThrow(/custo/i);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => validatePurchaseInput({ ...validPurchase, quantity: Number.NaN })).toThrow(/quantidade comprada/i);
    expect(() => validatePurchaseInput({ ...validPurchase, unitCost: Number.POSITIVE_INFINITY })).toThrow(/custo/i);
  });

  it("rejects totals that would create fractional cents", () => {
    expect(() => validatePurchaseInput({ ...validPurchase, quantity: "0,5", unitCost: "3,33" })).toThrow(
      /centavos inteiros/i,
    );
  });
});
