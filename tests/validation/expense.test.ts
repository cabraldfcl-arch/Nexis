import { describe, expect, it } from "vitest";
import { expenseCategoryValues, validateExpenseInput } from "@/lib/validation/expense";

const validExpense = {
  description: "Energia do ponto",
  category: "UTILITIES",
  amount: "120,50",
  paidAt: "2026-05-22",
  confirmed: true,
};

describe("expense validation", () => {
  it("accepts a valid confirmed expense", () => {
    expect(validateExpenseInput(validExpense)).toEqual({
      description: "Energia do ponto",
      category: "UTILITIES",
      amountCents: 12050,
      paidAt: new Date(2026, 4, 22, 0, 0, 0, 0),
      confirmed: true,
    });
  });

  it("keeps a date-only form value on the same local calendar day", () => {
    const expense = validateExpenseInput(validExpense);

    expect(expense.paidAt.getFullYear()).toBe(2026);
    expect(expense.paidAt.getMonth()).toBe(4);
    expect(expense.paidAt.getDate()).toBe(22);
  });

  it("accepts a valid unconfirmed expense", () => {
    expect(validateExpenseInput({ ...validExpense, confirmed: false }).confirmed).toBe(false);
  });

  it("rejects empty description", () => {
    expect(() => validateExpenseInput({ ...validExpense, description: "" })).toThrow(/descricao/i);
  });

  it("rejects zero or negative amount", () => {
    expect(() => validateExpenseInput({ ...validExpense, amount: "0" })).toThrow(/valor/i);
    expect(() => validateExpenseInput({ ...validExpense, amount: "-1" })).toThrow(/valor/i);
  });

  it("rejects invalid category", () => {
    expect(expenseCategoryValues).toContain("UTILITIES");
    expect(expenseCategoryValues).toContain("LOSS_WASTE");
    expect(expenseCategoryValues).not.toContain("GASOLINE");
    expect(() => validateExpenseInput({ ...validExpense, category: "FOOD" })).toThrow(/categoria/i);
  });

  it("rejects invalid date", () => {
    expect(() => validateExpenseInput({ ...validExpense, paidAt: "not-a-date" })).toThrow(/data/i);
    expect(() => validateExpenseInput({ ...validExpense, paidAt: "2026-02-31" })).toThrow(/data/i);
  });

  it("requires confirmed as boolean", () => {
    expect(() => validateExpenseInput({ ...validExpense, confirmed: "true" })).toThrow(/confirmada/i);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => validateExpenseInput({ ...validExpense, amount: Number.NaN })).toThrow(/valor/i);
    expect(() => validateExpenseInput({ ...validExpense, amount: Number.POSITIVE_INFINITY })).toThrow(/valor/i);
  });
});
