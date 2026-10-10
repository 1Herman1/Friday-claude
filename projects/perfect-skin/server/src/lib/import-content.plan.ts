import { z } from 'zod'
import { ProductDetailsSchema, ruErrorMap, syncedText, textLimitIssue, type ProductDetails } from './product-details.js'

export const DetailsFileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug: только латиница, цифры и дефисы'),
  details: ProductDetailsSchema,
})

export interface DetailsFile {
  slug: string
  details: ProductDetails
}

export interface CurrentContent {
  details: unknown
  description: string
  usage: string | null
}

export interface FieldPlan {
  field: 'details' | 'description' | 'usage'
  state: 'changed' | 'same' | 'not-in-card'
  oldLength?: number
  newLength?: number
}

export interface ProductContentPlan {
  data: { details?: ProductDetails; description?: string; usage?: string }
  fields: FieldPlan[]
}

// Ключи сортируются, чтобы JSONB из базы (порядок ключей у Postgres свой) сравнивался с файлом.
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

export function parseDetailsFile(file: string, json: unknown): DetailsFile {
  const parsed = DetailsFileSchema.safeParse(json, { errorMap: ruErrorMap })
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(корень)'}: ${i.message}`)
    throw new Error(`${file}: ${issues.join('; ')}`)
  }
  return parsed.data
}

function planText(field: 'description' | 'usage', before: string | null, after: string): FieldPlan {
  const oldValue = before ?? ''
  return {
    field,
    state: oldValue === after ? 'same' : 'changed',
    oldLength: oldValue.length,
    newLength: after.length,
  }
}

// Тот же план для базы и для снимка. Лимиты — отказ всего прогона, поэтому бросаем, а не режем текст.
export function planProductContent(current: CurrentContent, details: ProductDetails): ProductContentPlan {
  const text = syncedText(details)
  const limit = textLimitIssue(text)
  if (limit) throw new Error(limit)

  const data: ProductContentPlan['data'] = {}
  const fields: FieldPlan[] = []

  const detailsSame = canonicalJson(current.details) === canonicalJson(details)
  fields.push({ field: 'details', state: detailsSame ? 'same' : 'changed' })
  if (!detailsSame) data.details = details

  const description = planText('description', current.description, text.description)
  fields.push(description)
  if (description.state === 'changed') data.description = text.description

  if (text.usage === undefined) {
    fields.push({ field: 'usage', state: 'not-in-card' })
  } else {
    const usage = planText('usage', current.usage, text.usage)
    fields.push(usage)
    if (usage.state === 'changed') data.usage = text.usage
  }

  return { data, fields }
}
