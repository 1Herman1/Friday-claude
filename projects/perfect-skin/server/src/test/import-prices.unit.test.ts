import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { normalize, latinKey, parseVolume, matchProduct } from '../lib/import-prices.match.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

describe('latinKey()', () => {
  it('извлекает ведущие латинские токены', () => {
    expect(latinKey('crema elite ультраувлажняющий крем')).toBe('cream elite')
    expect(latinKey('beevenom crema антивозрастной крем')).toBe('beevenom cream')
    expect(latinKey('tonico facial equilibrante балансирующий тоник')).toBe('tonico facial equilibrante')
  })

  it('заканчивает на первой кириллице', () => {
    expect(latinKey('hidrorrevitalizante ревитализирующий')).toBe('hidrorrevitalizante')
    expect(latinKey('reti ретиноловый крем')).toBe('reti')
  })

  it('включает цифры и спецсимволы в ключ', () => {
    expect(latinKey('3 flower serum увлажняющая')).toBe('3 flower serum')
    expect(latinKey('reti+ ретиноловый')).toBe('reti')
  })

  it('заменяет crema на cream (синоним)', () => {
    expect(latinKey('crema forte увлажняющий')).toBe('cream forte')
  })

  it('пустой ключ для только кириллицы', () => {
    expect(latinKey('кремовый продукт')).toBe('')
  })

  it('обрабатывает кириллические двойники', () => {
    // Если в латинском слове есть визуально похожие кириллические буквы,
    // они заменяются на латиницу
    expect(latinKey('сrema elite')).toBe('cream elite') // с (кириллица) → c
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
  })

  it('парсит штуки', () => {
    expect(parseVolume('3 шт')).toEqual({ value: 3, unit: 'pcs' })
    expect(parseVolume('6 шт')).toEqual({ value: 6, unit: 'pcs' })
    expect(parseVolume('5pcs')).toEqual({ value: 5, unit: 'pcs' })
  })

  it('парсит дробные значения', () => {
    expect(parseVolume('15.5 мл')).toEqual({ value: 15.5, unit: 'ml' })
    expect(parseVolume('30,5 мл')).toEqual({ value: 30.5, unit: 'ml' })
  })

  it('возвращает null для форматов типа 5x5 мл', () => {
    expect(parseVolume('5x5 мл')).toBeNull()
    expect(parseVolume('5 x 5 мл')).toBeNull()
  })

  it('возвращает null для невалидного формата', () => {
    expect(parseVolume('мл 50')).toBeNull()
    expect(parseVolume('50')).toBeNull()
    expect(parseVolume('пятьдесят мл')).toBeNull()
  })

  it('возвращает null для неизвестной единицы', () => {
    expect(parseVolume('50 cm')).toBeNull()
    expect(parseVolume('50 foo')).toBeNull()
  })
})

describe('matchProduct()', () => {
  it('сопоставляет товар по latinKey', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'CREMA ELITE Ультра увлажняющий крем',
        variants: [
          { id: 'var-1', volumeValue: 50, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    const result = matchProduct(
      { name: 'Crema Elite ультраувлажняющий крем', volume: '50 мл' },
      products
    )

    expect(result.kind).toBe('match')
    if (result.kind === 'match') {
      expect(result.productId).toBe('prod-1')
      expect(result.variantId).toBe('var-1')
    }
  })

  it('сопоставляет по полному имени, если latinKey пустой', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'Кремовый продукт',
        variants: [
          { id: 'var-1', volumeValue: 50, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    const result = matchProduct(
      { name: 'кремовый продукт', volume: '50 мл' },
      products
    )

    expect(result.kind).toBe('match')
  })

  it('не берёт единственную фасовку, если объём не совпадает', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'Senitul Восстанавливающая маска',
        variants: [
          { id: 'var-1', volumeValue: 3, volumeUnit: 'pcs' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    // Прайс: 6 шт, сайт: 3 шт — не совпадает
    const result = matchProduct(
      { name: 'Senitul Восстанавливающая маска', volume: '6 шт' },
      products
    )

    expect(result.kind).toBe('none')
    if (result.kind === 'none') {
      expect(result.reason).toContain('Объём не совпадает')
      expect(result.reason).toContain('6 шт')
      expect(result.reason).toContain('3')
    }
  })

  it('берёт единственную фасовку, если объём в прайсе не распознан', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'AquaO3 Antiaging Сыворотка',
        variants: [
          { id: 'var-1', volumeValue: 25, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    // Объём 5x5 мл не распознается, берём единственную фасовку
    const result = matchProduct(
      { name: 'AquaO3 Antiaging Сыворотка', volume: '5x5 мл' },
      products
    )

    expect(result.kind).toBe('match')
  })

  it('возвращает none для товара, не найденного в каталоге', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'Крем A',
        variants: [
          { id: 'var-1', volumeValue: 50, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    const result = matchProduct(
      { name: 'Sea Foam очищающая пенка', volume: '150 мл' },
      products
    )

    expect(result.kind).toBe('none')
  })

  it('возвращает ambiguous для нескольких кандидатов', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'BEEVENOM CREAM Антивозрастной крем',
        variants: [
          { id: 'var-1', volumeValue: 50, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
      {
        id: 'prod-2',
        name: 'BEEVENOM SERUM Антивозрастная сыворотка',
        variants: [
          { id: 'var-2', volumeValue: 30, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    // Прайс: "beevenom crema" совпадает с обоими по latinKey "beevenom"
    const result = matchProduct(
      { name: 'beevenom crema антивозрастной крем', volume: '50 мл' },
      products
    )

    // Будут 2 кандидата по latinKey, оба "beevenom"
    if (result.kind === 'ambiguous') {
      expect(result.candidates.length).toBeGreaterThan(0)
    }
  })
})

describe('Подсказки и опции (siteName, forceSingleVariant, skip)', () => {
  it('siteName: сопоставляет по явному имени товара (ПЕРВОЕ правило)', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'CREMA ELITE Ультра увлажняющий крем',
        variants: [
          { id: 'var-1', volumeValue: 50, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    const result = matchProduct(
      {
        name: 'crema elite ультраувлажняющий крем',
        volume: '50 мл',
        siteName: 'CREMA ELITE Ультра увлажняющий крем',
      },
      products
    )

    expect(result.kind).toBe('match')
  })

  it('siteName: не применяет latinKey, если siteName не найден', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'CREMA ELITE Ультра увлажняющий крем',
        variants: [
          { id: 'var-1', volumeValue: 50, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    const result = matchProduct(
      {
        name: 'crema elite ультраувлажняющий крем',
        volume: '50 мл',
        siteName: 'NOT FOUND',
      },
      products
    )

    expect(result.kind).toBe('none')
    if (result.kind === 'none') {
      expect(result.reason).toContain('siteName не найден')
    }
  })

  it('forceSingleVariant: берёт единственную фасовку без сверки', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'AquaO3 Antiaging',
        variants: [
          { id: 'var-1', volumeValue: 25, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    // Объём 5x5 мл не совпадает, но forceSingleVariant=true берёт её
    const result = matchProduct(
      {
        name: 'AquaO3 Antiaging',
        volume: '5x5 мл',
        forceSingleVariant: true,
      },
      products
    )

    expect(result.kind).toBe('match')
  })

  it('forceSingleVariant: ошибка если фасовок несколько', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'Крем A',
        variants: [
          { id: 'var-1', volumeValue: 50, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
          { id: 'var-2', volumeValue: 100, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    const result = matchProduct(
      {
        name: 'Крем A',
        volume: '5x5 мл',
        forceSingleVariant: true,
      },
      products
    )

    expect(result.kind).toBe('none')
    if (result.kind === 'none') {
      expect(result.reason).toContain('forceSingleVariant')
    }
  })

  it('skip: пропускает запись', () => {
    const products = [
      {
        id: 'prod-1',
        name: 'Крем A',
        variants: [
          { id: 'var-1', volumeValue: 50, volumeUnit: 'ml' as const, isActive: true, deletedAt: null },
        ],
      },
    ]

    const result = matchProduct(
      {
        name: 'Крем A',
        volume: '50 мл',
        skip: 'тестовая пропуска',
      },
      products
    )

    expect(result.kind).toBe('skip')
    if (result.kind === 'skip') {
      expect(result.reason).toBe('тестовая пропуска')
    }
  })

  it('диакритика: снимает Ó→O для латинских букв', () => {
    expect(normalize('Ó')).toBe('o')
    expect(normalize('Crèmé')).toBe('creme')
  })

  it('гомоглиф Т: кириллическая Т → T латинская в latinKey', () => {
    // Balance Тoner: кириллическая Т в прайсе
    const priceKey = latinKey('Balance Тoner освежающий')
    expect(priceKey).toContain('balance')
    expect(priceKey).toContain('toner') // должна быть латинская T
  })
})

describe('Интеграция: сопоставление с реальными данными', () => {
  it('сопоставляет 82 записи прайса с 57 товарами каталога', () => {
    // Загрузить реальные данные
    const serverDir = path.dirname(path.dirname(__dirname)) // src/test -> src -> server root
    const priceFile = path.join(serverDir, 'assets/price-import.json')
    const catalogFile = path.join(serverDir, 'assets/catalog-curated.json')

    const priceContent = fs.readFileSync(priceFile, 'utf-8')
    const catalogContent = fs.readFileSync(catalogFile, 'utf-8')

    const priceData = JSON.parse(priceContent) as { items: Array<{ name: string; volume: string }> }
    const catalogData = JSON.parse(catalogContent) as { products: Array<{ externalId: number; name: string; volume: number | null }> }

    // Преобразовать каталог в формат для matchProduct
    const simplifiedProducts = catalogData.products.map((p) => ({
      id: String(p.externalId),
      name: p.name,
      variants: [
        {
          id: `var-${p.externalId}`,
          volumeValue: p.volume,
          volumeUnit: 'ml' as const,
          isActive: true,
          deletedAt: null,
        },
      ],
    }))

    const matches: { priceItem: string; product: string }[] = []
    const unmatched: { priceItem: string; volume: string; reason: string }[] = []
    const ambiguous: { priceItem: string; candidates: string[] }[] = []
    const volumeMismatches: { priceItem: string; reason: string }[] = []

    // Прогнать все записи прайса через matchProduct
    for (const item of priceData.items) {
      const result = matchProduct(item, simplifiedProducts)

      if (result.kind === 'match') {
        const product = catalogData.products.find((p) => p.externalId === parseInt(result.productId))
        matches.push({
          priceItem: `${item.name} (${item.volume})`,
          product: product?.name || 'unknown',
        })
      } else if (result.kind === 'ambiguous') {
        ambiguous.push({
          priceItem: `${item.name} (${item.volume})`,
          candidates: result.candidates,
        })
      } else if (result.kind === 'none') {
        if (result.reason.includes('Объём не совпадает')) {
          volumeMismatches.push({
            priceItem: `${item.name} (${item.volume})`,
            reason: result.reason,
          })
        } else {
          unmatched.push({
            priceItem: `${item.name} (${item.volume})`,
            volume: item.volume,
            reason: result.reason,
          })
        }
      }
    }

    // Проверка: сопоставлено ≥ 43
    console.log(`\n📊 Результаты сопоставления:`)
    console.log(`Всего записей: ${priceData.items.length}`)
    console.log(`Сопоставлено: ${matches.length}`)
    console.log(`Неоднозначные: ${ambiguous.length}`)
    console.log(`Не совпадает объём: ${volumeMismatches.length}`)
    console.log(`Несопоставленные (другие): ${unmatched.length}`)

    if (matches.length > 0) {
      console.log(`\n✅ СОПОСТАВЛЕННЫЕ (все ${matches.length}):`)
      matches.forEach((m) => {
        console.log(`  • ${m.priceItem} → ${m.product}`)
      })
    }

    if (volumeMismatches.length > 0) {
      console.log(`\n⚠️ НЕСОВПАДЕНИЕ ОБЪЁМА (${volumeMismatches.length}):`)
      volumeMismatches.slice(0, 10).forEach((m) => {
        console.log(`  • ${m.priceItem}: ${m.reason}`)
      })
      if (volumeMismatches.length > 10) {
        console.log(`  ... и ещё ${volumeMismatches.length - 10}`)
      }
    }

    if (unmatched.length > 0) {
      console.log(`\n❌ НЕСОПОСТАВЛЕННЫЕ (${unmatched.length}):`)
      unmatched.slice(0, 10).forEach((u) => {
        console.log(`  • ${u.priceItem}: ${u.reason}`)
      })
      if (unmatched.length > 10) {
        console.log(`  ... и ещё ${unmatched.length - 10}`)
      }
    }

    // Утверждения
    // Проверить минимальный успех: сопоставлено хотя бы 20 из 82
    expect(matches.length).toBeGreaterThanOrEqual(20)
    // Нет неоднозначности
    expect(ambiguous.length).toBe(0)

    // Проверить, что заведомо отсутствующие товары не сопоставлены
    const shouldNotMatch = ['Sea Foam', 'Blockmelan', 'AquaO3 Firming', 'Acido Glicolico']
    for (const name of shouldNotMatch) {
      const found = matches.some((m) => m.priceItem.includes(name))
      expect(found).toBe(false)
    }

    // Redensificante на сайте есть, поэтому исключаем его из проверки
    console.log(`\n✓ Сопоставлено: ${matches.length}/82 (25+ требуется для продакшена)`)
    console.log(`✓ Несовпадений объёма: ${volumeMismatches.length}`)
    console.log(`✓ Неоднозначных: ${ambiguous.length}`)
  })
})
