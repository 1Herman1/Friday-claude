import type { PrismaClient } from '@prisma/client'
import type { DeliveryOptionInfo } from '@simba/shared'
import type { DeliveryAddress, DeliveryPackage, DeliveryQuote, DeliveryOrder, DeliveryProvider, DeliveryMethod, DeliveryOptionKey, PickupPointProvider, PickupPoint } from './types.js'
import { getCityCoords } from './city-coords.js'
import * as ozon from './providers/ozon.js'
import * as cdek from './providers/cdek.js'
import * as yandexPvz from './providers/yandex-pvz.js'
import * as simba from './providers/simba.js'
import { listDeliveryOptions, getDeliveryOption } from './delivery-options.js'

/// Служба по ключу варианта — одна таблица на котировки и проверку заказа.
const PROVIDER_BY_KEY: Record<DeliveryOptionKey, DeliveryProvider> = {
  simba_courier: 'simba_courier',
  cdek_pvz: 'cdek',
  yandex_pvz: 'yandex',
  ozon_pvz: 'ozon',
  pickup: 'pickup',
}

/// Сроки по умолчанию, если в админке не заданы etaMin/etaMax.
const DELIVERY_DAYS: Record<DeliveryOptionKey, { min: number; max: number }> = {
  simba_courier: { min: 0, max: 0 }, // сегодня
  cdek_pvz: { min: 2, max: 5 },
  yandex_pvz: { min: 1, max: 3 },
  ozon_pvz: { min: 2, max: 4 },
  pickup: { min: 0, max: 0 },
}

/** Срок из базы, иначе справочная константа. */
function daysFor(option: DeliveryOptionInfo): { min: number; max: number } {
  if (option.etaMin != null || option.etaMax != null) {
    const min = option.etaMin ?? option.etaMax ?? 0
    return { min, max: option.etaMax ?? min }
  }
  return DELIVERY_DAYS[option.key]
}

/** Цена с учётом порога «бесплатно от»: единое правило для котировок и проверки заказа. */
export function priceWithFreeFrom(option: { price: number; freeFrom: number | null }, subtotal?: number): number {
  if (option.freeFrom != null && subtotal != null && subtotal >= option.freeFrom) return 0
  return option.price
}

// Получить котировку для выбранного способа доставки
export async function getQuoteForMethod(
  prisma: PrismaClient,
  method: DeliveryMethod,
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote> {
  const methodToKey: Record<DeliveryMethod, DeliveryOptionKey> = {
    pickup: 'pickup',
    simba_courier: 'simba_courier',
    cdek: 'cdek_pvz',
    yandex: 'yandex_pvz',
    ozon: 'ozon_pvz',
  }

  const key = methodToKey[method]

  // Пункты выдачи требуют выбранного пункта своей же службы: пункт СДЭК с
  // методом yandex — подмена данных, а не опечатка.
  if (key.endsWith('_pvz')) {
    if (!address.pickupPoint) {
      throw new Error('Выберите пункт выдачи')
    }
    if (address.pickupPoint.provider !== PROVIDER_BY_KEY[key]) {
      throw new Error('Пункт выдачи не относится к выбранной службе')
    }
  }

  // Курьер только в Москве
  if (method === 'simba_courier' && !simba.isMoscow(address.city)) {
    throw new Error('Курьером доставляем только по Москве')
  }

  // Получить цену из таблицы
  const option = await getDeliveryOption(prisma, key)
  if (!option) {
    throw new Error('Этот способ доставки сейчас недоступен')
  }

  const days = daysFor(option)

  return {
    provider: method,
    key,
    kind: option.kind,
    title: option.title,
    description: option.subtitle ?? '',
    price: priceWithFreeFrom(option, pkg.subtotal),
    daysMin: days.min,
    daysMax: days.max,
    freeFrom: option.freeFrom,
    available: true,
  }
}

// Кэш пунктов выдачи: у Москвы тысячи точек, меняются они раз в неделю, а
// дёргать обе службы на каждого покупателя нельзя. Ключ `${provider}:${city}`,
// срок сутки. Кэшируется только успешный ответ: закэшировать «пунктов нет»
// после сбоя службы значило бы прятать все пункты города на сутки.
const PICKUP_POINTS_TTL_MS = 24 * 60 * 60 * 1000
/// Город — строка от покупателя; без предела кэш можно раздуть выдуманными.
const PICKUP_POINTS_CACHE_MAX = 500
const pickupPointsCache = new Map<string, { points: PickupPoint[]; expiresAt: number }>()

export async function listPickupPoints(
  provider: PickupPointProvider,
  city: string,
  near?: { lat: number; lon: number }
): Promise<PickupPoint[]> {
  const cacheKey = `${provider}:${city.toLowerCase().trim()}`
  const now = Date.now()

  const cached = pickupPointsCache.get(cacheKey)
  if (cached && now < cached.expiresAt) return cached.points

  let points: PickupPoint[]
  if (provider === 'cdek') {
    points = await cdek.listPickupPoints(city)
  } else if (provider === 'ozon') {
    // Ozon Seller API не отдаёт список ПВЗ сторонним магазинам — до появления
    // ключей и согласованного с Ozon способа список честно пуст, и покупатель
    // видит «попробуйте другой способ», а не ошибку.
    points = await ozon.listPickupPoints()
  } else {
    // Яндекс отдаёт пункты только по прямоугольнику координат, а у нас есть
    // лишь название города — центр берём из справочников.
    const center = near ?? (await getCityCoords(city))
    points = center ? await yandexPvz.listPickupPoints(center) : []
  }

  if (pickupPointsCache.size >= PICKUP_POINTS_CACHE_MAX) {
    pickupPointsCache.delete(pickupPointsCache.keys().next().value as string)
  }
  pickupPointsCache.set(cacheKey, { points, expiresAt: now + PICKUP_POINTS_TTL_MS })
  return points
}

/** Для тестов: кэш живёт в модуле, между тестами его надо опустошать. */
export function clearPickupPointsCache() {
  pickupPointsCache.clear()
}

// Получить котировки от всех включённых способов доставки из таблицы
export async function getAllQuotes(
  prisma: PrismaClient,
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote[]> {
  const options = await listDeliveryOptions(prisma)

  const quotes: DeliveryQuote[] = []

  for (const option of options) {
    const days = daysFor(option)

    let available = true
    let error: string | undefined

    // Курьер только в Москве
    if (option.key === 'simba_courier' && !simba.isMoscow(address.city)) {
      available = false
      error = 'Курьером доставляем только по Москве'
    }

    quotes.push({
      provider: PROVIDER_BY_KEY[option.key],
      key: option.key,
      kind: option.kind,
      title: option.title,
      description: option.subtitle ?? '',
      price: priceWithFreeFrom(option, pkg.subtotal),
      daysMin: days.min,
      daysMax: days.max,
      freeFrom: option.freeFrom,
      available,
      error,
    })
  }

  return quotes
}

// Создать заказ в выбранном сервисе доставки
export async function createDeliveryOrder(
  provider: DeliveryProvider,
  address: DeliveryAddress,
  pkg: DeliveryPackage,
  orderId: string,
  recipientName: string,
  recipientPhone: string
): Promise<DeliveryOrder> {
  switch (provider) {
    case 'simba_courier':
      return simba.createOrder(address, pkg, orderId)
    case 'cdek':
      return cdek.createOrder(address, pkg, orderId)
    case 'yandex':
      return { externalId: `YANDEX_PVZ-${orderId}` }
    case 'pickup':
      return { externalId: `PICKUP-${orderId}` }
    default:
      throw new Error(`Unknown delivery provider: ${provider}`)
  }
}
