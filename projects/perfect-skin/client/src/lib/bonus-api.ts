import { fetchApi } from './api'

export type BonusAccrualTrigger = 'delivered' | 'paid'

export type BonusTxType =
  | 'welcome'
  | 'order_accrual'
  | 'order_spend'
  | 'order_spend_refund'
  | 'order_accrual_reversal'
  | 'expiration'
  | 'manual_adjustment'
  | 'review'
  | 'birthday'

export interface BonusRules {
  accrualPercent: number
  accrualTrigger: BonusAccrualTrigger
  accrualDelayDays: number
  maxSpendPercent: number
  minOrderForSpend: number
  allowSpendWithPromo: boolean
  kopecksPerBonus: number
  bonusTtlDays: number
}

export interface BonusSummary {
  programEnabled: boolean
  eligible: boolean
  member: boolean
  joinedAt: string | null
  balance: number
  balanceValue: number
  nextExpiration: { amount: number; expiresAt: string } | null
  rules: BonusRules
  rulesVersion: string
}

export interface BonusTx {
  id: string
  type: BonusTxType
  amount: number
  remaining: number | null
  expiresAt: string | null
  createdAt: string
  orderNumber: string | null
}

export interface BonusTxList {
  items: BonusTx[]
  total: number
}

export type BonusCheckoutReason =
  | 'PROGRAM_DISABLED'
  | 'AUTH_REQUIRED'
  | 'NOT_ELIGIBLE'
  | 'NOT_MEMBER'
  | 'PROMO_CONFLICT'
  | 'MIN_ORDER'
  | 'EMPTY_BALANCE'

export interface BonusCheckoutQuote {
  canSpend: boolean
  reason: BonusCheckoutReason | null
  available: number
  maxSpend: number
  kopecksPerBonus: number
  goodsAfterDiscount: number
  minOrderForSpend: number
  accrualPreview: number
}

export function fetchBonusSummary(): Promise<BonusSummary> {
  return fetchApi<BonusSummary>('/api/v1/bonus')
}

export function fetchBonusTransactions(limit: number, offset: number): Promise<BonusTxList> {
  return fetchApi<BonusTxList>(`/api/v1/bonus/transactions?limit=${limit}&offset=${offset}`)
}

export function joinBonusClub(): Promise<BonusSummary> {
  return fetchApi<BonusSummary>('/api/v1/bonus/membership', {
    method: 'POST',
    body: JSON.stringify({ acceptRules: true }),
  })
}

export function leaveBonusClub(): Promise<BonusSummary> {
  return fetchApi<BonusSummary>('/api/v1/bonus/membership', { method: 'DELETE' })
}

export function fetchBonusCheckout(promo?: string, spend?: number): Promise<BonusCheckoutQuote> {
  const params = new URLSearchParams()
  if (promo) params.set('promo', promo)
  if (spend) params.set('spend', String(spend))
  const query = params.toString()
  return fetchApi<BonusCheckoutQuote>(`/api/v1/bonus/checkout${query ? `?${query}` : ''}`)
}
