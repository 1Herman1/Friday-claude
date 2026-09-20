-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'professional';

-- CreateEnum
CREATE TYPE "ProStatus" AS ENUM ('none', 'pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "proStatus" "ProStatus" NOT NULL DEFAULT 'none',
  ADD COLUMN "companyName" TEXT,
  ADD COLUMN "inn" TEXT,
  ADD COLUMN "specialization" TEXT,
  ADD COLUMN "proRequestedAt" TIMESTAMP(3),
  ADD COLUMN "proReviewedAt" TIMESTAMP(3),
  ADD COLUMN "proReviewerId" TEXT,
  ADD COLUMN "proRejectReason" TEXT;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "wholesalePrice" INTEGER;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "isProfessional" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "products_isProfessional_idx" ON "products"("isProfessional");
