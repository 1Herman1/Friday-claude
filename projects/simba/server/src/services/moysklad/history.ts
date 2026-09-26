import type { PrismaClient } from '@prisma/client'
import type { SyncReport } from './plan'
import {
  startRun as startRunGeneric,
  failRun as failRunGeneric,
  finishRun as finishRunGeneric,
  RunAlreadyRunningError as RunAlreadyRunningErrorGeneric,
  type RunTrigger,
} from '../run-history'

export type SyncTrigger = RunTrigger

/**
 * Для обратной совместимости: используется в run.ts, sync.ts и sync-moysklad.ts.
 * Новый генерический класс живёт в run-history.ts, но имя сохраняется дословно.
 */
export class SyncAlreadyRunningError extends Error {
  constructor(public runId: string) {
    super('Синхронизация уже выполняется')
  }
}

/**
 * Тонкий адаптер: занимает слот для МойСклада через генерический startRun.
 * Сигнатура и имя ошибки остаются прежними для обратной совместимости.
 */
export async function startRun(
  prisma: PrismaClient,
  trigger: SyncTrigger,
  dryRun: boolean
): Promise<string> {
  try {
    return await startRunGeneric(prisma, 'moysklad', trigger, dryRun)
  } catch (err) {
    if (err instanceof RunAlreadyRunningErrorGeneric) {
      throw new SyncAlreadyRunningError(err.runId)
    }
    throw err
  }
}

/** Списки в отчёте обрезаем: иначе строка Json вырастает до мегабайтов. */
function trimReport(report: SyncReport) {
  const cut = <T>(list: T[]) => list.slice(0, 50)
  return {
    ...report,
    examples: {
      skippedZeroPrice: cut(report.examples.skippedZeroPrice),
      skippedPriceDrop: cut(report.examples.skippedPriceDrop),
      notFoundInMs: cut(report.examples.notFoundInMs),
      onlyInMs: cut(report.examples.onlyInMs),
      ambiguous: cut(report.examples.ambiguous),
      productsHidden: cut(report.examples.productsHidden ?? []),
    },
  }
}

export async function finishRun(
  prisma: PrismaClient,
  runId: string,
  status: 'success' | 'aborted',
  report: SyncReport
): Promise<void> {
  await finishRunGeneric(prisma, runId, {
    status,
    itemsFromMs: report.receivedFromMs,
    matched: report.matched,
    priceUpdated: report.pricesUpdated,
    stockUpdated: report.stocksUpdated,
    productsActivated: report.productsActivated,
    missingInMs: report.notFoundInMs,
    skipped: report.skippedZeroPrice + report.skippedPriceDrop,
    report: trimReport(report) as object,
  })
}

export async function failRun(
  prisma: PrismaClient,
  runId: string,
  error: unknown
): Promise<void> {
  await failRunGeneric(prisma, runId, error)
}
