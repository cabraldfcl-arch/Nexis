import { describe, expect, it } from "vitest";
import { createProductRecord, normalizeProductNameForDuplicate } from "@/lib/products/create-product";

describe("createProductRecord", () => {
  it("stores normalized identity, confirmed alias and origin with the product", async () => {
    const operations: Array<{ data: Record<string, unknown>; type: string }> = [];
    const client = {
      product: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          operations.push({ data, type: "product.create" });

          return { id: "product-1", ...data };
        },
        findFirst: async () => null,
        findMany: async () => [],
      },
      productAlias: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          operations.push({ data, type: "productAlias.create" });

          return { id: "alias-1", ...data };
        },
      },
      purchase: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          operations.push({ data, type: "purchase.create" });

          return { id: "purchase-1", ...data };
        },
      },
      stockMovement: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          operations.push({ data, type: "stockMovement.create" });

          return { id: "movement-1", ...data };
        },
      },
    };

    await createProductRecord(
      client as never,
      {
        category: null,
        initialStock: 12,
        minimumStock: 2,
        name: "Coca lata 350 ml",
        salePriceCents: 600,
        unit: "UNIT",
        unitCostCents: 308,
      },
      { aliasSource: "AI_CONFIRMED", origin: "ASSISTANT_TEXT" },
    );

    expect(operations).toContainEqual({
      type: "product.create",
      data: expect.objectContaining({
        normalizedName: "coca lata 350 ml",
        origin: "ASSISTANT_TEXT",
      }),
    });
    expect(operations).toContainEqual({
      type: "productAlias.create",
      data: expect.objectContaining({
        alias: "Coca lata 350 ml",
        normalizedAlias: "coca lata 350 ml",
        productId: "product-1",
        source: "AI_CONFIRMED",
      }),
    });
    expect(operations).toContainEqual({
      type: "stockMovement.create",
      data: expect.objectContaining({
        origin: "ASSISTANT_TEXT",
        reason: "INITIAL_STOCK",
      }),
    });
  });

  it("can store initial stock from an assistant purchase as a real purchase", async () => {
    const operations: Array<{ data: Record<string, unknown>; type: string }> = [];
    const client = {
      product: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          operations.push({ data, type: "product.create" });

          return { id: "product-1", ...data };
        },
        findFirst: async () => null,
        findMany: async () => [],
      },
      productAlias: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          operations.push({ data, type: "productAlias.create" });

          return { id: "alias-1", ...data };
        },
      },
      purchase: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          operations.push({ data, type: "purchase.create" });

          return { id: "purchase-1", ...data };
        },
      },
      stockMovement: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          operations.push({ data, type: "stockMovement.create" });

          return { id: "movement-1", ...data };
        },
      },
    };

    await createProductRecord(
      client as never,
      {
        category: null,
        initialStock: 12,
        minimumStock: 2,
        name: "Agua mineral 500 ml",
        salePriceCents: 250,
        unit: "UNIT",
        unitCostCents: 150,
      },
      { aliasSource: "AI_CONFIRMED", initialStockSource: "purchase", origin: "ASSISTANT_TEXT" },
    );

    expect(operations).toContainEqual({
      type: "purchase.create",
      data: expect.objectContaining({
        origin: "ASSISTANT_TEXT",
        productId: "product-1",
        quantity: "12",
        totalCostCents: 1800,
        unitCostCents: 150,
      }),
    });
    expect(operations).toContainEqual({
      type: "stockMovement.create",
      data: expect.objectContaining({
        origin: "ASSISTANT_TEXT",
        purchaseId: "purchase-1",
        quantity: "12",
        reason: "INITIAL_PURCHASE",
        type: "PURCHASE",
      }),
    });
    expect(operations).not.toContainEqual({
      type: "stockMovement.create",
      data: expect.objectContaining({
        reason: "INITIAL_STOCK",
        type: "ADJUSTMENT",
      }),
    });
  });
});

describe("normalizeProductNameForDuplicate", () => {
  it("normalizes spelling, accents and punctuation into a stable key", () => {
    expect(normalizeProductNameForDuplicate("  Coca-Cola Lata 350 ml!!! ")).toBe("coca cola lata 350 ml");
    expect(normalizeProductNameForDuplicate("Água 500ml")).toBe("agua 500ml");
  });
});
