import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { suggestAddress } from './dadata'

describe('suggestAddress', () => {
  const originalEnv = process.env.DADATA_TOKEN

  beforeEach(() => {
    vi.clearAllMocks()
    // Сохранять исходное значение перед каждым тестом
    process.env.DADATA_TOKEN = undefined
  })

  afterEach(() => {
    process.env.DADATA_TOKEN = originalEnv
  })

  it('throws error when DADATA_TOKEN is not configured', async () => {
    process.env.DADATA_TOKEN = ''

    await expect(suggestAddress('Москва')).rejects.toThrow('not configured')
  })

  it('maps DaData response correctly', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    const mockResponse = {
      suggestions: [
        {
          value: 'г. Москва, ул. Ленина, 10',
          data: {
            city: 'Москва',
            street_with_type: 'ул. Ленина',
            house: '10',
            postal_code: '101000',
            geo_lat: '55.7558',
            geo_lon: '37.6173',
          },
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await suggestAddress('Москва ул. Ленина')

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      value: 'г. Москва, ул. Ленина, 10',
      city: 'Москва',
      street: 'ул. Ленина',
      house: '10',
      postalCode: '101000',
      lat: 55.7558,
      lon: 37.6173,
      complete: true,
    })
  })

  it('handles house with block correctly', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    const mockResponse = {
      suggestions: [
        {
          value: 'г. Москва, ул. Ленина, 10 к2',
          data: {
            city: 'Москва',
            street_with_type: 'ул. Ленина',
            house: '10',
            block_type: 'к',
            block: '2',
          },
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await suggestAddress('Москва ул. Ленина 10')

    expect(result[0].house).toBe('10 к2')
  })

  it('marks address as incomplete when house is missing', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    const mockResponse = {
      suggestions: [
        {
          value: 'г. Москва, ул. Ленина',
          data: {
            city: 'Москва',
            street_with_type: 'ул. Ленина',
          },
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await suggestAddress('Москва ул. Ленина')

    expect(result[0].complete).toBe(false)
    expect(result[0].house).toBe('')
  })

  it('uses settlement fallback when city is not provided', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    const mockResponse = {
      suggestions: [
        {
          value: 'д. Пушкино',
          data: {
            settlement: 'Пушкино',
            street_with_type: 'ул. Центральная',
          },
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await suggestAddress('Пушкино')

    expect(result[0].city).toBe('Пушкино')
  })

  it('handles DaData server error', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    await expect(suggestAddress('Москва')).rejects.toThrow('DaData returned 500')
  })


  it('sends correct request to DaData', async () => {
    process.env.DADATA_TOKEN = 'my-token'

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
    })

    await suggestAddress('Москва Ленина')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Authorization': 'Token my-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'Москва Ленина',
          count: 7,
          locations: [{ country_iso_code: 'RU' }],
          from_bound: { value: 'city' },
          to_bound: { value: 'house' },
        }),
      })
    )
  })
})
