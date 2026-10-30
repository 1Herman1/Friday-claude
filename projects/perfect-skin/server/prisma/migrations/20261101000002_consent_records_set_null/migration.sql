-- Согласие переживает удаление пользователя как доказательство (как ConsultationConsent).
ALTER TABLE "consent_records" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_userId_fkey";
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "consent_records" VALIDATE CONSTRAINT "consent_records_userId_fkey";
