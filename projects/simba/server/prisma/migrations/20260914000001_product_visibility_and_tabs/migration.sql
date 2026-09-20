-- Ручное скрытие товара, которое синхронизация МойСклад не отменяет,
-- и переключатели вкладок страницы товара
ALTER TABLE "products"
ADD COLUMN "hiddenManually" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "showAboutTab"   BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showSpecsTab"   BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showReviewsTab" BOOLEAN NOT NULL DEFAULT true;
