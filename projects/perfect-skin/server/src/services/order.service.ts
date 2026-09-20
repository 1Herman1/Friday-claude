import { db, type Prisma, $Enums } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import * as psSharedNs from '@ps/shared'
const { calcOrderTotals } = ((psSharedNs as any).default ?? psSharedNs) as any
import { toCalcMethod } from '../lib/delivery.js'
import crypto from 'crypto'

type PrismaDeliveryMethod = $Enums.DeliveryMethod

// Заказ привязывается к пользователю (Order.userId обязателен).
// Для вошедшего пользователя: customerId = user.id, cart найти по user.id
// Для гостя: customerId = найденный/созданный по email пользователь, cart найти по sessionId
type OrderOwner = {
  customerId: string
  cart: { userId: string } | { sessionId: string }
}

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: { select: { slug: true; images: true } } } }
    redemption: { include: { promoCode: { select: { code: true; percent: true } } } }
  }
}>

export class OrderService {
  /**
   * Create order from cart. Atomically:
   * 1. Get cart and items
   * 2. Verify all items are still active
   * 3. Conditional stock deduction
   * 4. Validate and increment promo
   * 5. Calculate totals
   * 6. Verify expectedTotal matches
   * 7. Generate order number
   * 8. Create Order and OrderItems
   * 9. Create PromoCodeRedemption if promo applied
   * 10. Clear cart
   */
  async createOrder(
    owner: OrderOwner,
    payload: {
      deliveryMethod: PrismaDeliveryMethod
      cdekPvzCode?: string | null
      address?: any | null
      recipient: { name: string; phone: string; email?: string | null }
      promoCode?: string | null
      comment?: string | null
      expectedTotal: number
    }
  ) {
    // Find cart by owner (either user or session)
    const cart = await db.cart.findUnique({
      where: 'userId' in owner.cart
        ? { userId: owner.cart.userId }
        : { sessionId: owner.cart.sessionId },
      include: {
        items: {
          include: {
            productVariant: { include: { product: { include: { brand: true } } } },
          },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
    }

    // Filter out unavailable items for calculation
    const availableItems = cart.items.filter((item) => {
      const v = item.productVariant
      return (
        v.isActive &&
        !v.deletedAt &&
        v.product.isActive &&
        !v.product.deletedAt &&
        v.retailPrice > 0
      )
    })

    // Check for unavailable items
    for (const item of cart.items) {
      const v = item.productVariant
      if (!v.isActive || v.deletedAt || !v.product.isActive || v.product.deletedAt) {
        throw new ApiError(409, 'ITEM_UNAVAILABLE', 'Товар недоступен', {
          itemId: item.id,
          productName: v.product.name,
        })
      }
    }

    // Quick calculation of subtotal to pass to promo validation
    const subtotal = availableItems.reduce(
      (sum, item) => sum + item.productVariant.retailPrice * item.quantity,
      0
    )

    // Validate promo if provided
    let promoData = null
    if (payload.promoCode) {
      const now = new Date()
      const upperCode = payload.promoCode.trim().toUpperCase()

      const promoCheck = await db.promoCode.findFirst({
        where: {
          code: upperCode,
          isActive: true,
          deletedAt: null,
        },
      })

      if (!promoCheck) {
        throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокод не найден')
      }

      if (promoCheck.startsAt && promoCheck.startsAt > now) {
        throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокод не найден')
      }

      if (promoCheck.expiresAt && promoCheck.expiresAt < now) {
        throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокод не найден')
      }

      if (promoCheck.maxRedemptions !== null && promoCheck.usedCount >= promoCheck.maxRedemptions) {
        throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокод не найден')
      }

      if (promoCheck.minOrderAmount !== null && subtotal < promoCheck.minOrderAmount) {
        throw new ApiError(409, 'PROMO_MIN_AMOUNT', 'Сумма заказа меньше минимальной', {
          minOrderAmount: promoCheck.minOrderAmount,
        })
      }

      promoData = {
        id: promoCheck.id,
        code: promoCheck.code,
        percent: promoCheck.percent,
        perUserLimit: promoCheck.perUserLimit,
      }
    }

    // Execute order creation in transaction
    const order = await db.$transaction(async (tx) => {
      // Step 3: Conditional stock deduction with race condition protection.
      // Порядок обхода фиксируем по productVariantId: два параллельных заказа
      // с пересекающимися позициями иначе берут row-lock в разном порядке —
      // классический deadlock Postgres.
      const orderedItems = [...availableItems].sort((a, b) =>
        a.productVariantId.localeCompare(b.productVariantId)
      )
      for (const item of orderedItems) {
        const deducted = await tx.productVariant.updateMany({
          where: {
            id: item.productVariantId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        })

        if (deducted.count === 0) {
          throw new ApiError(409, 'OUT_OF_STOCK', 'Недостаточно товара на складе', {
            itemId: item.id,
            productName: item.productVariant.product.name,
            available: item.productVariant.stock,
          })
        }
      }

      // Step 4: Validate and increment promo inside transaction
      if (promoData) {
        const promoCheck = await tx.promoCode.findUnique({
          where: { id: promoData.id },
        })

        if (!promoCheck || (promoCheck.maxRedemptions !== null && promoCheck.usedCount >= promoCheck.maxRedemptions)) {
          throw new ApiError(409, 'PROMO_EXHAUSTED', 'Лимит применений промокода исчерпан')
        }

        // Per-user limit ("once per customer"): without this check one
        // customer redeems the discount an unlimited number of times.
        if (promoCheck.perUserLimit) {
          const perUserKey = crypto
            .createHmac('sha256', process.env.PS_PROMO_HMAC_SECRET || 'dev-secret')
            .update(owner.customerId)
            .digest('hex')
          const used = await tx.promoCodeRedemption.count({
            where: { promoCodeId: promoData.id, perUserKey },
          })
          if (used > 0) {
            throw new ApiError(409, 'PROMO_EXHAUSTED', 'Вы уже использовали этот промокод')
          }
        }

        await tx.promoCode.update({
          where: { id: promoData.id },
          data: { usedCount: { increment: 1 } },
        })
      }

      // Step 5: Calculate totals using calcOrderTotals
      const calcItems = availableItems.map((item) => ({
        price: item.productVariant.retailPrice,
        quantity: item.quantity,
      }))

      const totals = calcOrderTotals({
        items: calcItems,
        priceList: 'retail',
        promo: promoData ? { code: promoData.code, percent: promoData.percent } : null,
        deliveryMethod: toCalcMethod(payload.deliveryMethod),
      })

      // Step 6: Verify expectedTotal
      if (payload.expectedTotal !== totals.total) {
        throw new ApiError(409, 'TOTAL_MISMATCH', 'Сумма заказа изменилась', {
          subtotal: totals.subtotal,
          promoDiscount: totals.promoDiscount,
          deliveryCost: totals.deliveryCost,
          total: totals.total,
        })
      }

      // Step 7: Generate order number from sequence
      const seqResult = await tx.$queryRaw`SELECT nextval('order_number_seq') as next_val`
      const nextNum = (seqResult as any[])[0].next_val
      const orderNumber = `PS-${String(nextNum).padStart(6, '0')}`

      // Step 8: Create Order and OrderItems
      const newOrder = await tx.order.create({
        data: {
          number: orderNumber,
          userId: owner.customerId,
          status: 'new',
          deliveryMethod: payload.deliveryMethod as PrismaDeliveryMethod,
          cdekPvzCode: payload.cdekPvzCode || null,
          deliveryAddress: payload.address || null,
          recipientName: payload.recipient.name,
          recipientPhone: payload.recipient.phone,
          recipientEmail: payload.recipient.email || null,
          subtotal: totals.subtotal,
          promoDiscount: totals.promoDiscount,
          deliveryCost: totals.deliveryCost,
          total: totals.total,
          comment: payload.comment || null,
          paymentStatus: 'pending',
          paymentId: null,
        },
        include: { items: true },
      })

      // Create OrderItems with snapshots
      for (const item of availableItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            productVariantId: item.productVariantId,
            productName: item.productVariant.product.name,
            brandName: item.productVariant.product.brand?.name || null,
            volumeLabel:
              item.productVariant.volumeLabel ??
              `${item.productVariant.volumeValue} ${{ ml: 'мл', g: 'г', pcs: 'шт' }[item.productVariant.volumeUnit] ?? ''}`,
            price: item.productVariant.retailPrice,
            quantity: item.quantity,
          },
        })
      }

      // Step 9: Create PromoCodeRedemption if promo applied
      if (promoData) {
        const perUserKey = promoData.perUserLimit
          ? crypto
              .createHmac('sha256', process.env.PS_PROMO_HMAC_SECRET || 'dev-secret')
              .update(owner.customerId)
              .digest('hex')
          : null

        await tx.promoCodeRedemption.create({
          data: {
            orderId: newOrder.id,
            promoCodeId: promoData.id,
            userId: owner.customerId,
            discountAmount: totals.promoDiscount,
            orderSubtotal: totals.subtotal,
            perUserKey,
          },
        })
      }

      // Step 10: Clear cart
      await tx.cartItem.deleteMany({
        where: { cartId: cart!.id },
      })

      return newOrder
    })

    // Fetch full order with all relations
    const fullOrder = await db.order.findUnique({
      where: { id: order.id },
      include: {
        items: { include: { product: { select: { slug: true, images: true } } } },
        redemption: { include: { promoCode: { select: { code: true, percent: true } } } },
      },
    })

    return this.formatOrderResponse(fullOrder!)
  }

  /**
   * Format order for API response.
   */
  formatOrderResponse(order: OrderWithRelations): {
    id: string
    number: string
    status: string
    createdAt: Date
    deliveryMethod: PrismaDeliveryMethod
    cdekPvzCode: string | null
    deliveryAddress: unknown
    recipient: { name: string; phone: string; email: string | null }
    items: Array<{
      productName: string
      brandName: string | null
      volumeLabel: string | null
      price: number
      quantity: number
      lineTotal: number
      productSlug: string | null
      image: string | null
    }>
    subtotal: number
    promo: { code: string; percent: number; discount: number } | null
    deliveryCost: number
    total: number
    comment: string | null
    payment: {
      status: string
      provider: string
      confirmationUrl: null
      paymentStatus: string
    }
  } {
    const items = order.items.map((item) => ({
      productName: item.productName,
      brandName: item.brandName,
      volumeLabel: item.volumeLabel,
      price: Number(item.price),
      quantity: item.quantity,
      lineTotal: Number(item.price) * item.quantity,
      productSlug: item.product?.slug ?? null,
      image: item.product?.images?.[0] ?? null,
    }))

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      createdAt: order.createdAt,
      deliveryMethod: order.deliveryMethod,
      cdekPvzCode: order.cdekPvzCode,
      deliveryAddress: order.deliveryAddress,
      recipient: {
        name: order.recipientName,
        phone: order.recipientPhone,
        email: order.recipientEmail,
      },
      items,
      subtotal: Number(order.subtotal),
      promo: order.promoDiscount > 0
        ? {
            code: order.redemption?.promoCode?.code ?? '',
            percent: order.redemption?.promoCode?.percent ?? 0,
            discount: Number(order.promoDiscount),
          }
        : null,
      deliveryCost: Number(order.deliveryCost),
      total: Number(order.total),
      comment: order.comment,
      payment: {
        status: 'not_implemented',
        provider: 'yookassa',
        confirmationUrl: null,
        paymentStatus: order.paymentStatus,
      },
    }
  }
}

export const orderService = new OrderService()
