// Система расчёта оптовых цен для специалистов.
// Оптовая цена отдаётся ТОЛЬКО если role === 'professional' И proStatus === 'approved'.

import type { FastifyRequest } from 'fastify'

export type PriceViewer = { role: string; proStatus?: string | null } | null | undefined

/**
 * Проверяет имеет ли зритель доступ к оптовым ценам.
 * ТОЛЬКО role==='professional' И proStatus==='approved' означает wholesale viewer.
 */
export function isWholesaleViewer(viewer: PriceViewer): boolean {
  if (!viewer) return false
  return viewer.role === 'professional' && viewer.proStatus === 'approved'
}

// Сотрудники видят весь каталог, включая кабинетные товары: иначе админка
// (поиск для «популярных» идёт через публичный листинг) их бы не находила.
// Список один на весь сервер — новая роль, забытая в одной из копий, тихо
// теряла бы часть каталога.
export const STAFF_ROLES: readonly string[] = ['super_admin', 'orders_manager', 'products_manager', 'content_manager']

/** Кабинетные товары и фасовки видны одобренному специалисту и сотрудникам. */
export function canSeeProfessional(viewer: PriceViewer): boolean {
  if (!viewer) return false
  return isWholesaleViewer(viewer) || STAFF_ROLES.includes(viewer.role)
}

/**
 * Extract viewer (for pricing/visibility) from Fastify request.
 * Returns { role, proStatus } if user is authenticated, null otherwise.
 */
export function viewerFromRequest(request: FastifyRequest): PriceViewer {
  if (!request.user) return null
  return {
    role: request.user.role,
    proStatus: request.user.proStatus,
  }
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
