import type { DeliveryAddress, DeliveryPackage, DeliveryQuote, DeliveryOrder } from '../types.js'
import { fetchWithTimeout } from '../../../lib/fetch-timeout.js'

// Достависта API
// Документация: https://dostavista.ru/api
// Тестовый контур: https://apitest.dostavista.ru/api/business/1.3

const PROD_URL = 'https://robot.dostavista.ru/api/business/1.3'
const SANDBOX_URL = 'https://apitest.dostavista.ru/api/business/1.3'

function getBaseUrl(): string {
  return process.env.DOSTAVISTA_SANDBOX === 'true' ? SANDBOX_URL : PROD_URL
}

export async function getQuote(
  address: DeliveryAddress,
  pkg: DeliveryPackage
): Promise<DeliveryQuote> {
  const base: DeliveryQuote = {
    provider: 'dostavista',
    key: 'dostavista_express',
    kind: 'courier',
    title: 'Достависта',
    description: 'Экспресс-доставка за 1–3 часа',
    price: 29900,
    daysMin: 0,
    daysMax: 0,
    available: false,
  }

  if (!process.env.DOSTAVISTA_TOKEN) {
    return { ...base, available: false, price: 0, error: 'Служба доставки не подключена' }
  }

  try {
    const res = await fetchWithTimeout(`${getBaseUrl()}/calculate-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DV-Auth-Token': process.env.DOSTAVISTA_TOKEN,
      },
      body: JSON.stringify({
        type: 'standard',
        points: [
          { address: 'Москва, ул. Склад, 1' }, // адрес склада
          { address: `${address.city}, ${address.street}, ${address.house}` },
        ],
        weight_kg: Math.ceil(pkg.weightKg),
      }),
    })

    if (!res.ok) throw new Error(`Dostavista calculate failed: ${res.status}`)
    const data = await res.json() as { order?: { payment_amount: number } }

    return {
      ...base,
      available: true,
      price: Math.round((data.order?.payment_amount ?? 299) * 100),
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
  if (!process.env.DOSTAVISTA_TOKEN) {
    return { externalId: `DV-MOCK-${orderId}` }
  }

  const res = await fetchWithTimeout(`${getBaseUrl()}/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DV-Auth-Token': process.env.DOSTAVISTA_TOKEN,
    },
    body: JSON.stringify({
      type: 'standard',
      points: [
        {
          address: 'Москва, ул. Склад, 1',
          client_order_id: orderId,
          taking_amount: '0',
          packages: [{ weight_kg: Math.ceil(pkg.weightKg) }],
        },
        {
          address: `${address.city}, ${address.street}, ${address.house}`,
          contact_person: { phone: recipientPhone },
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Dostavista create order failed: ${res.status}`)
  const data = await res.json() as { order?: { order_id: number; order_name: string } }

  return {
    externalId: String(data.order?.order_id ?? orderId),
    trackingNumber: data.order?.order_name,
    trackingUrl: `https://dostavista.ru/orders/${data.order?.order_id}`,
  }
}
