-- Дерево категорий «Вид → Тип → Назначение»: уровень и вид животного у категории
CREATE TYPE "CategoryKind" AS ENUM ('species', 'type', 'purpose');

ALTER TABLE "categories"
ADD COLUMN "kind" "CategoryKind",
ADD COLUMN "species" "ProductSpecies";

CREATE INDEX "categories_kind_idx" ON "categories"("kind");
