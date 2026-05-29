import { LowStockList } from "@/components/dashboard/low-stock-list";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SummaryCard, type SummaryCardData } from "@/components/dashboard/summary-card";
import { getDashboardSummary } from "@/lib/dashboard/summary";
import { calculateProfitPercent, formatCentsToBRL } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dashboard = await getDashboardSummary();
  const todayCards = buildTodayCards(dashboard);
  const monthCards = buildMonthCards(dashboard);

  return (
    <main className="min-h-dvh bg-[#f6f7f4] text-zinc-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">NEXT</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Hoje no negócio</h1>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-right shadow-sm">
            <p className="text-xs font-medium text-zinc-500">Status</p>
            <p className="text-sm font-semibold text-zinc-950">Dados reais</p>
          </div>
        </header>

        <section aria-labelledby="actions-heading" className="py-5">
          <div className="mb-3">
            <h2 id="actions-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
              O que voce quer fazer agora?
            </h2>
            <p className="mt-1 text-sm text-zinc-600">Toque em uma acao para registrar o movimento.</p>
          </div>
          <QuickActions />
        </section>

        <section aria-labelledby="today-heading" className="py-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="today-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
                Hoje
              </h2>
              <p className="mt-1 text-sm text-zinc-600">Do inicio do dia ate agora</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {todayCards.map((card) => (
              <SummaryCard card={card} key={card.label} />
            ))}
          </div>
        </section>

        <section aria-labelledby="month-heading" className="pb-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="month-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
                Este mês
              </h2>
              <p className="mt-1 text-sm text-zinc-600">Do primeiro dia do mês ate agora</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {monthCards.map((card) => (
              <SummaryCard card={card} key={card.label} />
            ))}
          </div>
        </section>

        <section aria-labelledby="low-stock-heading" className="pb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="low-stock-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
              Produtos acabando
            </h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              {dashboard.month.lowStockCount}
            </span>
          </div>
          <LowStockList products={dashboard.lowStockProducts} />
        </section>
      </div>
    </main>
  );
}

function buildTodayCards(dashboard: Awaited<ReturnType<typeof getDashboardSummary>>): SummaryCardData[] {
  const profitPercent = calculateProfitPercent({
    profitCents: dashboard.today.netProfitCents,
    revenueCents: dashboard.today.revenueCents,
  });

  return [
    {
      label: "Vendas hoje",
      value: formatCentsToBRL(dashboard.today.revenueCents),
      tone: "revenue",
      helper: formatSalesCount(dashboard.today.salesCount),
    },
    {
      label: "Despesas",
      value: formatCentsToBRL(dashboard.today.confirmedExpensesCents),
      tone: "expense",
      helper: "Confirmadas",
    },
    {
      label: "Lucro líquido",
      value: formatCentsToBRL(dashboard.today.netProfitCents),
      tone: "profit",
      helper: profitPercent === null ? "Depois das despesas" : `${formatPercent(profitPercent)} das vendas`,
    },
  ];
}

function buildMonthCards(dashboard: Awaited<ReturnType<typeof getDashboardSummary>>): SummaryCardData[] {
  const profitPercent = calculateProfitPercent({
    profitCents: dashboard.month.netProfitCents,
    revenueCents: dashboard.month.revenueCents,
  });

  return [
    {
      label: "Vendas no mês",
      value: formatCentsToBRL(dashboard.month.revenueCents),
      tone: "revenue",
      helper: formatSalesCount(dashboard.month.salesCount),
    },
    {
      label: "Lucro bruto",
      value: formatCentsToBRL(dashboard.month.grossProfitCents),
      tone: "profit",
      helper: "Venda menos custo",
    },
    {
      label: "Despesas",
      value: formatCentsToBRL(dashboard.month.confirmedExpensesCents),
      tone: "expense",
      helper: "Confirmadas",
    },
    {
      label: "Lucro líquido",
      value: formatCentsToBRL(dashboard.month.netProfitCents),
      tone: "profit",
      helper: profitPercent === null ? "Lucro bruto menos despesas" : `${formatPercent(profitPercent)} das vendas`,
    },
    {
      label: "Produtos acabando",
      value: String(dashboard.month.lowStockCount),
      tone: "stock",
      helper: "Ativos abaixo do mínimo",
    },
  ];
}

function formatSalesCount(value: number): string {
  if (value === 1) {
    return "1 venda";
  }

  return `${value} vendas`;
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}
