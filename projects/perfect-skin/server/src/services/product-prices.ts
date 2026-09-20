// Пересчёт денормализованных Product.minPrice/maxPrice.
// Контракт 5.2Б: вызывается сидом, импортом и любой записью ProductVariant
// (админка следующего этапа) — поэтому живёт отдельной функцией, а не в сиде.
type Tx = {
  $executeRaw: (...args: any[]) => Promise<number>
}

export async function recalcProductPrices(tx: Tx, productId?: string): Promise<void> {
  // Одним SQL вместо цикла: агрегат по активным фасовкам, товары без живых
  // фасовок получают 0 (в каталоге они всё равно отфильтрованы).
  if (productId) {
    await tx.$executeRaw`
      UPDATE products p SET
        "minPrice" = COALESCE(v.min_price, 0),
        "maxPrice" = COALESCE(v.max_price, 0)
      FROM (
        SELECT MIN("retailPrice") AS min_price, MAX("retailPrice") AS max_price
        FROM product_variants
        WHERE "productId" = ${productId} AND "isActive" AND "deletedAt" IS NULL
      ) v
      WHERE p.id = ${productId}`
  } else {
    await tx.$executeRaw`
      UPDATE products p SET
        "minPrice" = COALESCE(v.min_price, 0),
        "maxPrice" = COALESCE(v.max_price, 0)
      FROM (
        SELECT "productId", MIN("retailPrice") AS min_price, MAX("retailPrice") AS max_price
        FROM product_variants
        WHERE "isActive" AND "deletedAt" IS NULL
        GROUP BY "productId"
      ) v
      WHERE p.id = v."productId"`
    await tx.$executeRaw`
      UPDATE products SET "minPrice" = 0, "maxPrice" = 0
      WHERE id NOT IN (
        SELECT DISTINCT "productId" FROM product_variants
        WHERE "isActive" AND "deletedAt" IS NULL
      )`
  }
}
