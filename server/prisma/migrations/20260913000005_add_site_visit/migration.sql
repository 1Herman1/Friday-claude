-- Ежедневный счётчик уникальных посещений сайта
CREATE TABLE "site_visits" (
  "day"   DATE PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 0
);
