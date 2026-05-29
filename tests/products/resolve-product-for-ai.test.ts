import { describe, expect, it } from "vitest";
import { resolveProductForAi } from "@/lib/products/resolve-product-for-ai";

const products = [
  {
    active: true,
    aliases: [{ alias: "latinha coca" }, { alias: "coca 350" }],
    currentStock: 10,
    id: "coca-lata-350",
    name: "Coca Cola lata 350 ml",
    salePriceCents: 600,
    unit: "UNIT",
    unitCostCents: 308,
  },
  {
    active: true,
    aliases: [{ alias: "coca 600" }],
    currentStock: 4,
    id: "coca-600",
    name: "Coca Cola garrafa 600 ml",
    salePriceCents: 900,
    unit: "UNIT",
    unitCostCents: 520,
  },
];

describe("resolveProductForAi", () => {
  it("resolves a unique product using confirmed aliases", () => {
    expect(
      resolveProductForAi({
        operation: "sale",
        productName: "latinha coca",
        products,
      }),
    ).toMatchObject({
      productId: "coca-lata-350",
      status: "unique",
    });
  });

  it("keeps similar products ambiguous instead of choosing one by guess", () => {
    const result = resolveProductForAi({
      operation: "sale",
      productName: "coca",
      products,
    });

    expect(result).toMatchObject({
      reason: "multiple_product_matches",
      status: "ambiguous",
    });
    if (result.status !== "ambiguous") {
      throw new Error("Expected ambiguous product resolution.");
    }

    expect(result.candidates.map((candidate) => candidate.id)).toEqual(["coca-lata-350", "coca-600"]);
  });

  it("separates not-found sales from new product candidates", () => {
    expect(
      resolveProductForAi({
        operation: "sale",
        productName: "guaraná lata",
        products,
      }),
    ).toMatchObject({
      reason: "product_required_before_sale",
      status: "not_found",
    });

    expect(
      resolveProductForAi({
        operation: "purchase",
        productName: "guaraná lata",
        products,
      }),
    ).toMatchObject({
      reason: "can_create_after_confirmation",
      status: "new_product_candidate",
    });
  });
});
