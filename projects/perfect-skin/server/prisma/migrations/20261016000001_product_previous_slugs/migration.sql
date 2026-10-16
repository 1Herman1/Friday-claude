-- AlterTable
ALTER TABLE "products" ADD COLUMN "previousSlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- перенос записи из прежнего словаря slug-aliases.ts
UPDATE "products" SET "previousSlugs" = ARRAY['veevenom-serum-syvorotka-pchelinyj-yad'] WHERE "slug" = 'beevenom-serum-syvorotka-pchelinyj-yad' AND "deletedAt" IS NULL AND NOT ('veevenom-serum-syvorotka-pchelinyj-yad' = ANY("previousSlugs"));
