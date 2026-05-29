import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../..");
const tempDir = resolve(projectRoot, "tests/e2e/.tmp/performance");
const reportDir = resolve(projectRoot, "test-results/lighthouse");
const databaseUrl = "file:./tests/e2e/.tmp/performance/performance.db";
const databasePath = resolve(projectRoot, "tests/e2e/.tmp/performance/performance.db");
const port = process.env.LIGHTHOUSE_PORT ?? "3205";
const baseUrl = `http://127.0.0.1:${port}`;
const routes = [
  { path: "/", name: "dashboard" },
  { path: "/assistant", name: "assistant" },
];

const baseEnv = {
  ...process.env,
  AI_ASSISTANT_ENABLED: "false",
  AUDIO_TRANSCRIPTION_PROVIDER: "mock",
  BETKOL_CPU_COMMAND: "",
  DATABASE_URL: databaseUrl,
  NEXT_PUBLIC_AUDIO_INPUT_ENABLED: "false",
  NEXT_TELEMETRY_DISABLED: "1",
};

if (!databasePath.startsWith(`${tempDir}${sep}`)) {
  throw new Error(`Performance database must live under tests/e2e/.tmp/performance: ${databasePath}`);
}

mkdirSync(tempDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });
removeSqliteFiles(databasePath);

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "db", "seed"]);
run("npx", ["next", "build"]);

const server = spawn("npx", ["next", "start", "--hostname", "127.0.0.1", "--port", port], {
  cwd: projectRoot,
  env: baseEnv,
  stdio: "inherit",
});

try {
  await waitForHttp(baseUrl, 60_000);

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });

  try {
    for (const route of routes) {
      const outputPath = resolve(reportDir, `${route.name}.json`);
      const result = await lighthouse(`${baseUrl}${route.path}`, {
        port: chrome.port,
        onlyCategories: ["performance"],
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 2.75,
          disabled: false,
        },
        throttlingMethod: "simulate",
        output: "json",
        logLevel: "error",
      });

      mkdirSync(reportDir, { recursive: true });
      writeFileSync(outputPath, result.report);
      printSummary(route.name, result.lhr);
    }
  } finally {
    await chrome.kill();
  }
} finally {
  server.kill("SIGTERM");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: baseEnv,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function removeSqliteFiles(path) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${path}${suffix}`, { force: true });
  }
}

function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolveWait, rejectWait) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolveWait();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          rejectWait(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

function printSummary(routeName, report) {
  const score = Math.round((report.categories.performance.score ?? 0) * 100);
  const metrics = {
    fcp: report.audits["first-contentful-paint"]?.displayValue,
    lcp: report.audits["largest-contentful-paint"]?.displayValue,
    tbt: report.audits["total-blocking-time"]?.displayValue,
    cls: report.audits["cumulative-layout-shift"]?.displayValue,
    speedIndex: report.audits["speed-index"]?.displayValue,
  };

  console.log(
    `Lighthouse mobile ${routeName}: performance=${score}, ` +
      `FCP=${metrics.fcp}, LCP=${metrics.lcp}, TBT=${metrics.tbt}, ` +
      `CLS=${metrics.cls}, SpeedIndex=${metrics.speedIndex}`,
  );
}
