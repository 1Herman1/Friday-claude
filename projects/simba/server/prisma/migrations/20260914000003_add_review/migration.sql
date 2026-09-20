-- Отзывы покупателей: модерация в админке, общие для всех товаров
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "reviews" (
  "id"         TEXT PRIMARY KEY,
  "authorName" TEXT NOT NULL,
  "rating"     INTEGER NOT NULL,
  "text"       TEXT NOT NULL,
  "photo"      TEXT,
  "status"     "ReviewStatus" NOT NULL DEFAULT 'pending',
  "userId"     TEXT,
  "productId"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE INDEX "reviews_status_createdAt_idx" ON "reviews"("status", "createdAt" DESC);
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");
CREATE INDEX "reviews_productId_idx" ON "reviews"("productId");
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
