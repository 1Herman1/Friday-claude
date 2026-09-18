import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

export type RunSource = 'moysklad' | 'guest_cleanup'
export type RunTrigger = 'cron' | 'admin' | 'manual'

const STALE_MINUTES = Number(process.env.SYNC_STALE_MINUTES) || 15

export class RunAlreadyRunningError extends Error {
  constructor(public runId: string) {
    super('Прогон уже выполняется')
  }
}

/**
 * Занимает «слот» прогона для заданного источника. Запись со статусом running —
 * это и есть лок: второй запуск упрётся в неё и не стартует.
 * Зависший прогон старше STALE_MINUTES помечается failed и не мешает.
 *
 * Лок скоупится по source: чистка гостей не мешает синхронизации МойСклада.
 */
export async function startRun(
  prisma: PrismaClient,
  source: RunSource,
  trigger: RunTrigger,
  dryRun: boolean
): Promise<string> {
  const running = await prisma.syncRun.findFirst({
    where: { status: 'running', source },
    orderBy: { startedAt: 'desc' },
  })

  if (running) {
    const ageMinutes = (Date.now() - running.startedAt.getTime()) / 60000
    if (ageMinutes < STALE_MINUTES) {
      throw new RunAlreadyRunningError(running.id)
    }

    await prisma.syncRun.update({
      where: { id: running.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        error: 'Прогон не завершился — вероятно, процесс был прерван',
      },
    })
  }

  try {
    const run = await prisma.syncRun.create({
      data: { source, trigger, dryRun },
      select: { id: true },
    })
    return run.id
  } catch (err) {
    // Частичный уникальный индекс sync_runs_source_running_key: между проверкой
    // выше и созданием записи слот мог занять другой процесс. База — последнее
    // слово, проверка в коде нужна лишь ради понятного сообщения.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await prisma.syncRun.findFirst({
        where: { status: 'running', source },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      })
      throw new RunAlreadyRunningError(winner?.id ?? 'unknown')
    }
    throw err
  }
}

/**
 * Завершает прогон с результатом. Поля data будут записаны в syncRun.
 * Для МойСклада пишет счётчики (itemsFromMs, matched, etc.);
 * для гостей и др. источников сохраняет результат в report Json.
 */
export async function finishRun(
  prisma: PrismaClient,
  runId: string,
  data: {
    status: 'success' | 'aborted'
    report?: object
    itemsFromMs?: number
    matched?: number
    priceUpdated?: number
    stockUpdated?: number
    productsActivated?: number
    missingInMs?: number
    skipped?: number
  }
): Promise<void> {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: data.status,
      finishedAt: new Date(),
      ...(data.report && { report: data.report }),
      ...(data.itemsFromMs !== undefined && { itemsFromMs: data.itemsFromMs }),
      ...(data.matched !== undefined && { matched: data.matched }),
      ...(data.priceUpdated !== undefined && { priceUpdated: data.priceUpdated }),
      ...(data.stockUpdated !== undefined && { stockUpdated: data.stockUpdated }),
      ...(data.productsActivated !== undefined && { productsActivated: data.productsActivated }),
      ...(data.missingInMs !== undefined && { missingInMs: data.missingInMs }),
      ...(data.skipped !== undefined && { skipped: data.skipped }),
    },
  })
}

/**
 * Помечает прогон как failed с сообщением об ошибке.
 */
export async function failRun(
  prisma: PrismaClient,
  runId: string,
  error: unknown
): Promise<void> {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: 'failed',
      finishedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    },
  })
}
