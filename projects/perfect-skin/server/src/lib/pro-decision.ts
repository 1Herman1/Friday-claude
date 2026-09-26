import type { NpdResult } from './fns-npd.js'

export type RegistryHit = { name: string; okvedMain: string | null; releaseDate: Date } | null

export type Lane = 'green' | 'yellow'
export type DecisionStatus = 'approved' | 'pending'

export interface ProCheck {
  lane: Lane
  registry: { name: string; okvedMain: string | null; releaseDate: Date } | null
  npd: NpdResult
  checkedAt: Date
}

export interface ProDecision {
  status: DecisionStatus
  source: 'auto_msp' | null
  lane: Lane
  check: ProCheck
}

/**
 * Принимает решение по заявке профессионала.
 *
 * - Если registryHit найден → одобрение (approved) с источником auto_msp, зелёный lane
 * - Иначе → в статус ожидания (pending), жёлтый lane
 *
 * Функция НИКОГДА не возвращает 'rejected' — это может сделать только человек.
 *
 * ProCheck содержит результаты проверок для показа менеджеру.
 */
export function decide(input: {
  registryHit: RegistryHit
  npd: NpdResult
}): ProDecision {
  const { registryHit, npd } = input
  const now = new Date()

  const check: ProCheck = {
    lane: registryHit ? 'green' : 'yellow',
    registry: registryHit
      ? { name: registryHit.name, okvedMain: registryHit.okvedMain, releaseDate: registryHit.releaseDate }
      : null,
    npd,
    checkedAt: now,
  }

  if (registryHit) {
    return {
      status: 'approved',
      source: 'auto_msp',
      lane: 'green',
      check,
    }
  }

  return {
    status: 'pending',
    source: null,
    lane: 'yellow',
    check,
  }
}

// Индекс users_inn_approved_key частичный и живёт только в SQL миграции, поэтому
// Prisma описывает его нарушение по-разному: то именем индекса, то списком
// колонок (['inn']). Других уникальных ограничений в транзакции заявки нет,
// так что любое P2002 с упоминанием inn или этого индекса — «ИНН занят».
export function isInnTakenError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; meta?: { target?: unknown } }
  if (e.code !== 'P2002') return false
  const target = e.meta?.target
  const parts = Array.isArray(target) ? target.map(String) : [String(target ?? '')]
  return parts.some((t) => t === 'inn' || t.includes('users_inn_approved_key'))
}
