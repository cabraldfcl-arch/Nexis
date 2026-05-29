import { z } from "zod";
import { parseBrazilianMoneyToCents } from "./product";

export const expenseCategoryValues = [
  "MERCHANDISE_SUPPLIES",
  "RENT",
  "UTILITIES",
  "TRANSPORT_LOGISTICS",
  "PACKAGING_MATERIAL",
  "MAINTENANCE",
  "TAXES_FEES",
  "LABOR",
  "MARKETING",
  "LOSS_WASTE",
  "OTHER",
] as const;

export const legacyExpenseCategoryValues = [
  "ENERGY",
  "WATER",
  "INTERNET",
  "TRANSPORT",
  "PACKAGING",
  "TAX",
] as const;

export const allExpenseCategoryValues = [...expenseCategoryValues, ...legacyExpenseCategoryValues] as const;

export type ActiveExpenseCategoryValue = (typeof expenseCategoryValues)[number];
export type ExpenseCategoryValue = (typeof allExpenseCategoryValues)[number];

export const expenseCategoryLabels: Record<ExpenseCategoryValue, string> = {
  MERCHANDISE_SUPPLIES: "Mercadoria/Insumo",
  RENT: "Aluguel",
  UTILITIES: "Contas",
  TRANSPORT_LOGISTICS: "Transporte",
  PACKAGING_MATERIAL: "Embalagem/Material",
  MAINTENANCE: "Manutencao",
  TAXES_FEES: "Taxas/Impostos",
  LABOR: "Mao de obra",
  MARKETING: "Marketing",
  LOSS_WASTE: "Perdas/Quebras",
  OTHER: "Outros",
  ENERGY: "Contas",
  WATER: "Contas",
  INTERNET: "Contas",
  TRANSPORT: "Transporte",
  PACKAGING: "Embalagem/Material",
  TAX: "Taxas/Impostos",
};

export type ExpenseInput = {
  description: unknown;
  category: unknown;
  amount: unknown;
  paidAt: unknown;
  confirmed: unknown;
};

export type ExpenseData = {
  description: string;
  category: ExpenseCategoryValue;
  amountCents: number;
  paidAt: Date;
  confirmed: boolean;
};

export const expenseSchema = z
  .object({
    description: z.preprocess(
      (value) => stringFromUnknown(value).trim(),
      z.string().min(2, "Descricao e obrigatoria."),
    ),
    category: z.preprocess(
      (value) => stringFromUnknown(value).trim(),
      z.string().refine(isExpenseCategory, "Categoria invalida."),
    ),
    amount: z.preprocess((value) => parsePositiveMoneyToCents(value, "Valor"), z.number()),
    paidAt: z.preprocess((value) => parseDate(value, "Data"), z.date()),
    confirmed: z.boolean({ error: "Confirmada precisa ser verdadeiro ou falso." }),
  })
  .transform((value): ExpenseData => {
    return {
      description: value.description,
      category: value.category as ExpenseCategoryValue,
      amountCents: value.amount,
      paidAt: value.paidAt,
      confirmed: value.confirmed,
    };
  });

export function validateExpenseInput(input: ExpenseInput): ExpenseData {
  const result = expenseSchema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Despesa invalida.");
  }

  return result.data;
}

export function parseExpenseFormData(formData: FormData): ExpenseData {
  return validateExpenseInput({
    description: formData.get("description"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    paidAt: formData.get("paidAt"),
    confirmed: formData.get("confirmed") === "true",
  });
}

function parsePositiveMoneyToCents(value: unknown, fieldName: string): number {
  const cents = parseBrazilianMoneyToCents(value, fieldName);

  if (cents <= 0) {
    throw new Error(`${fieldName} deve ser maior que zero.`);
  }

  return cents;
}

function parseDate(value: unknown, fieldName: string): Date {
  const text = stringFromUnknown(value).trim();

  if (text.length === 0) {
    throw new Error(`${fieldName} e obrigatoria.`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [yearText, monthText, dayText] = text.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new Error(`${fieldName} invalida.`);
    }

    return date;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} invalida.`);
  }

  return date;
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

function isExpenseCategory(value: string): value is ExpenseCategoryValue {
  return allExpenseCategoryValues.includes(value as ExpenseCategoryValue);
}
