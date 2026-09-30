-- CreateTable
CREATE TABLE "consultation_consents" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT,
    "purpose" "ConsentPurpose" NOT NULL,
    "textVersion" TEXT NOT NULL,
    "ip" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultation_consents_consultationId_idx" ON "consultation_consents"("consultationId");

-- AddForeignKey
ALTER TABLE "consultation_consents" ADD CONSTRAINT "consultation_consents_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
