import { ArrowLeft, PackagePlus } from "lucide-react";
import Link from "next/link";
import { PurchaseForm, type TransactionProductOption } from "@/components/transactions/purchase-form";
import { PurchaseList, type PurchaseListItem } from "@/components/transactions/purchase-list";
import { prisma } from "@/lib/db/prisma";
import { createPurchaseAction } from "./actions";

export const dynamic = "force-dynamic";

const recentPurchasesLimit = 20;

export default async function PurchasesPage() {
  const [products, purchases] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        currentStock: true,
        id: true,
        name: true,
        salePriceCents: true,
        unit: true,
        unitCostCents: true,
      },
      where: { active: true },
    }),
    prisma.purchase.findMany({
      include: {
        product: {
          select: {
            name: true,
            unit: true,
          },
        },
      },
      orderBy: { purchasedAt: "desc" },
      take: recentPurchasesLimit,
      where: { cancelledAt: null },
    }),
  ]);

  const productOptions: TransactionProductOption[] = products.map((product) => ({
    currentStock: Number(product.currentStock),
    id: product.id,
    name: product.name,
    salePriceCents: product.salePriceCents,
    unit: product.unit,
    unitCostCents: product.unitCostCents,
  }));

  const purchaseItems: PurchaseListItem[] = purchases.map((purchase) => ({
    id: purchase.id,
    productName: purchase.product.name,
    purchasedAt: purchase.purchasedAt.toISOString(),
    quantity: Number(purchase.quantity),
    supplier: purchase.supplier,
    totalCostCents: purchase.totalCostCents,
    unit: purchase.product.unit,
    unitCostCents: purchase.unitCostCents,
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
              <PackagePlus aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">Compras</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Compras</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Registre produtos comprados para aumentar o estoque.
              </p>
            </div>
          </div>
        </header>

        <section aria-labelledby="new-purchase-heading" className="py-5">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 id="new-purchase-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
              Nova compra
            </h2>
            <PurchaseForm action={createPurchaseAction} products={productOptions} />
          </div>
        </section>

        <section aria-labelledby="purchase-list-heading" className="pb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="purchase-list-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
              Compras recentes
            </h2>
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
              {purchaseItems.length}/{recentPurchasesLimit}
            </span>
          </div>
          <p className="mb-3 text-sm text-zinc-600">
            Mostrando {purchaseItems.length} das ultimas {recentPurchasesLimit} compras para manter a tela rapida.
          </p>
          <PurchaseList purchases={purchaseItems} />
        </section>
      </div>
    </main>
  );
}
