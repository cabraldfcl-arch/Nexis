-- Add traceable stock loss and cancellation/correction records.

ALTER TABLE "Purchase" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Purchase" ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "Sale" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Sale" ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "Expense" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Expense" ADD COLUMN "cancellationReason" TEXT;

CREATE TABLE "StockLoss" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitCostSnapshotCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "expenseId" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "lostAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    CONSTRAINT "StockLoss_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockLoss_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CancellationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "expenseId" TEXT,
    "stockLossId" TEXT,
    CONSTRAINT "CancellationEvent_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CancellationEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CancellationEvent_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CancellationEvent_stockLossId_fkey" FOREIGN KEY ("stockLossId") REFERENCES "StockLoss" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "StockMovement" ADD COLUMN "stockLossId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "cancellationEventId" TEXT;

CREATE UNIQUE INDEX "StockLoss_expenseId_key" ON "StockLoss"("expenseId");
CREATE INDEX "StockLoss_productId_idx" ON "StockLoss"("productId");
CREATE INDEX "StockLoss_lostAt_idx" ON "StockLoss"("lostAt");
CREATE INDEX "StockLoss_cancelledAt_idx" ON "StockLoss"("cancelledAt");

CREATE INDEX "CancellationEvent_targetType_idx" ON "CancellationEvent"("targetType");
CREATE INDEX "CancellationEvent_saleId_idx" ON "CancellationEvent"("saleId");
CREATE INDEX "CancellationEvent_purchaseId_idx" ON "CancellationEvent"("purchaseId");
CREATE INDEX "CancellationEvent_expenseId_idx" ON "CancellationEvent"("expenseId");
CREATE INDEX "CancellationEvent_stockLossId_idx" ON "CancellationEvent"("stockLossId");

CREATE INDEX "Purchase_cancelledAt_idx" ON "Purchase"("cancelledAt");
CREATE INDEX "Sale_cancelledAt_idx" ON "Sale"("cancelledAt");
CREATE INDEX "Expense_cancelledAt_idx" ON "Expense"("cancelledAt");
CREATE INDEX "StockMovement_stockLossId_idx" ON "StockMovement"("stockLossId");
CREATE INDEX "StockMovement_cancellationEventId_idx" ON "StockMovement"("cancellationEventId");
