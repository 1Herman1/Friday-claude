-- Управляемые текстовые строки для сайта (СМС, заголовки, описания)
CREATE TABLE "site_texts" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "group"     TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "site_texts_group_idx" ON "site_texts"("group");
