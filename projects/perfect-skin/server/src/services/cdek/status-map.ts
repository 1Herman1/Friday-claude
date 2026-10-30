import type { $Enums } from '../../lib/db.js'

type OrderStatus = $Enums.OrderStatus
export type ForwardStatus = 'in_transit' | 'delivered'

export interface StatusEffect {
  orderStatus: ForwardStatus | null
  problem: boolean
  known: boolean
}

const IN_TRANSIT_CODES = new Set([
  'RECEIVED_AT_SHIPMENT_WAREHOUSE',
  'READY_FOR_SHIPMENT_IN_SENDER_CITY',
  'TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY',
  'SENT_TO_TRANSIT_CITY',
  'ACCEPTED_IN_TRANSIT_CITY',
  'ACCEPTED_AT_TRANSIT_WAREHOUSE',
  'SENT_TO_RECIPIENT_CITY',
  'ACCEPTED_IN_RECIPIENT_CITY',
  'ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE',
  'ACCEPTED_AT_PICK_UP_POINT',
  'TAKEN_BY_COURIER',
  'POSTOMAT_POSTED',
])
const DELIVERED_CODES = new Set(['DELIVERED', 'POSTOMAT_RECEIVED'])
const PROBLEM_CODES = new Set([
  'NOT_DELIVERED',
  'RETURNED_TO_SENDER_CITY_WAREHOUSE',
  'RETURNED_TO_RECIPIENT_CITY_WAREHOUSE',
  'POSTOMAT_SEIZED',
  'INVALID',
])
const NO_EFFECT_CODES = new Set(['ACCEPTED', 'CREATED'])

export const FORWARD_FROM: Record<ForwardStatus, OrderStatus[]> = {
  in_transit: ['new', 'confirmed', 'packed'],
  delivered: ['new', 'confirmed', 'packed', 'in_transit'],
}

export function effectOf(code: string): StatusEffect {
  if (DELIVERED_CODES.has(code)) return { orderStatus: 'delivered', problem: false, known: true }
  if (IN_TRANSIT_CODES.has(code)) return { orderStatus: 'in_transit', problem: false, known: true }
  if (PROBLEM_CODES.has(code)) return { orderStatus: null, problem: true, known: true }
  return { orderStatus: null, problem: false, known: NO_EFFECT_CODES.has(code) }
}
