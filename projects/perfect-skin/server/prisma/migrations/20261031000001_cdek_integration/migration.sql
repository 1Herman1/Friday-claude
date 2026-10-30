-- CreateEnum
CREATE TYPE "CdekSyncState" AS ENUM ('creating', 'accepted', 'created', 'invalid');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cdekCityCode" INTEGER,
ADD COLUMN     "cdekError" TEXT,
ADD COLUMN     "cdekNumber" TEXT,
ADD COLUMN     "cdekRequestedAt" TIMESTAMP(3),
ADD COLUMN     "cdekState" "CdekSyncState",
ADD COLUMN     "cdekStatusAt" TIMESTAMP(3),
ADD COLUMN     "cdekStatusCode" TEXT,
ADD COLUMN     "cdekStatusName" TEXT,
ADD COLUMN     "cdekTariffCode" INTEGER,
ADD COLUMN     "cdekUuid" TEXT,
ADD COLUMN     "deliveryPoint" JSONB,
ADD COLUMN     "deliveryQuote" JSONB,
ADD COLUMN     "trackEmailSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "weightGrams" INTEGER;

-- CreateTable
CREATE TABLE "cdek_status_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "city" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cdek_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_cdekUuid_key" ON "orders"("cdekUuid");

-- CreateIndex
CREATE UNIQUE INDEX "orders_cdekNumber_key" ON "orders"("cdekNumber");

-- CreateIndex
CREATE INDEX "orders_cdekState_status_idx" ON "orders"("cdekState", "status");

-- CreateIndex
CREATE INDEX "cdek_status_events_orderId_occurredAt_idx" ON "cdek_status_events"("orderId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "cdek_status_events_orderId_code_occurredAt_key" ON "cdek_status_events"("orderId", "code", "occurredAt");

-- AddForeignKey
ALTER TABLE "cdek_status_events" ADD CONSTRAINT "cdek_status_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check (mirrors prisma/sql/01-constraints.sql)
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_weight_positive" CHECK ("weightGrams" IS NULL OR "weightGrams" > 0);
