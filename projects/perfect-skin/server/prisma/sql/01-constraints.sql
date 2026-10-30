-- Ограничения, которые Prisma не умеет объявить в схеме.
--
-- Как применять: после `prisma migrate dev --create-only` вставить содержимое
-- этого файла в конец сгенерированного migration.sql, ДО того как миграция
-- будет применена. Файл существует отдельно, чтобы правила не потерялись между
-- сессиями и были видны на ревью.
--
-- Смысл: это второй рубеж. Даже если весь сервисный слой переписать
-- неправильно, база не пустит заведомо невозможное состояние.

-- ─────────────── Уникальность с учётом мягкого удаления ───────────────
--
-- Обычный UNIQUE действует на всю таблицу, включая помеченные удалёнными
-- строки. Из-за этого удалённый товар навсегда занимает свой адрес, и
-- повторный импорт из старого WooCommerce упадёт на ограничении. То же с
-- почтой (клиент удалил аккаунт и не может завести новый) и с промокодом
-- (отозвали и переиздали код — старый блокирует новый).

CREATE UNIQUE INDEX users_email_active_key ON users (email) WHERE "deletedAt" IS NULL AND email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_active_key ON users (phone) WHERE "deletedAt" IS NULL AND phone IS NOT NULL;
CREATE UNIQUE INDEX categories_slug_active_key ON categories (slug) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX brands_slug_active_key ON brands (slug) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX product_lines_slug_active_key ON product_lines (slug) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX products_slug_active_key ON products (slug) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX posts_slug_active_key ON posts (slug) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX promo_codes_code_active_key ON promo_codes (code) WHERE "deletedAt" IS NULL;

-- ─────────────────────────── Деньги и количества ───────────────────────────

ALTER TABLE product_variants
  ADD CONSTRAINT variant_retail_price_nonneg CHECK ("retailPrice" >= 0),
  ADD CONSTRAINT variant_old_price_nonneg CHECK ("oldRetailPrice" IS NULL OR "oldRetailPrice" >= 0),
  ADD CONSTRAINT variant_stock_nonneg CHECK ("stock" >= 0),
  ADD CONSTRAINT variant_volume_positive CHECK ("volumeValue" > 0);

ALTER TABLE cart_items
  ADD CONSTRAINT cart_item_qty_positive CHECK (quantity > 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_item_qty_positive CHECK (quantity > 0),
  ADD CONSTRAINT order_item_price_nonneg CHECK (price >= 0);

ALTER TABLE orders
  ADD CONSTRAINT order_amounts_nonneg CHECK (
    "subtotal" >= 0 AND "total" >= 0 AND "promoDiscount" >= 0 AND "deliveryCost" >= 0
  ),
  -- Скидка не может превышать стоимость товаров.
  ADD CONSTRAINT order_discount_within_subtotal CHECK ("promoDiscount" <= "subtotal");

-- ────────────────────────────── Промокоды ──────────────────────────────

ALTER TABLE promo_codes
  ADD CONSTRAINT promo_percent_range CHECK ("percent" BETWEEN 1 AND 100),
  ADD CONSTRAINT promo_used_nonneg CHECK ("usedCount" >= 0),
  -- Даже при ошибке в сервисном слое счётчик не уйдёт за лимит.
  ADD CONSTRAINT promo_used_within_max CHECK (
    "maxRedemptions" IS NULL OR "usedCount" <= "maxRedemptions"
  ),
  ADD CONSTRAINT promo_min_order_nonneg CHECK (
    "minOrderAmount" IS NULL OR "minOrderAmount" >= 0
  ),
  ADD CONSTRAINT promo_period_valid CHECK (
    "startsAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt" > "startsAt"
  );

ALTER TABLE promo_code_redemptions
  ADD CONSTRAINT redemption_amounts_nonneg CHECK (
    "discountAmount" >= 0 AND "orderSubtotal" >= 0
  );

-- ─────────────────────────── Видеоотзывы ───────────────────────────
--
-- Публикуемость видеоотзыва: без согласия, проверки контента и готовых файлов
-- строка не может быть активной, даже если сервисный слой ошибётся. Срок
-- согласия проверяется в запросах: CHECK по времени невозможен.

ALTER TABLE video_reviews
  ADD CONSTRAINT video_review_consent_complete CHECK (
    NOT "consentConfirmed" OR ("consentConfirmedAt" IS NOT NULL AND "consentConfirmedById" IS NOT NULL)
  ),
  ADD CONSTRAINT video_review_review_complete CHECK (
    NOT "contentReviewed" OR ("contentReviewedAt" IS NOT NULL AND "contentReviewedById" IS NOT NULL)
  ),
  ADD CONSTRAINT video_review_active_ready CHECK (
    NOT "isActive" OR (
      "consentConfirmed" AND "consentDocPath" IS NOT NULL AND "consentAllowSite"
      AND "consentRevokedAt" IS NULL AND "contentReviewed"
      AND "mp4Url" IS NOT NULL AND "posterUrl" IS NOT NULL AND "deletedAt" IS NULL
    )
  ),
  ADD CONSTRAINT video_review_sort_nonneg CHECK ("sortOrder" >= 0);

-- ──────────────────────────────── СДЭК ────────────────────────────────

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_weight_positive CHECK ("weightGrams" IS NULL OR "weightGrams" > 0);

-- ──────────────────────────── Бьюти-клуб ────────────────────────────

-- Журнал бонусов: баланс и партии не уйдут в минус, даже если сервис ошибётся.
-- Частичный индекс для ночного сгорания — Prisma такой не объявляет.

ALTER TABLE "loyalty_settings"
  ADD CONSTRAINT loyalty_settings_singleton CHECK ("id" = 1),
  ADD CONSTRAINT loyalty_settings_ranges CHECK (
    "accrualPercent" BETWEEN 0 AND 100 AND "accrualDelayDays" BETWEEN 0 AND 60
    AND "kopecksPerBonus" BETWEEN 1 AND 10000 AND "maxSpendPercent" BETWEEN 0 AND 100
    AND "minOrderForSpend" >= 0 AND "bonusTtlDays" BETWEEN 0 AND 1825
    AND "refundMinTtlDays" BETWEEN 1 AND 365
    AND "welcomeBonus" >= 0 AND "welcomeTtlDays" BETWEEN 1 AND 365
    AND "reviewBonus" >= 0 AND "reviewTtlDays" BETWEEN 1 AND 365
    AND "expiryNoticeDaysBefore" BETWEEN 1 AND 30
  );

ALTER TABLE "bonus_accounts"
  ADD CONSTRAINT bonus_account_balance_nonneg CHECK ("balance" >= 0);

ALTER TABLE "bonus_transactions"
  ADD CONSTRAINT bonus_tx_amount_nonzero CHECK ("amount" <> 0),
  ADD CONSTRAINT bonus_tx_shape CHECK (
    ("amount" > 0
      AND "type" IN ('welcome','order_accrual','order_spend_refund','manual_adjustment','review','birthday')
      AND "remaining" IS NOT NULL AND "remaining" BETWEEN 0 AND "amount")
    OR
    ("amount" < 0
      AND "type" IN ('order_spend','order_accrual_reversal','expiration','manual_adjustment')
      AND "remaining" IS NULL AND "expiresAt" IS NULL)
  ),
  ADD CONSTRAINT bonus_tx_order_link CHECK (
    "type" NOT IN ('order_accrual','order_spend','order_spend_refund','order_accrual_reversal') OR "orderId" IS NOT NULL
  ),
  ADD CONSTRAINT bonus_tx_manual_audit CHECK (
    "type" <> 'manual_adjustment' OR ("createdById" IS NOT NULL AND "reason" IS NOT NULL AND char_length(btrim("reason")) BETWEEN 3 AND 300)
  );

ALTER TABLE "orders"
  ADD CONSTRAINT order_bonus_nonneg CHECK ("bonusSpent" >= 0 AND "bonusDiscount" >= 0 AND "bonusAccrualPlanned" >= 0),
  ADD CONSTRAINT order_bonus_pair CHECK (("bonusSpent" = 0) = ("bonusDiscount" = 0)),
  ADD CONSTRAINT order_bonus_within_goods CHECK ("bonusDiscount" <= "subtotal" - "promoDiscount");

CREATE INDEX IF NOT EXISTS bonus_tx_live_lots_idx ON bonus_transactions ("expiresAt") WHERE "remaining" > 0 AND "expiresAt" IS NOT NULL;

ALTER TABLE orders
  ADD CONSTRAINT orders_cdek_state_has_uuid CHECK (
    "cdekState" IS NULL OR "cdekState" IN ('creating', 'invalid') OR "cdekUuid" IS NOT NULL
  ),
  ADD CONSTRAINT orders_cdek_created_has_number CHECK (
    "cdekState" IS DISTINCT FROM 'created' OR "cdekNumber" IS NOT NULL
  );
