import { describe, it, expect } from 'vitest'
import { plural, pluralize, formatBonuses, formatPrice } from './format'

describe('plural', () => {
  it('выбирает форму по последней цифре', () => {
    expect(plural(1, 'товар', 'товара', 'товаров')).toBe('товар')
    expect(plural(2, 'товар', 'товара', 'товаров')).toBe('товара')
    expect(plural(5, 'товар', 'товара', 'товаров')).toBe('товаров')
    expect(plural(21, 'товар', 'товара', 'товаров')).toBe('товар')
    expect(plural(102, 'товар', 'товара', 'товаров')).toBe('товара')
  })

  it('подросток 11–14 всегда «товаров», хотя цифра на конце обманчива', () => {
    for (const n of [11, 12, 13, 14, 111]) {
      expect(plural(n, 'товар', 'товара', 'товаров'), String(n)).toBe('товаров')
    }
  })

  it('ноль — «товаров»', () => {
    expect(plural(0, 'товар', 'товара', 'товаров')).toBe('товаров')
  })
})

describe('pluralize / formatBonuses', () => {
  it('печатает число со словом', () => {
    expect(pluralize(1, 'товар', 'товара', 'товаров')).toBe('1 товар')
    expect(pluralize(3, 'товар', 'товара', 'товаров')).toBe('3 товара')
  })

  it('бонусы склоняются и разделяются по разрядам', () => {
    expect(formatBonuses(1)).toBe('1 бонус')
    expect(formatBonuses(2)).toBe('2 бонуса')
    expect(formatBonuses(300)).toBe('300 бонусов')
    expect(formatBonuses(1500)).toContain('бонусов')
  })

  it('ноль и списание (отрицательное) не ломают склонение', () => {
    expect(formatBonuses(0)).toBe('0 бонусов')
    // Списание бонусов в корзине показывается со знаком минус.
    expect(formatBonuses(-1)).toBe('-1 бонус')
    expect(formatBonuses(-22)).toBe('-22 бонуса')
  })
})

describe('formatPrice', () => {
  it('копейки переводит в рубли', () => {
    // toLocaleString('ru-RU') разделяет разряды неразрывным пробелом (U+00A0).
    expect(formatPrice(249900)).toBe('2 499 ₽')
    expect(formatPrice(0)).toBe('0 ₽')
    expect(formatPrice(50)).toBe('0,5 ₽')
  })
})
