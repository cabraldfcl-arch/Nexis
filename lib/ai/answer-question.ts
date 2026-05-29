import type { DashboardPeriodSummary, DashboardSummary } from "@/lib/dashboard/summary";
import { formatCentsToBRL } from "@/lib/finance";
import type { InventoryProductSummary } from "@/lib/finance";
import type { AssistantQuestionContext, InventoryProductMatch } from "@/lib/reports/assistant-question";
import type { ParsedQuestion } from "./intent-schema";

export type AssistantAnswer = {
  title: string;
  value: string;
  body: string;
  tone: "revenue" | "profit" | "expense" | "stock" | "neutral";
};

export function answerQuestionFromSummary(question: ParsedQuestion, summary: DashboardSummary): AssistantAnswer {
  return answerQuestionFromContext(question, { summary });
}

export function answerQuestionFromContext(
  question: ParsedQuestion,
  context: AssistantQuestionContext,
): AssistantAnswer {
  const summary = context.summary;
  const period = question.period === "today" ? summary.today : summary.month;
  const periodLabel = question.period === "today" ? "hoje" : "no mês";

  if (question.intent === "sales") {
    return answerSales(period, periodLabel);
  }

  if (question.intent === "profit") {
    return answerProfit(period, periodLabel);
  }

  if (question.intent === "grossProfit") {
    return answerGrossProfit(period, periodLabel);
  }

  if (question.intent === "netProfit") {
    return answerNetProfit(period, periodLabel);
  }

  if (question.intent === "expenses") {
    return answerExpenses(period, periodLabel);
  }

  if (question.intent === "lowStock") {
    return answerLowStock(summary);
  }

  if (question.intent === "inventory") {
    return answerInventory(context.inventory, context.inventoryMatch);
  }

  if (question.intent === "purchases") {
    return answerPurchases(context.purchases, periodLabel);
  }

  if (question.intent === "topProducts") {
    return answerTopProducts(context.topProducts, periodLabel);
  }

  if (question.intent === "dailySummary") {
    return answerDailySummary({ context, period, periodLabel });
  }

  return answerUnsupported();
}

function answerSales(period: DashboardPeriodSummary, periodLabel: string): AssistantAnswer {
  if (period.salesCount === 0) {
    return {
      title: `Vendas ${periodLabel}`,
      value: formatCentsToBRL(0),
      body: `Ainda não há vendas registradas ${periodLabel}.`,
      tone: "revenue",
    };
  }

  return {
    title: `Vendas ${periodLabel}`,
    value: formatCentsToBRL(period.revenueCents),
    body: `${capitalize(periodLabel)} você vendeu ${formatCentsToBRL(period.revenueCents)} em ${formatSalesCount(
      period.salesCount,
    )}. O custo dos produtos vendidos foi ${formatCentsToBRL(period.costOfGoodsSoldCents)}.`,
    tone: "revenue",
  };
}

function answerProfit(period: DashboardPeriodSummary, periodLabel: string): AssistantAnswer {
  if (period.salesCount === 0 && period.confirmedExpensesCents === 0) {
    return {
      title: `Lucro ${periodLabel}`,
      value: formatCentsToBRL(0),
      body: `Ainda não há lançamentos suficientes para calcular lucro ${periodLabel}.`,
      tone: "profit",
    };
  }

  return {
    title: `Lucro ${periodLabel}`,
    value: formatCentsToBRL(period.netProfitCents),
    body: `${capitalize(periodLabel)} você vendeu ${formatCentsToBRL(
      period.revenueCents,
    )}. O custo dos produtos vendidos foi ${formatCentsToBRL(
      period.costOfGoodsSoldCents,
    )}. Seu lucro bruto foi ${formatCentsToBRL(
      period.grossProfitCents,
    )}. Suas despesas confirmadas foram ${formatCentsToBRL(
      period.confirmedExpensesCents,
    )}. Seu lucro líquido está em ${formatCentsToBRL(period.netProfitCents)}.`,
    tone: "profit",
  };
}

function answerGrossProfit(period: DashboardPeriodSummary, periodLabel: string): AssistantAnswer {
  return {
    title: `Lucro bruto ${periodLabel}`,
    value: formatCentsToBRL(period.grossProfitCents),
    body: `Lucro bruto é vendas menos custo dos produtos vendidos. ${capitalize(periodLabel)} você vendeu ${formatCentsToBRL(
      period.revenueCents,
    )} e o custo dos produtos vendidos foi ${formatCentsToBRL(
      period.costOfGoodsSoldCents,
    )}. Seu lucro bruto foi ${formatCentsToBRL(period.grossProfitCents)}.`,
    tone: "profit",
  };
}

function answerNetProfit(period: DashboardPeriodSummary, periodLabel: string): AssistantAnswer {
  const pendingExpenses = period.pendingExpensesCents ?? 0;
  const pendingText =
    pendingExpenses > 0
      ? ` despesas pendentes somam ${formatCentsToBRL(pendingExpenses)} e não entram no lucro líquido.`
      : " Não há despesas pendentes nesse período.";

  return {
    title: `Lucro líquido ${periodLabel}`,
    value: formatCentsToBRL(period.netProfitCents),
    body: `Lucro líquido é lucro bruto menos despesas confirmadas. Seu lucro bruto ${periodLabel} foi ${formatCentsToBRL(
      period.grossProfitCents,
    )}; despesas confirmadas foram ${formatCentsToBRL(
      period.confirmedExpensesCents,
    )}; lucro líquido ficou em ${formatCentsToBRL(period.netProfitCents)}.${pendingText}`,
    tone: "profit",
  };
}

function answerExpenses(period: DashboardPeriodSummary, periodLabel: string): AssistantAnswer {
  const pendingExpenses = period.pendingExpensesCents ?? 0;

  if (period.confirmedExpensesCents === 0 && pendingExpenses === 0) {
    return {
      title: `Despesas ${periodLabel}`,
      value: formatCentsToBRL(0),
      body: `Ainda não há despesas registradas ${periodLabel}.`,
      tone: "expense",
    };
  }

  const pendingText =
    pendingExpenses > 0
      ? ` despesas pendentes somam ${formatCentsToBRL(pendingExpenses)} e não entram no lucro líquido.`
      : "";

  return {
    title: `Despesas ${periodLabel}`,
    value: formatCentsToBRL(period.confirmedExpensesCents),
    body: `Suas despesas confirmadas ${periodLabel} somam ${formatCentsToBRL(
      period.confirmedExpensesCents,
    )}.${pendingText}`,
    tone: "expense",
  };
}

function answerLowStock(summary: DashboardSummary): AssistantAnswer {
  if (summary.lowStockProducts.length === 0) {
    return {
      title: "Produtos acabando",
      value: "0",
      body: "Nenhum produto ativo está abaixo do estoque mínimo.",
      tone: "stock",
    };
  }

  const names = summary.lowStockProducts.map((product) => product.name).join(", ");

  return {
    title: "Produtos acabando",
    value: String(summary.month.lowStockCount),
    body: `Produtos ativos abaixo do mínimo: ${names}.`,
    tone: "stock",
  };
}

function answerInventory(
  inventory: AssistantQuestionContext["inventory"],
  inventoryMatch: InventoryProductMatch | undefined,
): AssistantAnswer {
  if (!inventory) {
    return answerUnsupported();
  }

  if (inventoryMatch?.status === "found") {
    return {
      title: "Estoque atual",
      value: formatStockQuantity(inventoryMatch.product.currentStock),
      body: `Estoque atual é a quantidade registrada agora no sistema. ${inventoryMatch.product.name} tem ${formatStockQuantity(
        inventoryMatch.product.currentStock,
      )} em estoque.`,
      tone: "stock",
    };
  }

  if (inventoryMatch?.status === "not_found") {
    return {
      title: "Estoque atual",
      value: "Não encontrado",
      body: `Não encontrei produto ativo para "${inventoryMatch.query}". Escreva o nome como está no cadastro.`,
      tone: "stock",
    };
  }

  if (inventoryMatch?.status === "ambiguous") {
    return {
      title: "Estoque atual",
      value: "Mais de um",
      body: `Encontrei mais de um produto parecido com "${inventoryMatch.query}": ${formatProductNames(
        inventoryMatch.products,
      )}. Escreva o nome mais completo.`,
      tone: "stock",
    };
  }

  if (inventory.products.length === 0) {
    return {
      title: "Estoque atual",
      value: "0",
      body: "Nenhum produto ativo está cadastrado para consultar estoque.",
      tone: "stock",
    };
  }

  return {
    title: "Estoque atual",
    value: String(inventory.totalActiveProducts),
    body: `Estoque atual é a quantidade registrada agora no sistema. Produtos: ${formatInventoryList(
      inventory.products,
    )}.`,
    tone: "stock",
  };
}

function answerPurchases(
  purchases: AssistantQuestionContext["purchases"],
  periodLabel: string,
): AssistantAnswer {
  if (!purchases) {
    return answerUnsupported();
  }

  if (purchases.count === 0) {
    return {
      title: `Compras ${periodLabel}`,
      value: formatCentsToBRL(0),
      body: `Nenhuma compra foi registrada ${periodLabel}.`,
      tone: "expense",
    };
  }

  return {
    title: `Compras ${periodLabel}`,
    value: formatCentsToBRL(purchases.totalCostCents),
    body: `${capitalize(periodLabel)} você registrou ${formatPurchaseCount(
      purchases.count,
    )}, somando ${formatCentsToBRL(purchases.totalCostCents)}. Principais compras: ${formatPurchaseList(
      purchases.items,
    )}.`,
    tone: "expense",
  };
}

function answerTopProducts(
  topProducts: AssistantQuestionContext["topProducts"],
  periodLabel: string,
): AssistantAnswer {
  if (!topProducts) {
    return answerUnsupported();
  }

  if (topProducts.items.length === 0) {
    return {
      title: `Produto mais vendido ${periodLabel}`,
      value: "Nenhum",
      body: `Nenhum produto foi vendido ${periodLabel}.`,
      tone: "revenue",
    };
  }

  const [topProduct] = topProducts.items;

  return {
    title: `Produto mais vendido ${periodLabel}`,
    value: topProduct.productName,
    body: `Produto mais vendido é o produto com maior quantidade vendida no período. ${topProduct.productName} vendeu ${formatStockQuantity(
      topProduct.quantity,
    )} unidade(s), gerando ${formatCentsToBRL(topProduct.revenueCents)}.`,
    tone: "revenue",
  };
}

function answerDailySummary({
  context,
  period,
  periodLabel,
}: {
  context: AssistantQuestionContext;
  period: DashboardPeriodSummary;
  periodLabel: string;
}): AssistantAnswer {
  const purchases = context.purchases;
  const lowStockProducts = context.inventory?.lowStockProducts ?? context.summary.lowStockProducts;
  const pendingExpenses = period.pendingExpensesCents ?? 0;
  const purchaseText = purchases
    ? ` compras somaram ${formatCentsToBRL(purchases.totalCostCents)} em ${formatPurchaseCount(purchases.count)}.`
    : "";
  const lowStockText =
    lowStockProducts.length > 0
      ? ` Produtos acabando: ${formatProductNames(lowStockProducts)}.`
      : " Nenhum produto ativo está abaixo do estoque mínimo.";
  const pendingText =
    pendingExpenses > 0
      ? ` despesas pendentes somam ${formatCentsToBRL(pendingExpenses)} e não entram no lucro líquido.`
      : "";

  return {
    title: `Resumo financeiro ${periodLabel}`,
    value: formatCentsToBRL(period.netProfitCents),
    body: `${capitalize(periodLabel)}: vendas ${formatCentsToBRL(
      period.revenueCents,
    )}, custo dos produtos vendidos ${formatCentsToBRL(
      period.costOfGoodsSoldCents,
    )}, lucro bruto ${formatCentsToBRL(
      period.grossProfitCents,
    )}, despesas confirmadas ${formatCentsToBRL(
      period.confirmedExpensesCents,
    )} e lucro líquido ${formatCentsToBRL(period.netProfitCents)}.${purchaseText}${pendingText}${lowStockText}`,
    tone: "neutral",
  };
}

function answerUnsupported(): AssistantAnswer {
  return {
    title: "Consulta não implementada",
    value: "Sem número seguro",
    body: "Ainda não tenho essa consulta implementada com segurança.",
    tone: "neutral",
  };
}

function formatSalesCount(value: number): string {
  return value === 1 ? "1 venda" : `${value} vendas`;
}

function formatPurchaseCount(value: number): string {
  return value === 1 ? "1 compra" : `${value} compras`;
}

function formatStockQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatInventoryList(products: readonly InventoryProductSummary[]): string {
  return products
    .slice(0, 5)
    .map((product) => `${product.name}: ${formatStockQuantity(product.currentStock)}`)
    .join("; ");
}

function formatProductNames(products: readonly { name: string }[]): string {
  return products
    .slice(0, 5)
    .map((product) => product.name)
    .join(", ");
}

function formatPurchaseList(purchases: readonly { productName: string; quantity: number; totalCostCents: number }[]): string {
  return purchases
    .slice(0, 3)
    .map(
      (purchase) =>
        `${purchase.productName}: ${formatStockQuantity(purchase.quantity)} por ${formatCentsToBRL(
          purchase.totalCostCents,
        )}`,
    )
    .join("; ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
