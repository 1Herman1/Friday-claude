-- Add contact fields for guest checkout
ALTER TABLE "orders" ADD COLUMN "contactName" TEXT;
ALTER TABLE "orders" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "orders" ADD COLUMN "contactPhone" TEXT;
