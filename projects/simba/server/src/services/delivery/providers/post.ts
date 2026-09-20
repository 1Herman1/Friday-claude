import type { DeliveryAddress, DeliveryPackage, DeliveryQuote, DeliveryOrder } from '../types.js'
import { fetchWithTimeout } from '../../../lib/fetch-timeout.js'

// Почта России API
// Документация: https://otpravka.pochta.ru/specification

const BASE_URL = 'https://otpravka-api.pochta.ru'

export async function getQuote(
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote> {
  const base: DeliveryQuote = {
    provider: 'post',
    key: 'post_parcel',
    kind: 'courier',
    title: 'Почта России',
    description: 'Отделение почты',
    price: 0,
    daysMin: 5,
    daysMax: 14,
    available: false,
  }

  if (!process.env.POST_RU_TOKEN || !process.env.POST_RU_USER_KEY || !address.postalCode) {
    return { ...base, available: false, error: 'Служба доставки не подключена' }
  }

  try {
    const weightGr = Math.ceil(pkg.weightKg * 1000)

    const res = await fetchWithTimeout(`${BASE_URL}/1.0/tariff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `AccessToken ${process.env.POST_RU_TOKEN}`,
        'X-User-Authorization': `Basic ${process.env.POST_RU_USER_KEY}`,
      },
      body: JSON.stringify({
        'index-from': '101000', // индекс склада — поменять на реальный
        'index-to': address.postalCode,
        'mail-category': 'ORDINARY',
        'mail-type': 'POSTAL_PARCEL',
        mass: weightGr,
        dimension: {
          length: pkg.lengthCm ?? 30,
          width: pkg.widthCm ?? 20,
          height: pkg.heightCm ?? 15,
        },
        fragile: false,
        'with-order-of-notice': false,
        'with-simple-notice': false,
      }),
    })

    if (!res.ok) throw new Error(`Post RU tariff failed: ${res.status}`)
    const data = await res.json() as { 'total-rate'?: number; 'delivery-time'?: { 'min-days': number; 'max-days': number } }

    return {
      ...base,
      available: true,
      price: data['total-rate'] ?? 0,
      daysMin: data['delivery-time']?.['min-days'] ?? 5,
      daysMax: data['delivery-time']?.['max-days'] ?? 14,
    }
  } catch (err) {
    return { ...base, available: false, error: String(err) }
  }
}

export async function createOrder(
  address: DeliveryAddress,
  pkg: DeliveryPackage,
  orderId: string,
  recipientName: string,
  recipientPhone: string
): Promise<DeliveryOrder> {
  if (!process.env.POST_RU_TOKEN) {
    return { externalId: `POST-MOCK-${orderId}` }
  }

  const res = await fetchWithTimeout(`${BASE_URL}/1.0/user/shipment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      Authorization: `AccessToken ${process.env.POST_RU_TOKEN}`,
      'X-User-Authorization': `Basic ${process.env.POST_RU_USER_KEY}`,
    },
    body: JSON.stringify([{
      'address-type-to': 'DEFAULT',
      'index-to': address.postalCode,
      'place-to': address.city,
      'street-to': address.street,
      'house-to': address.house,
      'room-to': address.apartment,
      'recipient-name': recipientName,
      'tel-address': recipientPhone?.replace(/\D/g, ''),
      'mail-category': 'ORDINARY',
      'mail-type': 'POSTAL_PARCEL',
      mass: Math.ceil(pkg.weightKg * 1000),
      'order-num': orderId,
      fragile: false,
      'with-order-of-notice': false,
      'with-simple-notice': false,
    }]),
  })

  if (!res.ok) throw new Error(`Post RU create order failed: ${res.status}`)
  const data = await res.json() as { barcode?: string }[]

  return {
    externalId: `POST-${orderId}`,
    trackingNumber: data[0]?.barcode,
    trackingUrl: data[0]?.barcode
      ? `https://www.pochta.ru/tracking#${data[0].barcode}`
      : undefined,
  }
}
