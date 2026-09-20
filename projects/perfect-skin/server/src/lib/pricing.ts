// Система расчёта оптовых цен для специалистов.
// Оптовая цена отдаётся ТОЛЬКО если role === 'professional' И proStatus === 'approved'.

export type PriceViewer = { role: string; proStatus?: string | null } | null | undefined

/**
 * Проверяет имеет ли зритель доступ к оптовым ценам.
 * ТОЛЬКО role==='professional' И proStatus==='approved' означает wholesale viewer.
 */
export function isWholesaleViewer(viewer: PriceViewer): boolean {
  if (!viewer) return false
  return viewer.role === 'professional' && viewer.proStatus === 'approved'
}

/**
 * Выбирает цену: оптовую (если доступна и viewer wholesale), иначе розничную.
 * @param variant { retailPrice: number; wholesalePrice?: number | null }
 * @param viewer { role: string; proStatus?: string | null } | null | undefined
 * @returns цена в копейках
 */
export function resolvePrice(
  variant: { retailPrice: number; wholesalePrice?: number | null },
  viewer: PriceViewer
): number {
  if (isWholesaleViewer(viewer) && variant.wholesalePrice && variant.wholesalePrice > 0) {
    return variant.wholesalePrice
  }
  return variant.retailPrice
}
