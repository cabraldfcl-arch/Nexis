import { ArrowLeft, ReceiptText } from "lucide-react";
import Link from "next/link";
import { ExpenseForm } from "@/components/transactions/expense-form";
import { ExpenseList, type ExpenseListItem } from "@/components/transactions/expense-list";
import { prisma } from "@/lib/db/prisma";
import { type ExpenseCategoryValue } from "@/lib/validation/expense";
import { createExpenseAction } from "./actions";

export const dynamic = "force-dynamic";

const recentExpensesLimit = 30;

export default async function ExpensesPage() {
  const expenses = await prisma.expense.findMany({
    orderBy: { paidAt: "desc" },
    take: recentExpensesLimit,
    where: { cancelledAt: null },
  });

  const expenseItems: ExpenseListItem[] = expenses.map((expense) => ({
    amountCents: expense.amountCents,
    category: expense.category as ExpenseCategoryValue,
    confirmed: expense.confirmed,
    description: expense.description,
    id: expense.id,
    paidAt: expense.paidAt.toISOString(),
  }));

  return (
    <main className="min-h-dvh bg-[#f6f7f4] text-zinc-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-zinc-200 pb-5">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Voltar ao painel
          </Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <ReceiptText aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">Despesas</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Despesas</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Registre gastos do negocio para acompanhar o lucro liquido.
              </p>
            </div>
          </div>
        </header>

        <section aria-labelledby="new-expense-heading" className="py-5">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 id="new-expense-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
              Nova despesa
            </h2>
            <ExpenseForm action={createExpenseAction} today={dateInputValue(new Date())} />
          </div>
        </section>

        <section aria-labelledby="expense-list-heading" className="pb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="expense-list-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
              Despesas recentes
            </h2>
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
              {expenseItems.length}/{recentExpensesLimit}
            </span>
          </div>
          <p className="mb-3 text-sm text-zinc-600">
            Mostrando {expenseItems.length} das ultimas {recentExpensesLimit} despesas para manter a tela rapida.
          </p>
          <ExpenseList expenses={expenseItems} />
        </section>
      </div>
    </main>
  );
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
