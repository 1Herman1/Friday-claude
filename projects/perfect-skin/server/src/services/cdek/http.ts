import type { z } from 'zod'
import type { CdekConfig } from './config.js'

export interface CdekLog {
  info(entry: Record<string, unknown>, message: string): void
}
import { collectErrors } from './parse.js'
import { tokenResponseSchema } from './schemas.js'

export class CdekUnavailableError extends Error {
  constructor(
    readonly reason: 'network' | 'timeout' | 'http_5xx' | 'bad_response' | 'too_large' | 'circuit_open',
    readonly httpStatus?: number
  ) {
    super(`СДЭК недоступен: ${reason}`)
  }
}

export class CdekRejectedError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly messages: string[]
  ) {
    super(messages.join('; ') || `СДЭК отклонил запрос (${httpStatus})`)
  }
}

type Method = 'GET' | 'POST' | 'DELETE'
type Query = Record<string, string | number | boolean | undefined>

export interface CdekRequestOptions<T> {
  query?: Query
  body?: unknown
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
  timeoutMs?: number
  maxBytes?: number
}

interface Exchange {
  url: string
  method: Method
  contentType?: string
  body?: string
  timeoutMs: number
  maxBytes: number
}

interface Reply {
  status: number
  bytes: Buffer
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_BYTES = 1_000_000
const PDF_MAX_BYTES = 10_000_000
const TOKEN_MARGIN_S = 60
const BREAKER_THRESHOLD = 3
const BREAKER_COOLDOWN_MS = 30_000
const PDF_MAGIC = Buffer.from('%PDF')

export class CdekHttp {
  private token: { value: string; expiresAt: number } | null = null
  private tokenLoad: Promise<string> | null = null
  private consecutiveFailures = 0
  private circuitOpenUntil = 0
  private readonly host: string

  constructor(
    private readonly cfg: Pick<CdekConfig, 'baseUrl' | 'clientId' | 'clientSecret'>,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly log?: CdekLog
  ) {
    this.host = new URL(cfg.baseUrl).host
  }

  async request<T>(method: Method, path: string, opts: CdekRequestOptions<T>): Promise<T> {
    return this.guarded(async () => {
      const reply = await this.exchange({
        url: `${this.cfg.baseUrl}${path}${toQueryString(opts.query)}`,
        method,
        contentType: opts.body === undefined ? undefined : 'application/json',
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBytes: opts.maxBytes ?? DEFAULT_MAX_BYTES,
      })

      if (reply.status >= 400) {
        const messages = collectErrors(parseJsonLenient(reply.bytes))
        throw new CdekRejectedError(reply.status, messages.length > 0 ? messages : ['Запрос отклонён СДЭК'])
      }

      const parsed = opts.schema.safeParse(parseJsonStrict(reply.bytes))
      if (!parsed.success) throw new CdekUnavailableError('bad_response', reply.status)
      return parsed.data
    })
  }

  async downloadPdf(url: string, maxBytes: number = PDF_MAX_BYTES): Promise<Buffer> {
    if (!this.isSameHostHttps(url)) throw new CdekUnavailableError('bad_response')
    return this.guarded(async () => {
      const reply = await this.exchange({ url, method: 'GET', timeoutMs: DEFAULT_TIMEOUT_MS, maxBytes })
      if (reply.status !== 200 || !reply.bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
        throw new CdekUnavailableError('bad_response', reply.status)
      }
      return reply.bytes
    })
  }

  private isSameHostHttps(url: string): boolean {
    try {
      const target = new URL(url)
      return target.protocol === 'https:' && target.host === this.host
    } catch {
      return false
    }
  }

  private async guarded<T>(run: () => Promise<T>): Promise<T> {
    if (this.now() < this.circuitOpenUntil) throw new CdekUnavailableError('circuit_open')
    try {
      const result = await run()
      this.consecutiveFailures = 0
      return result
    } catch (error) {
      if (error instanceof CdekUnavailableError) {
        this.consecutiveFailures += 1
        if (this.consecutiveFailures >= BREAKER_THRESHOLD) {
          this.circuitOpenUntil = this.now() + BREAKER_COOLDOWN_MS
          this.consecutiveFailures = 0
        }
      } else {
        this.consecutiveFailures = 0
      }
      throw error
    }
  }

  private async exchange(req: Exchange): Promise<Reply> {
    let reply = await this.attempt(req, await this.accessToken())
    if (reply.status === 401) {
      this.token = null
      reply = await this.attempt(req, await this.accessToken())
    }
    if (reply.status === 429 || reply.status >= 500) {
      throw new CdekUnavailableError('http_5xx', reply.status)
    }
    return reply
  }

  private async accessToken(): Promise<string> {
    if (this.token !== null && this.token.expiresAt > this.now()) return this.token.value
    this.tokenLoad ??= this.loadToken().finally(() => {
      this.tokenLoad = null
    })
    return this.tokenLoad
  }

  private async loadToken(): Promise<string> {
    const reply = await this.attempt(
      {
        url: `${this.cfg.baseUrl}/oauth/token`,
        method: 'POST',
        contentType: 'application/x-www-form-urlencoded',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
        }).toString(),
        timeoutMs: DEFAULT_TIMEOUT_MS,
        maxBytes: DEFAULT_MAX_BYTES,
      },
      null
    )
    if (reply.status !== 200) {
      throw new CdekUnavailableError(reply.status >= 500 ? 'http_5xx' : 'bad_response', reply.status)
    }
    const parsed = tokenResponseSchema.safeParse(parseJsonStrict(reply.bytes))
    if (!parsed.success) throw new CdekUnavailableError('bad_response', reply.status)

    this.token = {
      value: parsed.data.access_token,
      expiresAt: this.now() + (parsed.data.expires_in - TOKEN_MARGIN_S) * 1000,
    }
    return parsed.data.access_token
  }

  private async attempt(req: Exchange, token: string | null): Promise<Reply> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), req.timeoutMs)
    const startedAt = this.now()
    try {
      const headers: Record<string, string> = {}
      if (req.contentType !== undefined) headers['Content-Type'] = req.contentType
      if (token !== null) headers.Authorization = `Bearer ${token}`
      const res = await this.fetchImpl(req.url, {
        method: req.method,
        headers,
        body: req.body,
        signal: controller.signal,
        redirect: 'error',
      })
      const bytes = await readBytesLimited(res, req.maxBytes)
      this.logExchange(req, res.status, startedAt)
      return { status: res.status, bytes }
    } catch (error) {
      const failure =
        error instanceof CdekUnavailableError
          ? error
          : error instanceof Error && error.name === 'AbortError'
            ? new CdekUnavailableError('timeout')
            : new CdekUnavailableError('network')
      this.logExchange(req, failure.httpStatus ?? failure.reason, startedAt)
      throw failure
    } finally {
      clearTimeout(timer)
    }
  }

  private logExchange(req: Exchange, status: number | string, startedAt: number): void {
    this.log?.info(
      { method: req.method, path: new URL(req.url).pathname, status, durationMs: this.now() - startedAt },
      'СДЭК запрос'
    )
  }
}

export async function readBodyLimited(res: Response, maxBytes: number): Promise<string> {
  return (await readBytesLimited(res, maxBytes)).toString('utf8')
}

async function readBytesLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel()
    throw new CdekUnavailableError('too_large', res.status)
  }
  if (res.body === null) return Buffer.alloc(0)

  const reader = res.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new CdekUnavailableError('too_large', res.status)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

function toQueryString(query: Query | undefined): string {
  if (query === undefined) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const text = params.toString()
  return text === '' ? '' : `?${text}`
}

function parseJsonStrict(bytes: Buffer): unknown {
  if (bytes.length === 0) return undefined
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch {
    throw new CdekUnavailableError('bad_response')
  }
}

function parseJsonLenient(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown
  } catch {
    return undefined
  }
}
