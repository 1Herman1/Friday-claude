import { describe, expect, it } from 'vitest'
import { calcOrderTotals } from '@simba/shared'

// Цены и total — в копейках. bonusUsed / bonusEarned (scoins) — в рублях.

describe('calcOrderTotals', () => {
  it('считает subtotal и начисляет 5% Scoins без промокода и бонусов', () => {
    const r = calcOrderTotals({
      items: [
        { price: 50000, quantity: 2 },
        { price: 30000, quantity: 1 },
      ],
      availableBonus: 0,
    })

    expect(r).toEqual({
      subtotal: 130000,
      promoDiscount: 0,
      bonusUsed: 0,
      total: 130000,
      bonusEarned: 65,
    })
  })

  it('применяет промокод как 10% от subtotal', () => {
    const r = calcOrderTotals({
      items: [{ price: 99900, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      availableBonus: 0,
    })

    expect(r.promoDiscount).toBe(9990)
    expect(r.total).toBe(89910)
    expect(r.bonusEarned).toBe(44)
  })

  it('не даёт списать больше бонусов, чем на балансе', () => {
    const r = calcOrderTotals({
      items: [{ price: 500000, quantity: 1 }],
      bonusRequested: 1000,
      availableBonus: 120,
    })

    expect(r.bonusUsed).toBe(120)
    expect(r.total).toBe(500000 - 12000)
  })

  it('обрезает списание половиной чека', () => {
    const r = calcOrderTotals({
      items: [{ price: 100000, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      bonusRequested: 5000,
      availableBonus: 5000,
    })

    // subtotal 100000, скидка 10000 -> к оплате 90000 коп = 450 scoins максимум (50% лимит)
    expect(r.bonusUsed).toBe(450)
    expect(r.total).toBe(45000)
    expect(r.bonusEarned).toBe(22)
  })

  it('не уходит в минус при отрицательном запросе бонусов', () => {
    const r = calcOrderTotals({
      items: [{ price: 100000, quantity: 1 }],
      bonusRequested: -500,
      availableBonus: 500,
    })

    expect(r.bonusUsed).toBe(0)
    expect(r.total).toBe(100000)
  })

  it('deliveryCost входит в total, но не даёт кэшбэк', () => {
    const r = calcOrderTotals({
      items: [{ price: 100000, quantity: 1 }],
      availableBonus: 0,
      deliveryCost: 35000,
    })

    expect(r.total).toBe(135000)
    expect(r.bonusEarned).toBe(50)
  })

  it('бонусы покрывают товар и часть доставки, кэшбэк = 0', () => {
    const r = calcOrderTotals({
      items: [{ price: 10000, quantity: 1 }],
      deliveryCost: 90000,
      bonusRequested: 500,
      availableBonus: 500,
    })

    // товар 10000, доставка 90000 -> чек 100000 коп = 500 scoins максимум (50% лимит)
    expect(r.bonusUsed).toBe(500)
    expect(r.total).toBe(50000)
    expect(r.bonusEarned).toBe(0)
  })

  it('промокод + доставка: кэшбэк только от товаров', () => {
    const r = calcOrderTotals({
      items: [{ price: 100000, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      deliveryCost: 30000,
      availableBonus: 0,
    })

    expect(r.promoDiscount).toBe(10000)
    expect(r.total).toBe(120000)
    expect(r.bonusEarned).toBe(45)
  })

  it('промокод + бонусы + доставка: все три компонента одновременно', () => {
    const r = calcOrderTotals({
      items: [{ price: 100000, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      deliveryCost: 30000,
      bonusRequested: 500,
      availableBonus: 500,
    })

    // subtotal 100000, скидка 10000, доставка 30000
    // к оплате: 100000 - 10000 + 30000 = 120000
    // максимум бонусов: floor(120000 / 200) = 600, запрос 500 < 600 и < баланс 500 -> используем 500
    // итого: 120000 - 500*100 = 70000
    // кэшбэк: только с товаров (без доставки, после бонусов)
    // товаров оплачено: 100000 - 10000 - 500*100 = 40000
    // кэшбэк: floor((40000 / 100) * 0.05) = floor(20) = 20
    expect(r.subtotal).toBe(100000)
    expect(r.promoDiscount).toBe(10000)
    expect(r.bonusUsed).toBe(500)
    expect(r.total).toBe(70000)
    expect(r.bonusEarned).toBe(20)
  })
})

describe('calcOrderTotals — границы округления', () => {
  it('промо-скидка на ровной половине копейки округляется вверх (в пользу покупателя)', () => {
    // subtotal 1005 -> 1005 * 0.1 = 100.5 ровно -> Math.round -> 101
    const r = calcOrderTotals({
      items: [{ price: 1005, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      availableBonus: 0,
    })

    expect(r.promoDiscount).toBe(101)
    expect(r.total).toBe(904)
  })

  it('половина копейки округляется вверх и на крупной сумме', () => {
    // 999995 * 0.1 = 99999.5 -> 100000
    const r = calcOrderTotals({
      items: [{ price: 999995, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      availableBonus: 0,
    })

    expect(r.promoDiscount).toBe(100000)
    expect(r.total).toBe(899995)
  })

  it('промо-скидка на минимальной половине копейки: 25 коп -> 3 коп', () => {
    const r = calcOrderTotals({
      items: [{ price: 25, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      availableBonus: 0,
    })

    expect(r.promoDiscount).toBe(3)
    expect(r.total).toBe(22)
  })

  it('кэшбэк отбрасывает неполный рубль: 1999 коп -> 0 Scoins', () => {
    const r = calcOrderTotals({
      items: [{ price: 1999, quantity: 1 }],
      availableBonus: 0,
    })

    // floor(19.99 * 0.05) = floor(0.9995) = 0
    expect(r.bonusEarned).toBe(0)
    expect(r.total).toBe(1999)
  })

  it('следующая копейка уже даёт 1 Scoin: 2000 коп -> 1', () => {
    const r = calcOrderTotals({
      items: [{ price: 2000, quantity: 1 }],
      availableBonus: 0,
    })

    expect(r.bonusEarned).toBe(1)
  })

  it('кэшбэк не растёт на некратных 100 остатках: 2099 коп даёт столько же, сколько 2000', () => {
    const at2000 = calcOrderTotals({
      items: [{ price: 2000, quantity: 1 }],
      availableBonus: 0,
    })
    const at2099 = calcOrderTotals({
      items: [{ price: 2099, quantity: 1 }],
      availableBonus: 0,
    })

    expect(at2099.bonusEarned).toBe(at2000.bonusEarned)
  })

  it('стык округлений: промо округлилось вверх, кэшбэк — вниз', () => {
    // subtotal 1005: promo 101 (вверх), goodsPaid 904 -> floor(9.04 * 0.05) = 0
    const r = calcOrderTotals({
      items: [{ price: 1005, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      availableBonus: 0,
    })

    expect(r.promoDiscount).toBe(101)
    expect(r.bonusEarned).toBe(0)
  })

  it('лимит списания бонусов отбрасывает неполный рубль к оплате', () => {
    // к оплате 1999 коп -> максимум floor(1999/200) = 9 Scoins (50% лимит)
    const r = calcOrderTotals({
      items: [{ price: 1999, quantity: 1 }],
      bonusRequested: 100,
      availableBonus: 100,
    })

    expect(r.bonusUsed).toBe(9)
    expect(r.total).toBe(1099)
  })

  it('нулевой заказ не даёт ни скидки, ни кэшбэка', () => {
    const r = calcOrderTotals({
      items: [],
      promo: { type: 'percent', value: 10 },
      bonusRequested: 100,
      availableBonus: 100,
    })

    expect(r).toEqual({
      subtotal: 0,
      promoDiscount: 0,
      bonusUsed: 0,
      total: 0,
      bonusEarned: 0,
    })
  })
})

describe('calcOrderTotals — копейка не теряется и не появляется', () => {
  const cases: { name: string; input: Parameters<typeof calcOrderTotals>[0] }[] = [
    {
      name: 'ровная сумма без скидок',
      input: { items: [{ price: 130000, quantity: 1 }], availableBonus: 0 },
    },
    {
      // Усечение дробного запроса иначе держится на одном-единственном тесте:
      // здесь его стерегут сразу все инварианты таблицы, включая целочисленность.
      name: 'дробный запрос бонусов',
      input: {
        items: [{ price: 1000000, quantity: 1 }],
        bonusRequested: 10.7,
        availableBonus: 1000,
      },
    },
    {
      name: 'промо с округлением вверх на .5',
      input: {
        items: [{ price: 1005, quantity: 1 }],
        promo: { type: 'percent', value: 10 },
        availableBonus: 0,
      },
    },
    {
      name: 'промо с округлением вниз',
      input: {
        items: [{ price: 1004, quantity: 1 }],
        promo: { type: 'percent', value: 10 },
        availableBonus: 0,
      },
    },
    {
      name: 'некратный сотне остаток + бонусы',
      input: {
        items: [{ price: 1999, quantity: 1 }],
        bonusRequested: 100,
        availableBonus: 100,
      },
    },
    {
      name: 'промо + бонусы + доставка',
      input: {
        items: [{ price: 100000, quantity: 1 }],
        promo: { type: 'percent', value: 10 },
        deliveryCost: 30000,
        bonusRequested: 500,
        availableBonus: 500,
      },
    },
    {
      name: 'бонусы обрезаются лимитом половины чека',
      input: {
        items: [{ price: 100000, quantity: 1 }],
        promo: { type: 'percent', value: 10 },
        bonusRequested: 5000,
        availableBonus: 5000,
      },
    },
    {
      name: 'лимит считает доставку в чеке',
      input: {
        items: [{ price: 10000, quantity: 1 }],
        deliveryCost: 90000,
        bonusRequested: 500,
        availableBonus: 500,
      },
    },
    {
      name: 'нечётные копейки в нескольких позициях',
      input: {
        items: [
          { price: 333, quantity: 3 },
          { price: 777, quantity: 2 },
        ],
        promo: { type: 'percent', value: 10 },
        bonusRequested: 5,
        availableBonus: 5,
        deliveryCost: 199,
      },
    },
    {
      name: 'отрицательный запрос бонусов',
      input: {
        items: [{ price: 100000, quantity: 1 }],
        bonusRequested: -500,
        availableBonus: 500,
      },
    },
  ]

  it.each(cases)(
    'total + бонусы + промо = subtotal + доставка ($name)',
    ({ input }) => {
      const r = calcOrderTotals(input)
      const delivery = input.deliveryCost ?? 0

      expect(r.total + r.bonusUsed * 100 + r.promoDiscount).toBe(
        r.subtotal + delivery
      )
    }
  )

  it.each(cases)('total никогда не отрицателен ($name)', ({ input }) => {
    expect(calcOrderTotals(input).total).toBeGreaterThanOrEqual(0)
  })

  it.each(cases)(
    'списано бонусов не больше баланса и не больше 50% чека ($name)',
    ({ input }) => {
      const r = calcOrderTotals(input)
      const delivery = input.deliveryCost ?? 0

      expect(r.bonusUsed).toBeLessThanOrEqual(input.availableBonus)
      expect(r.bonusUsed * 100 * 2).toBeLessThanOrEqual(
        r.subtotal - r.promoDiscount + delivery
      )
    }
  )

  it.each(cases)('все поля результата — целые числа ($name)', ({ input }) => {
    const r = calcOrderTotals(input)

    expect(Number.isInteger(r.subtotal)).toBe(true)
    expect(Number.isInteger(r.promoDiscount)).toBe(true)
    expect(Number.isInteger(r.bonusUsed)).toBe(true)
    expect(Number.isInteger(r.total)).toBe(true)
    expect(Number.isInteger(r.bonusEarned)).toBe(true)
  })
})

describe('правила бонусной программы', () => {
  it('начисляет 5% от товаров, не требуя бонусов', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      availableBonus: 0,
    })

    expect(r.bonusUsed).toBe(0)
    expect(r.total).toBe(1000000)
    expect(r.bonusEarned).toBe(500)
  })

  it('доставка не влияет на начисление (начислено от товаров только)', () => {
    const withoutDelivery = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      availableBonus: 0,
    })
    const withDelivery = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      deliveryCost: 50000,
      availableBonus: 0,
    })

    expect(withDelivery.total).toBe(1050000)
    expect(withDelivery.bonusEarned).toBe(withoutDelivery.bonusEarned)
    expect(withDelivery.bonusEarned).toBe(500)
  })

  it('доставка влияет на лимит списания (входит в чек)', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      deliveryCost: 50000,
      bonusRequested: 1000,
      availableBonus: 10000,
    })

    expect(r.bonusUsed).toBe(1000)
    expect(r.total).toBe(950000)
    expect(r.bonusEarned).toBe(450)
  })

  // Границы лимита: бонусы срабатывают как min() из трёх
  it('лимит половины чека — ровно 50% проходит целиком', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      bonusRequested: 5000,
      availableBonus: 10000,
    })

    // чек 1000000, 50% = 5000
    expect(r.bonusUsed).toBe(5000)
    expect(r.total).toBe(500000)
    expect(r.bonusEarned).toBe(250)
  })

  it('запрос больше лимита — обрезается по лимиту', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      bonusRequested: 5001,
      availableBonus: 10000,
    })

    expect(r.bonusUsed).toBe(5000)
    expect(r.total).toBe(500000)
    expect(r.bonusEarned).toBe(250)
  })

  it('запрос в пределах лимита — обрезается по балансу', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      bonusRequested: 5000,
      availableBonus: 300,
    })

    expect(r.bonusUsed).toBe(300)
    expect(r.total).toBe(970000)
    expect(r.bonusEarned).toBe(485)
  })

  it('баланс < лимит — сработает баланс первым', () => {
    const r = calcOrderTotals({
      items: [{ price: 100000, quantity: 1 }],
      bonusRequested: 900,
      availableBonus: 300,
    })

    // чек 100000, 50% = 500; запрос 900 > 500; баланс 300 < 500
    expect(r.bonusUsed).toBe(300)
    expect(r.total).toBe(70000)
    expect(r.bonusEarned).toBe(35)
  })

  it('запрос < баланс, баланс < лимит — сработает запрос', () => {
    const r = calcOrderTotals({
      items: [{ price: 100000, quantity: 1 }],
      bonusRequested: 900,
      availableBonus: 900,
    })

    // чек 100000, 50% = 500; запрос 900 > 500; баланс 900 > 500 -> min даст 500
    expect(r.bonusUsed).toBe(500)
    expect(r.total).toBe(50000)
    expect(r.bonusEarned).toBe(25)
  })

  // Округление лимита вниз
  it('лимит округляется вниз: 499.5 ₽ -> 499', () => {
    const r = calcOrderTotals({
      items: [{ price: 99900, quantity: 1 }],
      bonusRequested: 1000,
      availableBonus: 1000,
    })

    // чек 99900, 50% = 499.5 -> floor = 499
    expect(r.bonusUsed).toBe(499)
    expect(r.total).toBe(50000)
    expect(r.bonusEarned).toBe(25)
  })

  it('чек меньше 200 копеек — лимит = 0', () => {
    const r = calcOrderTotals({
      items: [{ price: 199, quantity: 1 }],
      bonusRequested: 100,
      availableBonus: 100,
    })

    // чек 199, 50% = 99.5 -> floor = 0
    expect(r.bonusUsed).toBe(0)
    expect(r.total).toBe(199)
    expect(r.bonusEarned).toBe(0)
  })

  it('чек ровно 200 копеек — лимит = 1', () => {
    const r = calcOrderTotals({
      items: [{ price: 200, quantity: 1 }],
      bonusRequested: 100,
      availableBonus: 100,
    })

    // чек 200, 50% = 100 -> 1
    expect(r.bonusUsed).toBe(1)
    expect(r.total).toBe(100)
    expect(r.bonusEarned).toBe(0)
  })

  it('чек 299 копеек — лимит = 1', () => {
    const r = calcOrderTotals({
      items: [{ price: 299, quantity: 1 }],
      bonusRequested: 100,
      availableBonus: 100,
    })

    // чек 299, 50% = 149.5 -> floor = 1
    expect(r.bonusUsed).toBe(1)
    expect(r.total).toBe(199)
    expect(r.bonusEarned).toBe(0)
  })

  // Промокод SIMBA10
  it('промокод 10% + доставка: начисление от товаров после скидки', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      deliveryCost: 50000,
      bonusRequested: 0,
      availableBonus: 0,
    })

    expect(r.promoDiscount).toBe(100000)
    expect(r.bonusUsed).toBe(0)
    expect(r.total).toBe(950000)
    expect(r.bonusEarned).toBe(450)
  })

  it('промокод + запрос ровно в лимит', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      deliveryCost: 50000,
      bonusRequested: 4750,
      availableBonus: 10000,
    })

    // чек = 1000000 - 100000 + 50000 = 950000, 50% = 4750
    expect(r.promoDiscount).toBe(100000)
    expect(r.bonusUsed).toBe(4750)
    expect(r.total).toBe(475000)
    expect(r.bonusEarned).toBe(212)
  })

  it('промокод + запрос на 1 больше лимита', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      deliveryCost: 50000,
      bonusRequested: 4751,
      availableBonus: 10000,
    })

    expect(r.promoDiscount).toBe(100000)
    expect(r.bonusUsed).toBe(4750)
    expect(r.total).toBe(475000)
    expect(r.bonusEarned).toBe(212)
  })

  it('лимит считается от чека (с доставкой), не от суммы ДО промокода', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      promo: { type: 'percent', value: 10 },
      deliveryCost: 50000,
      bonusRequested: 5250,
      availableBonus: 10000,
    })

    // если бы лимит был от товаров: 1000000 * 0.5 = 500000 -> 5000 scoins
    // на самом деле лимит от чека: (1000000 - 100000 + 50000) * 0.5 = 475000 -> 4750 scoins
    expect(r.bonusUsed).toBe(4750)
    expect(r.total).toBe(475000)
  })

  // Вырожденные случаи
  it('пустой заказ с промокодом: всё нули', () => {
    const r = calcOrderTotals({
      items: [],
      promo: { type: 'percent', value: 10 },
      bonusRequested: 100,
      availableBonus: 100,
    })

    expect(r.subtotal).toBe(0)
    expect(r.promoDiscount).toBe(0)
    expect(r.bonusUsed).toBe(0)
    expect(r.total).toBe(0)
    expect(r.bonusEarned).toBe(0)
  })

  it('отрицательный запрос бонусов — игнорируется', () => {
    const r = calcOrderTotals({
      items: [{ price: 100000, quantity: 1 }],
      bonusRequested: -500,
      availableBonus: 500,
    })

    expect(r.bonusUsed).toBe(0)
    expect(r.total).toBe(100000)
    expect(r.bonusEarned).toBe(50)
  })

  it('дробный запрос бонусов усекается вниз', () => {
    const r = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      bonusRequested: 10.7,
      availableBonus: 1000,
    })

    // floor(10.7) = 10
    expect(r.bonusUsed).toBe(10)
    expect(r.total).toBe(999000)
    expect(r.bonusEarned).toBe(499)
  })

  it('доставка без товаров: лимит считается от доставки', () => {
    const r = calcOrderTotals({
      items: [],
      deliveryCost: 50000,
      bonusRequested: 1000,
      availableBonus: 1000,
    })

    // чек = 50000, 50% = 250
    expect(r.bonusUsed).toBe(250)
    expect(r.total).toBe(25000)
    expect(r.bonusEarned).toBe(0)
  })

  it('большой объём товаров: не переполняется', () => {
    const r = calcOrderTotals({
      items: [{ price: 100, quantity: 999999 }],
      bonusRequested: 0,
      availableBonus: 0,
    })

    // subtotal 99999900, начисление floor(99999900/100 * 0.05) = 49999
    expect(r.subtotal).toBe(99999900)
    expect(r.bonusUsed).toBe(0)
    expect(r.total).toBe(99999900)
    expect(r.bonusEarned).toBe(49999)
  })

  it('максимальный запрос на большом объёме', () => {
    const r = calcOrderTotals({
      items: [{ price: 100, quantity: 999999 }],
      bonusRequested: 999999,
      availableBonus: 999999,
    })

    // чек 99999900, 50% = 499999; баланс 999999; запрос 999999
    // min(999999, 499999, 999999) = 499999
    expect(r.bonusUsed).toBe(499999)
    expect(r.total).toBe(50000000)
    expect(r.bonusEarned).toBe(25000)
  })

  it('микрозаказ: лимит < 1 scoin', () => {
    const r = calcOrderTotals({
      items: [{ price: 100, quantity: 1 }],
      bonusRequested: 1000,
      availableBonus: 1000,
    })

    // чек 100, 50% = 50 копеек = 0 scoins
    expect(r.bonusUsed).toBe(0)
    expect(r.total).toBe(100)
    expect(r.bonusEarned).toBe(0)
  })

  it('начисление не зависит от доставки (3 варианта доставки)', () => {
    const zero = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      bonusRequested: 0,
      availableBonus: 0,
    })
    const withSmallDelivery = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      deliveryCost: 50000,
      bonusRequested: 0,
      availableBonus: 0,
    })
    const withBigDelivery = calcOrderTotals({
      items: [{ price: 1000000, quantity: 1 }],
      deliveryCost: 500000,
      bonusRequested: 0,
      availableBonus: 0,
    })

    expect(zero.bonusEarned).toBe(500)
    expect(withSmallDelivery.bonusEarned).toBe(500)
    expect(withBigDelivery.bonusEarned).toBe(500)
  })
})
