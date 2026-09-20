import type { DeliveryAddress, DeliveryPackage, DeliveryQuote, DeliveryOrder } from '../types.js'
import { fetchWithTimeout } from '../../../lib/fetch-timeout.js'

// Яндекс Доставка API (курьер — быстрая доставка)
// Документация: https://yandex.ru/dev/delivery-3/doc/dg/concepts/about.html

const BASE_URL = 'https://b2b.taxi.yandex.net/b2b/cargo/integration/v2'

function getWarehouseCoords(): { lat: number; lon: number } | null {
  const lat = process.env.WAREHOUSE_LAT
  const lon = process.env.WAREHOUSE_LON

  if (!lat || !lon) return null

  return { lat: parseFloat(lat), lon: parseFloat(lon) }
}

export async function getQuote(
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote> {
  const base: DeliveryQuote = {
    provider: 'yandex',
    key: 'yandex_courier',
    kind: 'courier',
    title: 'Яндекс Доставка',
    description: 'Курьер до двери',
    price: 0,
    daysMin: 0,
    daysMax: 0,
    available: false,
  }

  if (!process.env.YANDEX_DELIVERY_TOKEN) {
    return { ...base, available: false, error: 'Служба доставки не подключена' }
  }

  const warehouse = getWarehouseCoords()
  if (!warehouse) {
    return { ...base, available: false, error: 'Не задан адрес склада' }
  }

  if (address.lat === undefined || address.lon === undefined) {
    return { ...base, available: false, error: 'Уточните адрес на карте' }
  }

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/check-price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.YANDEX_DELIVERY_TOKEN}`,
        'Accept-Language': 'ru',
      },
      body: JSON.stringify({
        items: [{
          size: {
            length: (pkg.lengthCm ?? 30) / 100,
            width: (pkg.widthCm ?? 20) / 100,
            height: (pkg.heightCm ?? 15) / 100,
          },
          weight: pkg.weightKg,
          quantity: 1,
        }],
        route_points: [
          { coordinates: [warehouse.lon, warehouse.lat] },
          {
            coordinates: [address.lon, address.lat],
            fullname: `${address.city}, ${address.street}, ${address.house}`,
          },
        ],
        type: 'cargo',
      }),
    })

    if (!res.ok) throw new Error(`Yandex price check failed: ${res.status}`)
    const data = await res.json() as { price?: string; currency?: string }

    return {
      ...base,
      available: true,
      price: Math.round(parseFloat(data.price ?? '0') * 100),
    }
  } catch (err) {
    return { ...base, available: false, error: String(err) }
  }
}

export async function createOrder(
  address: DeliveryAddress,
  pkg: DeliveryPackage,
  orderId: string,
  recipientPhone: string
): Promise<DeliveryOrder> {
  if (!process.env.YANDEX_DELIVERY_TOKEN) {
    return { externalId: `YA-MOCK-${orderId}`, trackingNumber: `YA${Date.now()}` }
  }

  if (address.lat === undefined || address.lon === undefined) {
    throw new Error('Для Яндекс.Доставки нужен адрес, уточнённый на карте')
  }

  const warehouse = getWarehouseCoords()
  if (!warehouse) {
    throw new Error('Не задан адрес склада для Яндекс.Доставки')
  }

  const warehouseAddress = process.env.WAREHOUSE_ADDRESS || 'Склад'

  const res = await fetchWithTimeout(`${BASE_URL}/claims/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.YANDEX_DELIVERY_TOKEN}`,
    },
    body: JSON.stringify({
      items: [{
        size: {
          length: (pkg.lengthCm ?? 30) / 100,
          width: (pkg.widthCm ?? 20) / 100,
          height: (pkg.heightCm ?? 15) / 100,
        },
        weight: pkg.weightKg,
        title: 'Корм для животных',
        quantity: 1,
        cost_value: '0',
        cost_currency: 'RUB',
      }],
      route_points: [
        {
          point_id: 1,
          visit_order: 1,
          address: { fullname: warehouseAddress, coordinates: [warehouse.lon, warehouse.lat] },
          contact: { name: 'Simba', phone: '+70000000000' },
          type: 'source',
        },
        {
          point_id: 2,
          visit_order: 2,
          address: {
            fullname: `${address.city}, ${address.street}, ${address.house}`,
            coordinates: [address.lon, address.lat],
          },
          contact: { name: 'Получатель', phone: recipientPhone },
          type: 'destination',
        },
      ],
      emergency_contact: { name: 'Simba', phone: '+70000000000' },
    }),
  })

  if (!res.ok) throw new Error(`Yandex create order failed: ${res.status}`)
  const data = await res.json() as { id: string }

  return {
    externalId: data.id,
    trackingUrl: `https://go.yandex/route/${data.id}`,
  }
}
