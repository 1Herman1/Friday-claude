import { describe, it, expect } from 'vitest'

/**
 * Нормализация: нижний регистр, ё→е, убрать кавычки и спецсимволы, лишние пробелы
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»""]/g, '') // кавычки
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // спецсимволы (с поддержкой Unicode букв и цифр)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Проверка совпадения:
 * 1. Точное равенство нормализованного имени
 * 2. Нормализованное имя из прайса является префиксом товара
 * 3. Нормализованное имя товара является префиксом прайса
 */
function isMatch(priceItemName: string, productName: string): boolean {
  const normPrice = normalize(priceItemName)
  const normProduct = normalize(productName)

  if (normPrice === normProduct) return true
  if (normProduct.startsWith(normPrice)) return true
  if (normPrice.startsWith(normProduct)) return true

  return false
}

/**
 * Парсинг объёма: извлечение числа и единицы из строки типа "50 мл"
 */
function parseVolume(volumeStr: string): { value: number; unit: string } | null {
  const match = volumeStr.match(/^(\d+(?:[.,]\d+)?)\s*([а-яa-z]+)$/i)
  if (!match) return null

  const value = parseFloat(match[1].replace(',', '.'))
  const unitStr = match[2].toLowerCase()

  let unit: string
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

describe('normalize()', () => {
  it('преобразует в нижний регистр', () => {
    expect(normalize('DINAMIZANTE')).toBe('dinamizante')
    expect(normalize('Aqua O3')).toBe('aqua o3')
  })

  it('заменяет ё на е', () => {
    expect(normalize('всё')).toBe('все')
    expect(normalize('Её')).toBe('ее')
  })

  it('удаляет кавычки', () => {
    expect(normalize('«Крем»')).toBe('крем')
    expect(normalize('"Expert Team"')).toBe('expert team')
  })

  it('удаляет спецсимволы и заменяет их на пробелы', () => {
    expect(normalize('крем-сыворотка')).toBe('крем сыворотка')
    expect(normalize('ночной/дневной')).toBe('ночной дневной')
  })

  it('убирает лишние пробелы', () => {
    expect(normalize('  DINAMIZANTE   крем  ')).toBe('dinamizante крем')
    expect(normalize('  множество    пробелов  ')).toBe('множество пробелов')
  })

  it('комбо: кавычки + спецсимволы + ё + регистр', () => {
    expect(normalize('«GEN-ADN» Крем')).toBe('gen adn крем')
  })

  it('пустая строка остаётся пустой', () => {
    expect(normalize('')).toBe('')
  })

  it('только спецсимволы становятся пустой', () => {
    expect(normalize('!@#$%')).toBe('')
  })
})

describe('isMatch()', () => {
  it('точное совпадение нормализованного имени', () => {
    expect(isMatch('DINAMIZANTE Крем', 'dinamizante крем')).toBe(true)
    expect(isMatch('Aqua O3', 'AQUA O3')).toBe(true)
  })

  it('имя из прайса - префикс товара', () => {
    // Прайс: "DINAMIZANTE", Товар: "DINAMIZANTE Восстанавливающий крем"
    expect(isMatch('DINAMIZANTE', 'DINAMIZANTE Восстанавливающий крем')).toBe(true)
    expect(isMatch('GEN ADN', 'GEN ADN Крем укрепляющий')).toBe(true)
  })

  it('имя товара - префикс прайса (слова в прайсе полнее)', () => {
    // Товар: "Aqua O3", Прайс: "Aqua O3 Whitening Cream"
    expect(isMatch('Aqua O3 Whitening Cream', 'Aqua O3')).toBe(true)
  })

  it('не совпадает если разные имена', () => {
    expect(isMatch('DINAMIZANTE', 'Aqua O3')).toBe(false)
    expect(isMatch('Крем A', 'Крем B')).toBe(false)
  })

  it('не совпадает если слово находится в середине второй фразы', () => {
    // "восстанавливающий" не в начале "динамизанте восстанавливающий крем"
    // и "динамизанте восстанавливающий крем" не в начале "восстанавливающий"
    // и не равны
    expect(isMatch('Восстанавливающий', 'Регенерирующий Восстанавливающий крем')).toBe(false)
  })

  it('нечувствителен к кавычкам', () => {
    expect(isMatch('«Expert Team»', 'Expert Team')).toBe(true)
    expect(isMatch('Expert Team', '«Expert Team»')).toBe(true)
  })

  it('нечувствителен к спецсимволам', () => {
    expect(isMatch('Gen-ADN', 'Gen ADN')).toBe(true)
    expect(isMatch('Eye/Resistance', 'Eye Resistance')).toBe(true)
  })

  it('латиница и кириллица это разные символы', () => {
    // "krем" (латиница K) !== "крем" (кириллица К) — это разные буквы
    expect(isMatch('Krем', 'Крем')).toBe(false)
    // но совпадают если оба в одной системе
    expect(isMatch('CREAM', 'cream')).toBe(true)
  })
})

describe('parseVolume()', () => {
  it('парсит миллилитры', () => {
    expect(parseVolume('50 мл')).toEqual({ value: 50, unit: 'ml' })
    expect(parseVolume('100ml')).toEqual({ value: 100, unit: 'ml' })
    expect(parseVolume('250 МЛ')).toEqual({ value: 250, unit: 'ml' })
  })

  it('парсит граммы', () => {
    expect(parseVolume('200 г')).toEqual({ value: 200, unit: 'g' })
    expect(parseVolume('50g')).toEqual({ value: 50, unit: 'g' })
    expect(parseVolume('100 Г')).toEqual({ value: 100, unit: 'g' })
  })

  it('парсит штуки', () => {
    expect(parseVolume('3 шт')).toEqual({ value: 3, unit: 'pcs' })
    expect(parseVolume('5pcs')).toEqual({ value: 5, unit: 'pcs' })
  })

  it('парсит дробные значения', () => {
    expect(parseVolume('15.5 мл')).toEqual({ value: 15.5, unit: 'ml' })
    expect(parseVolume('30,5 мл')).toEqual({ value: 30.5, unit: 'ml' })
  })

  it('возвращает null для невалидного формата', () => {
    expect(parseVolume('мл 50')).toBeNull()
    expect(parseVolume('50')).toBeNull()
    expect(parseVolume('пятьдесят мл')).toBeNull()
    expect(parseVolume('50 ml ml')).toBeNull()
  })

  it('возвращает null для неизвестной единицы', () => {
    expect(parseVolume('50 cm')).toBeNull()
    expect(parseVolume('50 foo')).toBeNull()
  })

  it('пробелов между числом и единицей может не быть', () => {
    expect(parseVolume('50мл')).toEqual({ value: 50, unit: 'ml' })
    expect(parseVolume('100g')).toEqual({ value: 100, unit: 'g' })
  })
})

/**
 * Интеграционный тест сопоставления товара с фасовкой
 */
describe('Интеграция: сопоставление товара и фасовки', () => {
  it('находит товар и фасовку по имени и объёму', () => {
    // Имитация товара в БД
    const product = {
      id: 'prod-1',
      name: 'DINAMIZANTE Восстанавливающий крем',
      variants: [
        { id: 'var-1', volumeValue: 50, volumeUnit: 'ml', retailPrice: 807700, wholesalePrice: null },
        { id: 'var-2', volumeValue: 100, volumeUnit: 'ml', retailPrice: 1100000, wholesalePrice: null },
      ],
    }

    // Запись из прайса
    const priceItem = {
      name: 'DINAMIZANTE Восстанавливающий',
      volume: '50 мл',
      wholesaleKopecks: 450000,
      isProfessional: false,
    }

    // Проверка совпадения товара
    expect(isMatch(priceItem.name, product.name)).toBe(true)

    // Проверка совпадения фасовки
    const variantMatch = product.variants.find((v) => {
      const parsed = parseVolume(priceItem.volume)
      if (!parsed) return false
      return Math.abs(parsed.value - v.volumeValue) < 0.01 && parsed.unit === v.volumeUnit
    })

    expect(variantMatch).toBeDefined()
    expect(variantMatch?.id).toBe('var-1')
  })

  it('выбирает единственную фасовку независимо от volume', () => {
    // Товар с одной фасовкой
    const product = {
      id: 'prod-1',
      name: 'Крем A',
      variants: [{ id: 'var-1', volumeValue: 50, volumeUnit: 'ml' }],
    }

    // Запись с другим volume — но так как фасовка одна, выбираем её
    const priceItem = { name: 'Крем A', volume: '75 мл' }

    const parsed = parseVolume(priceItem.volume)
    let variant = product.variants.find((v) => parsed && Math.abs(parsed.value - v.volumeValue) < 0.01 && parsed.unit === v.volumeUnit)

    // Не найдена по volume, но есть только одна — берём её
    if (!variant && product.variants.length === 1) {
      variant = product.variants[0]
    }

    expect(variant).toBeDefined()
    expect(variant?.id).toBe('var-1')
  })
})
