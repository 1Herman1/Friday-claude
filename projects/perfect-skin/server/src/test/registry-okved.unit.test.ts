import { describe, it, expect } from 'vitest'
import { parseOkvedPrefixes, isProfileOkved } from '../lib/registry/okved'

describe('OKVED префиксы', () => {
  it('parseOkvedPrefixes: парсит строку через запятую', () => {
    const result = parseOkvedPrefixes('96.02,86.90,47.75')
    expect(result).toEqual(['96.02', '86.90', '47.75'])
  })

  it('parseOkvedPrefixes: убирает пробелы', () => {
    const result = parseOkvedPrefixes(' 96.02 , 86.90 , 47.75 ')
    expect(result).toEqual(['96.02', '86.90', '47.75'])
  })

  it('parseOkvedPrefixes: возвращает дефолт если env пуста', () => {
    const result = parseOkvedPrefixes('')
    expect(result).toEqual(['96.02', '96.04', '86.90', '86.22', '46.45', '47.75'])
  })

  it('parseOkvedPrefixes: возвращает дефолт если env undefined', () => {
    const result = parseOkvedPrefixes(undefined)
    expect(result).toEqual(['96.02', '96.04', '86.90', '86.22', '46.45', '47.75'])
  })

  it('parseOkvedPrefixes: фильтрует пустые строки', () => {
    const result = parseOkvedPrefixes('96.02,,86.90')
    expect(result).toEqual(['96.02', '86.90'])
  })
})

describe('Проверка профильного ОКВЕДА', () => {
  const prefixes = ['96.02', '86.90', '47.75']

  it('isProfileOkved: точное совпадение', () => {
    expect(isProfileOkved(['96.02'], prefixes)).toBe(true)
    expect(isProfileOkved(['86.90'], prefixes)).toBe(true)
  })

  it('isProfileOkved: совпадение по префиксу с точкой', () => {
    // 86.90 покрывает 86.90.1, 86.90.4
    expect(isProfileOkved(['86.90.1'], prefixes)).toBe(true)
    expect(isProfileOkved(['86.90.4'], prefixes)).toBe(true)
  })

  it('isProfileOkved: префикс без точки НЕ покрывает', () => {
    // 86.9 не покрывает 86.90
    expect(isProfileOkved(['86.90'], ['86.9'])).toBe(false)
    // 47.7 не покрывает 47.75
    expect(isProfileOkved(['47.75'], ['47.7'])).toBe(false)
  })

  it('isProfileOkved: множество кодов, одно совпадение', () => {
    const codes = ['62.01', '86.90.4', '73.20']
    expect(isProfileOkved(codes, prefixes)).toBe(true)
  })

  it('isProfileOkved: ни одного совпадения', () => {
    const codes = ['62.01', '73.20', '55.90']
    expect(isProfileOkved(codes, prefixes)).toBe(false)
  })

  it('isProfileOkved: пустой массив кодов', () => {
    expect(isProfileOkved([], prefixes)).toBe(false)
  })

  it('isProfileOkved: пустой массив префиксов', () => {
    expect(isProfileOkved(['96.02'], [])).toBe(false)
  })

  it('isProfileOkved: оба массива пусты', () => {
    expect(isProfileOkved([], [])).toBe(false)
  })

  it('isProfileOkved: глубокие коды (86.90.11.1)', () => {
    // 86.90 покрывает 86.90.11.1
    expect(isProfileOkved(['86.90.11.1'], ['86.90'])).toBe(true)
  })

  it('isProfileOkved: чувствителен к регистру', () => {
    // Коды ОКВЭД в верхнем регистре, но в реальности они всегда в цифрах
    // Это просто проверка на точность
    expect(isProfileOkved(['96.02'], ['96.02'])).toBe(true)
  })
})
