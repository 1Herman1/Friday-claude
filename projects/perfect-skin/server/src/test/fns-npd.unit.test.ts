import { describe, it, expect, vi } from 'vitest'
import { checkSelfEmployed } from '../lib/fns-npd.js'

describe('fns-npd', () => {
  describe('checkSelfEmployed', () => {
    it('should return self_employed when status is true', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ status: true, message: 'ok' }),
      })

      const result = await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any })

      expect(result).toBe('self_employed')
      expect(mockFetch).toHaveBeenCalledOnce()

      const callArgs = mockFetch.mock.calls[0]
      const url = callArgs[0]
      const options = callArgs[1]

      expect(url).toBe('https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status')
      expect(options.method).toBe('POST')
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(options.body)).toHaveProperty('inn', '123456789012')
      expect(JSON.parse(options.body)).toHaveProperty('requestDate')
    })

    it('should return not_self_employed when status is false', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ status: false, message: 'not registered' }),
      })

      const result = await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any })

      expect(result).toBe('not_self_employed')
    })

    it('should return unavailable on non-200 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 422,
        json: async () => ({ error: 'unprocessable' }),
      })

      const result = await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any })

      expect(result).toBe('unavailable')
    })

    it('should return unavailable on 500 error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 500,
        json: async () => ({ error: 'server error' }),
      })

      const result = await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any })

      expect(result).toBe('unavailable')
    })

    it('should return unavailable on timeout', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new DOMException('Timeout', 'AbortError'))

      const result = await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any })

      expect(result).toBe('unavailable')
    })

    it('should return unavailable on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any })

      expect(result).toBe('unavailable')
    })

    it('should return unavailable on invalid JSON response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const result = await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any })

      expect(result).toBe('unavailable')
    })

    it('should return unavailable when status field is missing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ message: 'ok' }),
      })

      const result = await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any })

      expect(result).toBe('unavailable')
    })

    it('should use provided date for request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ status: true }),
      })

      const testDate = new Date('2024-01-15T10:00:00.000Z')
      await checkSelfEmployed('123456789012', { fetchImpl: mockFetch as any, now: testDate })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      // Дата по Москве (UTC+3) = 2024-01-15 13:00:00
      expect(callBody.requestDate).toBe('2024-01-15')
    })

    it('should validate request contains only inn and date', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ status: true }),
      })

      const inn = '123456789012'
      await checkSelfEmployed(inn, { fetchImpl: mockFetch as any })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(Object.keys(callBody)).toEqual(['inn', 'requestDate'])
      expect(callBody.inn).toBe(inn)
    })
  })
})
