import { describe, it, expect } from 'vitest'
import {
  parseDiscontinuedFile,
  planDiscontinue,
  type DiscontinuedFile,
  type DiscontinuePlan,
  type PlanProduct,
} from '../lib/discontinue.plan.js'

const file: DiscontinuedFile = {
  _meta: { decided: '2026-10-12', source: 'тест', note: 'тест' },
  products: ['bb', 'orange', 'missing', 'dup'],
  variants: [
    { product: 'natural-cleansing', volume: 200, note: 'тест' },
    { product: 'natural-cleansing', volume: 999, note: 'тест' },
    { product: 'nope', volume: 1, note: 'тест' },
  ],
}

const rows: PlanProduct[] = [
  {
    id: 'p-bb',
    slug: 'bb',
    isActive: true,
    isProfessional: false,
    popularPin: 3,
    cartItemCount: 2,
    variants: [{ id: 'v-bb-50', volumeValue: 50, isActive: true, isProfessional: false, cartItemCount: 2 }],
  },
  {
    id: 'p-orange',
    slug: 'orange',
    isActive: false,
    isProfessional: true,
    popularPin: null,
    cartItemCount: 0,
    variants: [{ id: 'v-orange-15', volumeValue: 15, isActive: false, isProfessional: true, cartItemCount: 0 }],
  },
  {
    id: 'p-dup-1',
    slug: 'dup',
    isActive: true,
    isProfessional: false,
    popularPin: null,
    cartItemCount: 0,
    variants: [],
  },
  {
    id: 'p-dup-2',
    slug: 'dup',
    isActive: true,
    isProfessional: false,
    popularPin: null,
    cartItemCount: 0,
    variants: [],
  },
  {
    id: 'p-nc',
    slug: 'natural-cleansing',
    isActive: true,
    isProfessional: false,
    popularPin: null,
    cartItemCount: 0,
    variants: [
      { id: 'v-nc-200', volumeValue: 200, isActive: true, isProfessional: false, cartItemCount: 1 },
      { id: 'v-nc-500', volumeValue: 500, isActive: true, isProfessional: true, cartItemCount: 0 },
    ],
  },
]

function applyToRows(source: PlanProduct[], plan: DiscontinuePlan): PlanProduct[] {
  return source.map((row) => {
    const discontinued = plan.productIds.includes(row.id)
    const professional = plan.professional.find((u) => u.productId === row.id)
    return {
      ...row,
      isActive: discontinued ? false : row.isActive,
      popularPin: discontinued ? null : row.popularPin,
      isProfessional: professional ? professional.isProfessional : row.isProfessional,
      cartItemCount: discontinued || plan.cartDelete.productIds.includes(row.id) ? 0 : row.cartItemCount,
      variants: row.variants.map((v) => ({
        ...v,
        isActive: plan.variantIds.includes(v.id) ? false : v.isActive,
        cartItemCount: plan.cartDelete.variantIds.includes(v.id) ? 0 : v.cartItemCount,
      })),
    }
  })
}

describe('planDiscontinue', () => {
  it('снимает активный товар: isActive, popularPin, все активные фасовки и позиции корзины', () => {
    const plan = planDiscontinue(file, rows)
    expect(plan.productIds).toEqual(['p-bb'])
    expect(plan.variantIds).toEqual(expect.arrayContaining(['v-bb-50']))
    expect(plan.cartDelete.productIds).toEqual(['p-bb'])
    expect(plan.items.find((i) => i.label === 'bb')).toMatchObject({ kind: 'product', status: 'to_change' })
    expect(plan.totals.popularPins).toBe(1)
  })

  it('не падает на отсутствующем и неоднозначном slug, помечает их', () => {
    const plan = planDiscontinue(file, rows)
    expect(plan.items.find((i) => i.label === 'missing')?.status).toBe('not_found')
    expect(plan.items.find((i) => i.label === 'dup')?.status).toBe('ambiguous')
    expect(plan.productIds).not.toContain('p-dup-1')
    expect(plan.productIds).not.toContain('p-dup-2')
  })

  it('уже снятый товар не меняет и не попадает в запись', () => {
    const plan = planDiscontinue(file, rows)
    expect(plan.items.find((i) => i.label === 'orange')?.status).toBe('already')
    expect(plan.productIds).not.toContain('p-orange')
    expect(plan.variantIds).not.toContain('v-orange-15')
  })

  it('фасовка: снимает только заданный объём, позиции корзины этой фасовки удаляются, товар остаётся', () => {
    const plan = planDiscontinue(file, rows)
    expect(plan.variantIds).toContain('v-nc-200')
    expect(plan.variantIds).not.toContain('v-nc-500')
    expect(plan.productIds).not.toContain('p-nc')
    expect(plan.cartDelete.variantIds).toEqual(['v-nc-200'])
    expect(plan.recalcProductIds).toContain('p-nc')
  })

  it('isProfessional товара пересчитывается по оставшимся активным фасовкам', () => {
    const plan = planDiscontinue(file, rows)
    expect(plan.professional).toEqual([{ productId: 'p-nc', isProfessional: true }])
  })

  it('фасовка с отсутствующим объёмом помечается, ничего не меняет', () => {
    const plan = planDiscontinue(file, rows)
    expect(plan.items.find((i) => i.label === 'natural-cleansing, 999 мл')?.status).toBe('not_found')
    expect(plan.items.find((i) => i.label === 'nope, 1 мл')?.status).toBe('not_found')
  })

  it('если после снятия фасовок не остаётся, пишет предупреждение и не трогает isProfessional', () => {
    const onlyRetail: PlanProduct[] = [
      {
        id: 'p-solo',
        slug: 'natural-cleansing',
        isActive: true,
        isProfessional: false,
        popularPin: null,
        cartItemCount: 0,
        variants: [{ id: 'v-solo-200', volumeValue: 200, isActive: true, isProfessional: false, cartItemCount: 0 }],
      },
    ]
    const plan = planDiscontinue(file, onlyRetail)
    expect(plan.variantIds).toEqual(['v-solo-200'])
    expect(plan.professional).toEqual([])
    expect(plan.warnings).toHaveLength(1)
  })

  it('повторный прогон после применения не даёт изменений', () => {
    const first = planDiscontinue(file, rows)
    const second = planDiscontinue(file, applyToRows(rows, first))
    expect(second.productIds).toEqual([])
    expect(second.variantIds).toEqual([])
    expect(second.cartDelete).toEqual({ productIds: [], variantIds: [] })
    expect(second.professional).toEqual([])
    expect(second.recalcProductIds).toEqual([])
    expect(second.totals).toEqual({ products: 0, variants: 0, cartItems: 0, popularPins: 0, professional: 0 })
  })

  it('итоги: товаров, фасовок, позиций корзин, popularPin, isProfessional', () => {
    const plan = planDiscontinue(file, rows)
    expect(plan.totals).toEqual({ products: 1, variants: 2, cartItems: 3, popularPins: 1, professional: 1 })
  })
})

describe('parseDiscontinuedFile', () => {
  it('принимает корректный файл', () => {
    expect(parseDiscontinuedFile(file)).toEqual(file)
  })

  it('отклоняет файл без списка products', () => {
    expect(() => parseDiscontinuedFile({ _meta: file._meta, variants: [] })).toThrow()
  })
})
