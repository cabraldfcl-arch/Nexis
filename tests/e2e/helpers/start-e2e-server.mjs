import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const helperDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(helperDir, "../../..");
const tempDir = resolve(projectRoot, "tests/e2e/.tmp");
const defaultDatabaseUrl = "file:./tests/e2e/.tmp/playwright-e2e.db";
const databaseUrl = process.env.E2E_DATABASE_URL ?? defaultDatabaseUrl;
const databasePath = resolveSqliteFileUrl(databaseUrl);
const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const serverEnv = {
  ...process.env,
  AI_ASSISTANT_ENABLED: "false",
  AUDIO_TRANSCRIPTION_PROVIDER: "mock",
  BETKOL_CPU_COMMAND: "",
  DATABASE_URL: databaseUrl,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_AUDIO_INPUT_ENABLED: "false",
};

if (!databasePath.startsWith(`${tempDir}${sep}`)) {
  throw new Error(`E2E database must live under tests/e2e/.tmp: ${databasePath}`);
}

mkdirSync(dirname(databasePath), { recursive: true });
removeSqliteFiles(databasePath);

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["next", "build"]);

const server = spawn("npx", ["next", "start", "--hostname", "127.0.0.1", "--port", port], {
  cwd: projectRoot,
  env: serverEnv,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.kill(signal);
  });
}

server.on("exit", (code) => {
  process.exit(code ?? 0);
});

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: serverEnv,
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

function resolveSqliteFileUrl(url) {
  if (!url.startsWith("file:")) {
    throw new Error("E2E database URL must use a SQLite file: URL.");
  }

  const path = url.slice("file:".length);

  if (path.startsWith("./")) {
    return resolve(projectRoot, path);
  }

  if (path.startsWith("/")) {
    return resolve(path);
  }

  if (existsSync(path)) {
    return resolve(projectRoot, path);
  }

  return resolve(projectRoot, path);
}
