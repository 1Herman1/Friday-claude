export type PromoRule = { type: 'percent' | 'fixed'; value: number; minSubtotal?: number | null }

export function calcPromoDiscount(subtotal: number, promo?: PromoRule | null): number {
  if (!promo) return 0
  if (promo.minSubtotal != null && subtotal < promo.minSubtotal) return 0
  const raw = promo.type === 'percent' ? Math.round((subtotal * promo.value) / 100) : promo.value
  return Math.max(0, Math.min(raw, subtotal))
}

export type OrderCalcInput = {
  items: { price: number; quantity: number; isSubscription?: boolean }[]
  promo?: PromoRule | null
  bonusRequested?: number
  availableBonus: number
  deliveryCost?: number
}

export type OrderTotals = {
  subtotal: number
  promoDiscount: number
  bonusUsed: number
  total: number
  bonusEarned: number
}

export function calcOrderTotals(input: OrderCalcInput): OrderTotals {
  const subtotal = input.items.reduce((sum, item) => {
    const price = item.isSubscription ? Math.round(item.price * 0.93) : item.price
    return sum + price * item.quantity
  }, 0)
  const promoDiscount = calcPromoDiscount(subtotal, input.promo)

  const delivery = input.deliveryCost ?? 0
  const payableBeforeBonus = Math.max(0, subtotal - promoDiscount + delivery)

  // scoin хранится в рублях: 1 scoin = 1 ₽ = 100 копеек скидки. Цены — в копейках.
  // Лимит списания: максимум 50% суммы чека (товары − промокод + доставка).
  // Доставка входит в расчёт лимита, но не в базу начисления.
  const maxRedeemableScoins = Math.floor(payableBeforeBonus / 200)
  const requested = Math.floor(input.bonusRequested ?? 0)
  const bonusUsed = Math.max(0, Math.min(requested, maxRedeemableScoins, input.availableBonus))
  const total = Math.max(0, payableBeforeBonus - bonusUsed * 100)

  // bonusEarned: 5% только от товарной части, без доставки (консервативное начисление).
  // bonusUsed списываются в первую очередь с товаров.
  const goodsPaid = Math.max(0, subtotal - promoDiscount - bonusUsed * 100)
  // 5% от рублёвой части: копейки / 100 × 0.05 = копейки / 2000, но без дробей.
  const bonusEarned = Math.floor(goodsPaid / 2000)

  return { subtotal, promoDiscount, bonusUsed, total, bonusEarned }
}
