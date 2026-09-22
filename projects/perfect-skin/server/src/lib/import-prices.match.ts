// VolumeUnit это строковой enum: 'ml' | 'g' | 'pcs'
type VolumeUnit = 'ml' | 'g' | 'pcs'

// Кириллические символы, визуально похожие на латиницу: таблица замены
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'u',
  х: 'x',
  А: 'A',
  Е: 'E',
  О: 'O',
  Р: 'P',
  С: 'C',
  У: 'U',
  Х: 'X',
}

// Нормализация: нижний регистр, ё→е, снять диакритику для латинских букв, убрать кавычки и спецсимволы, лишние пробелы
export function normalize(text: string): string {
  let normalized = text.toLowerCase().replace(/ё/g, 'е')

  // Разложить диакритику, но сохранить й (не разлагать й на и + диакритика)
  // Временно заменим й на плейсхолдер
  normalized = normalized.replace(/й/g, '\x00Y\x00')
  normalized = normalized.normalize('NFD')
  // Удалить диакритику (теперь й уже не будет разложен)
  normalized = normalized.replace(/\p{M}/gu, '')
  // Вернуть й
  normalized = normalized.replace(/\x00Y\x00/g, 'й')

  return normalized
    .replace(/[«»""]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Замена кириллических двойников на латиницу (включая Т кириллическую → T)
function replaceCyrillicLookalikes(text: string): string {
  const extended: Record<string, string> = {
    ...CYRILLIC_TO_LATIN,
    'Т': 'T', // Кириллическая Т → латинская T (добавить, если не в таблице)
  }
  return text.replace(/./gu, (char) => extended[char] || char)
}

// Извлечение ведущего латинского ключа: последовательность токенов (латиница, цифры, +, &)
// Сначала найти границы (какие токены латинские/цифровые), потом применить нормализацию
export function latinKey(text: string): string {
  // Разбить на токены БЕЗ нормализации, чтобы увидеть границы кириллицы
  const parts = text.split(/\s+/)

  // Для каждого токена: проверить, содержит ли он латинские буквы (с учётом двойников)
  const tokens: string[] = []

  for (const part of parts) {
    // Проверить, есть ли в токене хотя бы одна латинская буква
    const hasLatinLetter = /[a-z]/i.test(part)

    // Проверить, есть ли в токене кириллические буквы (которые не двойники)
    const hasCyrillicLetter = /[а-яё]/i.test(part)

    // Если в токене только цифры, +, &, и очищенный токен не пуст — добавить
    if (!hasLatinLetter && !hasCyrillicLetter) {
      if (/^[\d+&]+$/.test(part)) {
        tokens.push(part)
        continue
      }
      // Спецсимволы или пробелы — конец ключа
      break
    }

    // Если есть латинские буквы (настоящие)
    if (hasLatinLetter) {
      // Применить замену двойников и нормализацию
      const replaced = replaceCyrillicLookalikes(part)
      const normalized = normalize(replaced)
      if (normalized) {
        // Канонизация синонимов
        const canonical = normalized
          .replace(/^crema$/i, 'cream')
          .replace(/^aceite$/i, 'oil')
        tokens.push(canonical)
      }
      continue
    }

    // Если в токене только кириллица (и нет двойников, или двойники не совпадают с латинскими) — конец
    break
  }

  return tokens.join(' ').trim()
}

// Парсинг объёма: извлечение числа и единицы из строки типа "50 мл"
// Примечание: "5x5 мл" или "5 x 5 мл" считаются непарсируемыми (возвращают null)
export function parseVolume(volumeStr: string): { value: number; unit: VolumeUnit } | null {
  // Стандартный формат: число + пробел/нет + единица
  const match = volumeStr.match(/^(\d+(?:[.,]\d+)?)\s*([а-яa-z]+)$/i)
  if (!match) return null

  const value = parseFloat(match[1].replace(',', '.'))
  const unitStr = match[2].toLowerCase()

  let unit: VolumeUnit
  if (unitStr === 'мл' || unitStr === 'ml') {
    unit = 'ml'
  } else if (unitStr === 'г' || unitStr === 'g') {
    unit = 'g'
  } else if (unitStr === 'шт' || unitStr === 'pcs') {
    unit = 'pcs'
  } else {
    return null
  }

  return { value, unit }
}

// Сопоставление фасовки
function variantMatches(
  importVolume: string,
  variant: { volumeValue: number; volumeUnit: VolumeUnit }
): boolean {
  const parsed = parseVolume(importVolume)
  if (!parsed) return false

  const importValue = parseFloat(parsed.value.toFixed(2))
  const variantValue = parseFloat(variant.volumeValue.toString())

  return Math.abs(importValue - variantValue) < 0.01 && parsed.unit === variant.volumeUnit
}

// Типы для входных данных
interface SimplifiedProduct {
  id: string
  name: string
  variants: Array<{
    id: string
    volumeValue: number | null
    volumeUnit: VolumeUnit
    isActive: boolean
    deletedAt: Date | string | null
  }>
}

interface PriceImportItem {
  name: string
  volume: string
  siteName?: string // Явное имя товара на сайте: точное совпадение или none
  forceSingleVariant?: boolean // Взять единственную фасовку без сверки объёма
  skip?: string // Пропустить запись (не обрабатывать)
}

export type MatchResult =
  | { kind: 'match'; productId: string; variantId: string }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'conflict'; reason: string } // Две записи прайса на одну фасовку
  | { kind: 'none'; reason: string }
  | { kind: 'skip'; reason: string }

// Основная функция сопоставления: принимает упрощённые объекты, возвращает результат
export function matchProduct(item: PriceImportItem, products: SimplifiedProduct[]): MatchResult {
  // Правило 0: skip
  if (item.skip) {
    return { kind: 'skip', reason: item.skip }
  }

  // Правило 1: siteName (ПЕРВЫЙ и единственный)
  if (item.siteName) {
    const normalized = replaceCyrillicLookalikes(item.siteName)
    const siteNormalized = normalize(normalized)

    const found = products.find((p) => {
      const pNormalized = replaceCyrillicLookalikes(p.name)
      const pNorm = normalize(pNormalized)
      return siteNormalized === pNorm
    })

    if (!found) {
      return { kind: 'none', reason: `siteName не найден: ${item.siteName}` }
    }

    // Найден по siteName — используем forceSingleVariant, если задано
    return matchVariant(item, found, { forceSingleVariant: item.forceSingleVariant })
  }

  // Правило 2: latinKey (стандартный алгоритм)
  const itemKey = latinKey(item.name)

  if (itemKey) {
    const keyMatches = products.filter((p) => {
      const productKey = latinKey(p.name)
      return productKey && productKey === itemKey
    })

    if (keyMatches.length === 1) {
      // Ровно один кандидат по ключу — ищем фасовку
      const product = keyMatches[0]
      return matchVariant(item, product, { forceSingleVariant: item.forceSingleVariant })
    }

    if (keyMatches.length > 1) {
      // Несколько кандидатов по ключу — пытаемся сузить по полному имени
      let narrowed = keyMatches.filter((p) => isMatch(item.name, p.name))
      if (narrowed.length === 1) {
        return matchVariant(item, narrowed[0], { forceSingleVariant: item.forceSingleVariant })
      }
      if (narrowed.length > 1) {
        return {
          kind: 'ambiguous',
          candidates: narrowed.map((c) => `${c.name} (${c.id})`),
        }
      }
    }
  }

  // Правило 3: если по ключу ничего не нашли — старые правила полного имени
  const nameMatches = products.filter((p) => isMatch(item.name, p.name))

  if (nameMatches.length === 0) {
    return { kind: 'none', reason: 'Товар не найден в каталоге' }
  }

  if (nameMatches.length > 1) {
    return {
      kind: 'ambiguous',
      candidates: nameMatches.map((c) => `${c.name} (${c.id})`),
    }
  }

  return matchVariant(item, nameMatches[0], { forceSingleVariant: item.forceSingleVariant })
}

// Вспомогательная: сопоставление фасовки для конкретного товара
interface MatchVariantOptions {
  forceSingleVariant?: boolean
}

function matchVariant(item: PriceImportItem, product: SimplifiedProduct, options: MatchVariantOptions = {}): MatchResult {
  const activeVariants = product.variants.filter((v) => v.isActive && !v.deletedAt)
  const parsed = parseVolume(item.volume)

  // Попытка точного сопоставления по объёму
  let variant = activeVariants.find((v) => {
    if (!parsed) return false
    // Привести volumeValue к number (может быть Decimal, number или null)
    const vValue = typeof v.volumeValue === 'number' ? v.volumeValue : (v.volumeValue as any)?.toNumber?.() ?? null
    if (vValue === null) return false

    const importValue = parseFloat(parsed.value.toFixed(2))
    const variantValue = parseFloat(vValue.toString())
    return Math.abs(importValue - variantValue) < 0.01 && parsed.unit === v.volumeUnit
  })

  if (!variant && activeVariants.length === 1) {
    const singleVariant = activeVariants[0]

    // Если forceSingleVariant задан — просто взять её
    if (options.forceSingleVariant) {
      return { kind: 'match', productId: product.id, variantId: singleVariant.id }
    }

    // Иначе: брать единственную фасовку без сверки ТОЛЬКО если:
    // 1. Объём прайса не распознан (5x5 мл)
    // 2. ИЛИ у фасовки объём не задан (null)
    const volumeNotRecognized = !parsed
    const variantVolumeUnknown = singleVariant.volumeValue === null || singleVariant.volumeValue === undefined

    if (volumeNotRecognized || variantVolumeUnknown) {
      variant = singleVariant
    } else {
      // Объём распознан и у фасовки есть объём — они должны совпадать
      const siteUnit = singleVariant.volumeUnit
      return {
        kind: 'none',
        reason: `Объём не совпадает: прайс ${item.volume}, сайт ${singleVariant.volumeValue} ${siteUnit}`,
      }
    }
  }

  if (!variant) {
    // Если forceSingleVariant задан, но фасовок несколько — ошибка
    if (options.forceSingleVariant && activeVariants.length !== 1) {
      return {
        kind: 'none',
        reason: `forceSingleVariant, но фасовок ${activeVariants.length}`,
      }
    }

    if (!parsed && activeVariants.length > 1) {
      return {
        kind: 'none',
        reason: `Объём не распознан (${item.volume}), фасовок несколько`,
      }
    }

    return {
      kind: 'none',
      reason: `Товар найден (${product.name}), но нет фасовки ${item.volume}`,
    }
  }

  return { kind: 'match', productId: product.id, variantId: variant.id }
}

// Проверка совпадения (старое правило для fallback):
// 1. Точное равенство нормализованного имени
// 2. Нормализованное имя из прайса является префиксом товара
// 3. Нормализованное имя товара является префиксом прайса
function isMatch(priceItemName: string, productName: string): boolean {
  const normPrice = normalize(priceItemName)
  const normProduct = normalize(productName)

  if (normPrice === normProduct) return true
  if (normProduct.startsWith(normPrice)) return true
  if (normPrice.startsWith(normProduct)) return true

  return false
}
