import { describe, it, expect, afterEach } from 'vitest'

describe('cookieInsecure', () => {
  const ORIGINAL = process.env.PS_COOKIE_INSECURE

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PS_COOKIE_INSECURE
    else process.env.PS_COOKIE_INSECURE = ORIGINAL
  })

  it('выключен по умолчанию — прод не затрагивается', async () => {
    delete process.env.PS_COOKIE_INSECURE
    const { cookieInsecure } = await import('../lib/env.js?default')
    expect(cookieInsecure).toBe(false)
  })

  it('включается только строкой "1"', async () => {
    process.env.PS_COOKIE_INSECURE = 'true'
    const { cookieInsecure: notOne } = await import('../lib/env.js?not-one')
    expect(notOne).toBe(false)

    process.env.PS_COOKIE_INSECURE = '1'
    const { cookieInsecure: enabled } = await import('../lib/env.js?enabled')
    expect(enabled).toBe(true)
  })
})
