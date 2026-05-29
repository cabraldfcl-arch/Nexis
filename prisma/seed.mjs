import {
  ExpenseCategory,
  PrismaClient,
  ProductUnit,
  StockMovementType,
} from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  demoExpenses,
  demoProducts,
  demoPurchases,
  demoSales,
  createDemoTimestamp,
} from "./demo-seed-data.mjs";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const seedNow = new Date();

function minutesAgo(minutes) {
  return createDemoTimestamp(seedNow, minutes);
}

async function clearDemoData() {
  await prisma.stockMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.product.deleteMany();
}

async function seedProducts() {
  const productsByKey = new Map();

  for (const product of demoProducts) {
    const createdProduct = await prisma.product.create({
      data: {
        name: product.name,
        normalizedName: normalizeProductName(product.name),
        category: product.category,
        unit: ProductUnit[product.unit],
        unitCostCents: product.unitCostCents,
        salePriceCents: product.salePriceCents,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
        active: product.active,
      },
    });

    productsByKey.set(product.key, createdProduct);
  }

  return productsByKey;
}

async function seedPurchases(productsByKey) {
  for (const purchase of demoPurchases) {
    const product = getProduct(productsByKey, purchase.productKey);
    const createdPurchase = await prisma.purchase.create({
      data: {
        productId: product.id,
        quantity: String(purchase.quantity),
        unitCostCents: purchase.unitCostCents,
        totalCostCents: purchase.totalCostCents,
        supplier: purchase.supplier,
        purchasedAt: minutesAgo(purchase.minutesAgo),
      },
    });

    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: StockMovementType.PURCHASE,
        quantity: String(purchase.quantity),
        reason: purchase.reason,
        purchaseId: createdPurchase.id,
        createdAt: createdPurchase.purchasedAt,
      },
    });
  }
}

async function seedSales(productsByKey) {
  for (const sale of demoSales) {
    const soldAt = minutesAgo(sale.minutesAgo);

    await prisma.sale.create({
      data: {
        totalAmountCents: sale.totalAmountCents,
        soldAt,
        items: {
          create: sale.items.map((item) => {
            const product = getProduct(productsByKey, item.productKey);

            return {
              productId: product.id,
              quantity: String(item.quantity),
              unitPriceCents: item.unitPriceCents,
              unitCostSnapshotCents: item.unitCostSnapshotCents,
              totalAmountCents: item.totalAmountCents,
              totalCostCents: item.totalCostCents,
              stockMovements: {
                create: {
                  productId: product.id,
                  type: StockMovementType.SALE,
                  quantity: String(item.quantity),
                  reason: `Venda demo de ${product.name}`,
                  createdAt: soldAt,
                },
              },
            };
          }),
        },
      },
    });
  }
}

async function seedExpenses() {
  for (const expense of demoExpenses) {
    await prisma.expense.create({
      data: {
        description: expense.description,
        category: ExpenseCategory[expense.category],
        amountCents: expense.amountCents,
        paidAt: minutesAgo(expense.minutesAgo),
        confirmed: expense.confirmed,
      },
    });
  }
}

function getProduct(productsByKey, key) {
  const product = productsByKey.get(key);

  if (!product) {
    throw new Error(`Produto demo nao encontrado: ${key}`);
  }

  return product;
}

function normalizeProductName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  await clearDemoData();
  const productsByKey = await seedProducts();
  await seedPurchases(productsByKey);
  await seedSales(productsByKey);
  await seedExpenses();

  console.log(
    `Seed demo concluida: ${demoProducts.length} produtos, ${demoPurchases.length} compras, ` +
      `${demoSales.length} vendas e ${demoExpenses.length} despesas ficticias.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
