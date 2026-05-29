import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import {
  createDemoTimestamp,
  demoExpenses,
  demoProducts,
  demoPurchases,
  demoSales,
} from "../../../prisma/demo-seed-data.mjs";

type ResetOptions = {
  seedDemo?: boolean;
};

export type E2EProductSeed = {
  currentStock?: number;
  minimumStock?: number;
  name: string;
  salePriceCents?: number;
  unitCostCents?: number;
};

export type E2EProductFinancialState = {
  currentStock: number;
  saleItemCount: number;
  saleMovementCount: number;
  totalCostCents: number;
  totalRevenueCents: number;
  totalSaleMovementQuantity: number;
  totalSoldQuantity: number;
};

export type E2EProductCreationState = {
  adjustmentMovementCount: number;
  currentStock: number;
  minimumStock: number;
  productCount: number;
  salePriceCents: number;
  totalAdjustmentQuantity: number;
  unit: string | null;
  unitCostCents: number;
};

export type E2EAiDemoFinancialState = {
  cancellationEventCount: number;
  confirmedExpenseCents: number;
  confirmedExpenseCount: number;
  currentStock: number;
  grossProfitCents: number;
  initialStockAdjustmentMovementCount: number;
  lossMovementCount: number;
  netProfitCents: number;
  productCount: number;
  purchaseCount: number;
  purchaseMovementCount: number;
  reversalMovementCount: number;
  saleCount: number;
  saleItemCount: number;
  saleMovementCount: number;
  stockLossCount: number;
  totalInitialStockAdjustmentQuantity: number;
  totalLossMovementQuantity: number;
  totalPurchaseCostCents: number;
  totalPurchasedQuantity: number;
  totalSaleCostCents: number;
  totalSaleRevenueCents: number;
  totalSoldQuantity: number;
  totalStockLossCostCents: number;
  totalStockLossQuantity: number;
};

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL ?? "file:./tests/e2e/.tmp/playwright-e2e.db";

export async function resetE2EDatabase({ seedDemo = false }: ResetOptions = {}): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: e2eDatabaseUrl }),
  });

  try {
    await clearDatabase(prisma);

    if (seedDemo) {
      await seedDemoDatabase(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function seedE2EProducts(products: E2EProductSeed[]): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: e2eDatabaseUrl }),
  });

  try {
    for (const product of products) {
      const currentStock = product.currentStock ?? 10;
      const created = await prisma.product.create({
        data: {
          currentStock: currentStock.toString(),
          minimumStock: (product.minimumStock ?? 2).toString(),
          name: product.name,
          normalizedName: normalizeProductName(product.name),
          salePriceCents: product.salePriceCents ?? 800,
          unit: "UNIT",
          unitCostCents: product.unitCostCents ?? 400,
        },
      });

      if (currentStock > 0) {
        await prisma.stockMovement.create({
          data: {
            productId: created.id,
            quantity: currentStock.toString(),
            reason: "E2E_INITIAL_STOCK",
            type: "ADJUSTMENT",
          },
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function getE2EProductFinancialState(productName: string): Promise<E2EProductFinancialState> {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: e2eDatabaseUrl }),
  });

  try {
    const product = await prisma.product.findFirst({
      select: {
        currentStock: true,
        saleItems: {
          select: {
            quantity: true,
            totalAmountCents: true,
            totalCostCents: true,
          },
          where: {
            sale: {
              cancelledAt: null,
            },
          },
        },
        stockMovements: {
          select: {
            quantity: true,
            type: true,
          },
          where: {
            type: "SALE",
          },
        },
      },
      where: {
        name: productName,
      },
    });

    if (!product) {
      throw new Error(`Produto E2E nao encontrado: ${productName}`);
    }

    return {
      currentStock: Number(product.currentStock),
      saleItemCount: product.saleItems.length,
      saleMovementCount: product.stockMovements.length,
      totalCostCents: product.saleItems.reduce((total, item) => total + item.totalCostCents, 0),
      totalRevenueCents: product.saleItems.reduce((total, item) => total + item.totalAmountCents, 0),
      totalSaleMovementQuantity: product.stockMovements.reduce(
        (total, movement) => total + Number(movement.quantity),
        0,
      ),
      totalSoldQuantity: product.saleItems.reduce((total, item) => total + Number(item.quantity), 0),
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getE2EProductCreationState(productName: string): Promise<E2EProductCreationState> {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: e2eDatabaseUrl }),
  });

  try {
    const normalizedTarget = normalizeProductName(productName);
    const products = await prisma.product.findMany({
      select: {
        currentStock: true,
        minimumStock: true,
        name: true,
        salePriceCents: true,
        stockMovements: {
          select: {
            quantity: true,
            type: true,
          },
          where: {
            type: "ADJUSTMENT",
          },
        },
        unit: true,
        unitCostCents: true,
      },
    });
    const matchingProducts = products.filter((product) => normalizeProductName(product.name) === normalizedTarget);

    return {
      adjustmentMovementCount: matchingProducts.reduce(
        (total, product) => total + product.stockMovements.length,
        0,
      ),
      currentStock: matchingProducts.reduce((total, product) => total + Number(product.currentStock), 0),
      minimumStock: matchingProducts.reduce((total, product) => total + Number(product.minimumStock), 0),
      productCount: matchingProducts.length,
      salePriceCents: matchingProducts.reduce((total, product) => total + product.salePriceCents, 0),
      totalAdjustmentQuantity: matchingProducts.reduce(
        (total, product) =>
          total + product.stockMovements.reduce((movementTotal, movement) => movementTotal + Number(movement.quantity), 0),
        0,
      ),
      unit: matchingProducts.length === 1 ? matchingProducts[0].unit : null,
      unitCostCents: matchingProducts.reduce((total, product) => total + product.unitCostCents, 0),
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getE2EAiDemoFinancialState(productName: string): Promise<E2EAiDemoFinancialState> {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: e2eDatabaseUrl }),
  });

  try {
    const normalizedTarget = normalizeProductName(productName);
    const [products, confirmedExpenses, cancellationEventCount] = await Promise.all([
      prisma.product.findMany({
        include: {
          purchases: {
            select: {
              quantity: true,
              totalCostCents: true,
            },
            where: {
              cancelledAt: null,
            },
          },
          saleItems: {
            select: {
              quantity: true,
              saleId: true,
              totalAmountCents: true,
              totalCostCents: true,
            },
            where: {
              sale: {
                cancelledAt: null,
              },
            },
          },
          stockLosses: {
            select: {
              quantity: true,
              totalCostCents: true,
            },
            where: {
              cancelledAt: null,
            },
          },
          stockMovements: {
            select: {
              quantity: true,
              reason: true,
              type: true,
            },
          },
        },
      }),
      prisma.expense.findMany({
        select: {
          amountCents: true,
        },
        where: {
          cancelledAt: null,
          confirmed: true,
        },
      }),
      prisma.cancellationEvent.count(),
    ]);
    const matchingProducts = products.filter((product) => normalizeProductName(product.name) === normalizedTarget);
    const saleIds = new Set<string>();
    const currentStock = matchingProducts.reduce((total, product) => total + Number(product.currentStock), 0);
    const totalPurchaseCostCents = matchingProducts.reduce(
      (total, product) => total + product.purchases.reduce((purchaseTotal, purchase) => purchaseTotal + purchase.totalCostCents, 0),
      0,
    );
    const totalPurchasedQuantity = matchingProducts.reduce(
      (total, product) =>
        total + product.purchases.reduce((purchaseTotal, purchase) => purchaseTotal + Number(purchase.quantity), 0),
      0,
    );
    const totalSaleRevenueCents = matchingProducts.reduce(
      (total, product) =>
        total + product.saleItems.reduce((saleTotal, saleItem) => saleTotal + saleItem.totalAmountCents, 0),
      0,
    );
    const totalSaleCostCents = matchingProducts.reduce(
      (total, product) =>
        total + product.saleItems.reduce((saleTotal, saleItem) => saleTotal + saleItem.totalCostCents, 0),
      0,
    );
    const totalSoldQuantity = matchingProducts.reduce(
      (total, product) =>
        total + product.saleItems.reduce((saleTotal, saleItem) => saleTotal + Number(saleItem.quantity), 0),
      0,
    );
    const confirmedExpenseCents = confirmedExpenses.reduce(
      (total, expense) => total + expense.amountCents,
      0,
    );
    const totalStockLossCostCents = matchingProducts.reduce(
      (total, product) =>
        total + product.stockLosses.reduce((lossTotal, stockLoss) => lossTotal + stockLoss.totalCostCents, 0),
      0,
    );
    const totalStockLossQuantity = matchingProducts.reduce(
      (total, product) =>
        total + product.stockLosses.reduce((lossTotal, stockLoss) => lossTotal + Number(stockLoss.quantity), 0),
      0,
    );

    for (const product of matchingProducts) {
      for (const saleItem of product.saleItems) {
        saleIds.add(saleItem.saleId);
      }
    }

    return {
      cancellationEventCount,
      confirmedExpenseCents,
      confirmedExpenseCount: confirmedExpenses.length,
      currentStock,
      grossProfitCents: totalSaleRevenueCents - totalSaleCostCents,
      initialStockAdjustmentMovementCount: matchingProducts.reduce(
        (total, product) =>
          total +
          product.stockMovements.filter(
            (movement) => movement.type === "ADJUSTMENT" && movement.reason === "INITIAL_STOCK",
          ).length,
        0,
      ),
      lossMovementCount: matchingProducts.reduce(
        (total, product) => total + product.stockMovements.filter((movement) => movement.type === "LOSS").length,
        0,
      ),
      netProfitCents: totalSaleRevenueCents - totalSaleCostCents - confirmedExpenseCents,
      productCount: matchingProducts.length,
      purchaseCount: matchingProducts.reduce((total, product) => total + product.purchases.length, 0),
      purchaseMovementCount: matchingProducts.reduce(
        (total, product) =>
          total + product.stockMovements.filter((movement) => movement.type === "PURCHASE").length,
        0,
      ),
      reversalMovementCount: matchingProducts.reduce(
        (total, product) => total + product.stockMovements.filter((movement) => movement.type === "REVERSAL").length,
        0,
      ),
      saleCount: saleIds.size,
      saleItemCount: matchingProducts.reduce((total, product) => total + product.saleItems.length, 0),
      saleMovementCount: matchingProducts.reduce(
        (total, product) => total + product.stockMovements.filter((movement) => movement.type === "SALE").length,
        0,
      ),
      stockLossCount: matchingProducts.reduce((total, product) => total + product.stockLosses.length, 0),
      totalInitialStockAdjustmentQuantity: matchingProducts.reduce(
        (total, product) =>
          total +
          product.stockMovements
            .filter((movement) => movement.type === "ADJUSTMENT" && movement.reason === "INITIAL_STOCK")
            .reduce((movementTotal, movement) => movementTotal + Number(movement.quantity), 0),
        0,
      ),
      totalLossMovementQuantity: matchingProducts.reduce(
        (total, product) =>
          total +
          product.stockMovements
            .filter((movement) => movement.type === "LOSS")
            .reduce((movementTotal, movement) => movementTotal + Number(movement.quantity), 0),
        0,
      ),
      totalPurchaseCostCents,
      totalPurchasedQuantity,
      totalSaleCostCents,
      totalSaleRevenueCents,
      totalSoldQuantity,
      totalStockLossCostCents,
      totalStockLossQuantity,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function clearDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.stockMovement.deleteMany();
  await prisma.cancellationEvent.deleteMany();
  await prisma.stockLoss.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.product.deleteMany();
}

async function seedDemoDatabase(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  const productIdsByKey = new Map<string, string>();

  for (const product of demoProducts) {
    const created = await prisma.product.create({
      data: {
        active: product.active,
        category: product.category,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
        name: product.name,
        normalizedName: normalizeProductName(product.name),
        salePriceCents: product.salePriceCents,
        unit: product.unit,
        unitCostCents: product.unitCostCents,
      },
    });

    productIdsByKey.set(product.key, created.id);
  }

  for (const purchase of demoPurchases) {
    const productId = productIdsByKey.get(purchase.productKey);

    if (!productId) {
      throw new Error(`Produto demo nao encontrado: ${purchase.productKey}`);
    }

    const created = await prisma.purchase.create({
      data: {
        createdAt: minutesAgo(now, purchase.minutesAgo),
        productId,
        quantity: purchase.quantity.toString(),
        supplier: purchase.supplier,
        totalCostCents: purchase.totalCostCents,
        unitCostCents: purchase.unitCostCents,
      },
    });

    await prisma.stockMovement.create({
      data: {
        createdAt: minutesAgo(now, purchase.minutesAgo),
        productId,
        purchaseId: created.id,
        quantity: purchase.quantity.toString(),
        reason: purchase.reason,
        type: "PURCHASE",
      },
    });
  }

  for (const sale of demoSales) {
    const createdSale = await prisma.sale.create({
      data: {
        soldAt: minutesAgo(now, sale.minutesAgo),
        totalAmountCents: sale.totalAmountCents,
      },
    });

    for (const item of sale.items) {
      const productId = productIdsByKey.get(item.productKey);

      if (!productId) {
        throw new Error(`Produto demo nao encontrado: ${item.productKey}`);
      }

      const createdItem = await prisma.saleItem.create({
        data: {
          productId,
          quantity: item.quantity.toString(),
          saleId: createdSale.id,
          totalAmountCents: item.totalAmountCents,
          totalCostCents: item.totalCostCents,
          unitCostSnapshotCents: item.unitCostSnapshotCents,
          unitPriceCents: item.unitPriceCents,
        },
      });

      await prisma.stockMovement.create({
        data: {
          createdAt: minutesAgo(now, sale.minutesAgo),
          productId,
          quantity: item.quantity.toString(),
          reason: "Venda demo",
          saleItemId: createdItem.id,
          type: "SALE",
        },
      });
    }
  }

  for (const expense of demoExpenses) {
    await prisma.expense.create({
      data: {
        amountCents: expense.amountCents,
        category: expense.category,
        confirmed: expense.confirmed,
        description: expense.description,
        paidAt: minutesAgo(now, expense.minutesAgo),
      },
    });
  }
}

function minutesAgo(now: Date, minutes: number): Date {
  return createDemoTimestamp(now, minutes);
}

function normalizeProductName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
