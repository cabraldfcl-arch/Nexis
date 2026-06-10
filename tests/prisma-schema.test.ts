import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const postgresqlSchema = readFileSync("prisma/postgresql/schema.prisma", "utf8");

describe("Prisma schema", () => {
  it("defines the minimum MVP data models", () => {
    for (const model of [
      "Product",
      "ProductAlias",
      "Purchase",
      "Sale",
      "SaleItem",
      "Expense",
      "StockLoss",
      "CancellationEvent",
      "StockMovement",
    ]) {
      expect(schema).toContain(`model ${model}`);
    }
  });

  it("stores money as integer cents and sale items keep historical snapshots", () => {
    expect(schema).toContain("unitCostCents");
    expect(schema).toContain("salePriceCents");
    expect(schema).toContain("unitPriceCents");
    expect(schema).toContain("unitCostSnapshotCents");
    expect(schema).toContain("totalAmountCents");
    expect(schema).toContain("totalCostCents");
    expect(schema).not.toMatch(/\b(Float|Double)\b/);
  });

  it("relates purchases and sale items to stock movements", () => {
    expect(schema).toContain("enum StockMovementType");
    expect(schema).toContain("PURCHASE");
    expect(schema).toContain("SALE");
    expect(schema).toContain("ADJUSTMENT");
    expect(schema).toContain("LOSS");
    expect(schema).toContain("REVERSAL");
    expect(schema).toContain("purchaseId");
    expect(schema).toContain("saleItemId");
    expect(schema).toContain("stockLossId");
    expect(schema).toContain("cancellationEventId");
  });

  it("keeps assistant product identity and entry origin auditable", () => {
    expect(schema).toContain("enum EntryOrigin");
    expect(schema).toContain("enum ProductAliasSource");
    expect(schema).toContain("normalizedName String");
    expect(schema).toContain("normalizedAlias String");
    expect(schema).toContain("origin");
  });

  it("keeps the Vercel PostgreSQL schema aligned with the local SQLite schema", () => {
    expect(schema).toContain('provider = "sqlite"');
    expect(postgresqlSchema).toContain('provider = "postgresql"');

    for (const model of schema.matchAll(/^model (\w+)/gm)) {
      expect(postgresqlSchema).toContain(`model ${model[1]}`);
    }

    for (const enumName of schema.matchAll(/^enum (\w+)/gm)) {
      expect(postgresqlSchema).toContain(`enum ${enumName[1]}`);
    }
  });
});
