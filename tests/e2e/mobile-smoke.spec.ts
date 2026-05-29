import { expect, test } from "@playwright/test";
import { resetE2EDatabase } from "./helpers/e2e-database";

test.describe("mobile MVP smoke", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("exposes installable PWA metadata", async ({ page, request }) => {
    await page.goto("/");

    const manifestLink = page.locator('link[rel="manifest"]');

    await expect(manifestLink).toHaveCount(1);

    const manifestHref = await manifestLink.getAttribute("href");

    expect(manifestHref).toBe("/manifest.webmanifest");

    const response = await request.get(manifestHref ?? "");

    expect(response.ok()).toBe(true);
    const manifest = await response.json();

    expect(manifest).toMatchObject({
      background_color: "#f6f7f4",
      display: "standalone",
      name: "NEXIS",
      short_name: "NEXIS",
      theme_color: "#064e3b",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: "any", src: "/icons/nexis-icon.svg" }),
        expect.objectContaining({ purpose: "maskable", src: "/icons/nexis-maskable.svg" }),
      ]),
    );
  });

  test("keeps core routes inside the mobile viewport", async ({ page }) => {
    await resetE2EDatabase({ seedDemo: true });

    const routes = ["/", "/products", "/sales", "/purchases", "/expenses", "/assistant"];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const metrics = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      const scrollWidth = Math.max(metrics.bodyScrollWidth, metrics.documentScrollWidth);

      expect(scrollWidth, `${route} should not have horizontal overflow`).toBeLessThanOrEqual(
        metrics.viewportWidth,
      );
    }
  });

  test("opens main routes from clear mobile home buttons", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { exact: true, name: "Hoje" })).toBeVisible();
    await expect(page.getByText("Dados reais")).toBeVisible();
    await expect(page.getByText("Vendas hoje")).toBeVisible();
    await expect(page.getByText(/Vendas no m.s/i)).toBeVisible();
    await expect(page.getByText("Produtos acabando").first()).toBeVisible();

    const quickActions = [
      { heading: "Produtos", label: "Cadastrar produto", path: "/products" },
      { heading: "Vendas", label: "Registrar venda", path: "/sales" },
      { heading: "Compras", label: "Registrar compra", path: "/purchases" },
      { heading: "Despesas", label: "Registrar despesa", path: "/expenses" },
      { heading: "Falar com NEXIS", label: "Falar com NEXIS", path: "/assistant" },
    ];

    for (const action of quickActions) {
      const link = page.getByRole("link", { name: action.label });

      await expect(link).toBeVisible();
      await expect(link).toBeInViewport();
      await expect(link).toHaveAttribute("href", action.path);

      await link.click();
      await expect(page).toHaveURL(new RegExp(`${action.path}$`));
      await expect(page.getByRole("heading", { exact: true, name: action.heading })).toBeVisible();
      await expect(page.getByRole("link", { name: "Voltar ao painel" })).toBeVisible();

      if (action.path === "/assistant") {
        await expect(page.getByLabel("Mensagem")).toBeVisible();
        await expect(page.getByText("Demo por texto", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Gravar áudio" })).toHaveCount(0);
      }

      await page.getByRole("link", { name: "Voltar ao painel" }).click();
      await expect(page).toHaveURL("/");
    }
  });
});
