import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  getE2EAiDemoFinancialState,
  getE2EProductFinancialState,
  resetE2EDatabase,
  seedE2EProducts,
  type E2EAiDemoFinancialState,
} from "./helpers/e2e-database";

const productName = "Coca lata";
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

test.describe("rule-based assistant real demo flow", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("understands the real print phrase and opens product form without asking cost again", async ({ page }) => {
    const phrase = "quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma";
    const conversationalProductName = "Coca Cola lata";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, phrase);
    await expectProductPrefill(page, {
      initialStock: "10",
      minimumStock: "",
      name: conversationalProductName,
      salePrice: "",
      unitCost: "4,20",
    });
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toEqual(emptyState);

    const form = newProductForm(page);
    await form.getByLabel("Preço cadastrado").fill("10");
    await form.getByLabel("Estoque minimo").fill("5");
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toMatchObject({
      currentStock: 10,
      initialStockAdjustmentMovementCount: 0,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalInitialStockAdjustmentQuantity: 0,
      totalPurchaseCostCents: 4200,
      totalPurchasedQuantity: 10,
    });

    await page.goto("/products");
    await expect(page.getByRole("heading", { name: conversationalProductName })).toBeVisible();
  });

  test("keeps purchase registration wording out of financial reports", async ({ page }) => {
    await page.goto("/assistant");

    await askNexis(page, "quero cadastrar a compra que fiz de 10 coca");
    await expect(latestAssistantMessage(page).getByText(/Compras no mês|Compras hoje/i)).toHaveCount(0);
    await expect(latestAssistantMessage(page).getByText(/custo|pagou quanto por unidade/i).first()).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState("Coca")).resolves.toEqual(emptyState);
  });

  test("asks the user to split mixed actions instead of drafting anything", async ({ page }) => {
    await page.goto("/assistant");

    await askNexis(page, "comprei coca, vendi água e gastei 10");
    await expect(latestAssistantMessage(page).getByText(/uma coisa por vez/i)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText(/compra, venda ou despesa/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState("Coca")).resolves.toEqual(emptyState);
  });

  test("turns a long human purchase registration into a safe prefilled product form instead of a report", async ({ page }) => {
    const longMessage =
      "quero cadastrar a compra que eu fiz de 10 coca cola em lata 350 ml, comprei por 3.5 cada unidade dela cadastra para mim por favor este produto";
    const conversationalProductName = "Coca Cola lata 350 ml";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, longMessage);
    await expectProductPrefill(page, {
      initialStock: "10",
      minimumStock: "",
      name: conversationalProductName,
      salePrice: "",
      unitCost: "3,50",
    });
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toEqual(emptyState);

    const form = newProductForm(page);
    await form.getByLabel("Preço cadastrado").fill("6");
    await form.getByLabel("Estoque minimo").fill("5");
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toMatchObject({
      currentStock: 10,
      initialStockAdjustmentMovementCount: 0,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalInitialStockAdjustmentQuantity: 0,
      totalPurchaseCostCents: 3500,
      totalPurchasedQuantity: 10,
    });

    await page.goto("/products");
    await expect(page.getByRole("heading", { name: conversationalProductName })).toBeVisible();
  });

  test("uses unit cost from natural stock-entry wording before opening product form", async ({ page }) => {
    const conversationalProductName = "Refrigerantes";

    await page.goto("/assistant");
    await expect(page.getByText("Demo por texto", { exact: true })).toBeVisible();

    await askNexisAndWaitForProducts(page, "coloca 5 refrigerantes que eu comprei no estoque paguei 4 reais em cada uma delas");
    await expectProductPrefill(page, {
      initialStock: "5",
      minimumStock: "",
      name: conversationalProductName,
      salePrice: "",
      unitCost: "4,00",
    });
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toEqual(emptyState);

    const form = newProductForm(page);
    await form.getByLabel("Preço cadastrado").fill("7");
    await form.getByLabel("Estoque minimo").fill("5");
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(newProductForm(page).getByText("Salvando...")).toHaveCount(0);
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toMatchObject({
      currentStock: 5,
      initialStockAdjustmentMovementCount: 0,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalInitialStockAdjustmentQuantity: 0,
      totalPurchaseCostCents: 2000,
      totalPurchasedQuantity: 5,
    });
  });

  test("asks whether ambiguous purchase value is total or unit and derives unit cost from total", async ({ page }) => {
    const conversationalProductName = "Refrigerante";

    await page.goto("/assistant");

    await askNexis(page, "comprei 5 refrigerante por 20 reais");
    await expect(latestAssistantMessage(page).getByText(/total da compra ou o valor de cada unidade/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toEqual(emptyState);

    await askNexisAndWaitForProducts(page, "total");
    await expectProductPrefill(page, {
      initialStock: "5",
      minimumStock: "",
      name: conversationalProductName,
      salePrice: "",
      unitCost: "4,00",
    });
    await expect(getE2EAiDemoFinancialState(conversationalProductName)).resolves.toEqual(emptyState);
  });

  test("asks for product disambiguation before drafting a sale for similar products", async ({ page }) => {
    await seedE2EProducts([
      { currentStock: 10, name: "Coca-Cola lata 350ml", salePriceCents: 600, unitCostCents: 300 },
      { currentStock: 10, name: "Coca-Cola 600ml", salePriceCents: 800, unitCostCents: 400 },
      { currentStock: 10, name: "Coca-Cola 2L", salePriceCents: 1200, unitCostCents: 700 },
    ]);

    await page.goto("/assistant");
    await askNexis(page, "vendi uma coca");
    await expect(latestAssistantMessage(page).getByText(/mais de um produto parecido/i)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Coca-Cola lata 350ml")).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Coca-Cola 600ml")).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Coca-Cola 2L")).toBeVisible();
    await expectNoDraftButtons(page);

    await askNexis(page, "a de 600");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByRole("heading", { name: "Coca-Cola 600ml" })).toBeVisible();
    await expect(saleDraft.getByRole("button", { name: "Confirmar venda" })).toBeVisible();
    await expect(getE2EProductFinancialState("Coca-Cola 600ml")).resolves.toMatchObject({
      currentStock: 10,
      saleItemCount: 0,
    });

    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(page.getByText("Confirmando...")).toHaveCount(0);
    await expect(getE2EProductFinancialState("Coca-Cola 600ml")).resolves.toMatchObject({
      currentStock: 9,
      saleItemCount: 1,
      totalCostCents: 400,
      totalRevenueCents: 800,
      totalSoldQuantity: 1,
    });
  });

  test("continues a human sale after numeric product disambiguation", async ({ page }) => {
    await seedE2EProducts([
      { currentStock: 10, name: "Coca Cola lata", salePriceCents: 700, unitCostCents: 400 },
      { currentStock: 10, name: "Coca Cola lata 350 ml", salePriceCents: 600, unitCostCents: 350 },
    ]);

    await page.goto("/assistant");
    await askNexis(page, "vendi 5 coca cola para meu cliente aqui");
    await expect(latestAssistantMessage(page).getByText(/mais de um produto parecido/i)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("1. Coca Cola lata")).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("2. Coca Cola lata 350 ml")).toBeVisible();
    await expectNoDraftButtons(page);

    await askNexis(page, "1");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByRole("heading", { name: "Coca Cola lata" })).toBeVisible();
    await expect(saleDraft.getByRole("button", { name: "Confirmar venda" })).toBeVisible();
    await expect(getE2EProductFinancialState("Coca Cola lata")).resolves.toMatchObject({
      currentStock: 10,
      saleItemCount: 0,
    });
    await expect(getE2EProductFinancialState("Coca Cola lata 350 ml")).resolves.toMatchObject({
      currentStock: 10,
      saleItemCount: 0,
    });

    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EProductFinancialState("Coca Cola lata")).resolves.toMatchObject({
      currentStock: 5,
      saleItemCount: 1,
      totalSoldQuantity: 5,
    });
    await expect(getE2EProductFinancialState("Coca Cola lata 350 ml")).resolves.toMatchObject({
      currentStock: 10,
      saleItemCount: 0,
    });
  });

  test("continues a human sale after text product disambiguation", async ({ page }) => {
    await seedE2EProducts([
      { currentStock: 10, name: "Coca Cola lata", salePriceCents: 700, unitCostCents: 400 },
      { currentStock: 10, name: "Coca Cola lata 350 ml", salePriceCents: 600, unitCostCents: 350 },
    ]);

    await page.goto("/assistant");
    await askNexis(page, "vendi 5 coca cola para meu cliente aqui");
    await expect(latestAssistantMessage(page).getByText(/mais de um produto parecido/i)).toBeVisible();
    await expectNoDraftButtons(page);

    await askNexis(page, "coca lata");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByRole("heading", { name: "Coca Cola lata" })).toBeVisible();
    await expect(saleDraft.getByRole("button", { name: "Confirmar venda" })).toBeVisible();
    await expect(getE2EProductFinancialState("Coca Cola lata")).resolves.toMatchObject({
      currentStock: 10,
      saleItemCount: 0,
    });

    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EProductFinancialState("Coca Cola lata")).resolves.toMatchObject({
      currentStock: 5,
      saleItemCount: 1,
      totalSoldQuantity: 5,
    });
    await expect(getE2EProductFinancialState("Coca Cola lata 350 ml")).resolves.toMatchObject({
      currentStock: 10,
      saleItemCount: 0,
    });
  });

  test("validates product, purchase, sale, expense, questions and safety blocks before manual demo", async ({
    page,
  }) => {
    await page.goto("/assistant");
    await expect(page.getByText("Demo por texto", { exact: true })).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await askNexisAndWaitForProducts(page, "cadastrar Coca lata custo 3 venda 6 estoque 20 mínimo 5");
    await expectProductPrefill(page, {
      initialStock: "20",
      minimumStock: "5",
      name: productName,
      salePrice: "6,00",
      unitCost: "3,00",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await page.goto("/products");
    await expect(page.getByRole("heading", { name: productName })).toHaveCount(0);

    await page.goto("/assistant");
    await askNexisAndWaitForProducts(page, "cadastrar Coca lata custo 3 venda 6 estoque 20 mínimo 5");
    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(newProductForm(page).getByText("Salvando...")).toHaveCount(0);
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual({
      ...emptyState,
      currentStock: 20,
      initialStockAdjustmentMovementCount: 1,
      productCount: 1,
      totalInitialStockAdjustmentQuantity: 20,
    });

    await page.goto("/products");
    const productCard = page.locator("article").filter({ has: page.getByRole("heading", { name: productName }) });
    await expect(productCard).toContainText("Estoque atual");
    await expect(productCard).toContainText("20 unid.");

    await page.goto("/assistant");
    await askNexisAndWaitForProducts(page, "cadastrar COCA   lata custo 3 venda 6 estoque 20 mínimo 5");
    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Já existe um produto parecido cadastrado. Revise antes de criar outro.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({ productCount: 1 });

    await page.goto("/assistant");
    await askNexisAndWaitForProducts(page, "cadastrar produto refrigerante");
    await expect(newProductForm(page).getByRole("button", { name: "Salvar produto" })).toBeVisible();
    await expect(getE2EAiDemoFinancialState("refrigerante")).resolves.toEqual(emptyState);

    await page.goto("/assistant");
    await askNexis(page, "comprei 10 Coca lata por 3 reais");
    await expect(page.getByText("Rascunho de compra")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 20,
      purchaseCount: 0,
    });
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByText("Compra confirmada e estoque atualizado.")).toBeVisible();
    await expect(page.getByText("Confirmando...")).toHaveCount(0);
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 30,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalPurchaseCostCents: 3000,
      totalPurchasedQuantity: 10,
    });

    await askNexis(page, "vendi 5 Coca lata por 6 reais");
    await expect(page.getByText("Rascunho de venda")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar venda" })).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 30,
      saleItemCount: 0,
    });
    await page.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(page.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(page.getByText("Confirmando...")).toHaveCount(0);
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 25,
      grossProfitCents: 1500,
      netProfitCents: 1500,
      saleCount: 1,
      saleItemCount: 1,
      saleMovementCount: 1,
      totalSaleCostCents: 1500,
      totalSaleRevenueCents: 3000,
      totalSoldQuantity: 5,
    });

    await askNexis(page, "gastei 10 reais com embalagem");
    await expect(page.getByText("Rascunho de despesa")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar despesa" })).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      confirmedExpenseCents: 0,
      netProfitCents: 1500,
    });
    await page.getByRole("button", { name: "Confirmar despesa" }).click();
    await expect(page.getByText("Despesa confirmada e salva.")).toBeVisible();
    await expect(page.getByText("Confirmando...")).toHaveCount(0);
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      confirmedExpenseCents: 1000,
      confirmedExpenseCount: 1,
      currentStock: 25,
      grossProfitCents: 1500,
      netProfitCents: 500,
      totalSaleCostCents: 1500,
      totalSaleRevenueCents: 3000,
    });

    await page.goto("/");
    const todaySection = page.locator('section[aria-labelledby="today-heading"]');
    const monthSection = page.locator('section[aria-labelledby="month-heading"]');
    await expectSummaryCard(page, todaySection, "Vendas hoje", "R$ 30,00");
    await expectSummaryCard(page, todaySection, "Despesas", "R$ 10,00");
    await expectSummaryCard(page, todaySection, "Lucro líquido", "R$ 5,00");
    await expectSummaryCard(page, monthSection, "Lucro bruto", "R$ 15,00");
    await expectSummaryCard(page, monthSection, "Lucro líquido", "R$ 5,00");

    await page.goto("/assistant");
    await askNexis(page, "quanto vendi hoje?");
    await expect(page.getByText("Vendas hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("R$ 30,00").first()).toBeVisible();
    await expect(page.getByText(/custo dos produtos vendidos foi R\$ 15,00/)).toBeVisible();

    await askNexis(page, "qual meu lucro bruto hoje?");
    await expect(page.getByText("Lucro bruto hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("R$ 15,00").first()).toBeVisible();

    await askNexis(page, "qual meu lucro líquido hoje?");
    await expect(page.getByText("Lucro líquido hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("R$ 5,00").first()).toBeVisible();

    await askNexis(page, "qual meu estoque atual?");
    await expect(page.getByText("Estoque atual", { exact: true })).toBeVisible();
    await expect(page.getByText(/Coca lata: 25/)).toBeVisible();

    await askNexis(page, "qual produto mais vendido hoje?");
    await expect(page.getByText("Produto mais vendido hoje", { exact: true })).toBeVisible();
    await expect(page.getByText(productName).first()).toBeVisible();
    await expect(page.getByText(/vendeu 5 unidade/)).toBeVisible();

    await askNexis(page, "resumo financeiro do dia");
    await expect(page.getByText("Resumo financeiro hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("R$ 5,00").first()).toBeVisible();
    await expect(page.getByText(/vendas R\$ 30,00/)).toBeVisible();
    await expect(page.getByText(/custo dos produtos vendidos R\$ 15,00/)).toBeVisible();
    await expect(page.getByText(/lucro bruto R\$ 15,00/)).toBeVisible();
    await expect(page.getByText(/despesas confirmadas R\$ 10,00/)).toBeVisible();
    await expect(page.getByText(/lucro líquido R\$ 5,00/)).toBeVisible();

    const stateBeforeSafetyChecks = await getE2EAiDemoFinancialState(productName);

    for (const dangerousMessage of ["apagar produto Coca lata"]) {
      await askNexis(page, dangerousMessage);
      await expect(
        latestAssistantMessage(page).getByText(
          "Não posso apagar, alterar lucro, ignorar custo ou salvar sem confirmação. Revise antes de salvar.",
        ),
      ).toBeVisible();
      await expectNoDraftButtons(page);
      expect(await getE2EAiDemoFinancialState(productName)).toEqual(stateBeforeSafetyChecks);
    }

    for (const cancellationMessage of ["cancelar a venda de hoje", "corrigir despesa", "estornar venda"]) {
      await askNexis(page, cancellationMessage);
      await expect(latestAssistantMessage(page).getByText("Rascunho de cancelamento")).toBeVisible();
      await expect(latestAssistantMessage(page).getByRole("button", { name: "Confirmar cancelamento" })).toBeVisible();
      expect(await getE2EAiDemoFinancialState(productName)).toEqual(stateBeforeSafetyChecks);
    }

    await askNexis(page, "vendi 999 Coca lata");
    await expect(page.getByText(/estoque insuficiente para a venda/i)).toBeVisible();
    await expectNoDraftButtons(page);
    expect(await getE2EAiDemoFinancialState(productName)).toEqual(stateBeforeSafetyChecks);

    for (const looseConfirmation of ["sim", "pode salvar", "confirma aí"]) {
      await askNexis(page, looseConfirmation);
      await expect(
        latestAssistantMessage(page).getByText(
          "Não consegui entender com segurança. Tente escrever assim: Vendi 3 refrigerantes por 7 reais.",
        ),
      ).toBeVisible();
      await expectNoDraftButtons(page);
      expect(await getE2EAiDemoFinancialState(productName)).toEqual(stateBeforeSafetyChecks);
    }
  });
});

async function askNexis(page: Page, message: string) {
  await page.getByLabel("Mensagem").fill(message);
  await page.getByRole("button", { name: "Enviar para NEXIS" }).click();
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
    name: string;
    salePrice: string;
    unitCost: string;
  },
) {
  const form = newProductForm(page);

  await expect(form.getByRole("heading", { name: "Adicionar produto" })).toBeVisible();
  await expect(form.getByLabel("Nome do produto")).toHaveValue(expected.name);
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

async function expectSummaryCard(page: Page, section: Locator, label: string, value: string) {
  const card = section.locator("article").filter({
    has: page.getByText(label, { exact: true }),
  });

  await expect(card).toHaveCount(1);
  await expect(card).toContainText(value);
}
