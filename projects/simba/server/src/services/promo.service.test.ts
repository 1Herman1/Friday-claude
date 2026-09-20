import { describe, it, expect } from 'vitest'
import { calcPromoDiscount, type PromoRule } from '@simba/shared'
import { promoStatus, type PromoCode } from './promo.service'

describe('calcPromoDiscount', () => {
  it('returns 0 for null promo', () => {
    expect(calcPromoDiscount(10000, null)).toBe(0)
  })

  it('returns 0 for undefined promo', () => {
    expect(calcPromoDiscount(10000, undefined)).toBe(0)
  })

  it('calculates percent discount correctly', () => {
    const promo: PromoRule = { type: 'percent', value: 10 }
    expect(calcPromoDiscount(10000, promo)).toBe(1000)
  })

  it('calculates fixed discount correctly', () => {
    const promo: PromoRule = { type: 'fixed', value: 500 }
    expect(calcPromoDiscount(10000, promo)).toBe(500)
  })

  it('caps fixed discount to subtotal', () => {
    const promo: PromoRule = { type: 'fixed', value: 15000 }
    expect(calcPromoDiscount(10000, promo)).toBe(10000)
  })

  it('returns 0 when minSubtotal not met', () => {
    const promo: PromoRule = { type: 'percent', value: 10, minSubtotal: 20000 }
    expect(calcPromoDiscount(10000, promo)).toBe(0)
  })

  it('applies discount when minSubtotal is met', () => {
    const promo: PromoRule = { type: 'percent', value: 10, minSubtotal: 5000 }
    expect(calcPromoDiscount(10000, promo)).toBe(1000)
  })

  it('rounds percent discount to nearest integer', () => {
    const promo: PromoRule = { type: 'percent', value: 7 }
    expect(calcPromoDiscount(1530, promo)).toBe(107) // 107.1 → 107
  })
})

describe('promoStatus', () => {
  const now = new Date()
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000)

  it('returns disabled if isActive is false', () => {
    const promo = {
      isActive: false,
      startsAt: null,
      endsAt: null,
      maxUses: 100,
      usedCount: 0,
    } as PromoCode
    expect(promoStatus(promo)).toBe('disabled')
  })

  it('returns scheduled if startsAt is in future', () => {
    const promo = {
      isActive: true,
      startsAt: future,
      endsAt: null,
      maxUses: 100,
      usedCount: 0,
    } as PromoCode
    expect(promoStatus(promo)).toBe('scheduled')
  })

  it('returns expired if endsAt is in past', () => {
    const promo = {
      isActive: true,
      startsAt: null,
      endsAt: past,
      maxUses: 100,
      usedCount: 0,
    } as PromoCode
    expect(promoStatus(promo)).toBe('expired')
  })

  it('returns exhausted if maxUses is reached', () => {
    const promo = {
      isActive: true,
      startsAt: null,
      endsAt: null,
      maxUses: 10,
      usedCount: 10,
    } as PromoCode
    expect(promoStatus(promo)).toBe('exhausted')
  })

  it('returns active for valid promo', () => {
    const promo = {
      isActive: true,
      startsAt: null,
      endsAt: null,
      maxUses: 100,
      usedCount: 0,
    } as PromoCode
    expect(promoStatus(promo)).toBe('active')
  })

  it('prioritizes disabled over other statuses', () => {
    const promo = {
      isActive: false,
      startsAt: future,
      endsAt: null,
      maxUses: 100,
      usedCount: 100,
    } as PromoCode
    expect(promoStatus(promo)).toBe('disabled')
  })
})
