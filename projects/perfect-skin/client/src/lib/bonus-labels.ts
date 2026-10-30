import type { BonusTxType } from './bonus-api'
import { pluralize } from './format'

export const BONUS_TYPE_LABELS: Record<BonusTxType, string> = {
  welcome: 'Приветственные',
  order_accrual: 'За заказ',
  order_spend: 'Оплата заказа',
  order_spend_refund: 'Возврат за отменённый заказ',
  order_accrual_reversal: 'Отмена начисления',
  expiration: 'Сгорели',
  manual_adjustment: 'Корректировка',
  review: 'За отзыв',
  birthday: 'Ко дню рождения',
}

export function bonusWord(count: number): string {
  return pluralize(count, ['бонус', 'бонуса', 'бонусов'])
}

export function formatBonusDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU')
}

export function isBonusDemo(): boolean {
  return import.meta.env.VITE_API_MODE === 'snapshot'
}
