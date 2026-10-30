import { z } from 'zod'
import type { CdekConfig } from './config.js'
import { CdekRejectedError, type CdekHttp } from './http.js'
import { toCities, toOrderInfo, toPoints, toTariffs } from './parse.js'
import {
  entityUuidResponseSchema,
  listResponseSchema,
  orderEnvelopeSchema,
  printResponseSchema,
  tariffListSchema,
  webhookItemSchema,
} from './schemas.js'

export interface CdekCity {
  code: number
  name: string
}

export interface CdekPoint {
  code: string
  type: 'PVZ' | 'POSTAMAT'
  name: string
  address: string
  city: string
  cityCode: number
  workTime: string | null
  metro: string | null
  lat: number
  lon: number
}

export interface CdekPackage {
  weight: number
  length: number
  width: number
  height: number
}

export interface CdekTariffQuote {
  tariffCode: number
  deliverySumRub: number
  periodMin: number
  periodMax: number
}

export interface CdekStatus {
  code: string
  name: string | null
  city: string | null
  at: Date
}

export interface CdekOrderInfo {
  uuid: string
  number: string | null
  cdekNumber: string | null
  requestState: 'ACCEPTED' | 'WAITING' | 'SUCCESSFUL' | 'INVALID' | null
  requestErrors: string[]
  statuses: CdekStatus[]
}

export interface CdekCreateOrderPayload {
  type: 1
  number: string
  tariff_code: number
  shipment_point?: string
  from_location?: { code: number; address?: string; postal_code?: string }
  delivery_point?: string
  to_location?: { code: number; address: string; postal_code?: string }
  recipient: { name: string; phones: { number: string }[] }
  delivery_recipient_cost: { value: number }
  packages: {
    number: string
    weight: number
    length: number
    width: number
    height: number
    items: {
      name: string
      ware_key: string
      payment: { value: number }
      cost: number
      weight: number
      amount: number
    }[]
  }[]
}

const POINTS_TIMEOUT_MS = 20_000
const POINTS_MAX_BYTES = 30_000_000

export class CdekClient {
  constructor(
    private readonly http: CdekHttp,
    private readonly cfg: CdekConfig
  ) {}

  async suggestCities(q: string): Promise<CdekCity[]> {
    const raw = await this.http.request('GET', '/location/suggest/cities', {
      query: { name: q, country_code: 'RU' },
      schema: listResponseSchema,
    })
    return toCities(raw)
  }

  async listPoints(cityCode: number): Promise<CdekPoint[]> {
    const raw = await this.http.request('GET', '/deliverypoints', {
      query: { city_code: cityCode, country_code: 'RU', type: 'ALL', is_handout: true },
      schema: listResponseSchema,
      timeoutMs: POINTS_TIMEOUT_MS,
      maxBytes: POINTS_MAX_BYTES,
    })
    return toPoints(raw).points
  }

  async tariffList(toCityCode: number, pkg: CdekPackage): Promise<CdekTariffQuote[]> {
    const raw = await this.http.request('POST', '/calculator/tarifflist', {
      body: {
        type: 1,
        currency: 1,
        lang: 'rus',
        from_location: {
          code: this.cfg.fromCityCode,
          ...(this.cfg.fromPostalCode ? { postal_code: this.cfg.fromPostalCode } : {}),
        },
        to_location: { code: toCityCode },
        packages: [pkg],
      },
      schema: tariffListSchema,
    })
    return toTariffs(raw)
  }

  async createOrder(payload: CdekCreateOrderPayload): Promise<{ uuid: string }> {
    const raw = await this.http.request('POST', '/orders', {
      body: payload,
      schema: entityUuidResponseSchema,
    })
    return { uuid: raw.entity.uuid }
  }

  async getOrder(uuid: string): Promise<CdekOrderInfo> {
    const raw = await this.http.request('GET', `/orders/${encodeURIComponent(uuid)}`, {
      schema: orderEnvelopeSchema,
    })
    return toOrderInfo(raw)
  }

  async findOrderByNumber(number: string): Promise<CdekOrderInfo | null> {
    try {
      const raw = await this.http.request('GET', '/orders', {
        query: { im_number: number },
        schema: orderEnvelopeSchema,
      })
      return toOrderInfo(raw)
    } catch (error) {
      if (error instanceof CdekRejectedError && error.httpStatus === 404) return null
      throw error
    }
  }

  async createPrint(kind: 'waybill' | 'barcode', orderUuid: string): Promise<string> {
    const body =
      kind === 'waybill'
        ? { orders: [{ order_uuid: orderUuid }], copy_count: 2 }
        : { orders: [{ order_uuid: orderUuid }], copy_count: 1, format: 'A6' }
    const raw = await this.http.request('POST', printPath(kind), {
      body,
      schema: entityUuidResponseSchema,
    })
    return raw.entity.uuid
  }

  async getPrint(
    kind: 'waybill' | 'barcode',
    printUuid: string
  ): Promise<{ url: string | null; lastStatus: string | null }> {
    const raw = await this.http.request('GET', `${printPath(kind)}/${encodeURIComponent(printUuid)}`, {
      schema: printResponseSchema,
    })
    const statuses = raw.entity.statuses ?? []
    return {
      url: raw.entity.url || null,
      lastStatus: statuses.at(-1)?.code ?? null,
    }
  }

  downloadPdf(url: string): Promise<Buffer> {
    return this.http.downloadPdf(url)
  }

  async listWebhooks(): Promise<{ uuid: string; type: string; url: string }[]> {
    const raw = await this.http.request('GET', '/webhooks', { schema: listResponseSchema })
    return raw.flatMap((item) => {
      const parsed = webhookItemSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })
  }

  async createWebhook(url: string): Promise<string> {
    const raw = await this.http.request('POST', '/webhooks', {
      body: { type: 'ORDER_STATUS', url },
      schema: entityUuidResponseSchema,
    })
    return raw.entity.uuid
  }

  async deleteWebhook(uuid: string): Promise<void> {
    await this.http.request('DELETE', `/webhooks/${encodeURIComponent(uuid)}`, { schema: z.unknown() })
  }
}

function printPath(kind: 'waybill' | 'barcode'): string {
  return kind === 'waybill' ? '/print/orders' : '/print/barcodes'
}
