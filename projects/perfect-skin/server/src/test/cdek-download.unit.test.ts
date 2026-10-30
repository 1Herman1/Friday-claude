import { describe, it, expect, vi } from 'vitest'
import { CdekHttp, CdekUnavailableError } from '../services/cdek/http.js'

const cfg = {
  baseUrl: 'https://api.edu.cdek.ru/v2',
  clientId: 'client-id',
  clientSecret: 'client-secret-value',
}
const PDF_URL = 'https://api.edu.cdek.ru/v2/print/files/waybill.pdf'

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

function fetchStub(handler: (url: string, init: RequestInit) => Response) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    if (url.endsWith('/oauth/token')) return json({ access_token: 'tok', expires_in: 3600 })
    return handler(url, init ?? {})
  })
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('ожидалась ошибка, но запрос прошёл')
}

describe('CDEK: скачивание PDF', () => {
  it('ссылка на чужой хост отклоняется и токен туда не уходит', async () => {
    const stub = fetchStub(() => new Response('%PDF-1.4'))
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.downloadPdf('https://evil.example/files/waybill.pdf'))

    expect(error).toMatchObject({ reason: 'bad_response' })
    expect(stub.mock.calls.some(([input]) => String(input).includes('evil.example'))).toBe(false)
  })

  it('http:// вместо https отклоняется', async () => {
    const stub = fetchStub(() => new Response('%PDF-1.4'))
    const http = new CdekHttp(cfg, stub)

    const error = await errorOf(http.downloadPdf('http://api.edu.cdek.ru/v2/print/files/waybill.pdf'))

    expect(error).toBeInstanceOf(CdekUnavailableError)
    expect(error).toMatchObject({ reason: 'bad_response' })
    expect(stub.mock.calls.some(([input]) => String(input).startsWith('http://'))).toBe(false)
  })

  it('ответ не в формате PDF отклоняется', async () => {
    const http = new CdekHttp(cfg, fetchStub(() => new Response('<html>ошибка</html>', { status: 200 })))

    const error = await errorOf(http.downloadPdf(PDF_URL))

    expect(error).toMatchObject({ reason: 'bad_response' })
  })

  it('нормальный PDF на своём хосте возвращается Buffer и уходит с токеном', async () => {
    const stub = fetchStub(() => new Response('%PDF-1.4\n%%EOF', { status: 200 }))
    const http = new CdekHttp(cfg, stub)

    const file = await http.downloadPdf(PDF_URL)

    expect(Buffer.isBuffer(file)).toBe(true)
    expect(file.subarray(0, 4).toString('latin1')).toBe('%PDF')
    const downloadInit = stub.mock.calls.find(([input]) => String(input) === PDF_URL)?.[1]
    expect(new Headers(downloadInit?.headers).get('authorization')).toBe('Bearer tok')
  })
})
