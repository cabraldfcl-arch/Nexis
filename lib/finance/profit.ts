import {
  sumMoneyCents,
  validateIntegerMoneyCents,
  validateNonNegativeMoneyCents,
  type MoneyCents,
} from "./money";

export type ExpenseInput = {
  amountCents: MoneyCents;
  confirmed: boolean;
};

export function calculateGrossProfitCents({
  revenueCents,
  costOfGoodsSoldCents,
}: {
  revenueCents: MoneyCents;
  costOfGoodsSoldCents: MoneyCents;
}): MoneyCents {
  const revenue = validateNonNegativeMoneyCents(revenueCents, "faturamento");
  const cost = validateNonNegativeMoneyCents(costOfGoodsSoldCents, "custo das vendas");
  const grossProfit = revenue - cost;

  return validateIntegerMoneyCents(grossProfit, "lucro bruto");
}

export function calculateConfirmedExpensesCents(expenses: readonly ExpenseInput[]): MoneyCents {
  if (!Array.isArray(expenses)) {
    throw new Error("despesas devem ser uma lista.");
  }

  const values = expenses.map((expense) => {
    if (typeof expense.confirmed !== "boolean") {
      throw new Error("despesa deve informar se esta confirmada.");
    }

    const amountCents = validateNonNegativeMoneyCents(expense.amountCents, "despesa");

    return expense.confirmed ? amountCents : 0;
  });

  return sumMoneyCents(values, "despesas confirmadas");
}

export function calculatePendingExpensesCents(expenses: readonly ExpenseInput[]): MoneyCents {
  if (!Array.isArray(expenses)) {
    throw new Error("despesas devem ser uma lista.");
  }

  const values = expenses.map((expense) => {
    if (typeof expense.confirmed !== "boolean") {
      throw new Error("despesa deve informar se esta confirmada.");
    }

    const amountCents = validateNonNegativeMoneyCents(expense.amountCents, "despesa");

    return expense.confirmed ? 0 : amountCents;
  });

  return sumMoneyCents(values, "despesas pendentes");
}

export function calculateNetProfitCents({
  grossProfitCents,
  confirmedExpensesCents,
}: {
  grossProfitCents: MoneyCents;
  confirmedExpensesCents: MoneyCents;
}): MoneyCents {
  const grossProfit = validateIntegerMoneyCents(grossProfitCents, "lucro bruto");
  const expenses = validateNonNegativeMoneyCents(confirmedExpensesCents, "despesas confirmadas");
  const netProfit = grossProfit - expenses;

  return validateIntegerMoneyCents(netProfit, "lucro liquido");
}
