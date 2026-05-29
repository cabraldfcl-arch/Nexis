import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "node tests/e2e/helpers/start-e2e-server.mjs",
    reuseExistingServer: false,
    timeout: 300_000,
    url: baseURL,
  },
});
