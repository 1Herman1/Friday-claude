import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { collectErrors, parseCdekDateTime, toCities, toOrderInfo, toPoints, toTariffs } from '../services/cdek/parse.js'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`fixtures/cdek/${name}`, import.meta.url), 'utf-8'))
}

describe('CDEK parse: пункты выдачи', () => {
  it('битые точки и неизвестный тип пропускаются, счётчик пропусков верный', () => {
    const { points, skipped } = toPoints(fixture('points.json'))

    expect(points.map((p) => p.code)).toEqual(['MSK123', 'MSK456'])
    expect(skipped).toBe(2)
  })

  it('поля точки сужены до нашего вида', () => {
    const { points } = toPoints(fixture('points.json'))

    expect(points[0]).toEqual({
      code: 'MSK123',
      type: 'PVZ',
      name: 'ПВЗ Тверская',
      address: 'Москва, ул. Тверская, 1',
      city: 'Москва',
      cityCode: 44,
      workTime: 'Пн-Вс 10:00-22:00',
      metro: 'Охотный Ряд',
      lat: 55.7649,
      lon: 37.6063,
    })
    expect(points[1]).toMatchObject({ type: 'POSTAMAT', workTime: null, metro: null })
  })
})

describe('CDEK parse: тарифы и города', () => {
  it('тарифы: битая запись отбрасывается, сумма в рублях', () => {
    const tariffs = toTariffs(fixture('tariffs.json'))

    expect(tariffs).toEqual([
      { tariffCode: 136, deliverySumRub: 310.4, periodMin: 2, periodMax: 4 },
      { tariffCode: 368, deliverySumRub: 290, periodMin: 2, periodMax: 5 },
    ])
  })

  it('города: не больше десяти', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ code: 100 + i, full_name: `Город ${i}` }))

    expect(toCities(many)).toHaveLength(10)
    expect(toCities(fixture('cities.json'))).toEqual([
      { code: 44, name: 'Москва, Москва г' },
      { code: 137, name: 'Санкт-Петербург, Санкт-Петербург г' },
    ])
  })
})

describe('CDEK parse: заказ', () => {
  it('номер СДЭК числом превращается в строку, ошибки заявки собираются', () => {
    const info = toOrderInfo(fixture('order-info.json'))

    expect(info.cdekNumber).toBe('1234567890')
    expect(info.requestState).toBe('INVALID')
    expect(info.requestErrors).toEqual(['Неверный тариф'])
    expect(info.statuses).toHaveLength(1)
    expect(info.statuses[0]).toMatchObject({ code: 'ACCEPTED', name: 'Принят в обработку', city: 'Москва' })
    expect(info.statuses[0].at.toISOString()).toBe('2026-10-30T05:00:00.000Z')
  })

  it('текст ошибки обрезается до 300 символов', () => {
    const long = 'я'.repeat(500)

    expect(collectErrors({ errors: [{ message: long }] })[0]).toHaveLength(300)
  })

  it('ошибки собираются из верхнего уровня и из requests', () => {
    expect(collectErrors(fixture('error-400.json'))).toEqual(['Неверные данные', 'Город не найден'])
  })
})

describe('CDEK parse: дата', () => {
  it('смещение без двоеточия учитывается', () => {
    expect(parseCdekDateTime('2026-10-30T12:00:00+0700').toISOString()).toBe('2026-10-30T05:00:00.000Z')
  })
})
