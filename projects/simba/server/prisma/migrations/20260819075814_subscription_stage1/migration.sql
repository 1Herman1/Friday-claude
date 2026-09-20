-- AddColumn CartItem.isSubscription
ALTER TABLE "cart_items" ADD COLUMN "isSubscription" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn CartItem.subscriptionIntervalDays
ALTER TABLE "cart_items" ADD COLUMN "subscriptionIntervalDays" INTEGER;

-- Drop old unique index on CartItem
DROP INDEX "cart_items_cartId_productVariantId_key";

-- Add new unique index with isSubscription
CREATE UNIQUE INDEX "cart_items_cartId_productVariantId_isSubscription_key" ON "cart_items"("cartId", "productVariantId", "isSubscription");

-- AddColumn OrderItem.isSubscription
ALTER TABLE "order_items" ADD COLUMN "isSubscription" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn OrderItem.subscriptionId
ALTER TABLE "order_items" ADD COLUMN "subscriptionId" TEXT;

-- AddColumn Subscription.deliveryMethod
ALTER TABLE "subscriptions" ADD COLUMN "deliveryMethod" "DeliveryMethod";

-- AddColumn Subscription.deliveryAddress
ALTER TABLE "subscriptions" ADD COLUMN "deliveryAddress" JSONB;

-- AddColumn Subscription.isPaused
ALTER TABLE "subscriptions" ADD COLUMN "isPaused" BOOLEAN NOT NULL DEFAULT false;

-- Заменяем отдельные userId/isActive индексы на составной под запрос
-- "мои активные подписки, свежие сверху" (GET /api/subscriptions).
DROP INDEX "subscriptions_userId_idx";
DROP INDEX "subscriptions_isActive_idx";
CREATE INDEX "subscriptions_userId_isActive_createdAt_idx" ON "subscriptions"("userId", "isActive", "createdAt" DESC);

-- Уникальность userId+productVariantId только среди АКТИВНЫХ подписок — частичный
-- индекс: отмена (isActive=false) не блокирует повторную подписку на тот же вариант.
-- Не выразим через @@unique в schema.prisma (Prisma не поддерживает WHERE в unique),
-- поэтому не декларирован там — источник истины только эта миграция.
CREATE UNIQUE INDEX "subscriptions_userId_productVariantId_active_key"
  ON "subscriptions"("userId", "productVariantId")
  WHERE "isActive" = true;
