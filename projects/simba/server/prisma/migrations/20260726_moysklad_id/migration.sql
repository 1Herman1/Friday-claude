-- AddColumn moyskladId к ProductVariant
ALTER TABLE "product_variants" ADD COLUMN "moyskladId" TEXT;
CREATE UNIQUE INDEX "product_variants_moyskladId_key" ON "product_variants"("moyskladId");
