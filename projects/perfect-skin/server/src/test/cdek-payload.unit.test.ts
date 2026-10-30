import { describe, it, expect } from 'vitest'
import { parseCdekConfig, type CdekConfig } from '../services/cdek/config.js'
import { buildCreateOrderPayload, type OrderForCdek } from '../services/cdek/order-sync.js'

const cfg = parseCdekConfig(
  { PS_CDEK_CLIENT_ID: 'id', PS_CDEK_CLIENT_SECRET: 'secret', PS_CDEK_ORDER_PREFIX: 'T-' },
  'host'
) as CdekConfig

const base: OrderForCdek = {
  number: 'PS-000123',
  deliveryMethod: 'cdek_courier',
  cdekPvzCode: null,
  cdekCityCode: 44,
  cdekTariffCode: 137,
  deliveryAddress: { street: 'Тверская', house: '1', apartment: '5' },
  recipientName: 'Тестова Тест',
  recipientPhone: '+79990000000',
  items: [
    { productVariantId: 'v1', productName: 'Крем', volumeLabel: '50 мл', price: 123450, quantity: 2, weightGrams: 200 },
    { productVariantId: 'v2', productName: 'Тоник', volumeLabel: '100 мл', price: 50000, quantity: 1, weightGrams: null },
  ],
}

describe('buildCreateOrderPayload', () => {
  it('курьер: to_location с квартирой, без delivery_point', () => {
    const payload = buildCreateOrderPayload(base, cfg)
    expect(payload.to_location).toEqual({ code: 44, address: 'Тверская, д. 1, кв. 5', postal_code: undefined })
    expect(payload.delivery_point).toBeUndefined()
  })

  it('курьер без квартиры: строка адреса без «кв.»', () => {
    const payload = buildCreateOrderPayload({ ...base, deliveryAddress: { street: 'Тверская', house: '1' } }, cfg)
    expect(payload.to_location?.address).toBe('Тверская, д. 1')
  })

  it('ПВЗ: delivery_point есть, to_location нет', () => {
    const payload = buildCreateOrderPayload(
      { ...base, deliveryMethod: 'cdek_pvz', cdekPvzCode: 'PVZ-1', cdekTariffCode: 136, deliveryAddress: null },
      cfg
    )
    expect(payload.delivery_point).toBe('PVZ-1')
    expect(payload).not.toHaveProperty('to_location')
  })

  it('shipment_point имеет приоритет над from_location; без него — from_location', () => {
    const withPoint = buildCreateOrderPayload(base, { ...cfg, shipmentPoint: 'MSK1' })
    expect(withPoint.shipment_point).toBe('MSK1')
    expect(withPoint).not.toHaveProperty('from_location')

    const withCity = buildCreateOrderPayload(base, cfg)
    expect(withCity.from_location?.code).toBe(44)
    expect(withCity).not.toHaveProperty('shipment_point')
  })

  it('номер с префиксом аккаунта', () => {
    expect(buildCreateOrderPayload(base, cfg).number).toBe('T-PS-000123')
  })

  it('стоимость позиции в рублях, вес коробки плюс позиции', () => {
    const payload = buildCreateOrderPayload(base, cfg)
    const [pkg] = payload.packages
    expect(pkg.items.map((item) => item.cost)).toEqual([1234.5, 500])
    expect(pkg.weight).toBe(cfg.box.weightG + 200 * 2 + cfg.itemWeightG * 1)
  })

  it('email и комментария в payload нет, имя обрезано до 255', () => {
    const longName = 'я'.repeat(300)
    const payload = buildCreateOrderPayload({ ...base, items: [{ ...base.items[0], productName: longName }] }, cfg)
    expect(payload.recipient).toEqual({ name: 'Тестова Тест', phones: [{ number: '+79990000000' }] })
    expect(payload.packages[0].items[0].name.length).toBe(255)
    expect(JSON.stringify(payload)).not.toContain('@')
  })

  it('без тарифа — CDEK_NOT_CONFIGURED', () => {
    expect(() => buildCreateOrderPayload({ ...base, cdekTariffCode: null }, cfg)).toThrow(/CDEK_NOT_CONFIGURED|У заказа/)
  })
})
