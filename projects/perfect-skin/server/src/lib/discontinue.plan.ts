import { z } from 'zod'

export const DiscontinuedFileSchema = z.object({
  _meta: z.object({
    decided: z.string(),
    source: z.string(),
    note: z.string(),
  }),
  products: z.array(z.string()),
  variants: z.array(
    z.object({
      product: z.string(),
      volume: z.number().positive(),
      note: z.string(),
    }),
  ),
})

export type DiscontinuedFile = z.infer<typeof DiscontinuedFileSchema>

export function parseDiscontinuedFile(json: unknown): DiscontinuedFile {
  return DiscontinuedFileSchema.parse(json)
}

export interface PlanVariant {
  id: string
  volumeValue: number
  isActive: boolean
  isProfessional: boolean
  cartItemCount: number
}

export interface PlanProduct {
  id: string
  slug: string
  isActive: boolean
  isProfessional: boolean
  popularPin: number | null
  cartItemCount: number
  variants: PlanVariant[]
}

export interface ReportItem {
  kind: 'product' | 'variant'
  label: string
  status: 'to_change' | 'already' | 'not_found' | 'ambiguous'
  note: string
}

export interface ProfessionalUpdate {
  productId: string
  isProfessional: boolean
}

export interface DiscontinuePlan {
  items: ReportItem[]
  productIds: string[]
  variantIds: string[]
  cartDelete: { productIds: string[]; variantIds: string[] }
  professional: ProfessionalUpdate[]
  recalcProductIds: string[]
  warnings: string[]
  totals: { products: number; variants: number; cartItems: number; popularPins: number; professional: number }
}

const yesNo = (value: boolean): string => (value ? 'да' : 'нет')

export function planDiscontinue(file: DiscontinuedFile, rows: PlanProduct[]): DiscontinuePlan {
  const bySlug = new Map<string, PlanProduct[]>()
  for (const row of rows) bySlug.set(row.slug, [...(bySlug.get(row.slug) ?? []), row])

  const items: ReportItem[] = []
  const productIds = new Set<string>()
  const variantIds = new Set<string>()
  const variantOnlyIds: string[] = []
  const variantOnlyProductIds = new Set<string>()
  let productCartItems = 0
  let variantCartItems = 0
  let popularPins = 0

  for (const slug of file.products) {
    const found = bySlug.get(slug) ?? []
    if (found.length === 0) {
      items.push({ kind: 'product', label: slug, status: 'not_found', note: 'не найдено в базе' })
      continue
    }
    if (found.length > 1) {
      items.push({ kind: 'product', label: slug, status: 'ambiguous', note: `товаров с таким slug: ${found.length}` })
      continue
    }
    const [product] = found
    const activeVariants = product.variants.filter((v) => v.isActive)
    const note = `найден, активен: ${yesNo(product.isActive)}, позиций в корзинах: ${product.cartItemCount}, popularPin: ${product.popularPin ?? 'нет'}`
    if (productIds.has(product.id)) {
      items.push({ kind: 'product', label: slug, status: 'already', note: `${note}; повтор в списке` })
      continue
    }
    if (!product.isActive) {
      items.push({ kind: 'product', label: slug, status: 'already', note })
      continue
    }
    productIds.add(product.id)
    productCartItems += product.cartItemCount
    if (product.popularPin !== null) popularPins += 1
    for (const variant of activeVariants) variantIds.add(variant.id)
    items.push({ kind: 'product', label: slug, status: 'to_change', note: `${note}; фасовок к отключению: ${activeVariants.length}` })
  }

  for (const entry of file.variants) {
    const label = `${entry.product}, ${entry.volume} мл`
    const found = bySlug.get(entry.product) ?? []
    if (found.length !== 1) {
      items.push({
        kind: 'variant',
        label,
        status: found.length === 0 ? 'not_found' : 'ambiguous',
        note: found.length === 0 ? 'товар не найден в базе' : `товаров с таким slug: ${found.length}`,
      })
      continue
    }
    const [product] = found
    const matches = product.variants.filter((v) => v.volumeValue === entry.volume)
    if (matches.length !== 1) {
      items.push({
        kind: 'variant',
        label,
        status: matches.length === 0 ? 'not_found' : 'ambiguous',
        note: matches.length === 0 ? 'фасовка с таким объёмом не найдена' : `фасовок с таким объёмом: ${matches.length}`,
      })
      continue
    }
    const [variant] = matches
    const note = `фасовка найдена, активна: ${yesNo(variant.isActive)}, позиций в корзинах: ${variant.cartItemCount}`
    if (productIds.has(product.id)) {
      items.push({ kind: 'variant', label, status: 'already', note: `${note}; снята вместе с товаром` })
      continue
    }
    if (variantIds.has(variant.id) || !variant.isActive) {
      items.push({ kind: 'variant', label, status: 'already', note })
      continue
    }
    variantIds.add(variant.id)
    variantOnlyIds.push(variant.id)
    variantOnlyProductIds.add(product.id)
    variantCartItems += variant.cartItemCount
    items.push({ kind: 'variant', label, status: 'to_change', note })
  }

  const warnings: string[] = []
  const professional: ProfessionalUpdate[] = []
  for (const product of rows) {
    if (!variantOnlyProductIds.has(product.id)) continue
    const remaining = product.variants.filter((v) => v.isActive && !variantIds.has(v.id))
    if (remaining.length === 0) {
      warnings.push(`${product.slug}: после снятия не останется активных фасовок, товар будет без цены — решить отдельно`)
      continue
    }
    const isProfessional = remaining.every((v) => v.isProfessional)
    if (isProfessional !== product.isProfessional) professional.push({ productId: product.id, isProfessional })
  }

  return {
    items,
    productIds: [...productIds],
    variantIds: [...variantIds],
    cartDelete: { productIds: [...productIds], variantIds: variantOnlyIds },
    professional,
    recalcProductIds: [...new Set([...productIds, ...variantOnlyProductIds])],
    warnings,
    totals: {
      products: productIds.size,
      variants: variantIds.size,
      cartItems: productCartItems + variantCartItems,
      popularPins,
      professional: professional.length,
    },
  }
}
