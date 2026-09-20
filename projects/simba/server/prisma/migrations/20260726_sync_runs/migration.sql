-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('running', 'success', 'failed', 'aborted');

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'moysklad',
    "trigger" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'running',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsFromMs" INTEGER NOT NULL DEFAULT 0,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "priceUpdated" INTEGER NOT NULL DEFAULT 0,
    "stockUpdated" INTEGER NOT NULL DEFAULT 0,
    "productsActivated" INTEGER NOT NULL DEFAULT 0,
    "missingInMs" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "report" JSONB,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_runs_startedAt_idx" ON "sync_runs"("startedAt");

-- CreateIndex
CREATE INDEX "sync_runs_status_idx" ON "sync_runs"("status");
