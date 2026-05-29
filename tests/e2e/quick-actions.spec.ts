import { expect, test } from "@playwright/test";
import { resetE2EDatabase } from "./helpers/e2e-database";

test.describe("dashboard quick actions", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase({ seedDemo: true });
  });

  test("opens each quick action and returns to the dashboard", async ({ page }) => {
    const actions: [string, RegExp][] = [
      ["Cadastrar produto", /\/products$/],
      ["Registrar venda", /\/sales$/],
      ["Registrar compra", /\/purchases$/],
      ["Registrar despesa", /\/expenses$/],
      ["Falar com NEXIS", /\/assistant$/],
    ];

    await page.goto("/");

    for (const [label, expectedUrl] of actions) {
      await page.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(expectedUrl);
      await page.getByRole("link", { name: "Voltar ao painel" }).click();
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("heading", { name: "Hoje no negócio" })).toBeVisible();
    }
  });
});
