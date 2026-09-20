-- Добавляем поля для сроков доставки и условия бесплатной доставки
ALTER TABLE "delivery_options"
ADD COLUMN "etaMin" INTEGER,
ADD COLUMN "etaMax" INTEGER,
ADD COLUMN "freeFrom" INTEGER;

-- Backfill ETA значения на основе текущих констант в коде
UPDATE "delivery_options" SET "etaMin" = 0, "etaMax" = 0 WHERE "key" = 'simba_courier';
UPDATE "delivery_options" SET "etaMin" = 2, "etaMax" = 5 WHERE "key" = 'cdek_pvz';
UPDATE "delivery_options" SET "etaMin" = 1, "etaMax" = 3 WHERE "key" = 'yandex_pvz';
UPDATE "delivery_options" SET "etaMin" = 2, "etaMax" = 4 WHERE "key" = 'ozon_pvz';
UPDATE "delivery_options" SET "etaMin" = 0, "etaMax" = 0 WHERE "key" = 'pickup';
