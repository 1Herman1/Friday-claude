import { describe, it, expect } from 'vitest'
import {
  buildApplicationText,
  buildConsultationText,
  buildOrderText,
} from '../services/telegram/notifier.js'

const PII = ['Иванова Мария', '+79991234567', 'maria@example.com', '771234567890', 'ул. Ленина 1']

const person = {
  name: 'Иванова Мария',
  phone: '+79991234567',
  email: 'maria@example.com',
  inn: '771234567890',
  address: 'ул. Ленина 1',
}

function expectNoPii(text: string) {
  for (const value of PII) {
    expect(text).not.toContain(value)
  }
}

describe('Telegram notifications contain no PII', () => {
  it('pro application', () => {
    const applicant = { ...person, companyName: 'Иванова Мария', proCheck: { lane: 'green' } }
    expectNoPii(buildApplicationText({ ...applicant, duplicates: { pending: 1, approved: 2 }, queueCount: 3 }))
    expectNoPii(buildApplicationText({ ...applicant, proCheck: null, duplicates: null, queueCount: 0 }))
  })

  it('consultation', () => {
    for (const channel of ['phone', 'telegram', 'whatsapp', null]) {
      const consultation = { ...person, message: 'ул. Ленина 1', channel, queueCount: 4 }
      expectNoPii(buildConsultationText(consultation))
    }
  })

  it('order', () => {
    const order = {
      ...person,
      recipientName: 'Иванова Мария',
      recipientPhone: '+79991234567',
      deliveryAddress: 'ул. Ленина 1',
      number: 'PS-000123',
      total: 123450,
      deliveryMethod: 'cdek_courier',
      paymentStatus: 'paid',
      items: [{ quantity: 2 }, { quantity: 1 }],
    }
    const text = buildOrderText(order)
    expectNoPii(text)
    expect(text).toContain('PS-000123')
  })
})
