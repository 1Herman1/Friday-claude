import * as XLSX from 'xlsx'

export type ImportRow = {
  name: string
  slug?: string
  description: string
  brandSlug?: string
  brandName?: string
  price?: number
  oldPrice?: number
  stock: number
  weight?: number
  sku?: string
  categories: string[]
  images: string[]
  attributes: { name: string; value: string }[]
}

/** Значение из файла может прийти числом или датой — приводим к строке. */
function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : String(value)
}

/**
 * Парсит одну строку CSV, обрабатывая кавычки
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let insideQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      // Удвоенная кавычка внутри поля — экранированная: "он сказал ""да"""
      if (insideQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (ch === ',' && !insideQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Парсит файл (CSV или Excel) в массив объектов
 */
export function parseRows(buffer: Buffer, filename: string): Record<string, string>[] {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    // Excel отдаёт числовые ячейки числами (артикул, цена, вес) — приводим к строкам,
    // иначе строковые операции ниже падают на каждой такой строке.
    return rows.map(row => {
      const normalized: Record<string, string> = {}
      for (const [key, value] of Object.entries(row)) normalized[key] = toText(value)
      return normalized
    })
  }

  const text = buffer.toString('utf-8')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
    return row
  })
}

/**
 * Транслитерация кириллицы в латиницу
 * Возвращает слаг: нижний регистр, не-буквы→дефис, max 80 символов
 */
export function transliterate(text: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  }

  let result = text.toLowerCase()

  // Замена кириллицы на латиницу
  for (const [cyrillic, latin] of Object.entries(map)) {
    result = result.replaceAll(cyrillic, latin)
  }

  // Всё кроме [a-z0-9] → дефис
  result = result.replace(/[^a-z0-9]+/g, '-')

  // Обрезаем дефисы по краям
  result = result.replace(/^-+|-+$/g, '')

  // Сокращаем до 80 символов; срез может попасть на дефис — убираем его снова
  result = result.substring(0, 80).replace(/-+$/, '')

  return result
}

/**
 * Парсит атрибуты из сырой строки
 * Ищет колонки вида "Название атрибута N" и берёт "Значение атрибута N"
 */
export function parseAttributes(raw: Record<string, string>): { name: string; value: string }[] {
  const attributes: { name: string; value: string }[] = []
  const seen = new Set<string>()

  // Ищем все "Название атрибута N"
  const attrRegex = /^Название атрибута (\d+)$/

  for (const key of Object.keys(raw)) {
    const match = key.match(attrRegex)
    if (!match) continue

    const n = match[1]
    const attrName = toText(raw[key]).trim()
    const attrValue = toText(raw[`Значение атрибута ${n}`]).trim()

    // Отбрасываем пустые пары или дубли
    if (!attrName || !attrValue) continue

    const pairKey = `${attrName}|${attrValue}`
    if (seen.has(pairKey)) continue

    seen.add(pairKey)
    attributes.push({ name: attrName, value: attrValue })
  }

  return attributes
}

/**
 * Парсит вес из названия товара
 * Ищет хвостовой суффикс вида " - <число><единица>" с опциональным мультипаком
 * Ловушка: размеры типа "40х60" не считаются весом, возвращает исходное имя целиком
 */
export function parseWeightFromName(name: string): { baseName: string; weightKg?: number } {
  // Регулярное выражение для парсинга веса из конца строки
  // Ищем: " - <число> <единица>" опционально с мультипаком
  // Единицы: кг, г, гр, мл, л
  const weightPattern = /\s*-\s*([\d,\.]+)\s*(кг|г|гр|мл|л)(?:\s*[*хx]\s*(\d+)\s*(?:шт)?)?\s*$/i

  const match = name.match(weightPattern)
  if (!match) {
    // Нет распознанного паттерна веса, возвращаем исходное имя целиком
    return { baseName: name, weightKg: undefined }
  }

  const numberStr = match[1]
  const unit = match[2].toLowerCase()
  const multiplier = match[3] ? parseInt(match[3]) : 1

  // Парсим число (заменяем запятую на точку)
  let value = parseFloat(numberStr.replace(',', '.'))
  if (isNaN(value)) {
    return { baseName: name, weightKg: undefined }
  }

  // Применяем мультипак
  value = value * multiplier

  // Переводим в килограммы
  let weightKg: number
  if (unit === 'кг') {
    weightKg = value
  } else if (unit === 'г' || unit === 'гр') {
    weightKg = value / 1000
  } else if (unit === 'л') {
    // Для жидкостей считаем 1 л ≈ 1 кг
    weightKg = value
  } else if (unit === 'мл') {
    // мл → л → кг: 1 мл = 0.001 л ≈ 0.001 кг
    weightKg = value / 1000
  } else {
    return { baseName: name, weightKg: undefined }
  }

  // Обрезаем базовое имя: убираем " - <вес>"
  const baseName = name.replace(weightPattern, '').trim()

  return { baseName, weightKg }
}

/**
 * Определяет бренд по названию товара
 * Список брендов проверяется по началу названия (регистронезависимо)
 * Порядок важен: длинные названия раньше коротких
 * Пропускает слово "Корм" в начале если оно есть
 */
export function detectBrand(name: string): string | undefined {
  const brands = [
    'Happy Cat',
    'Happy Dog',
    "Hill's",
    'Farmina',
    'Monge',
    'Grandorf',
    'Forza10',
    'Forza 10',
    'Alleva',
    'ZILLII',
    'Craftia',
    'AlphaPet',
    'Muzzle',
    'Royal Canin',
  ]

  let searchName = name.toLowerCase()

  // Пропускаем слово "Корм" в начале если оно есть
  searchName = searchName.replace(/^корм\s+/i, '')

  for (const brand of brands) {
    if (searchName.startsWith(brand.toLowerCase())) {
      return brand
    }
  }

  return undefined
}

/**
 * Проверяет, является ли строка складским/хозяйственным материалом, а не товаром магазина.
 * Возвращает true, если название:
 * - начинается с одного из ключевых слов (по границе): коробка, скотч, стеллаж, фонды, впп, паллет, ценник, стрейч
 * - содержит отдельное слово БРАК (в любом регистре)
 *
 * Проверка регистронезависима и работает по границам слов, чтобы не отсечь товары вроде
 * "многоразовая впитывающая пеленка" (не начинается на ВПП, буквы другие).
 */
export function isNonProductRow(name: string): boolean {
  const trimmed = name.trim()
  const lowerName = trimmed.toLowerCase()

  // Ключевые слова для отсева (регистронезависимо, по границе слова в начале)
  const nonProductKeywords = [
    'коробка',
    'коробки',
    'скотч',
    'стеллаж',
    'фонды',
    'впп',
    'паллет',
    'палета',
    'ценник',
    'стрейч',
  ]

  // Проверка начала названия: ищем ключевое слово в начале, за которым идёт граница слова
  for (const keyword of nonProductKeywords) {
    if (lowerName.startsWith(keyword)) {
      // После ключевого слова должна быть граница (пробел, конец строки, или не-буква)
      const afterKeyword = lowerName[keyword.length]
      if (!afterKeyword || afterKeyword === ' ' || afterKeyword === '-' || /[^а-яёa-z0-9]/.test(afterKeyword)) {
        return true
      }
    }
  }

  // Пометка БРАК. Границу ищем по кириллическим буквам, а не по пробелам:
  // в выгрузке встречается «БРАК!!!Monge» без пробела, но «бракованный» и
  // «бракетом» — обычные слова, их трогать нельзя.
  if (/(^|[^а-яё])брак([^а-яё]|$)/i.test(lowerName)) {
    return true
  }

  return false
}

/**
 * Маппит сырую строку в структурированный ImportRow
 * Определяет формат по наличию "Имя", "Наименование" или ключа вида "Название атрибута N"
 */
export function mapRow(raw: Record<string, string>): ImportRow {
  // Определяем формат по наличию русских ключей
  const isRussian = 'Имя' in raw || 'Наименование' in raw || Object.keys(raw).some(k => /^Название атрибута \d+$/.test(k))

  if (isRussian) {
    // Русский WooCommerce формат
    // Имя: берём из "Имя", если пусто — из "Наименование"
    let name = toText(raw['Имя']).trim()
    const hasNameFromIme = !!name
    if (!name) {
      name = toText(raw['Наименование']).trim()
    }

    // Описание: если есть отдельное поле "Наименование" и используется как имя — оно же и описание
    const sku = toText(raw['Артикул']).trim() || undefined
    const description = toText(raw['Наименование']).trim() || name || ''

    // Цены
    let price: number | undefined
    let oldPrice: number | undefined

    const basePrice = parseFloat(toText(raw['Базовая цена'] || raw['Цена']).replace(',', '.'))
    const salePrice = parseFloat(toText(raw['Акционная цена']).replace(',', '.'))

    const prices = [basePrice, salePrice].filter(p => !isNaN(p))
    if (prices.length === 2) {
      // Две цены: меньшая → price, большая → зачёркнутая oldPrice.
      // Равные цены — не скидка, зачёркивать нечего.
      price = Math.min(basePrice, salePrice)
      if (basePrice !== salePrice) {
        oldPrice = Math.max(basePrice, salePrice)
      }
    } else if (prices.length === 1) {
      // Одна цена
      price = prices[0]
    }

    // Вес
    const weight = parseFloat(toText(raw['Вес (kg)'] || raw['Вес']).replace(',', '.'))

    // Остаток
    const stock = parseInt((toText(raw['Запасы'] || raw['Остаток']) || '0')) || 0

    // Категории
    const categories = toText(raw['Категории'])
      .split(',')
      .map(c => c.trim())
      .filter(Boolean)

    // Изображения
    const images = toText(raw['Изображения'])
      .split(',')
      .map(c => c.trim())
      .filter(Boolean)

    // Бренд
    const brandName = toText(raw['Бренд'] || raw['Производитель']).trim() || undefined

    // Атрибуты
    const attributes = parseAttributes(raw)

    return {
      name,
      description,
      brandName,
      price: isNaN(price ?? NaN) ? undefined : price,
      oldPrice: isNaN(oldPrice ?? NaN) ? undefined : oldPrice,
      stock,
      weight: isNaN(weight) ? undefined : weight,
      sku,
      categories,
      images,
      attributes,
    }
  } else {
    // Английский формат
    const name = toText(raw['name']).trim()
    const slug = toText(raw['slug']).trim() || undefined
    const description = toText(raw['description']).trim() || name || ''
    const brandSlug = toText(raw['brandSlug']).trim() || undefined

    const price = parseFloat((raw['price'] ?? '').toString().replace(',', '.'))
    const oldPrice = parseFloat((raw['oldPrice'] ?? '').toString().replace(',', '.'))
    const stock = parseInt((raw['stock'] ?? '0').toString()) || 0
    const weight = parseFloat((raw['weight'] ?? '').toString().replace(',', '.'))
    const sku = toText(raw['sku']).trim() || undefined

    return {
      name,
      slug,
      description,
      brandSlug,
      price: isNaN(price) ? undefined : price,
      oldPrice: isNaN(oldPrice) ? undefined : oldPrice,
      stock,
      weight: isNaN(weight) ? undefined : weight,
      sku,
      categories: [],
      images: [],
      attributes: [],
    }
  }
}
