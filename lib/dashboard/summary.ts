import { generateFinancialSummary, hasLowStock, type FinancialSummary, type PeriodInput } from "@/lib/finance";
import { getDashboardPeriods, type DashboardPeriods } from "./periods";

export type DashboardSaleRecord = {
  id: string;
  soldAt: Date;
  totalAmountCents: number;
  items: {
    quantity: number;
    unitPriceCents: number;
    unitCostSnapshotCents: number;
    totalAmountCents: number;
    totalCostCents: number;
  }[];
};

export type DashboardExpenseRecord = {
  id: string;
  paidAt: Date;
  amountCents: number;
  confirmed: boolean;
};

export type DashboardProductRecord = {
  id: string;
  name: string;
  currentStock: number;
  minimumStock: number;
  active: boolean;
};

export type DashboardLowStockProduct = {
  id: string;
  name: string;
  currentStock: number;
  minimumStock: number;
};

export type DashboardPeriodSummary = FinancialSummary & {
  salesCount: number;
};

export type DashboardSummary = {
  periods: DashboardPeriods;
  today: DashboardPeriodSummary;
  month: DashboardPeriodSummary;
  lowStockProducts: DashboardLowStockProduct[];
};

export type DashboardSummaryInput = {
  now?: Date;
  sales: readonly DashboardSaleRecord[];
  expenses: readonly DashboardExpenseRecord[];
  products: readonly DashboardProductRecord[];
  lowStockLimit?: number;
};

export async function getDashboardSummary(now = new Date()): Promise<DashboardSummary> {
  const periods = getDashboardPeriods(now);
  const { prisma } = await import("@/lib/db/prisma");

  const [sales, expenses, products] = await Promise.all([
    prisma.sale.findMany({
      where: {
        cancelledAt: null,
        soldAt: {
          gte: periods.month.start,
          lte: periods.month.end,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        soldAt: "desc",
      },
    }),
    prisma.expense.findMany({
      where: {
        cancelledAt: null,
        paidAt: {
          gte: periods.month.start,
          lte: periods.month.end,
        },
      },
      orderBy: {
        paidAt: "desc",
      },
    }),
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        currentStock: true,
        minimumStock: true,
        active: true,
      },
    }),
  ]);

  return buildDashboardSummary({
    now,
    sales: sales.map((sale) => ({
      id: sale.id,
      soldAt: sale.soldAt,
      totalAmountCents: sale.totalAmountCents,
      items: sale.items.map((item) => ({
        quantity: Number(item.quantity),
        unitPriceCents: item.unitPriceCents,
        unitCostSnapshotCents: item.unitCostSnapshotCents,
        totalAmountCents: item.totalAmountCents,
        totalCostCents: item.totalCostCents,
      })),
    })),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      paidAt: expense.paidAt,
      amountCents: expense.amountCents,
      confirmed: expense.confirmed,
    })),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      currentStock: Number(product.currentStock),
      minimumStock: Number(product.minimumStock),
      active: product.active,
    })),
  });
}

export function buildDashboardSummary({
  now = new Date(),
  sales,
  expenses,
  products,
  lowStockLimit = 5,
}: DashboardSummaryInput): DashboardSummary {
  const periods = getDashboardPeriods(now);

  return {
    periods,
    today: buildPeriodSummary({ period: periods.today, sales, expenses, products }),
    month: buildPeriodSummary({ period: periods.month, sales, expenses, products }),
    lowStockProducts: getLowStockProducts(products).slice(0, lowStockLimit),
  };
}

function buildPeriodSummary({
  period,
  sales,
  expenses,
  products,
}: {
  period: PeriodInput;
  sales: readonly DashboardSaleRecord[];
  expenses: readonly DashboardExpenseRecord[];
  products: readonly DashboardProductRecord[];
}): DashboardPeriodSummary {
  const summary = generateFinancialSummary({
    period,
    sales: sales.map((sale) => ({
      confirmed: true,
      occurredAt: sale.soldAt,
      items: sale.items,
      totalAmountCents: sale.totalAmountCents,
    })),
    expenses: expenses.map((expense) => ({
      amountCents: expense.amountCents,
      confirmed: expense.confirmed,
      occurredAt: expense.paidAt,
    })),
    stockItems: products.map((product) => ({
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      active: product.active,
    })),
  });

  return {
    ...summary,
    salesCount: countSalesInPeriod(sales, period),
  };
}

function countSalesInPeriod(sales: readonly DashboardSaleRecord[], period: PeriodInput): number {
  return sales.filter((sale) => isWithinPeriod(sale.soldAt, period)).length;
}

function getLowStockProducts(products: readonly DashboardProductRecord[]): DashboardLowStockProduct[] {
  return products
    .filter((product) => product.active && hasLowStock(product))
    .map((product) => ({
      id: product.id,
      name: product.name,
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
    }));
}

function isWithinPeriod(date: Date, period: PeriodInput): boolean {
  const time = date.getTime();

  return time >= period.start.getTime() && time <= period.end.getTime();
}
