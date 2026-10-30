-- AlterEnum (значение не используется в этой же миграции)
ALTER TYPE "ConsentPurpose" ADD VALUE 'loyalty';

-- CreateEnum
CREATE TYPE "BonusTxType" AS ENUM ('welcome','order_accrual','order_spend','order_spend_refund','order_accrual_reversal','expiration','manual_adjustment','review','birthday');
CREATE TYPE "BonusAccrualBase" AS ENUM ('paid_goods','after_promo','gross');
CREATE TYPE "BonusAccrualTrigger" AS ENUM ('delivered','paid');
CREATE TYPE "MessageKind" AS ENUM ('service','advertising');

-- AlterTable: константные DEFAULT — без перезаписи таблицы (PG 11+)
ALTER TABLE "orders"
  ADD COLUMN "bonusSpent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusDiscount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusAccrualPlanned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusAccrualDueAt" TIMESTAMP(3),
  ADD COLUMN "bonusAccruedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "orders_bonusAccrualDueAt_idx" ON "orders"("bonusAccrualDueAt");

-- CreateTable
CREATE TABLE "loyalty_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "accrualPercent" INTEGER NOT NULL DEFAULT 5,
  "accrualBase" "BonusAccrualBase" NOT NULL DEFAULT 'paid_goods',
  "accrualTrigger" "BonusAccrualTrigger" NOT NULL DEFAULT 'delivered',
  "accrualDelayDays" INTEGER NOT NULL DEFAULT 0,
  "excludeProfessionalProducts" BOOLEAN NOT NULL DEFAULT true,
  "accrueWithPromo" BOOLEAN NOT NULL DEFAULT false,
  "kopecksPerBonus" INTEGER NOT NULL DEFAULT 100,
  "maxSpendPercent" INTEGER NOT NULL DEFAULT 30,
  "minOrderForSpend" INTEGER NOT NULL DEFAULT 0,
  "allowSpendWithPromo" BOOLEAN NOT NULL DEFAULT false,
  "bonusTtlDays" INTEGER NOT NULL DEFAULT 365,
  "refundMinTtlDays" INTEGER NOT NULL DEFAULT 30,
  "welcomeBonus" INTEGER NOT NULL DEFAULT 0,
  "welcomeTtlDays" INTEGER NOT NULL DEFAULT 60,
  "reviewBonus" INTEGER NOT NULL DEFAULT 0,
  "reviewTtlDays" INTEGER NOT NULL DEFAULT 90,
  "expiryNoticeKind" "MessageKind" NOT NULL DEFAULT 'advertising',
  "expiryNoticeDaysBefore" INTEGER NOT NULL DEFAULT 7,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedById" TEXT,
  CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "loyalty_settings_updatedById_idx" ON "loyalty_settings"("updatedById");

CREATE TABLE "loyalty_settings_changes" (
  "id" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_settings_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "loyalty_settings_changes_createdAt_idx" ON "loyalty_settings_changes"("createdAt");
CREATE INDEX "loyalty_settings_changes_changedById_idx" ON "loyalty_settings_changes"("changedById");

CREATE TABLE "bonus_accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "anonymizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bonus_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bonus_accounts_userId_key" ON "bonus_accounts"("userId");
CREATE INDEX "bonus_accounts_leftAt_idx" ON "bonus_accounts"("leftAt");

CREATE TABLE "bonus_transactions" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "BonusTxType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "remaining" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "orderId" TEXT,
  "idempotencyKey" TEXT,
  "reason" TEXT,
  "createdById" TEXT,
  "sourceMaxExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bonus_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bonus_transactions_idempotencyKey_key" ON "bonus_transactions"("idempotencyKey");
CREATE UNIQUE INDEX "bonus_transactions_orderId_type_key" ON "bonus_transactions"("orderId","type");
CREATE INDEX "bonus_transactions_accountId_createdAt_idx" ON "bonus_transactions"("accountId","createdAt");
CREATE INDEX "bonus_transactions_accountId_expiresAt_idx" ON "bonus_transactions"("accountId","expiresAt");
CREATE INDEX "bonus_transactions_orderId_idx" ON "bonus_transactions"("orderId");
CREATE INDEX "bonus_transactions_createdById_idx" ON "bonus_transactions"("createdById");
CREATE INDEX "bonus_transactions_createdAt_idx" ON "bonus_transactions"("createdAt");
-- Живые партии для ночного сгорания (Prisma частичные индексы не выражает)
CREATE INDEX bonus_tx_live_lots_idx ON bonus_transactions ("expiresAt") WHERE "remaining" > 0 AND "expiresAt" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loyalty_settings_changes" ADD CONSTRAINT "loyalty_settings_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bonus_accounts" ADD CONSTRAINT "bonus_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bonus_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK: дублируются в prisma/sql/01-constraints.sql
ALTER TABLE "loyalty_settings"
  ADD CONSTRAINT loyalty_settings_singleton CHECK ("id" = 1),
  ADD CONSTRAINT loyalty_settings_ranges CHECK (
    "accrualPercent" BETWEEN 0 AND 100 AND "accrualDelayDays" BETWEEN 0 AND 60
    AND "kopecksPerBonus" BETWEEN 1 AND 10000 AND "maxSpendPercent" BETWEEN 0 AND 100
    AND "minOrderForSpend" >= 0 AND "bonusTtlDays" BETWEEN 0 AND 1825
    AND "refundMinTtlDays" BETWEEN 1 AND 365
    AND "welcomeBonus" >= 0 AND "welcomeTtlDays" BETWEEN 1 AND 365
    AND "reviewBonus" >= 0 AND "reviewTtlDays" BETWEEN 1 AND 365
    AND "expiryNoticeDaysBefore" BETWEEN 1 AND 30
  );

ALTER TABLE "bonus_accounts"
  ADD CONSTRAINT bonus_account_balance_nonneg CHECK ("balance" >= 0);

ALTER TABLE "bonus_transactions"
  ADD CONSTRAINT bonus_tx_amount_nonzero CHECK ("amount" <> 0),
  ADD CONSTRAINT bonus_tx_shape CHECK (
    ("amount" > 0
      AND "type" IN ('welcome','order_accrual','order_spend_refund','manual_adjustment','review','birthday')
      AND "remaining" IS NOT NULL AND "remaining" BETWEEN 0 AND "amount")
    OR
    ("amount" < 0
      AND "type" IN ('order_spend','order_accrual_reversal','expiration','manual_adjustment')
      AND "remaining" IS NULL AND "expiresAt" IS NULL)
  ),
  ADD CONSTRAINT bonus_tx_order_link CHECK (
    "type" NOT IN ('order_accrual','order_spend','order_spend_refund','order_accrual_reversal') OR "orderId" IS NOT NULL
  ),
  ADD CONSTRAINT bonus_tx_manual_audit CHECK (
    "type" <> 'manual_adjustment' OR ("createdById" IS NOT NULL AND "reason" IS NOT NULL AND char_length(btrim("reason")) BETWEEN 3 AND 300)
  );

ALTER TABLE "orders"
  ADD CONSTRAINT order_bonus_nonneg CHECK ("bonusSpent" >= 0 AND "bonusDiscount" >= 0 AND "bonusAccrualPlanned" >= 0),
  ADD CONSTRAINT order_bonus_pair CHECK (("bonusSpent" = 0) = ("bonusDiscount" = 0)),
  ADD CONSTRAINT order_bonus_within_goods CHECK ("bonusDiscount" <= "subtotal" - "promoDiscount");

-- Строка настроек: программа выключена
INSERT INTO "loyalty_settings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
