import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildApp } from '../../index'

describe('POST /api/address/suggest', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const originalEnv = process.env.DADATA_TOKEN

  beforeEach(async () => {
    app = await buildApp({ logger: false })
  })

  afterEach(async () => {
    await app.close()
    process.env.DADATA_TOKEN = originalEnv
    vi.clearAllMocks()
  })

  it('returns 503 when DADATA_TOKEN is not configured', async () => {
    process.env.DADATA_TOKEN = ''

    // Нужно пересоздать приложение, чтобы оно прочитало новое значение переменной
    await app.close()
    app = await buildApp({ logger: false })

    const response = await app.inject({
      method: 'POST',
      url: '/api/address/suggest',
      payload: { query: 'Москва' },
    })

    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Подсказки адреса не подключены',
    })
  })

  it('returns 400 for query < 3 characters', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    const response = await app.inject({
      method: 'POST',
      url: '/api/address/suggest',
      payload: { query: 'мо' },
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Некорректный запрос',
    })
  })

  it('returns 400 for query > 200 characters', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    const response = await app.inject({
      method: 'POST',
      url: '/api/address/suggest',
      payload: { query: 'а'.repeat(201) },
      headers: { 'x-forwarded-for': '10.0.0.2' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns suggestions on success', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
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
      }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/address/suggest',
      payload: { query: 'Москва Ленина' },
      headers: { 'x-forwarded-for': '10.0.0.3' },
    })

    expect(response.statusCode).toBe(200)
    const data = JSON.parse(response.body)
    expect(data.suggestions).toHaveLength(1)
    expect(data.suggestions[0].value).toBe('г. Москва, ул. Ленина, 10')
    expect(data.suggestions[0].complete).toBe(true)
  })

  it('returns 502 on DaData error', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/address/suggest',
      payload: { query: 'Москва' },
      headers: { 'x-forwarded-for': '10.0.0.4' },
    })

    expect(response.statusCode).toBe(502)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Не удалось получить подсказки',
    })
  })

  it('applies rate limiting after exceeding limit', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    })

    // Лимит корзины подсказок — 40 за 5 минут (lib/rate-limit.ts): один
    // адрес это 5–10 запросов, а квота DaData не бесконечная.
    for (let i = 0; i < 40; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/address/suggest',
        payload: { query: 'Москва' },
        headers: { 'x-forwarded-for': '1.1.1.1' },
      })
      expect(response.statusCode).toBe(200)
    }

    // 41-й запрос с тем же IP должен быть ограничен
    const limitedResponse = await app.inject({
      method: 'POST',
      url: '/api/address/suggest',
      payload: { query: 'Москва' },
      headers: { 'x-forwarded-for': '1.1.1.1' },
    })
    expect(limitedResponse.statusCode).toBe(429)
    expect(JSON.parse(limitedResponse.body)).toEqual({
      error: 'Слишком много запросов. Попробуйте позже',
    })

    // Но с другим IP должен работать
    const newIpResponse = await app.inject({
      method: 'POST',
      url: '/api/address/suggest',
      payload: { query: 'Москва' },
      headers: { 'x-forwarded-for': '2.2.2.2' },
    })
    expect(newIpResponse.statusCode).toBe(200)
  })

  it('trims query whitespace', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/address/suggest',
      payload: { query: '  Москва  ' },
      headers: { 'x-forwarded-for': '3.3.3.3' },
    })

    expect(response.statusCode).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"query":"Москва"'),
      })
    )
  })
})

describe('GET /api/delivery/features', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const originalEnv = process.env.DADATA_TOKEN

  beforeEach(async () => {
    app = await buildApp({ logger: false })
  })

  afterEach(async () => {
    await app.close()
    process.env.DADATA_TOKEN = originalEnv
  })

  it('returns suggest=true when DADATA_TOKEN is configured', async () => {
    process.env.DADATA_TOKEN = 'test-token'

    const response = await app.inject({
      method: 'GET',
      url: '/api/delivery/features',
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      suggest: true,
      map: false,
    })
  })

  it('returns suggest=false when DADATA_TOKEN is not configured', async () => {
    process.env.DADATA_TOKEN = ''

    // Нужно пересоздать приложение, чтобы оно прочитало новое значение переменной
    await app.close()
    app = await buildApp({ logger: false })

    const response = await app.inject({
      method: 'GET',
      url: '/api/delivery/features',
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      suggest: false,
      map: false,
    })
  })
})
