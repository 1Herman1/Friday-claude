import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { staleGuestWhere } from '../lib/user-type'
import { startRun, finishRun, failRun, RunAlreadyRunningError, type RunTrigger } from './run-history'

export const guestCleanupDaysSchema = z.number().int().min(7).max(365).default(30)

const MAX_PER_RUN = 5000
const CHUNK = 100

export interface GuestCleanupReport {
  days: number
  dryRun: boolean
  candidates: number
  taken: number
  deleted: number
  consentsCleared: number
  skippedChunks: number
  /** Чанки, упавшие с ошибкой (не путать со skippedChunks — там гонка с заказом). */
  failedChunks: number
  skippedIds: string[]
  errors: Array<{ id: string; error: string }>
  hasMore: boolean
  sample: Array<{ id: string; lastActivity: string }>
}

/**
 * Считает количество гостей, попадающих под критерий.
 */
export async function countStaleGuests(
  prisma: PrismaClient,
  days: number
): Promise<number> {
  return prisma.user.count({
    where: staleGuestWhere(days),
  })
}

/**
 * Основная логика чистки: находит старых гостей и удаляет их батчами,
 * перепроверяя предикат перед каждым удалением.
 */
export async function runGuestCleanup(
  prisma: PrismaClient,
  days: number,
  dryRun: boolean = true
): Promise<GuestCleanupReport> {
  const where = staleGuestWhere(days)

  const candidates = await prisma.user.count({ where })

  if (candidates === 0) {
    return {
      days,
      dryRun,
      candidates: 0,
      taken: 0,
      deleted: 0,
      consentsCleared: 0,
      skippedChunks: 0,
      failedChunks: 0,
      skippedIds: [],
      errors: [],
      hasMore: false,
      sample: [],
    }
  }

  const toDelete = await prisma.user.findMany({
    where,
    select: {
      id: true,
      lastSeenAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_PER_RUN,
  })

  const taken = toDelete.length
  const hasMore = taken === MAX_PER_RUN

  let deleted = 0
  let consentsCleared = 0
  let skippedChunks = 0
  let failedChunks = 0
  const skippedIds: string[] = []
  const errors: Array<{ id: string; error: string }> = []

  // Sample из первых 10 элементов для отчёта
  const sample = toDelete.slice(0, 10).map(u => ({
    id: u.id,
    lastActivity: u.lastSeenAt?.toISOString() ?? u.createdAt.toISOString(),
  }))

  if (dryRun) {
    return {
      days,
      dryRun: true,
      candidates,
      taken,
      deleted: 0,
      consentsCleared: 0,
      skippedChunks: 0,
      failedChunks: 0,
      skippedIds: [],
      errors: [],
      hasMore,
      sample,
    }
  }

  // Удаляем чанками с транзакцией и перепроверкой
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const chunk = toDelete.slice(i, i + CHUNK)
    const chunkIds = chunk.map(u => u.id)

    try {
      // Перепроверяем, что эти гости всё ещё подходят под критерий
      // (может пришёл заказ во время обработки предыдущего батча)
      const stillStale = await prisma.user.findMany({
        where: {
          id: { in: chunkIds },
          ...where,
        },
        select: { id: true },
      })

      const stillStaleIds = stillStale.map(u => u.id)
      const nowActiveIds = chunkIds.filter(id => !stillStaleIds.includes(id))

      if (nowActiveIds.length > 0) {
        skippedIds.push(...nowActiveIds.slice(0, 20 - skippedIds.length))
      }

      if (stillStaleIds.length === 0) {
        skippedChunks++
        continue
      }

      // Транзакция с перепроверкой и обезличиванием консентов
      const result = await prisma.$transaction(async tx => {
        // Ещё раз проверяем, чтобы быть абсолютно уверенными
        const toActuallyDelete = await tx.user.findMany({
          where: {
            id: { in: stillStaleIds },
            ...where,
          },
          select: { id: true },
        })

        const actualIds = toActuallyDelete.map(u => u.id)

        if (actualIds.length === 0) {
          return { deleted: 0, cleared: 0 }
        }

        // Обезличиваем согласия до удаления гостя
        const cleared = await tx.consent.updateMany({
          where: { userId: { in: actualIds } },
          data: { ip: null, userAgent: null },
        })

        // Удаляем гостей
        const deleteResult = await tx.user.deleteMany({
          where: { id: { in: actualIds } },
        })

        return { deleted: deleteResult.count, cleared: cleared.count }
      }, { timeout: 15000 })

      deleted += result.deleted
      consentsCleared += result.cleared
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      errors.push(
        ...chunkIds.slice(0, 5 - errors.length).map(id => ({
          id,
          error: err.slice(0, 100),
        }))
      )
      // Сбой обработки — не то же самое, что «гость успел стать активным»:
      // первое требует внимания, второе штатно и повторится следующей ночью.
      failedChunks++
    }
  }

  return {
    days,
    dryRun: false,
    candidates,
    taken,
    deleted,
    consentsCleared,
    skippedChunks,
    failedChunks,
    skippedIds: skippedIds.slice(0, 20),
    errors: errors.slice(0, 5),
    hasMore,
    sample,
  }
}

/**
 * Обёртка для трекинга прогона через run-history.
 * Занимает слот, вычисляет результаты и пишет в sync_runs.
 */
export async function runGuestCleanupTracked(
  prisma: PrismaClient,
  days: number,
  dryRun: boolean = true,
  runId?: string,
  /** Кто запустил: cron помечает ночной прогон, иначе в админке он выглядит ручным. */
  trigger: RunTrigger = 'admin'
): Promise<GuestCleanupReport> {
  const finalRunId = runId ?? (await startRun(prisma, 'guest_cleanup', trigger, dryRun))

  try {
    const report = await runGuestCleanup(prisma, days, dryRun)

    // Частичный провал — тоже провал: если половина чанков упала, «успех» в журнале лжёт.
    const failed = report.failedChunks > 0 || report.errors.length > 0

    if (failed) {
      await failRun(
        prisma,
        finalRunId,
        `Чанков с ошибкой: ${report.failedChunks}; удалено: ${report.deleted}. ${report.errors[0]?.error ?? ''}`.trim()
      )
    } else {
      await finishRun(prisma, finalRunId, {
        status: 'success',
        report,
      })
    }

    return report
  } catch (error) {
    // Падение самой записи об ошибке не должно подменить исходную причину.
    await failRun(prisma, finalRunId, error).catch(() => {})
    throw error
  }
}
