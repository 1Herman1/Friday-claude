SET lock_timeout = '3s';

ALTER TABLE "products" ADD COLUMN "autoQuizTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "products_autoQuizTags_idx" ON "products" USING GIN ("autoQuizTags");
