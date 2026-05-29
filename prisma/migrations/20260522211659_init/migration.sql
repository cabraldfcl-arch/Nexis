-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UNIT',
    "unitCostCents" INTEGER NOT NULL,
    "salePriceCents" INTEGER NOT NULL,
    "currentStock" DECIMAL NOT NULL DEFAULT 0,
    "minimumStock" DECIMAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "supplier" TEXT,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalAmountCents" INTEGER NOT NULL,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "unitCostSnapshotCents" INTEGER NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "amountCents" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "reason" TEXT NOT NULL,
    "purchaseId" TEXT,
    "saleItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Purchase_productId_idx" ON "Purchase"("productId");

-- CreateIndex
CREATE INDEX "Purchase_purchasedAt_idx" ON "Purchase"("purchasedAt");

-- CreateIndex
CREATE INDEX "Sale_soldAt_idx" ON "Sale"("soldAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "Expense_paidAt_idx" ON "Expense"("paidAt");

-- CreateIndex
CREATE INDEX "Expense_confirmed_idx" ON "Expense"("confirmed");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_purchaseId_idx" ON "StockMovement"("purchaseId");

-- CreateIndex
CREATE INDEX "StockMovement_saleItemId_idx" ON "StockMovement"("saleItemId");
