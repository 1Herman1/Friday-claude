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
  ADD CONSTRAINT variant_retail_price_nonneg CHECK (retail_price >= 0),
  ADD CONSTRAINT variant_old_price_nonneg CHECK (old_retail_price IS NULL OR old_retail_price >= 0),
  ADD CONSTRAINT variant_stock_nonneg CHECK (stock >= 0),
  ADD CONSTRAINT variant_volume_positive CHECK (volume_value > 0);

ALTER TABLE cart_items
  ADD CONSTRAINT cart_item_qty_positive CHECK (quantity > 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_item_qty_positive CHECK (quantity > 0),
  ADD CONSTRAINT order_item_price_nonneg CHECK (price >= 0);

ALTER TABLE orders
  ADD CONSTRAINT order_amounts_nonneg CHECK (
    subtotal >= 0 AND total >= 0 AND promo_discount >= 0 AND delivery_cost >= 0
  ),
  -- Скидка не может превышать стоимость товаров.
  ADD CONSTRAINT order_discount_within_subtotal CHECK (promo_discount <= subtotal);

-- ────────────────────────────── Промокоды ──────────────────────────────

ALTER TABLE promo_codes
  ADD CONSTRAINT promo_percent_range CHECK (percent BETWEEN 1 AND 100),
  ADD CONSTRAINT promo_used_nonneg CHECK (used_count >= 0),
  -- Даже при ошибке в сервисном слое счётчик не уйдёт за лимит.
  ADD CONSTRAINT promo_used_within_max CHECK (
    max_redemptions IS NULL OR used_count <= max_redemptions
  ),
  ADD CONSTRAINT promo_min_order_nonneg CHECK (
    min_order_amount IS NULL OR min_order_amount >= 0
  ),
  ADD CONSTRAINT promo_period_valid CHECK (
    starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at
  );

ALTER TABLE promo_code_redemptions
  ADD CONSTRAINT redemption_amounts_nonneg CHECK (
    discount_amount >= 0 AND order_subtotal >= 0
  );
