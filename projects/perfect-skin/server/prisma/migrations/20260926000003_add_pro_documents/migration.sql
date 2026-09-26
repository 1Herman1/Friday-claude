-- CreateEnum
CREATE TYPE "ProDecisionSource" AS ENUM ('auto_msp', 'manual');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "proDecisionSource" "ProDecisionSource",
ADD COLUMN "proCheck" JSONB,
ADD COLUMN "ogrnip" TEXT;

-- CreateTable
CREATE TABLE "pro_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAfter" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pro_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_documents_deleteAfter_idx" ON "pro_documents"("deleteAfter");

-- CreateIndex
CREATE INDEX "pro_documents_userId_idx" ON "pro_documents"("userId");

-- AddForeignKey
ALTER TABLE "pro_documents" ADD CONSTRAINT "pro_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex for conditional unique constraint on users(inn) where approved
CREATE UNIQUE INDEX "users_inn_approved_key" ON "users"("inn") WHERE "proStatus" = 'approved' AND "deletedAt" IS NULL;
