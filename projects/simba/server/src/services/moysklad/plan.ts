import type { MsAssortmentItem } from './types.js'

/**
 * Нормализация артикула для сопоставления.
 * Правила:
 * 1. trim() — убрать пробелы в начале/конце
 * 2. Убрать ВСЕ пробелы внутри (включая неразрывные U+00A0)
 * 3. toLowerCase()
 * 4. Если строка целиком из цифр — убрать ведущие нули
 * 5. Пустая строка → ключа нет (признак отсутствия артикула)
 */
export function normalizeArticle(value: string | null | undefined): string {
  if (!value) return ''

  // trim + убрать все пробелы (включая неразрывные)
  let result = value.trim().replace(/\s/g, '')

  // toLowerCase
  result = result.toLowerCase()

  // Если строка целиком из цифр, убрать ведущие нули
  if (/^\d+$/.test(result)) {
    result = result.replace(/^0+/, '') || '0'
  }

  return result
}

// ─── ТИПЫ ────────────────────────────────────────────────────────────────────

export type VariantForSync = {
  id: string
  sku: string | null
  moyskladId: string | null
  price: number
  stock: number
  productId: string
}

export type MatchResult = {
  links: { variantId: string; moyskladId: string }[]
  matched: { variant: VariantForSync; ms: MsAssortmentItem }[]
  unmatchedOurs: VariantForSync[]
  onlyInMs: MsAssortmentItem[]
  ambiguous: { key: string; names: string[] }[]
}

export type PlanEntry = {
  variantId: string
  name: string
  oldPrice: number
  newPrice: number | null
  oldStock: number
  newStock: number
  skipReason?: 'zeroPrice' | 'priceDrop'
}

export type SyncReport = {
  /** true — сработала защита (порог аномалии или мало позиций), изменения НЕ применены */
  aborted?: boolean
  abortReason?: string
  receivedFromMs: number
  matched: number
  pricesUpdated: number
  stocksUpdated: number
  productsActivated: number
  skippedZeroPrice: number
  skippedPriceDrop: number
  notFoundInMs: number
  examples: {
    skippedZeroPrice: PlanEntry[]
    skippedPriceDrop: PlanEntry[]
    notFoundInMs: VariantForSync[]
    onlyInMs: MsAssortmentItem[]
    ambiguous: MatchResult['ambiguous']
  }
}

// ─── МАТЧИНГ ──────────────────────────────────────────────────────────────────

export function matchVariants(
  ours: VariantForSync[],
  msItems: MsAssortmentItem[]
): MatchResult {
  const result: MatchResult = {
    links: [],
    matched: [],
    unmatchedOurs: [],
    onlyInMs: [],
    ambiguous: [],
  }

  // Фильтруем МойСклад: только product и variant
  const msFiltered = msItems.filter((item) => item.meta.type === 'product' || item.meta.type === 'variant')

  // Строим map нормализованный ключ → МойСклад позиции (для проверки дублей)
  const msKeyMap = new Map<string, MsAssortmentItem[]>()
  msFiltered.forEach((item) => {
    // Используем article, если есть; иначе code
    const key = normalizeArticle(item.article || item.code)
    if (key) {
      if (!msKeyMap.has(key)) {
        msKeyMap.set(key, [])
      }
      msKeyMap.get(key)!.push(item)
    }
  })

  // Отмечаем неоднозначные ключи
  msKeyMap.forEach((items, key) => {
    if (items.length > 1) {
      result.ambiguous.push({
        key,
        names: items.map((i) => i.name),
      })
    }
  })

  // Проходим по нашим вариантам
  const msUsedIds = new Set<string>()
  const ourMatched = new Set<string>()

  ours.forEach((variant) => {
    let matched: MsAssortmentItem | null = null

    // Приоритет 1: если уже привязан — используем moyskladId
    if (variant.moyskladId) {
      const found = msFiltered.find((item) => item.id === variant.moyskladId)
      if (found) {
        matched = found
        result.links.push({ variantId: variant.id, moyskladId: variant.moyskladId })
        result.matched.push({ variant, ms: matched })
        msUsedIds.add(matched.id)
        ourMatched.add(variant.id)
        return
      }
    }

    // Приоритет 2: матчим по артикулу/коду
    const key = normalizeArticle(variant.sku)
    if (key) {
      const candidates = msKeyMap.get(key)
      // Пустой id записать нельзя: колонка moyskladId уникальна, вторая пустая строка уронит прогон.
      if (candidates && candidates.length === 1 && candidates[0]?.id) {
        matched = candidates[0]
        result.links.push({ variantId: variant.id, moyskladId: matched.id })
        result.matched.push({ variant, ms: matched })
        msUsedIds.add(matched.id)
        ourMatched.add(variant.id)
        return
      }
    }

    result.unmatchedOurs.push(variant)
  })

  // Позиции МойСклада, которые не использованы
  msFiltered.forEach((item) => {
    if (!msUsedIds.has(item.id)) {
      result.onlyInMs.push(item)
    }
  })

  return result
}

// ─── ЦЕНЫ ────────────────────────────────────────────────────────────────────

export function extractPrice(item: MsAssortmentItem, priceTypeName: string): number | null {
  if (!item.salePrices || item.salePrices.length === 0) {
    return null
  }

  // Ищем цену с нужным типом
  const priceEntry = item.salePrices.find((p) => p.priceType?.name === priceTypeName)
  if (priceEntry && priceEntry.value > 0) {
    return priceEntry.value
  }

  // Если не нашли нужный тип — берём первый элемент
  if (item.salePrices[0].value > 0) {
    return item.salePrices[0].value
  }

  return null
}

// ─── ПЛАН ────────────────────────────────────────────────────────────────────

export function buildPlan(
  matched: MatchResult['matched'],
  stockById: Map<string, number>,
  priceTypeName: string,
  maxDropPercent: number
): PlanEntry[] {
  const plan: PlanEntry[] = []

  matched.forEach(({ variant, ms }) => {
    const newPrice = extractPrice(ms, priceTypeName)
    const newStock = Math.max(0, Math.floor(stockById.get(ms.id) ?? 0))

    const entry: PlanEntry = {
      variantId: variant.id,
      name: ms.name,
      oldPrice: variant.price,
      newPrice,
      oldStock: variant.stock,
      newStock,
    }

    // Проверка нулевой цены
    if (newPrice === null || newPrice === 0) {
      entry.skipReason = 'zeroPrice'
      plan.push(entry)
      return
    }

    // Проверка падения цены (только если текущая цена > 0)
    if (variant.price > 0) {
      const dropPercent = ((variant.price - newPrice) / variant.price) * 100
      if (dropPercent > maxDropPercent) {
        entry.skipReason = 'priceDrop'
        plan.push(entry)
        return
      }
    }

    // Цена в порядке, остаток обновляем всегда
    plan.push(entry)
  })

  return plan
}

// ─── ПРОВЕРКА АНОМАЛИЙ ───────────────────────────────────────────────────────

export function checkAnomaly(
  plan: PlanEntry[],
  maxChangePercent: number
): { ok: boolean; changedPercent: number; changed: number; total: number } {
  const total = plan.length
  if (total === 0) {
    return { ok: true, changedPercent: 0, changed: 0, total: 0 }
  }

  // Считаем позиции с реально меняющейся ценой (не пропущенные)
  const changed = plan.filter((e) => !e.skipReason && e.newPrice !== e.oldPrice).length

  const changedPercent = (changed / total) * 100

  return {
    ok: changedPercent <= maxChangePercent,
    changedPercent,
    changed,
    total,
  }
}
