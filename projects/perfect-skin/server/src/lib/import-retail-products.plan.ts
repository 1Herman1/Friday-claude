import { z } from 'zod'
import type { Concern, SkinType } from '../../../../../node_modules/.prisma/ps-client/index.js'
import { NEEDS_MAP, SKIN_TYPES_MAP } from './catalog-seed-maps.js'

export const RetailProductSchema = z.object({
  article: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  line: z.string().min(1).nullable(),
  primaryCategory: z.string().min(1),
  volume: z.number().positive(),
  retailKopecks: z.number().int().positive(),
  wholesaleKopecks: z.number().int().positive(),
  skinTypes: z.array(z.string().min(1)).min(1),
  keyNeeds: z.array(z.string().min(1)),
  imageUrl: z.string().url(),
  imageFile: z.string().min(1),
})

export type RetailProduct = z.infer<typeof RetailProductSchema>

export const RetailProductsFileSchema = z.object({
  _meta: z.object({
    source: z.string(),
    date: z.string(),
    note: z.string().optional(),
  }),
  products: z.array(RetailProductSchema),
})

export type RetailProductsFile = z.infer<typeof RetailProductsFileSchema>

export function parseRetailProductsFile(json: unknown): RetailProductsFile {
  return RetailProductsFileSchema.parse(json)
}

export interface RetailPlanContext {
  categories: Map<string, string>
  brands: Map<string, string>
  lines: Map<string, string>
  products: Map<string, string>
}

const BRAND_SLUGS = new Map<string, string>([
  ['ISSEIMI', 'isseimi'],
  ['GLACÉE Skincare', 'glacee-skincare'],
])

const LINE_SLUGS = new Map<string, string>([
  ['ISSEIMI Base', 'isseimi-base'],
  ['ISSEIMI MD', 'isseimi-md'],
  ['ISSEIMI Nat Collection', 'isseimi-nat-collection'],
  ['GLACÉE Skincare Man Line', 'glacee-skincare-man-line'],
])

const CATEGORY_CONCERN = new Map<string, Concern>([
  ['spf', 'sun_protection'],
  ['kremy-dlya-vek', 'eye_area'],
])

export interface RetailProductCreate {
  name: string
  slug: string
  description: string
  shortDescription: string
  images: string[]
  brandId: string
  lineId: string | null
  isProfessional: false
  isActive: true
  skinTypes: SkinType[]
  concerns: Concern[]
}

export interface RetailVariantCreate {
  volumeValue: string
  volumeUnit: 'ml'
  volumeLabel: string
  retailPrice: number
  wholesalePrice: number
  isProfessional: false
  stock: number
  sku: string
  externalId: string
}

export type RetailPlan =
  | { kind: 'exists'; slug: string; productId: string }
  | {
      kind: 'create'
      slug: string
      categoryId: string
      product: RetailProductCreate
      variant: RetailVariantCreate
    }

function requireSlug(table: Map<string, string>, what: string, value: string): string {
  const slug = table.get(value)
  if (slug === undefined) throw new Error(`Нет соответствия для ${what} в файле: «${value}»`)
  return slug
}

function requireId(table: Map<string, string>, what: string, slug: string): string {
  const id = table.get(slug)
  if (id === undefined) throw new Error(`В базе нет ${what} «${slug}»`)
  return id
}

function toSkinTypes(item: RetailProduct): SkinType[] {
  const skinTypes = new Set<SkinType>()
  for (const label of item.skinTypes) {
    const mapped: SkinType[] | undefined = SKIN_TYPES_MAP[label]
    if (!mapped) throw new Error(`Неизвестный тип кожи «${label}» в товаре ${item.slug}`)
    mapped.forEach((type) => skinTypes.add(type))
  }
  return [...skinTypes]
}

function toConcerns(item: RetailProduct): Concern[] {
  const concerns: Concern[] = []
  for (const need of item.keyNeeds) {
    const concern: Concern | undefined = NEEDS_MAP[need]
    if (!concern) throw new Error(`Неизвестная подпись забот «${need}» в товаре ${item.slug}`)
    if (!concerns.includes(concern)) concerns.push(concern)
  }
  const categoryConcern = CATEGORY_CONCERN.get(item.primaryCategory)
  if (categoryConcern && !concerns.includes(categoryConcern)) concerns.push(categoryConcern)
  return concerns
}

export function russianPart(name: string): string {
  const start = name.search(/\p{Script=Cyrillic}/u)
  return start === -1 ? name : name.slice(start)
}

export function planRetailProduct(item: RetailProduct, ctx: RetailPlanContext): RetailPlan {
  const existingId = ctx.products.get(item.slug)
  if (existingId !== undefined) return { kind: 'exists', slug: item.slug, productId: existingId }

  const brandId = requireId(ctx.brands, 'бренда', requireSlug(BRAND_SLUGS, 'бренда', item.brand))
  const lineId =
    item.line === null ? null : requireId(ctx.lines, 'линейки', requireSlug(LINE_SLUGS, 'линейки', item.line))
  const categoryId = requireId(ctx.categories, 'категории', item.primaryCategory)
  const description = russianPart(item.name)

  return {
    kind: 'create',
    slug: item.slug,
    categoryId,
    product: {
      name: item.name,
      slug: item.slug,
      description,
      shortDescription: description,
      images: [`/products/${item.imageFile}`],
      brandId,
      lineId,
      isProfessional: false,
      isActive: true,
      skinTypes: toSkinTypes(item),
      concerns: toConcerns(item),
    },
    variant: {
      volumeValue: item.volume.toString(),
      volumeUnit: 'ml',
      volumeLabel: `${item.volume} мл`,
      retailPrice: item.retailKopecks,
      wholesalePrice: item.wholesaleKopecks,
      isProfessional: false,
      stock: 10,
      sku: String(item.article),
      externalId: `bmg-${item.article}`,
    },
  }
}
