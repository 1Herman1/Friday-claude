import { describe, it, expect, vi } from 'vitest'
import { lookupParty, parsePartyResponse } from '../lib/registry/dadata.js'

describe('dadata', () => {
  describe('parsePartyResponse', () => {
    it('parses ACTIVE status correctly', () => {
      const json = {
        suggestions: [
          {
            data: {
              name: {
                short_with_opf: 'ООО Тестовая',
              },
              state: {
                status: 'ACTIVE',
              },
              type: 'LEGAL',
              okved: '96.02',
              okveds: [{ code: '96.02' }, { code: '96.04' }],
              ogrn: '1234567890123',
            },
          },
        ],
      }

      const result = parsePartyResponse(json)

      expect(result.status).toBe('found')
      expect(result.name).toBe('ООО Тестовая')
      expect(result.state).toBe('ACTIVE')
      expect(result.okvedMain).toBe('96.02')
      expect(result.okveds).toEqual(['96.02', '96.04'])
      expect(result.ogrn).toBe('1234567890123')
      expect(result.kind).toBe('legal')
    })

    it('parses LIQUIDATED status correctly', () => {
      const json = {
        suggestions: [
          {
            data: {
              name: {
                value: 'ИП Иванов И.И.',
              },
              state: {
                status: 'LIQUIDATED',
              },
              type: 'IP',
              okved: '86.90',
              okveds: [{ code: '86.90' }],
              ogrn: null,
            },
          },
        ],
      }

      const result = parsePartyResponse(json)

      expect(result.status).toBe('found')
      expect(result.name).toBe('ИП Иванов И.И.')
      expect(result.state).toBe('LIQUIDATED')
      expect(result.kind).toBe('individual')
    })

    it('returns not_found for empty suggestions', () => {
      const json = {
        suggestions: [],
      }

      const result = parsePartyResponse(json)

      expect(result.status).toBe('not_found')
    })

    it('returns unavailable for malformed response', () => {
      expect(parsePartyResponse(null).status).toBe('unavailable')
      expect(parsePartyResponse(undefined).status).toBe('unavailable')
      expect(parsePartyResponse({}).status).toBe('not_found') // Empty object has no suggestions
      expect(parsePartyResponse('invalid').status).toBe('unavailable')
    })

    it('handles missing name gracefully', () => {
      const json = {
        suggestions: [
          {
            data: {
              state: {
                status: 'ACTIVE',
              },
              type: 'LEGAL',
            },
          },
        ],
      }

      const result = parsePartyResponse(json)

      expect(result.status).toBe('unavailable')
    })

    it('handles missing state gracefully', () => {
      const json = {
        suggestions: [
          {
            data: {
              name: {
                short_with_opf: 'ООО Test',
              },
              type: 'LEGAL',
            },
          },
        ],
      }

      const result = parsePartyResponse(json)

      expect(result.status).toBe('unavailable')
    })

    it('handles null okveds array', () => {
      const json = {
        suggestions: [
          {
            data: {
              name: {
                short_with_opf: 'ООО Test',
              },
              state: {
                status: 'ACTIVE',
              },
              type: 'LEGAL',
              okved: null,
              okveds: null,
            },
          },
        ],
      }

      const result = parsePartyResponse(json)

      expect(result.status).toBe('found')
      expect(result.okveds).toEqual([])
    })
  })

  describe('lookupParty', () => {
    it('returns unavailable when API key is empty', async () => {
      const result = await lookupParty('1234567890', '')

      expect(result.status).toBe('unavailable')
    })

    it('returns unavailable when API key is not provided', async () => {
      const result = await lookupParty('1234567890', '')

      expect(result.status).toBe('unavailable')
    })

    it('handles HTTP 500 error gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await lookupParty('1234567890', 'test-key')

      expect(result.status).toBe('unavailable')
    })

    it('handles timeout gracefully', async () => {
      global.fetch = vi.fn().mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          const error = new Error('Aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })

      const result = await lookupParty('1234567890', 'test-key')

      expect(result.status).toBe('unavailable')
    })

    it('handles invalid JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      const result = await lookupParty('1234567890', 'test-key')

      expect(result.status).toBe('unavailable')
    })

    it('sends correct request headers', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      })
      global.fetch = mockFetch

      await lookupParty('1234567890', 'test-key-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Token test-key-123',
          }),
          body: JSON.stringify({
            query: '1234567890',
            count: 1,
          }),
        })
      )
    })
  })
})
