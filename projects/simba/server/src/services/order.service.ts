import { OrderStatus, PaymentStatus, Prisma, PrismaClient } from '@prisma/client'
import { calcOrderTotals, subscriptionPrice, type OrderCalcInput, type OrderTotals, type PickupPoint } from '@simba/shared'
import { getQuoteForMethod } from './delivery/delivery.service.js'
import { computeDeliveryExpense } from './delivery/delivery-expense.js'
import type { DeliveryAddress as DeliveryServiceAddress, DeliveryMethod } from './delivery/types.js'
import { applyBonusChange, settleOnCancelComponents } from './bonus.service.js'
import { PromoCodeError, checkPromoCode, consumePromoCode } from './promo.service.js'


/** Prisma принимает в Json только объект с индексной сигнатурой, интерфейс
    PickupPoint ей не обладает — копия через spread её получает. */
function toJson(point: PickupPoint): Prisma.InputJsonObject {
  return { ...point }
}

type DeliveryAddress = {
  city: string
  street?: string
  house?: string
  apartment?: string
  /// Необязателен: поле индекса убрано из формы, его подставляет геокодер.
  /// Пока ключа геокодера нет, индекс пуст — и Почта России, единственный
  /// потребитель (providers/post.ts:23), просто не предлагается.
  postalCode?: string
  /// Координаты нужны Яндекс.Доставке; приходят с карты, если она включена.
  lat?: number
  lon?: number
}

type ContactInfo = {
  name?: string
  email?: string
  phone?: string
}

export type CreateOrderData = {
  cartId: string
  /// Четыре способа из contract'а, а не весь Prisma-enum: post/ozon/dostavista
  /// в базе остались, но заказ с ними больше не создаётся.
  deliveryMethod: DeliveryMethod
  deliveryAddress?: DeliveryAddress
  deliveryPoint?: PickupPoint
  comment?: string
  hasSpecialPackaging: boolean
  bonusUsed?: number
  promoCode?: string
  expectedDeliveryCost?: number
  paymentMethod?: 'card' | 'cash_on_delivery'
  contact?: ContactInfo
  guestCheckout?: boolean
}

export type CreateOrderActor = {
  cartOwnerId: string
  customerUserId: string
}

/** Отмена — конечное состояние: бонусы за заказ уже вернулись покупателю. */
export class OrderCancelledError extends Error {
  constructor() {
    super('Отменённый заказ нельзя вернуть в работу')
  }
}

/** Повторная отправка того же заказа — конфликт с уже произошедшим, не ошибка данных. */
export class DuplicateOrderError extends Error {
  constructor() {
    super('Заказ уже оформлен')
  }
}

// Ошибка при расхождении цены доставки
export class DeliveryCostMismatchError extends Error {
  constructor(public actualCost: number) {
    super('Стоимость доставки изменилась, обновите расчёт')
  }
}

// Re-export для обратной совместимости
export { InsufficientBonusError } from './bonus.service.js'

// Re-export for backward compatibility
export { calcOrderTotals, type OrderCalcInput, type OrderTotals }

/**
 * Результат расчёта изменений баланса бонусов при оплате или отмене заказа.
 * balanceDelta может быть положительным (возврат/начисление) или отрицательным (вычитание).
 */
export type BonusSettlement = {
  balanceDelta: number
  bonusEarnedCredited: boolean
  bonusUsedRefunded: boolean
}

/**
 * Чистая функция для расчёта начисления бонусов при оплате заказа.
 * Идемпотентна: повторный вызов с теми же данными вернёт нулевое изменение.
 * @param order Заказ с полями bonusEarned, bonusEarnedCredited
 * @param currentBalance Текущий баланс бонусов пользователя
 * @returns Дельта баланса и новые значения флагов
 */
export function settleOnPaid(
  order: { bonusEarned: number; bonusEarnedCredited: boolean; bonusUsedRefunded: boolean },
  currentBalance: number
): BonusSettlement {
  // bonusUsedRefunded === true означает, что расчёт по заказу уже откатан
  // (отмена или возврат платежа). Начислять за него нельзя: покупателю вернули
  // списанное и товара он не получил — иначе отмена превращается в подарок.
  if (order.bonusUsedRefunded || order.bonusEarnedCredited || order.bonusEarned === 0) {
    return {
      balanceDelta: 0,
      bonusEarnedCredited: order.bonusEarnedCredited,
      bonusUsedRefunded: order.bonusUsedRefunded,
    }
  }

  return {
    balanceDelta: order.bonusEarned,
    bonusEarnedCredited: true,
    bonusUsedRefunded: order.bonusUsedRefunded,
  }
}

/**
 * Чистая функция для расчёта возврата бонусов при отмене или возврате платежа.
 * Возвращает как списанные при оформлении (bonusUsed), так и снимает начисленные.
 * Баланс не уходит в минус: если начисленные бонусы уже потрачены, снимаем только доступное.
 * @param order Заказ с bonusUsed, bonusEarned, bonusEarnedCredited, bonusUsedRefunded
 * @param currentBalance Текущий баланс бонусов пользователя (после прибавления bonusUsed)
 * @returns Дельта баланса и новые значения флагов
 */
export function settleOnCancel(
  order: {
    bonusUsed: number
    bonusEarned: number
    bonusEarnedCredited: boolean
    bonusUsedRefunded: boolean
  },
  currentBalance: number
): BonusSettlement {
  let balanceDelta = 0

  // Вернуть списанные бонусы, если ещё не вернули
  let bonusUsedRefunded = order.bonusUsedRefunded
  if (!order.bonusUsedRefunded && order.bonusUsed > 0) {
    balanceDelta += order.bonusUsed
    bonusUsedRefunded = true
  }

  // Снять начисленные бонусы, если они были начислены
  let bonusEarnedCredited = order.bonusEarnedCredited
  if (order.bonusEarnedCredited && order.bonusEarned > 0) {
    const toDeduct = Math.max(0, Math.min(order.bonusEarned, currentBalance + balanceDelta))
    balanceDelta -= toDeduct
    bonusEarnedCredited = false
  }

  return {
    balanceDelta,
    bonusEarnedCredited,
    bonusUsedRefunded,
  }
}


const orderItemsInclude = {
  items: {
    select: {
      id: true,
      productName: true,
      variantWeight: true,
      price: true,
      quantity: true,
      productVariantId: true,
      productId: true,
      isSubscription: true,
      subscriptionId: true,
    },
  },
}

async function resolveDeliveryCost(
  prisma: PrismaClient,
  cartOwnerId: string,
  data: CreateOrderData
): Promise<number> {
  let serverDeliveryCost = 0

  if (data.deliveryMethod !== 'pickup') {
    if (!data.deliveryAddress) {
      throw new Error('Для выбранного способа доставки нужен адрес')
    }

    // simba_courier требует улицу и дом
    if (data.deliveryMethod === 'simba_courier') {
      if (!data.deliveryAddress.street || !data.deliveryAddress.house) {
        throw new Error('Для доставки курьером укажите улицу и дом')
      }
    }

    // cdek и yandex требуют пункт выдачи
    if (data.deliveryMethod === 'cdek' || data.deliveryMethod === 'yandex') {
      if (!data.deliveryPoint) {
        throw new Error('Выберите пункт выдачи')
      }
    }

    // Вес берём из БД, а не из запроса — иначе доставку можно занизить.
    const cart = await prisma.cart.findUnique({
      where: { id: data.cartId, userId: cartOwnerId },
      include: { items: { include: { productVariant: true } } },
    })

    if (!cart || cart.items.length === 0) {
      throw new Error('Корзина пуста или не найдена')
    }

    const totalWeightKg = cart.items.reduce(
      (sum, item) => sum + item.productVariant.weight * item.quantity,
      0
    )
    // Сумма товаров для порога «бесплатно от» — та же формула, что и в котировках.
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.productVariant.price * item.quantity,
      0
    )

    const quote = await getQuoteForMethod(
      prisma,
      data.deliveryMethod,
      {
        ...data.deliveryAddress,
        pickupPoint: data.deliveryPoint,
      } as DeliveryServiceAddress,
      { weightKg: totalWeightKg, subtotal }
    )

    serverDeliveryCost = quote.price
  }

  const clientCost = data.expectedDeliveryCost ?? 0
  if (clientCost !== serverDeliveryCost) {
    throw new DeliveryCostMismatchError(serverDeliveryCost)
  }

  return serverDeliveryCost
}

export async function createOrder(
  prisma: PrismaClient,
  actor: CreateOrderActor,
  data: CreateOrderData
) {
  // Котировка доставки — до открытия транзакции: это HTTP-запрос к внешней
  // службе, держать на нём открытую транзакцию с блокировками нельзя.
  const serverDeliveryCost = await resolveDeliveryCost(prisma, actor.cartOwnerId, data)

  const orderResult = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { id: data.cartId, userId: actor.cartOwnerId },
      include: {
        items: {
          include: {
            productVariant: {
              include: { product: true },
            },
          },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      throw new Error('Корзина пуста или не найдена')
    }

    // Быстрый отказ до создания заказа — НЕ защита от гонки: остаток может
    // измениться между этой проверкой и списанием ниже. Защита там, в условном
    // updateMany. Здесь просто чтобы не делать лишнюю работу в обычном случае.
    for (const item of cart.items) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.productVariantId },
        select: { stock: true },
      })

      if (!variant || variant.stock < item.quantity) {
        throw new Error(
          `Недостаточно товара на складе: ${item.productVariant.product.name}`
        )
      }
    }

    const currentUser = await tx.user.findUnique({
      where: { id: actor.customerUserId },
      select: { bonusPoints: true },
    })

    // Вычисляем subtotal перед проверкой промокода
    const subscriptionsAllowed = !data.guestCheckout
    const subtotalRaw = cart.items.reduce((sum, item) => {
      const price = item.isSubscription && subscriptionsAllowed ? subscriptionPrice(item.productVariant.price) : item.productVariant.price
      return sum + price * item.quantity
    }, 0)

    // Проверяем и применяем промокод, если задан
    let promo = null
    if (data.promoCode) {
      const check = await checkPromoCode(tx, data.promoCode, subtotalRaw, actor.customerUserId)
      if (!check.ok) {
        throw new PromoCodeError(check.reason)
      }
      promo = check.promo
    }

    const { subtotal, bonusUsed, total, bonusEarned, promoDiscount } = calcOrderTotals({
      items: cart.items.map((item) => ({
        price: item.productVariant.price,
        quantity: item.quantity,
        isSubscription: item.isSubscription,
      })),
      promo: promo ? { type: promo.type, value: promo.value, minSubtotal: promo.minSubtotal } : null,
      bonusRequested: data.bonusUsed,
      availableBonus: currentUser?.bonusPoints ?? 0,
      deliveryCost: serverDeliveryCost,
    })

    const order = await tx.order.create({
      data: {
        userId: actor.customerUserId,
        deliveryMethod: data.deliveryMethod,
        // simba_courier сохраняет полный адрес, cdek/yandex только город (для расчёта расходов)
        deliveryAddress:
          data.deliveryMethod === 'simba_courier'
            ? (data.deliveryAddress ?? undefined)
            : data.deliveryMethod === 'cdek' || data.deliveryMethod === 'yandex'
              ? data.deliveryAddress
                ? { city: data.deliveryAddress.city }
                : undefined
              : undefined,
        // только cdek и yandex сохраняют пункт выдачи
        deliveryPoint:
          (data.deliveryMethod === 'cdek' || data.deliveryMethod === 'yandex') && data.deliveryPoint
            ? toJson(data.deliveryPoint)
            : undefined,
        comment: data.comment,
        hasSpecialPackaging: data.hasSpecialPackaging,
        subtotal,
        total,
        bonusUsed,
        bonusEarned,
        discount: promoDiscount,
        promoCode: promo?.code ?? null,
        promoCodeId: promo?.id ?? null,
        deliveryCost: serverDeliveryCost,
        paymentMethod: data.paymentMethod ?? 'card',
        contactName: data.contact?.name,
        contactEmail: data.contact?.email,
        contactPhone: data.contact?.phone,
        guestCheckout: data.guestCheckout ?? false,
      },
    })

    // Create order items and handle subscriptions
    for (const cartItem of cart.items) {
      const itemPrice = cartItem.isSubscription && subscriptionsAllowed
        ? subscriptionPrice(cartItem.productVariant.price)
        : cartItem.productVariant.price

      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productVariantId: cartItem.productVariantId,
          productId: cartItem.productId,
          productName: cartItem.productVariant.product.name,
          variantWeight: cartItem.productVariant.weight,
          price: itemPrice,
          quantity: cartItem.quantity,
          isSubscription: cartItem.isSubscription && subscriptionsAllowed,
        },
      })

      // Create/update subscription if this is a subscription item.
      // Уникальность userId+productVariantId у Subscription — частичный индекс
      // (только среди isActive: true, см. миграцию subscription_stage1), Prisma не
      // умеет строить upsert по такому ключу — ищем активную запись вручную.
      if (cartItem.isSubscription && subscriptionsAllowed && cartItem.subscriptionIntervalDays) {
        const existingSubscription = await tx.subscription.findFirst({
          where: {
            userId: actor.customerUserId,
            productVariantId: cartItem.productVariantId,
            isActive: true,
          },
        })

        const subscription = existingSubscription
          ? await tx.subscription.update({
              where: { id: existingSubscription.id },
              data: {
                intervalDays: cartItem.subscriptionIntervalDays,
                deliveryMethod: data.deliveryMethod,
                deliveryAddress: data.deliveryMethod === 'simba_courier' ? (data.deliveryAddress ?? undefined) : undefined,
                deliveryPoint:
                  (data.deliveryMethod === 'cdek' || data.deliveryMethod === 'yandex') && data.deliveryPoint
                    ? toJson(data.deliveryPoint)
                    : undefined,
                isPaused: false,
                isActive: true,
              },
            })
          : await tx.subscription.create({
              data: {
                userId: actor.customerUserId,
                productVariantId: cartItem.productVariantId,
                productId: cartItem.productId,
                intervalDays: cartItem.subscriptionIntervalDays,
                nextDeliveryAt: new Date(
                  Date.now() + cartItem.subscriptionIntervalDays * 24 * 60 * 60 * 1000
                ),
                deliveryMethod: data.deliveryMethod,
                deliveryAddress: data.deliveryMethod === 'simba_courier' ? (data.deliveryAddress ?? undefined) : undefined,
                deliveryPoint:
                  (data.deliveryMethod === 'cdek' || data.deliveryMethod === 'yandex') && data.deliveryPoint
                    ? toJson(data.deliveryPoint)
                    : undefined,
                paymentMethodId: null,
                isActive: true,
                isPaused: false,
              },
            })

        // Link subscription to order item
        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: { subscriptionId: subscription.id },
        })
      }
    }

    // Fetch order with items for return
    const orderWithItems = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderItemsInclude,
    })

    for (const item of cart.items) {
      // Условное списание: база сама проверит, что остатка хватает. Проверка
      // отдельным запросом выше не спасает — между ней и списанием второй
      // покупатель успевает забрать последний мешок, и склад уходит в минус.
      const decremented = await tx.productVariant.updateMany({
        where: { id: item.productVariantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      })

      if (decremented.count === 0) {
        throw new Error(
          `Недостаточно товара на складе: ${item.productVariant.product.name}`
        )
      }
    }

    // Условное списание бонусов: вторая линия защиты от гонки
    if (bonusUsed > 0) {
      await applyBonusChange(tx, {
        userId: actor.customerUserId,
        amount: -bonusUsed,
        type: 'spent',
        orderId: order.id,
        requireSufficient: true,
      })
    }

    // Бонусы не начисляются при оформлении — только при оплате (markOrderPaid).
    // Поле bonusEarned в заказе сохраняется как калькуляция, но на баланс попадает позже.
    const user = await tx.user.findUnique({
      where: { id: actor.customerUserId },
      select: { bonusPoints: true, bonusLevel: true },
    })

    // Очистка корзины — она же признак дубля. Два одновременных нажатия
    // «Оформить» дойдут сюда оба, но вычистит корзину только первый; второй
    // увидит ноль строк и откатится, вместо второго заказа и двойного списания.
    const cleared = await tx.cartItem.deleteMany({ where: { cartId: cart.id } })

    if (cleared.count === 0) {
      throw new DuplicateOrderError()
    }

    // Инкрементируем счётчик использований промокода
    if (promo) {
      if (!(await consumePromoCode(tx, promo.id))) {
        throw new PromoCodeError('Лимит использований промокода исчерпан')
      }
    }

    return orderWithItems
  })

  // Расчёт расходов на доставку асинхронно, после успешной транзакции.
  // Сбой не должен ломать заказ.
  void computeDeliveryExpense(prisma, orderResult.id).catch((err) => {
    console.error(`Ошибка при расчёте расходов на доставку заказа ${orderResult.id}:`, err)
  })

  return orderResult
}

export async function getOrdersByUser(prisma: PrismaClient, userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      total: true,
      deliveryMethod: true,
      deliveryCost: true,
      paymentStatus: true,
      createdAt: true,
      bonusUsed: true,
      bonusEarned: true,
      items: {
        select: {
          productName: true,
          variantWeight: true,
          price: true,
          quantity: true,
        },
      },
    },
  })
}

export async function getOrderById(
  prisma: PrismaClient,
  orderId: string,
  userId: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order || order.userId !== userId) {
    throw new Error('Заказ не найден')
  }

  return order
}

export async function updateOrderStatus(
  prisma: PrismaClient,
  orderId: string,
  status: 'confirmed' | 'in_transit' | 'delivered' | 'cancelled'
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })

  if (!order) {
    throw new Error('Заказ не найден')
  }

  // Отмена — конечная. Иначе заказ можно вернуть в работу после того, как
  // списанные бонусы уже вернулись покупателю: товар едет, оплата подарена.
  if (order.status === 'cancelled' && status !== 'cancelled') {
    throw new OrderCancelledError()
  }

  // При отмене заказа — вернуть бонусы
  if (status === 'cancelled') {
    return prisma.$transaction(async (tx) => {
      // Право отменить захватываем условным апдейтом: два одновременных запроса
      // иначе оба прочитают «не отменён» и оба вернут бонусы на баланс.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: { not: 'cancelled' } },
        data: { status },
      })

      if (claimed.count === 0) {
        return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
      }

      const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } })

      const currentUser = await tx.user.findUnique({
        where: { id: fresh.userId },
        select: { bonusPoints: true },
      })

      const { bonusToRefund, bonusToDeduct } = settleOnCancelComponents(
        fresh,
        currentUser?.bonusPoints ?? 0
      )

      // Записываем два отдельных движения для прозрачности истории
      if (bonusToRefund > 0 && !fresh.bonusUsedRefunded) {
        await applyBonusChange(tx, {
          userId: fresh.userId,
          amount: bonusToRefund,
          type: 'refund_used',
          orderId: fresh.id,
          comment: 'Возврат использованных бонусов при отмене заказа',
        })
      }

      if (bonusToDeduct > 0 && fresh.bonusEarnedCredited) {
        await applyBonusChange(tx, {
          userId: fresh.userId,
          amount: -bonusToDeduct,
          type: 'revoke_earned',
          orderId: fresh.id,
          comment: 'Отмена начисленных бонусов при отмене заказа',
        })
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          bonusEarnedCredited: bonusToDeduct > 0 ? false : fresh.bonusEarnedCredited,
          bonusUsedRefunded: bonusToRefund > 0 ? true : fresh.bonusUsedRefunded,
          stockRestored: fresh.stockRestored ? true : undefined,
        },
        include: { items: true },
      })

      // Возврат товара на склад, если ещё не возвращали
      if (!fresh.stockRestored) {
        for (const item of updatedOrder.items) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.quantity } },
          })
        }

        // Обновить флаг stockRestored
        await tx.order.update({
          where: { id: orderId },
          data: { stockRestored: true },
        })
      }

      return updatedOrder
    })
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: { items: true },
  })
}

/**
 * Отметить заказ как оплаченный и начислить бонусы.
 * Идемпотентна: повторный вызов не начислит бонусы дважды.
 */
export async function markOrderPaid(prisma: PrismaClient, orderId: string) {
  return prisma.$transaction(async (tx) => {
    // Отметку «оплачен» захватываем условно: два одновременных нажатия иначе
    // оба увидят «не оплачен» и начислят бонусы дважды.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { not: 'paid' }, status: { not: 'cancelled' } },
      data: { paymentStatus: 'paid' },
    })

    const order = await tx.order.findUnique({ where: { id: orderId } })

    if (!order) {
      throw new Error('Заказ не найден')
    }

    if (claimed.count === 0) {
      return order
    }

    const settlement = settleOnPaid(order, 0)

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { bonusEarnedCredited: settlement.bonusEarnedCredited },
    })

    // Начислить бонусы через journal
    if (settlement.balanceDelta !== 0) {
      await applyBonusChange(tx, {
        userId: order.userId,
        amount: settlement.balanceDelta,
        type: 'earned',
        orderId: order.id,
        comment: 'Бонусы за оплату заказа',
      })
    }

    return updatedOrder
  })
}

/**
 * Отметить заказ как возвращённый (возврат платежа) и вернуть бонусы.
 * Идемпотентна.
 */
export async function markOrderRefunded(prisma: PrismaClient, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { not: 'refunded' } },
      data: { paymentStatus: 'refunded' },
    })

    const order = await tx.order.findUnique({ where: { id: orderId } })

    if (!order) {
      throw new Error('Заказ не найден')
    }

    if (claimed.count === 0) {
      return order
    }

    const currentUser = await tx.user.findUnique({
      where: { id: order.userId },
      select: { bonusPoints: true },
    })

    const { bonusToRefund, bonusToDeduct } = settleOnCancelComponents(
      order,
      currentUser?.bonusPoints ?? 0
    )

    // Записываем два отдельных движения для прозрачности истории
    if (bonusToRefund > 0 && !order.bonusUsedRefunded) {
      await applyBonusChange(tx, {
        userId: order.userId,
        amount: bonusToRefund,
        type: 'refund_used',
        orderId: order.id,
        comment: 'Возврат использованных бонусов при возврате платежа',
      })
    }

    if (bonusToDeduct > 0 && order.bonusEarnedCredited) {
      await applyBonusChange(tx, {
        userId: order.userId,
        amount: -bonusToDeduct,
        type: 'revoke_earned',
        orderId: order.id,
        comment: 'Отмена начисленных бонусов при возврате платежа',
      })
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        bonusEarnedCredited: bonusToDeduct > 0 ? false : order.bonusEarnedCredited,
        bonusUsedRefunded: bonusToRefund > 0 ? true : order.bonusUsedRefunded,
      },
    })

    return updatedOrder
  })
}
