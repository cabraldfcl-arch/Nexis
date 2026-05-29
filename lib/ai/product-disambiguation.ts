import {
  normalizeForProductSearch,
  productMatches,
  tokenizeForProductSearch,
} from "@/lib/ai/conversation-engine";

export type ProductSelectionOption = {
  id: string;
  name: string;
};

export type ProductSelectionResult =
  | {
      option: ProductSelectionOption;
      status: "selected";
    }
  | {
      status: "ambiguous" | "no_match";
    };

type ScoredSelectionOption = {
  exactName: boolean;
  extraTokenCount: number;
  option: ProductSelectionOption;
  score: number;
};

const selectionFillerWords = new Set([
  "aqui",
  "cliente",
  "compra",
  "comprado",
  "comprar",
  "comprei",
  "dizer",
  "essa",
  "esse",
  "eu",
  "foi",
  "isso",
  "mesmo",
  "meu",
  "minha",
  "numero",
  "opcao",
  "pode",
  "produto",
  "quis",
  "ser",
  "venda",
  "vender",
  "vendi",
  "vendido",
]);

export function resolveProductSelectionFromOptions(
  userMessage: string,
  options: ProductSelectionOption[],
): ProductSelectionResult {
  const candidates = options.slice(0, 5);

  if (candidates.length === 0) {
    return { status: "no_match" };
  }

  const normalized = normalizeForProductSearch(userMessage);
  const selectedIndex = resolveNumericSelectionIndex(normalized) ?? resolveOrdinalSelectionIndex(normalized);

  if (selectedIndex !== null) {
    const option = candidates[selectedIndex];

    return option ? { option, status: "selected" } : { status: "no_match" };
  }

  if (isGenericContextConfirmation(normalized)) {
    return candidates.length === 1 ? { option: candidates[0], status: "selected" } : { status: "ambiguous" };
  }

  const cleanedMessage = normalizeSelectionText(userMessage);
  const queryTokens = tokenizeForProductSearch(cleanedMessage);

  if (queryTokens.length === 0) {
    return { status: "no_match" };
  }

  const matches = candidates.filter((candidate) => productMatches(cleanedMessage, candidate.name));

  if (matches.length === 0) {
    return { status: "no_match" };
  }

  if (matches.length === 1) {
    return { option: matches[0], status: "selected" };
  }

  if (queryTokens.length === 1 && !isStrongSingleToken(queryTokens[0])) {
    return { status: "ambiguous" };
  }

  const scored = matches
    .map((option) => scoreOption(cleanedMessage, queryTokens, option))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.extraTokenCount - right.extraTokenCount;
    });
  const [best, second] = scored;

  if (!best || best.score <= 0) {
    return { status: "no_match" };
  }

  if (!second) {
    return { option: best.option, status: "selected" };
  }

  if (best.exactName) {
    return { option: best.option, status: "selected" };
  }

  if (best.score > second.score) {
    return { option: best.option, status: "selected" };
  }

  if (queryTokens.length >= 2 && best.extraTokenCount < second.extraTokenCount) {
    return { option: best.option, status: "selected" };
  }

  return { status: "ambiguous" };
}

function normalizeSelectionText(value: string): string {
  return normalizeForProductSearch(value)
    .split(" ")
    .filter((word) => word.length > 0 && !selectionFillerWords.has(word))
    .join(" ");
}

function resolveNumericSelectionIndex(normalizedMessage: string): number | null {
  const match = normalizedMessage.match(/^(?:a\s+)?(?:(?:opcao|numero|n)\s*)?([1-5])$/);

  return match ? Number(match[1]) - 1 : null;
}

function resolveOrdinalSelectionIndex(normalizedMessage: string): number | null {
  const ordinals: Array<[RegExp, number]> = [
    [/\b(primeira|primeiro|1a|1o)\b/, 0],
    [/\b(segunda|segundo|2a|2o)\b/, 1],
    [/\b(terceira|terceiro|3a|3o)\b/, 2],
    [/\b(quarta|quarto|4a|4o)\b/, 3],
    [/\b(quinta|quinto|5a|5o)\b/, 4],
  ];
  const match = ordinals.find(([pattern]) => pattern.test(normalizedMessage));

  return match?.[1] ?? null;
}

function isGenericContextConfirmation(normalizedMessage: string): boolean {
  return /^(?:essa|esse|isso|essa\s+mesmo|esse\s+mesmo|pode\s+ser\s+essa|pode\s+ser\s+esse|pode\s+ser)$/.test(
    normalizedMessage,
  );
}

function isStrongSingleToken(token: string): boolean {
  return /^\d/.test(token);
}

function scoreOption(
  cleanedMessage: string,
  queryTokens: string[],
  option: ProductSelectionOption,
): ScoredSelectionOption {
  const productTokens = tokenizeForProductSearch(option.name);
  const normalizedName = normalizeForProductSearch(option.name);
  const exactName = normalizeForProductSearch(cleanedMessage) === normalizedName;
  const matchedTokenCount = queryTokens.filter((queryToken) =>
    productTokens.some((productToken) => selectionTokenMatches(queryToken, productToken)),
  ).length;

  return {
    exactName,
    extraTokenCount: Math.max(0, productTokens.length - matchedTokenCount),
    option,
    score: matchedTokenCount * 10 + (exactName ? 100 : 0),
  };
}

function selectionTokenMatches(queryToken: string, productToken: string): boolean {
  return (
    productToken === queryToken ||
    productToken.includes(queryToken) ||
    queryToken.includes(productToken)
  );
}
