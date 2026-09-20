// Пересчитывает minPrice/maxPrice для всех товаров
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'

const prisma = new PrismaClient()

console.log('Пересчитываем минимальные и максимальные цены...')

await prisma.$executeRaw`
  UPDATE products p SET
    "minPrice" = COALESCE(v.min_price, 0),
    "maxPrice" = COALESCE(v.max_price, 0)
  FROM (
    SELECT "productId", MIN("retailPrice") AS min_price, MAX("retailPrice") AS max_price
    FROM product_variants
    WHERE "isActive" AND "deletedAt" IS NULL AND "isProfessional" = false
    GROUP BY "productId"
  ) v
  WHERE p.id = v."productId"`

await prisma.$executeRaw`
  UPDATE products SET "minPrice" = 0, "maxPrice" = 0
  WHERE id NOT IN (
    SELECT DISTINCT "productId" FROM product_variants
    WHERE "isActive" AND "deletedAt" IS NULL AND "isProfessional" = false
  )`

console.log('Готово!')
await prisma.$disconnect()
