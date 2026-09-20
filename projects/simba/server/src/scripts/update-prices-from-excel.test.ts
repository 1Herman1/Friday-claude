import { describe, it, expect } from 'vitest'

/**
 * Вспомогательные функции для тестирования
 * (эти функции также используются в самом скрипте update-prices-from-excel.ts)
 */

/**
 * Конвертирует цену из рублей в копейки с округлением
 */
function convertRublesToCopeks(priceRubles: number): number {
  return Math.round(priceRubles * 100)
}

/**
 * Проверяет будет ли цена обновлена или пропущена по причине падения
 * Возвращает null если обновление должно быть применено,
 * или строку с причиной пропуска
 */
function checkPriceUpdate(
  oldPriceCopeks: number,
  newPriceCopeks: number,
  maxDropPercent: number
): { skipReason: 'unchanged' | 'priceDrop' | null } {
  // Если цена не меняется
  if (oldPriceCopeks === newPriceCopeks) {
    return { skipReason: 'unchanged' }
  }

  // Если старая цена была 0 — падение не применяется
  if (oldPriceCopeks === 0) {
    return { skipReason: null }
  }

  // Проверяем падение цены
  if (oldPriceCopeks > 0) {
    const dropPercent = ((oldPriceCopeks - newPriceCopeks) / oldPriceCopeks) * 100
    if (dropPercent > maxDropPercent) {
      return { skipReason: 'priceDrop' }
    }
  }

  return { skipReason: null }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('convertRublesToCopeks', () => {
  it('конвертирует целое число рублей', () => {
    expect(convertRublesToCopeks(10)).toBe(1000)
  })

  it('конвертирует рубли с копейками', () => {
    expect(convertRublesToCopeks(19.99)).toBe(1999)
  })

  it('округляет при необходимости', () => {
    expect(convertRublesToCopeks(1.999)).toBe(200) // rounded up
  })

  it('ноль остаётся нулём', () => {
    expect(convertRublesToCopeks(0)).toBe(0)
  })

  it('очень маленькие значения округляются корректно', () => {
    expect(convertRublesToCopeks(0.001)).toBe(0)
    expect(convertRublesToCopeks(0.005)).toBe(1)
    expect(convertRublesToCopeks(0.01)).toBe(1)
  })

  it('работает с большими числами', () => {
    expect(convertRublesToCopeks(9999.99)).toBe(999999)
  })
})

describe('checkPriceUpdate', () => {
  const MAX_DROP = 50

  it('одинаковая цена — skipReason unchanged', () => {
    const result = checkPriceUpdate(1000, 1000, MAX_DROP)
    expect(result.skipReason).toBe('unchanged')
  })

  it('рост цены — skipReason null (применить)', () => {
    const result = checkPriceUpdate(1000, 2000, MAX_DROP)
    expect(result.skipReason).toBeNull()
  })

  it('небольшое падение (меньше порога) — skipReason null (применить)', () => {
    const result = checkPriceUpdate(1000, 750, MAX_DROP) // падение 25%
    expect(result.skipReason).toBeNull()
  })

  it('падение ровно на порог (50%) — skipReason null (применить, не блокировать)', () => {
    const result = checkPriceUpdate(1000, 500, MAX_DROP) // ровно 50%
    expect(result.skipReason).toBeNull()
  })

  it('падение больше порога (>50%) — skipReason priceDrop', () => {
    const result = checkPriceUpdate(1000, 400, MAX_DROP) // падение 60%
    expect(result.skipReason).toBe('priceDrop')
  })

  it('старая цена 0 — падение не применяется, skipReason null', () => {
    const result = checkPriceUpdate(0, 1000, MAX_DROP)
    expect(result.skipReason).toBeNull()
  })

  it('кастомный порог 30%: падение на 35% блокируется', () => {
    const result = checkPriceUpdate(1000, 650, 30) // падение 35%
    expect(result.skipReason).toBe('priceDrop')
  })

  it('кастомный порог 30%: падение на 30% не блокируется', () => {
    const result = checkPriceUpdate(1000, 700, 30) // ровно 30%
    expect(result.skipReason).toBeNull()
  })

  it('очень большое падение (90%) блокируется', () => {
    const result = checkPriceUpdate(10000, 1000, MAX_DROP)
    expect(result.skipReason).toBe('priceDrop')
  })

  it('полный дроп до нуля блокируется', () => {
    const result = checkPriceUpdate(1000, 0, MAX_DROP)
    expect(result.skipReason).toBe('priceDrop')
  })

  it('падение на 1 копейку (маленькое) не блокируется', () => {
    const result = checkPriceUpdate(10000, 9999, MAX_DROP)
    expect(result.skipReason).toBeNull()
  })
})
