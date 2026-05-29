import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "scripts/**/*.mjs"],
      exclude: [
        "app/**/page.tsx",
        "app/**/layout.tsx",
        "components/**",
        "scripts/db/**",
        "scripts/performance/**",
        "scripts/**/check-*.mjs",
        "tests/**",
        "next-env.d.ts",
        "vitest.config.ts",
        "playwright.config.ts",
      ],
    },
  },
});
