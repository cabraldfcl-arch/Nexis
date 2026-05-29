import {
  calculateLineTotalCents,
  sumMoneyCents,
  validateIntegerMoneyCents,
  validateNonNegativeMoneyCents,
  type MoneyCents,
} from "./money";

export type SaleItemInput = {
  quantity: number;
  unitPriceCents: MoneyCents;
  unitCostSnapshotCents: MoneyCents;
  totalAmountCents?: MoneyCents;
  totalCostCents?: MoneyCents;
};

export type SaleInput = {
  confirmed: boolean;
  items: readonly SaleItemInput[];
  totalAmountCents?: MoneyCents;
};

export type SaleItemTotals = {
  revenueCents: MoneyCents;
  costCents: MoneyCents;
};

export type SaleItemProfitMetrics = {
  unitProfitCents: MoneyCents;
  grossProfitCents: MoneyCents;
  marginPercent: number | null;
  markupMultiplier: number | null;
  belowCost: boolean;
};

export type ProfitPercentInput = {
  profitCents: MoneyCents;
  revenueCents: MoneyCents;
};

export function calculateSaleItemTotals(item: SaleItemInput): SaleItemTotals {
  const revenueCents = calculateLineTotalCents({
    quantity: item.quantity,
    unitAmountCents: item.unitPriceCents,
    quantityFieldName: "quantidade vendida",
    unitAmountFieldName: "preco unitario da venda",
  });
  const costCents = calculateLineTotalCents({
    quantity: item.quantity,
    unitAmountCents: item.unitCostSnapshotCents,
    quantityFieldName: "quantidade vendida",
    unitAmountFieldName: "custo unitario snapshot",
  });

  if (item.totalAmountCents !== undefined) {
    const totalAmountCents = validateNonNegativeMoneyCents(item.totalAmountCents, "total da venda");

    if (totalAmountCents !== revenueCents) {
      throw new Error(
        `total da venda inconsistente: esperado ${revenueCents} centavos e recebido ${totalAmountCents} centavos.`,
      );
    }
  }

  if (item.totalCostCents !== undefined) {
    const totalCostCents = validateNonNegativeMoneyCents(item.totalCostCents, "total do custo da venda");

    if (totalCostCents !== costCents) {
      throw new Error(
        `total do custo da venda inconsistente: esperado ${costCents} centavos e recebido ${totalCostCents} centavos.`,
      );
    }
  }

  return { revenueCents, costCents };
}

export function calculateSaleItemProfitMetrics(item: SaleItemInput): SaleItemProfitMetrics {
  const unitPriceCents = validateNonNegativeMoneyCents(item.unitPriceCents, "preco unitario da venda");
  const unitCostSnapshotCents = validateNonNegativeMoneyCents(
    item.unitCostSnapshotCents,
    "custo unitario snapshot",
  );
  const { revenueCents, costCents } = calculateSaleItemTotals(item);
  const unitProfitCents = validateIntegerMoneyCents(
    unitPriceCents - unitCostSnapshotCents,
    "lucro unitario da venda",
  );
  const grossProfitCents = validateIntegerMoneyCents(revenueCents - costCents, "lucro bruto da venda");

  return {
    unitProfitCents,
    grossProfitCents,
    marginPercent: unitPriceCents === 0 ? null : (unitProfitCents / unitPriceCents) * 100,
    markupMultiplier: unitCostSnapshotCents === 0 ? null : unitPriceCents / unitCostSnapshotCents,
    belowCost: unitProfitCents < 0,
  };
}

export function calculateProfitPercent({ profitCents, revenueCents }: ProfitPercentInput): number | null {
  const profit = validateIntegerMoneyCents(profitCents, "lucro");
  const revenue = validateNonNegativeMoneyCents(revenueCents, "faturamento");

  if (revenue === 0) {
    return null;
  }

  return (profit / revenue) * 100;
}

export function calculateSaleTotalCents(sale: SaleInput): MoneyCents {
  const itemRevenue = validateSaleItems(sale).map((item) => calculateSaleItemTotals(item).revenueCents);
  const totalCents = sumMoneyCents(itemRevenue, "total da venda");

  if (sale.totalAmountCents !== undefined) {
    const declaredTotal = validateNonNegativeMoneyCents(sale.totalAmountCents, "total da venda");

    if (declaredTotal !== totalCents) {
      throw new Error(
        `total da venda inconsistente: esperado ${totalCents} centavos e recebido ${declaredTotal} centavos.`,
      );
    }
  }

  return totalCents;
}

export function calculateSaleCostCents(sale: SaleInput): MoneyCents {
  const itemCosts = validateSaleItems(sale).map((item) => calculateSaleItemTotals(item).costCents);

  return sumMoneyCents(itemCosts, "custo das vendas");
}

export function calculateRevenueCents(sales: readonly SaleInput[]): MoneyCents {
  return sumConfirmedSales(sales, calculateSaleTotalCents, "faturamento");
}

export function calculateCostOfGoodsSoldCents(sales: readonly SaleInput[]): MoneyCents {
  return sumConfirmedSales(sales, calculateSaleCostCents, "custo das vendas");
}

function sumConfirmedSales(
  sales: readonly SaleInput[],
  calculate: (sale: SaleInput) => MoneyCents,
  fieldName: string,
): MoneyCents {
  if (!Array.isArray(sales)) {
    throw new Error(`${fieldName} deve receber uma lista de vendas.`);
  }

  const values = sales.map((sale) => {
    if (typeof sale.confirmed !== "boolean") {
      throw new Error("venda deve informar se esta confirmada.");
    }

    const value = calculate(sale);

    return sale.confirmed ? value : 0;
  });

  return sumMoneyCents(values, fieldName);
}

function validateSaleItems(sale: SaleInput): readonly SaleItemInput[] {
  if (!Array.isArray(sale.items) || sale.items.length === 0) {
    throw new Error("venda deve ter ao menos um item.");
  }

  return sale.items;
}
