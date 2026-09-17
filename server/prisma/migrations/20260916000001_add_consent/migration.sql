-- Согласие на обработку персональных данных
CREATE TYPE "ConsentKind" AS ENUM ('pd_processing', 'review_publication', 'withdrawal');

CREATE TABLE "consents" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT,
  "orderId"     TEXT,
  "reviewId"    TEXT,
  "kind"        "ConsentKind" NOT NULL,
  "textVersion" VARCHAR(64) NOT NULL,
  "ip"          VARCHAR(45),
  "userAgent"   VARCHAR(512),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "consents_userId_kind_createdAt_idx" ON "consents"("userId", "kind", "createdAt" DESC);
CREATE INDEX "consents_orderId_idx" ON "consents"("orderId");
CREATE INDEX "consents_reviewId_idx" ON "consents"("reviewId");
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Обезличивание пользователя
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
