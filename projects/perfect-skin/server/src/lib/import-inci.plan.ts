import { z } from 'zod'

export const InciItemSchema = z.object({
  slug: z.string().min(1),
  inci: z.string().trim().min(1),
  clientDecision: z.enum(['keep', 'skip']),
})

export const InciFileSchema = z.object({ items: z.array(InciItemSchema) })

export type InciItem = z.infer<typeof InciItemSchema>

export interface LiveProduct {
  slug: string
  inciText: string | null
}

export interface InciChange {
  slug: string
  from: string | null
  to: string
}

export interface InciPlan {
  changes: InciChange[]
  unchanged: string[]
  skipped: string[]
  missing: string[]
  ambiguous: string[]
}

export function planInci(items: InciItem[], products: LiveProduct[]): InciPlan {
  const bySlug = new Map<string, LiveProduct[]>()
  for (const product of products) bySlug.set(product.slug, [...(bySlug.get(product.slug) ?? []), product])

  const plan: InciPlan = { changes: [], unchanged: [], skipped: [], missing: [], ambiguous: [] }
  for (const item of items) {
    if (item.clientDecision === 'skip') {
      plan.skipped.push(item.slug)
      continue
    }
    const found = bySlug.get(item.slug) ?? []
    if (found.length === 0) {
      plan.missing.push(item.slug)
      continue
    }
    if (found.length > 1) {
      plan.ambiguous.push(item.slug)
      continue
    }
    const to = item.inci.trim()
    const from = found[0].inciText
    if (from === to) plan.unchanged.push(item.slug)
    else plan.changes.push({ slug: item.slug, from, to })
  }
  return plan
}
