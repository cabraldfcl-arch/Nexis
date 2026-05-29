import { PackageOpen } from "lucide-react";
import { formatCentsToBRL } from "@/lib/finance";
import { productUnitShortLabels, type ProductUnitValue } from "@/lib/validation/product";

export type PurchaseListItem = {
  id: string;
  productName: string;
  quantity: number;
  unit: ProductUnitValue;
  unitCostCents: number;
  totalCostCents: number;
  supplier: string | null;
  purchasedAt: string;
};

type PurchaseListProps = {
  purchases: PurchaseListItem[];
};

export function PurchaseList({ purchases }: PurchaseListProps) {
  if (purchases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-zinc-600">
        <PackageOpen aria-hidden="true" className="mx-auto h-9 w-9 text-zinc-400" />
        <p className="mt-3 text-sm font-semibold text-zinc-950">Nenhuma compra cadastrada</p>
        <p className="mt-1 text-sm">As compras salvas aparecem aqui com produto, quantidade e custo.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {purchases.map((purchase) => (
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" key={purchase.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold tracking-normal text-zinc-950">
                {purchase.productName}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                {formatQuantity(purchase.quantity)} {productUnitShortLabels[purchase.unit]} comprados
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              Compra
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label="Custo por unidade" value={formatCentsToBRL(purchase.unitCostCents)} />
            <Metric label="Total" value={formatCentsToBRL(purchase.totalCostCents)} />
            <Metric label="Fornecedor" value={purchase.supplier ?? "Nao informado"} />
            <Metric label="Data" value={formatDate(purchase.purchasedAt)} />
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

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString().replace(".", ",");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}
