import { describe, it, expect } from 'vitest'
import { parseCdekConfig, CdekConfigError } from '../services/cdek/config.js'

const base = { PS_CDEK_CLIENT_ID: 'client-id', PS_CDEK_CLIENT_SECRET: 'client-secret' }
const SECRET_32 = 'a'.repeat(32)

describe('CDEK: конфигурация', () => {
  it('без client id интеграция выключена', () => {
    expect(parseCdekConfig({})).toBeNull()
    expect(parseCdekConfig({ PS_CDEK_CLIENT_ID: '' })).toBeNull()
  })

  it('PS_CDEK=off выключает интеграцию даже при заданных ключах', () => {
    expect(parseCdekConfig({ ...base, PS_CDEK: 'off' })).toBeNull()
  })

  it('пустой клиентский секрет при включённой интеграции — ошибка', () => {
    expect(() => parseCdekConfig({ PS_CDEK_CLIENT_ID: 'client-id' })).toThrow(CdekConfigError)
  })

  it('чужой baseUrl — отказ старта', () => {
    expect(() => parseCdekConfig({ ...base, PS_CDEK_BASE_URL: 'https://evil.example/v2' })).toThrow(CdekConfigError)
  })

  it('http:// вместо https — отказ старта', () => {
    expect(() => parseCdekConfig({ ...base, PS_CDEK_BASE_URL: 'http://api.edu.cdek.ru/v2' })).toThrow(CdekConfigError)
  })

  it('isTest только для тестового контура', () => {
    expect(parseCdekConfig({ ...base })?.isTest).toBe(true)
    expect(parseCdekConfig({ ...base, PS_CDEK_BASE_URL: 'https://api.cdek.ru/v2' })?.isTest).toBe(false)
  })

  it('коробка разбирается из Д×Ш×В и вес коробки', () => {
    const cfg = parseCdekConfig({ ...base, PS_CDEK_BOX: '30x20x12' })
    expect(cfg?.box).toEqual({ lengthCm: 30, widthCm: 20, heightCm: 12, weightG: 150 })
  })

  it('кривой формат коробки и нулевой размер — ошибка', () => {
    expect(() => parseCdekConfig({ ...base, PS_CDEK_BOX: '20x15' })).toThrow(CdekConfigError)
    expect(() => parseCdekConfig({ ...base, PS_CDEK_BOX: '20x0x10' })).toThrow(CdekConfigError)
  })

  it('дефолтные тарифы: ПВЗ 136, постамат 368, курьер 137', () => {
    expect(parseCdekConfig({ ...base })?.tariffs).toEqual({ pvz: 136, postamat: 368, courier: 137 })
  })

  it('кривые целые значения — ошибка', () => {
    expect(() => parseCdekConfig({ ...base, PS_CDEK_TARIFF_PVZ: '-1' })).toThrow(CdekConfigError)
    expect(() => parseCdekConfig({ ...base, PS_CDEK_FROM_CITY_CODE: 'abc' })).toThrow(CdekConfigError)
  })

  it('webhook-секрет короче 32 символов — ошибка, достаточный принимается', () => {
    expect(() => parseCdekConfig({ ...base, PS_CDEK_WEBHOOK_SECRET: 'short' })).toThrow(CdekConfigError)
    expect(parseCdekConfig({ ...base, PS_CDEK_WEBHOOK_SECRET: SECRET_32 })?.webhookSecret).toBe(SECRET_32)
  })

  it('неизвестный режим оплаты доставки — ошибка', () => {
    expect(() => parseCdekConfig({ ...base, PS_CDEK_PAID_DELIVERY: 'free' })).toThrow(CdekConfigError)
  })

  it('на тестовом контуре префикс номера непустой и стабилен для одного хоста', () => {
    const first = parseCdekConfig({ ...base }, 'host-a')?.orderNumberPrefix
    const again = parseCdekConfig({ ...base }, 'host-a')?.orderNumberPrefix
    const other = parseCdekConfig({ ...base }, 'host-b')?.orderNumberPrefix
    expect(first).toMatch(/^T[0-9A-F]{6}-$/)
    expect(again).toBe(first)
    expect(other).not.toBe(first)
  })

  it('на боевом контуре префикс пустой, явный префикс важнее дефолта', () => {
    const prod = { ...base, PS_CDEK_BASE_URL: 'https://api.cdek.ru/v2' }
    expect(parseCdekConfig(prod, 'host-a')?.orderNumberPrefix).toBe('')
    expect(parseCdekConfig({ ...prod, PS_CDEK_ORDER_PREFIX: 'PS-' }, 'host-a')?.orderNumberPrefix).toBe('PS-')
  })
})

describe('CDEK: регистрация вебхука', () => {
  it('по умолчанию выключена', () => {
    expect(parseCdekConfig({ ...base })?.webhookRegistration).toBe(false)
  })

  it('PS_CDEK_WEBHOOK=on включает регистрацию, off выключает', () => {
    expect(parseCdekConfig({ ...base, PS_CDEK_WEBHOOK: 'on' })?.webhookRegistration).toBe(true)
    expect(parseCdekConfig({ ...base, PS_CDEK_WEBHOOK: 'off' })?.webhookRegistration).toBe(false)
  })

  it('неизвестное значение — отказ старта', () => {
    expect(() => parseCdekConfig({ ...base, PS_CDEK_WEBHOOK: 'yes' })).toThrow(CdekConfigError)
  })
})
