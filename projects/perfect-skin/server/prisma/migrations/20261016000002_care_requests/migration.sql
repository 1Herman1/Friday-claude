-- AlterEnum "ConsentPurpose": значение только добавляется, здесь не используется
ALTER TYPE "ConsentPurpose" ADD VALUE 'care';

-- AlterTable "consultation_consents"
ALTER TABLE "consultation_consents" ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "form" TEXT;
