import { describe, it, expect } from 'vitest'
import { careSchema } from '../lib/care-schema.js'

const base = { name: 'Анна', phone: '+7 (999) 123-45-67', channel: 'telegram', consentPd: 'true' }

describe('careSchema', () => {
  it('normalizes phone to digits', () => {
    const r = careSchema.safeParse(base)
    expect(r.success && r.data.phone).toBe('79991234567')
  })
  it('requires personal data consent, marketing is optional', () => {
    expect(careSchema.safeParse({ ...base, consentPd: undefined }).success).toBe(false)
    expect(careSchema.safeParse({ ...base, consentPd: 'false' }).success).toBe(false)
    expect(careSchema.safeParse(base).success).toBe(true)
    expect(careSchema.safeParse({ ...base, consentMarketing: 'true' }).success).toBe(true)
    expect(careSchema.safeParse({ ...base, consentMarketing: 'yes' }).success).toBe(false)
  })
  it('rejects short phone, unknown channel and short name', () => {
    expect(careSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false)
    expect(careSchema.safeParse({ ...base, channel: 'email' }).success).toBe(false)
    expect(careSchema.safeParse({ ...base, name: 'А' }).success).toBe(false)
  })
  it('drops health and message fields', () => {
    const r = careSchema.safeParse({ ...base, message: 'сухая кожа', consentHealth: 'true' })
    expect(r.success && 'message' in r.data).toBe(false)
    expect(r.success && 'consentHealth' in r.data).toBe(false)
  })
})
