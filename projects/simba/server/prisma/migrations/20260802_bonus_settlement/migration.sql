-- ALTER TABLE берёт ACCESS EXCLUSIVE: если кто-то держит открытую транзакцию
-- по orders, миграция встанет в очередь, а за ней встанет весь трафик заказов.
-- Лучше упасть за 3 секунды и повторить, чем заморозить магазин.
SET lock_timeout = '3s';

-- Add bonus settlement tracking columns
-- bonusEarnedCredited: tracks if bonusEarned has been credited to user balance
-- bonusUsedRefunded: tracks if bonusUsed has been refunded to user balance on cancellation

ALTER TABLE "orders" ADD COLUMN "bonusEarnedCredited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "bonusUsedRefunded" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing orders got bonusEarned credited at creation time (old logic),
-- so mark them as already credited to prevent double-crediting on first payment.
UPDATE "orders" SET "bonusEarnedCredited" = true;

-- Отменённые заказы по старому правилу списанное не возвращали, и вернуть его
-- теперь задним числом нельзя — деньги за них уже посчитаны. Помечаем возврат
-- закрытым, иначе повторная отмена из истории раздаст бонусы заново.
UPDATE "orders" SET "bonusUsedRefunded" = true WHERE "status" = 'cancelled';
