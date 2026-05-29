import {
  normalizeForProductSearch,
  productMatches,
  tokenizeForProductSearch,
} from "@/lib/ai/conversation-engine";
import type { ProductUnitValue } from "@/lib/validation/product";

export type AiProductResolveOperation = "product_registration" | "purchase" | "question" | "sale";

export type AiResolvableProduct = {
  active?: boolean;
  aliases?: Array<{
    alias: string;
    normalizedAlias?: string;
  }>;
  currentStock?: unknown;
  id: string;
  name: string;
  salePriceCents?: number;
  unit?: ProductUnitValue | string;
  unitCostCents?: number;
};

export type AiProductCandidate<TProduct extends AiResolvableProduct = AiResolvableProduct> = TProduct & {
  matchedAlias?: string;
  matchedBy: "alias" | "name";
  score: number;
};

export type AiProductResolution<TProduct extends AiResolvableProduct = AiResolvableProduct> =
  | {
      candidates: AiProductCandidate<TProduct>[];
      nextQuestion: string;
      reason: "multiple_product_matches";
      status: "ambiguous";
    }
  | {
      nextQuestion: string;
      reason: "can_create_after_confirmation";
      status: "new_product_candidate";
    }
  | {
      nextQuestion: string;
      reason: "product_required_before_sale";
      status: "not_found";
    }
  | {
      product: TProduct;
      productId: string;
      reason: "exact_or_alias_match";
      status: "unique";
    };

export function resolveProductForAi<TProduct extends AiResolvableProduct>({
  operation,
  productName,
  products,
}: {
  operation: AiProductResolveOperation;
  productName: string;
  products: TProduct[];
}): AiProductResolution<TProduct> {
  const query = productName.trim();
  const queryTokens = tokenizeForProductSearch(query);

  if (query.length === 0 || queryTokens.length === 0) {
    return operation === "sale" ? notFoundResult(productName) : newProductCandidateResult(productName);
  }

  const candidates = products
    .filter((product) => product.active !== false)
    .map((product) => scoreProduct(query, queryTokens, product))
    .filter((candidate): candidate is AiProductCandidate<TProduct> => candidate !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return 0;
    });

  if (candidates.length === 1) {
    const [candidate] = candidates;

    return {
      product: candidate,
      productId: candidate.id,
      reason: "exact_or_alias_match",
      status: "unique",
    };
  }

  if (candidates.length > 1) {
    return {
      candidates,
      nextQuestion: `Encontrei mais de um produto parecido com "${productName}". Escolha pelo nome completo.`,
      reason: "multiple_product_matches",
      status: "ambiguous",
    };
  }

  return operation === "sale" || operation === "question"
    ? notFoundResult(productName)
    : newProductCandidateResult(productName);
}

function scoreProduct<TProduct extends AiResolvableProduct>(
  query: string,
  queryTokens: string[],
  product: TProduct,
): AiProductCandidate<TProduct> | null {
  const scoredTexts = [
    scoreText(query, queryTokens, product.name, "name" as const),
    ...(product.aliases ?? []).map((alias) => scoreText(query, queryTokens, alias.alias, "alias" as const)),
  ].filter((candidate): candidate is { matchedBy: "alias" | "name"; score: number; text: string } => candidate !== null);
  const best = scoredTexts.sort((left, right) => right.score - left.score)[0];

  if (!best) {
    return null;
  }

  return {
    ...product,
    matchedAlias: best.matchedBy === "alias" ? best.text : undefined,
    matchedBy: best.matchedBy,
    score: best.score,
  };
}

function scoreText(
  query: string,
  queryTokens: string[],
  searchableText: string,
  matchedBy: "alias" | "name",
): { matchedBy: "alias" | "name"; score: number; text: string } | null {
  const normalizedQuery = normalizeForProductSearch(query);
  const normalizedText = normalizeForProductSearch(searchableText);
  const textTokens = tokenizeForProductSearch(searchableText);

  if (normalizedQuery.length === 0 || normalizedText.length === 0 || textTokens.length === 0) {
    return null;
  }

  if (normalizedQuery === normalizedText) {
    return { matchedBy, score: matchedBy === "alias" ? 150 : 140, text: searchableText };
  }

  if (!productMatches(query, searchableText)) {
    return null;
  }

  const matchedTokenCount = queryTokens.filter((queryToken) =>
    textTokens.some((textToken) => textToken === queryToken || textToken.includes(queryToken) || queryToken.includes(textToken)),
  ).length;
  const score = matchedTokenCount * 10 + (matchedBy === "alias" ? 5 : 0);

  return score > 0 ? { matchedBy, score, text: searchableText } : null;
}

function notFoundResult<TProduct extends AiResolvableProduct>(productName: string): AiProductResolution<TProduct> {
  return {
    nextQuestion: `Não encontrei produto ativo para "${productName}". Cadastre o produto antes de vender ou use o nome exato do cadastro.`,
    reason: "product_required_before_sale",
    status: "not_found",
  };
}

function newProductCandidateResult<TProduct extends AiResolvableProduct>(productName: string): AiProductResolution<TProduct> {
  return {
    nextQuestion: `Não encontrei "${productName}" no cadastro. Posso montar um rascunho de novo produto, mas só salvo depois da sua confirmação.`,
    reason: "can_create_after_confirmation",
    status: "new_product_candidate",
  };
}
