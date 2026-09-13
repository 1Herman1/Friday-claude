import { PrismaClient, Prisma, PromoCode } from '@prisma/client'
import { calcPromoDiscount } from '@simba/shared'

export class PromoCodeError extends Error {
  constructor(public reason: string) {
    super(reason)
    this.name = 'PromoCodeError'
  }
}

export type PromoCheck =
  | { ok: true; promo: PromoCode; discount: number }
  | { ok: false; reason: string }

export async function checkPromoCode(
  db: PrismaClient | Prisma.TransactionClient,
  rawCode: string,
  subtotal: number,
  userId?: string
): Promise<PromoCheck> {
  const code = rawCode.trim().toUpperCase()

  const promo = await db.promoCode.findUnique({ where: { code } })

  if (!promo || !promo.isActive) {
    return { ok: false, reason: 'Промокод не найден' }
  }

  const now = new Date()

  if (promo.startsAt && promo.startsAt > now) {
    return { ok: false, reason: 'Промокод ещё не действует' }
  }

  if (promo.endsAt && promo.endsAt < now) {
    return { ok: false, reason: 'Срок действия промокода истёк' }
  }

  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, reason: 'Лимит использований промокода исчерпан' }
  }

  if (promo.perUserLimit != null && userId) {
    const userUsageCount = await db.order.count({
      where: {
        promoCodeId: promo.id,
        userId,
        status: { not: 'cancelled' },
      },
    })
    if (userUsageCount >= promo.perUserLimit) {
      return { ok: false, reason: 'Вы уже использовали этот промокод' }
    }
  }

  if (promo.minSubtotal != null && subtotal < promo.minSubtotal) {
    return {
      ok: false,
      reason: `Минимальная сумма заказа для промокода — ${Math.ceil(promo.minSubtotal / 100).toLocaleString('ru-RU')} ₽`,
    }
  }

  const discount = calcPromoDiscount(subtotal, promo)

  return { ok: true, promo, discount }
}

export async function consumePromoCode(
  tx: Prisma.TransactionClient,
  id: string
): Promise<boolean> {
  const result = await tx.$executeRaw<any>`
    UPDATE promo_codes
    SET "usedCount" = "usedCount" + 1
    WHERE id = ${id} AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
  `
  return result === 1
}

export function promoStatus(
  p: PromoCode
): 'active' | 'scheduled' | 'expired' | 'exhausted' | 'disabled' {
  if (!p.isActive) return 'disabled'

  const now = new Date()
  if (p.startsAt && p.startsAt > now) return 'scheduled'
  if (p.endsAt && p.endsAt < now) return 'expired'
  if (p.maxUses != null && p.usedCount >= p.maxUses) return 'exhausted'

  return 'active'
}
