import { expect, test, type Locator, type Page } from "@playwright/test";
import { getE2EProductFinancialState, resetE2EDatabase } from "./helpers/e2e-database";

test.describe("mobile MVP full financial flow", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("creates product, purchase, sale and confirmed expense, then updates dashboard", async ({ page }) => {
    const timestamp = Date.now();
    const productName = `Produto E2E ${timestamp}`;
    const expenseDescription = `Energia E2E ${timestamp}`;

    await page.goto("/");

    const monthSection = page.locator('section[aria-labelledby="month-heading"]');
    await expectSummaryCard(page, monthSection, "Vendas no mês", "R$ 0,00");
    await expectSummaryCard(page, monthSection, "Lucro bruto", "R$ 0,00");
    await expectSummaryCard(page, monthSection, "Despesas", "R$ 0,00");
    await expectSummaryCard(page, monthSection, "Lucro líquido", "R$ 0,00");
    await expectSummaryCard(page, monthSection, "Produtos acabando", "0");

    await createProduct(page, productName);
    await registerPurchase(page, productName);
    await registerSaleWithRegisteredPrice(page, productName);
    await registerSaleWithChangedPrice(page, productName);
    await registerConfirmedExpense(page, expenseDescription);

    await page.getByRole("link", { name: "Voltar ao painel" }).click();
    await expect(page).toHaveURL("/");

    const updatedTodaySection = page.locator('section[aria-labelledby="today-heading"]');
    await expectSummaryCard(page, updatedTodaySection, "Vendas hoje", "R$ 19,00");
    await expectSummaryCard(page, updatedTodaySection, "Despesas", "R$ 4,00");
    await expectSummaryCard(page, updatedTodaySection, "Lucro líquido", "R$ 7,00");

    const updatedMonthSection = page.locator('section[aria-labelledby="month-heading"]');
    await expectSummaryCard(page, updatedMonthSection, "Vendas no mês", "R$ 19,00");
    await expectSummaryCard(page, updatedMonthSection, "Lucro bruto", "R$ 11,00");
    await expectSummaryCard(page, updatedMonthSection, "Despesas", "R$ 4,00");
    await expectSummaryCard(page, updatedMonthSection, "Lucro líquido", "R$ 7,00");
    await expectSummaryCard(page, updatedMonthSection, "Produtos acabando", "1");

    const lowStockSection = page.locator('section[aria-labelledby="low-stock-heading"]');
    await expect(lowStockSection.getByText(productName)).toBeVisible();
    await expect(lowStockSection.getByText("Estoque 6 de minimo 8")).toBeVisible();
  });
});

async function createProduct(page: Page, productName: string) {
  await page.getByRole("link", { name: "Cadastrar produto" }).click();
  await expectRouteReady(page, /\/products$/);

  await page.getByLabel("Nome do produto").fill(productName);
  await page.getByLabel("Categoria").fill("E2E");
  await page.getByLabel("Custo para voce").fill("2,00");
  await page.getByLabel("Preço cadastrado").fill("5,00");
  await page.getByLabel("Estoque inicial").fill("0");
  await page.getByLabel("Estoque minimo").fill("8");
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("Produto salvo.")).toBeVisible();
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
}

async function registerPurchase(page: Page, productName: string) {
  await page.getByRole("link", { name: "Voltar ao painel" }).click();
  await page.getByRole("link", { name: "Registrar compra" }).click();
  await expectRouteReady(page, /\/purchases$/);

  await selectProduct(page, `${productName} - estoque 0 unid.`);
  await page.getByLabel("Quantidade comprada").fill("10");
  await page.getByLabel("Custo por unidade").fill("2,00");
  await page.getByLabel("Fornecedor").fill("Fornecedor E2E");
  await page.getByRole("button", { name: "Confirmar compra" }).click();

  await expect(page.getByText("Compra confirmada.")).toBeVisible();
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
  await expect(page.getByText("10 unid. comprados")).toBeVisible();
  await expect(page.getByText("R$ 20,00")).toBeVisible();
}

async function registerSaleWithRegisteredPrice(page: Page, productName: string) {
  await page.getByRole("link", { name: "Voltar ao painel" }).click();
  await page.getByRole("link", { name: "Registrar venda" }).click();
  await expectRouteReady(page, /\/sales$/);

  await selectProduct(page, `${productName} - estoque 10 unid. - preço 5,00`);
  await expect(page.getByLabel("Preço desta venda")).toHaveValue("5,00");
  await page.getByLabel("Quantidade vendida").fill("3");
  await submitSaleAndExpectFeedback(page);
  await expectSalePersisted(productName, {
    currentStock: 7,
    saleItemCount: 1,
    saleMovementCount: 1,
    totalCostCents: 600,
    totalRevenueCents: 1500,
    totalSaleMovementQuantity: 3,
    totalSoldQuantity: 3,
  });

  await page.reload();
  await expectRouteReady(page, /\/sales$/);
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "R$ 15,00" })).toBeVisible();
}

async function registerSaleWithChangedPrice(page: Page, productName: string) {
  await page.getByRole("link", { name: "Voltar ao painel" }).click();
  await page.getByRole("link", { name: "Registrar venda" }).click();
  await expectRouteReady(page, /\/sales$/);

  await selectProduct(page, `${productName} - estoque 7 unid. - preço 5,00`);
  await expect(page.getByText("Se deixar como está, usamos o preço cadastrado do produto.")).toBeVisible();
  await page.getByLabel("Quantidade vendida").fill("1");
  await page.getByLabel("Preço desta venda").fill("1,00");
  await expect(page.getByText("Atenção: preço abaixo do custo para você.")).toBeVisible();
  await page.getByLabel("Preço desta venda").fill("4,00");
  await submitSaleAndExpectFeedback(page);
  await expectSalePersisted(productName, {
    currentStock: 6,
    saleItemCount: 2,
    saleMovementCount: 2,
    totalCostCents: 800,
    totalRevenueCents: 1900,
    totalSaleMovementQuantity: 4,
    totalSoldQuantity: 4,
  });

  await page.reload();
  await expectRouteReady(page, /\/sales$/);
  await expect(page.getByText(productName, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "R$ 4,00" })).toBeVisible();
}

async function registerConfirmedExpense(page: Page, expenseDescription: string) {
  await page.getByRole("link", { name: "Voltar ao painel" }).click();
  await page.getByRole("link", { name: "Registrar despesa" }).click();
  await expectRouteReady(page, /\/expenses$/);

  await page.getByLabel("Descricao").fill(expenseDescription);
  await page.getByLabel("Categoria").selectOption("UTILITIES");
  await page.getByLabel("Valor").fill("4,00");
  await expect(page.getByLabel("Confirmada")).toBeChecked();
  await page.getByRole("button", { name: "Confirmar despesa" }).click();

  const expenseList = page.locator('section[aria-labelledby="expense-list-heading"]');
  await expect(page.getByText("Despesa confirmada.")).toBeVisible();
  await expect(expenseList.getByRole("heading", { name: expenseDescription })).toBeVisible();
  await expect(expenseList.getByText("Confirmada")).toBeVisible();
  await expect(expenseList.getByText("R$ 4,00")).toBeVisible();
}

async function selectProduct(page: Page, label: string) {
  await page.locator('select[name="productId"]').selectOption({ label });
}

async function expectRouteReady(page: Page, expectedUrl: RegExp) {
  await expect(page).toHaveURL(expectedUrl);
  await page.waitForLoadState("networkidle");
}

async function submitSaleAndExpectFeedback(page: Page) {
  await page.getByRole("button", { name: "Confirmar venda" }).click();

  await expect(page.getByText("Venda confirmada.")).toBeVisible();
  await expect(page.getByText("Confirmando...")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmar venda" })).toBeEnabled();
}

async function expectSalePersisted(
  productName: string,
  expectedState: Awaited<ReturnType<typeof getE2EProductFinancialState>>,
) {
  await expect(getE2EProductFinancialState(productName)).resolves.toEqual(expectedState);
}

async function expectSummaryCard(page: Page, section: Locator, label: string, value: string) {
  const card = section.locator("article").filter({
    has: page.getByText(label, { exact: true }),
  });

  await expect(card).toHaveCount(1);
  await expect(card).toContainText(value);
}
