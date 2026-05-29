import { describe, expect, it } from "vitest";
import {
  parseBrazilianMoneyToCents,
  productUnitValues,
  validateProductFormInput,
} from "@/lib/validation/product";

const validProduct = {
  name: "Agua mineral",
  category: "Bebidas",
  unit: "UNIT",
  unitCost: "2,50",
  salePrice: "10,99",
  initialStock: "12",
  minimumStock: "4",
};

describe("product validation", () => {
  it("accepts a valid product and normalizes data for Prisma", () => {
    expect(validateProductFormInput(validProduct)).toEqual({
      name: "Agua mineral",
      category: "Bebidas",
      unit: "UNIT",
      unitCostCents: 250,
      salePriceCents: 1099,
      initialStock: 12,
      minimumStock: 4,
    });
  });

  it("accepts decimal stock for products sold by weight", () => {
    expect(
      validateProductFormInput({
        ...validProduct,
        initialStock: "2",
        minimumStock: "0,5",
        name: "Maçã",
        unit: "KG",
      }),
    ).toMatchObject({
      initialStock: 2,
      minimumStock: 0.5,
      unit: "KG",
    });
  });

  it("accepts gram as an explicit product unit", () => {
    expect(
      validateProductFormInput({
        ...validProduct,
        initialStock: "500",
        minimumStock: "100",
        name: "Tempero",
        unit: "GRAM",
      }),
    ).toMatchObject({
      initialStock: 500,
      minimumStock: 100,
      unit: "GRAM",
    });
  });

  it("converts packaged stock into unit stock for manual product registration", () => {
    expect(
      validateProductFormInput({
        name: "Coca lata",
        category: "Bebidas",
        unit: "UNIT",
        unitCost: "",
        salePrice: "3,00",
        initialStock: "",
        minimumStock: "6",
        packageQuantity: "2",
        unitsPerPackage: "12",
        packageCost: "36,00",
      }),
    ).toEqual({
      name: "Coca lata",
      category: "Bebidas",
      unit: "UNIT",
      unitCostCents: 300,
      salePriceCents: 300,
      initialStock: 24,
      minimumStock: 6,
    });
  });

  it("rounds packaged unit cost to two decimal places for manual product registration", () => {
    expect(
      validateProductFormInput({
        name: "Coca lata 350 ml",
        category: "Bebidas",
        unit: "UNIT",
        unitCost: "",
        salePrice: "6,00",
        initialStock: "",
        minimumStock: "3",
        packageQuantity: "1",
        unitsPerPackage: "12",
        packageCost: "37,00",
      }),
    ).toMatchObject({
      unitCostCents: 308,
      initialStock: 12,
    });
  });

  it("treats empty optional category as null", () => {
    expect(validateProductFormInput({ ...validProduct, category: "   " }).category).toBeNull();
  });

  it("rejects empty or too short product names", () => {
    expect(() => validateProductFormInput({ ...validProduct, name: "" })).toThrow(/nome do produto/i);
    expect(() => validateProductFormInput({ ...validProduct, name: "A" })).toThrow(/nome do produto/i);
  });

  it("rejects negative product numbers", () => {
    expect(() => validateProductFormInput({ ...validProduct, unitCost: "-1" })).toThrow(/custo/i);
    expect(() => validateProductFormInput({ ...validProduct, salePrice: "-1" })).toThrow(/preco/i);
    expect(() => validateProductFormInput({ ...validProduct, initialStock: "-1" })).toThrow(/estoque inicial/i);
    expect(() => validateProductFormInput({ ...validProduct, minimumStock: "-1" })).toThrow(/estoque minimo/i);
  });

  it("rejects invalid product unit", () => {
    expect(productUnitValues).toEqual([
      "UNIT",
      "KG",
      "GRAM",
      "LITER",
      "METER",
      "SQUARE_METER",
      "CUBIC_METER",
      "BOX",
      "SACK",
      "BALE",
      "PACKAGE",
      "DOZEN",
    ]);
    expect(() => validateProductFormInput({ ...validProduct, unit: "PALLET" })).toThrow(/unidade/i);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => validateProductFormInput({ ...validProduct, unitCost: Number.NaN })).toThrow(/custo/i);
    expect(() => validateProductFormInput({ ...validProduct, salePrice: Number.POSITIVE_INFINITY })).toThrow(
      /preco/i,
    );
    expect(() => validateProductFormInput({ ...validProduct, initialStock: Number.NaN })).toThrow(
      /estoque inicial/i,
    );
    expect(() => validateProductFormInput({ ...validProduct, minimumStock: Number.POSITIVE_INFINITY })).toThrow(
      /estoque minimo/i,
    );
  });

  it("converts Brazilian money text to integer cents", () => {
    expect(parseBrazilianMoneyToCents("2,50", "Custo para voce")).toBe(250);
    expect(parseBrazilianMoneyToCents("10", "Preco de venda")).toBe(1000);
    expect(parseBrazilianMoneyToCents("10,99", "Preco de venda")).toBe(1099);
  });

  it("rejects money text that would require invisible rounding", () => {
    expect(() => parseBrazilianMoneyToCents("10,999", "Preco de venda")).toThrow(/centavos/i);
  });
});
