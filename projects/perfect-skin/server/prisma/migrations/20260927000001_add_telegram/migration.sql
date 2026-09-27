-- CreateTable telegram_links
CREATE TABLE "telegram_links" (
  "userId" TEXT NOT NULL,
  "chatId" BIGINT NOT NULL,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "telegram_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- CreateIndex on telegram_links
CREATE UNIQUE INDEX "telegram_links_chatId_key" ON "telegram_links"("chatId");

-- CreateTable telegram_link_codes
CREATE TABLE "telegram_link_codes" (
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),

  CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("codeHash")
);

-- CreateIndex on telegram_link_codes
CREATE INDEX "telegram_link_codes_userId_idx" ON "telegram_link_codes"("userId");
CREATE INDEX "telegram_link_codes_expiresAt_idx" ON "telegram_link_codes"("expiresAt");

-- CreateTable doc_view_tokens
CREATE TABLE "doc_view_tokens" (
  "tokenHash" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "uses" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "doc_view_tokens_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex on doc_view_tokens
CREATE INDEX "doc_view_tokens_expiresAt_idx" ON "doc_view_tokens"("expiresAt");

-- CreateTable telegram_notices
CREATE TABLE "telegram_notices" (
  "id" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "chatId" BIGINT NOT NULL,
  "messageId" INTEGER NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "telegram_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on telegram_notices
CREATE INDEX "telegram_notices_applicantId_idx" ON "telegram_notices"("applicantId");
