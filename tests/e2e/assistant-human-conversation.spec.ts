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

test.describe("assistant human conversation continuity", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("conversation A: registers a new product from natural purchase text and answers inventory", async ({
    page,
  }) => {
    const productName = "Coca Cola lata";

    await page.goto("/assistant");

    await askNexis(page, "olá boa tarde");
    await expect(latestAssistantMessage(page).getByText(/Boa tarde/i)).toBeVisible();

    await askNexisAndWaitForProducts(page, "quero cadastrar 10 coca cola em lata que comprei por 4.20 cada");
    await expectProductPrefill(page, {
      initialStock: "10",
      minimumStock: "",
      name: productName,
      salePrice: "",
      unit: "UNIT",
      unitCost: "4,20",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    const form = newProductForm(page);
    await form.getByLabel("Preço cadastrado").fill("10");
    await form.getByLabel("Estoque minimo").fill("5");
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await saveNewProduct(page);
    await expect(newProductForm(page).getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 10,
      initialStockAdjustmentMovementCount: 0,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalPurchaseCostCents: 4200,
      totalPurchasedQuantity: 10,
    });

    await page.goto("/assistant");
    await askNexis(page, "quanto tenho de estoque?");
    await expect(latestAssistantMessage(page).getByText("Estoque atual", { exact: true })).toBeVisible();
    await expect(latestAssistantMessage(page).getByText(/Coca Cola lata: 10/)).toBeVisible();
  });

  test("conversation B: opens product form with partial fields and saves only after the form button", async ({
    page,
  }) => {
    const productName = "Coca lata";

    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "cadastrar Coca lata");
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
    await form.getByLabel("Custo para voce").fill("4");
    await form.getByLabel("Preço cadastrado").fill("7");
    await form.getByLabel("Estoque inicial").fill("10");
    await form.getByLabel("Estoque minimo").fill("2");
    await saveNewProduct(page);
    await expect(form.getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 10,
      productCount: 1,
    });
  });

  test("conversation C: continues a sale after choosing an ambiguous product by number", async ({
    page,
  }) => {
    await seedE2EProducts([
      { currentStock: 10, name: "Coca Cola lata", salePriceCents: 700, unitCostCents: 400 },
      { currentStock: 10, name: "Coca Cola lata 350 ml", salePriceCents: 600, unitCostCents: 350 },
    ]);

    await page.goto("/assistant");

    await askNexis(page, "vendi uma coca");
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

    await saleDraft.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(saleDraft.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(getE2EProductFinancialState("Coca Cola lata")).resolves.toMatchObject({
      currentStock: 9,
      saleItemCount: 1,
      totalSoldQuantity: 1,
    });
    await expect(getE2EProductFinancialState("Coca Cola lata 350 ml")).resolves.toMatchObject({
      currentStock: 10,
      saleItemCount: 0,
    });
  });

  test("conversation D: clarifies total purchase value before opening a safe product form", async ({
    page,
  }) => {
    const productName = "Refrigerante";

    await page.goto("/assistant");

    await askNexis(page, "comprei 5 refrigerante por 20 reais");
    await expect(latestAssistantMessage(page).getByText(/total da compra ou o valor de cada unidade/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);

    await askNexisAndWaitForProducts(page, "total");
    await expectProductPrefill(page, {
      initialStock: "5",
      minimumStock: "",
      name: productName,
      salePrice: "",
      unit: "UNIT",
      unitCost: "4,00",
    });
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toEqual(emptyState);
  });

  test("conversation E: asks the user to split mixed actions and saves nothing", async ({ page }) => {
    await page.goto("/assistant");

    await askNexis(page, "comprei coca, vendi água e gastei 10");
    await expect(latestAssistantMessage(page).getByText(/uma coisa por vez/i)).toBeVisible();
    await expect(latestAssistantMessage(page).getByText(/compra, venda ou despesa/i)).toBeVisible();
    await expectNoDraftButtons(page);
    await expect(getE2EAiDemoFinancialState("Coca")).resolves.toEqual(emptyState);
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
