-- AlterEnum "ConsultationStatus" — optional, already exists in schema
-- AlterEnum "ConsentPurpose"
ALTER TYPE "ConsentPurpose" ADD VALUE 'consultation';
ALTER TYPE "ConsentPurpose" ADD VALUE 'health_data';

-- AlterTable "consultation_requests"
ALTER TABLE "consultation_requests" ADD COLUMN "skinType" "SkinType",
ADD COLUMN "concern" TEXT,
ADD COLUMN "source" TEXT;
ALTER TABLE "consultation_requests" ADD COLUMN "consentVersion" TEXT,
ADD COLUMN "consentedAt" TIMESTAMP(3);
