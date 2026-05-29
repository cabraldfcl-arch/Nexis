import type { ParsedQuestion } from "@/lib/ai/intent-schema";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboard/summary";
import {
  summarizeInventory,
  summarizePurchases,
  summarizeTopProducts,
  type InventoryProductSummary,
  type InventoryReport,
  type PurchaseReport,
  type TopProductsReport,
} from "@/lib/finance";

export type InventoryProductMatch =
  | { status: "found"; product: InventoryProductSummary }
  | { status: "not_found"; query: string }
  | { status: "ambiguous"; query: string; products: InventoryProductSummary[] };

export type AssistantQuestionContext = {
  summary: DashboardSummary;
  inventory?: InventoryReport;
  inventoryMatch?: InventoryProductMatch;
  purchases?: PurchaseReport;
  topProducts?: TopProductsReport;
};

export async function getAssistantQuestionContext(
  question: ParsedQuestion,
  now = new Date(),
): Promise<AssistantQuestionContext> {
  const summary = await getDashboardSummary(now);
  const context: AssistantQuestionContext = { summary };
  const period = question.period === "today" ? summary.periods.today : summary.periods.month;

  if (question.intent === "inventory" || question.intent === "dailySummary") {
    context.inventory = await getInventoryReport();

    if (question.intent === "inventory" && question.productName) {
      context.inventoryMatch = findInventoryProduct(question.productName, context.inventory.products);
    }
  }

  if (question.intent === "purchases" || question.intent === "dailySummary") {
    context.purchases = await getPurchaseReport(period);
  }

  if (question.intent === "topProducts") {
    context.topProducts = await getTopProductsReport(period);
  }

  return context;
}

async function getInventoryReport(): Promise<InventoryReport> {
  const { prisma } = await import("@/lib/db/prisma");
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      active: true,
      currentStock: true,
      id: true,
      minimumStock: true,
      name: true,
    },
    where: { active: true },
  });

  return summarizeInventory(
    products.map((product) => ({
      active: product.active,
      currentStock: Number(product.currentStock),
      id: product.id,
      minimumStock: Number(product.minimumStock),
      name: product.name,
    })),
  );
}

async function getPurchaseReport(period: { start: Date; end: Date }): Promise<PurchaseReport> {
  const { prisma } = await import("@/lib/db/prisma");
  const purchases = await prisma.purchase.findMany({
    include: {
      product: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      purchasedAt: "desc",
    },
    where: {
      cancelledAt: null,
      purchasedAt: {
        gte: period.start,
        lte: period.end,
      },
    },
  });

  return summarizePurchases({
    period,
    purchases: purchases.map((purchase) => ({
      productName: purchase.product.name,
      purchasedAt: purchase.purchasedAt,
      quantity: Number(purchase.quantity),
      supplier: purchase.supplier,
      totalCostCents: purchase.totalCostCents,
      unitCostCents: purchase.unitCostCents,
    })),
  });
}

async function getTopProductsReport(period: { start: Date; end: Date }): Promise<TopProductsReport> {
  const { prisma } = await import("@/lib/db/prisma");
  const saleItems = await prisma.saleItem.findMany({
    include: {
      product: {
        select: {
          name: true,
        },
      },
      sale: {
        select: {
          soldAt: true,
        },
      },
    },
    where: {
      sale: {
        cancelledAt: null,
        soldAt: {
          gte: period.start,
          lte: period.end,
        },
      },
    },
  });

  return summarizeTopProducts({
    period,
    saleItems: saleItems.map((item) => ({
      occurredAt: item.sale.soldAt,
      productId: item.productId,
      productName: item.product.name,
      quantity: Number(item.quantity),
      totalAmountCents: item.totalAmountCents,
      totalCostCents: item.totalCostCents,
      unitCostSnapshotCents: item.unitCostSnapshotCents,
      unitPriceCents: item.unitPriceCents,
    })),
  });
}

function findInventoryProduct(query: string, products: readonly InventoryProductSummary[]): InventoryProductMatch {
  const matches = products.filter((product) => productMatches(query, product.name));

  if (matches.length === 1) {
    return { status: "found", product: matches[0] };
  }

  if (matches.length === 0) {
    return { status: "not_found", query };
  }

  return { status: "ambiguous", products: matches, query };
}

function productMatches(query: string, productName: string): boolean {
  const queryTokens = tokenizeForSearch(query);
  const productTokens = tokenizeForSearch(productName);

  if (queryTokens.length === 0 || productTokens.length === 0) {
    return false;
  }

  return queryTokens.every((queryToken) =>
    productTokens.some(
      (productToken) =>
        productToken === queryToken || productToken.includes(queryToken) || queryToken.includes(productToken),
    ),
  );
}

function tokenizeForSearch(value: string): string[] {
  return normalizeForSearch(value)
    .split(" ")
    .map((token) => singularizeToken(token))
    .filter((token) => token.length > 1);
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeToken(token: string): string {
  return token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token;
}
