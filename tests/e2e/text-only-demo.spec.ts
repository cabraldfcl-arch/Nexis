import { expect, test, type Locator, type Page } from "@playwright/test";
import { getE2EProductCreationState, resetE2EDatabase } from "./helpers/e2e-database";

test.describe("mobile text-only demo flow", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase({ seedDemo: true });
  });

  test("answers questions, drafts a sale without saving, then saves only after confirmation", async ({ page }) => {
    await page.goto("/");

    const todaySection = page.locator('section[aria-labelledby="today-heading"]');
    await expectSummaryCard(page, todaySection, "Vendas hoje", "R$ 293,00");
    await expectSummaryCard(page, todaySection, "Despesas", "R$ 85,00");
    await expectSummaryCard(page, todaySection, "Lucro líquido", "R$ 83,00");

    const lowStockSection = page.locator('section[aria-labelledby="low-stock-heading"]');
    await expect(lowStockSection.getByText("Água mineral")).toBeVisible();
    await expect(lowStockSection.getByText("Salgado assado")).toBeVisible();

    await page.getByRole("link", { name: "Falar com NEXIS" }).click();
    await expect(page).toHaveURL(/\/assistant$/);
    await expect(page.getByText("Demo por texto", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gravar áudio" })).toHaveCount(0);

    await askNexis(page, "quanto vendi hoje?");
    await expect(page.getByText("Vendas hoje")).toBeVisible();
    await expect(page.getByText("R$ 293,00").first()).toBeVisible();

    await askNexis(page, "qual meu lucro bruto hoje?");
    await expect(page.getByText("Lucro bruto hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("R$ 168,00").first()).toBeVisible();

    await askNexis(page, "qual meu lucro líquido hoje?");
    await expect(page.getByText("Lucro líquido hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("R$ 83,00").first()).toBeVisible();

    await askNexis(page, "qual meu estoque atual?");
    await expect(page.getByText("Estoque atual", { exact: true })).toBeVisible();
    await expect(page.getByText(/Água mineral: 3/)).toBeVisible();

    await askNexis(page, "tenho quantas águas?");
    await expect(page.getByText(/Água mineral tem 3 em estoque/)).toBeVisible();

    await askNexis(page, "o que comprei hoje?");
    await expect(page.getByText("Compras hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("R$ 247,00").first()).toBeVisible();

    await askNexis(page, "produto mais vendido hoje");
    await expect(page.getByText("Produto mais vendido hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("Água mineral").first()).toBeVisible();

    await askNexis(page, "cancelar a venda de hoje");
    await expect(latestAssistantMessage(page).getByText(/mais de uma venda/i)).toBeVisible();
    await expect(latestAssistantMessage(page).getByRole("button", { name: "Confirmar cancelamento" })).toHaveCount(0);

    await askNexis(page, "vendi 1 produto fantasma por 3 reais");
    await expect(page.getByText(/Não encontrei produto ativo/)).toBeVisible();

    await askNexis(page, "vendi 20 águas por 3 reais");
    await expect(page.getByText(/estoque insuficiente/i)).toBeVisible();

    await askNexis(page, "gastei 0 com embalagem");
    await expect(page.getByText("Valor da despesa precisa ser maior que zero.")).toBeVisible();

    await askNexis(page, "vendi 2 águas por 2 reais cada");
    await expect(latestAssistantMessage(page).getByText("Rascunho de venda")).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Preço desta venda diferente do preço cadastrado.")).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Preço desta venda", { exact: true })).toBeVisible();

    await askNexis(page, "vendi 1 água por 0,50");
    await expect(latestAssistantMessage(page).getByText("Atenção: venda abaixo do custo.")).toBeVisible();

    await askNexis(page, "vendi 2 águas");
    await expect(latestAssistantMessage(page).getByText("Rascunho de venda")).toBeVisible();
    await expect(latestAssistantMessage(page).getByRole("heading", { name: "Água mineral" })).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Preço cadastrado")).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Preço desta venda", { exact: true })).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Custo estimado")).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Lucro estimado")).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Estoque vai diminuir")).toBeVisible();
    await expect(
      latestAssistantMessage(page).getByText("Nada será salvo antes de clicar no botão de confirmação."),
    ).toBeVisible();
    await expect(latestAssistantMessage(page).getByRole("button", { name: "Confirmar venda" })).toBeVisible();

    await page.getByRole("link", { name: "Voltar ao painel" }).click();
    await expect(page).toHaveURL("/");
    await expectSummaryCard(page, todaySection, "Vendas hoje", "R$ 293,00");

    await page.getByRole("link", { name: "Falar com NEXIS" }).click();
    await askNexis(page, "vendi 2 águas");
    await page.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(page.getByText("Venda confirmada e estoque atualizado.")).toBeVisible();
    await expect(page.getByText("Confirmando...")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirmar venda" })).toBeDisabled();

    await page.getByRole("link", { name: "Voltar ao painel" }).click();
    await expect(page).toHaveURL("/");
    await expectSummaryCard(page, todaySection, "Vendas hoje", "R$ 299,00");

    await page.reload();
    await expect(page).toHaveURL("/");
    await expectSummaryCard(page, todaySection, "Vendas hoje", "R$ 299,00");
  });

  test("opens and saves a product form only after explicit confirmation", async ({ page }) => {
    await page.goto("/assistant");

    await askNexisAndWaitForProducts(page, "cadastrar produto refrigerante");
    let productForm = newProductForm(page);
    await expect(productForm.getByRole("heading", { name: "Adicionar produto" })).toBeVisible();
    await expect(productForm.getByRole("button", { name: "Salvar produto" })).toBeVisible();
    await expect(getE2EProductCreationState("Coca lata")).resolves.toMatchObject({ productCount: 0 });

    await page.goto("/assistant");
    await askNexisAndWaitForProducts(page, "cadastrar Coca lata custo 3 venda 6 estoque 20 mínimo 5");
    productForm = newProductForm(page);
    await expect(productForm.getByLabel("Nome do produto")).toHaveValue("Coca lata");
    await expect(productForm.getByLabel("Custo para voce")).toHaveValue("3,00");
    await expect(productForm.getByLabel("Preço cadastrado")).toHaveValue("6,00");
    await expect(productForm.getByLabel("Estoque inicial")).toHaveValue("20");
    await expect(productForm.getByLabel("Estoque minimo")).toHaveValue("5");
    await expect(productForm.getByText("NEXIS preencheu o que conseguiu entender.")).toBeVisible();
    await expect(productForm.getByRole("button", { name: "Salvar produto" })).toBeVisible();
    await expect(getE2EProductCreationState("Coca lata")).resolves.toMatchObject({ productCount: 0 });

    await productForm.getByRole("button", { name: "Salvar produto" }).click();
    await expect(productForm.getByText("Produto salvo.")).toBeVisible();
    await expect(productForm.getByText("Salvando...")).toHaveCount(0);
    await expect(getE2EProductCreationState("Coca lata")).resolves.toMatchObject({
      adjustmentMovementCount: 1,
      currentStock: 20,
      productCount: 1,
      totalAdjustmentQuantity: 20,
    });

    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Coca lata" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Coca lata" })).toBeVisible();

    await page.goto("/assistant");
    await askNexisAndWaitForProducts(page, "cadastrar COCA   lata custo 3 venda 6 estoque 20 mínimo 5");
    productForm = newProductForm(page);
    await productForm.getByRole("button", { name: "Salvar produto" }).click();
    await expect(productForm.getByText("Já existe um produto parecido cadastrado. Revise antes de criar outro.")).toBeVisible();
    await expect(getE2EProductCreationState("Coca lata")).resolves.toMatchObject({ productCount: 1 });

    await page.goto("/assistant");
    await askNexis(page, "vendi 2 Coca nova");
    await expect(page.getByText(/Não encontrei produto ativo/)).toBeVisible();
    await expect(getE2EProductCreationState("Coca nova")).resolves.toMatchObject({ productCount: 0 });
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
