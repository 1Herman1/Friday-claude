-- Прайс-лист доставки под управлением админки.
CREATE TABLE "delivery_options" (
  "key"       TEXT PRIMARY KEY,
  "title"     TEXT NOT NULL,
  "subtitle"  TEXT,
  "price"     INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Тарифы владельца на день запуска. Ozon выключен до появления списка пунктов.
INSERT INTO "delivery_options" ("key", "title", "subtitle", "price", "isActive", "sortOrder") VALUES
  ('simba_courier', 'Курьер Simba',    'До двери по Москве',    70000, true,  10),
  ('cdek_pvz',      'СДЭК',            'Пункт выдачи',           9900, true,  20),
  ('yandex_pvz',    'Яндекс Доставка', 'Пункт выдачи',              0, true,  30),
  ('ozon_pvz',      'Ozon',            'Пункт выдачи',              0, false, 40),
  ('pickup',        'Самовывоз',       'Магазин на ул. Ленина, 12', 0, true,  50);
