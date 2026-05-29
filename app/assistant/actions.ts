"use server";

import { CancellationTargetType, ExpenseCategory, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { answerQuestionFromContext, type AssistantAnswer } from "@/lib/ai/answer-question";
import {
  convertQuantityBetweenProductUnits,
  convertUnitAmountBetweenProductUnits,
  formatCommercialQuantity,
  pluralCommercialUnitLabel,
  questionUnitLabel,
} from "@/lib/ai/commercial-units";
import {
  classifyIntent,
  inferProductUnit,
  isSensitiveProductName,
  normalizeForProductSearch,
} from "@/lib/ai/conversation-engine";
import {
  resolveAssistantMessageWithExternalAi,
  type ExternalAssistantContext,
  type ExternalAssistantPeriodSummary,
} from "@/lib/ai/external-assistant";
import type {
  ParsedAmbiguousPurchaseCostRequest,
  ParsedCancellationRequest,
  ParsedPartialPurchaseRequest,
  ParsedProductDraftRequest,
  ParsedPurchaseDraftRequest,
  ParsedSaleDraftRequest,
  ParsedStockLossDraftRequest,
  ProductDraftMissingField,
} from "@/lib/ai/intent-schema";
import {
  resolveProductSelectionFromOptions,
  type ProductSelectionOption,
} from "@/lib/ai/product-disambiguation";
import { getDashboardSummary } from "@/lib/dashboard/summary";
import { prisma } from "@/lib/db/prisma";
import {
  buildPurchaseTransaction,
  buildSaleTransaction,
  calculateLineTotalCents,
  calculateStockAfterPurchase,
  calculateStockAfterSale,
  normalizeExpenseForPersistence,
} from "@/lib/finance";
import {
  createProductRecord,
  productCreationErrorMessage,
} from "@/lib/products/create-product";
import {
  resolveProductForAi,
  type AiProductResolveOperation,
} from "@/lib/products/resolve-product-for-ai";
import { getAssistantQuestionContext } from "@/lib/reports/assistant-question";
import {
  expenseDraftSchema,
  cancellationDraftSchema,
  productDraftSchema,
  purchaseDraftSchema,
  saleDraftSchema,
  stockLossDraftSchema,
  type AssistantDraft,
  type CancellationDraft,
  type ProductDraft,
  type PurchaseDraft,
  type SaleDraft,
  type StockLossDraft,
} from "@/lib/validation/assistant-draft";
import { expenseCategoryValues } from "@/lib/validation/expense";
import {
  parseBrazilianMoneyToCents,
  parseBrazilianQuantity,
  productUnitValues,
  type ProductUnitValue,
} from "@/lib/validation/product";

export type AssistantActionState = {
  status: "idle" | "answer" | "draft" | "error";
  message: string;
  userMessage?: string;
  answer?: AssistantAnswer;
  draft?: AssistantDraft;
  pendingContext?: AssistantPendingContext | null;
  productFormPrefill?: ProductFormPrefill;
};

export type ProductFormPrefill = {
  category?: string;
  initialPurchase?: boolean;
  initialStock?: number;
  minimumStock?: number;
  name?: string;
  salePriceCents?: number;
  sensitiveProductWarning?: boolean;
  unit?: ProductUnitValue;
  unitCostCents?: number;
};

type AssistantUnitContext = {
  priceBasis?: string;
  unit?: ProductUnitValue;
  unitLabel?: string;
};

export type AssistantPendingContext =
  | ({
      productName: string;
      productId?: string;
      quantity: number;
      type: "purchase_missing_unit_cost";
    } & AssistantUnitContext)
  | ({
      amountCents: number;
      productName: string;
      quantity: number;
      type: "purchase_cost_ambiguity";
    } & AssistantUnitContext)
  | ({
      options: ProductSelectionOption[];
      productName: string;
      quantity: number;
      type: "purchase_missing_unit_cost_product_disambiguation";
    } & AssistantUnitContext)
  | ({
      options: ProductSelectionOption[];
      productName: string;
      quantity: number;
      type: "purchase_product_disambiguation";
      unitCostCents: number;
    } & AssistantUnitContext)
  | {
      options: ProductSelectionOption[];
      productName: string;
      quantity: number;
      type: "sale_product_disambiguation";
      unitPriceCents: number | null;
    }
  | ({
      productName: string;
      quantity: number;
      type: "new_product_purchase_missing_unit_cost";
    } & AssistantUnitContext)
  | ({
      productName: string;
      quantity: number;
      type: "new_product_purchase_missing_sale_price";
      unitCostCents: number;
    } & AssistantUnitContext)
  | ({
      productName: string;
      quantity: number;
      salePriceCents: number;
      type: "new_product_purchase_missing_minimum_stock";
      unitCostCents: number;
    } & AssistantUnitContext)
  | ({
      category: string | null;
      initialStock: number | null;
      minimumStock: number | null;
      name: string;
      salePriceCents: number | null;
      type: "product_missing_fields";
      unitCostCents: number | null;
    } & AssistantUnitContext);

type PurchaseMissingUnitCostContext = Extract<
  AssistantPendingContext,
  { type: "new_product_purchase_missing_unit_cost" | "purchase_missing_unit_cost" }
>;

export type ConfirmDraftState = {
  status: "idle" | "success" | "error";
  message: string;
};

type ProductForDraft = {
  active: boolean;
  aliases?: Array<{ alias: string }>;
  currentStock: unknown;
  id: string;
  name: string;
  salePriceCents: number;
  unit: ProductUnitValue;
  unitCostCents: number;
};

type CancellationDraftBuildResult =
  | { status: "ambiguous"; options: string[]; targetType: ParsedCancellationRequest["targetType"] }
  | { status: "draft"; draft: CancellationDraft }
  | { status: "not_found" };

export async function sendAssistantMessageAction(
  _previousState: AssistantActionState,
  formData: FormData,
): Promise<AssistantActionState> {
  const message = String(formData.get("message") ?? "").trim();

  if (message.length === 0) {
    return { status: "error", message: "Escreva uma pergunta ou lançamento.", userMessage: "" };
  }

  const pendingContext = parsePendingContextFromForm(formData);

  if (pendingContext && !shouldStartNewMessageInsteadOfPending(pendingContext, message)) {
    return handlePendingAssistantContext(pendingContext, message);
  }

  const resolved = await resolveAssistantMessageWithExternalAi(message, {
    context: buildExternalAssistantContext,
  });
  const parsed = resolved.parsed;

  if (parsed.kind === "unknown") {
    return { status: "error", message: parsed.message, userMessage: message };
  }

  if (parsed.kind === "question") {
    const context = await getAssistantQuestionContext(parsed);
    return {
      status: "answer",
      message: "Resposta calculada com dados reais.",
      userMessage: message,
      answer: answerQuestionFromContext(parsed, context),
    };
  }

  if (parsed.kind === "social") {
    return {
      status: "answer",
      message: "Resposta social.",
      userMessage: message,
      answer: {
        title: "NEXIS",
        value: "Posso ajudar",
        body: parsed.message,
        tone: "neutral",
      },
    };
  }

  if (parsed.kind === "sale") {
    return buildSaleDraftResponse(parsed, message);
  }

  if (parsed.kind === "purchase") {
    return buildPurchaseDraftResponse(parsed, message);
  }

  if (parsed.kind === "ambiguous_purchase_cost") {
    return askAmbiguousPurchaseCost(parsed, message);
  }

  if (parsed.kind === "partial_purchase") {
    return buildPartialPurchaseResponse(parsed, message);
  }

  if (parsed.kind === "product") {
    return buildProductFormPrefillResponse(parsed, message);
  }

  if (parsed.kind === "stock_loss") {
    return buildStockLossDraftResponse(parsed, message);
  }

  if (parsed.kind === "cancellation") {
    return buildCancellationDraftResponse(parsed, message);
  }

  const draft = expenseDraftSchema.parse({
    type: "expense",
    description: parsed.description,
    category: parsed.category,
    amountCents: parsed.amountCents,
    confirmed: false,
    paidAt: new Date().toISOString(),
  });

  return {
    status: "draft",
    message: "Confira o rascunho antes de salvar.",
    userMessage: message,
    draft,
  };
}

export async function confirmSaleDraft(
  _previousState: ConfirmDraftState,
  formData: FormData,
): Promise<ConfirmDraftState> {
  const parsed = parseDraftFromForm(formData, saleDraftSchema);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await persistSaleDraft(parsed.data);
    revalidateAssistantPaths();

    return { status: "success", message: "Venda confirmada e estoque atualizado." };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel confirmar a venda.") };
  }
}

export async function confirmPurchaseDraft(
  _previousState: ConfirmDraftState,
  formData: FormData,
): Promise<ConfirmDraftState> {
  const parsed = parseDraftFromForm(formData, purchaseDraftSchema);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await persistPurchaseDraft(parsed.data);
    revalidateAssistantPaths();

    return { status: "success", message: "Compra confirmada e estoque atualizado." };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel confirmar a compra.") };
  }
}

export async function confirmStockLossDraft(
  _previousState: ConfirmDraftState,
  formData: FormData,
): Promise<ConfirmDraftState> {
  const parsed = parseDraftFromForm(formData, stockLossDraftSchema);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await persistStockLossDraft(parsed.data);
    revalidateAssistantPaths();

    return { status: "success", message: "Perda confirmada, estoque baixado e perda registrada." };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel confirmar a perda.") };
  }
}

export async function confirmCancellationDraft(
  _previousState: ConfirmDraftState,
  formData: FormData,
): Promise<ConfirmDraftState> {
  const parsed = parseDraftFromForm(formData, cancellationDraftSchema);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await persistCancellationDraft(parsed.data);
    revalidateAssistantPaths();

    return { status: "success", message: "Cancelamento registrado com rastreabilidade." };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel registrar o cancelamento.") };
  }
}

export async function confirmExpenseDraft(
  _previousState: ConfirmDraftState,
  formData: FormData,
): Promise<ConfirmDraftState> {
  const parsed = parseDraftFromForm(formData, expenseDraftSchema);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    const draft = parsed.data;
    const expense = normalizeExpenseForPersistence({ amountCents: draft.amountCents, confirmed: true });

    await prisma.expense.create({
      data: {
        amountCents: expense.amountCents,
        category: draft.category as ExpenseCategory,
        confirmed: true,
        description: draft.description,
        origin: "ASSISTANT_TEXT",
        paidAt: new Date(draft.paidAt),
      },
    });

    revalidateAssistantPaths();

    return { status: "success", message: "Despesa confirmada e salva." };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel confirmar a despesa.") };
  }
}

export async function confirmProductDraft(
  _previousState: ConfirmDraftState,
  formData: FormData,
): Promise<ConfirmDraftState> {
  const parsed = parseDraftFromForm(formData, productDraftSchema);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await persistProductDraft(parsed.data);
    revalidateAssistantPaths();

    return { status: "success", message: "Produto salvo." };
  } catch (error) {
    return { status: "error", message: productCreationErrorMessage(error, "Nao foi possivel salvar o produto.") };
  }
}

async function handlePendingAssistantContext(
  context: AssistantPendingContext,
  userMessage: string,
): Promise<AssistantActionState> {
  try {
    if (context.type === "product_missing_fields") {
      const response = await buildProductFormPrefillResponse(mergeProductMissingFieldsContext(context, userMessage), userMessage);

      return response.status === "answer" ? { ...response, pendingContext: context } : response;
    }

    if (context.type === "purchase_missing_unit_cost") {
      const unitCostCents = extractPositiveMoneyFromMessage(userMessage, "Custo por unidade");

      if (unitCostCents === null) {
        return askPurchaseUnitCost(context.productName, context.quantity, context, userMessage);
      }

      if (context.productId) {
        const product = await findActiveProductById(context.productId);

        if (product) {
          return buildPurchaseDraftForProduct(product, context.quantity, unitCostCents, userMessage);
        }
      }

      const matches = await findActiveProductsMatching(context.productName, "purchase");

      if (matches.length === 1) {
        return buildPurchaseDraftForProduct(matches[0], context.quantity, unitCostCents, userMessage);
      }

      if (matches.length > 1) {
        return askProductDisambiguation(
          {
            options: toProductSelectionOptions(matches),
            productName: context.productName,
            quantity: context.quantity,
            type: "purchase_product_disambiguation",
            unitCostCents,
            ...unitContext(context),
          },
          matches,
          userMessage,
        );
      }

      return buildNewProductPurchaseFormPrefillResponse(
        {
          productName: context.productName,
          quantity: context.quantity,
          unit: context.unit,
          unitCostCents,
        },
        userMessage,
      );
    }

    if (context.type === "purchase_cost_ambiguity") {
      const unitCostCents = resolveAmbiguousPurchaseUnitCost(context, userMessage);

      if (unitCostCents === null) {
        return askAmbiguousPurchaseCost(context, userMessage);
      }

      return buildPurchaseDraftResponse(
        {
          kind: "purchase",
          priceBasis: context.priceBasis,
          productName: context.productName,
          quantity: context.quantity,
          unit: context.unit,
          unitCostCents,
          unitLabel: context.unitLabel,
        },
        userMessage,
      );
    }

    if (context.type === "sale_product_disambiguation") {
      const selectedProduct = await resolveProductSelection(context, userMessage);

      if (selectedProduct) {
        return buildSaleDraftForProduct(selectedProduct, context.quantity, context.unitPriceCents, userMessage);
      }

      return askProductDisambiguation(
        context,
        await findProductsFromPendingOptions(context),
        userMessage,
        "retry",
      );
    }

    if (context.type === "purchase_product_disambiguation") {
      const selectedProduct = await resolveProductSelection(context, userMessage);

      if (selectedProduct) {
        return buildPurchaseDraftForProduct(selectedProduct, context.quantity, context.unitCostCents, userMessage);
      }

      return askProductDisambiguation(
        context,
        await findProductsFromPendingOptions(context),
        userMessage,
        "retry",
      );
    }

    if (context.type === "purchase_missing_unit_cost_product_disambiguation") {
      const selectedProduct = await resolveProductSelection(context, userMessage);

      if (selectedProduct) {
        return askPurchaseUnitCost(selectedProduct.name, context.quantity, {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity: context.quantity,
          type: "purchase_missing_unit_cost",
          ...unitContext(context),
        }, userMessage);
      }

      return askProductDisambiguation(
        context,
        await findProductsFromPendingOptions(context),
        userMessage,
        "retry",
      );
    }

    if (context.type === "new_product_purchase_missing_unit_cost") {
      const unitCostCents = extractPositiveMoneyFromMessage(userMessage, "Custo por unidade");

      if (unitCostCents === null) {
        return askPurchaseUnitCost(context.productName, context.quantity, context, userMessage);
      }

      return buildNewProductPurchaseFormPrefillResponse(
        {
          productName: context.productName,
          quantity: context.quantity,
          unit: context.unit,
          unitCostCents,
        },
        userMessage,
      );
    }

    if (context.type === "new_product_purchase_missing_sale_price") {
      const salePriceCents = extractPositiveMoneyFromMessage(userMessage, "Preco de venda");

      if (salePriceCents === null) {
        return askNewProductSalePrice(context, userMessage);
      }

      return askNewProductMinimumStock(
        {
          productName: context.productName,
          quantity: context.quantity,
          salePriceCents,
          type: "new_product_purchase_missing_minimum_stock",
          unitCostCents: context.unitCostCents,
          ...unitContext(context),
        },
        userMessage,
      );
    }

    const minimumStock = extractNonNegativeQuantityFromMessage(userMessage, "Estoque minimo");

    if (minimumStock === null) {
      return askNewProductMinimumStock(context, userMessage);
    }

    const response = await buildProductFormPrefillResponse(
      {
        category: null,
        initialStock: context.quantity,
        initialStockSource: "purchase",
        kind: "product",
        minimumStock,
        missingFields: [],
        name: formatProductNameForDraft(context.productName),
        salePriceCents: context.salePriceCents,
        unit: context.unit ?? inferProductUnit(context.productName),
        unitCostCents: context.unitCostCents,
      },
      userMessage,
    );

    return {
      ...response,
      message: `${productDraftBaseMessage(context.productName)} As ${formatQuantity(
        context.quantity,
        context.unitLabel,
      )} informadas entram como estoque inicial; nada foi salvo sem o botão.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "Nao consegui usar essa resposta. Revise o valor informado."),
      userMessage,
      pendingContext: context,
    };
  }
}

async function buildPartialPurchaseResponse(
  parsed: ParsedPartialPurchaseRequest,
  userMessage: string,
): Promise<AssistantActionState> {
  const matches = await findActiveProductsMatching(parsed.productName, "purchase");

  if (matches.length > 1) {
    return askProductDisambiguation(
      {
        options: toProductSelectionOptions(matches),
        productName: parsed.productName,
        quantity: parsed.quantity,
        type: "purchase_missing_unit_cost_product_disambiguation",
        ...unitContext(parsed),
      },
      matches,
      userMessage,
    );
  }

  if (matches.length === 1) {
    return askPurchaseUnitCost(matches[0].name, parsed.quantity, {
      productId: matches[0].id,
      productName: matches[0].name,
      quantity: parsed.quantity,
      type: "purchase_missing_unit_cost",
      ...unitContext(parsed),
    }, userMessage);
  }

  return askPurchaseUnitCost(formatProductNameForDraft(parsed.productName), parsed.quantity, {
    productName: parsed.productName,
    quantity: parsed.quantity,
    type: "new_product_purchase_missing_unit_cost",
    ...unitContext(parsed),
  }, userMessage);
}

function askAmbiguousPurchaseCost(
  parsed: ParsedAmbiguousPurchaseCostRequest | Extract<AssistantPendingContext, { type: "purchase_cost_ambiguity" }>,
  userMessage: string,
): AssistantActionState {
  const amount = formatMoney(parsed.amountCents);

  return {
    status: "answer",
    message: "Preciso confirmar se o valor é total ou unitário.",
    userMessage,
    pendingContext: {
      amountCents: parsed.amountCents,
      priceBasis: parsed.priceBasis,
      productName: parsed.productName,
      quantity: parsed.quantity,
      type: "purchase_cost_ambiguity",
      unit: parsed.unit,
      unitLabel: parsed.unitLabel,
    },
    answer: {
      title: "Compra ambígua",
      value: "Total ou cada?",
      body: `Esses ${amount} foram o total da compra ou o valor de cada unidade? Responda "total" ou "cada unidade".`,
      tone: "neutral",
    },
  };
}

function askPurchaseUnitCost(
  productName: string,
  quantity: number,
  pendingContext: PurchaseMissingUnitCostContext,
  userMessage: string,
): AssistantActionState {
  return {
    status: "answer",
    message: "Preciso do custo da entrada de estoque.",
    userMessage,
    pendingContext,
    answer: {
      title: "Entrada de estoque",
      value: "Falta custo",
      body: `Entendi que você quer registrar entrada de ${formatQuantity(
        quantity,
        pendingContext.unitLabel,
      )} de ${productName} no estoque. Você pagou quanto por ${questionUnitLabel(pendingContext.unitLabel)}?`,
      tone: "stock",
    },
  };
}

function askProductDisambiguation(
  pendingContext: Extract<
    AssistantPendingContext,
    {
      type:
        | "purchase_missing_unit_cost_product_disambiguation"
        | "purchase_product_disambiguation"
        | "sale_product_disambiguation";
    }
  >,
  matches: ProductForDraft[],
  userMessage: string,
  mode: "initial" | "retry" = "initial",
): AssistantActionState {
  const nextPendingContext = {
    ...pendingContext,
    options: toProductSelectionOptions(matches),
  };
  const productOptions = formatProductOptions(matches);
  const body =
    mode === "retry"
      ? `Não consegui escolher com segurança. Responda com o número: ${productOptions}`
      : `Encontrei mais de um produto parecido com ${formatProductNameForDraft(
          pendingContext.productName,
        )}. Qual deles você quis dizer? ${productOptions}`;

  return {
    status: "answer",
    message: "Preciso saber qual produto você quis dizer.",
    userMessage,
    pendingContext: nextPendingContext,
    answer: {
      title: "Produto ambíguo",
      value: "Escolha o produto",
      body,
      tone: "neutral",
    },
  };
}

function askNewProductSalePrice(
  pendingContext: Extract<AssistantPendingContext, { type: "new_product_purchase_missing_sale_price" }>,
  userMessage: string,
): AssistantActionState {
  return {
    status: "answer",
    message: "Preciso do preço de venda para cadastrar o produto.",
    userMessage,
    pendingContext,
    answer: {
      title: "Produto não cadastrado",
      value: "Falta preço de venda",
      body: `Esse produto ainda não está cadastrado. Para cadastrar ${formatProductNameForDraft(
        pendingContext.productName,
      )} com estoque inicial de ${formatQuantity(
        pendingContext.quantity,
        pendingContext.unitLabel,
      )}, preciso do preço de venda. Por quanto você vende ${unitWithArticle(pendingContext.unitLabel)}?`,
      tone: "neutral",
    },
  };
}

function askNewProductMinimumStock(
  pendingContext: Extract<AssistantPendingContext, { type: "new_product_purchase_missing_minimum_stock" }>,
  userMessage: string,
): AssistantActionState {
  return {
    status: "answer",
    message: "Preciso do estoque mínimo para cadastrar o produto.",
    userMessage,
    pendingContext,
    answer: {
      title: "Cadastro de produto",
      value: "Falta estoque mínimo",
      body: `Qual estoque mínimo em ${pluralCommercialUnitLabel(
        pendingContext.unitLabel,
      )} você quer usar para ${formatProductNameForDraft(pendingContext.productName)}?`,
      tone: "neutral",
    },
  };
}

async function buildSaleDraftResponse(
  parsed: ParsedSaleDraftRequest,
  userMessage: string,
): Promise<AssistantActionState> {
  const productResult = await resolveActiveProduct(parsed.productName, "sale");

  if (!productResult.success) {
    if (productResult.reason === "ambiguous") {
      return askProductDisambiguation(
        {
          options: toProductSelectionOptions(productResult.matches),
          productName: parsed.productName,
          quantity: parsed.quantity,
          type: "sale_product_disambiguation",
          unitPriceCents: parsed.unitPriceCents,
        },
        productResult.matches,
        userMessage,
      );
    }

    return { status: "error", message: productResult.message, userMessage };
  }

  try {
    return buildSaleDraftForProduct(
      productResult.product,
      normalizeQuantityForProductUnit(parsed.quantity, parsed.unit, productResult.product.unit, "venda"),
      normalizeAmountForProductUnit(parsed.unitPriceCents, parsed.unit, productResult.product.unit, "preço de venda"),
      userMessage,
    );
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel criar o rascunho da venda."), userMessage };
  }
}

async function buildPurchaseDraftResponse(
  parsed: ParsedPurchaseDraftRequest,
  userMessage: string,
): Promise<AssistantActionState> {
  const productResult = await resolveActiveProduct(parsed.productName, "purchase");

  if (!productResult.success) {
    if (productResult.reason === "ambiguous") {
      return askProductDisambiguation(
        {
          options: toProductSelectionOptions(productResult.matches),
          productName: parsed.productName,
          quantity: parsed.quantity,
          type: "purchase_product_disambiguation",
          unitCostCents: parsed.unitCostCents,
          ...unitContext(parsed),
        },
        productResult.matches,
        userMessage,
      );
    }

    return buildNewProductPurchaseFormPrefillResponse(parsed, userMessage);
  }

  try {
    return buildPurchaseDraftForProduct(
      productResult.product,
      normalizeQuantityForProductUnit(parsed.quantity, parsed.unit, productResult.product.unit, "compra"),
      normalizeRequiredAmountForProductUnit(parsed.unitCostCents, parsed.unit, productResult.product.unit, "custo de compra"),
      userMessage,
    );
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel criar o rascunho da compra."), userMessage };
  }
}

function buildSaleDraftForProduct(
  product: ProductForDraft,
  quantity: number,
  unitPriceCents: number | null,
  userMessage: string,
): AssistantActionState {
  try {
    const transaction = buildSaleTransaction({
      product: {
        active: product.active,
        currentStock: Number(product.currentStock),
        id: product.id,
        salePriceCents: product.salePriceCents,
        unitCostCents: product.unitCostCents,
      },
      quantity,
      unitPriceCents,
    });
    const stockBefore = Number(product.currentStock);
    const draft = saleDraftSchema.parse({
      type: "sale",
      productId: product.id,
      productName: product.name,
      quantity,
      registeredSalePriceCents: product.salePriceCents,
      unitPriceCents: transaction.item.unitPriceCents,
      unitCostSnapshotCents: transaction.item.unitCostSnapshotCents,
      totalAmountCents: transaction.item.totalAmountCents,
      totalCostCents: transaction.item.totalCostCents,
      estimatedGrossProfitCents: transaction.item.totalAmountCents - transaction.item.totalCostCents,
      stockBefore,
      stockAfter: transaction.nextStock,
      stockImpact: -transaction.movementQuantity,
    });

    return {
      status: "draft",
      message: "Confira o rascunho antes de salvar.",
      userMessage,
      draft,
    };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel criar o rascunho da venda."), userMessage };
  }
}

function buildPurchaseDraftForProduct(
  product: ProductForDraft,
  quantity: number,
  unitCostCents: number,
  userMessage: string,
): AssistantActionState {
  try {
    const transaction = buildPurchaseTransaction({
      currentStock: Number(product.currentStock),
      quantity,
      unitCostCents,
    });
    const draft = purchaseDraftSchema.parse({
      type: "purchase",
      productId: product.id,
      productName: product.name,
      quantity,
      unitCostCents,
      totalCostCents: transaction.totalCostCents,
      stockImpact: transaction.movementQuantity,
    });

    return {
      status: "draft",
      message: "Confira o rascunho antes de salvar.",
      userMessage,
      draft,
    };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel criar o rascunho da compra."), userMessage };
  }
}

async function buildStockLossDraftResponse(
  parsed: ParsedStockLossDraftRequest,
  userMessage: string,
): Promise<AssistantActionState> {
  const productResult = await resolveActiveProduct(parsed.productName, "sale");

  if (!productResult.success) {
    const message = productResult.reason === "not_found"
      ? `Nao encontrei produto ativo para "${parsed.productName}". Cadastre o produto ou use o nome exato antes de registrar perda.`
      : productResult.message;

    return { status: "error", message, userMessage };
  }

  return buildStockLossDraftForProduct(productResult.product, parsed.quantity, parsed.reason, userMessage);
}

function buildStockLossDraftForProduct(
  product: ProductForDraft,
  quantity: number,
  reason: string,
  userMessage: string,
): AssistantActionState {
  try {
    if (!product.active) {
      throw new Error("Produto inativo nao pode ter perda registrada.");
    }

    const stockBefore = Number(product.currentStock);
    const stockAfter = calculateStockAfterSale({ currentStock: stockBefore, quantitySold: quantity });
    const totalCostCents = calculateLineTotalCents({
      quantity,
      unitAmountCents: product.unitCostCents,
      quantityFieldName: "quantidade perdida",
      unitAmountFieldName: "custo do produto",
    });
    const draft = stockLossDraftSchema.parse({
      type: "stock_loss",
      productId: product.id,
      productName: product.name,
      quantity,
      reason,
      unitCostSnapshotCents: product.unitCostCents,
      totalCostCents,
      stockBefore,
      stockAfter,
      stockImpact: -quantity,
    });

    return {
      status: "draft",
      message: "Confira o rascunho antes de baixar estoque.",
      userMessage,
      draft,
    };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "Nao foi possivel criar o rascunho da perda."), userMessage };
  }
}

async function buildCancellationDraftResponse(
  parsed: ParsedCancellationRequest,
  userMessage: string,
): Promise<AssistantActionState> {
  const result =
    parsed.targetType === "sale"
      ? await buildSaleCancellationDraft(parsed)
      : parsed.targetType === "purchase"
        ? await buildPurchaseCancellationDraft(parsed)
        : await buildExpenseCancellationDraft(parsed);

  if (result.status === "not_found") {
    return {
      status: "error",
      message: cancellationNotFoundMessage(parsed.targetType),
      userMessage,
    };
  }

  if (result.status === "ambiguous") {
    return {
      status: "answer",
      message: "Mais de um registro encontrado para cancelamento.",
      userMessage,
      answer: {
        title: "Cancelamento",
        value: "Preciso de mais detalhe",
        body: cancellationAmbiguousMessage(result.targetType, result.options),
        tone: "neutral",
      },
    };
  }

  return {
    status: "draft",
    message: "Confira o cancelamento antes de registrar.",
    userMessage,
    draft: result.draft,
  };
}

async function buildSaleCancellationDraft(parsed: ParsedCancellationRequest): Promise<CancellationDraftBuildResult> {
  const sales = await prisma.sale.findMany({
    include: {
      items: {
        include: {
          product: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { soldAt: "desc" },
    take: 25,
    where: { cancelledAt: null },
  });
  const candidates = parsed.productName
    ? sales.filter((sale) =>
        sale.items.some((item) => productMatchesCancellationQuery(parsed.productName ?? "", item.product.name)),
      )
    : sales;
  const sale = candidates[0];

  if (!sale) {
    return { status: "not_found" };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      targetType: "sale",
      options: candidates.slice(0, 5).map((candidate, index) => `${index + 1}. ${saleCancellationOption(candidate)}`),
    };
  }

  const quantity = sale.items.reduce((total, item) => total + Number(item.quantity), 0);
  const productsLabel = sale.items
    .map((item) => `${formatQuantity(Number(item.quantity))} ${item.product.name}`)
    .join(", ");

  return {
    status: "draft",
    draft: cancellationDraftSchema.parse({
      type: "cancellation",
      targetType: "sale",
      targetId: sale.id,
      targetLabel: `Venda de ${productsLabel}`,
      reason: parsed.reason,
      stockImpact: quantity,
      amountImpactCents: -sale.totalAmountCents,
    }),
  };
}

async function buildPurchaseCancellationDraft(parsed: ParsedCancellationRequest): Promise<CancellationDraftBuildResult> {
  const purchases = await prisma.purchase.findMany({
    include: {
      product: {
        select: { name: true },
      },
    },
    orderBy: { purchasedAt: "desc" },
    take: 25,
    where: { cancelledAt: null },
  });
  const candidates = parsed.productName
    ? purchases.filter((purchase) => productMatchesCancellationQuery(parsed.productName ?? "", purchase.product.name))
    : purchases;
  const purchase = candidates[0];

  if (!purchase) {
    return { status: "not_found" };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      targetType: "purchase",
      options: candidates
        .slice(0, 5)
        .map((candidate, index) => `${index + 1}. Compra de ${formatQuantity(Number(candidate.quantity))} ${candidate.product.name} (${formatMoney(candidate.totalCostCents)})`),
    };
  }

  return {
    status: "draft",
    draft: cancellationDraftSchema.parse({
      type: "cancellation",
      targetType: "purchase",
      targetId: purchase.id,
      targetLabel: `Compra de ${formatQuantity(Number(purchase.quantity))} ${purchase.product.name}`,
      reason: parsed.reason,
      stockImpact: -Number(purchase.quantity),
      amountImpactCents: -purchase.totalCostCents,
    }),
  };
}

async function buildExpenseCancellationDraft(parsed: ParsedCancellationRequest): Promise<CancellationDraftBuildResult> {
  const expenses = await prisma.expense.findMany({
    orderBy: { paidAt: "desc" },
    take: 25,
    where: { cancelledAt: null },
  });
  const candidates = parsed.productName
    ? expenses.filter((expense) => productMatchesCancellationQuery(parsed.productName ?? "", expense.description))
    : expenses;
  const expense = candidates[0];

  if (!expense) {
    return { status: "not_found" };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      targetType: "expense",
      options: candidates
        .slice(0, 5)
        .map((candidate, index) => `${index + 1}. Despesa: ${candidate.description} (${formatMoney(candidate.amountCents)})`),
    };
  }

  return {
    status: "draft",
    draft: cancellationDraftSchema.parse({
      type: "cancellation",
      targetType: "expense",
      targetId: expense.id,
      targetLabel: `Despesa: ${expense.description}`,
      reason: parsed.reason,
      stockImpact: 0,
      amountImpactCents: -expense.amountCents,
    }),
  };
}

async function buildProductFormPrefillResponse(
  parsed: ParsedProductDraftRequest,
  userMessage: string,
): Promise<AssistantActionState> {
  const prefill: ProductFormPrefill = {
    category: parsed.category ?? undefined,
    initialPurchase: parsed.initialStockSource === "purchase",
    initialStock: parsed.initialStock ?? undefined,
    minimumStock: parsed.minimumStock ?? undefined,
    name: parsed.name ?? undefined,
    salePriceCents: parsed.salePriceCents ?? undefined,
    sensitiveProductWarning: parsed.name ? isSensitiveProductName(parsed.name) : undefined,
    unit: parsed.unit,
    unitCostCents: parsed.unitCostCents ?? undefined,
  };
  const hasMissingFields = parsed.missingFields.length > 0;

  return {
    status: "answer",
    message: "Abrindo cadastro de produto com os dados interpretados.",
    userMessage,
    productFormPrefill: prefill,
    answer: {
      title: "Cadastro de produto",
      value: hasMissingFields ? "Complete os campos" : "Revise e salve",
      body: productFormPrefillMessage(parsed.missingFields),
      tone: "neutral",
    },
  };
}

async function buildNewProductPurchaseFormPrefillResponse(
  input: {
    productName: string;
    quantity: number;
    unit?: ProductUnitValue;
    unitCostCents: number;
  },
  userMessage: string,
): Promise<AssistantActionState> {
  return buildProductFormPrefillResponse(
    {
      category: null,
      initialStock: input.quantity,
      initialStockSource: "purchase",
      kind: "product",
      minimumStock: null,
      missingFields: ["salePriceCents", "minimumStock"],
      name: formatProductNameForDraft(input.productName),
      salePriceCents: null,
      unit: input.unit ?? inferProductUnit(input.productName),
      unitCostCents: input.unitCostCents,
    },
    userMessage,
  );
}

async function resolveActiveProduct(productName: string, operation: AiProductResolveOperation): Promise<
  | { success: true; product: ProductForDraft }
  | { success: false; message: string; reason: "not_found" }
  | { success: false; matches: ProductForDraft[]; message: string; reason: "ambiguous" }
> {
  const resolution = resolveProductForAi({
    operation,
    productName,
    products: await listActiveProductsForAiResolution(),
  });

  if (resolution.status === "unique") {
    return { success: true, product: resolution.product };
  }

  if (resolution.status === "ambiguous") {
    return {
      success: false,
      matches: resolution.candidates,
      message: resolution.nextQuestion,
      reason: "ambiguous",
    };
  }

  return {
    success: false,
    message: resolution.nextQuestion,
    reason: "not_found",
  };
}

async function findActiveProductsMatching(
  productName: string,
  operation: AiProductResolveOperation = "purchase",
): Promise<ProductForDraft[]> {
  const resolution = resolveProductForAi({
    operation,
    productName,
    products: await listActiveProductsForAiResolution(),
  });

  if (resolution.status === "unique") {
    return [resolution.product];
  }

  if (resolution.status === "ambiguous") {
    return resolution.candidates;
  }

  return [];
}

async function listActiveProductsForAiResolution(): Promise<ProductForDraft[]> {
  return prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      active: true,
      aliases: {
        select: {
          alias: true,
        },
      },
      currentStock: true,
      id: true,
      name: true,
      salePriceCents: true,
      unit: true,
      unitCostCents: true,
    },
    where: { active: true },
  });
}

async function findActiveProductById(productId: string): Promise<ProductForDraft | null> {
  return prisma.product.findFirst({
    select: {
      active: true,
      aliases: {
        select: {
          alias: true,
        },
      },
      currentStock: true,
      id: true,
      name: true,
      salePriceCents: true,
      unit: true,
      unitCostCents: true,
    },
    where: { active: true, id: productId },
  });
}

async function findProductsFromPendingOptions(
  context: Extract<
    AssistantPendingContext,
    {
      type:
        | "purchase_missing_unit_cost_product_disambiguation"
        | "purchase_product_disambiguation"
        | "sale_product_disambiguation";
    }
  >,
): Promise<ProductForDraft[]> {
  if (context.options.length === 0) {
    return findActiveProductsMatching(
      context.productName,
      context.type === "sale_product_disambiguation" ? "sale" : "purchase",
    );
  }

  const products: ProductForDraft[] = await prisma.product.findMany({
    select: {
      active: true,
      aliases: {
        select: {
          alias: true,
        },
      },
      currentStock: true,
      id: true,
      name: true,
      salePriceCents: true,
      unit: true,
      unitCostCents: true,
    },
    where: {
      active: true,
      id: { in: context.options.map((option) => option.id) },
    },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  return context.options
    .map((option) => productsById.get(option.id))
    .filter((product): product is ProductForDraft => Boolean(product));
}

function normalizeQuantityForProductUnit(
  quantity: number,
  sourceUnit: ProductUnitValue | undefined,
  productUnit: ProductUnitValue,
  operation: "compra" | "venda",
): number {
  const converted = convertQuantityBetweenProductUnits({
    fromUnit: sourceUnit,
    quantity,
    toUnit: productUnit,
  });

  if (converted === null) {
    throw new Error(`Unidade informada na ${operation} nao combina com a unidade cadastrada do produto.`);
  }

  return converted;
}

function normalizeAmountForProductUnit(
  amountCents: number | null,
  sourceUnit: ProductUnitValue | undefined,
  productUnit: ProductUnitValue,
  fieldName: string,
): number | null {
  if (amountCents === null) {
    return null;
  }

  const converted = convertUnitAmountBetweenProductUnits({
    amountCents,
    fromUnit: sourceUnit,
    toUnit: productUnit,
  });

  if (converted === null) {
    throw new Error(`${fieldName} informado nao pode ser convertido para a unidade cadastrada do produto em centavos inteiros.`);
  }

  return converted;
}

function normalizeRequiredAmountForProductUnit(
  amountCents: number,
  sourceUnit: ProductUnitValue | undefined,
  productUnit: ProductUnitValue,
  fieldName: string,
): number {
  const converted = normalizeAmountForProductUnit(amountCents, sourceUnit, productUnit, fieldName);

  if (converted === null) {
    throw new Error(`${fieldName} e obrigatorio.`);
  }

  return converted;
}

async function persistSaleDraft(draft: SaleDraft): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      select: {
        active: true,
        currentStock: true,
        id: true,
        salePriceCents: true,
        unitCostCents: true,
      },
      where: { id: draft.productId },
    });

    if (!product) {
      throw new Error("Produto nao encontrado.");
    }

    const transaction = buildSaleTransaction({
      product: {
        active: product.active,
        currentStock: Number(product.currentStock),
        id: product.id,
        salePriceCents: product.salePriceCents,
        unitCostCents: product.unitCostCents,
      },
      quantity: draft.quantity,
      unitPriceCents: draft.unitPriceCents,
    });

    const sale = await tx.sale.create({
      data: {
        origin: "ASSISTANT_TEXT",
        totalAmountCents: transaction.item.totalAmountCents,
      },
    });
    const saleItem = await tx.saleItem.create({
      data: {
        productId: transaction.item.productId,
        quantity: transaction.item.quantity.toString(),
        saleId: sale.id,
        totalAmountCents: transaction.item.totalAmountCents,
        totalCostCents: transaction.item.totalCostCents,
        unitCostSnapshotCents: transaction.item.unitCostSnapshotCents,
        unitPriceCents: transaction.item.unitPriceCents,
      },
    });

    await tx.product.update({
      data: { currentStock: transaction.nextStock.toString() },
      where: { id: product.id },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        quantity: transaction.movementQuantity.toString(),
        origin: "ASSISTANT_TEXT",
        reason: "ASSISTANT_SALE",
        saleItemId: saleItem.id,
        type: StockMovementType.SALE,
      },
    });
  });
}

async function persistPurchaseDraft(draft: PurchaseDraft): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      select: { active: true, currentStock: true, id: true },
      where: { id: draft.productId },
    });

    if (!product) {
      throw new Error("Produto nao encontrado.");
    }

    if (!product.active) {
      throw new Error("Produto inativo nao pode receber compra.");
    }

    const transaction = buildPurchaseTransaction({
      currentStock: Number(product.currentStock),
      quantity: draft.quantity,
      unitCostCents: draft.unitCostCents,
    });
    const purchase = await tx.purchase.create({
      data: {
        productId: product.id,
        quantity: draft.quantity.toString(),
        origin: "ASSISTANT_TEXT",
        supplier: null,
        totalCostCents: transaction.totalCostCents,
        unitCostCents: draft.unitCostCents,
      },
    });

    await tx.product.update({
      data: {
        currentStock: transaction.nextStock.toString(),
        unitCostCents: draft.unitCostCents,
      },
      where: { id: product.id },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        purchaseId: purchase.id,
        quantity: transaction.movementQuantity.toString(),
        origin: "ASSISTANT_TEXT",
        reason: "ASSISTANT_PURCHASE",
        type: StockMovementType.PURCHASE,
      },
    });
  });
}

async function persistStockLossDraft(draft: StockLossDraft): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      select: {
        active: true,
        currentStock: true,
        id: true,
        name: true,
        unitCostCents: true,
      },
      where: { id: draft.productId },
    });

    if (!product) {
      throw new Error("Produto nao encontrado.");
    }

    if (!product.active) {
      throw new Error("Produto inativo nao pode ter perda registrada.");
    }

    const stockBefore = Number(product.currentStock);
    const nextStock = calculateStockAfterSale({ currentStock: stockBefore, quantitySold: draft.quantity });
    const totalCostCents = calculateLineTotalCents({
      quantity: draft.quantity,
      unitAmountCents: product.unitCostCents,
      quantityFieldName: "quantidade perdida",
      unitAmountFieldName: "custo do produto",
    });
    const expense = await tx.expense.create({
      data: {
        amountCents: totalCostCents,
        category: ExpenseCategory.LOSS_WASTE,
        confirmed: true,
        description: `Perda de estoque: ${product.name} - ${draft.reason}`,
        origin: "ASSISTANT_TEXT",
      },
    });
    const stockLoss = await tx.stockLoss.create({
      data: {
        expenseId: expense.id,
        origin: "ASSISTANT_TEXT",
        productId: product.id,
        quantity: draft.quantity.toString(),
        reason: draft.reason,
        totalCostCents,
        unitCostSnapshotCents: product.unitCostCents,
      },
    });

    await tx.product.update({
      data: { currentStock: nextStock.toString() },
      where: { id: product.id },
    });
    await tx.stockMovement.create({
      data: {
        origin: "ASSISTANT_TEXT",
        productId: product.id,
        quantity: draft.quantity.toString(),
        reason: "ASSISTANT_STOCK_LOSS",
        stockLossId: stockLoss.id,
        type: StockMovementType.LOSS,
      },
    });
  });
}

async function persistCancellationDraft(draft: CancellationDraft): Promise<void> {
  if (draft.targetType === "sale") {
    await cancelSaleDraft(draft);
    return;
  }

  if (draft.targetType === "purchase") {
    await cancelPurchaseDraft(draft);
    return;
  }

  if (draft.targetType === "stock_loss") {
    await cancelStockLossDraft(draft);
    return;
  }

  await cancelExpenseDraft(draft);
}

async function cancelSaleDraft(draft: CancellationDraft): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      include: {
        items: {
          include: {
            product: {
              select: { currentStock: true, id: true },
            },
          },
        },
      },
      where: { id: draft.targetId },
    });

    if (!sale || sale.cancelledAt) {
      throw new Error("Venda nao encontrada ou ja cancelada.");
    }

    const cancellation = await tx.cancellationEvent.create({
      data: {
        origin: "ASSISTANT_TEXT",
        reason: draft.reason,
        saleId: sale.id,
        targetType: CancellationTargetType.SALE,
      },
    });
    const stockByProductId = new Map(
      sale.items.map((item) => [item.product.id, Number(item.product.currentStock)]),
    );

    for (const item of sale.items) {
      const quantity = Number(item.quantity);
      const nextStock = calculateStockAfterPurchase({
        currentStock: stockByProductId.get(item.product.id) ?? Number(item.product.currentStock),
        quantityPurchased: quantity,
      });

      stockByProductId.set(item.product.id, nextStock);
      await tx.product.update({
        data: { currentStock: nextStock.toString() },
        where: { id: item.product.id },
      });
      await tx.stockMovement.create({
        data: {
          cancellationEventId: cancellation.id,
          origin: "ASSISTANT_TEXT",
          productId: item.product.id,
          quantity: quantity.toString(),
          reason: "CANCEL_SALE",
          saleItemId: item.id,
          type: StockMovementType.REVERSAL,
        },
      });
    }

    await tx.sale.update({
      data: { cancelledAt: new Date(), cancellationReason: draft.reason },
      where: { id: sale.id },
    });
  });
}

async function cancelPurchaseDraft(draft: CancellationDraft): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      include: {
        product: {
          select: { currentStock: true, id: true },
        },
      },
      where: { id: draft.targetId },
    });

    if (!purchase || purchase.cancelledAt) {
      throw new Error("Compra nao encontrada ou ja cancelada.");
    }

    const quantity = Number(purchase.quantity);
    const nextStock = calculateStockAfterSale({
      currentStock: Number(purchase.product.currentStock),
      quantitySold: quantity,
    });
    const cancellation = await tx.cancellationEvent.create({
      data: {
        origin: "ASSISTANT_TEXT",
        purchaseId: purchase.id,
        reason: draft.reason,
        targetType: CancellationTargetType.PURCHASE,
      },
    });

    await tx.product.update({
      data: { currentStock: nextStock.toString() },
      where: { id: purchase.product.id },
    });
    await tx.stockMovement.create({
      data: {
        cancellationEventId: cancellation.id,
        origin: "ASSISTANT_TEXT",
        productId: purchase.product.id,
        purchaseId: purchase.id,
        quantity: quantity.toString(),
        reason: "CANCEL_PURCHASE",
        type: StockMovementType.REVERSAL,
      },
    });
    await tx.purchase.update({
      data: { cancelledAt: new Date(), cancellationReason: draft.reason },
      where: { id: purchase.id },
    });
  });
}

async function cancelExpenseDraft(draft: CancellationDraft): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({
      select: { cancelledAt: true, id: true },
      where: { id: draft.targetId },
    });

    if (!expense || expense.cancelledAt) {
      throw new Error("Despesa nao encontrada ou ja cancelada.");
    }

    await tx.cancellationEvent.create({
      data: {
        expenseId: expense.id,
        origin: "ASSISTANT_TEXT",
        reason: draft.reason,
        targetType: CancellationTargetType.EXPENSE,
      },
    });
    await tx.expense.update({
      data: { cancelledAt: new Date(), cancellationReason: draft.reason },
      where: { id: expense.id },
    });
  });
}

async function cancelStockLossDraft(draft: CancellationDraft): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const stockLoss = await tx.stockLoss.findUnique({
      include: {
        expense: {
          select: { id: true },
        },
        product: {
          select: { currentStock: true, id: true },
        },
      },
      where: { id: draft.targetId },
    });

    if (!stockLoss || stockLoss.cancelledAt) {
      throw new Error("Perda nao encontrada ou ja cancelada.");
    }

    const quantity = Number(stockLoss.quantity);
    const nextStock = calculateStockAfterPurchase({
      currentStock: Number(stockLoss.product.currentStock),
      quantityPurchased: quantity,
    });
    const cancellation = await tx.cancellationEvent.create({
      data: {
        origin: "ASSISTANT_TEXT",
        reason: draft.reason,
        stockLossId: stockLoss.id,
        targetType: CancellationTargetType.STOCK_LOSS,
      },
    });

    await tx.product.update({
      data: { currentStock: nextStock.toString() },
      where: { id: stockLoss.product.id },
    });
    await tx.stockLoss.update({
      data: { cancelledAt: new Date(), cancellationReason: draft.reason },
      where: { id: stockLoss.id },
    });

    if (stockLoss.expense) {
      await tx.expense.update({
        data: { cancelledAt: new Date(), cancellationReason: draft.reason },
        where: { id: stockLoss.expense.id },
      });
    }

    await tx.stockMovement.create({
      data: {
        cancellationEventId: cancellation.id,
        origin: "ASSISTANT_TEXT",
        productId: stockLoss.product.id,
        quantity: quantity.toString(),
        reason: "CANCEL_STOCK_LOSS",
        stockLossId: stockLoss.id,
        type: StockMovementType.REVERSAL,
      },
    });
  });
}

async function persistProductDraft(draft: ProductDraft): Promise<void> {
  await prisma.$transaction(async (tx) =>
    createProductRecord(tx, {
      name: draft.name,
      category: draft.category,
      unit: draft.unit,
      unitCostCents: draft.unitCostCents,
      salePriceCents: draft.salePriceCents,
      initialStock: draft.initialStock,
      minimumStock: draft.minimumStock,
    }, { aliasSource: "AI_CONFIRMED", origin: "ASSISTANT_TEXT" }),
  );
}

function parsePendingContextFromForm(formData: FormData): AssistantPendingContext | null {
  const raw = formData.get("pendingContext");

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as unknown;

    if (!value || typeof value !== "object") {
      return null;
    }

    const context = value as Record<string, unknown>;
    const productName = typeof context.productName === "string" ? context.productName.trim() : "";
    const quantity = typeof context.quantity === "number" ? context.quantity : Number.NaN;
    const productId = typeof context.productId === "string" && context.productId.trim().length > 0
      ? context.productId.trim()
      : undefined;
    const options = parseProductSelectionOptions(context.options);
    const parsedUnitContext = parseUnitContext(context);

    if (context.type === "product_missing_fields") {
      const name = typeof context.name === "string" ? context.name.trim() : "";
      const category = typeof context.category === "string" && context.category.trim().length > 0
        ? context.category.trim()
        : null;
      const unitCostCents = nullableInteger(context.unitCostCents);
      const salePriceCents = nullableInteger(context.salePriceCents);
      const initialStock = nullableQuantity(context.initialStock);
      const minimumStock = nullableQuantity(context.minimumStock);

      return name.length > 0
        ? {
            category,
            initialStock,
            minimumStock,
            name,
            salePriceCents,
            type: context.type,
            unitCostCents,
            ...parsedUnitContext,
          }
        : null;
    }

    if (productName.length === 0 || !Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    if (context.type === "purchase_missing_unit_cost") {
      return { productId, productName, quantity, type: context.type, ...parsedUnitContext };
    }

    if (context.type === "new_product_purchase_missing_unit_cost") {
      return { productName, quantity, type: context.type, ...parsedUnitContext };
    }

    if (context.type === "purchase_missing_unit_cost_product_disambiguation") {
      return { options, productName, quantity, type: context.type, ...parsedUnitContext };
    }

    if (context.type === "sale_product_disambiguation") {
      const unitPriceCents = context.unitPriceCents === null || typeof context.unitPriceCents === "number"
        ? context.unitPriceCents
        : Number.NaN;

      return unitPriceCents === null || (Number.isInteger(unitPriceCents) && unitPriceCents > 0)
        ? { options, productName, quantity, type: context.type, unitPriceCents }
        : null;
    }

    if (context.type === "purchase_product_disambiguation") {
      const unitCostCents = typeof context.unitCostCents === "number" ? context.unitCostCents : Number.NaN;

      return Number.isInteger(unitCostCents) && unitCostCents > 0
        ? { options, productName, quantity, type: context.type, unitCostCents, ...parsedUnitContext }
        : null;
    }

    if (context.type === "purchase_cost_ambiguity") {
      const amountCents = typeof context.amountCents === "number" ? context.amountCents : Number.NaN;

      return Number.isInteger(amountCents) && amountCents > 0
        ? { amountCents, productName, quantity, type: context.type, ...parsedUnitContext }
        : null;
    }

    if (context.type === "new_product_purchase_missing_sale_price") {
      const unitCostCents = typeof context.unitCostCents === "number" ? context.unitCostCents : Number.NaN;

      return Number.isInteger(unitCostCents) && unitCostCents > 0
        ? { productName, quantity, type: context.type, unitCostCents, ...parsedUnitContext }
        : null;
    }

    if (context.type === "new_product_purchase_missing_minimum_stock") {
      const salePriceCents = typeof context.salePriceCents === "number" ? context.salePriceCents : Number.NaN;
      const unitCostCents = typeof context.unitCostCents === "number" ? context.unitCostCents : Number.NaN;

      return Number.isInteger(salePriceCents) &&
        salePriceCents > 0 &&
        Number.isInteger(unitCostCents) &&
        unitCostCents > 0
        ? { productName, quantity, salePriceCents, type: context.type, unitCostCents, ...parsedUnitContext }
        : null;
    }

    return null;
  } catch {
    return null;
  }
}

function shouldStartNewMessageInsteadOfPending(context: AssistantPendingContext, message: string): boolean {
  const intent = classifyIntent(message);

  if (context.type === "product_missing_fields") {
    if (isBareConfirmationMessage(message)) {
      return true;
    }

    return intent !== "unknown" && intent !== "social";
  }

  if (intent === "unknown" || intent === "social") {
    return false;
  }

  if (isExpectedPendingContinuation(context, message, intent)) {
    return false;
  }

  return true;
}

function isExpectedPendingContinuation(
  context: AssistantPendingContext,
  message: string,
  intent: ReturnType<typeof classifyIntent>,
): boolean {
  if (
    (context.type === "purchase_missing_unit_cost" || context.type === "new_product_purchase_missing_unit_cost") &&
    intent === "expense"
  ) {
    return isBarePurchaseCostAnswer(message);
  }

  return false;
}

function isBarePurchaseCostAnswer(message: string): boolean {
  const normalized = normalizeForProductSearch(message);

  if (!/\d/.test(normalized)) {
    return false;
  }

  if (/\b(gastei|despesa|conta\s+de|custo\s+com)\b/.test(normalized)) {
    return false;
  }

  if (
    /\bpaguei\b/.test(normalized) &&
    /\b(com|de)\s+[a-z]/.test(normalized) &&
    !/\b(cada|unidade|kg|quilo|quilos|litro|litros|caixa|caixas|fardo|fardos|pacote|pacotes|bandeja|bandejas|cartela|cartelas|saco|sacos)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return /\b(paguei|custou|custo|foi|saiu|deu|cada|unidade|por|a|unitario|unitaria)\b/.test(normalized) ||
    /^(?:r\$\s*)?\d/.test(normalized);
}

function isBareConfirmationMessage(message: string): boolean {
  const normalized = normalizeForProductSearch(message);

  return /^(sim|ok|okay|confirmo|confirmar|confirma|confirma ai|pode confirmar|pode salvar|salva|salvar)$/.test(
    normalized,
  );
}

function parseProductSelectionOptions(rawOptions: unknown): ProductSelectionOption[] {
  if (!Array.isArray(rawOptions)) {
    return [];
  }

  return rawOptions
    .slice(0, 5)
    .map((rawOption) => {
      if (!rawOption || typeof rawOption !== "object") {
        return null;
      }

      const option = rawOption as Record<string, unknown>;
      const id = typeof option.id === "string" ? option.id.trim() : "";
      const name = typeof option.name === "string" ? option.name.trim() : "";

      return id.length > 0 && name.length > 0 ? { id, name } : null;
    })
    .filter((option): option is ProductSelectionOption => option !== null);
}

function parseUnitContext(context: Record<string, unknown>): AssistantUnitContext {
  const unit = typeof context.unit === "string" && productUnitValues.includes(context.unit as ProductUnitValue)
    ? context.unit as ProductUnitValue
    : undefined;
  const unitLabel = typeof context.unitLabel === "string" && context.unitLabel.trim().length > 0
    ? context.unitLabel.trim()
    : undefined;
  const priceBasis = typeof context.priceBasis === "string" && context.priceBasis.trim().length > 0
    ? context.priceBasis.trim()
    : undefined;

  return { priceBasis, unit, unitLabel };
}

function nullableInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function nullableQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function unitContext(context: AssistantUnitContext): AssistantUnitContext {
  return {
    priceBasis: context.priceBasis,
    unit: context.unit,
    unitLabel: context.unitLabel,
  };
}

function mergeProductMissingFieldsContext(
  context: Extract<AssistantPendingContext, { type: "product_missing_fields" }>,
  userMessage: string,
): ParsedProductDraftRequest {
  const unitCostCents = context.unitCostCents ?? extractProductContinuationMoney(userMessage, "unitCostCents");
  const salePriceCents = context.salePriceCents ?? extractProductContinuationMoney(userMessage, "salePriceCents");
  const initialStock = context.initialStock ?? extractProductContinuationQuantity(userMessage, "initialStock");
  const minimumStock = context.minimumStock ?? extractProductContinuationQuantity(userMessage, "minimumStock");
  const draft: ParsedProductDraftRequest = {
    category: context.category,
    initialStock,
    kind: "product",
    minimumStock,
    missingFields: [],
    name: context.name,
    salePriceCents,
    unit: context.unit ?? inferProductUnit(`${context.name} ${userMessage}`),
    unitCostCents,
  };

  draft.missingFields = productDraftMissingFields(draft);

  return draft;
}

function extractProductContinuationMoney(
  message: string,
  field: "salePriceCents" | "unitCostCents",
): number | null {
  const patterns =
    field === "unitCostCents"
      ? [
          /\b(?:custo|custou|paguei|comprei\s+por)\s+(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?/i,
        ]
      : [
          /\b(?:vendo|vender|pre[cç]o(?:\s+de\s+venda)?|valor)\s+(?:por|a)?\s*(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?/i,
        ];
  const value = extractFirstMessageMatch(message, patterns);

  return value === null ? null : parseBrazilianMoneyToCents(value, productMissingFieldLabels[field]);
}

function extractProductContinuationQuantity(
  message: string,
  field: "initialStock" | "minimumStock",
): number | null {
  const patterns =
    field === "initialStock"
      ? [
          /\b(?:tenho|estoque(?:\s+inicial)?|comprei|prontos?)\s+(\d+(?:[,.]\d+)?)/i,
          /\b(\d+(?:[,.]\d+)?)\s+(?:prontos?|unidades?|itens?)\b/i,
        ]
      : [
          /\b(?:estoque\s+)?m[ií]nimo\s+(\d+(?:[,.]\d+)?)/i,
          /\bquando\s+tiver\s+(?:s[oó]\s+)?(\d+(?:[,.]\d+)?)\b/i,
          /\bme\s+avisa\s+quando\s+tiver\s+(\d+(?:[,.]\d+)?)\b/i,
        ];
  const value = extractFirstMessageMatch(message, patterns);

  return value === null ? null : parseBrazilianQuantity(value, productMissingFieldLabels[field]);
}

function extractFirstMessageMatch(message: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function productDraftMissingFields(draft: ParsedProductDraftRequest): ProductDraftMissingField[] {
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

function extractPositiveMoneyFromMessage(message: string, fieldName: string): number | null {
  const match = message.match(/(?:r\$\s*)?(\d+(?:[,.]\d{1,2})?)(?:\s*(?:real|reais))?/i);

  if (!match) {
    return null;
  }

  const cents = parseBrazilianMoneyToCents(match[1], fieldName);

  if (cents <= 0) {
    throw new Error(`${fieldName} precisa ser maior que zero.`);
  }

  return cents;
}

function resolveAmbiguousPurchaseUnitCost(
  context: Extract<AssistantPendingContext, { type: "purchase_cost_ambiguity" }>,
  userMessage: string,
): number | null {
  const normalized = normalizeForProductSearch(userMessage);

  if (/\b(cada|unidade|unitario|unitaria)\b/.test(normalized)) {
    return context.amountCents;
  }

  if (/\b(total|tudo|compra|pedido)\b/.test(normalized)) {
    const unitCostCents = context.amountCents / context.quantity;

    if (!Number.isSafeInteger(unitCostCents) || unitCostCents <= 0) {
      throw new Error("Total da compra precisa dividir corretamente pela quantidade.");
    }

    return unitCostCents;
  }

  return null;
}

function extractNonNegativeQuantityFromMessage(message: string, fieldName: string): number | null {
  const match = message.match(/(\d+(?:[,.]\d+)?)/);

  if (!match) {
    return null;
  }

  return parseBrazilianQuantity(match[1], fieldName);
}

function productDraftBaseMessage(productName: string): string {
  const baseMessage = "Confira o rascunho antes de salvar.";

  return isSensitiveProductName(productName)
    ? `${baseMessage} Registre apenas operações legais e autorizadas. Este rascunho é somente financeiro/cadastral.`
    : baseMessage;
}

function formatProductNameForDraft(productName: string): string {
  const normalized = productName
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
  const words = normalized.split(" ");

  return words
    .map((word) => {
      if (isVariantWord(word)) {
        return word;
      }

      return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
    })
    .join(" ");
}

function isVariantWord(word: string): boolean {
  return (
    /^(?:\d+(?:[,.]\d+)?(?:ml|l|kg|g)?|ml|l|kg|g|litro|litros|lata|garrafa|pet|caixa|pacote|unidade)$/.test(
      word,
    )
  );
}

function formatQuantity(quantity: number, unitLabel?: string): string {
  return formatCommercialQuantity(quantity, unitLabel);
}

function unitWithArticle(unitLabel?: string): string {
  const label = questionUnitLabel(unitLabel);
  const article = /^(?:caixa|dúzia|grama|unidade|peça)$/i.test(label) ? "a" : "o";

  return `${article} ${label}`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}

function saleCancellationOption(sale: { items: Array<{ product: { name: string }; quantity: unknown }>; totalAmountCents: number }): string {
  const productsLabel = sale.items
    .map((item) => `${formatQuantity(Number(item.quantity))} ${item.product.name}`)
    .join(", ");

  return `Venda de ${productsLabel} (${formatMoney(sale.totalAmountCents)})`;
}

function cancellationAmbiguousMessage(
  targetType: ParsedCancellationRequest["targetType"],
  options: string[],
): string {
  const label = targetType === "sale" ? "venda" : targetType === "purchase" ? "compra" : "despesa";

  return `Encontrei mais de uma ${label} parecida. Para evitar cancelar errado, me diga qual delas com mais detalhe: ${options.join(" ")}`;
}

function formatProductOptions(matches: ProductForDraft[]): string {
  return matches
    .slice(0, 5)
    .map((product, index) => `${index + 1}. ${product.name}`)
    .join(" ");
}

function cancellationNotFoundMessage(targetType: ParsedCancellationRequest["targetType"]): string {
  if (targetType === "sale") {
    return "Nao encontrei venda ativa para cancelar com seguranca. Nada foi alterado.";
  }

  if (targetType === "purchase") {
    return "Nao encontrei compra ativa para cancelar com seguranca. Nada foi alterado.";
  }

  return "Nao encontrei despesa ativa para cancelar com seguranca. Nada foi alterado.";
}

function productMatchesCancellationQuery(query: string, target: string): boolean {
  const queryTokens = tokenizeCancellationQuery(query);
  const targetTokens = tokenizeCancellationQuery(target);

  if (queryTokens.length === 0 || targetTokens.length === 0) {
    return false;
  }

  return queryTokens.every((queryToken) =>
    targetTokens.some(
      (targetToken) =>
        targetToken === queryToken || targetToken.includes(queryToken) || queryToken.includes(targetToken),
    ),
  );
}

function tokenizeCancellationQuery(value: string): string[] {
  return normalizeForProductSearch(value)
    .split(" ")
    .map((token) => (token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token))
    .filter((token) => token.length > 1 && !["de", "da", "do", "das", "dos", "com"].includes(token));
}

function toProductSelectionOptions(matches: ProductForDraft[]): ProductSelectionOption[] {
  return matches.slice(0, 5).map((product) => ({
    id: product.id,
    name: product.name,
  }));
}

async function resolveProductSelection(
  context: Extract<
    AssistantPendingContext,
    {
      type:
        | "purchase_missing_unit_cost_product_disambiguation"
        | "purchase_product_disambiguation"
        | "sale_product_disambiguation";
    }
  >,
  userMessage: string,
): Promise<ProductForDraft | null> {
  const options =
    context.options.length > 0
      ? context.options
      : toProductSelectionOptions(
        await findActiveProductsMatching(
          context.productName,
          context.type === "sale_product_disambiguation" ? "sale" : "purchase",
        ),
      );
  const result = resolveProductSelectionFromOptions(userMessage, options);

  if (result.status !== "selected") {
    return null;
  }

  return findActiveProductById(result.option.id);
}

function parseDraftFromForm<T>(
  formData: FormData,
  schema: { parse: (value: unknown) => T },
): { success: true; data: T } | { success: false; error: ConfirmDraftState } {
  try {
    const raw = formData.get("draft");

    if (typeof raw !== "string") {
      throw new Error("Rascunho ausente.");
    }

    return { success: true, data: schema.parse(JSON.parse(raw)) };
  } catch (error) {
    return {
      success: false,
      error: { status: "error", message: userFacingError(error, "Rascunho invalido.") },
    };
  }
}

function revalidateAssistantPaths(): void {
  revalidatePath("/");
  revalidatePath("/assistant");
  revalidatePath("/products");
  revalidatePath("/sales");
  revalidatePath("/purchases");
  revalidatePath("/expenses");
}

async function buildExternalAssistantContext(): Promise<ExternalAssistantContext> {
  const [summary, products] = await Promise.all([
    getDashboardSummary(),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        aliases: {
          select: {
            alias: true,
          },
        },
        currentStock: true,
        name: true,
        salePriceCents: true,
        unitCostCents: true,
      },
      where: { active: true },
    }),
  ]);

  return {
    activeProducts: products.map((product) => ({
      aliases: product.aliases.map((alias) => alias.alias),
      currentStock: Number(product.currentStock),
      name: product.name,
      salePriceCents: product.salePriceCents,
      unitCostCents: product.unitCostCents,
    })),
    expenseCategories: [...expenseCategoryValues],
    financialSummary: {
      lowStockProducts: summary.lowStockProducts.map((product) => ({
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
        name: product.name,
      })),
      month: toExternalPeriodSummary(summary.month),
      today: toExternalPeriodSummary(summary.today),
    },
  };
}

function toExternalPeriodSummary(period: ExternalAssistantPeriodSummary): ExternalAssistantPeriodSummary {
  return {
    confirmedExpensesCents: period.confirmedExpensesCents,
    costOfGoodsSoldCents: period.costOfGoodsSoldCents,
    grossProfitCents: period.grossProfitCents,
    netProfitCents: period.netProfitCents,
    pendingExpensesCents: period.pendingExpensesCents,
    revenueCents: period.revenueCents,
    salesCount: period.salesCount,
  };
}

const productMissingFieldLabels: Record<ProductDraftMissingField, string> = {
  name: "nome do produto",
  unitCostCents: "custo",
  salePriceCents: "preço de venda",
  initialStock: "estoque inicial",
  minimumStock: "estoque mínimo",
};

function productFormPrefillMessage(missingFields: ProductDraftMissingField[]): string {
  if (missingFields.length === 0) {
    return "Preenchi o cadastro com o que entendi. Revise os campos e salve pelo botão.";
  }

  const labels = missingFields.map((field) => productMissingFieldLabels[field]);

  return `Preenchi o cadastro com o que entendi. Complete ${formatPortugueseList(labels)} antes de salvar.`;
}

function formatPortugueseList(values: string[]): string {
  if (values.length === 0) {
    return "os dados do produto";
  }

  if (values.length === 1) {
    return values[0];
  }

  return `${values.slice(0, -1).join(", ")} e ${values[values.length - 1]}`;
}

function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
