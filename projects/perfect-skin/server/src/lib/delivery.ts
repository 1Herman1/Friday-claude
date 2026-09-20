import type { DeliveryMethod } from './db.js'

export type CalcDeliveryMethod = 'pickup' | 'pvz' | 'courier'

export function toCalcMethod(method: DeliveryMethod): CalcDeliveryMethod {
  switch (method) {
    case 'pickup':
      return 'pickup'
    case 'cdek_pvz':
      return 'pvz'
    case 'cdek_courier':
      return 'courier'
    default:
      throw new Error(`Unknown delivery method: ${method}`)
  }
}

export function fromCalcMethod(method: CalcDeliveryMethod): DeliveryMethod {
  switch (method) {
    case 'pickup':
      return 'pickup'
    case 'pvz':
      return 'cdek_pvz'
    case 'courier':
      return 'cdek_courier'
  }
}
