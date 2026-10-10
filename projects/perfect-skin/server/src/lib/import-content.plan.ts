import { z } from 'zod'

const TextBlockSchema = z.array(z.string().min(1)).min(1).nullable()

export const ContentItemSchema = z.object({
  slug: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceFile: z.string().min(1),
  volume: z.string().min(1),
  description: z.array(z.string().min(1)).min(1),
  forWhom: TextBlockSchema,
  actives: TextBlockSchema,
  usage: TextBlockSchema,
  lifehack: TextBlockSchema,
  inci: TextBlockSchema,
})

export const ContentFileSchema = z.array(ContentItemSchema)

export type ContentItem = z.infer<typeof ContentItemSchema>

export interface ProductTextFields {
  description: string
  usage: string | null
  inciText: string | null
}

export interface FieldPlan {
  field: keyof ProductTextFields
  inFile: boolean
  oldLength: number
  newLength: number
  changed: boolean
}

export interface ProductTextPlan {
  data: Partial<ProductTextFields>
  fields: FieldPlan[]
}

const stripBullet = (line: string): string => line.replace(/^[•\-–]\s*/, '')

// Страница выводит поля через whitespace-pre-line, без markdown: абзацы — пустой строкой, пункты списка — переносом.
export function composeDescription(item: ContentItem): string {
  const blocks = [item.description.join('\n\n')]
  if (item.forWhom) blocks.push(`Кому подойдёт:\n${item.forWhom.map(stripBullet).join('\n')}`)
  if (item.actives) blocks.push(`Активные ингредиенты:\n${item.actives.join('\n')}`)
  if (item.lifehack) blocks.push(`Лайфхак:\n${item.lifehack.join('\n\n')}`)
  return blocks.join('\n\n')
}

function planField(
  field: keyof ProductTextFields,
  oldValue: string | null,
  newValue: string | undefined
): FieldPlan {
  const before = oldValue ?? ''
  const after = newValue ?? before
  return {
    field,
    inFile: newValue !== undefined,
    oldLength: before.length,
    newLength: after.length,
    changed: newValue !== undefined && newValue !== before,
  }
}

export function planProductText(item: ContentItem, current: ProductTextFields): ProductTextPlan {
  const description = composeDescription(item)
  const usage = item.usage?.join('\n\n')
  const inciText = item.inci?.join('\n')

  const fields = [
    planField('description', current.description, description),
    planField('usage', current.usage, usage),
    planField('inciText', current.inciText, inciText),
  ]

  const data: Partial<ProductTextFields> = {}
  if (fields[0].changed) data.description = description
  if (fields[1].changed) data.usage = usage
  if (fields[2].changed) data.inciText = inciText

  return { data, fields }
}
