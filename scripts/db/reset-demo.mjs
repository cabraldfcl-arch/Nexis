#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const demoDatabaseUrl = "file:./dev.db";

if (process.env.NEXIS_DEMO_RESET !== "1") {
  console.error("Reset demo bloqueado: execute via npm run db:reset-demo.");
  process.exitCode = 2;
} else if (process.env.DATABASE_URL !== demoDatabaseUrl) {
  console.error(`Reset demo bloqueado: DATABASE_URL precisa ser ${demoDatabaseUrl}.`);
  process.exitCode = 2;
} else {
  console.log("Resetando apenas o SQLite local/demo em file:./dev.db.");
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const commandEnv = {
    ...process.env,
    DATABASE_URL: demoDatabaseUrl,
  };
  const resetResult = spawnSync(command, ["prisma", "migrate", "reset", "--force"], {
    env: commandEnv,
    stdio: "inherit",
  });

  if (resetResult.status === 0) {
    const seedResult = spawnSync(command, ["prisma", "db", "seed"], {
      env: commandEnv,
      stdio: "inherit",
    });

    process.exitCode = seedResult.status ?? 1;
  } else {
    process.exitCode = resetResult.status ?? 1;
  }
}
