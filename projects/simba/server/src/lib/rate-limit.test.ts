import { describe, it, expect } from 'vitest'
import { checkRateLimit } from './rate-limit.js'

/** Счётчики живут в памяти модуля и не сбрасываются между тестами — у каждого
    свой IP, иначе тесты зависели бы от порядка запуска. */
const drain = (ip: string, bucket: 'quotes' | 'suggest' | 'pickup-points', times: number) => {
  const results: boolean[] = []
  for (let i = 0; i < times; i++) results.push(checkRateLimit(ip, bucket))
  return results
}

describe('checkRateLimit', () => {
  it('исчерпанные подсказки не блокируют расчёт доставки и пункты выдачи', async () => {
    const ip = '203.0.113.1'

    expect(drain(ip, 'suggest', 40).every(Boolean)).toBe(true)
    expect(checkRateLimit(ip, 'suggest')).toBe(false)

    // Набирая адрес, покупатель тратит подсказки десятками. Общий счётчик
    // отдавал бы ему 429 на пересчёте доставки посреди оформления.
    expect(checkRateLimit(ip, 'quotes')).toBe(true)
    expect(checkRateLimit(ip, 'pickup-points')).toBe(true)
  })

  it('лимит расчётов доставки — 40, и он не трогает подсказки', async () => {
    const ip = '203.0.113.2'

    expect(drain(ip, 'quotes', 40).every(Boolean)).toBe(true)
    expect(checkRateLimit(ip, 'quotes')).toBe(false)
    expect(checkRateLimit(ip, 'suggest')).toBe(true)
  })

  it('лимит пунктов выдачи — 30, и он не трогает расчёт доставки', async () => {
    const ip = '203.0.113.3'

    expect(drain(ip, 'pickup-points', 30).every(Boolean)).toBe(true)
    expect(checkRateLimit(ip, 'pickup-points')).toBe(false)
    expect(checkRateLimit(ip, 'quotes')).toBe(true)
  })

  it('исчерпанный лимит одного покупателя не мешает другому', async () => {
    const busy = '203.0.113.4'
    const fresh = '203.0.113.5'

    drain(busy, 'pickup-points', 30)
    expect(checkRateLimit(busy, 'pickup-points')).toBe(false)
    expect(checkRateLimit(fresh, 'pickup-points')).toBe(true)
  })

  it('по умолчанию считает корзину расчётов доставки', async () => {
    const ip = '203.0.113.6'

    drain(ip, 'quotes', 40)
    expect(checkRateLimit(ip)).toBe(false)
    expect(checkRateLimit(ip, 'suggest')).toBe(true)
  })
})
