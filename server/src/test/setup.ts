import { PrismaClient } from '@prisma/client'

/**
 * Защита от катастрофы.
 *
 * Эти тесты чистят таблицы. Запуск против боевой базы уничтожит магазин,
 * поэтому проверки идут ДО любого обращения к БД и до создания PrismaClient.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL

export const hasTestDb = Boolean(testDatabaseUrl)

export const skipReason =
  'ПРОПУСК: интеграционные тесты требуют переменную TEST_DATABASE_URL ' +
  '(отдельная база с именем, оканчивающимся на _test). Без неё они не запускаются.'

if (!hasTestDb) {
  console.warn(`\n${skipReason}\n`)
}

function assertSafeTestDatabase(url: string) {
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL) {
    throw new Error(
      'Отказ: TEST_DATABASE_URL совпадает с DATABASE_URL — это боевая база'
    )
  }

  let dbName: string
  try {
    dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
  } catch {
    throw new Error('Отказ: TEST_DATABASE_URL не является корректным URL')
  }

  if (!dbName.endsWith('_test')) {
    throw new Error('Отказ: имя тестовой базы должно оканчиваться на _test')
  }
}

let prismaSingleton: PrismaClient | null = null

if (hasTestDb) {
  assertSafeTestDatabase(testDatabaseUrl!)
  // Приложение (plugins/prisma.ts) читает DATABASE_URL — подменяем на тестовую
  // уже ПОСЛЕ всех проверок.
  process.env.DATABASE_URL = testDatabaseUrl!
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
  process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
  process.env.ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5174'

  prismaSingleton = new PrismaClient({
    datasources: { db: { url: testDatabaseUrl! } },
  })
}

export function getTestPrisma(): PrismaClient {
  if (!prismaSingleton) {
    throw new Error(skipReason)
  }
  return prismaSingleton
}

const TABLES = [
  'order_items',
  'orders',
  'cart_items',
  'carts',
  'favorites',
  'comparison_products',
  'comparisons',
  'subscriptions',
  'product_filter_values',
  'product_categories',
  'product_variants',
  'products',
  'categories',
  'brands',
  'category_filters',
  'filter_values',
  'filters',
  'addresses',
  'pets',
  'otp_codes',
  'chat_messages',
  'users',
  'delivery_options',
  'site_texts',
  'blog_posts',
  'site_visits',
  'reviews',
  'consents',
  'promo_codes',
]

export async function resetDb() {
  const prisma = getTestPrisma()
  const list = TABLES.map((t) => `"public"."${t}"`).join(', ')

  // Создание заказа догоняет расчёт расхода на доставку уже после ответа 201,
  // и эта фоновая запись сталкивается с TRUNCATE следующего теста — Postgres
  // сообщает о взаимной блокировке (40P01) и роняет случайные тесты. Ждём
  // блокировку недолго и повторяем: к этому моменту фоновая запись завершается.
  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.$executeRawUnsafe(`SET LOCAL lock_timeout = '2s'`)
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
      return
    } catch (err) {
      const code = (err as { code?: string; meta?: { code?: string } }).meta?.code
      const deadlocked = code === '40P01' || code === '55P03' || String(err).includes('40P01')
      if (!deadlocked || attempt >= 4) throw err
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
}

export async function closeTestPrisma() {
  if (prismaSingleton) await prismaSingleton.$disconnect()
}
