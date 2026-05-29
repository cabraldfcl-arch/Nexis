import {
  calculateConfirmedExpensesCents,
  calculateGrossProfitCents,
  calculateNetProfitCents,
  calculatePendingExpensesCents,
} from "./profit";
import {
  calculateCostOfGoodsSoldCents,
  calculateRevenueCents,
  calculateSaleItemTotals,
  type SaleInput,
} from "./sales";
import { countLowStockProducts, hasLowStock, type StockProductInput } from "./stock";
import type { ExpenseInput } from "./profit";
import {
  calculateLineTotalCents,
  sumMoneyCents,
  validateIntegerMoneyCents,
  validateNonNegativeMoneyCents,
  validateQuantity,
  type MoneyCents,
} from "./money";

export type PeriodInput = {
  start: Date;
  end: Date;
};

export type FinancialReportSale = SaleInput & {
  occurredAt: Date;
};

export type FinancialReportExpense = ExpenseInput & {
  occurredAt: Date;
};

export type FinancialSummaryInput = {
  period: PeriodInput;
  sales: readonly FinancialReportSale[];
  expenses: readonly FinancialReportExpense[];
  stockItems: readonly StockProductInput[];
};

export type FinancialSummary = {
  revenueCents: MoneyCents;
  costOfGoodsSoldCents: MoneyCents;
  grossProfitCents: MoneyCents;
  confirmedExpensesCents: MoneyCents;
  pendingExpensesCents: MoneyCents;
  netProfitCents: MoneyCents;
  lowStockCount: number;
};

export type InventoryProductInput = StockProductInput & {
  id: string;
  name: string;
};

export type InventoryProductSummary = {
  id: string;
  name: string;
  currentStock: number;
  minimumStock: number;
};

export type InventoryReport = {
  products: InventoryProductSummary[];
  lowStockProducts: InventoryProductSummary[];
  totalActiveProducts: number;
  lowStockCount: number;
};

export type PurchaseReportRecord = {
  productName: string;
  purchasedAt: Date;
  quantity: number;
  unitCostCents: MoneyCents;
  totalCostCents: MoneyCents;
  supplier?: string | null;
};

export type PurchaseReportInput = {
  period: PeriodInput;
  purchases: readonly PurchaseReportRecord[];
  limit?: number;
};

export type PurchaseReport = {
  count: number;
  totalCostCents: MoneyCents;
  items: PurchaseReportRecord[];
};

export type TopProductSaleItemInput = {
  occurredAt: Date;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: MoneyCents;
  unitCostSnapshotCents: MoneyCents;
  totalAmountCents?: MoneyCents;
  totalCostCents?: MoneyCents;
};

export type TopProductSummary = {
  productId: string;
  productName: string;
  quantity: number;
  revenueCents: MoneyCents;
  costCents: MoneyCents;
  grossProfitCents: MoneyCents;
};

export type TopProductsReportInput = {
  period: PeriodInput;
  saleItems: readonly TopProductSaleItemInput[];
  limit?: number;
};

export type TopProductsReport = {
  items: TopProductSummary[];
};

export function generateFinancialSummary({
  period,
  sales,
  expenses,
  stockItems,
}: FinancialSummaryInput): FinancialSummary {
  const validPeriod = validatePeriod(period);
  const periodSales = filterByPeriod(sales, validPeriod, "venda");
  const periodExpenses = filterByPeriod(expenses, validPeriod, "despesa");
  const revenueCents = calculateRevenueCents(periodSales);
  const costOfGoodsSoldCents = calculateCostOfGoodsSoldCents(periodSales);
  const grossProfitCents = calculateGrossProfitCents({ revenueCents, costOfGoodsSoldCents });
  const confirmedExpensesCents = calculateConfirmedExpensesCents(periodExpenses);
  const pendingExpensesCents = calculatePendingExpensesCents(periodExpenses);
  const netProfitCents = calculateNetProfitCents({ grossProfitCents, confirmedExpensesCents });
  const lowStockCount = countLowStockProducts(stockItems);

  return {
    revenueCents,
    costOfGoodsSoldCents,
    grossProfitCents,
    confirmedExpensesCents,
    pendingExpensesCents,
    netProfitCents,
    lowStockCount,
  };
}

export function summarizeInventory(products: readonly InventoryProductInput[]): InventoryReport {
  if (!Array.isArray(products)) {
    throw new Error("produtos de estoque devem ser uma lista.");
  }

  const activeProducts = products
    .filter((product) => product.active !== false)
    .map((product) => normalizeInventoryProduct(product));
  const lowStockProducts = activeProducts.filter((product) => hasLowStock(product));

  return {
    products: activeProducts,
    lowStockProducts,
    totalActiveProducts: activeProducts.length,
    lowStockCount: lowStockProducts.length,
  };
}

export function summarizePurchases({
  period,
  purchases,
  limit = 5,
}: PurchaseReportInput): PurchaseReport {
  const validPeriod = validatePeriod(period);
  const periodPurchases = filterPurchasesByPeriod(purchases, validPeriod)
    .map((purchase) => normalizePurchaseRecord(purchase))
    .sort((left, right) => right.purchasedAt.getTime() - left.purchasedAt.getTime());

  return {
    count: periodPurchases.length,
    totalCostCents: sumMoneyCents(
      periodPurchases.map((purchase) => purchase.totalCostCents),
      "compras",
    ),
    items: periodPurchases.slice(0, validateLimit(limit)),
  };
}

export function summarizeTopProducts({
  period,
  saleItems,
  limit = 5,
}: TopProductsReportInput): TopProductsReport {
  const validPeriod = validatePeriod(period);
  const grouped = new Map<string, TopProductSummary>();

  for (const item of filterByPeriod(saleItems, validPeriod, "item de venda")) {
    const normalized = normalizeTopProductSaleItem(item);
    const totals = calculateSaleItemTotals(normalized);
    const existing = grouped.get(normalized.productId) ?? {
      productId: normalized.productId,
      productName: normalized.productName,
      quantity: 0,
      revenueCents: 0,
      costCents: 0,
      grossProfitCents: 0,
    };
    const revenueCents = sumMoneyCents([existing.revenueCents, totals.revenueCents], "faturamento por produto");
    const costCents = sumMoneyCents([existing.costCents, totals.costCents], "custo por produto");

    grouped.set(normalized.productId, {
      productId: normalized.productId,
      productName: normalized.productName,
      quantity: validateQuantity(existing.quantity + normalized.quantity, "quantidade vendida por produto"),
      revenueCents,
      costCents,
      grossProfitCents: validateIntegerMoneyCents(revenueCents - costCents, "lucro bruto por produto"),
    });
  }

  return {
    items: [...grouped.values()]
      .sort(
        (left, right) =>
          right.quantity - left.quantity ||
          right.revenueCents - left.revenueCents ||
          left.productName.localeCompare(right.productName, "pt-BR"),
      )
      .slice(0, validateLimit(limit)),
  };
}

function normalizeInventoryProduct(product: InventoryProductInput): InventoryProductSummary {
  const id = validateNonEmptyString(product.id, "id do produto");
  const name = validateNonEmptyString(product.name, "nome do produto");

  return {
    id,
    name,
    currentStock: validateQuantity(product.currentStock, "estoque atual"),
    minimumStock: validateQuantity(product.minimumStock, "estoque minimo"),
  };
}

function normalizePurchaseRecord(purchase: PurchaseReportRecord): PurchaseReportRecord {
  const quantity = validateQuantity(purchase.quantity, "quantidade comprada");
  const unitCostCents = validateNonNegativeMoneyCents(purchase.unitCostCents, "custo unitario da compra");
  const totalCostCents = validateNonNegativeMoneyCents(purchase.totalCostCents, "total da compra");
  const calculatedTotalCostCents = calculateLineTotalCents({
    quantity,
    unitAmountCents: unitCostCents,
    quantityFieldName: "quantidade comprada",
    unitAmountFieldName: "custo unitario da compra",
  });

  if (totalCostCents !== calculatedTotalCostCents) {
    throw new Error(
      `total da compra inconsistente: esperado ${calculatedTotalCostCents} centavos e recebido ${totalCostCents} centavos.`,
    );
  }

  return {
    productName: validateNonEmptyString(purchase.productName, "nome do produto"),
    purchasedAt: validateDate(purchase.purchasedAt, "data da compra"),
    quantity,
    unitCostCents,
    totalCostCents,
    supplier: purchase.supplier ?? null,
  };
}

function normalizeTopProductSaleItem(item: TopProductSaleItemInput): TopProductSaleItemInput {
  return {
    occurredAt: validateDate(item.occurredAt, "data do item de venda"),
    productId: validateNonEmptyString(item.productId, "id do produto"),
    productName: validateNonEmptyString(item.productName, "nome do produto"),
    quantity: validateQuantity(item.quantity, "quantidade vendida"),
    totalAmountCents: item.totalAmountCents,
    totalCostCents: item.totalCostCents,
    unitCostSnapshotCents: validateNonNegativeMoneyCents(item.unitCostSnapshotCents, "custo unitario snapshot"),
    unitPriceCents: validateNonNegativeMoneyCents(item.unitPriceCents, "preco unitario da venda"),
  };
}

function validateNonEmptyString(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} deve ser informado.`);
  }

  return value.trim();
}

function validateLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("limite do relatorio deve ser inteiro positivo.");
  }

  return value;
}

function validatePeriod(period: PeriodInput): PeriodInput {
  const start = validateDate(period.start, "inicio do periodo");
  const end = validateDate(period.end, "fim do periodo");

  if (start.getTime() > end.getTime()) {
    throw new Error("periodo invalido: inicio nao pode ser depois do fim.");
  }

  return { start, end };
}

function validateDate(date: Date, fieldName: string): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} deve ser uma data valida.`);
  }

  return date;
}

function filterByPeriod<T extends { occurredAt: Date }>(
  items: readonly T[],
  period: PeriodInput,
  itemName: string,
): T[] {
  if (!Array.isArray(items)) {
    throw new Error(`${itemName} deve receber uma lista.`);
  }

  return items.filter((item) => {
    const occurredAt = validateDate(item.occurredAt, `data da ${itemName}`);
    const time = occurredAt.getTime();

    return time >= period.start.getTime() && time <= period.end.getTime();
  });
}

function filterPurchasesByPeriod(
  purchases: readonly PurchaseReportRecord[],
  period: PeriodInput,
): PurchaseReportRecord[] {
  if (!Array.isArray(purchases)) {
    throw new Error("compra deve receber uma lista.");
  }

  return purchases.filter((purchase) => {
    const purchasedAt = validateDate(purchase.purchasedAt, "data da compra");
    const time = purchasedAt.getTime();

    return time >= period.start.getTime() && time <= period.end.getTime();
  });
}
