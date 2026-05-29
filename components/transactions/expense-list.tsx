import { ReceiptText } from "lucide-react";
import { formatCentsToBRL } from "@/lib/finance";
import { expenseCategoryLabels, type ExpenseCategoryValue } from "@/lib/validation/expense";

export type ExpenseListItem = {
  id: string;
  description: string;
  category: ExpenseCategoryValue;
  amountCents: number;
  paidAt: string;
  confirmed: boolean;
};

type ExpenseListProps = {
  expenses: ExpenseListItem[];
};

export function ExpenseList({ expenses }: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-zinc-600">
        <ReceiptText aria-hidden="true" className="mx-auto h-9 w-9 text-zinc-400" />
        <p className="mt-3 text-sm font-semibold text-zinc-950">Nenhuma despesa cadastrada</p>
        <p className="mt-1 text-sm">As despesas salvas aparecem aqui com valor, categoria e confirmacao.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {expenses.map((expense) => (
        <article
          className={`rounded-lg border bg-white p-4 shadow-sm ${
            expense.confirmed ? "border-zinc-200" : "border-amber-300 ring-2 ring-amber-100"
          }`}
          key={expense.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold tracking-normal text-zinc-950">
                {expense.description}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">{expenseCategoryLabels[expense.category]}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                expense.confirmed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
              }`}
            >
              {expense.confirmed ? "Confirmada" : "Pendente"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Metric label="Valor" value={formatCentsToBRL(expense.amountCents)} />
            <Metric label="Data" value={formatDate(expense.paidAt)} />
            <Metric label="Categoria" value={expenseCategoryLabels[expense.category]} />
          </div>
        </article>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}
