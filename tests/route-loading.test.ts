import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const routesWithLoading = [
  "app/loading.tsx",
  "app/products/loading.tsx",
  "app/sales/loading.tsx",
  "app/purchases/loading.tsx",
  "app/expenses/loading.tsx",
  "app/assistant/loading.tsx",
] as const;

describe("route loading feedback", () => {
  test("shared loading component exposes accessible mobile feedback", () => {
    const source = readFileSync(join(process.cwd(), "components/route-loading.tsx"), "utf8");

    expect(source).toContain("role=\"status\"");
    expect(source).toContain("aria-live=\"polite\"");
    expect(source).toContain("aria-busy=\"true\"");
  });

  test.each(routesWithLoading)("%s exposes accessible mobile loading feedback", (relativePath) => {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");

    expect(source).toContain("RouteLoading");
  });
});
