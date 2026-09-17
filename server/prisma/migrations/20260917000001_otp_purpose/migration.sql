-- Назначение одноразового кода: код входа, удаления аккаунта и смены почты больше не взаимозаменяемы
CREATE TYPE "OtpPurpose" AS ENUM ('login', 'delete', 'email_change');

ALTER TABLE "otp_codes"
ADD COLUMN "purpose" "OtpPurpose" NOT NULL DEFAULT 'login',
ADD COLUMN "target"  TEXT;

-- Выборка verifyOtp: владелец + сценарий + хеш кода
CREATE INDEX "otp_codes_userId_purpose_code_idx" ON "otp_codes"("userId", "purpose", "code");
