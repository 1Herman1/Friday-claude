-- AlterEnum "ConsentPurpose": значение только добавляется, здесь не используется
ALTER TYPE "ConsentPurpose" ADD VALUE 'account';

-- AlterTable "consultation_requests": когда персональные данные стёрты по сроку
ALTER TABLE "consultation_requests" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
