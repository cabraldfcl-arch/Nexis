"use client";

import { useActionState, useEffect, useRef } from "react";
import { productUnitShortLabels, type ProductUnitValue } from "@/lib/validation/product";

type PurchaseFormActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
};

type PurchaseFormAction = (
  state: PurchaseFormActionState,
  formData: FormData,
) => Promise<PurchaseFormActionState>;

export type TransactionProductOption = {
  id: string;
  name: string;
  unit: ProductUnitValue;
  currentStock: number;
  unitCostCents: number;
  salePriceCents: number;
};

type PurchaseFormProps = {
  action: PurchaseFormAction;
  products: TransactionProductOption[];
};

const initialState: PurchaseFormActionState = {
  status: "idle",
  message: "",
};

export function PurchaseForm({ action, products }: PurchaseFormProps) {
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

      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Produto
        <select
          className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-950 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          defaultValue=""
          name="productId"
        >
          <option value="">Escolha um produto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} - estoque {formatQuantity(product.currentStock)} {productUnitShortLabels[product.unit]}
            </option>
          ))}
        </select>
        <InlineError message={state.fieldErrors?.productId} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          error={state.fieldErrors?.quantity}
          inputMode="decimal"
          label="Quantidade comprada"
          name="quantity"
          placeholder="5"
        />
        <TextInput
          error={state.fieldErrors?.unitCost}
          inputMode="decimal"
          label="Custo por unidade"
          name="unitCost"
          placeholder="2,50"
        />
      </div>

      <fieldset className="grid gap-3 rounded-lg border border-zinc-200 p-3">
        <legend className="px-1 text-sm font-semibold text-zinc-800">Compra por embalagem</legend>
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput
            error={state.fieldErrors?.packageQuantity}
            inputMode="decimal"
            label="Quantidade de embalagens"
            name="packageQuantity"
            placeholder="2"
          />
          <TextInput
            error={state.fieldErrors?.unitsPerPackage}
            inputMode="decimal"
            label="Unidades por embalagem"
            name="unitsPerPackage"
            placeholder="12"
          />
          <TextInput
            error={state.fieldErrors?.packageCost}
            inputMode="decimal"
            label="Custo por embalagem"
            name="packageCost"
            placeholder="18,00"
          />
        </div>
      </fieldset>

      <TextInput
        autoComplete="off"
        error={state.fieldErrors?.supplier}
        label="Fornecedor"
        name="supplier"
        placeholder="Opcional"
      />

      {products.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Cadastre um produto ativo antes de salvar compra.
        </p>
      ) : null}

      <button
        className="min-h-12 rounded-lg bg-emerald-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={pending || products.length === 0}
        type="submit"
      >
        {pending ? "Confirmando..." : "Confirmar compra"}
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

function FieldMessage({ message, status }: { message: string; status: PurchaseFormActionState["status"] }) {
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

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString().replace(".", ",");
}
