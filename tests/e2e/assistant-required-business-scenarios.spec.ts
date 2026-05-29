import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  getE2EAiDemoFinancialState,
  resetE2EDatabase,
  seedE2EProducts,
  type E2EAiDemoFinancialState,
} from "./helpers/e2e-database";

const emptyState: E2EAiDemoFinancialState = {
  cancellationEventCount: 0,
  confirmedExpenseCents: 0,
  confirmedExpenseCount: 0,
  currentStock: 0,
  grossProfitCents: 0,
  initialStockAdjustmentMovementCount: 0,
  lossMovementCount: 0,
  netProfitCents: 0,
  productCount: 0,
  purchaseCount: 0,
  purchaseMovementCount: 0,
  reversalMovementCount: 0,
  saleCount: 0,
  saleItemCount: 0,
  saleMovementCount: 0,
  stockLossCount: 0,
  totalInitialStockAdjustmentQuantity: 0,
  totalLossMovementQuantity: 0,
  totalPurchaseCostCents: 0,
  totalPurchasedQuantity: 0,
  totalSaleCostCents: 0,
  totalSaleRevenueCents: 0,
  totalSoldQuantity: 0,
  totalStockLossCostCents: 0,
  totalStockLossQuantity: 0,
};

test.describe("assistant required human business scenarios", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("scenario 13: incomplete product opens form, user completes it, and saves only by button", async ({ page }) => {
    const productName = "pastel de carne";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "quero cadastrar pastel de carne");
    await expectProductPrefill(page, {
      initialStock: "",
      minimumStock: "",
      name: productName,
      salePrice: "",
      unit: "UNIT",
      unitCost: "",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    const form = newProductForm(page);
    await form.getByLabel("Custo para voce").fill("3");
    await form.getByLabel("Preço cadastrado").fill("8");
    await form.getByLabel("Estoque inicial").fill("20");
    await form.getByLabel("Estoque minimo").fill("5");
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(form.getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 20,
      initialStockAdjustmentMovementCount: 1,
      productCount: 1,
      totalInitialStockAdjustmentQuantity: 20,
    });
  });

  test("scenarios 3, 14, 15, 24 and 25: water product, purchase, sale, inventory and profit summary use real data", async ({
    page,
  }) => {
    const productName = "água mineral 500 ml";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(
      page,
      "comprei 2 fardos de água mineral 500 ml, cada fardo vem 12 garrafinhas e custou 18 reais cada fardo. vou vender cada água por 2,50. estoque mínimo 10",
    );
    await expectProductPrefill(page, {
      initialStock: "24",
      minimumStock: "10",
      name: /água mineral 500 ml/i,
      salePrice: "2,50",
      unit: "UNIT",
      unitCost: "1,50",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 24,
      initialStockAdjustmentMovementCount: 0,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalInitialStockAdjustmentQuantity: 0,
      totalPurchaseCostCents: 3600,
      totalPurchasedQuantity: 24,
    });

    await page.goto("/assistant");
    await askNexis(page, "comprei mais 1 fardo de água 500 ml com 12 unidades por 18 reais");
    const purchaseDraft = latestAssistantMessage(page);
    await expect(purchaseDraft.getByText("Rascunho de compra")).toBeVisible();
    await expect(purchaseDraft.getByRole("heading", { name: /água mineral 500 ml/i })).toBeVisible();
    await expect(purchaseDraft.getByText("R$ 1,50")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 24,
      purchaseCount: 1,
    });

    await purchaseDraft.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(purchaseDraft.getByText("Compra confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 36,
      purchaseCount: 2,
      purchaseMovementCount: 2,
      totalPurchasedQuantity: 36,
      totalPurchaseCostCents: 5400,
    });

    await askNexis(page, "vendi 5 águas de 500ml por 2,50 cada");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByRole("heading", { name: /água mineral 500 ml/i })).toBeVisible();
    await expect(saleDraft.getByText("R$ 12,50")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 36,
      saleItemCount: 0,
    });

    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 31,
      grossProfitCents: 500,
      saleItemCount: 1,
      saleMovementCount: 1,
      totalSaleCostCents: 750,
      totalSaleRevenueCents: 1250,
      totalSoldQuantity: 5,
    });

    await askNexis(page, "quanto tenho de água 500 ml no estoque?");
    await expect(latestAssistantMessage(page).getByText("31", { exact: true })).toBeVisible();

    await askNexis(page, "me mostra um resumo do que vendi e do lucro de hoje");
    await expect(latestAssistantMessage(page).getByText(/vendas R\$ 12,50/)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("R$ 5,00", { exact: true })).toBeVisible();

    await askNexis(page, "cancela aquela venda de água que fiz agora");
    const cancellationDraft = latestAssistantMessage(page);
    await expect(cancellationDraft.getByText("Rascunho de cancelamento")).toBeVisible();
    await expect(cancellationDraft.getByRole("heading", { name: /venda de 5 (unidades )?água mineral 500 ml/i })).toBeVisible();
    await expect(cancellationDraft.getByText("+5")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      cancellationEventCount: 0,
      currentStock: 31,
      saleItemCount: 1,
      totalSaleRevenueCents: 1250,
    });

    await cancellationDraft.getByRole("button", { name: "Confirmar cancelamento" }).click();
    await expect(cancellationDraft.getByText("Cancelamento registrado com rastreabilidade.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      cancellationEventCount: 1,
      currentStock: 36,
      grossProfitCents: 0,
      reversalMovementCount: 1,
      saleItemCount: 0,
      saleMovementCount: 1,
      totalSaleRevenueCents: 0,
      totalSoldQuantity: 0,
    });

    await askNexis(page, "quanto tenho de água 500 ml no estoque?");
    await expect(latestAssistantMessage(page).getByText("36", { exact: true })).toBeVisible();

    await askNexis(page, "me mostra um resumo do que vendi e do lucro de hoje");
    await expect(latestAssistantMessage(page).getByText(/vendas R\$ 0,00/)).toBeVisible();
  });

  test("scenarios 16 and 17: ambiguous or missing sale product is never chosen automatically", async ({ page }) => {
    await seedE2EProducts([
      { currentStock: 10, name: "Água mineral 500 ml", salePriceCents: 250, unitCostCents: 150 },
      { currentStock: 10, name: "Água com gás 500 ml", salePriceCents: 300, unitCostCents: 180 },
    ]);
    await page.goto("/assistant");

    await askNexis(page, "vendi 3 águas");
    await expect(latestAssistantMessage(page).getByText(/mais de um produto parecido/i)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText(/Água mineral 500 ml/)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText(/Água com gás 500 ml/)).toBeVisible();
    await expectNoDraftButtons(page);

    await askNexis(page, "vendi 2 energéticos por 10 reais");
    await expect(latestAssistantMessage(page).getByText(/Não encontrei produto ativo/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState("energéticos")).resolves.toEqual(emptyState);
  });

  test("does not pick a cancellation target when there is more than one matching sale", async ({ page }) => {
    await seedE2EProducts([
      { currentStock: 10, name: "Água mineral 500 ml", salePriceCents: 250, unitCostCents: 150 },
    ]);
    await page.goto("/assistant");

    await askNexis(page, "vendi 1 água mineral 500 ml");
    const firstSaleDraft = latestAssistantMessage(page);
    await firstSaleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(firstSaleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();

    await askNexis(page, "vendi 2 água mineral 500 ml");
    const secondSaleDraft = latestAssistantMessage(page);
    await secondSaleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(secondSaleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();

    await askNexis(page, "cancela a venda de água mineral 500 ml");
    const cancellationMessage = latestAssistantMessage(page);

    await expect(cancellationMessage.getByText(/mais de uma venda/i)).toBeVisible();
    await expect(cancellationMessage.getByText(/1 unidade Água mineral 500 ml/i)).toBeVisible();
    await expect(cancellationMessage.getByText(/2 unidades Água mineral 500 ml/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState("Água mineral 500 ml")).resolves.toMatchObject({
      cancellationEventCount: 0,
      currentStock: 7,
      saleItemCount: 2,
      totalSaleRevenueCents: 750,
    });
  });

  test("scenarios 18, 20, 21, 22 and 23: messy wording and safety blocks stay human-safe", async ({
    page,
  }) => {
    const messyProductName = "refri guaraná lata 350 ml";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(
      page,
      "moço coloca aí pra mim, peguei lá 2 caixa de refri guaraná lata 350, vem 12 em cada, paguei 80 nas duas caixa, acho que vou vender 4,50 cada, quando tiver 8 avisa",
    );
    await expectProductPrefill(page, {
      initialStock: "24",
      minimumStock: "8",
      name: /refri guaraná lata 350 ml/i,
      salePrice: "4,50",
      unit: "UNIT",
      unitCost: "3,33",
    });
    await expect(getE2EAiDemoFinancialState(messyProductName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(messyProductName)).resolves.toMatchObject({
      currentStock: 24,
      initialStockAdjustmentMovementCount: 0,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalInitialStockAdjustmentQuantity: 0,
      totalPurchaseCostCents: 7992,
      totalPurchasedQuantity: 24,
    });

    await page.goto("/assistant");
    await askNexisAndWaitForProducts(page, "comprei uma caixa com 12 coca lata 350 por 37 reais");
    await expectProductPrefill(page, {
      initialStock: "12",
      minimumStock: "",
      name: /coca lata 350 ml/i,
      salePrice: "",
      unit: "UNIT",
      unitCost: "3,08",
    });
    await expect(getE2EAiDemoFinancialState("coca lata 350 ml")).resolves.toEqual(emptyState);

    await page.goto("/assistant");
    await askNexis(page, "gastei 37 reais com sacolinha e embalagem");
    const expenseDraft = latestAssistantMessage(page);
    await expect(expenseDraft.getByText("Rascunho de despesa")).toBeVisible();
    await expect(expenseDraft.getByText(/sacolinha e embalagem/i)).toBeVisible();
    await expect(expenseDraft.getByText("R$ 37,00")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(messyProductName)).resolves.toMatchObject({
      confirmedExpenseCents: 0,
      confirmedExpenseCount: 0,
    });

    await expenseDraft.getByRole("button", { name: "Confirmar despesa" }).click();
    await expect(expenseDraft.getByText(/Despesa confirmada/)).toBeVisible();
    await expect(getE2EAiDemoFinancialState(messyProductName)).resolves.toMatchObject({
      confirmedExpenseCents: 3700,
      confirmedExpenseCount: 1,
    });

    await askNexis(page, "perdi 3 refri guaraná lata 350 ml que estouraram no freezer");
    const lossDraft = latestAssistantMessage(page);
    await expect(lossDraft.getByText("Rascunho de perda")).toBeVisible();
    await expect(lossDraft.getByRole("heading", { name: /refri guaraná lata 350 ml/i })).toBeVisible();
    await expect(lossDraft.getByText("R$ 9,99")).toBeVisible();
    await expect(lossDraft.getByText("24 -> 21")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(messyProductName)).resolves.toMatchObject({
      confirmedExpenseCents: 3700,
      currentStock: 24,
      lossMovementCount: 0,
      stockLossCount: 0,
    });

    await lossDraft.getByRole("button", { name: "Confirmar perda" }).click();
    await expect(lossDraft.getByText("Perda confirmada, estoque baixado e perda registrada.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(messyProductName)).resolves.toMatchObject({
      confirmedExpenseCents: 4699,
      confirmedExpenseCount: 2,
      currentStock: 21,
      lossMovementCount: 1,
      stockLossCount: 1,
      totalLossMovementQuantity: 3,
      totalStockLossCostCents: 999,
      totalStockLossQuantity: 3,
    });

    await askNexis(page, "cancela aquela venda de água que fiz agora");
    await expect(latestAssistantMessage(page).getByText(/Nao encontrei venda ativa/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState(messyProductName)).resolves.toMatchObject({
      cancellationEventCount: 0,
      currentStock: 21,
      productCount: 1,
      saleItemCount: 0,
      saleMovementCount: 0,
    });
  });
});

async function askNexis(page: Page, message: string) {
  const previousAssistantMessageCount = await page.getByTestId("assistant-message").count();

  await page.getByLabel("Mensagem").fill(message);
  await page.getByRole("button", { name: "Enviar para NEXIS" }).click();
  await expect(page.getByLabel("Mensagem")).toHaveValue("");
  await expect(page.getByTestId("assistant-message")).toHaveCount(previousAssistantMessageCount + 1);
}

async function askNexisAndWaitForProducts(page: Page, message: string) {
  await page.getByLabel("Mensagem").fill(message);
  await Promise.all([
    page.waitForURL(/\/products\?/, { timeout: 10_000 }),
    page.getByRole("button", { name: "Enviar para NEXIS" }).click(),
  ]);
}

async function expectProductPrefill(
  page: Page,
  expected: {
    initialStock: string;
    minimumStock: string;
    name: string | RegExp;
    salePrice: string;
    unit: string;
    unitCost: string;
  },
) {
  const form = newProductForm(page);

  await expect(form.getByRole("heading", { name: "Adicionar produto" })).toBeVisible();
  await expect(form.getByLabel("Nome do produto")).toHaveValue(expected.name);
  await expect(form.locator('select[name="unit"]')).toHaveValue(expected.unit);
  await expect(form.getByLabel("Custo para voce")).toHaveValue(expected.unitCost);
  await expect(form.getByLabel("Preço cadastrado")).toHaveValue(expected.salePrice);
  await expect(form.getByLabel("Estoque inicial")).toHaveValue(expected.initialStock);
  await expect(form.getByLabel("Estoque minimo")).toHaveValue(expected.minimumStock);
  await expect(form.getByText("NEXIS preencheu o que conseguiu entender.")).toBeVisible();
  await expect(form.getByRole("button", { name: "Salvar produto" })).toBeVisible();
}

async function saveNewProduct(page: Page) {
  await newProductForm(page).getByRole("button", { name: "Salvar produto" }).click();
}

async function expectNoDraftButtons(page: Page) {
  const assistantMessage = latestAssistantMessage(page);

  await expect(assistantMessage.getByRole("button", { name: "Salvar produto" })).toHaveCount(0);
  await expect(assistantMessage.getByRole("button", { name: "Confirmar compra" })).toHaveCount(0);
  await expect(assistantMessage.getByRole("button", { name: "Confirmar venda" })).toHaveCount(0);
  await expect(assistantMessage.getByRole("button", { name: "Confirmar despesa" })).toHaveCount(0);
  await expect(assistantMessage.getByRole("button", { name: "Confirmar perda" })).toHaveCount(0);
  await expect(assistantMessage.getByRole("button", { name: "Confirmar cancelamento" })).toHaveCount(0);
}

function latestAssistantMessage(page: Page): Locator {
  return page.getByTestId("assistant-message").last();
}

function newProductForm(page: Page): Locator {
  return page.locator('section[aria-labelledby="new-product-heading"]');
}
