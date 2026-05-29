import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "../..");
const databasePath = resolve(projectRoot, "tests/db/.tmp/reset-empty-test.db");
const databaseUrl = "file:./tests/db/.tmp/reset-empty-test.db";

describe("db:reset-empty script", () => {
  it("applies migrations and leaves critical tables empty", async () => {
    removeSqliteFiles(databasePath);
    mkdirSync(dirname(databasePath), { recursive: true });

    const result = runResetEmpty({
      DATABASE_URL: databaseUrl,
      NEXIS_EMPTY_RESET: "1",
      NODE_ENV: "test",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Reset vazio local concluido.");
    await expect(readCriticalTableCounts()).resolves.toEqual({
      cancellationEvent: 0,
      expense: 0,
      product: 0,
      purchase: 0,
      sale: 0,
      saleItem: 0,
      stockLoss: 0,
      stockMovement: 0,
    });
  }, 45_000);

  it("blocks non-SQLite database URLs", () => {
    const result = runResetEmpty({
      DATABASE_URL: "postgresql://example.invalid/nexis",
      NEXIS_EMPTY_RESET: "1",
      NODE_ENV: "test",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("DATABASE_URL precisa comecar com file:");
  });

  it("blocks production environment", () => {
    const result = runResetEmpty({
      DATABASE_URL: databaseUrl,
      NEXIS_EMPTY_RESET: "1",
      NODE_ENV: "production",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("nao roda em NODE_ENV=production");
  });
});

function runResetEmpty(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["scripts/db/reset-empty.mjs"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

async function readCriticalTableCounts() {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });

  try {
    const [product, purchase, sale, saleItem, expense, stockLoss, cancellationEvent, stockMovement] = await Promise.all([
      prisma.product.count(),
      prisma.purchase.count(),
      prisma.sale.count(),
      prisma.saleItem.count(),
      prisma.expense.count(),
      prisma.stockLoss.count(),
      prisma.cancellationEvent.count(),
      prisma.stockMovement.count(),
    ]);

    return {
      cancellationEvent,
      expense,
      product,
      purchase,
      sale,
      saleItem,
      stockLoss,
      stockMovement,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function removeSqliteFiles(path: string): void {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${path}${suffix}`, { force: true });
  }
}
