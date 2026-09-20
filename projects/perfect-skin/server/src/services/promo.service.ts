import { db } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import * as psSharedNs from '@ps/shared'
// CJS-пакет: vitest кладёт экспорты в namespace, tsx — в default. Берём оба.
const { calcOrderTotals } = ((psSharedNs as any).default ?? psSharedNs) as any

export class PromoService {
  /**
   * Validate promo code against current subtotal.
   */
  async validateCode(code: string, subtotal: number) {
    const now = new Date()
    const upperCode = code.trim().toUpperCase()

    const promo = await db.promoCode.findFirst({
      where: {
        code: upperCode,
        isActive: true,
        deletedAt: null,
      },
    })

    if (!promo) {
      throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокод не найден')
    }

    // Check start date
    if (promo.startsAt && promo.startsAt > now) {
      throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокод не найден')
    }

    // Check expiry date
    if (promo.expiresAt && promo.expiresAt < now) {
      throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокод не найден')
    }

    // Check redemption limit
    if (promo.maxRedemptions !== null && promo.usedCount >= promo.maxRedemptions) {
      throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокод не найден')
    }

    // Check minimum order amount
    if (promo.minOrderAmount !== null && subtotal < promo.minOrderAmount) {
      throw new ApiError(409, 'PROMO_MIN_AMOUNT', 'Сумма заказа меньше минимальной для применения кода', {
        minOrderAmount: promo.minOrderAmount,
      })
    }

    // Calculate discount using calcOrderTotals
    const { promoDiscount } = calcOrderTotals({
      items: [{ price: subtotal, quantity: 1 }],
      priceList: 'retail',
      promo: { code: promo.code, percent: promo.percent },
      deliveryMethod: 'pickup', // Dummy, we only need promoDiscount
    })

    return {
      code: promo.code,
      percent: promo.percent,
      discount: promoDiscount,
      subtotal,
    }
  }

  /**
   * Increment promo code usage (inside transaction).
   */
  async incrementUsage(promoCode: string, tx = db) {
    const result = await tx.promoCode.updateMany({
      where: {
        code: promoCode,
        OR: [
          { maxRedemptions: null },
          { usedCount: { lt: tx.promoCode.fields.maxRedemptions } },
        ],
      },
      data: {
        usedCount: { increment: 1 },
      },
    })

    if (result.count === 0) {
      throw new ApiError(409, 'PROMO_EXHAUSTED', 'Лимит применений промокода исчерпан')
    }
  }
}

export const promoService = new PromoService()
