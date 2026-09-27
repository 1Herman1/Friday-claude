import { describe, it, expect } from 'vitest'
import { consultationSchema } from '../lib/consultation-schema.js'

const base = { name: 'Анна', phone: '+7 (999) 123-45-67', channel: 'phone', consentPd: 'true', consentHealth: 'true' }

describe('consultationSchema', () => {
  it('normalizes phone to digits', () => {
    const r = consultationSchema.safeParse(base)
    expect(r.success && r.data.phone).toBe('79991234567')
  })
  it('requires both consents', () => {
    expect(consultationSchema.safeParse({ ...base, consentHealth: undefined }).success).toBe(false)
    expect(consultationSchema.safeParse({ ...base, consentPd: 'false' }).success).toBe(false)
  })
  it('rejects short phone and bad email', () => {
    expect(consultationSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false)
    expect(consultationSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false)
  })
})
