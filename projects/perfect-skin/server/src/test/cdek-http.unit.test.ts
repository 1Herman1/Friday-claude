import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import {
  CdekHttp,
  CdekRejectedError,
  CdekUnavailableError,
  readBodyLimited,
} from '../services/cdek/http.js'
import { listResponseSchema } from '../services/cdek/schemas.js'

const cfg = {
  baseUrl: 'https://api.edu.cdek.ru/v2',
  clientId: 'client-id',
  clientSecret: 'client-secret-value',
}
const TOKEN_PATH = '/oauth/token'
const errorFixture: unknown = JSON.parse(
  readFileSync(new URL('fixtures/cdek/error-400.json', import.meta.url), 'utf-8')
)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function fetchStub(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    return handler(String(input), init ?? {})
  })
}

function tokenCalls(stub: { mock: { calls: unknown[][] } }): number {
  return stub.mock.calls.filter(([input]) => String(input).endsWith(TOKEN_PATH)).length
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('ожидалась ошибка, но запрос прошёл')
}

describe('CDEK HTTP: токен', () => {
  it('токен запрашивается один раз на пять параллельных запросов', async () => {
    const stub = fetchStub((url) => (url.endsWith(TOKEN_PATH) ? json({ access_token: 'tok-1', expires_in: 3600 }) : json([])))
    const http = new CdekHttp(cfg, stub)

    await Promise.all(Array.from({ length: 5 }, () => http.request('GET', '/x', { schema: listResponseSchema })))

    expect(tokenCalls(stub)).toBe(1)
  })

  it('после expires_in минус минута токен запрашивается заново', async () => {
    let now = 1_000_000
    const stub = fetchStub((url) => (url.endsWith(TOKEN_PATH) ? json({ access_token: 'tok', expires_in: 3600 }) : json([])))
    const http = new CdekHttp(cfg, stub, () => now)

    await http.request('GET', '/x', { schema: listResponseSchema })
    now += 3_539_000
    await http.request('GET', '/x', { schema: listResponseSchema })
    expect(tokenCalls(stub)).toBe(1)

    now += 2_000
    await http.request('GET', '/x', { schema: listResponseSchema })
    expect(tokenCalls(stub)).toBe(2)
  })

  it('401 сбрасывает токен и повторяет запрос ровно один раз', async () => {
    let tokenNo = 0
    let apiCalls = 0
    const stub = fetchStub((url, init) => {
      if (url.endsWith(TOKEN_PATH)) {
        tokenNo += 1
        return json({ access_token: `tok-${tokenNo}`, expires_in: 3600 })
      }
      apiCalls += 1
      const auth = new Headers(init.headers).get('authorization')
      return auth === 'Bearer tok-2' ? json([]) : json({}, 401)
    })
    const http = new CdekHttp(cfg, stub)

    await expect(http.request('GET', '/x', { schema: listResponseSchema })).resolves.toEqual([])
    expect(tokenCalls(stub)).toBe(2)
    expect(apiCalls).toBe(2)
  })

  it('постоянный 401 не даёт бесконечного повтора', async () => {
    let apiCalls = 0
    const stub = fetchStub((url) => {
      if (url.endsWith(TOKEN_PATH)) return json({ access_token: 'tok', expires_in: 3600 })
      apiCalls += 1
      return json({}, 401)
    })
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.request('GET', '/x', { schema: listResponseSchema }))
    expect(error).toBeInstanceOf(CdekRejectedError)
    expect(apiCalls).toBe(2)
  })
})

describe('CDEK HTTP: ошибки', () => {
  const okToken = (url: string): Response | null =>
    url.endsWith(TOKEN_PATH) ? json({ access_token: 'tok', expires_in: 3600 }) : null

  it('зависший запрос обрывается по таймауту', async () => {
    const stub = fetchStub((url, init) => {
      const token = okToken(url)
      if (token) return token
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    })
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.request('GET', '/x', { schema: listResponseSchema, timeoutMs: 20 }))
    expect(error).toBeInstanceOf(CdekUnavailableError)
    expect(error).toHaveProperty('reason', 'timeout')
  })

  it('502 даёт http_5xx с кодом статуса', async () => {
    const stub = fetchStub((url) => okToken(url) ?? json({}, 502))
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.request('GET', '/x', { schema: listResponseSchema }))
    expect(error).toMatchObject({ reason: 'http_5xx', httpStatus: 502 })
  })

  it('400 с errors даёт CdekRejectedError со всеми текстами', async () => {
    const stub = fetchStub((url) => okToken(url) ?? json(errorFixture, 400))
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.request('GET', '/x', { schema: listResponseSchema }))
    expect(error).toBeInstanceOf(CdekRejectedError)
    expect(error).toMatchObject({ httpStatus: 400, messages: ['Неверные данные', 'Город не найден'] })
  })

  it('ответ больше лимита даёт too_large', async () => {
    const stub = fetchStub((url) => okToken(url) ?? new Response('x'.repeat(5_000), { status: 200 }))
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.request('GET', '/x', { schema: listResponseSchema, maxBytes: 1_000 }))
    expect(error).toMatchObject({ reason: 'too_large' })
  })

  it('ответ, не прошедший zod, даёт bad_response', async () => {
    const stub = fetchStub((url) => okToken(url) ?? json({ unexpected: true }))
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.request('GET', '/x', { schema: z.array(z.string()) }))
    expect(error).toMatchObject({ reason: 'bad_response' })
  })

  it('текст ошибки не содержит секрет и токен', async () => {
    const stub = fetchStub((url) => okToken(url) ?? json({}, 500))
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.request('GET', '/x', { schema: listResponseSchema }))
    expect(String(error)).not.toContain(cfg.clientSecret)
    expect(String(error)).not.toContain('tok')
  })

  it('предохранитель открывается после трёх сбоев и закрывается через 30 секунд', async () => {
    let now = 0
    let apiCalls = 0
    const stub = fetchStub((url) => {
      const token = okToken(url)
      if (token) return token
      apiCalls += 1
      return json({}, 500)
    })
    const http = new CdekHttp(cfg, stub, () => now)

    for (let i = 0; i < 3; i += 1) {
      await expect(http.request('GET', '/x', { schema: listResponseSchema })).rejects.toMatchObject({ reason: 'http_5xx' })
    }
    expect(apiCalls).toBe(3)

    const blocked = await errorOf(http.request('GET', '/x', { schema: listResponseSchema }))
    expect(blocked).toMatchObject({ reason: 'circuit_open' })
    expect(apiCalls).toBe(3)

    now += 30_000
    await expect(http.request('GET', '/x', { schema: listResponseSchema })).rejects.toMatchObject({ reason: 'http_5xx' })
    expect(apiCalls).toBe(4)
  })
})

describe('CDEK HTTP: чтение тела', () => {
  it('короткое тело читается целиком', async () => {
    await expect(readBodyLimited(new Response('привет'), 100)).resolves.toBe('привет')
  })

  it('тело больше лимита отклоняется', async () => {
    const error = await errorOf(readBodyLimited(new Response('x'.repeat(200)), 100))
    expect(error).toMatchObject({ reason: 'too_large' })
  })
})
