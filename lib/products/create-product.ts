import { Prisma, ProductUnit, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { calculateLineTotalCents } from "@/lib/finance";
import type { ProductFormData } from "@/lib/validation/product";

export const duplicateProductNameMessage =
  "Já existe um produto parecido cadastrado. Revise antes de criar outro.";

export type CreateProductInput = ProductFormData;
export type EntryOriginValue = "ASSISTANT_AI" | "ASSISTANT_TEXT" | "IMPORT" | "MANUAL" | "VOICE_FUTURE";
export type ProductAliasSourceValue = "AI_CONFIRMED" | "IMPORT" | "MANUAL";

type CreateProductRecordOptions = {
  aliases?: string[];
  aliasSource?: ProductAliasSourceValue;
  initialStockSource?: "adjustment" | "purchase";
  origin?: EntryOriginValue;
};

type ProductPersistenceClient = Prisma.TransactionClient | typeof prisma;

export class DuplicateProductNameError extends Error {
  constructor() {
    super(duplicateProductNameMessage);
    this.name = "DuplicateProductNameError";
  }
}

export async function createProductRecord(
  client: ProductPersistenceClient,
  input: CreateProductInput,
  options: CreateProductRecordOptions = {},
) {
  await assertNoDuplicateProductName(client, input.name);

  const normalizedName = normalizeProductNameForDuplicate(input.name);
  const origin = options.origin ?? "MANUAL";
  const product = await client.product.create({
    data: {
      name: input.name,
      normalizedName,
      category: input.category,
      unit: input.unit as ProductUnit,
      unitCostCents: input.unitCostCents,
      salePriceCents: input.salePriceCents,
      currentStock: input.initialStock.toString(),
      minimumStock: input.minimumStock.toString(),
      origin,
    },
  });

  for (const aliasInput of buildProductAliasInputs(input.name, options.aliases, options.aliasSource ?? "MANUAL")) {
    await client.productAlias.create({
      data: {
        productId: product.id,
        ...aliasInput,
      },
    });
  }

  if (input.initialStock > 0) {
    if (options.initialStockSource === "purchase") {
      const purchase = await client.purchase.create({
        data: {
          productId: product.id,
          quantity: input.initialStock.toString(),
          unitCostCents: input.unitCostCents,
          totalCostCents: calculateLineTotalCents({
            quantity: input.initialStock,
            quantityFieldName: "estoque inicial",
            unitAmountCents: input.unitCostCents,
            unitAmountFieldName: "custo do produto",
          }),
          origin,
        },
      });

      await client.stockMovement.create({
        data: {
          productId: product.id,
          purchaseId: purchase.id,
          type: StockMovementType.PURCHASE,
          quantity: input.initialStock.toString(),
          reason: "INITIAL_PURCHASE",
          origin,
        },
      });

      return product;
    }

    await client.stockMovement.create({
      data: {
        productId: product.id,
        type: StockMovementType.ADJUSTMENT,
        quantity: input.initialStock.toString(),
        reason: "INITIAL_STOCK",
        origin,
      },
    });
  }

  return product;
}

export async function assertNoDuplicateProductName(
  client: Pick<ProductPersistenceClient, "product">,
  name: string,
  options: { excludeProductId?: string } = {},
): Promise<void> {
  const normalizedName = normalizeProductNameForDuplicate(name);

  if (normalizedName.length === 0) {
    return;
  }

  const duplicate = await client.product.findFirst({
    select: { id: true },
    where: {
      normalizedName,
      ...(options.excludeProductId ? { id: { not: options.excludeProductId } } : {}),
    },
  });

  if (duplicate) {
    throw new DuplicateProductNameError();
  }

  const products = await client.product.findMany({
    select: { id: true, name: true },
    where: options.excludeProductId ? { id: { not: options.excludeProductId } } : undefined,
  });

  if (products.some((product) => normalizeProductNameForDuplicate(product.name) === normalizedName)) {
    throw new DuplicateProductNameError();
  }
}

export function isDuplicateProductNameError(error: unknown): error is DuplicateProductNameError {
  return error instanceof DuplicateProductNameError;
}

export function productCreationErrorMessage(error: unknown, fallback: string): string {
  if (isDuplicateProductNameError(error)) {
    return duplicateProductNameMessage;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export function normalizeProductNameForDuplicate(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildProductAliasInputs(
  productName: string,
  aliases: string[] = [],
  source: ProductAliasSourceValue,
): Array<{ alias: string; normalizedAlias: string; source: ProductAliasSourceValue }> {
  const seen = new Set<string>();

  return [productName, ...aliases]
    .map((alias) => alias.trim().replace(/\s+/g, " "))
    .map((alias) => ({ alias, normalizedAlias: normalizeProductNameForDuplicate(alias), source }))
    .filter((aliasInput) => {
      if (aliasInput.alias.length === 0 || aliasInput.normalizedAlias.length === 0) {
        return false;
      }

      if (seen.has(aliasInput.normalizedAlias)) {
        return false;
      }

      seen.add(aliasInput.normalizedAlias);

      return true;
    });
}
