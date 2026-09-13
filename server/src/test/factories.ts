import type { FastifyInstance } from 'fastify'
import type { UserRole } from '@prisma/client'
import { getTestPrisma } from './setup'

let counter = 0
function uniq(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}`
}

export async function createUser(opts: { bonusPoints?: number; name?: string } = {}) {
  const prisma = getTestPrisma()
  return prisma.user.create({
    data: {
      name: opts.name ?? 'Тестовый покупатель',
      email: `${uniq('user')}@example.test`,
      bonusPoints: opts.bonusPoints ?? 0,
    },
  })
}

/** Цена и остаток со значениями по умолчанию: тестам про рейтинг продаж и
    подбор они безразличны, а требовать их значило заставлять каждый вызов
    придумывать неважные числа. */
export async function createProductWithVariant(opts: {
  price?: number
  stock?: number
  weight?: number
  name?: string
  species?: 'cat' | 'dog' | 'both' | 'unknown'
} = {}) {
  const prisma = getTestPrisma()
  const name = opts.name ?? 'Корм тестовый'
  const product = await prisma.product.create({
    data: {
      name,
      slug: uniq('product'),
      description: 'Товар для интеграционных тестов',
      species: opts.species ?? 'unknown',
      variants: {
        create: {
          price: opts.price ?? 99900,
          stock: opts.stock ?? 100,
          weight: opts.weight ?? 1,
        },
      },
    },
    include: { variants: true },
  })

  return { product, variant: product.variants[0] }
}

export async function createCart(
  userId: string,
  items: { variantId: string; quantity: number }[]
) {
  const prisma = getTestPrisma()
  const cart = await prisma.cart.create({ data: { userId } })

  for (const item of items) {
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: item.variantId },
    })
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productVariantId: variant.id,
        productId: variant.productId,
        quantity: item.quantity,
      },
    })
  }

  return cart
}

/**
 * Гостевая сессия через настоящий роут: POST /api/auth/guest-session.
 * Возвращает и заголовок, и id гостевого пользователя — гостю в БД принадлежит
 * корзина, а заказ достаётся другому (реальному) пользователю, найденному по email.
 *
 * `ip` подменяет адрес клиента: rate-limit гостевых сессий и заказов живёт в
 * памяти процесса и ключуется по IP, поэтому тесты, идущие с одного адреса,
 * влияли бы друг на друга.
 */
export async function createGuestSession(app: FastifyInstance, ip?: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/guest-session',
    remoteAddress: ip,
  })

  if (res.statusCode !== 200) {
    throw new Error(`guest-session вернул ${res.statusCode}: ${res.body}`)
  }

  const { token } = res.json() as { token: string }
  const decoded = app.jwt.decode<{ userId: string; type: string }>(token)

  if (!decoded) {
    throw new Error('Гостевой токен не декодируется')
  }

  return {
    token,
    userId: decoded.userId,
    headers: { authorization: `Bearer ${token}` },
  }
}

export function authHeader(
  app: FastifyInstance,
  userId: string,
  role: UserRole = 'customer'
) {
  const token = app.jwt.sign({ userId, role })
  return { authorization: `Bearer ${token}` }
}

export async function createPromoCode(opts: {
  code?: string
  type?: 'percent' | 'fixed'
  value?: number
  minSubtotal?: number | null
  startsAt?: Date | null
  endsAt?: Date | null
  maxUses?: number | null
  perUserLimit?: number | null
  isActive?: boolean
} = {}) {
  const prisma = getTestPrisma()
  return prisma.promoCode.create({
    data: {
      code: opts.code ?? 'TEST' + Math.random().toString(36).substring(7).toUpperCase(),
      type: opts.type ?? 'percent',
      value: opts.value ?? 10,
      minSubtotal: opts.minSubtotal ?? null,
      startsAt: opts.startsAt ?? null,
      endsAt: opts.endsAt ?? null,
      maxUses: opts.maxUses ?? null,
      perUserLimit: opts.perUserLimit ?? null,
      isActive: opts.isActive ?? true,
    },
  })
}

export async function seedDeliveryOptions() {
  const prisma = getTestPrisma()
  // Вставить или обновить стандартные опции доставки
  await prisma.deliveryOption.upsert({
    where: { key: 'simba_courier' },
    create: { key: 'simba_courier', title: 'Курьер Simba', price: 70000, expense: 25000, isActive: true, sortOrder: 0 },
    update: { isActive: true, price: 70000, expense: 25000, sortOrder: 0 },
  })
  await prisma.deliveryOption.upsert({
    where: { key: 'cdek_pvz' },
    create: { key: 'cdek_pvz', title: 'СДЭК', price: 9900, expense: 0, isActive: true, sortOrder: 1 },
    update: { isActive: true, price: 9900, expense: 0, sortOrder: 1 },
  })
  await prisma.deliveryOption.upsert({
    where: { key: 'yandex_pvz' },
    create: { key: 'yandex_pvz', title: 'Яндекс Доставка', price: 0, expense: 0, isActive: true, sortOrder: 2 },
    update: { isActive: true, price: 0, expense: 0, sortOrder: 2 },
  })
  await prisma.deliveryOption.upsert({
    where: { key: 'ozon_pvz' },
    create: { key: 'ozon_pvz', title: 'Ozon', price: 0, expense: 0, isActive: false, sortOrder: 3 },
    update: { isActive: false, price: 0, expense: 0, sortOrder: 3 },
  })
  await prisma.deliveryOption.upsert({
    where: { key: 'pickup' },
    create: { key: 'pickup', title: 'Самовывоз', price: 0, expense: 0, isActive: true, sortOrder: 4 },
    update: { isActive: true, price: 0, expense: 0, sortOrder: 4 },
  })
}
