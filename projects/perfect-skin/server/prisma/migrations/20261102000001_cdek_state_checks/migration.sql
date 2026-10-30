-- Состояние передачи в СДЭК согласовано с идентификаторами: accepted и created без uuid или номера не записываются.
-- NOT VALID + VALIDATE: сначала новые строки, потом проверка старых без долгой блокировки таблицы.
ALTER TABLE "orders" ADD CONSTRAINT "orders_cdek_state_has_uuid" CHECK (
  "cdekState" IS NULL OR "cdekState" IN ('creating', 'invalid') OR "cdekUuid" IS NOT NULL
) NOT VALID;
ALTER TABLE "orders" VALIDATE CONSTRAINT "orders_cdek_state_has_uuid";

ALTER TABLE "orders" ADD CONSTRAINT "orders_cdek_created_has_number" CHECK (
  "cdekState" IS DISTINCT FROM 'created' OR "cdekNumber" IS NOT NULL
) NOT VALID;
ALTER TABLE "orders" VALIDATE CONSTRAINT "orders_cdek_created_has_number";
