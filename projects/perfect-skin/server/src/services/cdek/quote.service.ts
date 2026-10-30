import * as psSharedNs from '@ps/shared'
import type { FastifyBaseLogger } from 'fastify'
import { ApiError } from '../../lib/errors.js'
import type { CdekConfig, CdekPaidMode } from './config.js'
import type { CdekCity, CdekPackage, CdekPoint, CdekTariffQuote } from './client.js'
import { CdekRejectedError, CdekUnavailableError } from './http.js'
import { CachedLoader } from './cache.js'
import { getCdek, type CdekServices } from './registry.js'

const shared = (psSharedNs as unknown as { default?: typeof psSharedNs }).default ?? psSharedNs
const { calcDeliveryCost, freeThreshold, DELIVERY_COST } = shared

export type QuoteSource = 'fixed' | 'cdek' | 'fallback' | 'free' | 'needs_city' | 'unavailable'
export type CdekMethod = 'cdek_pvz' | 'cdek_courier'
export type DeliveryMethodCode = 'pickup' | CdekMethod

export interface ParcelItem {
  weightGrams: number | null
  quantity: number
}

export interface MethodQuote {
  code: CdekMethod
  cost: number | null
  quoteSource: QuoteSource
  periodMin: number | null
  periodMax: number | null
  costByPointType: { PVZ: number | null; POSTAMAT: number | null } | null
  requiresCity: boolean
}

export interface ResolvedDelivery {
  paidCost: number
  tariffCode: number | null
  cityCode: number | null
  point: CdekPoint | null
  quote: {
    source: QuoteSource
    cdekSum: number | null
    periodMin: number | null
    periodMax: number | null
    weightGrams: number | null
    calculatedAt: string
  } | null
}

export interface CustomerCostInput {
  method: CdekMethod
  goodsAfterDiscount: number
  tariff: CdekTariffQuote | null
  cdekFailed: boolean
  paidMode: CdekPaidMode
}

export interface CustomerCost {
  cost: number | null
  paidCost: number | null
  source: QuoteSource
}

const WEIGHT_STEP_G = 250
const MIN_WEIGHT_G = 250
const CITY_TTL_MS = 24 * 60 * 60_000
const CITY_MAX_ENTRIES = 2000
const POINTS_TTL_MS = 6 * 60 * 60_000
const POINTS_MAX_ENTRIES = 100
const TARIFF_TTL_MS = 30 * 60_000
const TARIFF_EMPTY_TTL_MS = 10 * 60_000
const TARIFF_MAX_ENTRIES = 2000
const MAX_CITY_SUGGESTIONS = 10

export function buildParcel(items: ParcelItem[], cfg: Pick<CdekConfig, 'box' | 'itemWeightG'>): CdekPackage {
  const itemsG = items.reduce((sum, item) => sum + (item.weightGrams ?? cfg.itemWeightG) * item.quantity, 0)
  const grossG = cfg.box.weightG + itemsG
  const weight = Math.max(MIN_WEIGHT_G, Math.ceil(grossG / WEIGHT_STEP_G) * WEIGHT_STEP_G)
  return { weight, length: cfg.box.lengthCm, width: cfg.box.widthCm, height: cfg.box.heightCm }
}

export function rublesToKopecksCeil(rub: number): number {
  return Math.ceil(rub) * 100
}

export function tariffForPoint(type: CdekPoint['type'], cfg: Pick<CdekConfig, 'tariffs'>): number {
  return type === 'POSTAMAT' ? cfg.tariffs.postamat : cfg.tariffs.pvz
}

export function customerCost(input: CustomerCostInput): CustomerCost {
  const calcMethod = input.method === 'cdek_pvz' ? 'pvz' : 'courier'

  let paidCost: number
  let source: QuoteSource
  if (input.cdekFailed) {
    paidCost = DELIVERY_COST
    source = 'fallback'
  } else if (input.tariff === null) {
    return { cost: null, paidCost: null, source: 'unavailable' }
  } else if (input.paidMode === 'fixed') {
    paidCost = DELIVERY_COST
    source = 'fixed'
  } else {
    paidCost = rublesToKopecksCeil(input.tariff.deliverySumRub)
    source = 'cdek'
  }

  const cost = calcDeliveryCost(calcMethod, input.goodsAfterDiscount, paidCost)
  const threshold = freeThreshold(calcMethod)
  if (cost === 0 && threshold !== null && input.goodsAfterDiscount >= threshold) source = 'free'
  return { cost, paidCost, source }
}

export function filterPoints(
  points: CdekPoint[],
  options: { q?: string; type: 'ALL' | CdekPoint['type'] }
): CdekPoint[] {
  const words = (options.q ?? '').toLowerCase().split(/\s+/).filter((word) => word.length > 0)
  return points
    .filter((point) => options.type === 'ALL' || point.type === options.type)
    .filter((point) => {
      const haystack = `${point.name} ${point.address} ${point.metro ?? ''}`.toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
    .sort((a, b) => a.address.localeCompare(b.address, 'ru'))
}

type PriceLog = Pick<FastifyBaseLogger, 'warn'>

export class DeliveryQuoteService {
  private readonly cityCache = new CachedLoader<CdekCity[]>(CITY_TTL_MS, CITY_MAX_ENTRIES)
  private readonly pointCache = new CachedLoader<CdekPoint[]>(POINTS_TTL_MS, POINTS_MAX_ENTRIES)
  private readonly tariffCache = new CachedLoader<CdekTariffQuote[]>(TARIFF_TTL_MS, TARIFF_MAX_ENTRIES)

  constructor(
    private readonly cdek: CdekServices | null,
    private readonly log: PriceLog
  ) {}

  async cities(q: string): Promise<CdekCity[]> {
    const services = this.requireServices()
    const query = q.trim()
    return this.cityCache.get(query.toLowerCase(), async () => {
      try {
        return (await services.client.suggestCities(query)).slice(0, MAX_CITY_SUGGESTIONS)
      } catch (error) {
        if (error instanceof CdekRejectedError) return []
        throw error
      }
    })
  }

  points(cityCode: number): Promise<CdekPoint[]> {
    const services = this.requireServices()
    return this.pointCache.get(String(cityCode), () => services.client.listPoints(cityCode))
  }

  async methods(input: {
    cityCode: number | null
    items: ParcelItem[]
    goodsAfterDiscount: number
  }): Promise<MethodQuote[]> {
    if (input.cityCode === null) {
      return (['cdek_pvz', 'cdek_courier'] as const).map((code) => ({
        code,
        cost: null,
        quoteSource: 'needs_city',
        periodMin: null,
        periodMax: null,
        costByPointType: code === 'cdek_pvz' ? { PVZ: null, POSTAMAT: null } : null,
        requiresCity: true,
      }))
    }

    const services = this.requireServices()
    const parcel = buildParcel(input.items, services.config)
    let tariffs: CdekTariffQuote[] = []
    let cdekFailed = false
    try {
      tariffs = await this.tariffsFor(services, input.cityCode, parcel)
    } catch (error) {
      if (!(error instanceof CdekUnavailableError)) throw error
      this.log.warn({ reason: error.reason }, 'СДЭК недоступен при расчёте доставки, фиксированная цена')
      cdekFailed = true
    }

    const priceWith = (code: number): CustomerCost =>
      customerCost({
        method: 'cdek_pvz',
        goodsAfterDiscount: input.goodsAfterDiscount,
        tariff: tariffs.find((t) => t.tariffCode === code) ?? null,
        cdekFailed,
        paidMode: services.config.paidMode,
      })

    const pvz = priceWith(services.config.tariffs.pvz)
    const postamat = priceWith(services.config.tariffs.postamat)
    const courierTariff = tariffs.find((t) => t.tariffCode === services.config.tariffs.courier) ?? null
    const courier = customerCost({
      method: 'cdek_courier',
      goodsAfterDiscount: input.goodsAfterDiscount,
      tariff: courierTariff,
      cdekFailed,
      paidMode: services.config.paidMode,
    })

    const pvzPrimaryIsPvz = pvz.cost !== null
    const pvzPrimary = pvzPrimaryIsPvz ? pvz : postamat
    const pvzPrimaryCode = pvzPrimaryIsPvz ? services.config.tariffs.pvz : services.config.tariffs.postamat
    const pvzPrimaryTariff = tariffs.find((t) => t.tariffCode === pvzPrimaryCode) ?? null
    return [
      {
        code: 'cdek_pvz',
        cost: pvzPrimary.cost,
        quoteSource: pvzPrimary.source,
        periodMin: cdekFailed ? null : (pvzPrimaryTariff?.periodMin ?? null),
        periodMax: cdekFailed ? null : (pvzPrimaryTariff?.periodMax ?? null),
        costByPointType: { PVZ: pvz.cost, POSTAMAT: postamat.cost },
        requiresCity: false,
      },
      {
        code: 'cdek_courier',
        cost: courier.cost,
        quoteSource: courier.source,
        periodMin: cdekFailed ? null : (courierTariff?.periodMin ?? null),
        periodMax: cdekFailed ? null : (courierTariff?.periodMax ?? null),
        costByPointType: null,
        requiresCity: false,
      },
    ]
  }

  async resolveForOrder(input: {
    method: DeliveryMethodCode
    cityCode: number | null
    pvzCode: string | null
    items: ParcelItem[]
    goodsAfterDiscount: number
  }): Promise<ResolvedDelivery> {
    if (input.method === 'pickup') {
      return { paidCost: 0, tariffCode: null, cityCode: null, point: null, quote: null }
    }
    if (this.cdek === null) {
      return { paidCost: DELIVERY_COST, tariffCode: null, cityCode: null, point: null, quote: null }
    }
    if (input.cityCode === null) {
      throw new ApiError(400, 'CITY_REQUIRED', 'Укажите город доставки')
    }

    const services = this.cdek
    const cityCode = input.cityCode
    const parcel = buildParcel(input.items, services.config)
    let point: CdekPoint | null = null
    let tariffs: CdekTariffQuote[] = []
    let cdekFailed = false
    try {
      if (input.method === 'cdek_pvz') {
        point = (await this.points(cityCode)).find((p) => p.code === input.pvzCode) ?? null
        if (point === null) throw new ApiError(409, 'PVZ_NOT_FOUND', 'Пункт выдачи не найден в этом городе')
      }
      tariffs = await this.tariffsFor(services, cityCode, parcel)
    } catch (error) {
      if (!(error instanceof CdekUnavailableError)) throw error
      this.log.warn({ reason: error.reason }, 'СДЭК недоступен при оформлении, фиксированная цена')
      cdekFailed = true
    }

    const tariffCode =
      input.method === 'cdek_courier'
        ? services.config.tariffs.courier
        : tariffForPoint(point?.type ?? 'PVZ', services.config)
    const tariff = tariffs.find((t) => t.tariffCode === tariffCode) ?? null
    if (!cdekFailed && tariff === null) {
      throw new ApiError(409, 'DELIVERY_UNAVAILABLE', 'Доставка в этот пункт сейчас недоступна')
    }

    const priced = customerCost({
      method: input.method,
      goodsAfterDiscount: input.goodsAfterDiscount,
      tariff,
      cdekFailed,
      paidMode: services.config.paidMode,
    })

    return {
      paidCost: priced.paidCost ?? DELIVERY_COST,
      tariffCode,
      cityCode,
      point,
      quote: {
        source: priced.source,
        cdekSum: tariff === null ? null : rublesToKopecksCeil(tariff.deliverySumRub),
        periodMin: tariff?.periodMin ?? null,
        periodMax: tariff?.periodMax ?? null,
        weightGrams: parcel.weight,
        calculatedAt: new Date().toISOString(),
      },
    }
  }

  private tariffsFor(services: CdekServices, cityCode: number, parcel: CdekPackage): Promise<CdekTariffQuote[]> {
    const key = `${cityCode}|${parcel.weight}|${parcel.length}x${parcel.width}x${parcel.height}`
    return this.tariffCache.get(
      key,
      async () => {
        try {
          return await services.client.tariffList(cityCode, parcel)
        } catch (error) {
          if (error instanceof CdekRejectedError) return []
          throw error
        }
      },
      (list) => (list.length === 0 ? TARIFF_EMPTY_TTL_MS : TARIFF_TTL_MS)
    )
  }

  private requireServices(): CdekServices {
    if (this.cdek === null) throw new ApiError(409, 'CDEK_DISABLED', 'Интеграция с СДЭК выключена')
    return this.cdek
  }
}

let cachedQuote: { cdek: CdekServices | null; service: DeliveryQuoteService } | null = null

export function deliveryQuote(log: PriceLog): DeliveryQuoteService {
  const cdek = getCdek()
  if (cachedQuote === null || cachedQuote.cdek !== cdek) {
    cachedQuote = { cdek, service: new DeliveryQuoteService(cdek, log) }
  }
  return cachedQuote.service
}
