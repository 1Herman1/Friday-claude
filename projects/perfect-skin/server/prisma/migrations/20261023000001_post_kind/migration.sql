-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('article', 'news');

-- AlterTable: только добавляющие изменения; DEFAULT константный, PG16 не переписывает таблицу
ALTER TABLE "posts" ADD COLUMN     "advertiser" TEXT,
ADD COLUMN     "erid" TEXT,
ADD COLUMN     "isAd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "PostKind" NOT NULL DEFAULT 'article';

-- CreateIndex
CREATE INDEX "posts_kind_audience_publishedAt_idx" ON "posts"("kind", "audience", "publishedAt" DESC);
