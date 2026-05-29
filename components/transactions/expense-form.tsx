"use client";

import { useActionState, useEffect, useRef } from "react";
import { expenseCategoryLabels, expenseCategoryValues } from "@/lib/validation/expense";

type ExpenseFormActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
};

type ExpenseFormAction = (
  state: ExpenseFormActionState,
  formData: FormData,
) => Promise<ExpenseFormActionState>;

type ExpenseFormProps = {
  action: ExpenseFormAction;
  today: string;
};

const initialState: ExpenseFormActionState = {
  status: "idle",
  message: "",
};

export function ExpenseForm({ action, today }: ExpenseFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form action={formAction} className="mt-4 grid gap-4" ref={formRef}>
      <FieldMessage message={state.message} status={state.status} />

      <TextInput
        autoComplete="off"
        error={state.fieldErrors?.description}
        label="Descricao"
        name="description"
        placeholder="Ex: Energia do ponto"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-zinc-800">
          Categoria
          <select
            className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-950 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            defaultValue="OTHER"
            name="category"
          >
            {expenseCategoryValues.map((category) => (
              <option key={category} value={category}>
                {expenseCategoryLabels[category]}
              </option>
            ))}
          </select>
          <InlineError message={state.fieldErrors?.category} />
        </label>

        <TextInput
          error={state.fieldErrors?.amount}
          inputMode="decimal"
          label="Valor"
          name="amount"
          placeholder="50,00"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-zinc-800">
          Data
          <input
            className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-950 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            defaultValue={today}
            name="paidAt"
            type="date"
          />
          <InlineError message={state.fieldErrors?.paidAt} />
        </label>

        <label className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm">
          <input
            className="h-5 w-5 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
            defaultChecked
            name="confirmed"
            type="checkbox"
            value="true"
          />
          Confirmada
        </label>
      </div>

      <button
        className="min-h-12 rounded-lg bg-emerald-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={pending}
        type="submit"
      >
        {pending ? "Confirmando..." : "Confirmar despesa"}
      </button>
    </form>
  );
}

function TextInput({
  autoComplete,
  error,
  inputMode,
  label,
  name,
  placeholder,
}: {
  autoComplete?: string;
  error?: string;
  inputMode?: "decimal";
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-800">
      {label}
      <input
        autoComplete={autoComplete}
        className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-950 shadow-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        inputMode={inputMode}
        name={name}
        placeholder={placeholder}
        type="text"
      />
      <InlineError message={error} />
    </label>
  );
}

function FieldMessage({ message, status }: { message: string; status: ExpenseFormActionState["status"] }) {
  if (!message) {
    return null;
  }

  const tone =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return <p className={`rounded-lg border px-3 py-2 text-sm font-semibold ${tone}`}>{message}</p>;
}

function InlineError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <span className="text-sm font-medium text-rose-700">{message}</span>;
}
