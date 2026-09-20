-- AddColumn popularPin to Product
ALTER TABLE "products" ADD COLUMN "popularPin" INTEGER;

-- CreateIndex on popularPin
CREATE INDEX "products_popularPin_idx" ON "products"("popularPin");
