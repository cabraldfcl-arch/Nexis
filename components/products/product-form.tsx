"use client";

import { useActionState, useEffect, useRef } from "react";
import { productUnitLabels, productUnitValues, type ProductUnitValue } from "@/lib/validation/product";

type ProductFormActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
};

type ProductFormAction = (state: ProductFormActionState, formData: FormData) => Promise<ProductFormActionState>;

type ProductFormValues = {
  id?: string;
  name: string;
  category: string | null;
  unit: ProductUnitValue;
  unitCostCents: number;
  salePriceCents: number;
  currentStock: number;
  minimumStock: number;
};

export type ProductFormInitialValues = {
  assistantProduct?: boolean;
  category?: string | null;
  initialPurchase?: boolean;
  initialStock?: number;
  minimumStock?: number;
  name?: string;
  salePriceCents?: number;
  unit?: ProductUnitValue;
  unitCostCents?: number;
};

type ProductFormProps = {
  action: ProductFormAction;
  initialValues?: ProductFormInitialValues;
  product?: ProductFormValues;
  submitLabel: string;
};

const initialState: ProductFormActionState = {
  status: "idle",
  message: "",
};

export function ProductForm({ action, initialValues, product, submitLabel }: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!product && state.status === "success") {
      formRef.current?.reset();
    }
  }, [product, state.status]);

  return (
    <form action={formAction} className="mt-4 grid gap-4" ref={formRef}>
      {product?.id ? <input name="productId" type="hidden" value={product.id} /> : null}
      {!product && initialValues?.assistantProduct ? <input name="assistantProduct" type="hidden" value="true" /> : null}
      {!product && initialValues?.initialPurchase ? <input name="initialPurchase" type="hidden" value="true" /> : null}

      <FieldError message={state.message} status={state.status} />

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          autoComplete="off"
          defaultValue={product?.name ?? initialValues?.name}
          error={state.fieldErrors?.name}
          label="Nome do produto"
          name="name"
          placeholder="Ex: Agua mineral"
        />
        <TextInput
          autoComplete="off"
          defaultValue={product?.category ?? initialValues?.category ?? ""}
          error={state.fieldErrors?.category}
          label="Categoria"
          name="category"
          placeholder="Ex: Bebidas"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-zinc-800">
          Unidade
          <select
            className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-950 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            defaultValue={product?.unit ?? initialValues?.unit ?? "UNIT"}
            name="unit"
          >
            {productUnitValues.map((value) => (
              <option key={value} value={value}>
                {productUnitLabels[value]}
              </option>
            ))}
          </select>
          <InlineError message={state.fieldErrors?.unit} />
        </label>
        <TextInput
          defaultValue={moneyInputValue(product?.unitCostCents ?? initialValues?.unitCostCents)}
          error={state.fieldErrors?.unitCost}
          inputMode="decimal"
          label="Custo para voce"
          name="unitCost"
          placeholder="2,50"
        />
        <TextInput
          defaultValue={moneyInputValue(product?.salePriceCents ?? initialValues?.salePriceCents)}
          error={state.fieldErrors?.salePrice}
          inputMode="decimal"
          label="Preço cadastrado"
          name="salePrice"
          placeholder="10,99"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {product ? (
          <div className="grid gap-2 text-sm font-semibold text-zinc-800">
            <input name="initialStock" type="hidden" value={quantityInputValue(product.currentStock) ?? "0"} />
            <span>Estoque atual</span>
            <p className="min-h-12 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-base font-semibold text-zinc-950">
              {quantityInputValue(product.currentStock) ?? "0"}
            </p>
            <p className="text-sm font-medium leading-6 text-zinc-600">
              Estoque atual nao e alterado neste cadastro. Use compras, vendas, perdas ou cancelamentos.
            </p>
            <InlineError message={state.fieldErrors?.initialStock} />
          </div>
        ) : (
          <TextInput
            defaultValue={quantityInputValue(initialValues?.initialStock)}
            error={state.fieldErrors?.initialStock}
            inputMode="decimal"
            label="Estoque inicial"
            name="initialStock"
            placeholder="0"
          />
        )}
        <TextInput
          defaultValue={quantityInputValue(product?.minimumStock ?? initialValues?.minimumStock)}
          error={state.fieldErrors?.minimumStock}
          inputMode="decimal"
          label="Estoque minimo"
          name="minimumStock"
          placeholder="0"
        />
      </div>

      {!product ? (
        <fieldset className="grid gap-3 rounded-lg border border-zinc-200 p-3">
          <legend className="px-1 text-sm font-semibold text-zinc-800">Entrada por embalagem</legend>
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
              placeholder="36,00"
            />
          </div>
        </fieldset>
      ) : null}

      <button
        className="min-h-12 rounded-lg bg-emerald-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={pending}
        type="submit"
      >
        {pending ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}

function TextInput({
  defaultValue,
  error,
  label,
  name,
  placeholder,
  autoComplete,
  inputMode,
}: {
  defaultValue?: string;
  error?: string;
  label: string;
  name: string;
  placeholder: string;
  autoComplete?: string;
  inputMode?: "decimal";
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-800">
      {label}
      <input
        autoComplete={autoComplete}
        className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-950 shadow-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        defaultValue={defaultValue}
        inputMode={inputMode}
        name={name}
        placeholder={placeholder}
        type="text"
      />
      <InlineError message={error} />
    </label>
  );
}

function FieldError({ message, status }: { message: string; status: ProductFormActionState["status"] }) {
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

function moneyInputValue(value?: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return (value / 100).toFixed(2).replace(".", ",");
}

function quantityInputValue(value?: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}
