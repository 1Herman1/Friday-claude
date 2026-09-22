import { describe, it, expect, afterEach, vi } from 'vitest'

describe('cookieInsecure', () => {
  const ORIGINAL = process.env.PS_COOKIE_INSECURE

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PS_COOKIE_INSECURE
    else process.env.PS_COOKIE_INSECURE = ORIGINAL
    vi.resetModules()
  })

  it('выключен по умолчанию — прод не затрагивается', async () => {
    delete process.env.PS_COOKIE_INSECURE
    vi.resetModules()
    const { cookieInsecure } = await import('../lib/env.js')
    expect(cookieInsecure).toBe(false)
  })

  it('включается только строкой "1"', async () => {
    process.env.PS_COOKIE_INSECURE = 'true'
    vi.resetModules()
    const { cookieInsecure: notOne } = await import('../lib/env.js')
    expect(notOne).toBe(false)

    process.env.PS_COOKIE_INSECURE = '1'
    vi.resetModules()
    const { cookieInsecure: enabled } = await import('../lib/env.js')
    expect(enabled).toBe(true)
  })
})
