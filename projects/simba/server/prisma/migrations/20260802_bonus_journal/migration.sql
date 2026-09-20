-- ALTER TABLE берёт ACCESS EXCLUSIVE: лучше упасть за 3 секунды и повторить,
-- чем встать в очередь за чужой транзакцией и заморозить заказы.
SET lock_timeout = '3s';

-- Способ оплаты. По умолчанию карта: все существующие заказы оформлялись
-- до появления наличных курьеру.
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'cash_on_delivery');
ALTER TABLE "orders" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'card';

-- Возврат остатка на склад при отмене — защёлка от повторного возврата.
-- Старым отменённым заказам ставим true: их остаток уже не вернуть задним
-- числом, а повторная отмена иначе нарисовала бы несуществующий товар.
ALTER TABLE "orders" ADD COLUMN "stockRestored" BOOLEAN NOT NULL DEFAULT false;
UPDATE "orders" SET "stockRestored" = true WHERE "status" = 'cancelled';

-- id документа возврата в МойСклад, если его удалось создать
ALTER TABLE "orders" ADD COLUMN "msReturnId" TEXT;

-- Приветственные бонусы выдаются один раз за всю жизнь аккаунта.
-- Существующим пользователям ставим true: они регистрировались без акции,
-- иначе первый же вход раздал бы им по 300 бонусов задним числом.
ALTER TABLE "users" ADD COLUMN "welcomeBonusGranted" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "welcomeBonusGranted" = true;

-- Журнал движений бонусов
CREATE TYPE "BonusTxType" AS ENUM ('welcome', 'earned', 'spent', 'refund_used', 'revoke_earned', 'admin_adjust');

CREATE TABLE "bonus_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "BonusTxType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bonus_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bonus_transactions_userId_createdAt_idx" ON "bonus_transactions"("userId", "createdAt");
CREATE INDEX "bonus_transactions_orderId_idx" ON "bonus_transactions"("orderId");

ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Журнал начинается с нуля: движения до этой миграции нигде не сохранялись,
-- восстановить их из текущего баланса невозможно. Стартовый баланс каждого
-- пользователя фиксируем одной строкой, иначе история не сойдётся с балансом.
INSERT INTO "bonus_transactions" ("id", "userId", "type", "amount", "balanceAfter", "comment", "createdAt")
SELECT gen_random_uuid()::text, "id", 'admin_adjust', "bonusPoints", "bonusPoints",
       'Баланс на момент запуска журнала', now()
FROM "users" WHERE "bonusPoints" <> 0;
