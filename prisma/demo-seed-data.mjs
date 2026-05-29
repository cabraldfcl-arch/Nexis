export const demoProducts = [
  {
    key: "refrigerante",
    name: "Refrigerante lata",
    category: "Bebidas",
    unit: "UNIT",
    unitCostCents: 350,
    salePriceCents: 700,
    currentStock: "23",
    minimumStock: "12",
    active: true,
  },
  {
    key: "agua",
    name: "Água mineral",
    category: "Bebidas",
    unit: "UNIT",
    unitCostCents: 100,
    salePriceCents: 300,
    currentStock: "3",
    minimumStock: "10",
    active: true,
  },
  {
    key: "bolo",
    name: "Bolo de pote",
    category: "Doces",
    unit: "UNIT",
    unitCostCents: 450,
    salePriceCents: 1000,
    currentStock: "7",
    minimumStock: "5",
    active: true,
  },
  {
    key: "salgado",
    name: "Salgado assado",
    category: "Salgados",
    unit: "UNIT",
    unitCostCents: 350,
    salePriceCents: 800,
    currentStock: "2",
    minimumStock: "8",
    active: true,
  },
];

export const demoPurchases = [
  {
    productKey: "refrigerante",
    quantity: 30,
    unitCostCents: 350,
    totalCostCents: 10_500,
    supplier: "Distribuidora Demo Bebidas",
    minutesAgo: 260,
    reason: "Compra demo de refrigerantes",
  },
  {
    productKey: "agua",
    quantity: 25,
    unitCostCents: 100,
    totalCostCents: 2_500,
    supplier: "Distribuidora Demo Bebidas",
    minutesAgo: 240,
    reason: "Compra demo de águas",
  },
  {
    productKey: "bolo",
    quantity: 12,
    unitCostCents: 450,
    totalCostCents: 5_400,
    supplier: "Cozinha Parceira Demo",
    minutesAgo: 220,
    reason: "Compra demo de bolos",
  },
  {
    productKey: "salgado",
    quantity: 18,
    unitCostCents: 350,
    totalCostCents: 6_300,
    supplier: "Padaria Demo",
    minutesAgo: 210,
    reason: "Compra demo de salgados",
  },
];

const saleTemplates = [
  {
    minutesAgo: 95,
    items: [
      { productKey: "agua", quantity: 8, unitPriceCents: 300, unitCostSnapshotCents: 100 },
      { productKey: "refrigerante", quantity: 4, unitPriceCents: 700, unitCostSnapshotCents: 350 },
    ],
  },
  {
    minutesAgo: 70,
    items: [
      { productKey: "salgado", quantity: 10, unitPriceCents: 800, unitCostSnapshotCents: 350 },
      { productKey: "bolo", quantity: 2, unitPriceCents: 1000, unitCostSnapshotCents: 450 },
    ],
  },
  {
    minutesAgo: 35,
    items: [
      { productKey: "agua", quantity: 14, unitPriceCents: 300, unitCostSnapshotCents: 100 },
      { productKey: "refrigerante", quantity: 3, unitPriceCents: 700, unitCostSnapshotCents: 350 },
      { productKey: "bolo", quantity: 3, unitPriceCents: 1000, unitCostSnapshotCents: 450 },
      { productKey: "salgado", quantity: 6, unitPriceCents: 800, unitCostSnapshotCents: 350 },
    ],
  },
];

export const demoSales = saleTemplates.map((sale) => {
  const items = sale.items.map((item) => ({
    ...item,
    totalAmountCents: item.quantity * item.unitPriceCents,
    totalCostCents: item.quantity * item.unitCostSnapshotCents,
  }));

  return {
    ...sale,
    items,
    totalAmountCents: items.reduce((total, item) => total + item.totalAmountCents, 0),
  };
});

export const demoExpenses = [
  {
    description: "Energia da lanchonete demo",
    category: "UTILITIES",
    amountCents: 4_500,
    confirmed: true,
    minutesAgo: 180,
  },
  {
    description: "Embalagens para delivery demo",
    category: "PACKAGING_MATERIAL",
    amountCents: 1_800,
    confirmed: true,
    minutesAgo: 150,
  },
  {
    description: "Transporte para reposição demo",
    category: "TRANSPORT_LOGISTICS",
    amountCents: 2_200,
    confirmed: true,
    minutesAgo: 120,
  },
  {
    description: "Aluguel pendente demo",
    category: "RENT",
    amountCents: 12_000,
    confirmed: false,
    minutesAgo: 90,
  },
];

const maxDemoMinutesAgo = Math.max(
  ...demoPurchases.map((purchase) => purchase.minutesAgo),
  ...demoSales.map((sale) => sale.minutesAgo),
  ...demoExpenses.map((expense) => expense.minutesAgo),
);

export function createDemoTimestamp(now, minutesAgo) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const offsetMs = minutesAgo * 60_000;
  const candidate = new Date(now.getTime() - offsetMs);

  if (candidate >= startOfToday) {
    return candidate;
  }

  const elapsedTodayMs = now.getTime() - startOfToday.getTime();

  if (elapsedTodayMs <= 0) {
    return new Date(now);
  }

  const compressionRatio = minutesAgo / maxDemoMinutesAgo;
  const compressedOffsetMs = Math.min(offsetMs, elapsedTodayMs * compressionRatio);

  return new Date(Math.max(startOfToday.getTime(), now.getTime() - compressedOffsetMs));
}

export function calculateDemoCurrentStocks() {
  const stocks = Object.fromEntries(demoProducts.map((product) => [product.key, 0]));

  for (const purchase of demoPurchases) {
    stocks[purchase.productKey] += purchase.quantity;
  }

  for (const sale of demoSales) {
    for (const item of sale.items) {
      stocks[item.productKey] -= item.quantity;
    }
  }

  return stocks;
}
