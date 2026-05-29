import type { ExpenseCategoryValue } from "@/lib/validation/expense";
import { calculateRoundedUnitAmountCents } from "@/lib/finance";
import { parseBrazilianMoneyToCents, parseBrazilianQuantity } from "@/lib/validation/product";
import { parseCommercialUnitPurchase, parseCommercialUnitSale } from "./commercial-units";
import {
  classifyIntent,
  cleanAssistantProductName,
  detectMultipleActions,
  extractEntities,
  inferProductUnit,
  socialResponseForMessage,
} from "./conversation-engine";
import type {
  ParsedAssistantMessage,
  ParsedCommercialUnitFields,
  ParsedProductDraftRequest,
  ProductDraftMissingField,
} from "./intent-schema";

const unknownMessage =
  "Não consegui entender com segurança. Tente escrever assim: Vendi 3 refrigerantes por 7 reais.";
const dangerousCommandMessage =
  "Não posso apagar, alterar lucro, ignorar custo ou salvar sem confirmação. Revise antes de salvar.";
const serviceRevenueUnsupportedMessage =
  "Receita de serviço sem estoque ainda não está implementada com segurança. Posso te avisar que essa função está no roadmap, mas não vou salvar esse lançamento agora.";
const stockLossUnsupportedMessage =
  "Perda, quebra ou desperdício de estoque ainda precisa de fluxo próprio com confirmação. Nesta versão, nada foi salvo.";
const multipleActionsMessage =
  "Consigo registrar uma coisa por vez. O que você quer lançar primeiro: compra, venda ou despesa?";
const ambiguousPackageSaleModeMessage =
  "Não tenho certeza se você vende o pacote fechado ou cada salgadinho separado. Me diga: você vende o pacote fechado ou vende cada salgadinho separado?";
const assistantQuantityPattern = "(?:\\d+(?:[,.]\\d+)?|um|uma)";
const saleActionPattern =
  "(?:vendi|(?:o\\s+)?cliente\\s+levou|(?:o\\s+)?cliente\\s+comprou|(?:o\\s+)?cliente\\s+pegou|levou|saiu|baixou|dei\\s+saida(?:\\s+em)?)";
const packageUnitPattern = "(?:caixa|caixas|fardo|fardos|pacote|pacotes|saco|sacos|bandeja|bandejas|cartela|cartelas)";
const innerPackageUnitPattern =
  "(?:unidade|unidades|un|garrafinha|garrafinhas|garrafa|garrafas|latinha|latinhas|ovo|ovos|doce|doces|salgadinho|salgadinhos)";
const purchaseActionPattern =
  "(?:comprei|peguei|veio|vieram|entrou|entraram|chegou|chegaram)";
const moneyPattern = "\\d+(?:[,.]\\d{1,2})?";

export function parseAssistantMessage(message: string): ParsedAssistantMessage {
  const text = normalizeAssistantInputText(message).trim();

  if (text.length === 0) {
    return { kind: "unknown", message: unknownMessage };
  }

  const stockLoss = parseStockLoss(text);

  if (stockLoss) {
    return stockLoss;
  }

  const cancellation = parseCancellation(text);

  if (cancellation) {
    return cancellation;
  }

  const intent = classifyIntent(text);

  if (intent === "dangerous") {
    return { kind: "unknown", message: dangerousCommandMessage };
  }

  if (intent === "social") {
    return { kind: "social", message: socialResponseForMessage(text) };
  }

  if (detectMultipleActions(text).hasMultipleActions) {
    return { kind: "unknown", message: multipleActionsMessage };
  }

  if (isUnsupportedServiceRevenue(text)) {
    return { kind: "unknown", message: serviceRevenueUnsupportedMessage };
  }

  if (isUnsupportedStockLoss(text)) {
    return { kind: "unknown", message: stockLossUnsupportedMessage };
  }

  if (intent === "sale_exit") {
    const sale = parseSale(text);

    if (sale) {
      return sale;
    }

    return {
      kind: "unknown",
      message: "Acho que você quer registrar uma venda, mas preciso saber o produto e a quantidade.",
    };
  }

  if (intent === "purchase_entry") {
    const purchase = parsePurchase(text);

    if (purchase) {
      return purchase;
    }

    return {
      kind: "unknown",
      message: "Acho que você quer registrar uma compra, mas preciso saber produto, quantidade e custo por unidade.",
    };
  }

  if (intent === "expense") {
    const expense = parseExpense(text);

    if (expense) {
      return expense;
    }

    return {
      kind: "unknown",
      message: "Acho que você quer registrar uma despesa, mas preciso saber o valor e a descrição.",
    };
  }

  if (intent === "product_registration") {
    const productDraft = parseProductDraft(text);

    if (productDraft) {
      return productDraft;
    }
  }

  if (intent === "financial_question") {
    const question = parseQuestion(text);

    if (question) {
      return question;
    }
  }

  return { kind: "unknown", message: unknownMessage };
}

function parseQuestion(text: string): ParsedAssistantMessage | null {
  const normalized = normalizeText(text);
  const period = parseQuestionPeriod(normalized);

  if (/fluxo\s+de\s+caixa/.test(normalized)) {
    return { kind: "question", intent: "cashFlow", period };
  }

  if (/resumo/.test(normalized) && /\b(financeiro|hoje|dia|mes)\b/.test(normalized)) {
    return { kind: "question", intent: "dailySummary", period };
  }

  if (/produtos?.*acabando|acabando|estoque baixo/.test(normalized)) {
    return { kind: "question", intent: "lowStock", period: "month" };
  }

  if (/produtos?.*(?:vendi|vendidos?).*mais|produto\s+mais\s+vendido|mais\s+vendidos?/.test(normalized)) {
    return { kind: "question", intent: "topProducts", period };
  }

  if (
    /quanto\s+comprei/.test(normalized) ||
    /o\s+que\s+comprei/.test(normalized) ||
    /quais\s+compras/.test(normalized) ||
    /\bcompras?\b/.test(normalized) && /\b(quanto|quais|total|fiz|mes)\b/.test(normalized)
  ) {
    return { kind: "question", intent: "purchases", period };
  }

  if (/lucro\s+bruto/.test(normalized)) {
    return { kind: "question", intent: "grossProfit", period };
  }

  if (/lucro\s+liquido/.test(normalized)) {
    return { kind: "question", intent: "netProfit", period };
  }

  if (/quanto\s+(?:ganhei|luc(?:rei|ro)|sobrou)/.test(normalized)) {
    return { kind: "question", intent: "profit", period };
  }

  if (/quanto\s+vendi/.test(normalized) || /vendas?/.test(normalized)) {
    return { kind: "question", intent: "sales", period };
  }

  if (/lucro/.test(normalized)) {
    return { kind: "question", intent: "profit", period };
  }

  if (/despesas?|gastei|gasto/.test(normalized) && /quanto|qual|total/.test(normalized)) {
    return { kind: "question", intent: "expenses", period };
  }

  if (
    /estoque\s+atual|em\s+estoque/.test(normalized) ||
    /quant[oa]s?.*\btenho\b/.test(normalized) ||
    /\btenho\s+quant[oa]s?/.test(normalized)
  ) {
    const productName = parseInventoryProductName(text);

    return productName
      ? { kind: "question", intent: "inventory", period, productName }
      : { kind: "question", intent: "inventory", period };
  }

  return null;
}

function parseQuestionPeriod(normalized: string): "today" | "month" {
  if (/\b(hoje|dia|nesse\s+dia|neste\s+dia|do\s+dia)\b/.test(normalized)) {
    return "today";
  }

  return "month";
}

function parseInventoryProductName(text: string): string | undefined {
  const cleanText = text.trim().replace(/[?!.]+$/g, "");
  const match =
    cleanText.match(/^quanto\s+tenho\s+de\s+(.+?)\s+(?:no|em)\s+estoque$/i) ??
    cleanText.match(/^tenho\s+quant[oa]s?\s+(.+?)$/i) ??
    cleanText.match(/^quant[oa]s?\s+(.+?)\s+tenho(?:\s+em\s+estoque)?$/i);

  if (!match) {
    return undefined;
  }

  return cleanProductName(match[1].replace(/\s+em\s+estoque$/i, ""));
}

function parseSale(text: string): ParsedAssistantMessage | null {
  const commercialSale = parseCommercialUnitSale(text);

  if (commercialSale) {
    return {
      kind: "sale",
      productName: commercialSale.productName,
      quantity: commercialSale.quantity,
      unit: commercialSale.unit,
      unitLabel: commercialSale.unitLabel,
      unitPriceCents: commercialSale.unitPriceCents,
    };
  }

  const unitPriceMatch = text.match(
    new RegExp(
      `^${saleActionPattern}\\s+(${assistantQuantityPattern})\\s+(.+?)\\s+por\\s+(?:r\\$\\s*)?(\\d+(?:[,.]\\d{1,2})?)(?:\\s*(?:real|reais))?(?:\\s*cada)?\\.?$`,
      "i",
    ),
  );

  if (unitPriceMatch) {
    const productName = cleanProductName(unitPriceMatch[2]);

    if (isMissingSaleProductName(productName)) {
      return null;
    }

    try {
      return {
        kind: "sale",
        productName,
        quantity: parsePositiveAssistantQuantity(unitPriceMatch[1], "Quantidade vendida"),
        unitPriceCents: parsePositiveMoneyToCents(unitPriceMatch[3], "Preco de venda"),
      };
    } catch (error) {
      return parsedError(error);
    }
  }

  const totalMatch = text.match(
    new RegExp(
      `^${saleActionPattern}\\s+(${assistantQuantityPattern})\\s+(.+?)\\s+no\\s+total\\s+de\\s+(?:r\\$\\s*)?(\\d+(?:[,.]\\d{1,2})?)(?:\\s*(?:real|reais))?\\.?$`,
      "i",
    ),
  );

  if (totalMatch) {
    const productName = cleanProductName(totalMatch[2]);

    if (isMissingSaleProductName(productName)) {
      return null;
    }

    try {
      const quantity = parsePositiveAssistantQuantity(totalMatch[1], "Quantidade vendida");
      const totalAmountCents = parsePositiveMoneyToCents(totalMatch[3], "Total da venda");

      return {
        kind: "sale",
        productName,
        quantity,
        unitPriceCents: calculateUnitPriceFromTotal(totalAmountCents, quantity),
      };
    } catch (error) {
      return parsedError(error);
    }
  }

  const singularArticleMatch = text.match(
    new RegExp(`^${saleActionPattern}\\s+(?:a|o)\\s+(.+?)\\.?$`, "i"),
  );

  if (singularArticleMatch) {
    const productName = cleanProductName(singularArticleMatch[1]);

    if (isMissingSaleProductName(productName)) {
      return null;
    }

    return {
      kind: "sale",
      productName,
      quantity: 1,
      unitPriceCents: null,
    };
  }

  const registeredPriceMatch = text.match(
    new RegExp(`^${saleActionPattern}\\s+(${assistantQuantityPattern})\\s+(.+?)\\.?$`, "i"),
  );

  if (!registeredPriceMatch) {
    return null;
  }

  const productName = cleanProductName(registeredPriceMatch[2]);

  if (isMissingSaleProductName(productName)) {
    return null;
  }

  try {
    return {
      kind: "sale",
      productName,
      quantity: parsePositiveAssistantQuantity(registeredPriceMatch[1], "Quantidade vendida"),
      unitPriceCents: null,
    };
  } catch (error) {
    return parsedError(error);
  }
}

function parsePurchase(text: string): ParsedAssistantMessage | null {
  const ambiguousPackagedSaleMode = parseAmbiguousPackagedSaleMode(text);

  if (ambiguousPackagedSaleMode) {
    return ambiguousPackagedSaleMode;
  }

  const humanProductDraft = parseHumanProductDraftFromPurchase(text);

  if (humanProductDraft) {
    return humanProductDraft;
  }

  const naturalPackagedPurchase = parseNaturalPackagedPurchase(text, null);

  if (naturalPackagedPurchase) {
    return {
      kind: "purchase",
      priceBasis: naturalPackagedPurchase.priceBasis,
      productName: naturalPackagedPurchase.productName,
      quantity: naturalPackagedPurchase.quantity,
      unit: naturalPackagedPurchase.unit,
      unitCostCents: naturalPackagedPurchase.unitCostCents,
      unitLabel: naturalPackagedPurchase.unitLabel,
    };
  }

  const stockProductDraft = parseStockProductDraft(text);

  if (stockProductDraft) {
    return stockProductDraft;
  }

  const commercialPurchase = parseCommercialUnitPurchase(text);

  if (commercialPurchase) {
    return {
      kind: "purchase",
      priceBasis: commercialPurchase.priceBasis,
      productName: commercialPurchase.productName,
      quantity: commercialPurchase.quantity,
      unit: commercialPurchase.unit,
      unitCostCents: commercialPurchase.unitCostCents ?? 0,
      unitLabel: commercialPurchase.unitLabel,
    };
  }

  const entities = extractEntities(text, "purchase_entry");

  if (entities.productName && entities.quantity) {
    if (entities.amountKind === "ambiguous" && entities.amountCents) {
      return {
        amountCents: entities.amountCents,
        kind: "ambiguous_purchase_cost",
        productName: entities.productName,
        quantity: entities.quantity,
        ...commercialUnitFields(entities),
      };
    }

    if (entities.unitCostCents) {
      return {
        kind: "purchase",
        productName: entities.productName,
        quantity: entities.quantity,
        unitCostCents: entities.unitCostCents,
        ...commercialUnitFields(entities),
      };
    }

    return {
      kind: "partial_purchase",
      productName: entities.productName,
      quantity: entities.quantity,
      missingFields: ["unitCostCents"],
      ...commercialUnitFields(entities),
    };
  }

  const naturalPurchase = parseNaturalPurchaseWithCost(text);

  if (naturalPurchase) {
    return naturalPurchase;
  }

  const match = text.match(
    /^comprei\s+(\d+(?:[,.]\d+)?)\s+(.+?)\s+por\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?(?:\s*cada)?\.?$/i,
  );

  if (match) {
    try {
      const quantity = parsePositiveQuantity(match[1], "Quantidade comprada");
      const unitCostCents = parsePositiveMoneyToCents(match[3], "Custo por unidade");

      if (!hasExplicitUnitCostMarker(text) && isAmbiguousPurchaseAmount(quantity, unitCostCents)) {
        return {
          amountCents: unitCostCents,
          kind: "ambiguous_purchase_cost",
          productName: cleanProductName(match[2]),
          quantity,
        };
      }

      return {
        kind: "purchase",
        productName: cleanProductName(match[2]),
        quantity,
        unitCostCents,
      };
    } catch (error) {
      return parsedError(error);
    }
  }

  return parsePartialPurchase(text);
}

type NaturalPurchaseDraftFields = {
  priceBasis?: string;
  productName: string;
  quantity: number;
  unit: ParsedProductDraftRequest["unit"];
  unitCostCents: number;
  unitLabel?: string;
};

function parseAmbiguousPackagedSaleMode(text: string): ParsedAssistantMessage | null {
  const leadingProductName = extractLeadingRegistrationProductName(text);

  if (!leadingProductName || !/^pacote\b/i.test(normalizeText(leadingProductName))) {
    return null;
  }

  const normalized = normalizeText(text);
  const hasInnerPackageCount = new RegExp(`\\b${packageUnitPattern}\\b.*\\b(?:com|vem)\\s+\\d`, "i").test(normalized);
  const sellsEachInnerItem = /\bvend(?:o|er|a)\b.*\bcada\b|\bcada\s+(?:um|uma|unidade)\b/.test(normalized);

  return hasInnerPackageCount && sellsEachInnerItem
    ? { kind: "unknown", message: ambiguousPackageSaleModeMessage }
    : null;
}

function parseHumanProductDraftFromPurchase(text: string): ParsedAssistantMessage | null {
  const leadingProductName = extractLeadingRegistrationProductName(text);
  const purchase =
    parseSoldPackageProductPurchase(text, leadingProductName) ??
    parseNaturalPackagedPurchase(text, leadingProductName) ??
    parseNaturalMeasuredPurchase(text, leadingProductName);

  if (!purchase) {
    return null;
  }

  const salePriceCents = parseNaturalSalePriceCents(text, purchase.unit);
  const minimumStock = parseNaturalMinimumStock(text);
  const shouldBuildProductDraft = salePriceCents !== null || minimumStock !== null;

  if (!shouldBuildProductDraft) {
    return null;
  }

  const draft: ParsedProductDraftRequest = {
    category: null,
    initialStock: purchase.quantity,
    initialStockSource: "purchase",
    kind: "product",
    minimumStock,
    missingFields: [],
    name: purchase.productName,
    salePriceCents,
    unit: purchase.unit,
    unitCostCents: purchase.unitCostCents,
  };

  draft.missingFields = missingProductDraftFields(draft);

  return draft;
}

function parseNaturalPackagedPurchase(
  text: string,
  leadingProductName: string | null,
): NaturalPurchaseDraftFields | null {
  const normalizedText = normalizeProductMeasureText(text);
  const packageMatch = normalizedText.match(
    new RegExp(
      `\\b${purchaseActionPattern}(?:\\s+(?:hoje|ontem|agora|la|lá|mais))*\\s+(${assistantQuantityPattern})?\\s*(${packageUnitPattern})(?:\\s+fechad[ao]s?)?(?:\\s+de\\s+(.+?))?(?=\\s*,|\\s+com\\b|\\s+cada\\b|\\s+vem\\b|\\s+por\\b|\\s+deu\\b|\\s+ficou\\b|\\s+custou\\b|\\s+saiu\\b|\\s+foi\\b|$)`,
      "i",
    ),
  );
  const packageQuantityText = packageMatch?.[1] ?? "uma";
  const packageUnitText = packageMatch?.[2] ?? "";
  const packageProductText = packageMatch?.[3];
  const unitsPerPackageText = extractUnitsPerPackageText(normalizedText, packageUnitText);

  if (!packageMatch || !unitsPerPackageText) {
    return null;
  }

  const productText = leadingProductName ?? packageProductText ?? extractInnerPackageProductName(normalizedText);
  const productName = normalizeLikelyProductMeasure(cleanProductName(productText ?? ""));

  if (productName.length === 0 || isMissingSaleProductName(productName)) {
    return null;
  }

  const packageQuantity = parsePositiveAssistantQuantity(packageQuantityText, "Quantidade de embalagens");
  const unitsPerPackage = parsePositiveAssistantQuantity(unitsPerPackageText, "Unidades por embalagem");
  const totalCostText = extractPackagedTotalCostText(normalizedText);
  const packageCostText = totalCostText ? null : extractPackageCostText(normalizedText, packageUnitText);

  if (!totalCostText && !packageCostText) {
    return null;
  }

  const totalUnits = Number((packageQuantity * unitsPerPackage).toFixed(6));
  const unitCostCents = totalCostText
    ? calculateRoundedUnitAmountCents({
        totalAmountCents: parsePositiveMoneyToCents(totalCostText, "Custo total"),
        totalFieldName: "Custo total",
        unitFieldName: "Unidades compradas",
        units: totalUnits,
      })
    : calculateRoundedUnitAmountCents({
        totalAmountCents: parsePositiveMoneyToCents(packageCostText ?? "", "Custo por embalagem"),
        totalFieldName: "Custo por embalagem",
        unitFieldName: "Unidades por embalagem",
        units: unitsPerPackage,
      });

  return {
    priceBasis: "por unidade",
    productName,
    quantity: totalUnits,
    unit: "UNIT",
    unitCostCents,
    unitLabel: "unidade",
  };
}

function parseSoldPackageProductPurchase(
  text: string,
  leadingProductName: string | null,
): NaturalPurchaseDraftFields | null {
  if (!leadingProductName) {
    return null;
  }

  const normalizedText = normalizeProductMeasureText(text);
  const match = normalizedText.match(
    new RegExp(
      `\\b${purchaseActionPattern}(?:\\s+(?:hoje|ontem|agora))*\\s+(${assistantQuantityPattern})\\s+(${packageUnitPattern})\\s+(?:por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?\\s*(?:cada|a|o)?\\b`,
      "i",
    ),
  );

  if (!match) {
    return null;
  }

  const unit = packageUnitToProductUnit(match[2]);

  if (!unit) {
    return null;
  }

  return {
    priceBasis: `por ${packageUnitLabel(match[2])}`,
    productName: cleanProductName(leadingProductName),
    quantity: parsePositiveAssistantQuantity(match[1], "Quantidade comprada"),
    unit,
    unitCostCents: parsePositiveMoneyToCents(match[3], "Custo por embalagem"),
    unitLabel: packageUnitLabel(match[2]),
  };
}

function parseNaturalMeasuredPurchase(
  text: string,
  leadingProductName: string | null,
): NaturalPurchaseDraftFields | null {
  const purchaseClause = extractPurchaseClause(text);

  if (!purchaseClause) {
    return null;
  }

  const direct = parseCommercialUnitPurchase(purchaseClause);

  if (direct) {
    return {
      priceBasis: direct.priceBasis,
      productName: normalizeLikelyProductMeasure(direct.productName),
      quantity: direct.quantity,
      unit: direct.unit,
      unitCostCents: direct.unitCostCents ?? 0,
      unitLabel: direct.unitLabel,
    };
  }

  if (!leadingProductName) {
    return null;
  }

  const rewritten = rewriteMeasuredPurchaseWithLeadingProduct(purchaseClause, leadingProductName);
  const parsed = rewritten ? parseCommercialUnitPurchase(rewritten) : null;

  if (!parsed || !parsed.unitCostCents) {
    return null;
  }

  return {
    priceBasis: parsed.priceBasis,
    productName: normalizeLikelyProductMeasure(parsed.productName),
    quantity: parsed.quantity,
    unit: parsed.unit,
    unitCostCents: parsed.unitCostCents,
    unitLabel: parsed.unitLabel,
  };
}

function extractLeadingRegistrationProductName(text: string): string | null {
  const purchaseMatch = text.match(new RegExp(`\\b${purchaseActionPattern}\\b`, "i"));

  if (!purchaseMatch?.index) {
    return null;
  }

  const prefix = text.slice(0, purchaseMatch.index);
  const withoutCommand = prefix
    .replace(/[,.!?]+/g, " ")
    .replace(/\bmo[cç]o\b/gi, " ")
    .replace(
      /\b(?:quero\s+)?(?:cadastro|cadastrar|cadastre|cadastra|criar|cria|adicione|adiciona|adicionar|inclua|incluir|registra|registre|coloca|coloque|bota)(?:\s+a[ií])?(?:\s+(?:pra|para)\s+mim)?(?:\s+(?:um|uma|o|a|esse|essa|produto)\b)?/gi,
      " ",
    )
    .replace(/\b(?:a[ií]|pra|para|mim)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const productName = normalizeLikelyProductMeasure(cleanProductDraftName(withoutCommand));

  return productName.length > 0 ? productName : null;
}

function extractPurchaseClause(text: string): string | null {
  const purchaseMatch = text.match(new RegExp(`\\b${purchaseActionPattern}\\b`, "i"));

  if (!purchaseMatch?.index && purchaseMatch?.index !== 0) {
    return null;
  }

  return text
    .slice(purchaseMatch.index)
    .split(/\b(?:vou\s+vender|vendo|vender|pre[cç]o\s+de\s+venda|estoque\s+m[ií]nimo|m[ií]nimo|quando\s+tiver|me\s+avisa)\b/i)[0]
    .replace(/[.!,;]+$/g, "")
    .trim();
}

function rewriteMeasuredPurchaseWithLeadingProduct(purchaseClause: string, productName: string): string | null {
  const normalizedClause = normalizeProductMeasureText(purchaseClause);
  const pattern = new RegExp(
    `^(\\s*${purchaseActionPattern}(?:\\s+(?:hoje|ontem|agora))?\\s+${assistantQuantityPattern}\\s+${productUnitWordPattern})\\s+((?:por|a)\\s+(?:r\\$\\s*)?${moneyPattern}(?:\\s*(?:real|reais))?(?:\\s+(?:(?:o|a|cada|por)\\s+)?${productUnitWordPattern})?)`,
    "i",
  );
  const match = normalizedClause.match(pattern);

  return match ? `${match[1]} de ${productName} ${match[2]}` : null;
}

function extractUnitsPerPackageText(text: string, packageUnitText: string): string | null {
  const packageUnit = packageUnitText ? escapeRegExp(singularPackageUnit(packageUnitText)) : packageUnitPattern;
  const patterns = [
    new RegExp(`\\bcada\\s+${packageUnit}s?\\s+(?:vem|com)\\s+(${assistantQuantityPattern})\\b`, "i"),
    new RegExp(`\\b(?:com|vem)\\s+(${assistantQuantityPattern})\\s+(?:${innerPackageUnitPattern})?\\s+em\\s+cada\\b`, "i"),
    new RegExp(`\\b(?:com|vem)\\s+(${assistantQuantityPattern})(?:\\s+(?:${innerPackageUnitPattern}))?\\b`, "i"),
  ];

  return extractFirstPatternValue(text, patterns);
}

function extractInnerPackageProductName(text: string): string | null {
  const match = text.match(
    new RegExp(`\\b${packageUnitPattern}\\b(?:\\s+fechad[ao]s?)?\\s+com\\s+${assistantQuantityPattern}\\s+(.+?)\\s+(?:por|a|deu|ficou|custou|saiu|foi)\\b`, "i"),
  );
  const candidate = match?.[1]?.replace(new RegExp(`^(?:${innerPackageUnitPattern})\\s+de\\s+`, "i"), "");

  if (!candidate || new RegExp(`^(?:${innerPackageUnitPattern})$`, "i").test(candidate.trim())) {
    return null;
  }

  return candidate;
}

function extractPackageCostText(text: string, packageUnitText: string): string | null {
  const packageUnit = packageUnitText ? escapeRegExp(singularPackageUnit(packageUnitText)) : packageUnitPattern;
  const patterns = [
    new RegExp(`\\b(?:deu|ficou|custou|saiu|foi|por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?\\s+(?:(?:a|o|por|cada)\\s+)?${packageUnit}s?\\b`, "i"),
    new RegExp(`\\b(?:por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?\\b`, "i"),
  ];

  return extractFirstPatternValue(text, patterns);
}

function extractPackagedTotalCostText(text: string): string | null {
  const patterns = [
    new RegExp(`\\btudo\\s+(?:ficou|deu|custou|saiu|foi)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?`, "i"),
    new RegExp(`\\bpaguei\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?\\s+nas?\\s+(?:duas|dois|tres|tr[eê]s|\\d+)?\\s*${packageUnitPattern}\\b`, "i"),
  ];

  return extractFirstPatternValue(text, patterns);
}

function parseNaturalSalePriceCents(text: string, unit: ParsedProductDraftRequest["unit"]): number | null {
  const normalizedText = normalizeProductMeasureText(text);
  const quantityPriceMatch = normalizedText.match(
    new RegExp(`\\b(?:vendo|vender|vou\\s+vender)\\s+(${assistantQuantityPattern})\\s+(g|grama|gramas)\\s+por\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?`, "i"),
  );

  if (quantityPriceMatch && unit === "KG") {
    const quantityInGrams = parsePositiveAssistantQuantity(quantityPriceMatch[1], "Quantidade de venda");
    const amountCents = parsePositiveMoneyToCents(quantityPriceMatch[3], "Preco de venda");
    const unitAmount = amountCents * (1000 / quantityInGrams);

    if (!Number.isSafeInteger(unitAmount) || unitAmount <= 0) {
      throw new Error("Preco de venda por gramas precisa converter para kg em centavos inteiros.");
    }

    return unitAmount;
  }

  const patterns = [
    new RegExp(
      `\\bcada\\s+(?:uma|um|unidade|latinha|agua|água|ovo)\\s*(?:sai\\s+)?(?:por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?`,
      "i",
    ),
    new RegExp(
      `\\b(?:vendo|vender|vou\\s+vender)\\s+(?:cada\\s+\\S+|cada\\s+uma|cada\\s+um|o\\s+kg|o\\s+quilo|o\\s+litro|cada\\s+litro|a\\s+caixa)?\\s*(?:por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?`,
      "i",
    ),
    new RegExp(`\\b(?:vendo|vender|vou\\s+vender)[^\\d]{0,30}(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?\\s*cada\\b`, "i"),
  ];
  const value = extractFirstPatternValue(normalizedText, patterns);

  return value === null ? null : parsePositiveMoneyToCents(value, "Preco de venda");
}

function parseNaturalMinimumStock(text: string): number | null {
  const patterns = [
    new RegExp(`\\b(?:estoque\\s+)?m[ií]nimo\\s+(${productNumberPattern})`, "i"),
    new RegExp(`\\bquando\\s+tiver\\s+(?:s[oó]\\s+)?(${productNumberPattern})\\b`, "i"),
    new RegExp(`\\bme\\s+avisa\\s+quando\\s+tiver\\s+(${productNumberPattern})\\b`, "i"),
  ];

  return parseOptionalProductQuantity(text, patterns, "Estoque minimo");
}

function normalizeProductMeasureText(value: string): string {
  return value
    .replace(/(\d+(?:[,.]\d+)?)(kg|g|ml|l)\b/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLikelyProductMeasure(productName: string): string {
  return productName
    .replace(/(\d+(?:[,.]\d+)?)(kg|g|ml|l)\b/gi, "$1 $2")
    .replace(/\b(lata|garrafa|garrafinha|pet)\s+de\s+(?=\d)/gi, "$1 ")
    .replace(/\bde\s+(?=\d)/gi, " ")
    .replace(/\b(lata|garrafa|garrafinha|pet)\s+(\d{2,4})\b(?!\s*(?:ml|l|kg|g)\b)/gi, "$1 $2 ml")
    .replace(/\s+/g, " ")
    .trim();
}

function packageUnitToProductUnit(packageUnitText: string): ParsedProductDraftRequest["unit"] | null {
  const normalized = singularPackageUnit(packageUnitText);

  if (normalized === "caixa") {
    return "BOX";
  }

  if (normalized === "saco") {
    return "SACK";
  }

  if (normalized === "fardo") {
    return "BALE";
  }

  if (normalized === "pacote") {
    return "PACKAGE";
  }

  if (normalized === "bandeja" || normalized === "cartela") {
    return "UNIT";
  }

  return null;
}

function packageUnitLabel(packageUnitText: string): string {
  return singularPackageUnit(packageUnitText);
}

function singularPackageUnit(packageUnitText: string): string {
  return normalizeText(packageUnitText).replace(/s$/, "");
}

function parseStockProductDraft(text: string): ParsedAssistantMessage | null {
  const commercialPurchase = parseCommercialUnitPurchase(text);
  const stockEntry = parseStockProductDraftParts(text);

  if (!stockEntry && !commercialPurchase) {
    return null;
  }

  const unitCostCents =
    commercialPurchase?.unitCostCents ??
    extractExplicitUnitCostCents(text) ??
    parseOptionalProductMoney(text, productUnitCostPatterns, "Custo para voce");
  const salePriceCents = parseOptionalProductMoney(text, productSalePricePatterns, "Preco de venda");
  const minimumStock = parseOptionalProductQuantity(text, productMinimumStockPatterns, "Estoque minimo");

  if (salePriceCents === null && minimumStock === null && !/^\s*(?:cadastrar|cadastre|cadastra)/i.test(text)) {
    return null;
  }

  try {
    const initialStock = commercialPurchase?.quantity ?? parsePositiveQuantity(stockEntry?.quantityText ?? "", "Estoque inicial");
    const productName = commercialPurchase?.productName ?? normalizeStockProductName(stockEntry?.productName ?? "");
    const draft: ParsedProductDraftRequest = {
      category: null,
      initialStock,
      initialStockSource: commercialPurchase || looksLikePurchaseStockEntry(text) ? "purchase" : undefined,
      kind: "product",
      minimumStock,
      missingFields: [],
      name: productName.length > 0 ? productName : null,
      salePriceCents,
      unit: commercialPurchase?.unit ?? parseProductUnit(`${productName} ${text}`),
      unitCostCents,
    };

    draft.missingFields = missingProductDraftFields(draft);

    return draft;
  } catch (error) {
    return parsedError(error);
  }
}

function looksLikePurchaseStockEntry(text: string): boolean {
  return /\b(?:comprei|compramos|paguei|pagamos|peguei|pegamos|veio|vieram|entrou|entraram|chegou|chegaram)\b/i.test(
    normalizeText(text),
  );
}

function parseStockProductDraftParts(text: string): { productName: string; quantityText: string } | null {
  const productText = removeProductSaleAndMinimumSegments(removePurchaseCostNoise(text));
  const patterns = [
    /^(?:quero\s+)?(?:cadastrar|cadastre|cadastra)(?:\s+(?:pra|para)\s+mim)?\s+(\d+(?:[,.]\d+)?)\s+(.+?)$/i,
    /^(?:coloca|coloque|bota|adicione|adicionar|lanca|lan[çc]a|lance)\s+(?:no|ao|para\s+o)\s+estoque\s+(\d+(?:[,.]\d+)?)\s+(.+?)$/i,
    /^(?:entrou|entraram|chegou|chegaram)\s+(\d+(?:[,.]\d+)?)\s+(.+?)$/i,
    /^comprei\s+(\d+(?:[,.]\d+)?)\s+(.+?)$/i,
  ];
  const match = patterns.map((pattern) => productText.match(pattern)).find(Boolean);

  if (!match) {
    return null;
  }

  return {
    productName: cleanProductName(removeStockEntryNoise(match[2])),
    quantityText: match[1],
  };
}

function parseNaturalPurchaseWithCost(text: string): ParsedAssistantMessage | null {
  const leadingCostMatch = text.match(
    /^cada\s+unidade\s+custou\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\s+(?:para|por)\s+(\d+(?:[,.]\d+)?)\s+(.+?)(?:\s+que\s+(?:entrou|entraram|chegou|chegaram)(?:\s+(?:no|ao|para\s+o)\s+estoque)?)?\.?$/i,
  );

  if (leadingCostMatch) {
    try {
      return {
        kind: "purchase",
        productName: cleanProductName(removeStockEntryNoise(leadingCostMatch[3])),
        quantity: parsePositiveQuantity(leadingCostMatch[2], "Quantidade comprada"),
        unitCostCents: parsePositiveMoneyToCents(leadingCostMatch[1], "Custo por unidade"),
      };
    } catch (error) {
      return parsedError(error);
    }
  }

  const unitCostCents = extractExplicitUnitCostCents(text);

  if (unitCostCents === null) {
    return null;
  }

  const stockEntry = parseStockEntryParts(removePurchaseCostNoise(text));

  if (!stockEntry) {
    return null;
  }

  try {
    return {
      kind: "purchase",
      productName: stockEntry.productName,
      quantity: parsePositiveQuantity(stockEntry.quantityText, "Quantidade comprada"),
      unitCostCents,
    };
  } catch (error) {
    return parsedError(error);
  }
}

function parsePartialPurchase(text: string): ParsedAssistantMessage | null {
  const match = parseStockEntryParts(text);

  if (!match) {
    return null;
  }

  const productName = match.productName;

  if (productName.length === 0) {
    return null;
  }

  try {
    return {
      kind: "partial_purchase",
      productName,
      quantity: parsePositiveQuantity(match.quantityText, "Quantidade comprada"),
      missingFields: ["unitCostCents"],
    };
  } catch (error) {
    return parsedError(error);
  }
}

function commercialUnitFields(source: ParsedCommercialUnitFields): ParsedCommercialUnitFields {
  const fields: ParsedCommercialUnitFields = {};

  if (source.priceBasis) {
    fields.priceBasis = source.priceBasis;
  }

  if (source.unit) {
    fields.unit = source.unit;
  }

  if (source.unitLabel) {
    fields.unitLabel = source.unitLabel;
  }

  return fields;
}

function parseStockEntryParts(text: string): { productName: string; quantityText: string } | null {
  const patterns = [
    /^comprei\s+(\d+(?:[,.]\d+)?)\s+(.+?)\.?$/i,
    /^(?:coloca|coloque|bota|adicione|adicionar|lanca|lan[çc]a|lance)\s+(?:no|ao|para\s+o)\s+estoque\s+(\d+(?:[,.]\d+)?)\s+(.+?)\.?$/i,
    /^(?:coloca|coloque|bota|adicione|adicionar|lanca|lan[çc]a|lance)\s+(\d+(?:[,.]\d+)?)\s+(.+?)(?:\s+que\s+(?:eu\s+)?comprei)?\s+(?:no|ao|para\s+o)\s+estoque\.?$/i,
    /^(?:entrou|entraram|chegou|chegaram)\s+(\d+(?:[,.]\d+)?)\s+(.+?)(?:\s+(?:no|ao|para\s+o)\s+estoque)?\.?$/i,
    /^(?:dei|deu)\s+entrada\s+(?:em\s+)?(\d+(?:[,.]\d+)?)\s+(.+?)(?:\s+(?:no|ao|para\s+o)\s+estoque)?\.?$/i,
    /^abastec(?:e|er|i)\s+(?:o\s+estoque\s+com\s+)?(\d+(?:[,.]\d+)?)\s+(.+?)\.?$/i,
  ];

  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);

  if (!match) {
    return null;
  }

  return {
    productName: cleanProductName(removeStockEntryNoise(match[2])),
    quantityText: match[1],
  };
}

function removeStockEntryNoise(value: string): string {
  return value
    .replace(/\s+que\s+(?:eu\s+)?comprei\b/gi, " ")
    .replace(/\s+(?:eu\s+)?comprei$/gi, " ")
    .replace(/\s+que\s+(?:entrou|entraram|chegou|chegaram)\b/gi, " ")
    .replace(/\s+(?:no|ao|para\s+o)\s+estoque\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStockProductName(value: string): string {
  return value
    .replace(/^(metro|metros)\s+de\s+(.+)$/i, "$2 metro")
    .replace(/^(kg|quilo|quilos)\s+de\s+(.+)$/i, "$2 kg")
    .replace(/\s+/g, " ")
    .trim();
}

function removePurchaseCostNoise(value: string): string {
  return value
    .replace(/\s*,?\s*paguei\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?(?:\s+(?:em\s+)?cada(?:\s+uma(?:\s+delas)?|\s+unidade)?)?.*$/i, "")
    .replace(/\s*,?\s*(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s+em\s+cada(?:\s+uma(?:\s+delas)?|\s+unidade)?.*$/i, "")
    .replace(/\s+(?:por|a)\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s*cada.*$/i, "")
    .replace(/\s+(?:por|a)\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s+a\s+unidade.*$/i, "")
    .replace(/\s+a\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\.?$/i, "")
    .replace(/\s*,?\s*(?:foi|saiu|custou)\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s*cada.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeProductSaleAndMinimumSegments(value: string): string {
  return value
    .replace(/\s+(?:e\s+)?(?:vendo|vender|venda|pre[cç]o(?:\s+de\s+venda)?|valor)\s+(?:por|a)?\s*(?:r\$\s*)?-?\d+(?:[,.]\d+)?(?:\s*(?:real|reais))?.*$/i, "")
    .replace(/\s+(?:estoque\s+)?m[ií]nimo\s+-?\d+(?:[,.]\d+)?.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExplicitUnitCostCents(text: string): number | null {
  const patterns = [
    /paguei\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\s+(?:em\s+)?cada(?:\s+uma(?:\s+delas)?|\s+unidade)?/i,
    /(?:^|\s)(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\s+em\s+cada(?:\s+uma(?:\s+delas)?|\s+unidade)?/i,
    /(?:foi|saiu|custou)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\s+cada/i,
    /cada\s+(?:uma(?:\s+delas)?|unidade)\s+(?:saiu\s+por|custou)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?/i,
    /cada\s+unidade\s+custou\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?/i,
    /(?:por|a)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\s*cada/i,
    /(?:por|a)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\s+a\s+unidade/i,
    /^comprei\s+\d+(?:[,.]\d+)?\s+.+?\s+a\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\.?$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return parsePositiveMoneyToCents(match[1], "Custo por unidade");
    }
  }

  return null;
}

function hasExplicitUnitCostMarker(text: string): boolean {
  return extractExplicitUnitCostCents(text) !== null || /\b(cada|unidade|por\s+unidade)\b/i.test(text);
}

function isAmbiguousPurchaseAmount(quantity: number, amountCents: number): boolean {
  if (quantity <= 1) {
    return false;
  }

  const possibleUnitTotalCents = amountCents / quantity;

  return Number.isInteger(possibleUnitTotalCents) && possibleUnitTotalCents >= 100;
}

function parseProductDraft(text: string): ParsedAssistantMessage | null {
  const match = text.match(
    /^(?:quero\s+)?(?:cadastrar|cadastre|cadastra|criar|cria|adicione|adiciona|adicionar|inclua|incluir|registra|registre|coloca)(?:\s+(?:um|uma|o|a|esse|essa))?(?:\s+produto)?(?:\s+(.+?))?(?:\s+no\s+sistema)?\.?$/i,
  );

  if (!match) {
    return null;
  }

  const body = (match[1] ?? "").trim();

  try {
    const unitCostCents = parseOptionalProductMoney(body, productUnitCostPatterns, "Custo para voce");
    const salePriceCents = parseOptionalProductMoney(body, productSalePricePatterns, "Preco de venda");
    const initialStock = parseOptionalProductQuantity(body, productInitialStockPatterns, "Estoque inicial");
    const minimumStock = parseOptionalProductQuantity(body, productMinimumStockPatterns, "Estoque minimo");
    const name = cleanProductDraftName(body);
    const draft: ParsedProductDraftRequest = {
      kind: "product",
      name: name.length > 0 ? name : null,
      category: null,
      unit: parseProductUnit(body),
      unitCostCents,
      salePriceCents,
      initialStock,
      minimumStock,
      missingFields: [],
    };

    draft.missingFields = missingProductDraftFields(draft);

    return draft;
  } catch (error) {
    return parsedError(error);
  }
}

function parseExpense(text: string): ParsedAssistantMessage | null {
  const directMatch = text.match(
    /^(?:paguei|gastei)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?(?:\s+(?:de|com|em)\s+(.+?))?\.?$/i,
  );
  const reversedMatch = text.match(
    /^(?:paguei|gastei)\s+(.+?)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\.?$/i,
  );
  const purchaseExpenseMatch = text.match(
    /^comprei\s+(.+?)\s+por\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\.?$/i,
  );
  const explicitExpenseMatch = text.match(
    /^tive\s+despesa\s+de\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?(?:\s+(?:de|com|em)\s+(.+?))?\.?$/i,
  );

  const expenseParts = directMatch
    ? { amountText: directMatch[1], descriptionText: directMatch[2] }
    : reversedMatch
      ? { amountText: reversedMatch[2], descriptionText: reversedMatch[1] }
      : purchaseExpenseMatch
        ? { amountText: purchaseExpenseMatch[2], descriptionText: purchaseExpenseMatch[1] }
        : explicitExpenseMatch
          ? { amountText: explicitExpenseMatch[1], descriptionText: explicitExpenseMatch[2] }
          : null;

  if (!expenseParts) {
    return null;
  }

  const description = (expenseParts.descriptionText ?? "despesa sem descrição").trim().toLowerCase();

  try {
    return {
      kind: "expense",
      description,
      category: suggestExpenseCategory(description),
      amountCents: parsePositiveMoneyToCents(expenseParts.amountText, "Valor da despesa"),
    };
  } catch (error) {
    return parsedError(error);
  }
}

const productNumberPattern = "-?\\d+(?:[,.]\\d+)?";
const productUnitCostPatterns = [
  new RegExp(`(?:^|\\s)(?:custo|custa)\\s+(?:r\\$\\s*)?(${productNumberPattern})`, "i"),
];
const productSalePricePatterns = [
  new RegExp(
    `(?:^|\\s)(?:pre[cç]o(?:\\s+de\\s+venda)?|venda|vendo|valor)\\s+(?:por|a)?\\s*(?:r\\$\\s*)?(${productNumberPattern})`,
    "i",
  ),
];
const productInitialStockPatterns = [
  new RegExp(`(?:^|\\s)estoque(?:\\s+inicial)?\\s+(${productNumberPattern})`, "i"),
];
const productMinimumStockPatterns = [
  new RegExp(`(?:^|\\s)(?:estoque\\s+m[ií]nimo|m[ií]nimo|minima)\\s+(${productNumberPattern})`, "i"),
];
const productUnitWordPattern =
  "(?:unidade|unidades|unit|kg|quilo|quilos|kilo|kilos|g|grama|gramas|litro|litros|l|ml|mililitro|mililitros|metro|metros|m|m2|m²|metro\\s+quadrado|metros\\s+quadrados|m3|m³|metro\\s+c[úu]bico|metros\\s+c[úu]bicos|caixa|caixas|saco|sacos|fardo|fardos|pacote|pacotes|duzia|duzias|dúzia|dúzias|peca|pecas|peça|peças)";
const productFieldSegments = [
  /\b(?:custo|custa)\s+(?:r\$\s*)?-?\d+(?:[,.]\d+)?(?:\s*(?:real|reais))?/gi,
  /\b(?:pre[cç]o(?:\s+de\s+venda)?|venda|vendo|valor)\s+(?:por|a)?\s*(?:r\$\s*)?-?\d+(?:[,.]\d+)?(?:\s*(?:real|reais))?/gi,
  /\bestoque\s+m[ií]nimo\s+-?\d+(?:[,.]\d+)?/gi,
  /\bestoque(?:\s+inicial)?\s+-?\d+(?:[,.]\d+)?/gi,
  /\b(?:m[ií]nimo|minima)\s+-?\d+(?:[,.]\d+)?/gi,
  new RegExp(`\\b(?:unidade|medida)\\s+${productUnitWordPattern}\\b`, "gi"),
  new RegExp(`\\b(?:por|em)\\s+${productUnitWordPattern}\\b`, "gi"),
  /\b(?:no|para\s+o)\s+sistema\b/gi,
  /\b(?:esse|essa|este|esta)\s+produto\b/gi,
];

function parseOptionalProductMoney(text: string, patterns: RegExp[], fieldName: string): number | null {
  const value = extractFirstPatternValue(text, patterns);

  return value === null ? null : parseBrazilianMoneyToCents(value, fieldName);
}

function parseOptionalProductQuantity(text: string, patterns: RegExp[], fieldName: string): number | null {
  const value = extractFirstPatternValue(text, patterns);

  return value === null ? null : parseBrazilianQuantity(value, fieldName);
}

function extractFirstPatternValue(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function parseProductUnit(text: string): ParsedProductDraftRequest["unit"] {
  return inferProductUnit(text);
}

function cleanProductDraftName(text: string): string {
  let name = text.trim();

  for (const segment of productFieldSegments) {
    name = name.replace(segment, " ");
  }

  return name.replace(/[.?!]+$/g, "").replace(/\s+/g, " ").trim();
}

function missingProductDraftFields(draft: ParsedProductDraftRequest): ProductDraftMissingField[] {
  const missingFields: ProductDraftMissingField[] = [];

  if (!draft.name) {
    missingFields.push("name");
  }

  if (draft.unitCostCents === null) {
    missingFields.push("unitCostCents");
  }

  if (draft.salePriceCents === null) {
    missingFields.push("salePriceCents");
  }

  if (draft.initialStock === null) {
    missingFields.push("initialStock");
  }

  if (draft.minimumStock === null) {
    missingFields.push("minimumStock");
  }

  return missingFields;
}

function calculateUnitPriceFromTotal(totalAmountCents: number, quantity: number): number {
  const unitPriceCents = totalAmountCents / quantity;

  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents <= 0) {
    throw new Error("Total da venda precisa dividir corretamente pela quantidade.");
  }

  return unitPriceCents;
}

function parsePositiveQuantity(value: string, fieldName: string): number {
  const quantity = parseBrazilianQuantity(value, fieldName);

  if (quantity <= 0) {
    throw new Error(`${fieldName} precisa ser maior que zero.`);
  }

  return quantity;
}

function parsePositiveAssistantQuantity(value: string, fieldName: string): number {
  const normalized = normalizeText(value);

  if (normalized === "um" || normalized === "uma") {
    return 1;
  }

  return parsePositiveQuantity(value, fieldName);
}

function parsePositiveMoneyToCents(value: string, fieldName: string): number {
  const cents = parseBrazilianMoneyToCents(value, fieldName);

  if (cents <= 0) {
    throw new Error(`${fieldName} precisa ser maior que zero.`);
  }

  return cents;
}

function parsedError(error: unknown): ParsedAssistantMessage {
  return {
    kind: "unknown",
    message: error instanceof Error && error.message.trim().length > 0 ? error.message : unknownMessage,
  };
}

function suggestExpenseCategory(description: string): ExpenseCategoryValue {
  const normalized = normalizeText(description);

  if (/perda|perdi|perdido|estragou|estragado|quebrou|quebrado|venceu|vencido|desperdic/.test(normalized)) {
    return "LOSS_WASTE";
  }

  if (/carne|queijo|pao|massa|ingrediente|mercadoria|insumo/.test(normalized)) {
    return "MERCHANDISE_SUPPLIES";
  }

  if (/energia|luz|agua|internet|telefone/.test(normalized)) {
    return "UTILITIES";
  }

  if (/aluguel/.test(normalized)) {
    return "RENT";
  }

  if (/transporte|logistica|frete|combustivel|gasolina|uber|onibus|entrega|deslocamento/.test(normalized)) {
    return "TRANSPORT_LOGISTICS";
  }

  if (/embalagem|sacola|caixa|isopor|pacote|material/.test(normalized)) {
    return "PACKAGING_MATERIAL";
  }

  if (/manutencao|conserto|reparo/.test(normalized)) {
    return "MAINTENANCE";
  }

  if (/taxa|imposto|maquininha|tarifa/.test(normalized)) {
    return "TAXES_FEES";
  }

  if (/salario|diaria|diarista|ajudante|funcionario|mao de obra/.test(normalized)) {
    return "LABOR";
  }

  if (/marketing|anuncio|publicidade|panfleto|divulgacao/.test(normalized)) {
    return "MARKETING";
  }

  return "OTHER";
}

function cleanProductName(value: string): string {
  return cleanAssistantProductName(value);
}

function isMissingSaleProductName(productName: string): boolean {
  return /^(?:unidade|unidades|item|itens|produto|produtos|coisa|coisas)$/.test(normalizeText(productName));
}

function parseStockLoss(text: string): ParsedAssistantMessage | null {
  const normalized = normalizeText(text);

  if (
    !/\b(perdi|perdeu|perda|estragou|estragaram|quebrou|quebraram|venceu|venceram|vencido|joguei fora|jogou fora|desperdicei|desperdicio)\b/.test(
      normalized,
    )
  ) {
    return null;
  }

  const match =
    text.match(/\b(?:perdi|perdeu|perda|estragou|estragaram|quebrou|quebraram|venceu|venceram|joguei fora|jogou fora|desperdicei)\s+(\d+(?:[,.]\d+)?)\s+(.+?)(?:\s+que\s+(.+)|\s+porque\s+(.+)|\s+por\s+(.+))?$/i) ??
    text.match(/\b(\d+(?:[,.]\d+)?)\s+(.+?)\s+(?:perdi|perdeu|estragou|estragaram|quebrou|quebraram|venceu|venceram)\b(?:\s+(.+))?$/i);

  if (!match) {
    return null;
  }

  const productName = cleanProductName(match[2]);

  if (!productName) {
    return null;
  }

  return {
    kind: "stock_loss",
    productName,
    quantity: parsePositiveQuantity(match[1], "Quantidade perdida"),
    reason: cleanLossReason(match[3] ?? match[4] ?? match[5] ?? "perda informada pelo usuário"),
  };
}

function parseCancellation(text: string): ParsedAssistantMessage | null {
  const normalized = normalizeText(text);

  if (!/\b(cancela|cancelar|cancele|corrige|corrigir|corrija|estorna|estornar|estorne|desfaz|desfazer|desfaca)\b/.test(normalized)) {
    return null;
  }

  const targetType = /\b(venda|vendi|saida)\b/.test(normalized)
    ? "sale"
    : /\b(compra|comprei|entrada)\b/.test(normalized)
      ? "purchase"
      : /\b(despesa|gasto|gastei|paguei)\b/.test(normalized)
        ? "expense"
        : null;

  if (!targetType) {
    return null;
  }

  const productMatch =
    text.match(/\b(?:de|da|do)\s+(.+?)\s+(?:que|q)\s+(?:fiz|lancei|registrei|foi)/i) ??
    text.match(/\b(?:venda|compra|despesa|gasto)\s+(?:de|da|do)\s+(.+?)(?:\s+(?:agora|hoje|que|q)\b|$)/i);
  const productName = productMatch?.[1] ? cleanCancellationProductName(productMatch[1]) : undefined;

  return {
    kind: "cancellation",
    productName,
    reason: "solicitado pelo usuário",
    targetType,
  };
}

function cleanLossReason(value: string): string {
  return value
    .trim()
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ") || "perda informada pelo usuário";
}

function cleanCancellationProductName(value: string): string | undefined {
  const productName = cleanProductName(value);
  const normalized = normalizeText(productName);

  if (!productName || /^(?:agora|hoje|ontem|ultima|ultimo|recente)$/.test(normalized)) {
    return undefined;
  }

  return productName;
}

function isUnsupportedServiceRevenue(value: string): boolean {
  const normalized = normalizeText(value);
  const serviceWords = "(?:corte(?:\\s+de\\s+cabelo)?|consulta|instalacao|manutencao|frete|limpeza|honorario)";

  return (
    new RegExp(
      `^(?:fiz|realizei)\\s+(?:um|uma)?\\s*${serviceWords}\\b.*\\b(?:de|por)\\s+(?:r\\$\\s*)?\\d+(?:[,.]\\d{1,2})?(?:\\s*(?:real|reais))?$`,
    ).test(normalized) ||
    new RegExp(
      `^(?:recebi|ganhei|cobrei)\\s+(?:r\\$\\s*)?\\d+(?:[,.]\\d{1,2})?(?:\\s*(?:real|reais))?(?:\\s+(?:de|com|por)\\s+${serviceWords})?$`,
    ).test(normalized)
  );
}

function isUnsupportedStockLoss(value: string): boolean {
  const normalized = normalizeText(value);

  if (/\b(?:r\$|real|reais)\b/.test(normalized)) {
    return false;
  }

  return /\b(perdi|perdeu|perda|estragou|estragaram|quebrou|quebraram|venceu|venceram|vencido|joguei fora|jogou fora|desperdicei|desperdicio)\b/.test(
    normalized,
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[?!.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAssistantInputText(value: string): string {
  return value
    .replace(/\bcadatra\b/gi, "cadastra")
    .replace(/\bconprei\b/gi, "comprei")
    .replace(/\bvedi\b/gi, "vendi")
    .replace(/\bpego\b/gi, "pegou");
}
