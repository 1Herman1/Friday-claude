import { describe, it, expect } from 'vitest'
import {
  calcOrderTotals,
  calcDeliveryCost,
  DELIVERY_COST,
  FREE_PVZ_THRESHOLD,
  FREE_COURIER_THRESHOLD,
  type OrderCalcInput,
  type PriceList,
  type DeliveryMethod,
  type AppliedPromo,
} from './order-totals'

const COSMETOLOGIST_PROMO: AppliedPromo = { code: 'DOC15', percent: 15 }

const order = (over: Partial<OrderCalcInput> = {}): OrderCalcInput => ({
  items: [{ price: 100_000, quantity: 1 }],
  priceList: 'retail' as PriceList,
  deliveryMethod: 'pickup' as DeliveryMethod,
  ...over,
})

describe('Сумма товаров', () => {
  it('пустая корзина даёт нулевой итог, а не ошибку', () => {
    expect(calcOrderTotals(order({ items: [] }))).toEqual({
      subtotal: 0,
      promoDiscount: 0,
      deliveryCost: 0,
      total: 0,
    })
  })

  it('один товар считается по своей цене в копейках', () => {
    const t = calcOrderTotals(order({ items: [{ price: 807_700, quantity: 1 }] }))
    expect(t.subtotal).toBe(807_700)
    expect(t.total).toBe(807_700)
  })

  it('несколько позиций складываются', () => {
    const t = calcOrderTotals(
      order({
        items: [
          { price: 807_700, quantity: 1 },
          { price: 120_000, quantity: 1 },
          { price: 45_050, quantity: 1 },
        ],
      })
    )
    expect(t.subtotal).toBe(972_750)
  })

  it('количество больше одного умножает цену позиции', () => {
    const t = calcOrderTotals(order({ items: [{ price: 807_700, quantity: 3 }] }))
    expect(t.subtotal).toBe(2_423_100)
  })
})

describe('Промокод косметолога (15%)', () => {
  it('на розничном прайсе снимает ровно 15% от суммы товаров', () => {
    const t = calcOrderTotals(
      order({
        items: [{ price: 800_000, quantity: 1 }],
        priceList: 'retail',
        promo: COSMETOLOGIST_PROMO,
      })
    )
    expect(t.promoDiscount).toBe(120_000)
    expect(t.total).toBe(680_000)
  })

  it('дробная копейка в скидке округляется до целой, итог сходится с точностью до копейки', () => {
    // 8077 * 0.15 = 1211.55 → 1212 копеек
    const t = calcOrderTotals(
      order({
        items: [{ price: 8_077, quantity: 1 }],
        priceList: 'retail',
        promo: COSMETOLOGIST_PROMO,
        deliveryMethod: 'pickup',
      })
    )
    expect(t.subtotal).toBe(8_077)
    expect(t.promoDiscount).toBe(1_212)
    expect(t.total).toBe(6_865)
    expect(Number.isInteger(t.total)).toBe(true)
    expect(t.total).toBe(t.subtotal - t.promoDiscount + t.deliveryCost)
  })

  it('скидка считается от всей корзины, а не по каждой позиции отдельно', () => {
    const t = calcOrderTotals(
      order({
        items: [
          { price: 8_077, quantity: 1 },
          { price: 8_077, quantity: 1 },
        ],
        priceList: 'retail',
        promo: COSMETOLOGIST_PROMO,
      })
    )
    // 16154 * 0.15 = 2423.1 → 2423, а не 1212 * 2 = 2424
    expect(t.promoDiscount).toBe(2_423)
  })

  it('на профессиональном прайсе промокод не применяется никогда', () => {
    const t = calcOrderTotals(
      order({
        items: [{ price: 800_000, quantity: 1 }],
        priceList: 'professional',
        promo: COSMETOLOGIST_PROMO,
      })
    )
    expect(t.promoDiscount).toBe(0)
    expect(t.total).toBe(800_000)
  })

  it('на профессиональном прайсе скидка равна нулю даже при промокоде на 100%', () => {
    const t = calcOrderTotals(
      order({
        items: [{ price: 800_000, quantity: 1 }],
        priceList: 'professional',
        promo: { code: 'ALL', percent: 100 },
      })
    )
    expect(t.promoDiscount).toBe(0)
    expect(t.total).toBe(800_000)
  })

  it('без промокода (undefined) скидки нет', () => {
    const t = calcOrderTotals(order({ items: [{ price: 500_000, quantity: 1 }], promo: undefined }))
    expect(t.promoDiscount).toBe(0)
  })

  it('без промокода (null) скидки нет', () => {
    const t = calcOrderTotals(order({ items: [{ price: 500_000, quantity: 1 }], promo: null }))
    expect(t.promoDiscount).toBe(0)
  })
})

describe('Стоимость доставки', () => {
  it('самовывоз бесплатен при нулевой корзине', () => {
    expect(calcDeliveryCost('pickup', 0)).toBe(0)
  })

  it('самовывоз бесплатен и при сумме ниже любого порога', () => {
    expect(calcDeliveryCost('pickup', 1)).toBe(0)
  })

  it('самовывоз бесплатен при сумме выше всех порогов', () => {
    expect(calcDeliveryCost('pickup', FREE_COURIER_THRESHOLD + 1)).toBe(0)
  })

  it('пункт выдачи платный ниже порога 6 000 ₽', () => {
    expect(calcDeliveryCost('pvz', FREE_PVZ_THRESHOLD - 1)).toBe(DELIVERY_COST)
  })

  it('пункт выдачи бесплатен ровно на пороге 6 000 ₽', () => {
    expect(calcDeliveryCost('pvz', FREE_PVZ_THRESHOLD)).toBe(0)
  })

  it('пункт выдачи бесплатен выше порога', () => {
    expect(calcDeliveryCost('pvz', FREE_PVZ_THRESHOLD + 1)).toBe(0)
  })

  it('курьер платный ниже порога 10 000 ₽', () => {
    expect(calcDeliveryCost('courier', FREE_COURIER_THRESHOLD - 1)).toBe(DELIVERY_COST)
  })

  it('курьер бесплатен ровно на пороге 10 000 ₽', () => {
    expect(calcDeliveryCost('courier', FREE_COURIER_THRESHOLD)).toBe(0)
  })

  it('курьер бесплатен выше порога', () => {
    expect(calcDeliveryCost('courier', FREE_COURIER_THRESHOLD + 1)).toBe(0)
  })

  it('порог курьера выше порога пункта выдачи: на 6 000 ₽ пвз бесплатен, курьер — нет', () => {
    expect(calcDeliveryCost('pvz', 600_000)).toBe(0)
    expect(calcDeliveryCost('courier', 600_000)).toBe(DELIVERY_COST)
  })
})

describe('Порог бесплатной доставки считается от суммы ПОСЛЕ скидки', () => {
  it('скидка роняет корзину ниже порога пвз — доставка становится платной', () => {
    const t = calcOrderTotals(
      order({
        items: [{ price: 700_000, quantity: 1 }],
        priceList: 'retail',
        promo: COSMETOLOGIST_PROMO,
        deliveryMethod: 'pvz',
      })
    )
    expect(t.subtotal).toBe(700_000)
    expect(t.promoDiscount).toBe(105_000)
    expect(t.deliveryCost).toBe(DELIVERY_COST)
    expect(t.total).toBe(615_000)
  })

  it('после скидки ровно порог пвз — доставка бесплатна', () => {
    // 705 882 - round(15%) = 705 882 - 105 882 = 600 000
    const t = calcOrderTotals(
      order({
        items: [{ price: 705_882, quantity: 1 }],
        priceList: 'retail',
        promo: COSMETOLOGIST_PROMO,
        deliveryMethod: 'pvz',
      })
    )
    expect(t.promoDiscount).toBe(105_882)
    expect(t.deliveryCost).toBe(0)
    expect(t.total).toBe(600_000)
  })

  it('скидка роняет корзину ниже порога курьера — доставка становится платной', () => {
    const t = calcOrderTotals(
      order({
        items: [{ price: 1_100_000, quantity: 1 }],
        priceList: 'retail',
        promo: COSMETOLOGIST_PROMO,
        deliveryMethod: 'courier',
      })
    )
    expect(t.promoDiscount).toBe(165_000)
    expect(t.deliveryCost).toBe(DELIVERY_COST)
    expect(t.total).toBe(955_000)
  })

  it('на профессиональном прайсе скидки нет, поэтому порог доставки берётся от полной суммы', () => {
    const t = calcOrderTotals(
      order({
        items: [{ price: 700_000, quantity: 1 }],
        priceList: 'professional',
        promo: COSMETOLOGIST_PROMO,
        deliveryMethod: 'pvz',
      })
    )
    expect(t.deliveryCost).toBe(0)
    expect(t.total).toBe(700_000)
  })

  it('самовывоз бесплатен даже когда скидка обнулила корзину', () => {
    const t = calcOrderTotals(
      order({
        items: [{ price: 100_000, quantity: 1 }],
        priceList: 'retail',
        promo: { code: 'FULL', percent: 100 },
        deliveryMethod: 'pickup',
      })
    )
    expect(t.total).toBe(0)
  })
})

describe('Мусор на входе не ломает итог', () => {
  const cases: { name: string; percent: number }[] = [
    { name: 'ноль процентов', percent: 0 },
    { name: 'больше 100 процентов', percent: 150 },
    { name: 'отрицательный процент', percent: -20 },
    { name: 'NaN', percent: Number.NaN },
    { name: 'Infinity', percent: Number.POSITIVE_INFINITY },
    { name: '-Infinity', percent: Number.NEGATIVE_INFINITY },
  ]

  for (const { name, percent } of cases) {
    it(`процент «${name}» не делает итог отрицательным или NaN`, () => {
      const t = calcOrderTotals(
        order({
          items: [{ price: 500_000, quantity: 2 }],
          priceList: 'retail',
          promo: { code: 'JUNK', percent },
          deliveryMethod: 'courier',
        })
      )
      expect(Number.isNaN(t.total)).toBe(false)
      expect(t.total).toBeGreaterThanOrEqual(0)
      expect(t.promoDiscount).toBeGreaterThanOrEqual(0)
      expect(t.promoDiscount).toBeLessThanOrEqual(t.subtotal)
    })
  }

  it('процент 0 и отрицательный процент не дают скидки вовсе', () => {
    for (const percent of [0, -20, Number.NaN, Number.POSITIVE_INFINITY]) {
      const t = calcOrderTotals(
        order({ items: [{ price: 500_000, quantity: 1 }], promo: { code: 'X', percent } })
      )
      expect(t.promoDiscount).toBe(0)
      expect(t.total).toBe(500_000)
    }
  })

  it('процент больше 100 срезается до 100 — корзина обнуляется, но не уходит в минус', () => {
    const t = calcOrderTotals(
      order({
        items: [{ price: 500_000, quantity: 1 }],
        priceList: 'retail',
        promo: { code: 'X', percent: 150 },
        deliveryMethod: 'pvz',
      })
    )
    expect(t.promoDiscount).toBe(500_000)
    expect(t.deliveryCost).toBe(DELIVERY_COST)
    expect(t.total).toBe(DELIVERY_COST)
  })
})

describe('Мусор в позициях корзины не ломает итог', () => {
  const junkItems: { name: string; item: { price: number; quantity: number } }[] = [
    { name: 'цена NaN', item: { price: Number.NaN, quantity: 2 } },
    { name: 'количество NaN', item: { price: 500_000, quantity: Number.NaN } },
    { name: 'цена Infinity', item: { price: Number.POSITIVE_INFINITY, quantity: 1 } },
    { name: 'цена -Infinity', item: { price: Number.NEGATIVE_INFINITY, quantity: 1 } },
    { name: 'количество Infinity', item: { price: 500_000, quantity: Number.POSITIVE_INFINITY } },
    { name: 'отрицательная цена', item: { price: -500_000, quantity: 1 } },
    { name: 'отрицательное количество', item: { price: 500_000, quantity: -3 } },
    { name: 'цена и количество отрицательные', item: { price: -500_000, quantity: -3 } },
  ]

  for (const { name, item } of junkItems) {
    it(`позиция «${name}» считается нулевой, а не портит сумму`, () => {
      const t = calcOrderTotals(order({ items: [item], deliveryMethod: 'pickup' }))
      expect(t.subtotal).toBe(0)
      expect(t.promoDiscount).toBe(0)
      expect(t.total).toBe(0)
    })

    it(`позиция «${name}» держит инвариант: итог конечный, целый и неотрицательный`, () => {
      const methods: DeliveryMethod[] = ['pickup', 'pvz', 'courier']
      for (const deliveryMethod of methods) {
        for (const priceList of ['retail', 'professional'] as PriceList[]) {
          const t = calcOrderTotals(
            order({ items: [item], priceList, promo: COSMETOLOGIST_PROMO, deliveryMethod })
          )
          expect(Number.isFinite(t.total)).toBe(true)
          expect(Number.isFinite(t.subtotal)).toBe(true)
          expect(t.total).toBeGreaterThanOrEqual(0)
          expect(t.subtotal).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(t.subtotal)).toBe(true)
          expect(Number.isInteger(t.promoDiscount)).toBe(true)
          expect(Number.isInteger(t.deliveryCost)).toBe(true)
          expect(Number.isInteger(t.total)).toBe(true)
          expect(t.total).toBe(t.subtotal - t.promoDiscount + t.deliveryCost)
        }
      }
    })
  }

  it('нормальная позиция рядом с мусорной считается корректно', () => {
    const t = calcOrderTotals(
      order({
        items: [
          { price: 807_700, quantity: 2 },
          { price: Number.NaN, quantity: 5 },
        ],
        deliveryMethod: 'pickup',
      })
    )
    expect(t.subtotal).toBe(1_615_400)
    expect(t.total).toBe(1_615_400)
  })

  it('несколько мусорных позиций подряд не сдвигают сумму нормальных', () => {
    const clean = calcOrderTotals(order({ items: [{ price: 8_077, quantity: 3 }] }))
    const dirty = calcOrderTotals(
      order({
        items: [
          { price: Number.POSITIVE_INFINITY, quantity: 1 },
          { price: 8_077, quantity: 3 },
          { price: -1_000, quantity: 4 },
          { price: 1_000, quantity: Number.NaN },
          { price: Number.NEGATIVE_INFINITY, quantity: -2 },
        ],
      })
    )
    expect(dirty.subtotal).toBe(clean.subtotal)
    expect(dirty.total).toBe(clean.total)
  })

  it('мусорная позиция не мешает скидке и порогу доставки нормальной позиции', () => {
    const t = calcOrderTotals(
      order({
        items: [
          { price: 700_000, quantity: 1 },
          { price: Number.NaN, quantity: Number.NaN },
        ],
        priceList: 'retail',
        promo: COSMETOLOGIST_PROMO,
        deliveryMethod: 'pvz',
      })
    )
    expect(t.subtotal).toBe(700_000)
    expect(t.promoDiscount).toBe(105_000)
    expect(t.deliveryCost).toBe(DELIVERY_COST)
    expect(t.total).toBe(615_000)
  })

  it('корзина целиком из мусора: платная доставка остаётся, итог не отрицательный', () => {
    const t = calcOrderTotals(
      order({
        items: [
          { price: Number.NaN, quantity: 1 },
          { price: -100, quantity: -1 },
        ],
        deliveryMethod: 'courier',
      })
    )
    expect(t.subtotal).toBe(0)
    expect(t.deliveryCost).toBe(DELIVERY_COST)
    expect(t.total).toBe(DELIVERY_COST)
    expect(t.total).toBeGreaterThanOrEqual(0)
  })
})

describe('Инвариант итога', () => {
  it('итог всегда равен товарам после скидки плюс доставка', () => {
    const methods: DeliveryMethod[] = ['pickup', 'pvz', 'courier']
    const lists: PriceList[] = ['retail', 'professional']
    for (const deliveryMethod of methods) {
      for (const priceList of lists) {
        for (const price of [0, 8_077, 599_999, 600_000, 999_999, 1_200_000]) {
          const t = calcOrderTotals(
            order({
              items: [{ price, quantity: 1 }],
              priceList,
              promo: COSMETOLOGIST_PROMO,
              deliveryMethod,
            })
          )
          expect(t.total).toBe(t.subtotal - t.promoDiscount + t.deliveryCost)
          expect(Number.isInteger(t.total)).toBe(true)
        }
      }
    }
  })
})
