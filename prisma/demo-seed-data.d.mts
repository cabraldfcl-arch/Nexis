export type DemoProductKey = "refrigerante" | "agua" | "bolo" | "salgado";

export type DemoProduct = {
  key: DemoProductKey;
  name: string;
  category: string;
  unit: "UNIT";
  unitCostCents: number;
  salePriceCents: number;
  currentStock: string;
  minimumStock: string;
  active: boolean;
};

export type DemoPurchase = {
  productKey: DemoProductKey;
  quantity: number;
  unitCostCents: number;
  totalCostCents: number;
  supplier: string;
  minutesAgo: number;
  reason: string;
};

export type DemoSaleItem = {
  productKey: DemoProductKey;
  quantity: number;
  unitPriceCents: number;
  unitCostSnapshotCents: number;
  totalAmountCents: number;
  totalCostCents: number;
};

export type DemoSale = {
  minutesAgo: number;
  totalAmountCents: number;
  items: DemoSaleItem[];
};

export type DemoExpense = {
  description: string;
  category: "RENT" | "UTILITIES" | "TRANSPORT_LOGISTICS" | "PACKAGING_MATERIAL";
  amountCents: number;
  confirmed: boolean;
  minutesAgo: number;
};

export const demoProducts: DemoProduct[];
export const demoPurchases: DemoPurchase[];
export const demoSales: DemoSale[];
export const demoExpenses: DemoExpense[];
export function createDemoTimestamp(now: Date, minutesAgo: number): Date;
export function calculateDemoCurrentStocks(): Record<DemoProductKey, number>;
