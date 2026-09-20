import { PrismaClient, type Concern } from '../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { recalcProductPrices } from '../src/services/product-prices.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

// Таблица соответствия keyNeeds → Concern
const NEEDS_MAP: Record<string, Concern> = {
  'Увлажнение': 'hydration',
  'Укрепление и лифтинг': 'firming',
  'Регенерация': 'regeneration',
  'Придание сияния коже': 'radiance',
  'Выравнивание цвета и рельефа': 'pigmentation',
  'Себорегуляция': 'sebum_control',
  'Глубокое очищение и детоксикация': 'cleansing',
  'Гигиена': 'hygiene',
  'Снятие признаков раздражения кожи': 'sensitivity',
  'Повышение защитных свойств кожи': 'barrier',
  'Ежедневный уход': 'daily_care',
  'Экспресс-уход': 'express_care',
  'Интенсивный уход': 'intensive_care',
  'Питание': 'nourishing',
}

// Таблица skinTypes
const SKIN_TYPES_MAP: Record<string, string[]> = {
  'Нормальная': ['normal'],
  'Сухая': ['dry'],
  'Чувствительная': ['sensitive'],
  'Жирная / Проблемная / Комбинированная': ['oily', 'combination'],
  'Возрастная': ['mature'],
  'Для всех типов кожи': ['all_types'],
}

async function slugify(text: string): Promise<string> {
  return text
    .toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, (char) => {
      const translitMap: Record<string, string> = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
        'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
        'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
        'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
        'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
        'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
        'э': 'e', 'ю': 'yu', 'я': 'ya',
      }
      return translitMap[char] || char
    })
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function seed() {
  const catalogPath = path.join(__dirname, '../assets/catalog-curated.json')
  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'))

  console.log('🌱 Starting seed...')

  // 1. Create categories
  console.log('📁 Seeding categories...')
  const categories: Record<string, string> = {}
  for (const cat of catalogData.categories) {
    const existing = await prisma.category.findFirst({
      where: { slug: cat.slug },
    })
    if (!existing) {
      const created = await prisma.category.create({
        data: {
          slug: cat.slug,
          name: cat.name,
          isActive: true,
          sortOrder: catalogData.categories.indexOf(cat),
        },
      })
      categories[cat.slug] = created.id
    } else {
      categories[cat.slug] = existing.id
    }
  }

  // 2. Create brands and lines
  console.log('🏷️ Seeding brands and lines...')
  const brandsMap: Record<string, string> = {}
  const linesMap: Record<string, string> = {}

  for (const product of catalogData.products) {
    if (product.brand && !brandsMap[product.brand]) {
      let brandSlug: string
      if (product.brand === 'ISSEIMI') {
        brandSlug = 'isseimi'
      } else if (product.brand === 'GLACÉE Skincare') {
        brandSlug = 'glacee-skincare'
      } else {
        brandSlug = await slugify(product.brand)
      }

      const existing = await prisma.brand.findFirst({
        where: { slug: brandSlug },
      })
      if (!existing) {
        const brand = await prisma.brand.create({
          data: {
            slug: brandSlug,
            name: product.brand,
            isActive: true,
            country: 'Испания',
            manufacturer: 'Heber Farma',
          },
        })
        brandsMap[product.brand] = brand.id
      } else {
        brandsMap[product.brand] = existing.id
      }
    }

    if (product.line && !linesMap[product.line]) {
      let lineSlug: string
      if (product.line === 'ISSEIMI Base') {
        lineSlug = 'isseimi-base'
      } else if (product.line === 'ISSEIMI MD') {
        lineSlug = 'isseimi-md'
      } else if (product.line === 'ISSEIMI Nat Collection') {
        lineSlug = 'isseimi-nat-collection'
      } else if (product.line === 'GLACÉE Skincare Man Line') {
        lineSlug = 'glacee-skincare-man-line'
      } else {
        lineSlug = await slugify(product.line)
      }

      const brandSlug = product.brand === 'ISSEIMI' ? 'isseimi' : 'glacee-skincare'
      const brandId = brandsMap[product.brand]

      const existing = await prisma.productLine.findFirst({
        where: { slug: lineSlug },
      })
      if (!existing) {
        const line = await prisma.productLine.create({
          data: {
            slug: lineSlug,
            name: product.line,
            brandId,
            isActive: true,
          },
        })
        linesMap[product.line] = line.id
      } else {
        linesMap[product.line] = existing.id
      }
    }
  }

  // 3. Seed products
  console.log('📦 Seeding products (57)...')
  let count = 0
  for (const p of catalogData.products) {
    const existing = await prisma.product.findFirst({
      where: { slug: p.slug },
    })
    if (existing) continue

    // Transform keyNeeds to concerns
    const concerns: Concern[] = []
    for (const need of p.keyNeeds || []) {
      const concern = NEEDS_MAP[need]
      if (!concern) {
        console.error(`❌ Unknown need: "${need}" in product ${p.name}`)
        throw new Error(`Unknown need: "${need}"`)
      }
      if (!concerns.includes(concern)) {
        concerns.push(concern)
      }
    }

    // Add category-specific concerns
    if (p.primaryCategory === 'spf') {
      if (!concerns.includes('sun_protection')) concerns.push('sun_protection')
    }
    if (p.primaryCategory === 'kremy-dlya-vek') {
      if (!concerns.includes('eye_area')) concerns.push('eye_area')
    }

    // Transform skinTypes
    const skinTypes = new Set<string>()
    for (const st of p.skinTypes || []) {
      const mapped = SKIN_TYPES_MAP[st]
      if (!mapped) {
        console.error(`❌ Unknown skin type: "${st}" in product ${p.name}`)
        throw new Error(`Unknown skin type: "${st}"`)
      }
      mapped.forEach((t) => skinTypes.add(t))
    }

    // Create product
    const shortDesc = p.action
      ? p.action.split('.')[0].slice(0, 160)
      : null

    const brandId = p.brand ? brandsMap[p.brand] : null
    const lineId = p.line ? linesMap[p.line] : null

    const product = await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        description: p.action || '',
        shortDescription: shortDesc,
        usage: p.application || null,
        inciText: null,
        brandId,
        lineId,
        images: p.imageFile ? [`/products/${p.imageFile}`] : [],
        concerns,
        skinTypes: Array.from(skinTypes) as any[],
        isActive: true,
        isFeatured: false,
      },
    })

    // Create variant
    const volumeValue = p.volume || 1
    const volumeUnit = p.volume ? 'ml' : 'pcs'
    const volumeLabel = p.volume ? `${volumeValue} мл` : 'набор'

    // Идемпотентность: повторный прогон сида не плодит вторые фасовки.
    const variantData = {
      productId: product.id,
      volumeValue: volumeValue.toString(),
      volumeUnit,
      volumeLabel,
      retailPrice: p.priceKopecks,
      oldRetailPrice: p.oldPriceKopecks || null,
      stock: 10,
      externalId: String(p.externalId),
      isActive: true,
    }
    const existingVariant = await prisma.productVariant.findFirst({
      where: { externalId: String(p.externalId) },
    })
    if (existingVariant) {
      await prisma.productVariant.update({ where: { id: existingVariant.id }, data: variantData })
    } else {
      await prisma.productVariant.create({ data: variantData })
    }

    // Create ingredients
    if (p.ingredients && p.ingredients.length > 0) {
      for (let i = 0; i < p.ingredients.length; i++) {
        const ingredientName = p.ingredients[i]
        let ingredient = await prisma.ingredient.findFirst({
          where: { name: ingredientName },
        })
        if (!ingredient) {
          ingredient = await prisma.ingredient.create({
            data: {
              name: ingredientName,
              slug: await slugify(ingredientName),
            },
          })
        }
        await prisma.productIngredient.create({
          data: {
            productId: product.id,
            ingredientId: ingredient.id,
            isKey: i < 3,
            sortOrder: i,
          },
        })
      }
    }

    // Associate with category
    const categoryId = categories[p.primaryCategory]
    if (categoryId) {
      await prisma.productCategory.create({
        data: {
          productId: product.id,
          categoryId,
        },
      })
    }

    count++
    if (count % 10 === 0) console.log(`  ${count}/57 products seeded`)
  }

  // 4. Recalculate minPrice/maxPrice — общей функцией (контракт 5.2Б),
  // одним SQL вместо цикла из ~114 запросов.
  console.log('💰 Recalculating prices...')
  await recalcProductPrices(prisma)

  console.log('✅ Seed completed!')
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
