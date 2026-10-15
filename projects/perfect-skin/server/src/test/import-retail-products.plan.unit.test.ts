import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseRetailProductsFile,
  planRetailProduct,
  russianPart,
  type RetailPlanContext,
  type RetailProduct,
} from '../lib/import-retail-products.plan.js'

const assets = new URL('../../assets/', import.meta.url)

const ctx: RetailPlanContext = {
  categories: new Map([
    ['ochishchenie', 'cat-och'],
    ['syvorotki', 'cat-syv'],
    ['kremy-dlya-vek', 'cat-eye'],
  ]),
  brands: new Map([
    ['isseimi', 'brand-isseimi'],
    ['glacee-skincare', 'brand-glacee'],
  ]),
  lines: new Map([['isseimi-base', 'line-base']]),
  products: new Map([['existing-slug', 'prod-1']]),
}

const hydraView: RetailProduct = {
  article: 2117,
  slug: 'hydra-view-gidra-krem-dlya-vek',
  name: 'HYDRA VIEW Гидра-крем для век',
  brand: 'ISSEIMI',
  line: 'ISSEIMI Base',
  primaryCategory: 'kremy-dlya-vek',
  volume: 15,
  retailKopecks: 1060000,
  wholesaleKopecks: 590000,
  skinTypes: ['Для всех типов кожи'],
  keyNeeds: ['Увлажнение', 'Укрепление и лифтинг'],
  imageUrl: 'https://www.isseimi.es/wp-content/uploads/2024/10/2117.jpg',
  imageFile: 'hydra-view-gidra-krem-dlya-vek.jpg',
}

describe('planRetailProduct', () => {
  it('создаёт товар и розничную фасовку по образцу seed', () => {
    const plan = planRetailProduct(hydraView, ctx)
    expect(plan).toEqual({
      kind: 'create',
      slug: 'hydra-view-gidra-krem-dlya-vek',
      categoryId: 'cat-eye',
      product: {
        name: 'HYDRA VIEW Гидра-крем для век',
        slug: 'hydra-view-gidra-krem-dlya-vek',
        description: 'Гидра-крем для век',
        shortDescription: 'Гидра-крем для век',
        images: ['/products/hydra-view-gidra-krem-dlya-vek.jpg'],
        brandId: 'brand-isseimi',
        lineId: 'line-base',
        isProfessional: false,
        isActive: true,
        skinTypes: ['all_types'],
        concerns: ['hydration', 'firming', 'eye_area'],
      },
      variant: {
        volumeValue: '15',
        volumeUnit: 'ml',
        volumeLabel: '15 мл',
        retailPrice: 1060000,
        wholesalePrice: 590000,
        isProfessional: false,
        stock: 10,
        sku: '2117',
        externalId: 'bmg-2117',
      },
    })
  })

  it('товар с существующим slug возвращает exists и не создаётся', () => {
    const plan = planRetailProduct({ ...hydraView, slug: 'existing-slug' }, ctx)
    expect(plan).toEqual({ kind: 'exists', slug: 'existing-slug', productId: 'prod-1' })
  })

  it('линия null — товар без линии', () => {
    const plan = planRetailProduct({ ...hydraView, line: null }, ctx)
    expect(plan.kind === 'create' && plan.product.lineId).toBeNull()
  })

  it('неизвестный бренд в файле — ошибка с названием', () => {
    expect(() => planRetailProduct({ ...hydraView, brand: 'NOVA' }, ctx)).toThrow('Нет соответствия для бренда в файле: «NOVA»')
  })

  it('бренд есть в файле, но не в базе — ошибка', () => {
    const noGlacee: RetailPlanContext = { ...ctx, brands: new Map([['isseimi', 'brand-isseimi']]) }
    expect(() =>
      planRetailProduct({ ...hydraView, brand: 'GLACÉE Skincare', line: null }, noGlacee),
    ).toThrow('В базе нет бренда «glacee-skincare»')
  })

  it('неизвестная линейка — ошибка', () => {
    expect(() => planRetailProduct({ ...hydraView, line: 'ISSEIMI Ghost' }, ctx)).toThrow(
      'Нет соответствия для линейки в файле: «ISSEIMI Ghost»',
    )
  })

  it('категория не найдена в базе — ошибка', () => {
    expect(() => planRetailProduct({ ...hydraView, primaryCategory: 'uhod-za-telom' }, ctx)).toThrow(
      'В базе нет категории «uhod-za-telom»',
    )
  })

  it('неизвестная подпись забот — ошибка с текстом подписи', () => {
    expect(() =>
      planRetailProduct({ ...hydraView, keyNeeds: ['Несуществующая забота'] }, ctx),
    ).toThrow('Неизвестная подпись забот «Несуществующая забота»')
  })

  it('неизвестный тип кожи — ошибка', () => {
    expect(() => planRetailProduct({ ...hydraView, skinTypes: ['Смешанная'] }, ctx)).toThrow(
      'Неизвестный тип кожи «Смешанная»',
    )
  })
})

describe('russianPart', () => {
  it('отрезает латинскую часть имени', () => {
    expect(russianPart('PURIFYING WATER Мицеллярная очищающая вода')).toBe('Мицеллярная очищающая вода')
  })

  it('имя без кириллицы возвращается целиком', () => {
    expect(russianPart('TEST ONLY')).toBe('TEST ONLY')
  })
})

describe('retail-products.json', () => {
  const catalog: { categories: Array<{ slug: string }> } = JSON.parse(
    readFileSync(new URL('catalog-curated.json', assets), 'utf-8'),
  )
  const file = parseRetailProductsFile(JSON.parse(readFileSync(new URL('retail-products.json', assets), 'utf-8')))
  const realCtx: RetailPlanContext = {
    categories: new Map(catalog.categories.map((c) => [c.slug, `cat-${c.slug}`])),
    brands: new Map([
      ['isseimi', 'brand-isseimi'],
      ['glacee-skincare', 'brand-glacee'],
    ]),
    lines: new Map([['isseimi-base', 'line-base']]),
    products: new Map(),
  }

  it('содержит 8 товаров с уникальными slug и артикулами', () => {
    expect(file.products).toHaveLength(8)
    expect(new Set(file.products.map((p) => p.slug)).size).toBe(8)
    expect(new Set(file.products.map((p) => p.article)).size).toBe(8)
  })

  it('каждый товар плансируется в создание с известными брендом, линией, категорией и подписями', () => {
    for (const item of file.products) {
      const plan = planRetailProduct(item, realCtx)
      expect(plan.kind, item.slug).toBe('create')
      if (plan.kind === 'create') expect(plan.product.images, item.slug).toEqual([`/products/${item.imageFile}`])
    }
  })

  it('у LIPOSOME-C есть забота oxidative_stress из подписи «Оксидативный стресс / гликация»', () => {
    const liposome = file.products.find((p) => p.slug === 'liposome-c-antioksidantnaya-syvorotka')
    expect(liposome?.keyNeeds).toContain('Оксидативный стресс / гликация')
    const plan = planRetailProduct(liposome!, realCtx)
    expect(plan.kind).toBe('create')
    if (plan.kind === 'create') expect(plan.product.concerns).toContain('oxidative_stress')
  })
})
