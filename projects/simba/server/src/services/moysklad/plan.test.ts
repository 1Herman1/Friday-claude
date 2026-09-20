import { describe, expect, it } from 'vitest'
import {
  normalizeArticle,
  matchVariants,
  extractPrice,
  buildPlan,
  checkAnomaly,
  type VariantForSync,
} from './plan'
import type { MsAssortmentItem } from './types'

// Цены — в копейках (389000 = 3890 ₽). Тип цены на боевом аккаунте один: "Цена (Сайт)".
const PRICE_TYPE = 'Цена (Сайт)'

function ms(overrides: Partial<MsAssortmentItem> & { id: string }): MsAssortmentItem {
  return {
    meta: { type: 'product' },
    name: 'Товар',
    ...overrides,
  }
}

function ourVariant(overrides: Partial<VariantForSync> & { id: string }): VariantForSync {
  return {
    sku: null,
    moyskladId: null,
    price: 0,
    stock: 0,
    productId: 'p1',
    ...overrides,
  }
}

describe('normalizeArticle', () => {
  it('снимает ведущие нули у чисто числового артикула', () => {
    expect(normalizeArticle('00123')).toBe('123')
  })

  it('артикул из одних нулей не превращается в пустую строку', () => {
    expect(normalizeArticle('000')).toBe('0')
  })

  it('не снимает нули у смешанного артикула', () => {
    expect(normalizeArticle('0012ab')).toBe('0012ab')
  })

  it('убирает пробелы по краям и внутри', () => {
    expect(normalizeArticle('  AB 12  ')).toBe('ab12')
  })

  it('убирает неразрывный пробел U+00A0', () => {
    expect(normalizeArticle('AB 12')).toBe('ab12')
  })

  it('приводит регистр к нижнему', () => {
    expect(normalizeArticle('SiMbA-1')).toBe('simba-1')
  })

  it('пустая строка, null и undefined дают пустой ключ', () => {
    expect(normalizeArticle('')).toBe('')
    expect(normalizeArticle(null)).toBe('')
    expect(normalizeArticle(undefined)).toBe('')
  })

  it('строка из одних пробелов даёт пустой ключ', () => {
    expect(normalizeArticle('   ')).toBe('')
  })

  it('числовой артикул с пробелом внутри нормализуется как число', () => {
    expect(normalizeArticle('00\u00A0123')).toBe('123')
  })
})

describe('matchVariants', () => {
  it('привязка по moyskladId имеет приоритет над артикулом', () => {
    const byId = ms({ id: 'ms-id', article: 'ZZZ', name: 'По id' })
    const byArticle = ms({ id: 'ms-art', article: 'A1', name: 'По артикулу' })
    const v = ourVariant({ id: 'v1', sku: 'A1', moyskladId: 'ms-id' })

    const r = matchVariants([v], [byId, byArticle])

    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].ms.id).toBe('ms-id')
    expect(r.links).toEqual([{ variantId: 'v1', moyskladId: 'ms-id' }])
    expect(r.onlyInMs.map((i) => i.id)).toEqual(['ms-art'])
  })

  it('матчит по article', () => {
    const item = ms({ id: 'm1', article: '00123' })
    const r = matchVariants([ourVariant({ id: 'v1', sku: '123' })], [item])

    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].ms.id).toBe('m1')
    expect(r.unmatchedOurs).toHaveLength(0)
  })

  it('при пустом article матчит по code', () => {
    const item = ms({ id: 'm1', article: '', code: 'CODE-7' })
    const r = matchVariants([ourVariant({ id: 'v1', sku: 'code-7' })], [item])

    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].ms.id).toBe('m1')
  })

  it('игнорирует bundle и service, матчит product и variant', () => {
    const items = [
      ms({ id: 'b1', meta: { type: 'bundle' }, article: 'A1', name: 'Комплект' }),
      ms({ id: 's1', meta: { type: 'service' }, article: 'A2', name: 'Услуга' }),
      ms({ id: 'p1', meta: { type: 'product' }, article: 'A3' }),
      ms({ id: 'x1', meta: { type: 'variant' }, article: 'A4' }),
    ]
    const ours = [
      ourVariant({ id: 'v-b', sku: 'A1' }),
      ourVariant({ id: 'v-s', sku: 'A2' }),
      ourVariant({ id: 'v-p', sku: 'A3' }),
      ourVariant({ id: 'v-x', sku: 'A4' }),
    ]

    const r = matchVariants(ours, items)

    expect(r.matched.map((m) => m.variant.id).sort()).toEqual(['v-p', 'v-x'])
    expect(r.unmatchedOurs.map((v) => v.id).sort()).toEqual(['v-b', 'v-s'])
    expect(r.onlyInMs.map((i) => i.id)).toEqual([])
  })

  it('bundle не подхватывается даже по moyskladId', () => {
    const bundle = ms({ id: 'b1', meta: { type: 'bundle' }, article: 'A1' })
    const r = matchVariants([ourVariant({ id: 'v1', moyskladId: 'b1' })], [bundle])

    expect(r.matched).toHaveLength(0)
    expect(r.unmatchedOurs.map((v) => v.id)).toEqual(['v1'])
  })

  it('неоднозначный ключ: обе позиции МС в ambiguous, наш вариант не привязан', () => {
    const items = [
      ms({ id: 'm1', article: '00123', name: 'Первый' }),
      ms({ id: 'm2', article: '123', name: 'Второй' }),
    ]
    const r = matchVariants([ourVariant({ id: 'v1', sku: '123' })], items)

    expect(r.matched).toHaveLength(0)
    expect(r.links).toHaveLength(0)
    expect(r.unmatchedOurs.map((v) => v.id)).toEqual(['v1'])
    expect(r.ambiguous).toEqual([{ key: '123', names: ['Первый', 'Второй'] }])
    expect(r.onlyInMs.map((i) => i.id).sort()).toEqual(['m1', 'm2'])
  })

  it('наш вариант с sku: null попадает в unmatchedOurs и не роняет матчинг', () => {
    const item = ms({ id: 'm1', article: 'A1' })
    const r = matchVariants([ourVariant({ id: 'v1', sku: null })], [item])

    expect(r.unmatchedOurs.map((v) => v.id)).toEqual(['v1'])
    expect(r.matched).toHaveLength(0)
    expect(r.onlyInMs.map((i) => i.id)).toEqual(['m1'])
  })

  it('позиция МС без article и без code игнорируется при матчинге', () => {
    const noKey = ms({ id: 'm-nokey' })
    const r = matchVariants([ourVariant({ id: 'v1', sku: '' })], [noKey])

    expect(r.matched).toHaveLength(0)
    expect(r.ambiguous).toHaveLength(0)
    expect(r.onlyInMs.map((i) => i.id)).toEqual(['m-nokey'])
  })

  it('две позиции МС без ключа не считаются неоднозначными', () => {
    const r = matchVariants([], [ms({ id: 'm1' }), ms({ id: 'm2' })])
    expect(r.ambiguous).toHaveLength(0)
  })
})

describe('extractPrice', () => {
  it('берёт цену нужного типа среди нескольких', () => {
    const item = ms({
      id: 'm1',
      salePrices: [
        { value: 500000, priceType: { name: 'Цена продажи' } },
        { value: 389000, priceType: { name: PRICE_TYPE } },
      ],
    })
    expect(extractPrice(item, PRICE_TYPE)).toBe(389000)
  })

  it('при отсутствии нужного типа берёт первую цену', () => {
    const item = ms({
      id: 'm1',
      salePrices: [{ value: 250000, priceType: { name: 'Оптовая' } }],
    })
    expect(extractPrice(item, PRICE_TYPE)).toBe(250000)
  })

  it('пустой salePrices → null', () => {
    expect(extractPrice(ms({ id: 'm1', salePrices: [] }), PRICE_TYPE)).toBeNull()
  })

  it('отсутствующий salePrices → null', () => {
    expect(extractPrice(ms({ id: 'm1' }), PRICE_TYPE)).toBeNull()
  })

  it('нулевая цена нужного типа не считается ценой', () => {
    const item = ms({
      id: 'm1',
      salePrices: [{ value: 0, priceType: { name: PRICE_TYPE } }],
    })
    expect(extractPrice(item, PRICE_TYPE)).toBeNull()
  })

  it('если нужный тип нулевой, а первая цена ненулевая — берётся первая', () => {
    const item = ms({
      id: 'm1',
      salePrices: [
        { value: 250000, priceType: { name: 'Оптовая' } },
        { value: 0, priceType: { name: PRICE_TYPE } },
      ],
    })
    expect(extractPrice(item, PRICE_TYPE)).toBe(250000)
  })
})

describe('buildPlan', () => {
  const MAX_DROP = 50

  function pair(
    variant: Partial<VariantForSync> & { id: string },
    item: Partial<MsAssortmentItem> & { id: string }
  ) {
    return [{ variant: ourVariant(variant), ms: ms(item) }]
  }

  function withPrice(id: string, value: number, name = 'Товар') {
    return { id, name, salePrices: [{ value, priceType: { name: PRICE_TYPE } }] }
  }

  it('текущая цена 0 → новая цена принимается, правило падения не применяется', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 0 }, withPrice('m1', 389000)),
      new Map(),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].skipReason).toBeUndefined()
    expect(plan[0].newPrice).toBe(389000)
    expect(plan[0].oldPrice).toBe(0)
  })

  it('падение больше порога → skipReason priceDrop, цена не применяется', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 100000 }, withPrice('m1', 40000)),
      new Map(),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].skipReason).toBe('priceDrop')
    expect(plan[0].oldPrice).toBe(100000)
  })

  it('падение ровно на порог (50%) НЕ блокируется — цена применяется', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 100000 }, withPrice('m1', 50000)),
      new Map(),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].skipReason).toBeUndefined()
    expect(plan[0].newPrice).toBe(50000)
  })

  it('цена в МС 0 → skipReason zeroPrice', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 100000 }, withPrice('m1', 0)),
      new Map(),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].skipReason).toBe('zeroPrice')
    expect(plan[0].newPrice).toBeNull()
  })

  it('цена в МС отсутствует → skipReason zeroPrice', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 100000 }, { id: 'm1' }),
      new Map(),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].skipReason).toBe('zeroPrice')
    expect(plan[0].newPrice).toBeNull()
  })

  it('остаток обновляется всегда, включая позиции со skipReason', () => {
    const stock = new Map([
      ['m-drop', 7],
      ['m-zero', 3],
      ['m-ok', 5],
    ])
    const plan = buildPlan(
      [
        { variant: ourVariant({ id: 'v-drop', price: 100000, stock: 0 }), ms: ms(withPrice('m-drop', 40000)) },
        { variant: ourVariant({ id: 'v-zero', price: 100000, stock: 0 }), ms: ms(withPrice('m-zero', 0)) },
        { variant: ourVariant({ id: 'v-ok', price: 100000, stock: 0 }), ms: ms(withPrice('m-ok', 120000)) },
      ],
      stock,
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan.map((e) => [e.variantId, e.skipReason, e.newStock])).toEqual([
      ['v-drop', 'priceDrop', 7],
      ['v-zero', 'zeroPrice', 3],
      ['v-ok', undefined, 5],
    ])
  })

  it('остатка нет в карте → 0 (МС отдаёт только ненулевые остатки)', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 100000, stock: 12 }, withPrice('m1', 120000)),
      new Map(),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].oldStock).toBe(12)
    expect(plan[0].newStock).toBe(0)
  })

  it('дробный остаток весового товара округляется вниз', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 100000 }, withPrice('m1', 120000)),
      new Map([['m1', 2.7]]),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].newStock).toBe(2)
  })

  it('отрицательный остаток превращается в 0', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 100000 }, withPrice('m1', 120000)),
      new Map([['m1', -5]]),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].newStock).toBe(0)
  })

  it('рост цены любой величины не блокируется', () => {
    const plan = buildPlan(
      pair({ id: 'v1', price: 100000 }, withPrice('m1', 10000000)),
      new Map(),
      PRICE_TYPE,
      MAX_DROP
    )

    expect(plan[0].skipReason).toBeUndefined()
    expect(plan[0].newPrice).toBe(10000000)
  })

  it('пустой список сопоставлений даёт пустой план', () => {
    expect(buildPlan([], new Map(), PRICE_TYPE, MAX_DROP)).toEqual([])
  })
})

describe('checkAnomaly', () => {
  function entry(overrides: Partial<import('./plan').PlanEntry> = {}) {
    return {
      variantId: 'v',
      name: 'Товар',
      oldPrice: 100000,
      newPrice: 120000,
      oldStock: 0,
      newStock: 0,
      ...overrides,
    }
  }

  it('доля считается от общего числа позиций плана', () => {
    const plan = [
      entry({ variantId: 'v1' }),
      entry({ variantId: 'v2', newPrice: 100000 }),
      entry({ variantId: 'v3', newPrice: 100000 }),
      entry({ variantId: 'v4', newPrice: 100000 }),
    ]
    const r = checkAnomaly(plan, 50)

    expect(r).toEqual({ ok: true, changedPercent: 25, changed: 1, total: 4 })
  })

  it('превышение порога → ok: false', () => {
    const plan = [entry({ variantId: 'v1' }), entry({ variantId: 'v2' })]
    const r = checkAnomaly(plan, 50)

    expect(r.changedPercent).toBe(100)
    expect(r.ok).toBe(false)
  })

  it('ровно на пороге считается допустимым', () => {
    const plan = [entry({ variantId: 'v1' }), entry({ variantId: 'v2', newPrice: 100000 })]
    const r = checkAnomaly(plan, 50)

    expect(r.changedPercent).toBe(50)
    expect(r.ok).toBe(true)
  })

  it('позиции со skipReason не считаются изменёнными, но входят в total', () => {
    const plan = [
      entry({ variantId: 'v1', skipReason: 'priceDrop', newPrice: 40000 }),
      entry({ variantId: 'v2', skipReason: 'zeroPrice', newPrice: null }),
    ]
    const r = checkAnomaly(plan, 10)

    expect(r).toEqual({ ok: true, changedPercent: 0, changed: 0, total: 2 })
  })

  it('пустой план не даёт NaN и не считается аномалией', () => {
    const r = checkAnomaly([], 50)

    expect(Number.isNaN(r.changedPercent)).toBe(false)
    expect(r).toEqual({ ok: true, changedPercent: 0, changed: 0, total: 0 })
  })
})
