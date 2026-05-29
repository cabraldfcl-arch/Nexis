import { expect, test } from "@playwright/test";
import {
  getE2EAiDemoFinancialState,
  getE2EProductCreationState,
  resetE2EDatabase,
  seedE2EProducts,
} from "./helpers/e2e-database";

test.describe("manual packaged product registration", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("converts boxes into unit stock and unit cost before saving", async ({ page }) => {
    const productName = `Coca lata manual ${Date.now()}`;

    await page.goto("/products");

    await page.getByLabel("Nome do produto").fill(productName);
    await page.getByLabel("Categoria").fill("Bebidas");
    await page.getByLabel("Preço cadastrado").fill("3,00");
    await page.getByLabel("Estoque minimo").fill("6");
    await page.getByLabel("Quantidade de embalagens").fill("2");
    await page.getByLabel("Unidades por embalagem").fill("12");
    await page.getByLabel("Custo por embalagem").fill("36,00");
    await page.getByRole("button", { name: "Salvar produto" }).click();

    await expect(page.getByText("Produto salvo.")).toBeVisible();
    await expect(getE2EProductCreationState(productName)).resolves.toEqual({
      adjustmentMovementCount: 1,
      currentStock: 24,
      minimumStock: 6,
      productCount: 1,
      salePriceCents: 300,
      totalAdjustmentQuantity: 24,
      unit: "UNIT",
      unitCostCents: 300,
    });

    await page.getByText("Editar produto").first().click();
    await expect(page.getByText(/Estoque atual nao e alterado neste cadastro/i)).toBeVisible();
  });

  test("converts purchased packages into unit purchase and stock movement", async ({ page }) => {
    const productName = "Coca lata compra manual";

    await seedE2EProducts([
      { currentStock: 0, minimumStock: 6, name: productName, salePriceCents: 300, unitCostCents: 300 },
    ]);
    await page.goto("/purchases");

    await page.getByLabel("Produto").selectOption({ label: `${productName} - estoque 0 unid.` });
    await page.getByLabel("Quantidade de embalagens").fill("2");
    await page.getByLabel("Unidades por embalagem").fill("12");
    await page.getByLabel("Custo por embalagem").fill("18,00");
    await page.getByRole("button", { name: "Confirmar compra" }).click();

    await expect(page.getByText("Compra confirmada.")).toBeVisible();
    await expect(getE2EAiDemoFinancialState(productName)).resolves.toMatchObject({
      currentStock: 24,
      productCount: 1,
      purchaseCount: 1,
      purchaseMovementCount: 1,
      totalPurchaseCostCents: 3600,
      totalPurchasedQuantity: 24,
    });
  });
});
