import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  getE2EAiDemoFinancialState,
  getE2EProductFinancialState,
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

test.describe("assistant human business flow lab", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("scenario A: espetinho product, sale, expense and net profit question", async ({ page }) => {
    const productName = "espetinho de carne";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "cadatra pra mim 20 espetinho de carne comprei a 4 real cada vendo por 8 minimo 5");
    await expectProductPrefill(page, {
      initialStock: "20",
      minimumStock: "5",
      name: productName,
      salePrice: "8,00",
      unit: "UNIT",
      unitCost: "4,00",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 20,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalInitialStockAdjustmentQuantity: 0,
      totalPurchaseCostCents: 8000,
      totalPurchasedQuantity: 20,
    });

    await page.goto("/assistant");
    await askNexis(page, "vendi 2 espetinho de carne");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByRole("button", { name: "Confirmar venda" })).toBeVisible();
    await expect(getE2EProductFinancialState(productName)).resolves.toMatchObject({
      currentStock: 20,
      saleItemCount: 0,
    });

    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EProductFinancialState(productName)).resolves.toMatchObject({
      currentStock: 18,
      saleItemCount: 1,
      totalRevenueCents: 1600,
      totalSoldQuantity: 2,
    });

    await askNexis(page, "gastei 30 com carvão");
    const expenseDraft = latestAssistantMessage(page);
    await expect(expenseDraft.getByText("Rascunho de despesa")).toBeVisible();
    await expect(expenseDraft.getByRole("button", { name: "Confirmar despesa" })).toBeVisible();

    await expenseDraft.getByRole("button", { name: "Confirmar despesa" }).click();
    await expect(expenseDraft.getByText("Despesa confirmada e salva.")).toBeVisible();

    await askNexis(page, "qual meu lucro líquido hoje?");
    await expect(latestAssistantMessage(page).getByText(/Lucro líquido hoje/i)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("-R$ 22,00", { exact: true })).toBeVisible();
  });

  test("scenario B: construction sand keeps fine and coarse products separate", async ({ page }) => {
    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "bota no estoque 3 metro de areia fina paguei 90 cada metro e vendo por 130 mínimo 1");
    await expectProductPrefill(page, {
      initialStock: "3",
      minimumStock: "1",
      name: "areia fina",
      salePrice: "130,00",
      unit: "METER",
      unitCost: "90,00",
    });
    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();

    await page.goto("/assistant");
    await askNexisAndWaitForProducts(page, "bota no estoque 4 metro de areia grossa paguei 85 cada metro e vendo por 125 mínimo 1");
    await expectProductPrefill(page, {
      initialStock: "4",
      minimumStock: "1",
      name: "areia grossa",
      salePrice: "125,00",
      unit: "METER",
      unitCost: "85,00",
    });
    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();

    await page.goto("/assistant");
    await askNexis(page, "vendi a areia grossa");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByRole("heading", { name: /areia grossa/i })).toBeVisible();
    await expect(getE2EProductFinancialState("areia grossa")).resolves.toMatchObject({
      currentStock: 4,
      saleItemCount: 0,
    });

    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EProductFinancialState("areia grossa")).resolves.toMatchObject({
      currentStock: 3,
      saleItemCount: 1,
      totalSoldQuantity: 1,
    });
    await expect(getE2EProductFinancialState("areia fina")).resolves.toMatchObject({
      currentStock: 3,
      saleItemCount: 0,
    });
  });

  test("scenario C: cement total value ambiguity becomes deterministic unit cost", async ({ page }) => {
    const productName = "saco de cimento";

    await page.goto("/assistant");

    await askNexis(page, "comprei 5 saco de cimento por 160");
    await expect(latestAssistantMessage(page).getByText(/total da compra ou o valor de cada unidade/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await askNexisAndWaitForProducts(page, "foi 160 no total");
    await expectProductPrefill(page, {
      initialStock: "5",
      minimumStock: "",
      name: /saco de cimento/i,
      salePrice: "",
      unit: "SACK",
      unitCost: "32,00",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);
  });

  test("scenario D: sensitive fictitious product opens only financial form plus warning", async ({ page }) => {
    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "cadastre glifosato fictício custo 80 venda 120 estoque 5 mínimo 1");
    await expectProductPrefill(page, {
      initialStock: "5",
      minimumStock: "1",
      name: /glifosato fict.cio/i,
      salePrice: "120,00",
      unit: "UNIT",
      unitCost: "80,00",
    });
    const form = newProductForm(page);
    await expect(form.getByText(/operacoes legais e autorizadas/i)).toBeVisible();
    await expect(form.getByText(/somente financeiro\/cadastral/i)).toBeVisible();
    await expect(form.getByText(/dosagem|mistura|aplicar/i)).toHaveCount(0);
  });

  test("scenario E: service revenue without stock is refused safely", async ({ page }) => {
    await page.goto("/assistant");

    await askNexis(page, "fiz um corte de cabelo de 40 reais");
    await expect(latestAssistantMessage(page).getByText(/Receita de serviço sem estoque ainda não está implementada/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState("corte de cabelo")).resolves.toEqual(emptyState);
  });

  test("scenario F: ambiguous water product is resolved by variant text", async ({ page }) => {
    await seedE2EProducts([
      { currentStock: 10, name: "Água 500ml", salePriceCents: 300, unitCostCents: 100 },
      { currentStock: 10, name: "Água 1L", salePriceCents: 500, unitCostCents: 200 },
      { currentStock: 10, name: "Água com gás 500ml", salePriceCents: 400, unitCostCents: 150 },
    ]);
    await page.goto("/assistant");

    await askNexis(page, "vendi uma água");
    await expect(latestAssistantMessage(page).getByText(/mais de um produto parecido/i)).toBeVisible();
    await expectNoDraftButtons(page);

    await askNexis(page, "a com gás");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByRole("heading", { name: "Água com gás 500ml" })).toBeVisible();
    await expect(saleDraft.getByRole("button", { name: "Confirmar venda" })).toBeVisible();
    await expect(getE2EProductFinancialState("Água com gás 500ml")).resolves.toMatchObject({
      currentStock: 10,
      saleItemCount: 0,
    });
  });

  test("scenario G: multiple mixed actions ask for one action and save nothing", async ({ page }) => {
    await page.goto("/assistant");

    await askNexis(page, "comprei areia, vendi cimento e gastei 10");
    await expect(latestAssistantMessage(page).getByText(/uma coisa por vez/i)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText(/compra, venda ou despesa/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState("areia")).resolves.toEqual(emptyState);
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
