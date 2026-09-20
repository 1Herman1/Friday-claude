import type { DeliveryAddress, DeliveryPackage, DeliveryQuote, DeliveryOrder } from '../types.js'
import { fetchWithTimeout } from '../../../lib/fetch-timeout.js'

// Ozon Delivery (Seller API)
// Документация: https://docs.ozon.ru/api/seller/#tag/Posting

const BASE_URL = 'https://api-seller.ozon.ru'

export async function getQuote(
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote> {
  // Ozon не предоставляет публичный API для расчёта стоимости доставки для сторонних магазинов.
  // Доставка через Ozon работает только для товаров продаваемых напрямую на Ozon.
  // Здесь возвращаем фиксированную заглушку — интеграция через Ozon FBS (Fulfillment by Seller).
  return {
    provider: 'ozon',
    key: 'ozon_delivery',
    kind: 'courier',
    title: 'Ozon Delivery',
    description: 'Пункт выдачи Ozon (ПВЗ)',
    price: 0,
    daysMin: 2,
    daysMax: 4,
    available: !!process.env.OZON_API_KEY,
    error: process.env.OZON_API_KEY ? undefined : 'Служба доставки не подключена',
  }
}

export async function createOrder(
  address: DeliveryAddress,
  pkg: DeliveryPackage,
  orderId: string
): Promise<DeliveryOrder> {
  // Ozon создаёт отправления автоматически при продаже через платформу.
  // Для FBS (отправка со своего склада) используем API постингов.

  if (!process.env.OZON_API_KEY || !process.env.OZON_CLIENT_ID) {
    return { externalId: `OZON-MOCK-${orderId}` }
  }

  // Пример запроса к Ozon Seller API для получения списка отправлений
  const res = await fetchWithTimeout(`${BASE_URL}/v3/posting/fbs/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID,
      'Api-Key': process.env.OZON_API_KEY,
    },
    body: JSON.stringify({
      dir: 'ASC',
      filter: { status: 'awaiting_packaging' },
      limit: 1,
      offset: 0,
    }),
  })

  if (!res.ok) throw new Error(`Ozon API failed: ${res.status}`)

  return {
    externalId: `OZON-${orderId}`,
    trackingUrl: 'https://ozon.ru/my/orderlist',
  }
}

// Списка пунктов выдачи для сторонних магазинов у Ozon Seller API нет.
// Заглушка держит место под интеграцию: когда владелец вставит OZON_CLIENT_ID
// и OZON_API_KEY и Ozon согласует механику, логика появится здесь — роуты и
// чекаут уже умеют провайдера ozon.
export async function listPickupPoints(): Promise<import('../types.js').PickupPoint[]> {
  if (!process.env.OZON_API_KEY || !process.env.OZON_CLIENT_ID) return []
  return []
}
