import { PrismaClient } from '@prisma/client'
import { hasStock, isSellableByPrice } from '@simba/shared'

const cartInclude = {
  items: {
    include: {
      productVariant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: true,
            },
          },
        },
      },
    },
  },
}

export async function getOrCreateCart(prisma: PrismaClient, userId: string) {
  const existing = await prisma.cart.findUnique({
    where: { userId },
    include: cartInclude,
  })

  if (existing) return existing

  return prisma.cart.create({
    data: { userId },
    include: cartInclude,
  })
}

export async function addToCart(
  prisma: PrismaClient,
  userId: string,
  productVariantId: string,
  quantity: number,
  subscription?: { isSubscription?: boolean; subscriptionIntervalDays?: number }
) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: productVariantId },
  })

  if (!variant || !variant.isActive) {
    throw new Error('Товар не найден')
  }

  // Импорт заводит фасовки без цены (price: 0) — продавать их нельзя.
  if (!isSellableByPrice(variant)) {
    throw new Error('Товар недоступен для заказа')
  }

  const isSubscription = subscription?.isSubscription ?? false
  const subscriptionIntervalDays = isSubscription
    ? subscription?.subscriptionIntervalDays ?? null
    : null

  const cart = await getOrCreateCart(prisma, userId)

  // Разово и по подписке — раздельные строки (@@unique с isSubscription).
  const existingItem = cart.items.find(
    (item) => item.productVariantId === productVariantId && item.isSubscription === isSubscription
  )

  const totalQuantity = existingItem
    ? existingItem.quantity + quantity
    : quantity

  if (!hasStock(variant, totalQuantity)) {
    throw new Error('Недостаточно товара на складе')
  }

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: totalQuantity, subscriptionIntervalDays },
    })
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productVariantId,
        productId: variant.productId,
        quantity,
        isSubscription,
        subscriptionIntervalDays,
      },
    })
  }

  return getOrCreateCart(prisma, userId)
}

export async function updateCartItem(
  prisma: PrismaClient,
  cartItemId: string,
  userId: string,
  quantity: number,
  subscription?: { isSubscription?: boolean; subscriptionIntervalDays?: number }
) {
  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: { cart: true },
  })

  if (!item || item.cart.userId !== userId) {
    throw new Error('Позиция корзины не найдена')
  }

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: cartItemId } })
  } else {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.productVariantId },
    })

    if (!variant || !hasStock(variant, quantity)) {
      throw new Error('Недостаточно товара на складе')
    }

    const isSubscription = subscription?.isSubscription ?? item.isSubscription
    const subscriptionIntervalDays = isSubscription
      ? subscription?.subscriptionIntervalDays ?? item.subscriptionIntervalDays
      : null

    // Переключение "Разово ↔ Подписка" может задеть @@unique([cartId, productVariantId, isSubscription]),
    // если для того же варианта уже есть строка с целевым isSubscription — сливаем количества в неё,
    // а не падаем на конфликте уникального индекса.
    const conflicting = await prisma.cartItem.findFirst({
      where: {
        cartId: item.cartId,
        productVariantId: item.productVariantId,
        isSubscription,
        id: { not: cartItemId },
      },
    })

    if (conflicting) {
      const mergedQuantity = conflicting.quantity + quantity
      if (!hasStock(variant, mergedQuantity)) {
        throw new Error('Недостаточно товара на складе')
      }
      await prisma.cartItem.update({
        where: { id: conflicting.id },
        data: { quantity: mergedQuantity, subscriptionIntervalDays },
      })
      await prisma.cartItem.delete({ where: { id: cartItemId } })
    } else {
      await prisma.cartItem.update({
        where: { id: cartItemId },
        data: { quantity, isSubscription, subscriptionIntervalDays },
      })
    }
  }

  return getOrCreateCart(prisma, userId)
}

export async function removeFromCart(
  prisma: PrismaClient,
  cartItemId: string,
  userId: string
) {
  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: { cart: true },
  })

  if (!item || item.cart.userId !== userId) {
    throw new Error('Позиция корзины не найдена')
  }

  await prisma.cartItem.delete({ where: { id: cartItemId } })

  return getOrCreateCart(prisma, userId)
}

export async function clearCart(prisma: PrismaClient, userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } })
  if (!cart) return

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
}

type CartItemWithVariant = {
  quantity: number
  productVariant: { price: number }
}

export function calculateCartTotal(items: CartItemWithVariant[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.productVariant.price * item.quantity,
    0
  )
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return { subtotal, itemsCount }
}

/**
 * Слить гостевую корзину в корзину целевого пользователя.
 * Для каждого товара: если уже есть в целевой корзине, суммировать количество;
 * если нет, добавить новый товар.
 * Затем удалить все товары из гостевой корзины.
 * Если у гостя нет корзины или она пуста — no-op.
 */
export async function mergeGuestCart(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  guestUserId: string,
  targetUserId: string
): Promise<void> {
  const guestCart = await tx.cart.findUnique({
    where: { userId: guestUserId },
    include: { items: true },
  })

  if (!guestCart || guestCart.items.length === 0) {
    return
  }

  const targetCart = await tx.cart.findUnique({
    where: { userId: targetUserId },
  })

  if (!targetCart) {
    // Целевого пользователя обычно не должно быть без корзины, но создадим на всякий случай
    await tx.cart.create({
      data: { userId: targetUserId },
    })
  }

  // Для каждого товара гостя: upsert в целевую корзину
  for (const guestItem of guestCart.items) {
    await tx.cartItem.upsert({
      where: {
        // unique constraint на [cartId, productVariantId, isSubscription]
        cartId_productVariantId_isSubscription: {
          cartId: targetCart?.id || (await tx.cart.findUniqueOrThrow({ where: { userId: targetUserId } })).id,
          productVariantId: guestItem.productVariantId,
          isSubscription: guestItem.isSubscription ?? false,
        },
      },
      update: {
        quantity: {
          increment: guestItem.quantity,
        },
      },
      create: {
        cartId: targetCart?.id || (await tx.cart.findUniqueOrThrow({ where: { userId: targetUserId } })).id,
        productVariantId: guestItem.productVariantId,
        productId: guestItem.productId,
        quantity: guestItem.quantity,
        isSubscription: guestItem.isSubscription ?? false,
      },
    })
  }

  // Удалить все товары из гостевой корзины
  await tx.cartItem.deleteMany({
    where: { cartId: guestCart.id },
  })
}
