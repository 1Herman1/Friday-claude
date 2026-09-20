-- Добавляем поля для управления содержимым баннера из админки:
-- subtitle — поясняющая строка под заголовком
-- buttonText — текст кнопки CTA (если кнопка вообще есть)
-- Оба необязательные, чтобы баннер мог быть и без кнопки

ALTER TABLE "banners" ADD COLUMN "subtitle" TEXT;
ALTER TABLE "banners" ADD COLUMN "buttonText" TEXT;
