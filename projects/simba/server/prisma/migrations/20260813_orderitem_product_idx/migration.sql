SET lock_timeout = '3s';

CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");
