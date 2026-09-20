import type { DeliveryKind, DeliveryOptionKey, PickupPoint, PickupPointProvider } from '@simba/shared'

export type { DeliveryKind, DeliveryOptionKey, PickupPoint, PickupPointProvider }

export interface DeliveryAddress {
  city: string
  street?: string
  house?: string
  apartment?: string
  postalCode?: string
  lat?: number
  lon?: number
  /** Выбранный пункт выдачи — для вариантов вида pickup_point. */
  pickupPoint?: PickupPoint
}

export interface DeliveryPackage {
  weightKg: number   // суммарный вес заказа в кг
  /// Сумма товаров в копейках — для порога «бесплатно от».
  subtotal?: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
}

export interface DeliveryQuote {
  provider: DeliveryProvider
  key: QuoteKey
  /// По виду чекаут решает, что спросить: адрес, пункт на карте или ничего.
  kind: DeliveryKind
  title: string           // название для показа пользователю
  description: string
  price: number           // в копейках
  daysMin: number
  daysMax: number
  /// Порог бесплатной доставки (копейки); у сторонних провайдеров не задаётся.
  freeFrom?: number | null
  available: boolean
  error?: string          // если не доступен — причина
}

export interface DeliveryOrder {
  externalId: string      // ID заказа у провайдера
  trackingNumber?: string
  trackingUrl?: string
}

// Провайдеры доставки: используются в логике сервиса
export type DeliveryProvider =
  | 'simba_courier'
  | 'yandex'
  | 'cdek'
  | 'ozon'
  | 'dostavista'
  | 'post'
  | 'pickup'

/** Способы, которые принимает заказ — ровно четыре, как в shared. */
export type DeliveryMethod = 'simba_courier' | 'cdek' | 'yandex' | 'ozon' | 'pickup'

/**
 * Ключ котировки. Первые четыре доезжают до витрины; остальные — у
 * провайдеров, которых покупателю не предлагают (код сохранён по решению
 * владельца), и в getAllQuotes они не попадают.
 */
export type QuoteKey =
  | DeliveryOptionKey
  | 'cdek_courier'
  | 'yandex_courier'
  | 'ozon_delivery'
  | 'dostavista_express'
  | 'post_parcel'
