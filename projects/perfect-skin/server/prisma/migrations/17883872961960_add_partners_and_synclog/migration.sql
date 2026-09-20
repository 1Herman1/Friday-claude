-- CreateTable partners
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "commissionPercent" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_name_key" ON "partners"("name");

-- AddColumn partnerId to promo_codes
ALTER TABLE "promo_codes" ADD COLUMN "partnerId" TEXT;

-- CreateIndex for partnerId
CREATE INDEX "promo_codes_partnerId_idx" ON "promo_codes"("partnerId");

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable sync_logs
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "errorText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_logs_createdAt_idx" ON "sync_logs"("createdAt");
