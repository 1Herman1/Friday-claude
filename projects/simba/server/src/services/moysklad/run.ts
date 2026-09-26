import type { PrismaClient } from '@prisma/client'
import { startRun, finishRun, failRun, type SyncTrigger } from './history'
import { fetchAssortment, fetchStockCurrent } from './client.js'
import {
  buildPlan,
  checkAnomaly,
  extractPrice,
  matchVariants,
  normalizeArticle,
  planHiding,
  type PlanEntry,
  type SyncReport,
  type VariantForSync,
} from './plan.js'

const MOYSKLAD_MIN_ITEMS = parseInt(process.env.MOYSKLAD_MIN_ITEMS || '300', 10)
const MOYSKLAD_MAX_CHANGE_PERCENT = parseInt(process.env.MOYSKLAD_MAX_CHANGE_PERCENT || '30', 10)
const MOYSKLAD_MAX_PRICE_DROP_PERCENT = parseInt(process.env.MOYSKLAD_MAX_PRICE_DROP_PERCENT || '50', 10)
const MOYSKLAD_PRICE_TYPE = process.env.MOYSKLAD_PRICE_TYPE || 'Цена (Сайт)'
const MOYSKLAD_MAX_HIDE_PERCENT = parseInt(process.env.MOYSKLAD_MAX_HIDE_PERCENT || '15', 10)

/** Прогон с записью в историю: занимает лок, пишет результат, помечает падение. */
export async function runMoyskladSyncTracked(opts: {
  prisma: PrismaClient
  apply: boolean
  force: boolean
  trigger: SyncTrigger
  /** Уже занятый слот прогона. Роут занимает его заранее, чтобы вернуть id клиенту. */
  runId?: string
}): Promise<{ runId: string; report: SyncReport }> {
  const runId = opts.runId ?? (await startRun(opts.prisma, opts.trigger, !opts.apply))

  try {
    const report = await runMoyskladSync(opts)
    // Порог аномалии сработал — прогон остановлен, изменения не применены.
    await finishRun(opts.prisma, runId, report.aborted ? 'aborted' : 'success', report)
    return { runId, report }
  } catch (error) {
    await failRun(opts.prisma, runId, error)
    throw error
  }
}

export async function runMoyskladSync(opts: {
  prisma: PrismaClient
  apply: boolean
  force: boolean
}): Promise<SyncReport> {
  const { prisma, apply, force } = opts

  // ─── ФАЗА 1: ЧТЕНИЕ ───────────────────────────────────────────────────────

  const msItems = await fetchAssortment()
  const msStocks = await fetchStockCurrent()
  const stockById = new Map(msStocks.map((s) => [s.assortmentId, s.stock]))

  // ─── ФАЗА 2: ВАЛИДАЦИЯ ───────────────────────────────────────────────────

  if (msItems.length < MOYSKLAD_MIN_ITEMS) {
    throw new Error(
      `МойСклад вернул ${msItems.length} позиций, что ниже минимума ${MOYSKLAD_MIN_ITEMS}. Возможна проблема с API.`
    )
  }

  // ─── ФАЗА 3: ЧТЕНИЕ НАШИХ ВАРИАНТОВ ──────────────────────────────────────

  const ourVariants = await prisma.productVariant.findMany({
    select: {
      id: true,
      productId: true,
      sku: true,
      moyskladId: true,
      price: true,
      stock: true,
    },
  })

  const variantsForSync: VariantForSync[] = ourVariants.map((v) => ({
    id: v.id,
    sku: v.sku,
    moyskladId: v.moyskladId,
    price: v.price,
    stock: v.stock,
    productId: v.productId,
  }))

  // ─── ФАЗА 4: МАТЧИНГ И ПЛАН ──────────────────────────────────────────────

  const matchResult = matchVariants(variantsForSync, msItems)

  const plan = buildPlan(matchResult.matched, stockById, MOYSKLAD_PRICE_TYPE, MOYSKLAD_MAX_PRICE_DROP_PERCENT)
  const hide = planHiding(matchResult.unmatchedOurs, matchResult.matched, variantsForSync.length, MOYSKLAD_MAX_HIDE_PERCENT)

  // ─── ФАЗА 5: ПРОВЕРКА АНОМАЛИИ ───────────────────────────────────────────

  const anomaly = checkAnomaly(plan, MOYSKLAD_MAX_CHANGE_PERCENT)

  const report: SyncReport = {
    receivedFromMs: msItems.length,
    matched: matchResult.matched.length,
    pricesUpdated: 0,
    stocksUpdated: 0,
    productsActivated: 0,
    skippedZeroPrice: 0,
    skippedPriceDrop: 0,
    notFoundInMs: matchResult.unmatchedOurs.length,
    variantsHidden: 0,
    productsHidden: 0,
    hideSkippedReason: hide.skippedReason,
    examples: {
      skippedZeroPrice: [],
      skippedPriceDrop: [],
      notFoundInMs: matchResult.unmatchedOurs.slice(0, 50),
      onlyInMs: matchResult.onlyInMs.slice(0, 50),
      ambiguous: matchResult.ambiguous,
    },
  }

  // Если не apply — возвращаем отчёт прямо сейчас
  if (!apply) {
    // Посчитаем что бы произошло
    plan.forEach((entry) => {
      if (entry.skipReason === 'zeroPrice') report.skippedZeroPrice++
      if (entry.skipReason === 'priceDrop') report.skippedPriceDrop++

      // Считаем только РЕАЛЬНЫЕ изменения, иначе отчёт врёт.
      if (!entry.skipReason && entry.newPrice !== null && entry.newPrice !== entry.oldPrice) {
        report.pricesUpdated++
      }
      if (entry.newStock !== entry.oldStock) report.stocksUpdated++
    })

    // Сколько товаров стало бы видно покупателям: без этого числа предпросмотр
    // выглядит как «ничего не произойдёт».
    const productIdByVariant = new Map(variantsForSync.map(v => [v.id, v.productId]))
    const wouldActivate = new Set<string>()
    plan.forEach((entry) => {
      if (entry.skipReason || entry.newPrice === null || entry.newPrice <= 0) return
      const productId = productIdByVariant.get(entry.variantId)
      if (productId) wouldActivate.add(productId)
    })
    // В предпросмотре — сколько товаров СТАНЕТ видно, то есть только скрытые сейчас.
    const hiddenIds = await prisma.product.findMany({
      where: { id: { in: Array.from(wouldActivate) }, isActive: false, hiddenManually: false },
      select: { id: true },
    })
    report.productsActivated = hiddenIds.length

    // Сколько СКРОЕТСЯ — только то, что сейчас видно покупателю.
    report.variantsHidden = await prisma.productVariant.count({
      where: { id: { in: hide.variantIds }, isActive: true },
    })
    report.productsHidden = await prisma.product.count({
      where: { id: { in: hide.productIds }, isActive: true },
    })

    // Порог аномалии проверяем и в предпросмотре: иначе боевой прогон
    // остановится, а человек не поймёт почему.
    if (!anomaly.ok) {
      report.aborted = true
      report.abortReason =
        `Изменится ${anomaly.changed} цен из ${anomaly.total} (${anomaly.changedPercent.toFixed(0)}%) — ` +
        `выше порога ${MOYSKLAD_MAX_CHANGE_PERCENT}%. Боевой прогон будет остановлен защитой. ` +
        `Если это ожидаемо (первое проставление цен) — запускайте с флагом --force.`
    }

    // Заполним примеры
    report.examples.skippedZeroPrice = plan.filter((e) => e.skipReason === 'zeroPrice').slice(0, 50)
    report.examples.skippedPriceDrop = plan.filter((e) => e.skipReason === 'priceDrop').slice(0, 50)

    return report
  }

  // ─── ФАЗА 6: ПРОВЕРКА АНОМАЛИИ (БЛОКИРУЮЩАЯ) ──────────────────────────────

  if (!anomaly.ok && !force) {
    report.aborted = true
    report.abortReason =
      `Изменилось бы ${anomaly.changed} цен из ${anomaly.total} (${anomaly.changedPercent.toFixed(0)}%) — ` +
      `больше допустимого порога. Изменения НЕ применены. Проверьте цены в МойСклад ` +
      `или запустите с флагом --force, если это ожидаемо.`
    report.examples.skippedZeroPrice = plan.filter((e) => e.skipReason === 'zeroPrice').slice(0, 20)
    report.examples.skippedPriceDrop = plan.filter((e) => e.skipReason === 'priceDrop').slice(0, 20)

    return report
  }

  // ─── ФАЗА 7: ЗАПИСЬ В БД ──────────────────────────────────────────────────

  type VariantUpdate = {
    id: string
    data: { stock: number; price?: number; isActive?: boolean }
    priceChanged: boolean
    stockChanged: boolean
  }
  const variantUpdates: VariantUpdate[] = []
  const productActivations = new Set<string>()
  const productIdByVariant = new Map(variantsForSync.map(v => [v.id, v.productId]))

  plan.forEach((entry) => {
    // Остаток обновляем ВСЕГДА, даже если цену пропустили: остаток — не деньги,
    // а показывать вчерашние остатки хуже, чем обнулить.
    const data: VariantUpdate['data'] = { stock: entry.newStock }
    let priceChanged = false

    const priceUsable = !entry.skipReason && entry.newPrice !== null && entry.newPrice > 0
    if (priceUsable) {
      data.price = entry.newPrice as number
      data.isActive = true
      priceChanged = entry.newPrice !== entry.oldPrice

      const productId = productIdByVariant.get(entry.variantId)
      if (productId) productActivations.add(productId)
    }

    variantUpdates.push({
      id: entry.variantId,
      data,
      priceChanged,
      stockChanged: entry.newStock !== entry.oldStock,
    })
  })

  // Батчевая запись вариантов по 200
  const batchSize = 200
  for (let i = 0; i < variantUpdates.length; i += batchSize) {
    const batch = variantUpdates.slice(i, i + batchSize)

    await prisma.$transaction(
      batch.map((update) =>
        prisma.productVariant.update({
          where: { id: update.id },
          data: update.data,
        })
      )
    )

    report.pricesUpdated += batch.filter(u => u.priceChanged).length
    report.stocksUpdated += batch.filter(u => u.stockChanged).length
  }

  // Активация товаров. Считаем только те, что были скрыты: иначе отчёт каждые
  // полчаса рапортует «активировано 520» и настоящее событие в нём потеряется.
  // Скрытые вручную из админки синхронизация не возвращает — иначе ручное
  // скрытие жило бы полчаса.
  if (productActivations.size > 0) {
    const ids = Array.from(productActivations)
    const activated = await prisma.product.updateMany({
      where: { id: { in: ids }, isActive: false, hiddenManually: false },
      data: { isActive: true },
    })

    report.productsActivated = activated.count
  }

  // Скрытие того, чего нет в МоёмСкладе. Не удаление: на товар ссылаются
  // заказы и подписки, а появится пара — активация выше вернёт его сама
  // (hiddenManually не ставится). Остаток обнуляется, чтобы вариант не висел
  // «в наличии» с цифрой из старого CSV.
  if (hide.variantIds.length > 0) {
    report.variantsHidden = await prisma.productVariant.count({
      where: { id: { in: hide.variantIds }, isActive: true },
    })
    await prisma.productVariant.updateMany({
      where: { id: { in: hide.variantIds }, OR: [{ isActive: true }, { stock: { not: 0 } }] },
      data: { isActive: false, stock: 0 },
    })
  }
  if (hide.productIds.length > 0) {
    const hidden = await prisma.product.updateMany({
      where: { id: { in: hide.productIds }, isActive: true },
      data: { isActive: false },
    })
    report.productsHidden = hidden.count
  }

  // Посчитаем пропущенные
  plan.forEach((entry) => {
    if (entry.skipReason === 'zeroPrice') {
      report.skippedZeroPrice++
    } else if (entry.skipReason === 'priceDrop') {
      report.skippedPriceDrop++
    }
  })

  // Заполним примеры
  report.examples.skippedZeroPrice = plan.filter((e) => e.skipReason === 'zeroPrice').slice(0, 50)
  report.examples.skippedPriceDrop = plan.filter((e) => e.skipReason === 'priceDrop').slice(0, 50)

  return report
}
