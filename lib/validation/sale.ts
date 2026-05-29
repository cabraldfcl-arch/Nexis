import { z } from "zod";
import { calculateLineTotalCents } from "@/lib/finance";
import { parseBrazilianMoneyToCents, parseBrazilianQuantity } from "./product";

export type SaleInput = {
  productId: unknown;
  quantity: unknown;
  unitPrice?: unknown;
};

export type SaleData = {
  productId: string;
  quantity: number;
  unitPriceCents: number | null;
  totalAmountCents: number | null;
};

export const saleSchema = z
  .object({
    productId: z.preprocess(
      (value) => stringFromUnknown(value).trim(),
      z.string().min(1, "Produto e obrigatorio."),
    ),
    quantity: z.preprocess((value) => parsePositiveQuantity(value, "Quantidade vendida"), z.number()),
    unitPrice: z.preprocess((value) => parseOptionalMoneyToCents(value, "Preco de venda"), z.number().nullable()),
  })
  .transform((value): SaleData => {
    const totalAmountCents =
      value.unitPrice === null
        ? null
        : calculateLineTotalCents({
            quantity: value.quantity,
            unitAmountCents: value.unitPrice,
            quantityFieldName: "quantidade vendida",
            unitAmountFieldName: "preco de venda",
          });

    return {
      productId: value.productId,
      quantity: value.quantity,
      unitPriceCents: value.unitPrice,
      totalAmountCents,
    };
  });

export function validateSaleInput(input: SaleInput): SaleData {
  const result = saleSchema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Venda invalida.");
  }

  return result.data;
}

export function parseSaleFormData(formData: FormData): SaleData {
  return validateSaleInput({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
  });
}

function parseOptionalMoneyToCents(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || stringFromUnknown(value).trim() === "") {
    return null;
  }

  return parseBrazilianMoneyToCents(value, fieldName);
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
