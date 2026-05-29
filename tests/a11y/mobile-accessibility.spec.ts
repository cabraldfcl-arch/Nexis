import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", name: "dashboard" },
  { path: "/products", name: "products" },
  { path: "/sales", name: "sales" },
  { path: "/purchases", name: "purchases" },
  { path: "/expenses", name: "expenses" },
  { path: "/assistant", name: "assistant" },
];

test.describe("mobile accessibility smoke", () => {
  for (const route of routes) {
    test(`has no critical or serious axe violations on ${route.name}`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .include("body")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const blockingViolations = results.violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious",
      );

      expect(blockingViolations).toEqual([]);
    });
  }
});
