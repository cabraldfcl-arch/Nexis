-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('UNIT', 'KG', 'GRAM', 'LITER', 'METER', 'SQUARE_METER', 'CUBIC_METER', 'BOX', 'SACK', 'BALE', 'PACKAGE', 'DOZEN');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MERCHANDISE_SUPPLIES', 'RENT', 'UTILITIES', 'TRANSPORT_LOGISTICS', 'PACKAGING_MATERIAL', 'MAINTENANCE', 'TAXES_FEES', 'LABOR', 'MARKETING', 'LOSS_WASTE', 'OTHER', 'ENERGY', 'WATER', 'INTERNET', 'TRANSPORT', 'PACKAGING', 'TAX');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'LOSS', 'REVERSAL');

-- CreateEnum
CREATE TYPE "EntryOrigin" AS ENUM ('MANUAL', 'ASSISTANT_TEXT', 'ASSISTANT_AI', 'VOICE_FUTURE', 'IMPORT');

-- CreateEnum
CREATE TYPE "ProductAliasSource" AS ENUM ('MANUAL', 'AI_CONFIRMED', 'IMPORT');

-- CreateEnum
CREATE TYPE "CancellationTargetType" AS ENUM ('SALE', 'PURCHASE', 'EXPENSE', 'STOCK_LOSS');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "category" TEXT,
    "unit" "ProductUnit" NOT NULL DEFAULT 'UNIT',
    "unitCostCents" INTEGER NOT NULL,
    "salePriceCents" INTEGER NOT NULL,
    "currentStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minimumStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "origin" "EntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAlias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "source" "ProductAliasSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "supplier" TEXT,
    "origin" "EntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "origin" "EntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "unitCostSnapshotCents" INTEGER NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "origin" "EntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLoss" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitCostSnapshotCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "expenseId" TEXT,
    "origin" "EntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "lostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "StockLoss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationEvent" (
    "id" TEXT NOT NULL,
    "targetType" "CancellationTargetType" NOT NULL,
    "reason" TEXT NOT NULL,
    "origin" "EntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "expenseId" TEXT,
    "stockLossId" TEXT,

    CONSTRAINT "CancellationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    "purchaseId" TEXT,
    "saleItemId" TEXT,
    "stockLossId" TEXT,
    "cancellationEventId" TEXT,
    "origin" "EntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_normalizedName_key" ON "Product"("normalizedName");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAlias_normalizedAlias_key" ON "ProductAlias"("normalizedAlias");

-- CreateIndex
CREATE INDEX "ProductAlias_productId_idx" ON "ProductAlias"("productId");

-- CreateIndex
CREATE INDEX "ProductAlias_normalizedAlias_idx" ON "ProductAlias"("normalizedAlias");

-- CreateIndex
CREATE INDEX "Purchase_productId_idx" ON "Purchase"("productId");

-- CreateIndex
CREATE INDEX "Purchase_purchasedAt_idx" ON "Purchase"("purchasedAt");

-- CreateIndex
CREATE INDEX "Purchase_cancelledAt_idx" ON "Purchase"("cancelledAt");

-- CreateIndex
CREATE INDEX "Sale_soldAt_idx" ON "Sale"("soldAt");

-- CreateIndex
CREATE INDEX "Sale_cancelledAt_idx" ON "Sale"("cancelledAt");

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
CREATE INDEX "Expense_cancelledAt_idx" ON "Expense"("cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockLoss_expenseId_key" ON "StockLoss"("expenseId");

-- CreateIndex
CREATE INDEX "StockLoss_productId_idx" ON "StockLoss"("productId");

-- CreateIndex
CREATE INDEX "StockLoss_lostAt_idx" ON "StockLoss"("lostAt");

-- CreateIndex
CREATE INDEX "StockLoss_cancelledAt_idx" ON "StockLoss"("cancelledAt");

-- CreateIndex
CREATE INDEX "CancellationEvent_targetType_idx" ON "CancellationEvent"("targetType");

-- CreateIndex
CREATE INDEX "CancellationEvent_saleId_idx" ON "CancellationEvent"("saleId");

-- CreateIndex
CREATE INDEX "CancellationEvent_purchaseId_idx" ON "CancellationEvent"("purchaseId");

-- CreateIndex
CREATE INDEX "CancellationEvent_expenseId_idx" ON "CancellationEvent"("expenseId");

-- CreateIndex
CREATE INDEX "CancellationEvent_stockLossId_idx" ON "CancellationEvent"("stockLossId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_purchaseId_idx" ON "StockMovement"("purchaseId");

-- CreateIndex
CREATE INDEX "StockMovement_saleItemId_idx" ON "StockMovement"("saleItemId");

-- CreateIndex
CREATE INDEX "StockMovement_stockLossId_idx" ON "StockMovement"("stockLossId");

-- CreateIndex
CREATE INDEX "StockMovement_cancellationEventId_idx" ON "StockMovement"("cancellationEventId");

-- AddForeignKey
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLoss" ADD CONSTRAINT "StockLoss_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLoss" ADD CONSTRAINT "StockLoss_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationEvent" ADD CONSTRAINT "CancellationEvent_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationEvent" ADD CONSTRAINT "CancellationEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationEvent" ADD CONSTRAINT "CancellationEvent_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationEvent" ADD CONSTRAINT "CancellationEvent_stockLossId_fkey" FOREIGN KEY ("stockLossId") REFERENCES "StockLoss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockLossId_fkey" FOREIGN KEY ("stockLossId") REFERENCES "StockLoss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_cancellationEventId_fkey" FOREIGN KEY ("cancellationEventId") REFERENCES "CancellationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

