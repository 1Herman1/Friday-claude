import type { DeliveryAddress, DeliveryPackage, DeliveryQuote, DeliveryOrder, PickupPoint } from '../types.js'
import { fetchWithTimeout } from '../../../lib/fetch-timeout.js'

// СДЭК API v2: https://api.cdek.ru/v2
// Документация: https://api-docs.cdek.ru/

const BASE_URL = 'https://api.cdek.ru/v2'
const SANDBOX_URL = 'https://api.edu.cdek.ru/v2'

interface TokenCache {
  token: string
  expiresAt: number
}

let cachedToken: TokenCache | null = null

async function getToken(): Promise<string> {
  const clientId = process.env.CDEK_CLIENT_ID
  const clientSecret = process.env.CDEK_CLIENT_SECRET

  if (!clientId || !clientSecret) throw new Error('CDEK credentials not set')

  // Кэш токена, срок истечения минус минута
  const now = Date.now()
  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const isSandbox = process.env.CDEK_SANDBOX === 'true'
  const url = `${isSandbox ? SANDBOX_URL : BASE_URL}/oauth/token`

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) throw new Error(`CDEK auth failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }

  // Кэшируем на срок минус 1 минута
  const expiresAt = now + (data.expires_in - 60) * 1000
  cachedToken = { token: data.access_token, expiresAt }

  return data.access_token
}

function getBaseUrl(): string {
  return process.env.CDEK_SANDBOX === 'true' ? SANDBOX_URL : BASE_URL
}

/** Сумма от службы должна быть числом: NaN уехал бы в деньги заказа. */
function assertFiniteSum(sum: unknown): number {
  if (typeof sum !== 'number' || !Number.isFinite(sum)) {
    throw new Error('Некорректная сумма доставки в ответе СДЭК')
  }
  return sum
}

export async function getCourierQuote(
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote> {
  const base: DeliveryQuote = {
    provider: 'cdek',
    key: 'cdek_courier',
    kind: 'courier',
    title: 'СДЭК',
    description: 'Курьер до двери',
    price: 0,
    daysMin: 2,
    daysMax: 5,
    available: false,
  }

  if (!process.env.CDEK_CLIENT_ID || !process.env.CDEK_CLIENT_SECRET) {
    return { ...base, available: false, error: 'Служба доставки не подключена' }
  }

  try {
    const token = await getToken()
    const url = `${getBaseUrl()}/calculator/tariff`

    const senderCityCode = process.env.CDEK_SENDER_CITY_CODE || '44'

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from_location: { code: Number.parseInt(senderCityCode, 10) },
        to_location: { city: address.city },
        tariff_code: 137, // Посылка склад-дверь
        packages: [{
          weight: Math.ceil(pkg.weightKg * 1000),
          length: pkg.lengthCm ?? 30,
          width: pkg.widthCm ?? 20,
          height: pkg.heightCm ?? 15,
        }],
      }),
    })

    if (!res.ok) throw new Error(`CDEK calculate failed: ${res.status}`)
    const data = await res.json() as { delivery_sum?: number; period_min?: number; period_max?: number }

    if (data.delivery_sum === undefined) throw new Error('No tariff sum in response')

    return {
      ...base,
      available: true,
      price: Math.round(assertFiniteSum(data.delivery_sum) * 100),
      daysMin: data.period_min ?? 2,
      daysMax: data.period_max ?? 5,
    }
  } catch (err) {
    return { ...base, available: false, error: String(err) }
  }
}

export async function getPickupPointQuote(
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote> {
  const base: DeliveryQuote = {
    provider: 'cdek',
    key: 'cdek_pvz',
    kind: 'pickup_point',
    title: 'СДЭК',
    description: 'В пункт выдачи',
    price: 0,
    daysMin: 2,
    daysMax: 5,
    available: false,
  }

  if (!process.env.CDEK_CLIENT_ID || !process.env.CDEK_CLIENT_SECRET) {
    return { ...base, available: false, error: 'Служба доставки не подключена' }
  }

  if (!address.pickupPoint) {
    return { ...base, available: false, error: 'Выберите пункт выдачи' }
  }

  try {
    const token = await getToken()
    const url = `${getBaseUrl()}/calculator/tariff`

    const senderCityCode = process.env.CDEK_SENDER_CITY_CODE || '44'

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from_location: { code: Number.parseInt(senderCityCode, 10) },
        to_location: { city: address.city },
        tariff_code: 136, // Посылка склад-склад
        packages: [{
          weight: Math.ceil(pkg.weightKg * 1000),
          length: pkg.lengthCm ?? 30,
          width: pkg.widthCm ?? 20,
          height: pkg.heightCm ?? 15,
        }],
      }),
    })

    if (!res.ok) throw new Error(`CDEK calculate failed: ${res.status}`)
    const data = await res.json() as { delivery_sum?: number; period_min?: number; period_max?: number }

    if (data.delivery_sum === undefined) throw new Error('No tariff sum in response')

    return {
      ...base,
      available: true,
      price: Math.round(assertFiniteSum(data.delivery_sum) * 100),
      daysMin: data.period_min ?? 2,
      daysMax: data.period_max ?? 5,
    }
  } catch (err) {
    return { ...base, available: false, error: String(err) }
  }
}

/**
 * Город в справочнике СДЭК: код для тарифов и координаты центра. Справочник
 * возвращает и одноимённые посёлки, поэтому предпочитаем точное совпадение
 * названия. Без реквизитов — null, не ошибка.
 */
export async function lookupCity(
  city: string
): Promise<{ code: number; lat?: number; lon?: number } | null> {
  if (!process.env.CDEK_CLIENT_ID || !process.env.CDEK_CLIENT_SECRET) return null

  const token = await getToken()
  const res = await fetchWithTimeout(
    `${getBaseUrl()}/location/cities?city=${encodeURIComponent(city)}&country_codes=RU&size=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`CDEK city lookup failed: ${res.status}`)

  const rows = await res.json() as { code: number; city: string; latitude?: number; longitude?: number }[]
  const wanted = city.trim().toLowerCase()
  const row = rows.find((r) => r.city.toLowerCase() === wanted) ?? rows[0]
  if (!row) return null

  return { code: row.code, lat: row.latitude, lon: row.longitude }
}

/**
 * Пункты выдачи СДЭК в городе. Сбой API — исключение наружу: вызывающий
 * отличает «служба не ответила» от «в городе пунктов нет».
 */
export async function listPickupPoints(city: string): Promise<PickupPoint[]> {
  const found = await lookupCity(city)
  if (!found) return []

  const token = await getToken()
  const points: PickupPoint[] = []
  const PAGE_SIZE = 1000
  // Страницы у СДЭК считаются с нуля: старт с единицы терял первую тысячу.
  let page = 0

  while (true) {
    const res = await fetchWithTimeout(
      `${getBaseUrl()}/deliverypoints?city_code=${found.code}&type=PVZ&size=${PAGE_SIZE}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error(`CDEK pvz list failed: ${res.status}`)

    const rows = await res.json() as {
      code: string
      name: string
      location?: { address_full: string; latitude: number; longitude: number }
      work_time?: string
      phones?: Array<{ number: string }>
    }[]

    for (const p of rows) {
      if (!p.location?.latitude || !p.location?.longitude) continue
      points.push({
        provider: 'cdek',
        code: p.code,
        name: p.name,
        address: p.location.address_full,
        lat: p.location.latitude,
        lon: p.location.longitude,
        workTime: p.work_time,
        phone: p.phones?.[0]?.number,
      })
    }

    if (rows.length < PAGE_SIZE) break
    page += 1
  }

  return points
}

export async function createOrder(
  address: DeliveryAddress,
  pkg: DeliveryPackage,
  orderId: string
): Promise<DeliveryOrder> {
  if (!process.env.CDEK_CLIENT_ID) {
    return { externalId: `CDEK-MOCK-${orderId}`, trackingNumber: `CDEK${Date.now()}` }
  }

  const token = await getToken()
  const url = `${getBaseUrl()}/orders`

  const warehouseAddress = process.env.WAREHOUSE_ADDRESS || 'Москва, ул. Ленина, 12'
  const tariffCode = address.pickupPoint?.provider === 'cdek' ? 136 : 137

  const orderBody: Record<string, unknown> = {
    number: orderId,
    tariff_code: tariffCode,
    // Без точки отправления СДЭК заявку не принимает.
    from_location: {
      code: Number(process.env.CDEK_SENDER_CITY_CODE || '44'),
      address: warehouseAddress,
    },
    // Получатель пока заглушка: заявка у службы создаётся не из оформления
    // заказа, а отдельной задачей — там же появятся имя и телефон покупателя.
    recipient: {
      name: 'Получатель',
      phones: [{ number: '+70000000000' }],
    },
    packages: [{
      number: `PKG-${orderId}`,
      weight: Math.ceil(pkg.weightKg * 1000),
      length: pkg.lengthCm ?? 30,
      width: pkg.widthCm ?? 20,
      height: pkg.heightCm ?? 15,
    }],
  }

  if (address.pickupPoint?.provider === 'cdek') {
    // ПВЗ: отправляем код точки вместо адреса
    orderBody.delivery_point = address.pickupPoint.code
    orderBody.to_location = {
      city: address.city,
      postal_code: address.postalCode,
    }
  } else {
    // Курьер: полный адрес доставки
    orderBody.to_location = {
      city: address.city,
      address: `${address.street || ''}, ${address.house || ''}`.trim(),
      postal_code: address.postalCode,
    }
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(orderBody),
  })

  if (!res.ok) throw new Error(`CDEK create order failed: ${res.status}`)
  const data = await res.json() as { entity?: { uuid: string }; requests?: Array<{ state: string }> }

  return {
    externalId: data.entity?.uuid ?? orderId,
    trackingUrl: `https://www.cdek.ru/ru/tracking/?order_id=${data.entity?.uuid}`,
  }
}
