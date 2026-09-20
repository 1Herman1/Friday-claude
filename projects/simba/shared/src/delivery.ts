/**
 * Контракт доставки, общий для витрины и сервера.
 *
 * Способ доставки — это служба ПЛЮС вид: СДЭК умеет и до двери, и в пункт
 * выдачи, и покупатель выбирает между ними. Поэтому ключ варианта (`cdek_pvz`)
 * и служба (`cdek`) — разные вещи: заказу пишется служба, а вид определяется
 * тем, есть ли у заказа выбранный пункт.
 */

/** Как заказ попадает к покупателю. */
export type DeliveryKind = 'courier' | 'pickup_point' | 'store'

/**
 * Ключи вариантов, которые показывает чекаут. Ровно пять — решение
 * владельца: свой курьер по Москве, СДЭК, Яндекс и Ozon только в пункт
 * выдачи, самовывоз. Цены — из прайс-листа в админке (DeliveryOption).
 * Код курьеров СДЭК/Яндекса, Ozon, Достависты и Почты в репозитории остался,
 * но в список не попадает.
 */
export type DeliveryOptionKey = 'simba_courier' | 'cdek_pvz' | 'yandex_pvz' | 'ozon_pvz' | 'pickup'

/** Службы, у которых есть пункты выдачи. */
export type PickupPointProvider = 'cdek' | 'yandex' | 'ozon'

/**
 * Пункт выдачи. В заказе хранится целиком: если пункт закроется или сменит
 * адрес, в заказе должно остаться то, куда реально везли.
 */
export interface PickupPoint {
  provider: PickupPointProvider
  /** Код пункта у службы: `MSK123` у СДЭК, `platform_station_id` у Яндекса. */
  code: string
  name: string
  /** Полный адрес одной строкой. */
  address: string
  lat: number
  lon: number
  workTime?: string
  phone?: string
}

export function deliveryKindOf(key: DeliveryOptionKey): DeliveryKind {
  if (key === 'pickup') return 'store'
  if (key.endsWith('_pvz')) return 'pickup_point'
  return 'courier'
}

/** Строка прайс-листа доставки, как её отдаёт GET /api/delivery/options. */
export interface DeliveryOptionInfo {
  key: DeliveryOptionKey
  kind: DeliveryKind
  title: string
  subtitle: string | null
  /** Копейки. */
  price: number
  /** Срок в днях; null — не задан в админке. */
  etaMin: number | null
  etaMax: number | null
  /** Порог бесплатной доставки в копейках; null — платно всегда. */
  freeFrom: number | null
}
