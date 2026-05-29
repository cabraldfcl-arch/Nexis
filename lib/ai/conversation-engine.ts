import type { ExpenseCategoryValue } from "@/lib/validation/expense";
import { parseBrazilianMoneyToCents, parseBrazilianQuantity, type ProductUnitValue } from "@/lib/validation/product";
import {
  detectCommercialUnit,
  detectExplicitProductUnit,
  parseCommercialUnitPurchase,
  parseCommercialUnitSale,
} from "./commercial-units";

export type AssistantConversationIntent =
  | "dangerous"
  | "expense"
  | "financial_question"
  | "product_registration"
  | "purchase_entry"
  | "sale_exit"
  | "social"
  | "unknown";

export type AssistantConfidence = "HIGH" | "LOW" | "MEDIUM";

export type NormalizedUserMessage = {
  normalized: string;
  original: string;
  tokens: string[];
};

export type ExtractedEntities = {
  amountCents?: number;
  amountKind?: "ambiguous" | "total" | "unit";
  expenseCategory?: ExpenseCategoryValue;
  minimumStock?: number;
  period?: "month" | "today";
  productName?: string;
  quantity?: number;
  salePriceCents?: number;
  unit?: ProductUnitValue;
  unitCostCents?: number;
  unitLabel?: string;
  priceBasis?: string;
  variant?: string;
};

export type ProductResolutionProduct = {
  name: string;
};

export type ProductResolution<TProduct extends ProductResolutionProduct> =
  | {
      status: "ambiguous_match";
      matches: TProduct[];
    }
  | {
      status: "no_match";
      matches: [];
    }
  | {
      status: "unique_match";
      matches: [TProduct];
      product: TProduct;
    };

export type NextQuestionPlan =
  | {
      question: "amount_total_or_unit";
    }
  | {
      question: "minimum_stock";
    }
  | {
      question: "product_disambiguation";
    }
  | {
      question: "sale_price";
    }
  | {
      question: "unit_cost";
    }
  | {
      question: null;
    };

export type MultipleActionsAnalysis = {
  actions: Array<"expense" | "product_registration" | "purchase_entry" | "sale_exit">;
  hasMultipleActions: boolean;
};

const assistantQuantityPattern = "(?:\\d+(?:[,.]\\d+)?|um|uma)";

export function normalizeUserMessage(message: string): NormalizedUserMessage {
  const normalized = normalizeCommonAssistantTypos(message)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[?!]+/g, " ")
    .replace(/\.(?=\s|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized
    .replace(/r\$/g, " ")
    .replace(/[^a-z0-9,.]+/g, " ")
    .split(/\s+/)
    .flatMap((token) => token.split(/(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/))
    .filter(Boolean);

  return { normalized, original: message, tokens };
}

export function classifyIntent(message: string): AssistantConversationIntent {
  const normalized = normalizeUserMessage(message).normalized;

  if (normalized.length === 0) {
    return "unknown";
  }

  if (isDangerousCommandText(normalized)) {
    return "dangerous";
  }

  if (isSocialMessage(normalized)) {
    return "social";
  }

  if (isPurchaseAction(normalized)) {
    return "purchase_entry";
  }

  if (isSaleAction(normalized)) {
    return "sale_exit";
  }

  if (isExpenseAction(normalized)) {
    return "expense";
  }

  if (isProductRegistrationAction(normalized)) {
    return "product_registration";
  }

  if (isFinancialQuestion(normalized)) {
    return "financial_question";
  }

  return "unknown";
}

export function detectMultipleActions(message: string): MultipleActionsAnalysis {
  const normalized = normalizeUserMessage(message).normalized;
  const purchase = isPurchaseAction(normalized);
  const sale = isSaleAction(normalized);
  const expense = isExpenseAction(normalized);
  const productRegistration = !purchase && isProductRegistrationAction(normalized);
  const actions = [
    purchase ? "purchase_entry" : null,
    sale ? "sale_exit" : null,
    expense ? "expense" : null,
    productRegistration ? "product_registration" : null,
  ].filter((action): action is MultipleActionsAnalysis["actions"][number] => action !== null);

  return { actions, hasMultipleActions: actions.length > 1 };
}

export function assessConversationConfidence(message: string): AssistantConfidence {
  const multipleActions = detectMultipleActions(message);

  if (multipleActions.hasMultipleActions) {
    return "LOW";
  }

  const intent = classifyIntent(message);

  if (intent === "unknown") {
    return "LOW";
  }

  if (intent === "dangerous" || intent === "social" || intent === "financial_question") {
    return "HIGH";
  }

  const entities = extractEntities(message, intent);

  if (intent === "purchase_entry") {
    if (entities.amountKind === "ambiguous") {
      return "MEDIUM";
    }

    if (entities.productName && entities.quantity && entities.unitCostCents) {
      return "HIGH";
    }

    return entities.productName || entities.quantity || entities.unitCostCents ? "MEDIUM" : "LOW";
  }

  if (intent === "sale_exit") {
    return entities.productName && entities.quantity ? "HIGH" : "MEDIUM";
  }

  if (intent === "expense") {
    return entities.amountCents || entities.expenseCategory ? "MEDIUM" : "LOW";
  }

  if (intent === "product_registration") {
    return entities.productName ? "MEDIUM" : "LOW";
  }

  return "MEDIUM";
}

export function socialResponseForMessage(message: string): string {
  const normalized = normalizeUserMessage(message).normalized;

  if (/\bo\s+que\s+voce\s+faz\b|\bvoce\s+faz\s+o\s+que\b|\bcomo\s+voce\s+ajuda\b/.test(normalized)) {
    return "Eu ajudo você a registrar produtos, compras, vendas, despesas e consultar vendas, lucro e estoque.";
  }

  if (/\b(?:voce\s+)?pode\s+me\s+ajudar\b|\bme\s+ajuda\b/.test(normalized)) {
    return "Posso ajudar sim. Você pode me pedir para cadastrar produtos, registrar compras, vendas, despesas ou consultar lucro e estoque.";
  }

  if (/\btudo\s+bem\b/.test(normalized)) {
    return "Tudo bem. Como posso te ajudar no seu negócio hoje?";
  }

  if (/\bboa\s+tarde\b/.test(normalized)) {
    return "Boa tarde! Posso te ajudar a cadastrar produtos, registrar compras, vendas, despesas ou consultar lucro e estoque.";
  }

  if (/\bbom\s+dia\b/.test(normalized)) {
    return "Bom dia! Posso te ajudar a cadastrar produtos, registrar compras, vendas, despesas ou consultar lucro e estoque.";
  }

  if (/\bboa\s+noite\b/.test(normalized)) {
    return "Boa noite! Posso te ajudar a cadastrar produtos, registrar compras, vendas, despesas ou consultar lucro e estoque.";
  }

  return "Olá! Posso te ajudar a cadastrar produtos, registrar compras, vendas, despesas ou consultar lucro e estoque.";
}

export function extractEntities(
  message: string,
  intent: AssistantConversationIntent = classifyIntent(message),
): ExtractedEntities {
  const commercialPurchase = intent === "purchase_entry" ? parseCommercialUnitPurchase(message) : null;
  const commercialSale = intent === "sale_exit" ? parseCommercialUnitSale(message) : null;
  const commercial = commercialPurchase ?? commercialSale;
  const quantity = commercial?.quantity ?? extractQuantity(message, intent);
  const productName = commercial?.productName ?? extractProductName(message, intent, quantity);
  const purchaseAmount = commercialPurchase?.unitCostCents
    ? {
        amountCents: commercialPurchase.unitCostCents,
        amountKind: "unit" as const,
        unitCostCents: commercialPurchase.unitCostCents,
      }
    : intent === "purchase_entry"
      ? extractPurchaseAmount(message, quantity)
      : {};
  const expense = intent === "expense" ? extractExpenseEntities(message) : {};
  const productSource = productName ?? message;
  const inferredProductRegistrationUnit =
    intent === "product_registration" ? inferProductUnit(productSource) : undefined;
  const commercialUnit = commercial;

  return {
    ...expense,
    ...purchaseAmount,
    period: extractPeriod(message),
    priceBasis: commercialUnit?.priceBasis,
    productName,
    quantity,
    unit: commercialUnit?.unit ?? inferredProductRegistrationUnit,
    unitLabel: commercialUnit?.unitLabel,
    variant: extractProductVariant(productSource),
  };
}

export function resolveProduct<TProduct extends ProductResolutionProduct>(
  productName: string,
  products: TProduct[],
): ProductResolution<TProduct> {
  const matches = products.filter((product) => productMatches(productName, product.name));

  if (matches.length === 0) {
    return { status: "no_match", matches: [] };
  }

  if (matches.length === 1) {
    return { status: "unique_match", matches: [matches[0]], product: matches[0] };
  }

  return { status: "ambiguous_match", matches };
}

export function nextQuestionPlanner({
  amountKind,
  missingFields = [],
  productResolution,
}: {
  amountKind?: ExtractedEntities["amountKind"];
  missingFields?: string[];
  productResolution?: ProductResolution<ProductResolutionProduct>;
}): NextQuestionPlan {
  if (productResolution?.status === "ambiguous_match") {
    return { question: "product_disambiguation" };
  }

  if (amountKind === "ambiguous") {
    return { question: "amount_total_or_unit" };
  }

  if (missingFields.includes("unitCostCents")) {
    return { question: "unit_cost" };
  }

  if (missingFields.includes("salePriceCents")) {
    return { question: "sale_price" };
  }

  if (missingFields.includes("minimumStock")) {
    return { question: "minimum_stock" };
  }

  return { question: null };
}

export function cleanAssistantProductName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[.?!]+$/g, "")
    .replace(/[-]+/g, " ")
    .replace(/\b(?:em|no|na|ao|para\s+o)\s+(?=lata|garrafa|pet|caixa|pacote|unidade|kg|quilo|litro|\d)/gi, " ")
    .replace(/\b(?:pro|pra|para)\s+(?:meu|minha|o|a)?\s*cliente\b.*$/gi, " ")
    .replace(/\bcliente\b.*$/gi, " ")
    .replace(/\b(?:dela|dele|delas|deles)\b/gi, " ")
    .replace(/\b(?:cadastra|cadastre|cadastrar|registra|registre|lan[çc]a|lance)\b.*$/gi, " ")
    .replace(/\b(?:por\s+favor|este\s+produto|esse\s+produto)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return cleaned;
}

export function productMatches(query: string, productName: string): boolean {
  const queryTokens = tokenizeForProductSearch(query);
  const productTokens = tokenizeForProductSearch(productName);

  if (queryTokens.length === 0 || productTokens.length === 0) {
    return false;
  }

  return queryTokens.every((queryToken) =>
    productTokens.some(
      (productToken) =>
        productToken === queryToken ||
        productToken.includes(queryToken) ||
        queryToken.includes(productToken),
    ),
  );
}

export function tokenizeForProductSearch(value: string): string[] {
  return normalizeForProductSearch(value)
    .split(" ")
    .flatMap((token) => expandSearchToken(singularizeToken(token)))
    .filter((token) => token.length > 1 && !productSearchStopWords.has(token));
}

export function normalizeForProductSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferProductUnit(value: string): ProductUnitValue {
  const explicitProductUnit = detectExplicitProductUnit(value);

  if (explicitProductUnit) {
    return explicitProductUnit.unit;
  }

  const commercialUnit = detectCommercialUnit(value);

  if (commercialUnit) {
    return commercialUnit.unit;
  }

  const normalized = normalizeUserMessage(value).normalized;

  if (/\b(kg|quilo|quilos|kilo|kilos)\b/.test(normalized)) {
    return "KG";
  }

  if (/\b(g|grama|gramas)\b/.test(normalized)) {
    return "GRAM";
  }

  if (/\b(litro|litros|ml|mililitro|mililitros)\b|\b\d+(?:[,.]\d+)?\s*l\b/.test(normalized)) {
    return "LITER";
  }

  if (/\b(metro|metros|m)\b/.test(normalized)) {
    return "METER";
  }

  if (/\b(m2|m²|metro quadrado)\b/.test(normalized)) {
    return "SQUARE_METER";
  }

  if (/\b(m3|m³|metro cubico|metro cúbico)\b/.test(normalized)) {
    return "CUBIC_METER";
  }

  if (/\b(caixa|caixas)\b/.test(normalized)) {
    return "BOX";
  }

  if (/\b(saco|sacos)\b/.test(normalized)) {
    return "SACK";
  }

  if (/\b(fardo|fardos)\b/.test(normalized)) {
    return "BALE";
  }

  if (/\b(pacote|pacotes)\b/.test(normalized)) {
    return "PACKAGE";
  }

  if (/\b(duzia|duzias|dúzia|dúzias)\b/.test(normalized)) {
    return "DOZEN";
  }

  return "UNIT";
}

function extractProductName(
  message: string,
  intent: AssistantConversationIntent,
  quantity: number | undefined,
): string | undefined {
  if (intent === "purchase_entry") {
    return extractPurchaseProductName(message, quantity);
  }

  if (intent === "sale_exit") {
    return extractSaleProductName(message);
  }

  if (intent === "product_registration") {
    return extractProductRegistrationName(message);
  }

  return undefined;
}

function extractPurchaseProductName(message: string, quantity: number | undefined): string | undefined {
  const text = removePurchaseCostSegments(message);
  const quantityPattern = quantity ? escapeRegExp(formatNumberForPattern(quantity)) : assistantQuantityPattern;
  const patterns = [
    new RegExp(
      `(?:quero\\s+)?(?:cadastrar|cadastre|cadastra|registrar|registra)(?:\\s+(?:pra|para)\\s+mim)?\\s+${quantityPattern}\\s+(.+?)(?:\\s+que\\s+(?:eu\\s+)?(?:comprei|paguei)\\b|,|$|\\s+(?:a|por|paguei|cadastra|cadastre)\\b)`,
      "i",
    ),
    new RegExp(
      `(?:compra\\s+que\\s+(?:eu\\s+)?fiz|compra|entrada)\\s+(?:de\\s+)?${quantityPattern}\\s+(.+?)(?:,|$|\\s+(?:a|por|paguei|cadastra|cadastre)\\b)`,
      "i",
    ),
    new RegExp(`(?:comprei|comprou)\\s+${quantityPattern}\\s+(.+?)(?:,|$|\\s+(?:a|por|paguei|cada|total)\\b)`, "i"),
    new RegExp(
      `^(?:quero\\s+)?(?:cadastre|cadastrar|cadastra|registre|registrar)(?:\\s+(?:pra|para)\\s+mim)?\\s+(.+?),\\s*comprei\\s+${assistantQuantityPattern}\\b`,
      "i",
    ),
    new RegExp(
      `(?:coloca|coloque|bota|adicione|adicionar|lan[çc]a|lance)\\s+(?:no|ao|para\\s+o)\\s+estoque\\s+${quantityPattern}\\s+(.+?)(?:\\s+que\\s+(?:eu\\s+)?comprei)?(?:,|$)`,
      "i",
    ),
    new RegExp(
      `(?:coloca|coloque|bota|adicione|adicionar|lan[çc]a|lance)\\s+${quantityPattern}\\s+(.+?)(?:\\s+que\\s+(?:eu\\s+)?comprei)?(?:\\s+(?:no|ao|para\\s+o)\\s+estoque)?(?:,|$)`,
      "i",
    ),
    new RegExp(
      `(?:entrou|entraram|chegou|chegaram|dei\\s+entrada\\s+em|deu\\s+entrada\\s+em)\\s+${quantityPattern}\\s+(.+?)(?:\\s+(?:no|ao|para\\s+o)\\s+estoque)?(?:,|$)`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const productName = match?.[1] ? cleanAssistantProductName(removeStockEntryNoise(match[1])) : "";

    if (productName.length > 0) {
      return productName;
    }
  }

  return undefined;
}

function extractSaleProductName(message: string): string | undefined {
  const saleActionPattern =
    "(?:vendi|(?:o\\s+)?cliente\\s+levou|(?:o\\s+)?cliente\\s+comprou|(?:o\\s+)?cliente\\s+pegou|levou|saiu|baixou|dei\\s+saida(?:\\s+em)?)";
  const match = message.match(
    new RegExp(`\\b${saleActionPattern}\\s+${assistantQuantityPattern}\\s+(.+?)(?:\\s+por\\b|\\s+no\\s+total\\b|$)`, "i"),
  );
  const productName = match?.[1] ? cleanAssistantProductName(match[1]) : "";

  return productName.length > 0 ? productName : undefined;
}

function extractProductRegistrationName(message: string): string | undefined {
  const match = message.match(
    /^(?:quero\s+)?(?:cadastrar|cadastre|cadastra|criar|cria|adicione|adicionar|inclua|incluir)(?:\s+(?:um|uma|o|a))?(?:\s+produto)?(?:\s+(.+?))?\.?$/i,
  );
  const productName = match?.[1]
    ? cleanAssistantProductName(removeProductFieldSegments(match[1]))
    : cleanAssistantProductName(removeProductFieldSegments(message));

  return productName.length > 0 ? productName : undefined;
}

function extractQuantity(message: string, intent: AssistantConversationIntent): number | undefined {
  if (intent !== "purchase_entry" && intent !== "sale_exit") {
    return undefined;
  }

  const quantityPatterns = [
    new RegExp(`\\b(?:comprei|vendi|compra\\s+de|entrada\\s+de|deu\\s+entrada\\s+em|dei\\s+entrada\\s+em)\\s+(${assistantQuantityPattern})\\b`, "i"),
    new RegExp(`\\b(?:compra\\s+que\\s+(?:eu\\s+)?fiz|lan[çc]ar\\s+uma\\s+compra)\\s+de\\s+(${assistantQuantityPattern})\\b`, "i"),
    new RegExp(
      `\\b(?:quero\\s+)?(?:cadastrar|cadastre|cadastra|registrar|registra)(?:\\s+(?:pra|para)\\s+mim)?\\s+(${assistantQuantityPattern})\\b`,
      "i",
    ),
    new RegExp(`,\\s*comprei\\s+(${assistantQuantityPattern})\\b`, "i"),
    new RegExp(`\\b(?:coloca|coloque|bota|adicione|adicionar|lan[çc]a|lance|entrou|entraram|chegou|chegaram)\\s+(${assistantQuantityPattern})\\b`, "i"),
    new RegExp(`\\b(?:coloca|coloque|bota|adicione|adicionar|lan[çc]a|lance)\\s+(?:no|ao|para\\s+o)\\s+estoque\\s+(${assistantQuantityPattern})\\b`, "i"),
    new RegExp(`\\b(?:o\\s+)?cliente\\s+(?:levou|comprou|pegou)\\s+(${assistantQuantityPattern})\\b`, "i"),
  ];

  for (const pattern of quantityPatterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      return parseAssistantQuantity(match[1]);
    }
  }

  return undefined;
}

function extractPurchaseAmount(message: string, quantity: number | undefined): ExtractedEntities {
  const explicitUnitCostCents = extractExplicitUnitCostCents(message);

  if (explicitUnitCostCents !== null) {
    return { amountCents: explicitUnitCostCents, amountKind: "unit", unitCostCents: explicitUnitCostCents };
  }

  const totalMatch = message.match(
    /(?:por|total(?:\s+de)?|paguei)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\s+total\b|\btotal\s+(?:de\s+)?(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?/i,
  );

  if (totalMatch && quantity) {
    const amountCents = parsePositiveMoney(totalMatch[1] ?? totalMatch[2]);
    const unitCostCents = amountCents / quantity;

    return Number.isSafeInteger(unitCostCents) && unitCostCents > 0
      ? { amountCents, amountKind: "total", unitCostCents }
      : { amountCents, amountKind: "total" };
  }

  const genericAmount = message.match(
    /\bpor\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?(?:\s|$)/i,
  );

  if (genericAmount?.[1]) {
    const amountCents = parsePositiveMoney(genericAmount[1]);

    if (quantity && quantity > 1 && isPotentialTotalOrUnitAmount(quantity, amountCents)) {
      return { amountCents, amountKind: "ambiguous" };
    }

    return { amountCents, amountKind: "unit", unitCostCents: amountCents };
  }

  return {};
}

function extractExpenseEntities(message: string): ExtractedEntities {
  const directMatch = message.match(
    /^(?:paguei|gastei)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?(?:\s+(?:de|com|em)\s+(.+?))?\.?$/i,
  );
  const reversedMatch = message.match(
    /^(?:paguei|gastei)\s+(.+?)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\.?$/i,
  );
  const purchaseExpenseMatch = message.match(
    /^comprei\s+(.+?)\s+por\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?\.?$/i,
  );
  const explicitExpenseMatch = message.match(
    /^tive\s+despesa\s+de\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?(?:\s+(?:de|com|em)\s+(.+?))?\.?$/i,
  );
  const parts = directMatch
    ? { amountText: directMatch[1], description: directMatch[2] }
    : reversedMatch
      ? { amountText: reversedMatch[2], description: reversedMatch[1] }
      : purchaseExpenseMatch
        ? { amountText: purchaseExpenseMatch[2], description: purchaseExpenseMatch[1] }
        : explicitExpenseMatch
          ? { amountText: explicitExpenseMatch[1], description: explicitExpenseMatch[2] }
          : null;

  if (!parts) {
    return {};
  }

  const description = parts.description?.trim() ?? "";

  return {
    amountCents: parsePositiveMoney(parts.amountText),
    expenseCategory: suggestExpenseCategory(description),
  };
}

function suggestExpenseCategory(description: string): ExpenseCategoryValue {
  const normalized = normalizeUserMessage(description).normalized;

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

  if (/perda|perdi|perdido|estragou|estragado|quebrou|quebrado|venceu|vencido|desperdic/.test(normalized)) {
    return "LOSS_WASTE";
  }

  return "OTHER";
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
      return parsePositiveMoney(match[1]);
    }
  }

  return null;
}

function extractProductVariant(productName: string): string | undefined {
  const normalized = normalizeUserMessage(productName).normalized;
  const packageMatch = normalized.match(/\b(lata|garrafa|pet|caixa|pacote|unidade|metro|saco|fardo)\b/);
  const attachedVolumeMatch = normalized.match(/\b(\d+(?:[,.]\d+)?(?:ml|kg|g|l))\b/);
  const volumeMatch = normalized.match(/\b(\d+(?:[,.]\d+)?)\s*(ml|l|litro|litros|kg|g|gramas)\b/);
  const looseUnitMatch = normalized.match(/\b(kg|quilo|quilos)\b/);
  const parts = [
    packageMatch?.[1],
    attachedVolumeMatch?.[1] ?? (volumeMatch ? `${volumeMatch[1]} ${volumeMatch[2]}` : looseUnitMatch?.[1]),
  ]
    .filter(Boolean)
    .map((part) => String(part).replace(/\blitros?\b/, "litro"));

  return parts.length > 0 ? parts.join(" ") : undefined;
}

function extractPeriod(message: string): "month" | "today" {
  const normalized = normalizeUserMessage(message).normalized;

  return /\b(hoje|dia|neste\s+dia|nesse\s+dia|do\s+dia)\b/.test(normalized) ? "today" : "month";
}

function isDangerousCommandText(normalized: string): boolean {
  return (
    /\b(cancelar|cancela|cancele|corrigir|corrige|corrija|estornar|estorna|estorne|desfazer|desfaz|desfaca|apaga|apague|apagar|exclui|excluir|exclua|deleta|deletar|delete|remover|remove|remova)\b/.test(
      normalized,
    ) ||
    /lucro\s+maior|coloca\s+lucro|aumenta\s+lucro|altera\s+lucro/.test(normalized) ||
    /ignora(?:r)?\s+(?:o\s+)?custo/.test(normalized) ||
    /salva(?:r)?\s+sem\s+confirmar|sem\s+confirmacao|confirma(?:r)?\s+sozinh/.test(normalized) ||
    /vend(?:e|er|a).*\bsem\s+estoque\b/.test(normalized)
  );
}

function isSocialMessage(normalized: string): boolean {
  if (isSaleAction(normalized) || isPurchaseAction(normalized) || isExpenseAction(normalized)) {
    return false;
  }

  return (
    /^(oi|ola|olá|bom\s+dia|boa\s+tarde|boa\s+noite)(?:\s+.+)?$/.test(normalized) ||
    /^(tudo\s+bem|como\s+vai|beleza)\??$/.test(normalized) ||
    /^(o\s+que\s+voce\s+faz|voce\s+faz\s+o\s+que|como\s+voce\s+pode\s+ajudar|voce\s+pode\s+me\s+ajudar|pode\s+me\s+ajudar)\??$/.test(
      normalized,
    )
  );
}

function isSaleAction(normalized: string): boolean {
  if (isQuestionLike(normalized)) {
    return false;
  }

  if (/\bresumo\b/.test(normalized) && /\b(vendi|vendas?|lucro|hoje|dia|mes)\b/.test(normalized)) {
    return false;
  }

  if (/\bcada\s+(?:uma|unidade)\s+saiu\s+por\b/.test(normalized)) {
    return false;
  }

  return /\b(vendi|saiu|baixou|dei\s+saida|cliente\s+(?:comprou|levou|pegou)|levou)\b/.test(normalized);
}

function isPurchaseAction(normalized: string): boolean {
  if (isQuestionLike(normalized)) {
    return false;
  }

  if (/\bcliente\s+comprou\b/.test(normalized)) {
    return false;
  }

  if (isExpensePurchaseText(normalized)) {
    return false;
  }

  return (
    /\b(comprei|comprou|peguei|veio|vieram|compra\s+que|compra\s+de|lancar\s+uma\s+compra|lanca\s+uma\s+compra|entrada\s+de|dei\s+entrada|deu\s+entrada|entrou|entraram|chegou|chegaram|coloca(?:r)?\s+no\s+estoque|bota\s+no\s+estoque|coloca\s+\d+|coloque\s+\d+|bota\s+\d+|abastece)\b/.test(
      normalized,
    ) ||
    /\b(?:cadastrar|cadastre|cadastra|registrar|registra|lancar|lanca).*\bcompra\b/.test(normalized) ||
    /\b(?:cadastrar|cadastre|cadastra|registrar|registra)(?:\s+(?:pra|para)\s+mim)?\s+\d+(?:[,.]\d+)?\b.*\b(?:cada|unidade|paguei|por|a)\b/.test(
      normalized,
    ) ||
    /^(?:paguei\s+)?(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s+(?:em\s+)?cada\s+unidade\b/.test(
      normalized,
    ) ||
    /\bcada\s+(?:uma|unidade)\s+saiu\s+por\s+(?:r\$\s*)?\d/.test(normalized) ||
    /^(?:por|a)\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s+a\s+unidade\b/.test(normalized)
  );
}

function isExpenseAction(normalized: string): boolean {
  if (/\bquanto\b/.test(normalized)) {
    return false;
  }

  if (/\bpaguei\b/.test(normalized) && isPurchaseAction(normalized) && /\b(cada|unidade|estoque)\b/.test(normalized)) {
    return false;
  }

  if (/\b(?:cada|unidade|unitario|unitaria)\b/.test(normalized) && !/\b(de|com)\s+[a-z]/.test(normalized)) {
    return false;
  }

  if (
    /\bpaguei\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s+nas?\s+(?:\d|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return (
    /\b(paguei|gastei|despesa\s+de|tive\s+despesa|custo\s+com|conta\s+de)\b/.test(normalized) ||
    isExpensePurchaseText(normalized)
  );
}

function isExpensePurchaseText(normalized: string): boolean {
  const packagingPurchaseWithContents =
    /\bcomprei\s+(?:(?:um|uma|\d+(?:[,.]\d+)?)\s+)?(?:caixa|caixas|pacote|pacotes|saco|sacos|fardo|fardos|bandeja|bandejas|cartela|cartelas)\s+com\b/.test(
      normalized,
    );

  return (
    !packagingPurchaseWithContents &&
    /\bcomprei\s+(?:embalagem|embalagens|sacola|sacolas|caixa|caixas|isopor|pacote|pacotes|material)\b/.test(
      normalized,
    )
  );
}

function isProductRegistrationAction(normalized: string): boolean {
  return (
    /\b(cadastro|cadastrar|cadastre|cadastra|criar|cria|adicione|adiciona|adicionar|inclua|incluir|registra|registre)\b/.test(
      normalized,
    ) ||
    /\bcoloca\b.*\b(?:produto|sistema)\b/.test(normalized)
  );
}

function isFinancialQuestion(normalized: string): boolean {
  return (
    /\b(quanto|quais|qual|o\s+que|total|resumo)\b.*\b(vendi|vendas?|ganhei|lucro|financeiro|despesas?|gastei|comprei|compras?|estoque)\b/.test(
      normalized,
    ) ||
    /\bresumo\b.*\b(financeiro|hoje|dia|mes)\b/.test(normalized) ||
    /\b(vendas?|compras?|despesas?)\s+(?:do|de|no|na)\s+mes\b/.test(normalized) ||
    /\bestoque\s+atual\b/.test(normalized) ||
    /\bquanto\s+(?:ganhei|luc(?:rei|ro)|sobrou)\b/.test(normalized) ||
    /\btenho\s+quant[oa]s?\b|\bquant[oa]s?.*\btenho\b/.test(normalized) ||
    /\b(produtos?.*acabando|estoque\s+baixo|produto\s+mais\s+vendido|mais\s+vendidos?)\b/.test(normalized)
  );
}

function isQuestionLike(normalized: string): boolean {
  return /^(quanto|quais|qual|quant[oa]s?|o\s+que|resumo)\b/.test(normalized);
}

function removeStockEntryNoise(value: string): string {
  return value
    .replace(/\s+que\s+(?:eu\s+)?comprei\b/gi, " ")
    .replace(/\s+que\s+(?:entrou|entraram|chegou|chegaram)\b/gi, " ")
    .replace(/\s+(?:no|ao|para\s+o)\s+estoque\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removePurchaseCostSegments(value: string): string {
  return value
    .replace(/\s*,?\s*paguei\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?(?:\s+(?:em\s+)?cada(?:\s+uma(?:\s+delas)?|\s+unidade)?)?.*$/i, "")
    .replace(/\s*,?\s*(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s+em\s+cada(?:\s+uma(?:\s+delas)?|\s+unidade)?.*$/i, "")
    .replace(/\s+(?:por|a)\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s*(?:cada|total)?.*$/i, "")
    .replace(/\s*,?\s*(?:foi|saiu|custou)\s+(?:r\$\s*)?\d+(?:[,.]\d{1,2})?(?:\s*(?:real|reais))?\s*cada.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeProductFieldSegments(value: string): string {
  return value
    .replace(/\b(?:custo|custa)\s+(?:r\$\s*)?-?\d+(?:[,.]\d+)?(?:\s*(?:real|reais))?/gi, " ")
    .replace(/\b(?:pre[cç]o(?:\s+de\s+venda)?|venda|vendo|valor)\s+(?:r\$\s*)?-?\d+(?:[,.]\d+)?(?:\s*(?:real|reais))?/gi, " ")
    .replace(/\bestoque\s+m[ií]nimo\s+-?\d+(?:[,.]\d+)?/gi, " ")
    .replace(/\bestoque(?:\s+inicial)?\s+-?\d+(?:[,.]\d+)?/gi, " ")
    .replace(/\b(?:m[ií]nimo|minima)\s+-?\d+(?:[,.]\d+)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSensitiveProductName(value: string): boolean {
  const normalized = normalizeUserMessage(value).normalized;

  return /\b(veneno|glifosato|defensivo|quimico|medicamento|arma|explosivo|soro)\b/.test(normalized);
}

function normalizeCommonAssistantTypos(value: string): string {
  return value
    .replace(/\bcadatra\b/gi, "cadastra")
    .replace(/\bconprei\b/gi, "comprei")
    .replace(/\bvedi\b/gi, "vendi")
    .replace(/\bpego\b/gi, "pegou");
}

function parseAssistantQuantity(value: string): number {
  const normalized = normalizeUserMessage(value).normalized;

  if (normalized === "um" || normalized === "uma") {
    return 1;
  }

  return parseBrazilianQuantity(value, "Quantidade");
}

function parsePositiveMoney(value: string): number {
  const cents = parseBrazilianMoneyToCents(value, "Valor");

  return cents > 0 ? cents : Number.NaN;
}

function isPotentialTotalOrUnitAmount(quantity: number, amountCents: number): boolean {
  const possibleUnitCents = amountCents / quantity;

  return Number.isInteger(possibleUnitCents) && possibleUnitCents >= 100;
}

function formatNumberForPattern(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", "[,.]");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function singularizeToken(token: string): string {
  return token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token;
}

function expandSearchToken(token: string): string[] {
  const compactVolume = token.match(/^(\d+(?:[,.]\d+)?)(ml|l)$/);

  if (compactVolume) {
    const [, amount, unit] = compactVolume;

    return unit === "l" ? [token, amount, "l", "litro"] : [token, amount, "ml"];
  }

  if (token === "litro" || token === "litros") {
    return ["litro", "l"];
  }

  if (token === "garrafa") {
    return ["garrafa", "pet"];
  }

  return [token];
}

const productSearchStopWords = new Set([
  "cada",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "em",
  "estoque",
  "para",
  "por",
  "unidade",
  "unidades",
]);
