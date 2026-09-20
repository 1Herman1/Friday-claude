-- Enum для статуса блог-поста
CREATE TYPE "BlogStatus" AS ENUM ('draft', 'published');

-- Таблица блог-постов с поддержкой категорий и SEO
CREATE TABLE "blog_posts" (
  "id"               TEXT PRIMARY KEY,
  "slug"             TEXT NOT NULL UNIQUE,
  "title"            TEXT NOT NULL,
  "subtitle"         TEXT,
  "body"             TEXT NOT NULL DEFAULT '',
  "categories"       TEXT[] NOT NULL DEFAULT '{}',
  "date"             TIMESTAMP(3) NOT NULL,
  "readingMinutes"   INTEGER NOT NULL DEFAULT 0,
  "status"           "BlogStatus" NOT NULL DEFAULT 'draft',
  "cover"            TEXT,
  "metaTitle"        TEXT,
  "metaDescription"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "blog_posts_status_idx" ON "blog_posts"("status");
CREATE INDEX "blog_posts_date_idx" ON "blog_posts"("date" DESC);
