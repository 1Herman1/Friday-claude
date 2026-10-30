import { describe, it, expect, afterEach } from 'vitest'
import { cdekCanSubmit } from '../services/admin-order.service.js'
import { setCdekForTests, type CdekServices } from '../services/cdek/registry.js'
import type { CdekClient } from '../services/cdek/client.js'
import { parseCdekConfig, type CdekConfig } from '../services/cdek/config.js'

const cfg = parseCdekConfig({ PS_CDEK_CLIENT_ID: 'id', PS_CDEK_CLIENT_SECRET: 'secret' }, 'host') as CdekConfig
const now = new Date('2026-10-30T12:00:00Z')
const base = { deliveryMethod: 'cdek_courier', status: 'new' as const, cdekState: null, cdekRequestedAt: null }

afterEach(() => setCdekForTests(null))

describe('cdekCanSubmit', () => {
  it('выключено → нельзя передать', () => {
    expect(cdekCanSubmit(base, now)).toBe(false)
  })

  it('включено: новый курьерский заказ можно передать', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    expect(cdekCanSubmit(base, now)).toBe(true)
  })

  it('самовывоз, отменённый и доставленный — нельзя', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    expect(cdekCanSubmit({ ...base, deliveryMethod: 'pickup' }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, status: 'cancelled' }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, status: 'delivered' }, now)).toBe(false)
  })

  it('accepted и created — нельзя; invalid — можно повторить', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    expect(cdekCanSubmit({ ...base, cdekState: 'accepted' }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, cdekState: 'created' }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, cdekState: 'invalid' }, now)).toBe(true)
  })

  it('creating: свежий захват — нельзя, старше 5 минут — можно', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    expect(cdekCanSubmit({ ...base, cdekState: 'creating', cdekRequestedAt: new Date(now.getTime() - 60_000) }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, cdekState: 'creating', cdekRequestedAt: new Date(now.getTime() - 6 * 60_000) }, now)).toBe(true)
  })
})
