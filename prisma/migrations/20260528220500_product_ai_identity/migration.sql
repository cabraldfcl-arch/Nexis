-- Add product identity fields used by the assistant resolver.
PRAGMA foreign_keys=OFF;

-- Redefine Product so normalizedName is required and unique without relying on SQLite expression defaults.
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UNIT',
    "unitCostCents" INTEGER NOT NULL,
    "salePriceCents" INTEGER NOT NULL,
    "currentStock" DECIMAL NOT NULL DEFAULT 0,
    "minimumStock" DECIMAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Product" (
    "id",
    "name",
    "normalizedName",
    "category",
    "unit",
    "unitCostCents",
    "salePriceCents",
    "currentStock",
    "minimumStock",
    "active",
    "origin",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    lower(trim(replace(replace(replace("name", '-', ' '), '_', ' '), '/', ' '))),
    "category",
    "unit",
    "unitCostCents",
    "salePriceCents",
    "currentStock",
    "minimumStock",
    "active",
    'MANUAL',
    "createdAt",
    "updatedAt"
FROM "Product";

DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";

CREATE UNIQUE INDEX "Product_normalizedName_key" ON "Product"("normalizedName");
CREATE INDEX "Product_active_idx" ON "Product"("active");
CREATE INDEX "Product_name_idx" ON "Product"("name");

CREATE TABLE "ProductAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ProductAlias" ("id", "productId", "alias", "normalizedAlias", "source", "createdAt")
SELECT
    lower(hex(randomblob(12))),
    "id",
    "name",
    "normalizedName",
    'MANUAL',
    CURRENT_TIMESTAMP
FROM "Product";

CREATE UNIQUE INDEX "ProductAlias_normalizedAlias_key" ON "ProductAlias"("normalizedAlias");
CREATE INDEX "ProductAlias_productId_idx" ON "ProductAlias"("productId");
CREATE INDEX "ProductAlias_normalizedAlias_idx" ON "ProductAlias"("normalizedAlias");

ALTER TABLE "Purchase" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Sale" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Expense" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "StockMovement" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'MANUAL';

PRAGMA foreign_keys=ON;
