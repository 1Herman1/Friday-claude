import { describe, it, expect } from 'vitest'
import {
  bonusValue,
  calcBonusAccrual,
  calcMaxBonusSpend,
  type BonusAccrualRules,
  type BonusSpendRules,
} from './bonus'

const spendRules = (over: Partial<BonusSpendRules> = {}): BonusSpendRules => ({
  kopecksPerBonus: 100,
  maxSpendPercent: 30,
  minOrderForSpend: 0,
  allowSpendWithPromo: false,
  ...over,
})

const accrualRules = (over: Partial<BonusAccrualRules> = {}): BonusAccrualRules => ({
  accrualPercent: 5,
  accrualBase: 'paid_goods',
  kopecksPerBonus: 100,
  excludeProfessionalProducts: true,
  accrueWithPromo: false,
  ...over,
})

describe('Списание: calcMaxBonusSpend', () => {
  it('лимит по проценту от товаров после скидки: 30% от 4 675 ₽ = 1 402 бонуса', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 467_500,
        hasPromo: false,
        available: 10_000,
        rules: spendRules(),
      })
    ).toEqual({ maxSpend: 1_402, block: null })
  })

  it('лимит по балансу, если бонусов меньше процентного лимита', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 467_500,
        hasPromo: false,
        available: 50,
        rules: spendRules(),
      })
    ).toEqual({ maxSpend: 50, block: null })
  })

  it('порядок проверок: промокод раньше минимальной суммы и пустого баланса', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 1_000,
        hasPromo: true,
        available: 0,
        rules: spendRules({ minOrderForSpend: 2_000 }),
      }).block
    ).toBe('PROMO_CONFLICT')
  })

  it('порядок проверок: минимальная сумма раньше пустого баланса', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 1_000,
        hasPromo: false,
        available: 0,
        rules: spendRules({ minOrderForSpend: 2_000 }),
      })
    ).toEqual({ maxSpend: 0, block: 'MIN_ORDER' })
  })

  it('пустой баланс при остальных условиях ок — EMPTY_BALANCE', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 10_000,
        hasPromo: false,
        available: 0,
        rules: spendRules(),
      })
    ).toEqual({ maxSpend: 0, block: 'EMPTY_BALANCE' })
  })

  it('промокод с allowSpendWithPromo=true не блокирует списание, процентный лимит остаётся', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 10_000,
        hasPromo: true,
        available: 500,
        rules: spendRules({ allowSpendWithPromo: true }),
      })
    ).toEqual({ maxSpend: 30, block: null })
  })

  it('округляет вниз при курсе 1 бонус = 1 ₽', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 10_050,
        hasPromo: false,
        available: 1_000,
        rules: spendRules({ maxSpendPercent: 100, kopecksPerBonus: 100 }),
      }).maxSpend
    ).toBe(100)
  })

  it('округляет вниз при курсе 1 бонус = 0,5 ₽', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 10_050,
        hasPromo: false,
        available: 1_000,
        rules: spendRules({ maxSpendPercent: 100, kopecksPerBonus: 50 }),
      }).maxSpend
    ).toBe(201)
  })

  it('maxSpendPercent=0 — списание недоступно, но блокировки нет', () => {
    expect(
      calcMaxBonusSpend({
        goodsAfterDiscount: 10_000,
        hasPromo: false,
        available: 500,
        rules: spendRules({ maxSpendPercent: 0 }),
      })
    ).toEqual({ maxSpend: 0, block: null })
  })
})

describe('bonusValue', () => {
  it('переводит баллы в копейки по курсу', () => {
    expect(bonusValue(140, 100)).toBe(14_000)
  })
})

describe('Начисление: calcBonusAccrual', () => {
  const items = [
    { price: 100_000, quantity: 1, isProfessional: false },
    { price: 50_000, quantity: 1, isProfessional: false },
  ]
  const common = { items, subtotal: 150_000, promoDiscount: 15_000, bonusDiscount: 30_000 }

  it('база gross — от товаров без скидок: 5% от 1 500 ₽ = 75', () => {
    expect(
      calcBonusAccrual({
        ...common,
        hasPromo: true,
        rules: accrualRules({ accrualBase: 'gross', accrueWithPromo: true }),
      })
    ).toBe(75)
  })

  it('база after_promo — от товаров минус промокод: 67', () => {
    expect(
      calcBonusAccrual({
        ...common,
        hasPromo: true,
        rules: accrualRules({ accrualBase: 'after_promo', accrueWithPromo: true }),
      })
    ).toBe(67)
  })

  it('база paid_goods — от товаров минус промокод и бонусы: 52', () => {
    expect(
      calcBonusAccrual({
        ...common,
        hasPromo: true,
        rules: accrualRules({ accrualBase: 'paid_goods', accrueWithPromo: true }),
      })
    ).toBe(52)
  })

  it('промокод при accrueWithPromo=false — начисления нет', () => {
    expect(
      calcBonusAccrual({
        ...common,
        hasPromo: true,
        rules: accrualRules({ accrualBase: 'gross' }),
      })
    ).toBe(0)
  })

  it('кабинетные позиции не начисляют бонусы при excludeProfessionalProducts=true', () => {
    expect(
      calcBonusAccrual({
        items: [
          { price: 100_000, quantity: 1, isProfessional: false },
          { price: 100_000, quantity: 1, isProfessional: true },
        ],
        subtotal: 200_000,
        promoDiscount: 0,
        bonusDiscount: 0,
        hasPromo: false,
        rules: accrualRules(),
      })
    ).toBe(50)
  })

  it('кабинетные позиции участвуют в начислении при excludeProfessionalProducts=false', () => {
    expect(
      calcBonusAccrual({
        items: [
          { price: 100_000, quantity: 1, isProfessional: false },
          { price: 100_000, quantity: 1, isProfessional: true },
        ],
        subtotal: 200_000,
        promoDiscount: 0,
        bonusDiscount: 0,
        hasPromo: false,
        rules: accrualRules({ excludeProfessionalProducts: false, accrualBase: 'gross' }),
      })
    ).toBe(100)
  })

  it('округляет вниз: 30 ₽ при 5% дают 1 бонус, а не 1,5', () => {
    expect(
      calcBonusAccrual({
        items: [{ price: 3_000, quantity: 1, isProfessional: false }],
        subtotal: 3_000,
        promoDiscount: 0,
        bonusDiscount: 0,
        hasPromo: false,
        rules: accrualRules(),
      })
    ).toBe(1)
  })

  it('subtotal=0 — начисления нет', () => {
    expect(
      calcBonusAccrual({
        items: [],
        subtotal: 0,
        promoDiscount: 0,
        bonusDiscount: 0,
        hasPromo: false,
        rules: accrualRules(),
      })
    ).toBe(0)
  })
})
