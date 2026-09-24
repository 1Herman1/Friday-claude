// Base filters for all catalog queries
// Ensures inactive/deleted items never appear in customer-facing endpoints
import { canSeeProfessional, type PriceViewer } from './pricing.js'

export const ACTIVE = {
  isActive: true,
  deletedAt: null,
} as const

/**
 * Какие товары видит зритель. Гость и обычный покупатель — только розничные
 * товары, у которых есть хотя бы одна активная розничная фасовка; кабинетные
 * товары для них не существуют (ни в листинге, ни в счётчиках).
 */
export function productVisibleFor(viewer: PriceViewer) {
  if (canSeeProfessional(viewer)) return {}
  return {
    isProfessional: false,
    variants: { some: { ...ACTIVE, isProfessional: false } },
  }
}

/** Какие фасовки видит зритель: не-специалисту кабинетные фасовки не отдаются. */
export function variantVisibleFor(viewer: PriceViewer) {
  if (canSeeProfessional(viewer)) return ACTIVE
  return { ...ACTIVE, isProfessional: false }
}
