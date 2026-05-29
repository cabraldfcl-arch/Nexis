"use server";

import { ExpenseCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { normalizeExpenseForPersistence } from "@/lib/finance";
import { expenseSchema } from "@/lib/validation/expense";

export type ExpenseActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const genericSaveError = "Nao foi possivel salvar a despesa. Tente novamente.";

export async function createExpenseAction(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const parsed = parseExpenseActionFormData(formData);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    const expense = normalizeExpenseForPersistence({
      amountCents: parsed.data.amountCents,
      confirmed: parsed.data.confirmed,
    });

    await prisma.expense.create({
      data: {
        amountCents: expense.amountCents,
        category: parsed.data.category as ExpenseCategory,
        confirmed: expense.confirmed,
        description: parsed.data.description,
        paidAt: parsed.data.paidAt,
      },
    });

    revalidateTransactions();

    return { status: "success", message: "Despesa confirmada." };
  } catch (error) {
    return { status: "error", message: userFacingError(error, genericSaveError) };
  }
}

function parseExpenseActionFormData(formData: FormData) {
  let parsed;

  try {
    parsed = expenseSchema.safeParse({
      amount: formData.get("amount"),
      category: formData.get("category"),
      confirmed: formData.get("confirmed") === "true",
      description: formData.get("description"),
      paidAt: formData.get("paidAt"),
    });
  } catch (error) {
    return {
      success: false as const,
      error: {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Confira os campos da despesa.",
      },
    };
  }

  if (!parsed.success) {
    return {
      success: false as const,
      error: {
        status: "error" as const,
        message: "Confira os campos destacados.",
        fieldErrors: Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([field, messages]) => [
            field,
            messages?.[0] ?? "Campo invalido.",
          ]),
        ),
      },
    };
  }

  return { success: true as const, data: parsed.data };
}

function revalidateTransactions(): void {
  revalidatePath("/");
  revalidatePath("/expenses");
}

function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
