-- Owner decision: retire in-store pickup, offer Ozon pickup points for free.
-- Data-only change so it reaches production with the deploy; the admin panel
-- stays authoritative for any later edits.
UPDATE "delivery_options" SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'pickup';
UPDATE "delivery_options" SET "isActive" = true,  "price" = 0, "expense" = 0, "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'ozon_pvz';
