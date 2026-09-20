SET lock_timeout = '3s';

-- Вид животного у ТОВАРА. Отдельный тип, а не PetSpecies: тот описывает
-- питомца покупателя, и значения both/unknown были бы там невозможными
-- состояниями, а other в нём означает «хомяк/попугай», не «неизвестно».
CREATE TYPE "ProductSpecies" AS ENUM ('cat', 'dog', 'both', 'unknown');

-- NOT NULL DEFAULT 'unknown', а не nullable: с NULL условие вида
-- "species <> 'cat'" молча отбрасывало бы неразмеченные товары (трёхзначная
-- логика SQL), и они исчезали бы из выдачи незаметно. На PostgreSQL 11+
-- ADD COLUMN с NOT NULL DEFAULT не переписывает таблицу.
ALTER TABLE "products" ADD COLUMN "species" "ProductSpecies" NOT NULL DEFAULT 'unknown';

-- Запрос каталога — «товары этого вида, которые в продаже». Левый префикс
-- обслуживает и фильтр по одному species.
CREATE INDEX "products_species_isActive_idx" ON "products"("species", "isActive");

-- Как вписывать логотип в плитку бренда. Раньше — захардкоженная карта
-- LOGO_GROUPS в client/src/components/home/BrandsSection.tsx.
CREATE TYPE "BrandLogoFit" AS ENUM ('wide', 'mid', 'mark');

ALTER TABLE "brands" ADD COLUMN "logoFit" "BrandLogoFit";

-- Фирменный цвет бренда для заливки плитки на главной. В БД, а не в коде:
-- hex вне палитры проекта помечается WARNING линтером design-lint.mjs.
ALTER TABLE "brands" ADD COLUMN "accentColor" TEXT;

-- CHECK в schema.prisma невыразим, поэтому ограничение живёт только здесь
-- (тот же компромисс уже принят в 20260819075814_subscription_stage1).
-- Без него кривое значение из админки ломает inline-стиль молча, а не ошибкой.
-- Только #RRGGBB: сокращённый #ABC и восьмизначный с альфа-каналом отвергаются.
ALTER TABLE "brands" ADD CONSTRAINT "brands_accentColor_format_check"
  CHECK ("accentColor" IS NULL OR "accentColor" ~ '^#[0-9A-Fa-f]{6}$');
