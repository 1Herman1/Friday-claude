import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseProProductsFile,
  planNewProduct,
  planVariantForExisting,
  type PlanContext,
  type ProProduct,
} from '../lib/import-pro-products.plan.js'
import { SKIN_TYPES_MAP } from '../lib/catalog-seed-maps.js'

// Фикстура: контекст плана
let ctx: PlanContext

beforeEach(() => {
  ctx = {
    categories: new Map([
      [
        'pilingi-i-eliksiry',
        { id: 'cat-pilingi', maxSortOrder: 1 },
      ],
      [
        'syvorotki',
        { id: 'cat-syvorotki', maxSortOrder: 2 },
      ],
      [
        'maski',
        { id: 'cat-maski', maxSortOrder: 3 },
      ],
    ]),
    brands: new Map([
      ['isseimi', 'brand-isseimi'],
      ['glacee-skincare', 'brand-glacee'],
    ]),
    lines: new Map([
      ['isseimi-base', 'line-base'],
      ['isseimi-md', 'line-md'],
    ]),
    products: new Map([
      ['existing-product', 'prod-existing-1'],
    ]),
  }
})

// ────────────────────────────── parseProProductsFile ────────────────────────

describe('parseProProductsFile()', () => {
  it('парсит валидный файл', () => {
    const json = {
      _meta: {
        source: 'test',
        date: '2026-09-22',
        note: 'test note',
      },
      variantsForExisting: [],
      products: [],
    }
    const result = parseProProductsFile(json)
    expect(result._meta.source).toBe('test')
    expect(result.variantsForExisting).toEqual([])
    expect(result.products).toEqual([])
  })

  it('вызывает ошибку на невалидном файле', () => {
    const json = {
      _meta: { source: 'test' }, // отсутствует date
      products: [],
    }
    expect(() => parseProProductsFile(json)).toThrow()
  })

  it('заполняет дефолты для массивов', () => {
    const json = {
      _meta: { source: 'test', date: '2026-09-22' },
    }
    const result = parseProProductsFile(json)
    expect(result.variantsForExisting).toEqual([])
    expect(result.products).toEqual([])
  })

  it('валидирует skinTypes (русские подписи)', () => {
    const json = {
      _meta: { source: 'test', date: '2026-09-22' },
      products: [
        {
          article: 2064,
          name: 'Test',
          slug: 'test',
          brand: 'isseimi',
          line: 'isseimi-base',
          category: 'syvorotki',
          description: 'Test product',
          shortDescription: 'Test',
          skinTypes: ['Неизвестный тип'], // Неверный
          volume: { value: 50, unit: 'ml', label: '50 мл' },
          wholesaleKopecks: 1000,
        },
      ],
    }
    expect(() => parseProProductsFile(json)).toThrow()
  })

  it('принимает валидные русские подписи типов кожи', () => {
    const json = {
      _meta: { source: 'test', date: '2026-09-22' },
      products: [
        {
          article: 2064,
          name: 'Test',
          slug: 'test',
          brand: 'isseimi',
          line: 'isseimi-base',
          category: 'syvorotki',
          description: 'Test product',
          shortDescription: 'Test',
          skinTypes: ['Для всех типов кожи', 'Сухая'],
          volume: { value: 50, unit: 'ml', label: '50 мл' },
          wholesaleKopecks: 1000,
        },
      ],
    }
    const result = parseProProductsFile(json)
    expect(result.products[0].skinTypes).toContain('Для всех типов кожи')
  })
})

// ────────────────────────────── planNewProduct ────────────────────────────

describe('planNewProduct()', () => {
  const baseItem: ProProduct = {
    article: 2064,
    name: 'AQUAO3 Омолаживающий концентрат',
    slug: 'aquao3-omolazhivayushchij-kontsentrat',
    brand: 'isseimi',
    line: 'isseimi-base',
    category: 'syvorotki',
    description: 'Антивозрастной коктейль',
    shortDescription: 'Антивозрастной',
    skinTypes: ['Для всех типов кожи'],
    volume: { value: 5, unit: 'pcs', label: '5 × 5 мл' },
    wholesaleKopecks: 1240000,
  }

  it('создаёт план для нового товара', () => {
    const plan = planNewProduct(baseItem, ctx)
    expect(plan.kind).toBe('create')
    if (plan.kind === 'create') {
      expect(plan.data.name).toBe('AQUAO3 Омолаживающий концентрат')
      expect(plan.data.slug).toBe('aquao3-omolazhivayushchij-kontsentrat')
      expect(plan.data.isProfessional).toBe(true)
      expect(plan.data.isActive).toBe(true)
      expect(plan.data.images).toEqual([])
      expect(plan.data.concerns).toEqual([])
    }
  })

  it('преобразует русские подписи типов кожи в enum', () => {
    const plan = planNewProduct(baseItem, ctx)
    if (plan.kind === 'create') {
      expect(plan.data.skinTypes).toContain('all_types')
    }
  })

  it('возвращает "exists" если товар уже в БД', () => {
    const existingItem: ProProduct = {
      ...baseItem,
      slug: 'existing-product',
    }
    const plan = planNewProduct(existingItem, ctx)
    expect(plan.kind).toBe('exists')
    if (plan.kind === 'exists') {
      expect(plan.reason).toContain('уже существует')
    }
  })

  it('выбрасывает ошибку если категория не найдена', () => {
    const item: ProProduct = {
      ...baseItem,
      category: 'unknown-category',
    }
    expect(() => planNewProduct(item, ctx)).toThrow(/не найдена/)
  })

  it('выбрасывает ошибку если неизвестный тип кожи', () => {
    const item: ProProduct = {
      ...baseItem,
      skinTypes: ['Неизвестный тип кожи'],
    }
    expect(() => planNewProduct(item, ctx)).toThrow()
  })

  it('множественные типы кожи образуют объединение', () => {
    const item: ProProduct = {
      ...baseItem,
      skinTypes: ['Сухая', 'Жирная / Проблемная / Комбинированная'],
    }
    const plan = planNewProduct(item, ctx)
    if (plan.kind === 'create') {
      expect(plan.data.skinTypes).toContain('dry')
      expect(plan.data.skinTypes).toContain('oily')
      expect(plan.data.skinTypes).toContain('combination')
    }
  })

  it('сохраняет brandId и lineId если заданы', () => {
    const plan = planNewProduct(baseItem, ctx)
    if (plan.kind === 'create') {
      expect(plan.data.brandId).toBe('brand-isseimi')
      expect(plan.data.lineId).toBe('line-base')
    }
  })

  it('устанавливает categoryId из контекста', () => {
    const plan = planNewProduct(baseItem, ctx)
    if (plan.kind === 'create') {
      expect(plan.data.categoryId).toBe('cat-syvorotki')
    }
  })
})

// ────────────────────────────── planVariantForExisting ────────────────────────

describe('planVariantForExisting()', () => {
  const baseProduct = {
    id: 'prod-123',
    variants: [
      {
        volumeValue: 50,
        volumeUnit: 'ml' as const,
        externalId: 'old-external-id',
      },
    ],
  }

  const baseItem = {
    article: 2020,
    siteName: 'EMULSION HIGIENIZANTE',
    volume: { value: 1000, unit: 'ml' as const, label: '1000 мл' },
    wholesaleKopecks: 950000,
  }

  it('создаёт фасовку если она не существует', () => {
    const plan = planVariantForExisting(baseItem, baseProduct)
    expect(plan.kind).toBe('create')
    if (plan.kind === 'create') {
      expect(plan.productId).toBe('prod-123')
      expect(plan.data.externalId).toBe('bmg-2020')
      expect(plan.data.volumeValue).toBe('1000')
      expect(plan.data.volumeUnit).toBe('ml')
      expect(plan.data.retailPrice).toBe(950000)
      expect(plan.data.wholesalePrice).toBe(950000)
      expect(plan.data.isProfessional).toBe(true)
      expect(plan.data.stock).toBe(10)
    }
  })

  it('обновляет фасовку если находит её по externalId', () => {
    const product = {
      id: 'prod-123',
      variants: [
        {
          id: 'var-123',
          volumeValue: 1000,
          volumeUnit: 'ml' as const,
          externalId: 'bmg-2020', // Совпадает
        },
      ],
    }

    const plan = planVariantForExisting(baseItem, product)
    expect(plan.kind).toBe('none')
    if (plan.kind === 'none') {
      expect(plan.reason).toContain('Без изменений')
    }
  })

  it('конфликт: одинаковый объём, но разный externalId', () => {
    const product = {
      id: 'prod-123',
      variants: [
        {
          volumeValue: 1000,
          volumeUnit: 'ml' as const,
          externalId: 'other-external-id',
        },
      ],
    }

    const plan = planVariantForExisting(baseItem, product)
    expect(plan.kind).toBe('conflict')
    if (plan.kind === 'conflict') {
      expect(plan.reason).toContain('externalId')
    }
  })

  it('конфликт: externalId совпадает, но объём не совпадает', () => {
    const product = {
      id: 'prod-123',
      variants: [
        {
          id: 'var-123',
          volumeValue: 500, // Другой объём
          volumeUnit: 'ml' as const,
          externalId: 'bmg-2020',
        },
      ],
    }

    const plan = planVariantForExisting(baseItem, product)
    expect(plan.kind).toBe('conflict')
    if (plan.kind === 'conflict') {
      expect(plan.reason).toContain('объём')
    }
  })

  it('новая фасовка имеет правильный label', () => {
    const plan = planVariantForExisting(baseItem, baseProduct)
    if (plan.kind === 'create') {
      expect(plan.data.volumeLabel).toBe('1000 мл')
    }
  })

  it('фасовка для шт (pcs)', () => {
    const item = {
      article: 2021,
      siteName: 'Test Set',
      volume: { value: 5, unit: 'pcs' as const, label: '5 × 5 мл' },
      wholesaleKopecks: 1000000,
    }
    const product = {
      id: 'prod-123',
      variants: [],
    }

    const plan = planVariantForExisting(item, product)
    if (plan.kind === 'create') {
      expect(plan.data.volumeUnit).toBe('pcs')
      expect(plan.data.volumeValue).toBe('5')
      expect(plan.data.volumeLabel).toBe('5 × 5 мл')
    }
  })
})
