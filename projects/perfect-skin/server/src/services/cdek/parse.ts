import type { z } from 'zod'
import type { CdekCity, CdekOrderInfo, CdekPoint, CdekStatus, CdekTariffQuote } from './client.js'
import {
  cityItemSchema,
  errorMessageSchema,
  orderEnvelopeSchema,
  orderStatusItemSchema,
  pointItemSchema,
  tariffItemSchema,
  tariffListSchema,
} from './schemas.js'

const MAX_CITIES = 10
const MAX_ERROR_LENGTH = 300
const REQUEST_STATES = ['ACCEPTED', 'WAITING', 'SUCCESSFUL', 'INVALID'] as const

type PointItem = z.infer<typeof pointItemSchema>

export function toPoints(raw: unknown): { points: CdekPoint[]; skipped: number } {
  const items = Array.isArray(raw) ? raw : []
  const points = items.flatMap((item) => {
    const parsed = pointItemSchema.safeParse(item)
    return parsed.success ? [toPoint(parsed.data)] : []
  })
  return { points, skipped: items.length - points.length }
}

function toPoint(item: PointItem): CdekPoint {
  return {
    code: item.code,
    type: item.type,
    name: item.name,
    address: item.location.address_full,
    city: item.location.city,
    cityCode: item.location.city_code,
    workTime: item.work_time ?? null,
    metro: item.nearest_stations?.[0]?.name ?? null,
    lat: item.location.latitude,
    lon: item.location.longitude,
  }
}

export function toTariffs(raw: unknown): CdekTariffQuote[] {
  const list = tariffListSchema.safeParse(raw)
  if (!list.success) return []
  return list.data.tariff_codes.flatMap((item) => {
    const parsed = tariffItemSchema.safeParse(item)
    if (!parsed.success) return []
    return [
      {
        tariffCode: parsed.data.tariff_code,
        deliverySumRub: parsed.data.delivery_sum,
        periodMin: parsed.data.period_min,
        periodMax: parsed.data.period_max,
      },
    ]
  })
}

export function toCities(raw: unknown): CdekCity[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((item) => {
      const parsed = cityItemSchema.safeParse(item)
      return parsed.success ? [{ code: parsed.data.code, name: parsed.data.full_name }] : []
    })
    .slice(0, MAX_CITIES)
}

export function toOrderInfo(raw: unknown): CdekOrderInfo {
  const { entity } = orderEnvelopeSchema.parse(raw)
  const requests: unknown[] = Array.isArray(entity.requests) ? entity.requests : []
  const statuses: unknown[] = Array.isArray(entity.statuses) ? entity.statuses : []
  const lastRequest: unknown = requests.at(-1)
  const state =
    typeof lastRequest === 'object' && lastRequest !== null && 'state' in lastRequest
      ? lastRequest.state
      : undefined

  return {
    uuid: entity.uuid,
    number: typeof entity.number === 'string' ? entity.number : null,
    cdekNumber:
      typeof entity.cdek_number === 'string' || typeof entity.cdek_number === 'number'
        ? String(entity.cdek_number)
        : null,
    requestState: isRequestState(state) ? state : null,
    requestErrors: collectErrors(entity),
    statuses: statuses.flatMap(toStatus),
  }
}

function toStatus(item: unknown): CdekStatus[] {
  const parsed = orderStatusItemSchema.safeParse(item)
  if (!parsed.success) return []
  const at = parseCdekDateTime(parsed.data.date_time)
  if (Number.isNaN(at.getTime())) return []
  return [{ code: parsed.data.code, name: parsed.data.name ?? null, city: parsed.data.city ?? null, at }]
}

function isRequestState(value: unknown): value is (typeof REQUEST_STATES)[number] {
  return typeof value === 'string' && (REQUEST_STATES as readonly string[]).includes(value)
}

export function collectErrors(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null) return []
  const top = 'errors' in raw ? raw.errors : undefined
  const requests = 'requests' in raw ? raw.requests : undefined
  const nested = Array.isArray(requests)
    ? requests.flatMap((request: unknown) =>
        typeof request === 'object' && request !== null && 'errors' in request ? messagesOf(request.errors) : []
      )
    : []
  return [...messagesOf(top), ...nested]
}

function messagesOf(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list.flatMap((item: unknown) => {
    const parsed = errorMessageSchema.safeParse(item)
    return parsed.success ? [parsed.data.message.slice(0, MAX_ERROR_LENGTH)] : []
  })
}

export function parseCdekDateTime(value: string): Date {
  return new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
}
