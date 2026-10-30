import { describe, it, expect } from 'vitest'
import { effectOf, FORWARD_FROM } from '../services/cdek/status-map.js'

describe('CDEK status map', () => {
  it('DELIVERED и POSTOMAT_RECEIVED переводят в delivered', () => {
    expect(effectOf('DELIVERED')).toMatchObject({ orderStatus: 'delivered', problem: false, known: true })
    expect(effectOf('POSTOMAT_RECEIVED').orderStatus).toBe('delivered')
  })

  it('транзитные коды переводят в in_transit', () => {
    expect(effectOf('SENT_TO_RECIPIENT_CITY').orderStatus).toBe('in_transit')
    expect(effectOf('TAKEN_BY_COURIER').orderStatus).toBe('in_transit')
  })

  it('проблемные коды не меняют статус и помечаются problem', () => {
    for (const code of ['NOT_DELIVERED', 'RETURNED_TO_SENDER_CITY_WAREHOUSE', 'POSTOMAT_SEIZED']) {
      expect(effectOf(code)).toMatchObject({ orderStatus: null, problem: true })
    }
  })

  it('ACCEPTED и CREATED ничего не меняют', () => {
    expect(effectOf('ACCEPTED')).toMatchObject({ orderStatus: null, problem: false, known: true })
    expect(effectOf('CREATED').orderStatus).toBeNull()
  })

  it('неизвестный код без эффекта и помечен как неизвестный', () => {
    expect(effectOf('SOME_NEW_CODE')).toEqual({ orderStatus: null, problem: false, known: false })
  })

  it('переходы только вперёд: из cancelled и delivered никуда не уводит', () => {
    expect(FORWARD_FROM.in_transit).not.toContain('cancelled')
    expect(FORWARD_FROM.in_transit).not.toContain('delivered')
    expect(FORWARD_FROM.delivered).not.toContain('delivered')
    expect(FORWARD_FROM.delivered).not.toContain('cancelled')
  })
})
