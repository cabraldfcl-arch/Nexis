import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  getE2EAiDemoFinancialState,
  resetE2EDatabase,
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

test.describe("assistant commercial measurement units", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("flow A: kg product from observed typo phrase opens form and only saves by button", async ({
    page,
  }) => {
    const productName = "Macan";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "eu comprei hoje 2 kg de macan a 25,50 o kg");
    await expectProductPrefill(page, {
      initialStock: "2",
      minimumStock: "",
      name: productName,
      salePrice: "",
      unit: "KG",
      unitCost: "25,50",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    const form = newProductForm(page);
    await form.getByLabel("Preço cadastrado").fill("35");
    await form.getByLabel("Estoque minimo").fill("1");
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 2,
      initialStockAdjustmentMovementCount: 0,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalInitialStockAdjustmentQuantity: 0,
      totalPurchaseCostCents: 5100,
      totalPurchasedQuantity: 2,
    });
  });

  test("flow B: material by meter opens a meter product form without saving first", async ({ page }) => {
    const productName = "areia fina";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(
      page,
      "bota no estoque 3 metros de areia fina a 90 o metro e vendo por 130 o metro mínimo 1",
    );
    await expectProductPrefill(page, {
      initialStock: "3",
      minimumStock: "1",
      name: productName,
      salePrice: "130,00",
      unit: "METER",
      unitCost: "90,00",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);
  });

  test("flow C: sack product opens a sack product form without saving first", async ({ page }) => {
    const productName = "cimento";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "comprei 5 sacos de cimento a 32 o saco vendo por 45 mínimo 2");
    await expectProductPrefill(page, {
      initialStock: "5",
      minimumStock: "2",
      name: productName,
      salePrice: "45,00",
      unit: "SACK",
      unitCost: "32,00",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);
  });

  test("flow D: embedded assistant registers gram product and sale deducts stock", async ({ page }) => {
    const productName = "tempero";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "cadastre tempero unidade grama custo 0,04 venda 0,08 estoque 500 mínimo 100");
    await expectProductPrefill(page, {
      initialStock: "500",
      minimumStock: "100",
      name: productName,
      salePrice: "0,08",
      unit: "GRAM",
      unitCost: "0,04",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 500,
      productCount: 1,
      totalInitialStockAdjustmentQuantity: 500,
    });

    await page.goto("/assistant");
    await askNexis(page, "vendi 125 gramas de tempero");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByRole("heading", { name: productName })).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 500,
      saleItemCount: 0,
      saleMovementCount: 0,
    });

    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 375,
      saleItemCount: 1,
      saleMovementCount: 1,
      totalSaleRevenueCents: 1000,
      totalSoldQuantity: 125,
    });
  });

  test("flow E: boxed stock is converted into unit stock before saving and selling", async ({ page }) => {
    const productName = "Refrigerante lata";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "comprei 2 caixas de refrigerante lata com 12 unidades cada a 36 a caixa");
    await expectProductPrefill(page, {
      initialStock: "24",
      minimumStock: "",
      name: /refrigerante lata/i,
      salePrice: "",
      unit: "UNIT",
      unitCost: "3,00",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    const form = newProductForm(page);
    await form.getByLabel("Preço cadastrado").fill("3");
    await form.getByLabel("Estoque minimo").fill("6");
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 24,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalInitialStockAdjustmentQuantity: 0,
      totalPurchaseCostCents: 7200,
      totalPurchasedQuantity: 24,
    });

    await page.goto("/assistant");
    await askNexis(page, "vendi 1 refrigerante lata");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByText("24 -> 23")).toBeVisible();
    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 23,
      saleItemCount: 1,
      totalSaleCostCents: 300,
      totalSaleRevenueCents: 300,
      totalSoldQuantity: 1,
    });
  });

  test("flow F: kg product accepts gram sale and deducts the fractional kg", async ({ page }) => {
    const productName = "Maca";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "eu comprei hoje 2 kg de maca a 5 o kg");
    await expectProductPrefill(page, {
      initialStock: "2",
      minimumStock: "",
      name: productName,
      salePrice: "",
      unit: "KG",
      unitCost: "5,00",
    });
    const form = newProductForm(page);
    await form.getByLabel("Preço cadastrado").fill("8");
    await form.getByLabel("Estoque minimo").fill("0,5");
    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();

    await page.goto("/assistant");
    await askNexis(page, "vendi 500 gramas de maca");
    const saleDraft = latestAssistantMessage(page);
    await expect(saleDraft.getByText("Rascunho de venda")).toBeVisible();
    await expect(saleDraft.getByText("0,5").first()).toBeVisible();
    await expect(saleDraft.getByText("2 -> 1,5")).toBeVisible();
    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 1.5,
      saleItemCount: 1,
      totalSaleCostCents: 250,
      totalSaleRevenueCents: 400,
      totalSoldQuantity: 0.5,
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

function latestAssistantMessage(page: Page): Locator {
  return page.getByTestId("assistant-message").last();
}

function newProductForm(page: Page): Locator {
  return page.locator('section[aria-labelledby="new-product-heading"]');
}
