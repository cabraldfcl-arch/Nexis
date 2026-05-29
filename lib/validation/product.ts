import { z } from "zod";
import { calculateRoundedUnitAmountCents } from "@/lib/finance";

export const productUnitValues = [
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
] as const;

export type ProductUnitValue = (typeof productUnitValues)[number];

export const productUnitLabels: Record<ProductUnitValue, string> = {
  UNIT: "Unidade",
  KG: "Kg",
  GRAM: "Grama",
  LITER: "Litro",
  METER: "Metro",
  SQUARE_METER: "m²",
  CUBIC_METER: "m³",
  BOX: "Caixa",
  SACK: "Saco",
  BALE: "Fardo",
  PACKAGE: "Pacote",
  DOZEN: "Dúzia",
};

export const productUnitShortLabels: Record<ProductUnitValue, string> = {
  UNIT: "unid.",
  KG: "kg",
  GRAM: "g",
  LITER: "litro",
  METER: "metro",
  SQUARE_METER: "m²",
  CUBIC_METER: "m³",
  BOX: "caixa",
  SACK: "saco",
  BALE: "fardo",
  PACKAGE: "pacote",
  DOZEN: "dúzia",
};

export type ProductFormInput = {
  name: unknown;
  category?: unknown;
  unit: unknown;
  unitCost: unknown;
  salePrice: unknown;
  initialStock: unknown;
  minimumStock: unknown;
  packageQuantity?: unknown;
  unitsPerPackage?: unknown;
  packageCost?: unknown;
};

export type ProductFormData = {
  name: string;
  category: string | null;
  unit: ProductUnitValue;
  unitCostCents: number;
  salePriceCents: number;
  initialStock: number;
  minimumStock: number;
};

const baseProductFormSchema = z
  .object({
    name: z.preprocess(
      (value) => stringFromUnknown(value).trim(),
      z.string().min(2, "Nome do produto deve ter pelo menos 2 letras."),
    ),
    category: z.preprocess((value) => {
      const category = stringFromUnknown(value).trim();

      return category.length > 0 ? category : null;
    }, z.string().nullable()),
    unit: z.preprocess(
      (value) => stringFromUnknown(value).trim(),
      z.string().refine(isProductUnitValue, "Unidade informada nao e aceita pelo NEXIS."),
    ),
    unitCost: z.preprocess((value) => parseBrazilianMoneyToCents(value, "Custo para voce"), z.number()),
    salePrice: z.preprocess((value) => parseBrazilianMoneyToCents(value, "Preco de venda"), z.number()),
    initialStock: z.preprocess((value) => parseBrazilianQuantity(value, "Estoque inicial"), z.number()),
    minimumStock: z.preprocess((value) => parseBrazilianQuantity(value, "Estoque minimo"), z.number()),
  })
  .transform((value): ProductFormData => {
    return {
      name: value.name,
      category: value.category,
      unit: value.unit as ProductUnitValue,
      unitCostCents: value.unitCost,
      salePriceCents: value.salePrice,
      initialStock: value.initialStock,
      minimumStock: value.minimumStock,
    };
  });

export const productFormSchema = z.preprocess(normalizePackagedProductInput, baseProductFormSchema);

export function validateProductFormInput(input: ProductFormInput): ProductFormData {
  const result = productFormSchema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Produto invalido.");
  }

  return result.data;
}

export function parseProductFormData(formData: FormData): ProductFormData {
  return validateProductFormInput({
    name: formData.get("name"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    unitCost: formData.get("unitCost"),
    salePrice: formData.get("salePrice"),
    initialStock: formData.get("initialStock"),
    minimumStock: formData.get("minimumStock"),
    packageQuantity: formData.get("packageQuantity"),
    unitsPerPackage: formData.get("unitsPerPackage"),
    packageCost: formData.get("packageCost"),
  });
}

export function parseBrazilianMoneyToCents(value: unknown, fieldName: string): number {
  const text = normalizedRequiredText(value, fieldName);

  if (text.startsWith("-")) {
    throw new Error(`${fieldName} nao pode ser negativo.`);
  }

  const normalized = text.replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${fieldName} deve ser informado em reais com centavos, por exemplo 10 ou 10,99.`);
  }

  const [reaisText, centsText = ""] = normalized.split(".");
  const reais = Number(reaisText);
  const cents = Number(centsText.padEnd(2, "0"));
  const total = reais * 100 + cents;

  if (!Number.isSafeInteger(total)) {
    throw new Error(`${fieldName} deve resultar em centavos inteiros.`);
  }

  return total;
}

export function parseBrazilianQuantity(value: unknown, fieldName: string): number {
  const text = normalizedRequiredText(value, fieldName);

  if (text.startsWith("-")) {
    throw new Error(`${fieldName} nao pode ser negativo.`);
  }

  const normalized = text.replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`${fieldName} deve ser um numero maior ou igual a zero.`);
  }

  const quantity = Number(normalized);

  if (!Number.isFinite(quantity) || Number.isNaN(quantity)) {
    throw new Error(`${fieldName} deve ser um numero finito.`);
  }

  if (quantity < 0) {
    throw new Error(`${fieldName} nao pode ser negativo.`);
  }

  return quantity;
}

function normalizedRequiredText(value: unknown, fieldName: string): string {
  if (typeof value === "number" && (!Number.isFinite(value) || Number.isNaN(value))) {
    throw new Error(`${fieldName} deve ser um numero finito.`);
  }

  const text = stringFromUnknown(value).trim();

  if (text.length === 0) {
    throw new Error(`${fieldName} e obrigatorio.`);
  }

  if (/^(nan|infinity|\+infinity|-infinity)$/i.test(text)) {
    throw new Error(`${fieldName} deve ser um numero finito.`);
  }

  return text;
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

function isProductUnitValue(value: string): value is ProductUnitValue {
  return productUnitValues.includes(value as ProductUnitValue);
}

function normalizePackagedProductInput(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const input = value as Record<string, unknown>;
  const hasPackaging =
    hasFormValue(input.packageQuantity) || hasFormValue(input.unitsPerPackage) || hasFormValue(input.packageCost);

  if (!hasPackaging) {
    return input;
  }

  if (stringFromUnknown(input.unit).trim() !== "UNIT") {
    throw new Error("Para converter embalagem, selecione Unidade como unidade do produto.");
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

  const initialStock = roundQuantity(packageQuantity * unitsPerPackage);
  const unitCostCents = calculateRoundedUnitAmountCents({
    totalAmountCents: packageCostCents,
    totalFieldName: "Custo por embalagem",
    unitFieldName: "Unidades por embalagem",
    units: unitsPerPackage,
  });

  if (!Number.isFinite(initialStock) || initialStock <= 0) {
    throw new Error("Estoque calculado pela embalagem precisa ser maior que zero.");
  }

  return {
    ...input,
    initialStock: formatQuantityForValidation(initialStock),
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
