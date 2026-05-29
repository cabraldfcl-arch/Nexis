import { z } from "zod";
import { calculateLineTotalCents, calculateRoundedUnitAmountCents } from "@/lib/finance";
import { parseBrazilianMoneyToCents, parseBrazilianQuantity } from "./product";

export type PurchaseInput = {
  productId: unknown;
  quantity: unknown;
  unitCost: unknown;
  supplier?: unknown;
  packageQuantity?: unknown;
  unitsPerPackage?: unknown;
  packageCost?: unknown;
};

export type PurchaseData = {
  productId: string;
  quantity: number;
  unitCostCents: number;
  totalCostCents: number;
  supplier: string | null;
};

const basePurchaseSchema = z
  .object({
    productId: z.preprocess(
      (value) => stringFromUnknown(value).trim(),
      z.string().min(1, "Produto e obrigatorio."),
    ),
    quantity: z.preprocess(
      (value) => parsePositiveQuantity(value, "Quantidade comprada"),
      z.number(),
    ),
    unitCost: z.preprocess((value) => parseBrazilianMoneyToCents(value, "Custo por unidade"), z.number()),
    supplier: z.preprocess((value) => {
      const supplier = stringFromUnknown(value).trim();

      return supplier.length > 0 ? supplier : null;
    }, z.string().nullable()),
  })
  .transform((value): PurchaseData => {
    const totalCostCents = calculateLineTotalCents({
      quantity: value.quantity,
      unitAmountCents: value.unitCost,
      quantityFieldName: "quantidade comprada",
      unitAmountFieldName: "custo por unidade",
    });

    return {
      productId: value.productId,
      quantity: value.quantity,
      unitCostCents: value.unitCost,
      totalCostCents,
      supplier: value.supplier,
    };
  });

export const purchaseSchema = z.preprocess(normalizePackagedPurchaseInput, basePurchaseSchema);

export function validatePurchaseInput(input: PurchaseInput): PurchaseData {
  const result = purchaseSchema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Compra invalida.");
  }

  return result.data;
}

export function parsePurchaseFormData(formData: FormData): PurchaseData {
  return validatePurchaseInput({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    unitCost: formData.get("unitCost"),
    supplier: formData.get("supplier"),
    packageQuantity: formData.get("packageQuantity"),
    unitsPerPackage: formData.get("unitsPerPackage"),
    packageCost: formData.get("packageCost"),
  });
}

function parsePositiveQuantity(value: unknown, fieldName: string): number {
  const quantity = parseBrazilianQuantity(value, fieldName);

  if (quantity <= 0) {
    throw new Error(`${fieldName} deve ser maior que zero.`);
  }

  return quantity;
}

function stringFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function normalizePackagedPurchaseInput(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const input = value as Record<string, unknown>;
  const hasPackaging =
    hasFormValue(input.packageQuantity) || hasFormValue(input.unitsPerPackage) || hasFormValue(input.packageCost);

  if (!hasPackaging) {
    return input;
  }

  if (!hasFormValue(input.packageQuantity) || !hasFormValue(input.unitsPerPackage) || !hasFormValue(input.packageCost)) {
    throw new Error(
      "Para converter embalagem, informe quantidade de embalagens, unidades por embalagem e custo por embalagem.",
    );
  }

  const packageQuantity = parseBrazilianQuantity(input.packageQuantity, "Quantidade de embalagens");
  const unitsPerPackage = parseBrazilianQuantity(input.unitsPerPackage, "Unidades por embalagem");
  const packageCostCents = parseBrazilianMoneyToCents(input.packageCost, "Custo por embalagem");

  if (packageQuantity <= 0) {
    throw new Error("Quantidade de embalagens precisa ser maior que zero.");
  }

  if (unitsPerPackage <= 0) {
    throw new Error("Unidades por embalagem precisa ser maior que zero.");
  }

  if (packageCostCents <= 0) {
    throw new Error("Custo por embalagem precisa ser maior que zero.");
  }

  const quantity = roundQuantity(packageQuantity * unitsPerPackage);
  const unitCostCents = calculateRoundedUnitAmountCents({
    totalAmountCents: packageCostCents,
    totalFieldName: "Custo por embalagem",
    unitFieldName: "Unidades por embalagem",
    units: unitsPerPackage,
  });

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantidade calculada pela embalagem precisa ser maior que zero.");
  }

  return {
    ...input,
    quantity: formatQuantityForValidation(quantity),
    unitCost: formatCentsForValidation(unitCostCents),
  };
}

function hasFormValue(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return stringFromUnknown(value).trim().length > 0;
}

function roundQuantity(value: number): number {
  return Number(value.toFixed(6));
}

function formatQuantityForValidation(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function formatCentsForValidation(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
