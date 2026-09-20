// NOTE: The 'professional' branch is kept for test compatibility only.
// The shop is B2C — always 'retail' in production.
export type PriceList = 'retail' | 'professional'

export type DeliveryMethod = 'pickup' | 'pvz' | 'courier'

/**
 * Промокод приходит уже найденным в БД и проверенным на срок и лимит.
 * Здесь только арифметика — расчёт не ходит в базу и ничего не решает
 * про активность кода.
 */
export type AppliedPromo = {
  code: string
  percent: number
}

export type OrderCalcInput = {
  /** Цена уже выбрана по нужному прайсу вызывающей стороной. Копейки. */
  items: { price: number; quantity: number }[]
  priceList: PriceList
  promo?: AppliedPromo | null
  deliveryMethod: DeliveryMethod
}

export type OrderTotals = {
  subtotal: number
  promoDiscount: number
  deliveryCost: number
  total: number
}

/** Бесплатная доставка в пункт выдачи от 6 000 ₽. */
export const FREE_PVZ_THRESHOLD = 600_000
/** Бесплатная курьерская доставка от 10 000 ₽. */
export const FREE_COURIER_THRESHOLD = 1_000_000
/** Платная доставка — 200 ₽. */
export const DELIVERY_COST = 20_000

export function calcDeliveryCost(
  method: DeliveryMethod,
  goodsAfterDiscount: number
): number {
  if (method === 'pickup') return 0

  const threshold =
    method === 'pvz' ? FREE_PVZ_THRESHOLD : FREE_COURIER_THRESHOLD

  return goodsAfterDiscount >= threshold ? 0 : DELIVERY_COST
}

export function calcOrderTotals(input: OrderCalcInput): OrderTotals {
  // Позиция с нечисловой или отрицательной ценой считается нулевой: заказ с
  // суммой NaN уедет в оплату молча, а нулевая позиция видна сразу.
  const subtotal = input.items.reduce(
    (sum, item) => sum + positiveAmount(item.price) * positiveAmount(item.quantity),
    0
  )

  // Промокод косметолога — инструмент для его пациентов, то есть для розницы.
  // На профессиональном прайсе он не применяется: иначе скидка легла бы
  // поверх и без того оптовой цены.
  const promoApplies = input.priceList === 'retail' && input.promo != null
  const promoDiscount = promoApplies
    ? Math.round((subtotal * clampPercent(input.promo!.percent)) / 100)
    : 0

  const goodsAfterDiscount = Math.max(0, subtotal - promoDiscount)
  const deliveryCost = calcDeliveryCost(input.deliveryMethod, goodsAfterDiscount)

  return {
    subtotal,
    promoDiscount,
    deliveryCost,
    total: goodsAfterDiscount + deliveryCost,
  }
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}

function positiveAmount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return value
}
