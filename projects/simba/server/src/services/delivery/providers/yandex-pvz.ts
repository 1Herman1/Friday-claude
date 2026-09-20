import type { DeliveryAddress, DeliveryPackage, DeliveryQuote, PickupPoint } from '../types.js'
import { fetchWithTimeout } from '../../../lib/fetch-timeout.js'

// Яндекс.Доставка ПВЗ (платформа пунктов выдачи)
// Документация: https://yandex.ru/support2/delivery-profile/ru/api/other/pickup-points-list

const BASE_URL = 'https://b2b-authproxy.taxi.yandex.net/api/b2b/platform'

type YandexRestriction = {
  days?: number[]
  time_from?: { hours: number; minutes: number }
  time_to?: { hours: number; minutes: number }
}

const DAY_NAMES = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

/** «пн–пт 09:00–21:00, сб–вс 10:00–18:00» из расписания платформы. */
export function formatSchedule(restrictions: YandexRestriction[] | undefined): string | undefined {
  if (!restrictions?.length) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  const parts: string[] = []
  for (const r of restrictions) {
    if (!r.days?.length || !r.time_from || !r.time_to) continue
    const days = [...r.days].sort((a, b) => a - b)
    const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1)
    const label = days.length === 1
      ? DAY_NAMES[days[0] - 1]
      : consecutive
        ? `${DAY_NAMES[days[0] - 1]}–${DAY_NAMES[days[days.length - 1] - 1]}`
        : days.map((d) => DAY_NAMES[d - 1]).join(', ')
    parts.push(`${label} ${pad(r.time_from.hours)}:${pad(r.time_from.minutes)}–${pad(r.time_to.hours)}:${pad(r.time_to.minutes)}`)
  }
  return parts.length ? parts.join(', ') : undefined
}

type YandexPoint = {
  id: string
  type?: string
  is_dark_store?: boolean
  name: string
  address?: { full_address: string }
  position?: { latitude: number; longitude: number }
  schedule?: { restrictions?: YandexRestriction[] }
  contact?: { phone: string }
}

export function mapPoints(rows: YandexPoint[]): PickupPoint[] {
  const points: PickupPoint[] = []
  for (const p of rows) {
    // Только обычные пункты выдачи: дарксторы и постаматы сюда не идут.
    if (p.type !== 'pickup_point' || p.is_dark_store) continue
    if (!p.position?.latitude || !p.position?.longitude || !p.address?.full_address) continue
    points.push({
      provider: 'yandex',
      code: p.id,
      name: p.name,
      address: p.address.full_address,
      lat: p.position.latitude,
      lon: p.position.longitude,
      workTime: formatSchedule(p.schedule?.restrictions),
      phone: p.contact?.phone,
    })
  }
  return points
}

/**
 * Пункты выдачи вокруг точки. Платформа Яндекса принимает только прямоугольник
 * координат, поэтому центр города обязателен — его находит вызывающий.
 * Сбой API — исключение наружу, а не пустой список: «служба не ответила» и
 * «пунктов нет» покупателю показываются по-разному.
 */
export async function listPickupPoints(center: { lat: number; lon: number }): Promise<PickupPoint[]> {
  if (!process.env.YANDEX_DELIVERY_TOKEN) return []

  // ±0.35° широты и ±0.5° долготы — примерно 40 × 35 км, хватает на любой
  // город с пригородами.
  const res = await fetchWithTimeout(`${BASE_URL}/pickup-points/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.YANDEX_DELIVERY_TOKEN}`,
      'Accept-Language': 'ru',
    },
    body: JSON.stringify({
      latitude: { from: center.lat - 0.35, to: center.lat + 0.35 },
      longitude: { from: center.lon - 0.5, to: center.lon + 0.5 },
    }),
  })
  if (!res.ok) throw new Error(`Yandex PVZ list failed: ${res.status}`)

  // Тело ответа по документации — { points: [...] }; на живом API не сверено.
  const data = await res.json() as { points?: YandexPoint[] } | YandexPoint[]
  return mapPoints(Array.isArray(data) ? data : data.points ?? [])
}

export async function getPickupPointQuote(
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote> {
  const base: DeliveryQuote = {
    provider: 'yandex',
    key: 'yandex_pvz',
    kind: 'pickup_point',
    title: 'Яндекс Доставка',
    description: 'В пункт выдачи',
    price: 0,
    daysMin: 0,
    daysMax: 0,
    available: false,
  }

  if (!process.env.YANDEX_DELIVERY_TOKEN || !process.env.YANDEX_PVZ_SOURCE_STATION) {
    return { ...base, available: false, error: 'Служба доставки не подключена' }
  }

  if (!address.pickupPoint) {
    return { ...base, available: false, error: 'Выберите пункт выдачи' }
  }

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/pricing-calculator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.YANDEX_DELIVERY_TOKEN}`,
        'Accept-Language': 'ru',
      },
      body: JSON.stringify({
        source: { platform_station_id: process.env.YANDEX_PVZ_SOURCE_STATION },
        destination: { platform_station_id: address.pickupPoint.code },
        tariff: 'self_pickup',
        total_weight: Math.ceil(pkg.weightKg * 1000),
        client_price: 0,
      }),
    })

    if (!res.ok) throw new Error(`Yandex pricing failed: ${res.status}`)
    const data = await res.json() as { pricing_total?: string; delivery_days?: number }

    if (data.pricing_total === undefined) throw new Error('No price in response')

    // Цена приходит строкой: пустая или в чужом формате даст NaN, а NaN дальше
    // уедет в деньги заказа и упадёт уже на записи в БД.
    const rubles = parseFloat(data.pricing_total)
    if (!Number.isFinite(rubles)) throw new Error('Некорректная цена в ответе Яндекса')

    return {
      ...base,
      available: true,
      price: Math.round(rubles * 100),
      daysMin: data.delivery_days ?? 1,
      daysMax: data.delivery_days ?? 1,
    }
  } catch (err) {
    return { ...base, available: false, error: String(err) }
  }
}
