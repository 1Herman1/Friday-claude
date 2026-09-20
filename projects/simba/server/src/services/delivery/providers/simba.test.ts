import { describe, it, expect } from 'vitest'
import { isMoscow } from './simba.js'

// Курьер Simba возит только по Москве: ошибка здесь — это либо потерянный
// заказ (отказали москвичу), либо поездка себе в убыток (повезли в область).
describe('isMoscow', () => {
  it('принимает Москву в разных написаниях', () => {
    expect(isMoscow('Москва')).toBe(true)
    expect(isMoscow('МОСКВА')).toBe(true)
    expect(isMoscow('  москва  ')).toBe(true)
    expect(isMoscow('г. Москва')).toBe(true)
    expect(isMoscow('г Москва')).toBe(true)
    expect(isMoscow('город Москва')).toBe(true)
  })

  it('принимает Москву с уточнением района после запятой', () => {
    expect(isMoscow('Москва, ЦАО')).toBe(true)
    expect(isMoscow('г. Москва, ул. Тверская')).toBe(true)
  })

  it('не принимает область и города-спутники', () => {
    expect(isMoscow('Московская область')).toBe(false)
    expect(isMoscow('Московская область, Химки')).toBe(false)
    expect(isMoscow('Химки')).toBe(false)
    expect(isMoscow('Мытищи')).toBe(false)
    expect(isMoscow('Москва-Сити')).toBe(false)
  })

  it('не принимает другие города и пустую строку', () => {
    expect(isMoscow('Казань')).toBe(false)
    expect(isMoscow('Санкт-Петербург')).toBe(false)
    expect(isMoscow('')).toBe(false)
  })
})
