import { describe, it, expect, vi } from 'vitest'
import { parseCdekConfig, type CdekConfig } from '../services/cdek/config.js'
import {
  DeliveryQuoteService,
  buildParcel,
  customerCost,
  filterPoints,
  rublesToKopecksCeil,
  tariffForPoint,
} from '../services/cdek/quote.service.js'
import type { CdekClient, CdekPoint, CdekTariffQuote } from '../services/cdek/client.js'
import type { CdekServices } from '../services/cdek/registry.js'
import { CdekUnavailableError } from '../services/cdek/http.js'

const cfg: CdekConfig = parseCdekConfig({ PS_CDEK_CLIENT_ID: 'id', PS_CDEK_CLIENT_SECRET: 'secret' }, 'host') as CdekConfig

const point = (overrides: Partial<CdekPoint>): CdekPoint => ({
  code: 'PVZ-1',
  type: 'PVZ',
  name: 'Пункт на Арбате',
  address: 'Москва, Арбат, 10',
  city: 'Москва',
  cityCode: 44,
  workTime: null,
  metro: 'Арбатская',
  lat: 55.75,
  lon: 37.59,
  ...overrides,
})

const tariffs: CdekTariffQuote[] = [
  { tariffCode: 136, deliverySumRub: 310.4, periodMin: 2, periodMax: 4 },
  { tariffCode: 368, deliverySumRub: 290, periodMin: 2, periodMax: 5 },
  { tariffCode: 137, deliverySumRub: 500, periodMin: 1, periodMax: 2 },
]

function fakeServices(client: Partial<Record<keyof CdekClient, unknown>>): CdekServices {
  return { config: cfg, client: client as unknown as CdekClient }
}

const silentLog = { warn: vi.fn() }

describe('buildParcel', () => {
  it('берёт дефолтный вес позиции, прибавляет коробку и округляет вверх до 250 г', () => {
    const parcel = buildParcel([{ weightGrams: null, quantity: 1 }], cfg)
    expect(parcel).toEqual({ weight: 500, length: 20, width: 15, height: 10 })
  })

  it('не опускается ниже 250 г', () => {
    expect(buildParcel([], cfg).weight).toBe(250)
  })
})

describe('rublesToKopecksCeil', () => {
  it('округляет рубли вверх до целого и переводит в копейки', () => {
    expect(rublesToKopecksCeil(310.4)).toBe(31100)
  })
})

describe('tariffForPoint', () => {
  it('ПВЗ — тариф пункта, постамат — тариф постамата', () => {
    expect(tariffForPoint('PVZ', cfg)).toBe(136)
    expect(tariffForPoint('POSTAMAT', cfg)).toBe(368)
  })
})

describe('customerCost', () => {
  const pvzTariff = { tariffCode: 136, deliverySumRub: 300, periodMin: 2, periodMax: 4 }
  const courierTariff = { tariffCode: 137, deliverySumRub: 500, periodMin: 1, periodMax: 2 }

  it('ПВЗ ниже порога 6 000 ₽ — платит тариф', () => {
    expect(
      customerCost({ method: 'cdek_pvz', goodsAfterDiscount: 599_999, tariff: pvzTariff, cdekFailed: false, paidMode: 'tariff' })
    ).toEqual({ cost: 30_000, paidCost: 30_000, source: 'cdek' })
  })

  it('ровно 6 000 ₽ — бесплатно и источник free', () => {
    expect(
      customerCost({ method: 'cdek_pvz', goodsAfterDiscount: 600_000, tariff: pvzTariff, cdekFailed: false, paidMode: 'tariff' })
    ).toEqual({ cost: 0, paidCost: 30_000, source: 'free' })
  })

  it('курьер: 9 999 ₽ — тариф, 10 000 ₽ — бесплатно', () => {
    expect(
      customerCost({ method: 'cdek_courier', goodsAfterDiscount: 999_900, tariff: courierTariff, cdekFailed: false, paidMode: 'tariff' }).cost
    ).toBe(50_000)
    expect(
      customerCost({ method: 'cdek_courier', goodsAfterDiscount: 1_000_000, tariff: courierTariff, cdekFailed: false, paidMode: 'tariff' }).cost
    ).toBe(0)
  })

  it('режим fixed — фиксированные 200 ₽', () => {
    expect(
      customerCost({ method: 'cdek_pvz', goodsAfterDiscount: 100_000, tariff: pvzTariff, cdekFailed: false, paidMode: 'fixed' })
    ).toEqual({ cost: 20_000, paidCost: 20_000, source: 'fixed' })
  })

  it('сбой СДЭК — fallback 200 ₽', () => {
    expect(
      customerCost({ method: 'cdek_courier', goodsAfterDiscount: 100_000, tariff: null, cdekFailed: true, paidMode: 'tariff' })
    ).toEqual({ cost: 20_000, paidCost: 20_000, source: 'fallback' })
  })

  it('нет тарифа — cost null и unavailable', () => {
    expect(
      customerCost({ method: 'cdek_pvz', goodsAfterDiscount: 100_000, tariff: null, cdekFailed: false, paidMode: 'tariff' })
    ).toEqual({ cost: null, paidCost: null, source: 'unavailable' })
  })
})

describe('filterPoints', () => {
  const points = [
    point({ code: 'B', address: 'Москва, Тверская, 5', name: 'Бета', metro: 'Пушкинская' }),
    point({ code: 'A', address: 'Москва, Арбат, 10', name: 'Альфа', type: 'POSTAMAT' }),
  ]

  it('фильтрует по каждому слову запроса и сортирует по адресу', () => {
    expect(filterPoints(points, { q: 'москва', type: 'ALL' }).map((p) => p.code)).toEqual(['A', 'B'])
    expect(filterPoints(points, { q: 'тверская пушкинская', type: 'ALL' }).map((p) => p.code)).toEqual(['B'])
  })

  it('фильтрует по типу точки', () => {
    expect(filterPoints(points, { type: 'POSTAMAT' }).map((p) => p.code)).toEqual(['A'])
  })
})

describe('DeliveryQuoteService', () => {
  it('самовывоз не ходит в СДЭК и бесплатен', async () => {
    const service = new DeliveryQuoteService(null, silentLog)
    const resolved = await service.resolveForOrder({ method: 'pickup', cityCode: null, pvzCode: null, items: [], goodsAfterDiscount: 0 })
    expect(resolved).toEqual({ paidCost: 0, tariffCode: null, cityCode: null, point: null, quote: null })
  })

  it('интеграция выключена — как сейчас: 200 ₽ без снимка', async () => {
    const service = new DeliveryQuoteService(null, silentLog)
    const resolved = await service.resolveForOrder({ method: 'cdek_pvz', cityCode: null, pvzCode: 'X', items: [], goodsAfterDiscount: 100_000 })
    expect(resolved).toEqual({ paidCost: 20_000, tariffCode: null, cityCode: null, point: null, quote: null })
  })

  it('неизвестный код ПВЗ — PVZ_NOT_FOUND', async () => {
    const client = { listPoints: vi.fn(async () => [point({})]), tariffList: vi.fn(async () => tariffs) }
    const service = new DeliveryQuoteService(fakeServices(client), silentLog)
    await expect(
      service.resolveForOrder({ method: 'cdek_pvz', cityCode: 44, pvzCode: 'NOPE', items: [], goodsAfterDiscount: 100_000 })
    ).rejects.toMatchObject({ code: 'PVZ_NOT_FOUND', status: 409 })
  })

  it('ПВЗ известен — тариф по типу точки и снимок котировки', async () => {
    const client = { listPoints: vi.fn(async () => [point({})]), tariffList: vi.fn(async () => tariffs) }
    const service = new DeliveryQuoteService(fakeServices(client), silentLog)
    const resolved = await service.resolveForOrder({ method: 'cdek_pvz', cityCode: 44, pvzCode: 'PVZ-1', items: [], goodsAfterDiscount: 100_000 })
    expect(resolved.paidCost).toBe(31_100)
    expect(resolved.tariffCode).toBe(136)
    expect(resolved.point?.code).toBe('PVZ-1')
    expect(resolved.quote).toMatchObject({ source: 'cdek', cdekSum: 31_100, periodMin: 2, periodMax: 4, weightGrams: 250 })
  })

  it('нет тарифа для типа точки — DELIVERY_UNAVAILABLE', async () => {
    const client = {
      listPoints: vi.fn(async () => [point({ type: 'POSTAMAT' })]),
      tariffList: vi.fn(async () => [tariffs[0]]),
    }
    const service = new DeliveryQuoteService(fakeServices(client), silentLog)
    await expect(
      service.resolveForOrder({ method: 'cdek_pvz', cityCode: 44, pvzCode: 'PVZ-1', items: [], goodsAfterDiscount: 100_000 })
    ).rejects.toMatchObject({ code: 'DELIVERY_UNAVAILABLE' })
  })

  it('СДЭК недоступен при оформлении — fallback 200 ₽ с предупреждением в лог', async () => {
    const warn = vi.fn()
    const client = { tariffList: vi.fn(async () => { throw new CdekUnavailableError('timeout') }) }
    const service = new DeliveryQuoteService(fakeServices(client), { warn })
    const resolved = await service.resolveForOrder({ method: 'cdek_courier', cityCode: 44, pvzCode: null, items: [], goodsAfterDiscount: 100_000 })
    expect(resolved.paidCost).toBe(20_000)
    expect(resolved.quote?.source).toBe('fallback')
    expect(warn).toHaveBeenCalledOnce()
  })

  it('методы без города — cost null и needs_city', async () => {
    const service = new DeliveryQuoteService(fakeServices({}), silentLog)
    const methods = await service.methods({ cityCode: null, items: [], goodsAfterDiscount: 0 })
    expect(methods.map((m) => [m.code, m.cost, m.quoteSource])).toEqual([
      ['cdek_pvz', null, 'needs_city'],
      ['cdek_courier', null, 'needs_city'],
    ])
  })

  it('методы: цена ПВЗ = PVZ ?? POSTAMAT, costByPointType отдельно', async () => {
    const client = { tariffList: vi.fn(async () => [tariffs[1], tariffs[2]]) }
    const service = new DeliveryQuoteService(fakeServices(client), silentLog)
    const [pvz, courier] = await service.methods({ cityCode: 44, items: [], goodsAfterDiscount: 100_000 })
    expect(pvz).toMatchObject({ cost: 29_000, quoteSource: 'cdek', costByPointType: { PVZ: null, POSTAMAT: 29_000 } })
    expect(courier).toMatchObject({ cost: 50_000, quoteSource: 'cdek', periodMin: 1 })
  })
})
