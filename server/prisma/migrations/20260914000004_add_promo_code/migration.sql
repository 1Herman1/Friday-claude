-- Промокоды: словарь в базе вместо зашитого SIMBA10, скидка считается только на сервере
CREATE TYPE "PromoType" AS ENUM ('percent', 'fixed');

CREATE TABLE "promo_codes" (
  "id"           TEXT PRIMARY KEY,
  "code"         TEXT NOT NULL UNIQUE,
  "type"         "PromoType" NOT NULL,
  "value"        INTEGER NOT NULL,
  "minSubtotal"  INTEGER,
  "startsAt"     TIMESTAMP(3),
  "endsAt"       TIMESTAMP(3),
  "maxUses"      INTEGER,
  "usedCount"    INTEGER NOT NULL DEFAULT 0,
  "perUserLimit" INTEGER,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "comment"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promo_codes_value_check" CHECK ("value" > 0 AND ("type" <> 'percent' OR "value" <= 100))
);
CREATE INDEX "promo_codes_isActive_idx" ON "promo_codes"("isActive");

-- Снапшот кода и скидки в заказе; ссылка на промокод обнуляется при его удалении
ALTER TABLE "orders"
ADD COLUMN "promoCode"   TEXT,
ADD COLUMN "promoCodeId" TEXT,
ADD COLUMN "discount"    INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "orders_promoCodeId_idx" ON "orders"("promoCodeId");
ALTER TABLE "orders" ADD CONSTRAINT "orders_promoCodeId_fkey"
  FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
