// Бонусы — целые «баллы». Курс kopecksPerBonus: сколько копеек стоит один балл (100 = 1 ₽).
// Всё округляется вниз, только целочисленная арифметика.

export type BonusAccrualBase = 'paid_goods' | 'after_promo' | 'gross'

export type BonusSpendRules = {
  kopecksPerBonus: number
  maxSpendPercent: number
  minOrderForSpend: number
  allowSpendWithPromo: boolean
}

export type BonusAccrualRules = {
  accrualPercent: number
  accrualBase: BonusAccrualBase
  kopecksPerBonus: number
  excludeProfessionalProducts: boolean
  accrueWithPromo: boolean
}

export type BonusSpendBlock = 'PROMO_CONFLICT' | 'MIN_ORDER' | 'EMPTY_BALANCE'

export function bonusValue(points: number, kopecksPerBonus: number): number {
  return points * kopecksPerBonus
}

export function calcMaxBonusSpend(input: {
  goodsAfterDiscount: number
  hasPromo: boolean
  available: number
  rules: BonusSpendRules
}): { maxSpend: number; block: BonusSpendBlock | null } {
  const { goodsAfterDiscount, hasPromo, available, rules } = input

  if (hasPromo && !rules.allowSpendWithPromo) return { maxSpend: 0, block: 'PROMO_CONFLICT' }
  if (goodsAfterDiscount < rules.minOrderForSpend) return { maxSpend: 0, block: 'MIN_ORDER' }
  if (available <= 0) return { maxSpend: 0, block: 'EMPTY_BALANCE' }

  const byPercent = Math.floor(
    (goodsAfterDiscount * clampPercent(rules.maxSpendPercent)) / (100 * rules.kopecksPerBonus)
  )
  return { maxSpend: Math.min(available, byPercent), block: null }
}

export function calcBonusAccrual(input: {
  items: { price: number; quantity: number; isProfessional: boolean }[]
  subtotal: number
  promoDiscount: number
  bonusDiscount: number
  hasPromo: boolean
  rules: BonusAccrualRules
}): number {
  const { subtotal, promoDiscount, bonusDiscount, hasPromo, rules } = input

  if ((hasPromo && !rules.accrueWithPromo) || subtotal <= 0) return 0

  const eligible = input.items
    .filter((item) => !(rules.excludeProfessionalProducts && item.isProfessional))
    .reduce((sum, item) => sum + item.price * item.quantity, 0)

  const base = accrualBase(rules.accrualBase, { eligible, subtotal, promoDiscount, bonusDiscount })
  return Math.floor((base * clampPercent(rules.accrualPercent)) / (100 * rules.kopecksPerBonus))
}

function accrualBase(
  base: BonusAccrualBase,
  amounts: { eligible: number; subtotal: number; promoDiscount: number; bonusDiscount: number }
): number {
  const { eligible, subtotal, promoDiscount, bonusDiscount } = amounts
  switch (base) {
    case 'gross':
      return eligible
    case 'after_promo':
      return Math.floor((eligible * (subtotal - promoDiscount)) / subtotal)
    case 'paid_goods':
      return Math.floor((eligible * (subtotal - promoDiscount - bonusDiscount)) / subtotal)
  }
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}
