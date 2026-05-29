"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { calculateSaleItemProfitMetrics, formatCentsToBRL } from "@/lib/finance";
import { productUnitShortLabels } from "@/lib/validation/product";
import type { TransactionProductOption } from "./purchase-form";

type SaleFormActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
};

type SaleFormAction = (state: SaleFormActionState, formData: FormData) => Promise<SaleFormActionState>;

type SaleFormProps = {
  action: SaleFormAction;
  products: TransactionProductOption[];
};

const initialState: SaleFormActionState = {
  status: "idle",
  message: "",
};

export function SaleForm({ action, products }: SaleFormProps) {
  const router = useRouter();
  const [state, setState] = useState<SaleFormActionState>(initialState);
  const [pending, setPending] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );
  const salePreview = useMemo(() => buildSalePreview(selectedProduct, quantity, unitPrice), [
    quantity,
    selectedProduct,
    unitPrice,
  ]);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending || products.length === 0) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    setPending(true);
    setState(initialState);

    try {
      const nextState = await action(state, formData);

      setState(nextState);

      if (nextState.status === "success") {
        setSelectedProductId("");
        setQuantity("");
        setUnitPrice("");
      }
    } catch {
      setState({ status: "error", message: "Nao foi possivel salvar a venda. Tente novamente." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
      <FieldMessage message={state.message} status={state.status} />

      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Produto
        <select
          className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-950 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          name="productId"
          onChange={(event) => {
            const productId = event.target.value;
            const product = products.find((item) => item.id === productId);

            setSelectedProductId(productId);
            setUnitPrice(product ? moneyInputValue(product.salePriceCents) : "");
            setQuantity("");
          }}
          value={selectedProductId}
        >
          <option value="">Escolha um produto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} - estoque {formatQuantity(product.currentStock)} {productUnitShortLabels[product.unit]} - preço{" "}
              {moneyInputValue(product.salePriceCents)}
            </option>
          ))}
        </select>
        {selectedProduct ? (
          <span className="text-sm font-medium text-zinc-600">
            Preço cadastrado: {moneyInputValue(selectedProduct.salePriceCents)}
          </span>
        ) : null}
        <InlineError message={state.fieldErrors?.productId} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          error={state.fieldErrors?.quantity}
          inputMode="decimal"
          label="Quantidade vendida"
          name="quantity"
          placeholder="1"
          value={quantity}
          onChange={setQuantity}
        />
        <TextInput
          error={state.fieldErrors?.unitPrice}
          inputMode="decimal"
          label="Preço desta venda"
          name="unitPrice"
          placeholder="10,99"
          value={unitPrice}
          onChange={setUnitPrice}
        />
      </div>

      <p className="text-sm leading-6 text-zinc-600">
        Se deixar como está, usamos o preço cadastrado do produto. Você pode alterar só para esta venda.
      </p>

      {salePreview ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <PreviewMetric label="Lucro estimado" value={formatCentsToBRL(salePreview.grossProfitCents)} />
            <PreviewMetric label="Margem estimada" value={formatPercent(salePreview.marginPercent)} />
          </dl>
          {salePreview.belowCost ? (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
              Atenção: preço abaixo do custo para você.
            </p>
          ) : null}
        </div>
      ) : null}

      {products.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Cadastre um produto ativo antes de salvar venda.
        </p>
      ) : null}

      <button
        className="min-h-12 rounded-lg bg-emerald-700 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={pending || products.length === 0}
        type="submit"
      >
        {pending ? "Confirmando..." : "Confirmar venda"}
      </button>
    </form>
  );
}

function TextInput({
  error,
  inputMode,
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  error?: string;
  inputMode?: "decimal";
  label: string;
  name: string;
  onChange?: (value: string) => void;
  placeholder: string;
  value?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-800">
      {label}
      <input
        className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-950 shadow-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        inputMode={inputMode}
        name={name}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        type="text"
        value={value}
      />
      <InlineError message={error} />
    </label>
  );
}

function FieldMessage({ message, status }: { message: string; status: SaleFormActionState["status"] }) {
  if (!message) {
    return null;
  }

  const tone =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <p
      aria-live={status === "success" ? "polite" : "assertive"}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${tone}`}
      role={status === "success" ? "status" : "alert"}
    >
      {message}
    </p>
  );
}

function InlineError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <span className="text-sm font-medium text-rose-700">{message}</span>;
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function buildSalePreview(product: TransactionProductOption | null, quantityText: string, unitPriceText: string) {
  if (!product) {
    return null;
  }

  const parsedQuantity = parseQuantityInput(quantityText);
  const parsedUnitPrice = parseMoneyInputToCents(unitPriceText);

  if (parsedQuantity === null || parsedUnitPrice === null) {
    return null;
  }

  return calculateSaleItemProfitMetrics({
    quantity: parsedQuantity,
    unitPriceCents: parsedUnitPrice,
    unitCostSnapshotCents: product.unitCostCents,
  });
}

function parseQuantityInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const quantity = Number(normalized);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function parseMoneyInputToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [reaisText, centsText = ""] = normalized.split(".");
  const cents = Number(reaisText) * 100 + Number(centsText.padEnd(2, "0"));

  return Number.isSafeInteger(cents) ? cents : null;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "Sem referência";
  }

  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString().replace(".", ",");
}

function moneyInputValue(value: number): string {
  return (value / 100).toFixed(2).replace(".", ",");
}
