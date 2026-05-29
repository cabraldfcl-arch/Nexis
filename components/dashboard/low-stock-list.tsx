import type { DashboardLowStockProduct } from "@/lib/dashboard/summary";

type LowStockListProps = {
  products: readonly DashboardLowStockProduct[];
};

export function LowStockList({ products }: LowStockListProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-600 shadow-sm">
        Nenhum produto acabando
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {products.map((product) => (
        <article className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm" key={product.id}>
          <p className="text-sm font-semibold text-amber-950">{product.name}</p>
          <p className="mt-2 text-sm text-amber-900">
            Estoque {formatQuantity(product.currentStock)} de minimo {formatQuantity(product.minimumStock)}
          </p>
        </article>
      ))}
    </div>
  );
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
}
