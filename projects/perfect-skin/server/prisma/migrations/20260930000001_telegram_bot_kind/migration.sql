-- CreateEnum for TelegramBotKind
CREATE TYPE "TelegramBotKind" AS ENUM ('pro', 'orders');

-- AlterTable TelegramLink: add botKind column, change PK to composite (userId, botKind)
ALTER TABLE "telegram_links"
  ADD COLUMN "botKind" "TelegramBotKind" NOT NULL DEFAULT 'pro';

-- Уникальность chatId была индексом, а не ограничением: снимаем именно индекс,
-- иначе один человек не привяжет второй бот тем же чатом.
DROP INDEX IF EXISTS "telegram_links_chatId_key";
ALTER TABLE "telegram_links" DROP CONSTRAINT IF EXISTS "telegram_links_pkey";

-- Add composite primary key (userId, botKind)
ALTER TABLE "telegram_links"
  ADD CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("userId", "botKind");

-- Add composite unique constraint (chatId, botKind)
CREATE UNIQUE INDEX "telegram_links_chatId_botKind_key" ON "telegram_links"("chatId", "botKind");

-- AlterTable TelegramLinkCode: add botKind column
ALTER TABLE "telegram_link_codes"
  ADD COLUMN "botKind" "TelegramBotKind" NOT NULL DEFAULT 'pro';
