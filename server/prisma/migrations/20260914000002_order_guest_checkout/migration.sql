-- Признак «заказ оформлен без входа» — для фильтра гости/пользователи на дашборде
ALTER TABLE "orders" ADD COLUMN "guestCheckout" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "orders_guestCheckout_idx" ON "orders"("guestCheckout");
