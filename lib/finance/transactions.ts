import {
  calculateLineTotalCents,
  validateNonNegativeMoneyCents,
} from "./money";
import { calculateSaleItemTotals } from "./sales";
import { calculateStockAfterPurchase, calculateStockAfterSale } from "./stock";

export type SaleProductSnapshot = {
  id: string;
  active: boolean;
  currentStock: number;
  unitCostCents: number;
  salePriceCents: number;
};

export type PurchaseTransactionInput = {
  currentStock: number;
  quantity: number;
  unitCostCents: number;
};

export type PurchaseTransaction = {
  nextStock: number;
  totalCostCents: number;
  movementQuantity: number;
};

export type SaleTransactionInput = {
  product: SaleProductSnapshot;
  quantity: number;
  unitPriceCents: number | null;
};

export type SaleTransaction = {
  nextStock: number;
  item: {
    productId: string;
    quantity: number;
    unitPriceCents: number;
    unitCostSnapshotCents: number;
    totalAmountCents: number;
    totalCostCents: number;
  };
  movementQuantity: number;
};

export type ExpensePersistenceInput = {
  amountCents: number;
  confirmed: boolean;
};

export function buildPurchaseTransaction({
  currentStock,
  quantity,
  unitCostCents,
}: PurchaseTransactionInput): PurchaseTransaction {
  const totalCostCents = calculateLineTotalCents({
    quantity,
    unitAmountCents: unitCostCents,
    quantityFieldName: "quantidade comprada",
    unitAmountFieldName: "custo por unidade",
  });

  return {
    nextStock: calculateStockAfterPurchase({ currentStock, quantityPurchased: quantity }),
    totalCostCents,
    movementQuantity: quantity,
  };
}

export function buildSaleTransaction({ product, quantity, unitPriceCents }: SaleTransactionInput): SaleTransaction {
  if (!product.active) {
    throw new Error("Produto inativo nao pode ser vendido.");
  }

  const priceCents = validateNonNegativeMoneyCents(
    unitPriceCents ?? product.salePriceCents,
    "preco de venda",
  );
  const unitCostSnapshotCents = validateNonNegativeMoneyCents(product.unitCostCents, "custo do produto");
  const totals = calculateSaleItemTotals({
    quantity,
    unitPriceCents: priceCents,
    unitCostSnapshotCents,
  });

  return {
    nextStock: calculateStockAfterSale({ currentStock: product.currentStock, quantitySold: quantity }),
    item: {
      productId: product.id,
      quantity,
      unitPriceCents: priceCents,
      unitCostSnapshotCents,
      totalAmountCents: totals.revenueCents,
      totalCostCents: totals.costCents,
    },
    movementQuantity: quantity,
  };
}

export function normalizeExpenseForPersistence({
  amountCents,
  confirmed,
}: ExpensePersistenceInput): ExpensePersistenceInput {
  return {
    amountCents: validateNonNegativeMoneyCents(amountCents, "despesa"),
    confirmed,
  };
}
