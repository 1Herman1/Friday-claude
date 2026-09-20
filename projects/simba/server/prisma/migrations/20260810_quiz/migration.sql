SET lock_timeout = '3s';

ALTER TABLE "products" ADD COLUMN "quizTags" TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX "products_quizTags_idx" ON "products" USING GIN ("quizTags");

ALTER TYPE "BonusTxType" ADD VALUE 'quiz';

DROP TABLE IF EXISTS "questionnaires";
DROP TYPE IF EXISTS "QuestionnaireSpecies";

CREATE TYPE "QuizSpecies" AS ENUM ('cat', 'dog');

CREATE TABLE "quiz_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "species" "QuizSpecies" NOT NULL,
    "answers" JSONB NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT '{}',
    "resultProductIds" TEXT[] NOT NULL DEFAULT '{}',
    "relaxed" TEXT[] NOT NULL DEFAULT '{}',
    "bonusGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quiz_sessions_userId_idx" ON "quiz_sessions"("userId");
CREATE INDEX "quiz_sessions_createdAt_idx" ON "quiz_sessions"("createdAt");

ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
