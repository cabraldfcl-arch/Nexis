import { calculateRoundedUnitAmountCents } from "@/lib/finance";
import { parseBrazilianMoneyToCents, parseBrazilianQuantity, type ProductUnitValue } from "@/lib/validation/product";

export type CommercialUnitParse = {
  priceBasis: string;
  productName: string;
  quantity: number;
  unit: ProductUnitValue;
  unitCostCents?: number;
  unitLabel: string;
};

export type CommercialSaleParse = Omit<CommercialUnitParse, "unitCostCents"> & {
  unitPriceCents: number | null;
};

type UnitFamily = "area" | "construction_volume" | "count" | "length" | "volume" | "weight";

type UnitDefinition = {
  aliases: string[];
  factorToCanonical: number;
  family: UnitFamily;
  label: string;
  productUnit: ProductUnitValue;
};

const commercialQuantityPattern = "(?:\\d+(?:[,.]\\d+)?|um|uma)";
const moneyPattern = "\\d+(?:[,.]\\d{1,2})?";
const unitDefinitions: UnitDefinition[] = [
  {
    aliases: ["kg", "quilo", "quilos", "kilo", "kilos"],
    factorToCanonical: 1,
    family: "weight",
    label: "kg",
    productUnit: "KG",
  },
  {
    aliases: ["g", "grama", "gramas"],
    factorToCanonical: 0.001,
    family: "weight",
    label: "grama",
    productUnit: "GRAM",
  },
  {
    aliases: ["litro", "litros", "l"],
    factorToCanonical: 1,
    family: "volume",
    label: "litro",
    productUnit: "LITER",
  },
  {
    aliases: ["ml", "mililitro", "mililitros"],
    factorToCanonical: 0.001,
    family: "volume",
    label: "litro",
    productUnit: "LITER",
  },
  {
    aliases: ["metro", "metros", "m"],
    factorToCanonical: 1,
    family: "length",
    label: "metro",
    productUnit: "METER",
  },
  {
    aliases: ["m2", "m²", "metro quadrado", "metros quadrados"],
    factorToCanonical: 1,
    family: "area",
    label: "m²",
    productUnit: "SQUARE_METER",
  },
  {
    aliases: ["m3", "m³", "metro cubico", "metro cúbico", "metros cubicos", "metros cúbicos"],
    factorToCanonical: 1,
    family: "construction_volume",
    label: "m³",
    productUnit: "CUBIC_METER",
  },
  {
    aliases: ["unidade", "unidades", "un"],
    factorToCanonical: 1,
    family: "count",
    label: "unidade",
    productUnit: "UNIT",
  },
  {
    aliases: ["peca", "pecas", "peça", "peças"],
    factorToCanonical: 1,
    family: "count",
    label: "peça",
    productUnit: "UNIT",
  },
  {
    aliases: ["caixa", "caixas"],
    factorToCanonical: 1,
    family: "count",
    label: "caixa",
    productUnit: "BOX",
  },
  {
    aliases: ["saco", "sacos"],
    factorToCanonical: 1,
    family: "count",
    label: "saco",
    productUnit: "SACK",
  },
  {
    aliases: ["fardo", "fardos"],
    factorToCanonical: 1,
    family: "count",
    label: "fardo",
    productUnit: "BALE",
  },
  {
    aliases: ["bandeja", "bandejas"],
    factorToCanonical: 1,
    family: "count",
    label: "bandeja",
    productUnit: "UNIT",
  },
  {
    aliases: ["cartela", "cartelas"],
    factorToCanonical: 1,
    family: "count",
    label: "cartela",
    productUnit: "UNIT",
  },
  {
    aliases: ["pacote", "pacotes"],
    factorToCanonical: 1,
    family: "count",
    label: "pacote",
    productUnit: "PACKAGE",
  },
  {
    aliases: ["duzia", "duzias", "dúzia", "dúzias"],
    factorToCanonical: 1,
    family: "count",
    label: "dúzia",
    productUnit: "DOZEN",
  },
];
const unitAliasPattern = buildUnitAliasPattern();
const unitBoundaryStart = "(?<![A-Za-zÀ-ÿ0-9])";
const unitBoundaryEnd = "(?![A-Za-zÀ-ÿ0-9])";
const unitCapturePattern = `${unitBoundaryStart}(${unitAliasPattern})${unitBoundaryEnd}`;

export function parseCommercialUnitPurchase(message: string): CommercialUnitParse | null {
  const text = normalizeUnitText(message);
  const actionPattern =
    "(?:eu\\s+)?(?:comprei|comprou|peguei|entrou|entraram|chegou|chegaram|dei\\s+entrada\\s+em|deu\\s+entrada\\s+em|bota\\s+no\\s+estoque|coloca\\s+no\\s+estoque|coloque\\s+no\\s+estoque|adicione\\s+no\\s+estoque|adicionar\\s+no\\s+estoque|lanca\\s+no\\s+estoque|lança\\s+no\\s+estoque|lance\\s+no\\s+estoque)";
  const packagedUnitPurchase = parsePackagedUnitPurchase(text, actionPattern);

  if (packagedUnitPurchase) {
    return packagedUnitPurchase;
  }

  const priceBasisPattern = new RegExp(
    `\\b${actionPattern}(?:\\s+(?:hoje|ontem|agora))?\\s+(${commercialQuantityPattern})\\s+${unitCapturePattern}(?:\\s+de)?\\s+(.+?)\\s+(?:por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?\\s+(?:(?:o|a|cada|por)\\s+)?${unitCapturePattern}`,
    "iu",
  );
  const priceBasisMatch = text.match(priceBasisPattern);

  if (priceBasisMatch) {
    return buildCommercialPurchase({
      basisUnitText: priceBasisMatch[5],
      productText: priceBasisMatch[3],
      quantityText: priceBasisMatch[1],
      quantityUnitText: priceBasisMatch[2],
      unitCostText: priceBasisMatch[4],
    });
  }

  const paidEachPattern = new RegExp(
    `\\b${actionPattern}(?:\\s+(?:hoje|ontem|agora))?\\s+(${commercialQuantityPattern})\\s+${unitCapturePattern}(?:\\s+de)?\\s+(.+?)\\s+(?:paguei|pagou|custou|saiu|foi)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?(?:\\s+(?:em\\s+)?cada(?:\\s+${unitCapturePattern})?)?`,
    "iu",
  );
  const paidEachMatch = text.match(paidEachPattern);

  if (paidEachMatch) {
    return buildCommercialPurchase({
      basisUnitText: paidEachMatch[5] ?? paidEachMatch[2],
      productText: paidEachMatch[3],
      quantityText: paidEachMatch[1],
      quantityUnitText: paidEachMatch[2],
      unitCostText: paidEachMatch[4],
    });
  }

  const totalPricePattern = new RegExp(
    `\\b${actionPattern}(?:\\s+(?:hoje|ontem|agora))?\\s+(${commercialQuantityPattern})\\s*${unitCapturePattern}(?:\\s+de)?\\s+(.+?)\\s+por\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?(?:\\s+total)?\\.?$`,
    "iu",
  );
  const totalPriceMatch = text.match(totalPricePattern);

  if (!totalPriceMatch) {
    return null;
  }

  return buildCommercialPurchaseFromTotal({
    productText: totalPriceMatch[3],
    quantityText: totalPriceMatch[1],
    quantityUnitText: totalPriceMatch[2],
    totalCostText: totalPriceMatch[4],
  });
}

export function parseCommercialUnitSale(message: string): CommercialSaleParse | null {
  const text = normalizeUnitText(message);
  const saleActionPattern =
    "(?:vendi|(?:o\\s+)?cliente\\s+levou|(?:o\\s+)?cliente\\s+comprou|(?:o\\s+)?cliente\\s+pegou|levou|saiu|baixou|dei\\s+saida(?:\\s+em)?)";
  const pattern = new RegExp(
    `^${saleActionPattern}\\s+(${commercialQuantityPattern})\\s+${unitCapturePattern}(?:\\s+de)?\\s+(.+?)(?:\\s+(?:por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?\\s+(?:(?:o|a|cada|por)\\s+)?${unitCapturePattern})?\\.?$`,
    "iu",
  );
  const match = text.match(pattern);

  if (!match) {
    return null;
  }

  const quantityDefinition = findUnitDefinition(match[2]);
  const basisDefinition = findUnitDefinition(match[5] ?? match[2]);

  if (!quantityDefinition || !basisDefinition || quantityDefinition.family !== basisDefinition.family) {
    return null;
  }

  const quantity = convertQuantityToBasis(parseAssistantQuantity(match[1]), quantityDefinition, basisDefinition);
  const unitPriceCents = match[4] ? parsePositiveMoneyToCents(match[4], "Preco de venda") : null;
  const productName = cleanCommercialProductName(match[3]);

  if (productName.length === 0 || isMissingPackagedProductName(productName)) {
    return null;
  }

  return {
    priceBasis: formatPriceBasis(basisDefinition.label),
    productName,
    quantity,
    unit: basisDefinition.productUnit,
    unitLabel: basisDefinition.label,
    unitPriceCents,
  };
}

export function detectCommercialUnit(value: string): Pick<CommercialUnitParse, "priceBasis" | "unit" | "unitLabel"> | null {
  const normalized = normalizeUnitText(value);
  const match = normalized.match(new RegExp(unitCapturePattern, "iu"));
  const definition = match?.[1] ? findUnitDefinition(match[1]) : null;

  return definition
    ? {
        priceBasis: formatPriceBasis(definition.label),
        unit: definition.productUnit,
        unitLabel: definition.label,
      }
    : null;
}

export function detectExplicitProductUnit(
  value: string,
): Pick<CommercialUnitParse, "priceBasis" | "unit" | "unitLabel"> | null {
  const normalized = normalizeUnitText(value);
  const match = normalized.match(
    new RegExp(`\\b(?:unidade|medida|por|em)\\s+${unitCapturePattern}`, "iu"),
  );
  const definition = match?.[1] ? findUnitDefinition(match[1]) : null;

  return definition
    ? {
        priceBasis: formatPriceBasis(definition.label),
        unit: definition.productUnit,
        unitLabel: definition.label,
      }
    : null;
}

export function formatCommercialQuantity(quantity: number, unitLabel?: string): string {
  const formatted = Number.isInteger(quantity) ? String(quantity) : String(quantity).replace(".", ",");

  if (!unitLabel) {
    return quantity === 1 ? `${formatted} unidade` : `${formatted} unidades`;
  }

  return `${formatted} ${quantity === 1 ? unitLabel : pluralizeUnitLabel(unitLabel)}`;
}

export function questionUnitLabel(unitLabel?: string): string {
  return unitLabel ?? "unidade";
}

export function pluralCommercialUnitLabel(unitLabel?: string): string {
  return unitLabel ? pluralizeUnitLabel(unitLabel) : "unidades";
}

export function convertQuantityBetweenProductUnits({
  fromUnit,
  quantity,
  toUnit,
}: {
  fromUnit: ProductUnitValue | undefined;
  quantity: number;
  toUnit: ProductUnitValue;
}): number | null {
  if (!fromUnit || fromUnit === toUnit) {
    return quantity;
  }

  const fromWeightFactor = weightFactorToKg(fromUnit);
  const toWeightFactor = weightFactorToKg(toUnit);

  if (fromWeightFactor !== null && toWeightFactor !== null) {
    return Number((quantity * (fromWeightFactor / toWeightFactor)).toFixed(6));
  }

  return null;
}

export function convertUnitAmountBetweenProductUnits({
  amountCents,
  fromUnit,
  toUnit,
}: {
  amountCents: number;
  fromUnit: ProductUnitValue | undefined;
  toUnit: ProductUnitValue;
}): number | null {
  if (!fromUnit || fromUnit === toUnit) {
    return amountCents;
  }

  const fromWeightFactor = weightFactorToKg(fromUnit);
  const toWeightFactor = weightFactorToKg(toUnit);

  if (fromWeightFactor === null || toWeightFactor === null) {
    return null;
  }

  const converted = amountCents * (toWeightFactor / fromWeightFactor);

  return Number.isSafeInteger(converted) && converted > 0 ? converted : null;
}

function buildCommercialPurchase({
  basisUnitText,
  productText,
  quantityText,
  quantityUnitText,
  unitCostText,
}: {
  basisUnitText: string;
  productText: string;
  quantityText: string;
  quantityUnitText: string;
  unitCostText: string;
}): CommercialUnitParse | null {
  const quantityDefinition = findUnitDefinition(quantityUnitText);
  const basisDefinition = findUnitDefinition(basisUnitText);

  if (!quantityDefinition || !basisDefinition || quantityDefinition.family !== basisDefinition.family) {
    return null;
  }

  const productName = cleanCommercialProductName(productText);

  if (productName.length === 0 || isMissingPackagedProductName(productName)) {
    return null;
  }

  return {
    priceBasis: formatPriceBasis(basisDefinition.label),
    productName,
    quantity: convertQuantityToBasis(parseAssistantQuantity(quantityText), quantityDefinition, basisDefinition),
    unit: basisDefinition.productUnit,
    unitCostCents: parsePositiveMoneyToCents(unitCostText, "Custo por unidade"),
    unitLabel: basisDefinition.label,
  };
}

function buildCommercialPurchaseFromTotal({
  productText,
  quantityText,
  quantityUnitText,
  totalCostText,
}: {
  productText: string;
  quantityText: string;
  quantityUnitText: string;
  totalCostText: string;
}): CommercialUnitParse | null {
  const quantityDefinition = findUnitDefinition(quantityUnitText);

  if (!quantityDefinition) {
    return null;
  }

  if (quantityDefinition.family === "count" && quantityDefinition.productUnit !== "UNIT") {
    return null;
  }

  const basisDefinition = preferredTotalBasisDefinition(quantityDefinition);
  const productName = cleanCommercialProductName(productText);

  if (productName.length === 0 || isMissingCommercialProductName(productName)) {
    return null;
  }

  const quantity = convertQuantityToBasis(parseAssistantQuantity(quantityText), quantityDefinition, basisDefinition);
  const totalCostCents = parsePositiveMoneyToCents(totalCostText, "Custo total");
  const unitCostCents = calculateRoundedUnitAmountCents({
    totalAmountCents: totalCostCents,
    totalFieldName: "Custo total",
    unitFieldName: pluralizeUnitLabel(basisDefinition.label),
    units: quantity,
  });

  return {
    priceBasis: formatPriceBasis(basisDefinition.label),
    productName,
    quantity,
    unit: basisDefinition.productUnit,
    unitCostCents,
    unitLabel: basisDefinition.label,
  };
}

function parsePackagedUnitPurchase(text: string, actionPattern: string): CommercialUnitParse | null {
  const packageUnitPattern = "(?:caixa|caixas|fardo|fardos|pacote|pacotes|saco|sacos|bandeja|bandejas|cartela|cartelas)";
  const packageCapturePattern = `(?:(?:(${commercialQuantityPattern})\\s+)?${packageUnitPattern})`;
  const loosePattern = new RegExp(
    `\\b${actionPattern}(?:\\s+(?:hoje|ontem|agora))?\\s+${packageCapturePattern}(?:\\s+de)?\\s+(.+?)\\s+de\\s+(${commercialQuantityPattern})\\s+(?:unidade|unidades|un)(?:\\s+(.+?))?\\s+(?:ficou|custou|saiu|foi|por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?\\s+(?:(?:a|o|por|cada)\\s+)?${packageUnitPattern}\\b`,
    "iu",
  );
  const looseMatch = text.match(loosePattern);

  if (looseMatch) {
    return buildPackagedUnitPurchase({
      packageCostText: looseMatch[5],
      packageQuantityText: looseMatch[1] ?? "uma",
      productText: joinPackageProductText(looseMatch[2], looseMatch[4]),
      unitsPerPackageText: looseMatch[3],
    });
  }

  const pattern = new RegExp(
    `\\b${actionPattern}(?:\\s+(?:hoje|ontem|agora))?\\s+${packageCapturePattern}(?:\\s+de)?\\s+(.+?)\\s+com\\s+(${commercialQuantityPattern})\\s+(?:unidade|unidades|un)(?:\\s+cada)?\\s+(?:por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?(?:\\s+(?:(?:a|o|por|cada)\\s+)?${packageUnitPattern})?\\b`,
    "iu",
  );
  const match = text.match(pattern);

  if (match) {
    return buildPackagedUnitPurchase({
      packageCostText: match[4],
      packageQuantityText: match[1] ?? "uma",
      productText: match[2],
      unitsPerPackageText: match[3],
    });
  }

  const productAfterUnitsPattern = new RegExp(
    `\\b${actionPattern}(?:\\s+(?:hoje|ontem|agora))?\\s+${packageCapturePattern}\\s+com\\s+(${commercialQuantityPattern})\\s+(?:(?:unidade|unidades|un)\\s+(?:de\\s+)?(.+?)|(.+?))\\s+(?:ficou|custou|saiu|foi|por|a)\\s+(?:r\\$\\s*)?(${moneyPattern})(?:\\s*(?:real|reais))?(?:\\s+(?:(?:a|o|por|cada)\\s+)?${packageUnitPattern})?\\b`,
    "iu",
  );
  const productAfterUnitsMatch = text.match(productAfterUnitsPattern);

  if (!productAfterUnitsMatch) {
    return null;
  }

  return buildPackagedUnitPurchase({
    packageCostText: productAfterUnitsMatch[5],
    packageQuantityText: productAfterUnitsMatch[1] ?? "uma",
    productText: productAfterUnitsMatch[3] ?? productAfterUnitsMatch[4],
    unitsPerPackageText: productAfterUnitsMatch[2],
  });
}

function buildPackagedUnitPurchase({
  packageCostText,
  packageQuantityText,
  productText,
  unitsPerPackageText,
}: {
  packageCostText: string;
  packageQuantityText: string;
  productText: string;
  unitsPerPackageText: string;
}): CommercialUnitParse | null {
  const packageQuantity = parseAssistantQuantity(packageQuantityText);
  const unitsPerPackage = parseAssistantQuantity(unitsPerPackageText);
  const packageCostCents = parsePositiveMoneyToCents(packageCostText, "Custo por embalagem");
  const unitCostCents = calculateRoundedUnitAmountCents({
    totalAmountCents: packageCostCents,
    totalFieldName: "Custo por embalagem",
    unitFieldName: "Unidades por embalagem",
    units: unitsPerPackage,
  });
  const productName = cleanCommercialProductName(productText);

  if (productName.length === 0 || isMissingPackagedProductName(productName)) {
    return null;
  }

  return {
    priceBasis: "por unidade",
    productName,
    quantity: Number((packageQuantity * unitsPerPackage).toFixed(6)),
    unit: "UNIT",
    unitCostCents,
    unitLabel: "unidade",
  };
}

function joinPackageProductText(baseProductText: string, extraProductText: string | undefined): string {
  const normalizedExtra = (extraProductText ?? "").trim();

  if (normalizedExtra.length === 0 || /^cada\b/i.test(normalizedExtra)) {
    return baseProductText;
  }

  return mergeProductText(baseProductText, normalizedExtra);
}

function mergeProductText(baseProductText: string, extraProductText: string): string {
  const baseTokens = baseProductText.trim().split(/\s+/).filter(Boolean);
  const extraTokens = extraProductText.trim().split(/\s+/).filter(Boolean);

  if (baseTokens.length === 0) {
    return extraTokens.join(" ");
  }

  if (extraTokens.length === 0) {
    return baseTokens.join(" ");
  }

  const normalizedBaseTokens = new Set(baseTokens.map(normalizeBasicText));
  const mergedExtraTokens = normalizedBaseTokens.has(normalizeBasicText(extraTokens[0]))
    ? extraTokens.slice(1)
    : extraTokens;

  return [...baseTokens, ...mergedExtraTokens].join(" ");
}

function isMissingPackagedProductName(productName: string): boolean {
  return /^(?:un|unidade|unidades|item|itens|produto|produtos)$/.test(normalizeBasicText(productName));
}

function isMissingCommercialProductName(productName: string): boolean {
  const normalized = normalizeBasicText(productName);

  return isMissingPackagedProductName(normalized) || /^com\s+\d+(?:[,.]\d+)?\s+(?:un|unidade|unidades)$/.test(normalized);
}

function parseAssistantQuantity(value: string): number {
  const normalized = normalizeBasicText(value);

  if (normalized === "um" || normalized === "uma") {
    return 1;
  }

  return parseBrazilianQuantity(value, "Quantidade");
}

function parsePositiveMoneyToCents(value: string, fieldName: string): number {
  const cents = parseBrazilianMoneyToCents(value, fieldName);

  if (cents <= 0) {
    throw new Error(`${fieldName} precisa ser maior que zero.`);
  }

  return cents;
}

function convertQuantityToBasis(
  quantity: number,
  quantityDefinition: UnitDefinition,
  basisDefinition: UnitDefinition,
): number {
  const converted = quantity * (quantityDefinition.factorToCanonical / basisDefinition.factorToCanonical);

  return Number(converted.toFixed(6));
}

function cleanCommercialProductName(value: string): string {
  return value
    .replace(/\s+(?:e\s+)?(?:vendo|vender|venda|pre[cç]o(?:\s+de\s+venda)?|valor)\b.*$/i, " ")
    .replace(/\s+(?:estoque\s+)?m[ií]nimo\b.*$/i, " ")
    .replace(/\b(?:em|no|na|ao|para\s+o)\s+(?=lata|garrafa|pet|caixa|pacote|unidade|kg|quilo|litro|\d)/gi, " ")
    .replace(/\bde\s+(?=\d)/gi, " ")
    .replace(/\b(?:pro|pra|para)\s+(?:meu|minha|o|a)?\s*cliente\b.*$/gi, " ")
    .replace(/\bcliente\b.*$/gi, " ")
    .replace(/\b(?:dela|dele|delas|deles)\b/gi, " ")
    .replace(/\b(?:por\s+favor|este\s+produto|esse\s+produto)\b/gi, " ")
    .replace(/[.?!]+$/g, "")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeBasicText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findUnitDefinition(value: string): UnitDefinition | null {
  const normalized = normalizeUnitAlias(value);

  return unitDefinitions.find((definition) =>
    definition.aliases.some((alias) => normalizeUnitAlias(alias) === normalized),
  ) ?? null;
}

function preferredTotalBasisDefinition(quantityDefinition: UnitDefinition): UnitDefinition {
  if (quantityDefinition.family === "weight") {
    return findUnitDefinition("kg") ?? quantityDefinition;
  }

  if (quantityDefinition.family === "volume") {
    return findUnitDefinition("litro") ?? quantityDefinition;
  }

  return quantityDefinition;
}

function normalizeUnitText(value: string): string {
  return value
    .replace(/\bm²\b/gi, "m²")
    .replace(/\bm³\b/gi, "m³")
    .replace(/(\d+(?:[,.]\d+)?)(kg|g|ml|l|m2|m3|m²|m³)\b/gi, "$1 $2");
}

function normalizeUnitAlias(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildUnitAliasPattern(): string {
  return unitDefinitions
    .flatMap((definition) => definition.aliases)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
}

function formatPriceBasis(unitLabel: string): string {
  return `por ${unitLabel}`;
}

function weightFactorToKg(unit: ProductUnitValue): number | null {
  if (unit === "KG") {
    return 1;
  }

  if (unit === "GRAM") {
    return 0.001;
  }

  return null;
}

function pluralizeUnitLabel(unitLabel: string): string {
  const pluralByUnit: Record<string, string> = {
    bandeja: "bandejas",
    caixa: "caixas",
    cartela: "cartelas",
    dúzia: "dúzias",
    fardo: "fardos",
    grama: "gramas",
    kg: "kg",
    litro: "litros",
    metro: "metros",
    "m²": "m²",
    "m³": "m³",
    pacote: "pacotes",
    peça: "peças",
    saco: "sacos",
    unidade: "unidades",
  };

  return pluralByUnit[unitLabel] ?? unitLabel;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
