import type { ConsultationStatus, PrismaClient } from './db.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const RETENTION_DAYS = 90
export const OPEN_STATUSES: ConsultationStatus[] = ['new', 'contacted', 'scheduled']
export const AUTO_CLOSE_NOTE = 'Закрыта автоматически: 3 месяца без движения'

// Связь с аккаунтом снимаем: история не должна вести к человеку
const ERASED_FIELDS = {
  name: 'Удалено',
  phone: '',
  email: null,
  message: null,
  skinType: null,
  concern: null,
  userId: null,
} as const

export type RetentionRow = {
  id: string
  status: ConsultationStatus
  updatedAt: Date
  anonymizedAt: Date | null
}

export type RetentionPlan = {
  closeAndErase: string[] // открытые, персональные данные ещё на месте
  closeOnly: string[] // открытые, данные стёрты раньше
  erase: string[] // закрытые, персональные данные ещё на месте
}

export type RetentionResult = { closed: number; erased: number }

export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS)
}

// План считается по снимку до любых записей: автозакрытие двигает updatedAt
export function planConsultationRetention(rows: RetentionRow[], now: Date): RetentionPlan {
  const cutoff = retentionCutoff(now).getTime()
  const stale = rows.filter((row) => row.updatedAt.getTime() < cutoff)
  const isOpen = (row: RetentionRow) => OPEN_STATUSES.includes(row.status)
  const isErased = (row: RetentionRow) => row.anonymizedAt !== null

  return {
    closeAndErase: stale.filter((row) => isOpen(row) && !isErased(row)).map((row) => row.id),
    closeOnly: stale.filter((row) => isOpen(row) && isErased(row)).map((row) => row.id),
    erase: stale.filter((row) => !isOpen(row) && !isErased(row)).map((row) => row.id),
  }
}

export async function applyConsultationRetention(
  prisma: PrismaClient,
  now: Date,
  { apply }: { apply: boolean },
): Promise<RetentionResult> {
  const cutoff = retentionCutoff(now)
  const rows = await prisma.consultationRequest.findMany({
    where: {
      updatedAt: { lt: cutoff },
      OR: [{ status: { in: OPEN_STATUSES } }, { anonymizedAt: null }],
    },
    select: { id: true, status: true, updatedAt: true, anonymizedAt: true },
  })
  const plan = planConsultationRetention(rows, now)

  if (!apply) {
    return {
      closed: plan.closeAndErase.length + plan.closeOnly.length,
      erased: plan.closeAndErase.length + plan.erase.length,
    }
  }

  // Каждая заявка пишется один раз, группы не пересекаются, поэтому порядок записей не важен.
  // updatedAt < cutoff в where — повторная проверка: правка менеджера после снимка
  // двигает updatedAt, и по старому плану заявка не закроется и не стирается.
  return prisma.$transaction(async (tx) => {
    const stillStale = { updatedAt: { lt: cutoff } }

    const closedAndErased = await tx.consultationRequest.updateMany({
      where: { id: { in: plan.closeAndErase }, status: { in: OPEN_STATUSES }, anonymizedAt: null, ...stillStale },
      data: { ...ERASED_FIELDS, status: 'cancelled', adminNote: AUTO_CLOSE_NOTE, anonymizedAt: now },
    })
    const closedOnly = await tx.consultationRequest.updateMany({
      where: { id: { in: plan.closeOnly }, status: { in: OPEN_STATUSES }, ...stillStale },
      data: { status: 'cancelled', adminNote: AUTO_CLOSE_NOTE },
    })
    const erased = await tx.consultationRequest.updateMany({
      where: { id: { in: plan.erase }, anonymizedAt: null, ...stillStale },
      data: { ...ERASED_FIELDS, adminNote: null, anonymizedAt: now },
    })

    return {
      closed: closedAndErased.count + closedOnly.count,
      erased: closedAndErased.count + erased.count,
    }
  })
}
