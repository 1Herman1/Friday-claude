import type { DeliveryAddress, DeliveryPackage, DeliveryOrder } from '../types.js'

// Собственная курьерская служба — фиксированные правила, никакого внешнего API

/** Именно Москва: «Московская область» и «Москва, Химки» курьер не возит. */
export function isMoscow(city: string): boolean {
  const head = city.split(',')[0].toLowerCase().replace(/^\s*(город|г\.?)\s*/, '').trim()
  return head === 'москва'
}

export async function createOrder(
  address: DeliveryAddress,
  pkg: DeliveryPackage,
  orderId: string
): Promise<DeliveryOrder> {
  // Внутренний заказ — просто фиксируем
  return {
    externalId: `SIMBA-${orderId}`,
    trackingNumber: `SM${Date.now()}`,
  }
}
