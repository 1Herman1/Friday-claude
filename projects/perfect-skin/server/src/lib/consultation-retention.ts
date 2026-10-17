import type { ConsultationStatus } from './db.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const RETENTION_DAYS = 90
export const OPEN_STATUSES: ConsultationStatus[] = ['new', 'contacted', 'scheduled']
export const AUTO_CLOSE_NOTE = 'Закрыта автоматически: 3 месяца без движения'

export type RetentionRow = {
  id: string
  status: ConsultationStatus
  adminNote: string | null
  updatedAt: Date
  anonymizedAt: Date | null
}

export type RetentionPlan = {
  autoClose: { id: string; adminNote: string }[]
  anonymize: string[]
}

export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS)
}

// План считается по снимку до любых записей. Автозакрытие двигает updatedAt,
// и если пересчитать стирание после него, закрытые в этом прогоне заявки не попали бы в него.
export function planConsultationRetention(rows: RetentionRow[], now: Date): RetentionPlan {
  const cutoff = retentionCutoff(now).getTime()
  const stale = rows.filter((row) => row.updatedAt.getTime() < cutoff)

  return {
    autoClose: stale
      .filter((row) => OPEN_STATUSES.includes(row.status))
      .map((row) => ({
        id: row.id,
        adminNote: row.adminNote ? `${row.adminNote}\n${AUTO_CLOSE_NOTE}` : AUTO_CLOSE_NOTE,
      })),
    anonymize: stale.filter((row) => row.anonymizedAt === null).map((row) => row.id),
  }
}
