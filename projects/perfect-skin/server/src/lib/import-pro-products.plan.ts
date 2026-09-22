import { z } from 'zod'
import type { Concern, SkinType, VolumeUnit } from '../../../../../node_modules/.prisma/ps-client/index.js'
import { SKIN_TYPES_MAP } from './catalog-seed-maps.js'

// ──────────────────────────── Типы данных ────────────────────────────

export const VolumeSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['ml', 'g', 'pcs']),
  label: z.string(),
})

export type Volume = z.infer<typeof VolumeSchema>

export const VariantForExistingSchema = z.object({
  article: z.number(),
  siteName: z.string(),
  volume: VolumeSchema,
  wholesaleKopecks: z.number().int().positive(),
})

export type VariantForExisting = z.infer<typeof VariantForExistingSchema>

export const ProProductSchema = z.object({
  article: z.number(),
  name: z.string(),
  slug: z.string(),
  brand: z.string(),
  line: z.string(),
  category: z.string(),
  description: z.string(),
  shortDescription: z.string(),
  // skinTypes — массив русских подписей (как в catalog-curated.json)
  skinTypes: z.array(z.string().refine((s) => Object.keys(SKIN_TYPES_MAP).includes(s), {
    message: 'Неизвестный тип кожи',
  })),
  volume: VolumeSchema,
  wholesaleKopecks: z.number().int().positive(),
})

export type ProProduct = z.infer<typeof ProProductSchema>

export const ProProductsFileSchema = z.object({
  _meta: z.object({
    source: z.string(),
    date: z.string(),
    note: z.string().optional(),
  }),
  variantsForExisting: z.array(VariantForExistingSchema).default([]),
  products: z.array(ProProductSchema).default([]),
})

export type ProProductsFile = z.infer<typeof ProProductsFileSchema>

// ──────────────────────────── Контекст планирования ────────────────────────────

export interface PlanContext {
  // Словари существующих сущностей
  categories: Map<string, { id: string; maxSortOrder: number }>
  brands: Map<string, string> // slug → id
  lines: Map<string, string> // slug → id
  products: Map<string, string> // slug → id
}

// ──────────────────────────── Планы действий ────────────────────────────

export type ProductPlan =
  | { kind: 'create'; slug: string; data: ProductCreateData }
  | { kind: 'exists'; productId: string; reason: string }

export type VariantPlan =
  | { kind: 'create'; productId: string; data: VariantCreateData }
  | { kind: 'update'; variantId: string; data: VariantUpdateData }
  | { kind: 'conflict'; reason: string }
  | { kind: 'none'; reason: string }

// Данные для создания товара: готовы для передачи в Prisma.create()
export interface ProductCreateData {
  name: string
  slug: string
  description: string
  shortDescription: string
  images: string[]
  brandId?: string
  lineId?: string
  isProfessional: true
  isActive: true
  skinTypes: SkinType[]
  concerns: Concern[]
  // Связь с категорией — отдельно (ProductCategory.create)
  categoryId: string
}

// Данные для создания фасовки
export interface VariantCreateData {
  volumeValue: string
  volumeUnit: VolumeUnit
  volumeLabel: string
  retailPrice: number // = wholesaleKopecks (обязательное поле, оптовику подставляется wholesalePrice)
  wholesalePrice: number
  isProfessional: true
  stock: number
  externalId: string
}

// Данные для обновления фасовки
export interface VariantUpdateData {
  wholesalePrice: number
  isProfessional: boolean
}

// ──────────────────────────── Функции планирования ────────────────────────────

/**
 * Разбирает и валидирует JSON-файл профессиональных товаров.
 * Выбрасывает ZodError если формат неверный.
 */
export function parseProProductsFile(json: unknown): ProProductsFile {
  return ProProductsFileSchema.parse(json)
}

/**
 * Планирует создание нового товара или возвращает информацию о существующем.
 */
export function planNewProduct(item: ProProduct, ctx: PlanContext): ProductPlan {
  // Проверяем, есть ли уже товар с таким slug
  if (ctx.products.has(item.slug)) {
    return { kind: 'exists', productId: ctx.products.get(item.slug)!, reason: 'Товар уже существует' }
  }

  // Получаем ID бренда и линии (они должны существовать)
  const brandId = ctx.brands.get(item.brand)
  const lineId = ctx.lines.get(item.line)

  // Проверяем категорию
  if (!ctx.categories.has(item.category)) {
    throw new Error(`Категория "${item.category}" не найдена`)
  }
  const categoryId = ctx.categories.get(item.category)!.id

  // Преобразуем русские подписи типов кожи в enum-значения
  const skinTypes = new Set<SkinType>()
  for (const ruName of item.skinTypes) {
    const mapped = SKIN_TYPES_MAP[ruName]
    if (!mapped) {
      throw new Error(`Неизвестный тип кожи: "${ruName}"`)
    }
    mapped.forEach((t) => skinTypes.add(t))
  }

  const data: ProductCreateData = {
    name: item.name,
    slug: item.slug,
    description: item.description,
    shortDescription: item.shortDescription,
    images: [],
    brandId,
    lineId,
    isProfessional: true,
    isActive: true,
    skinTypes: Array.from(skinTypes),
    concerns: [],
    categoryId,
  }

  return { kind: 'create', slug: item.slug, data }
}

/**
 * Планирует добавление фасовки к существующему товару.
 * Проверяет конфликты и наличие товара.
 */
export function planVariantForExisting(
  item: VariantForExisting,
  product: {
    id: string
    variants: Array<{
      id?: string
      volumeValue: number
      volumeUnit: VolumeUnit
      externalId?: string | null
      wholesalePrice?: number | null
      isProfessional?: boolean
    }>
  }
): VariantPlan {
  // Проверяем конфликт: уже есть фасовка с такой же объёмом и другим externalId?
  const volumeKey = `${item.volume.value}${item.volume.unit}`
  const existingWithSameVolume = product.variants.find(
    (v) => v.volumeValue === item.volume.value && v.volumeUnit === item.volume.unit
  )

  if (existingWithSameVolume && existingWithSameVolume.externalId !== `bmg-${item.article}`) {
    return {
      kind: 'conflict',
      reason: `Фасовка ${item.volume.value} ${item.volume.unit} уже существует с другим externalId`,
    }
  }

  // Ищем фасовку по externalId (идемпотентность)
  const variantByExternalId = product.variants.find((v) => v.externalId === `bmg-${item.article}`)

  if (variantByExternalId) {
    // Фасовка уже есть — обновляем
    if (variantByExternalId.volumeValue === item.volume.value && variantByExternalId.volumeUnit === item.volume.unit) {
      // Объём тот же — сравниваем опт и признак: повторный прогон с тем же
      // прайсом ничего не пишет, новый прайс обновляет только эти два поля.
      const unchanged =
        variantByExternalId.wholesalePrice === item.wholesaleKopecks && variantByExternalId.isProfessional === true
      if (unchanged || !variantByExternalId.id) {
        return { kind: 'none', reason: 'Без изменений' }
      }
      return {
        kind: 'update',
        variantId: variantByExternalId.id,
        data: { wholesalePrice: item.wholesaleKopecks, isProfessional: true },
      }
    } else {
      // Конфликт: объём не совпадает
      return {
        kind: 'conflict',
        reason: `Существующая фасовка имеет другой объём: ${variantByExternalId.volumeValue} ${variantByExternalId.volumeUnit}`,
      }
    }
  }

  // Создаём новую фасовку
  const data: VariantCreateData = {
    volumeValue: item.volume.value.toString(),
    volumeUnit: item.volume.unit,
    volumeLabel: item.volume.label,
    retailPrice: item.wholesaleKopecks, // Обязательное поле: розничная цена, для гостя она скрывается через priceHidden, оптовику подставляется wholesalePrice
    wholesalePrice: item.wholesaleKopecks,
    isProfessional: true,
    stock: 10,
    externalId: `bmg-${item.article}`,
  }

  return { kind: 'create', productId: product.id, data }
}
