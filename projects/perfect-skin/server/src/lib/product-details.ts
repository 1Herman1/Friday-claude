import { z } from 'zod'

const Line = z.string().trim().min(1).max(3000)
const Item = z.object({ title: z.string().trim().min(1).max(160).nullable(), text: Line }).strict()
const HowItWorks = z
  .object({
    heading: z.string().max(120),
    lead: z.array(Line).max(4),
    items: z.array(Item).max(10),
    result: Line.nullable(),
  })
  .strict()
const ForWhom = z
  .object({ lead: Line.nullable(), items: z.array(Line).min(1).max(14), note: z.array(Line).max(3) })
  .strict()
const Usage = z
  .object({ heading: z.string().max(60), steps: z.array(Item).min(1).max(14), notes: z.array(Line).max(4) })
  .strict()
const Lifehack = z
  .object({ title: z.string().max(160).nullable(), paragraphs: z.array(Line).min(1).max(6) })
  .strict()
const Extra = z
  .object({ heading: z.string().max(160), paragraphs: z.array(Line).max(6), items: z.array(Line).max(12) })
  .strict()
const Actives = z.array(z.string().trim().min(1).max(300)).max(20)
const Pro = z
  .object({
    volumeLabel: z.string().max(40),
    tagline: z.array(Line).max(3),
    intro: z.array(Line).max(12),
    howItWorks: HowItWorks.nullable(),
    forWhom: ForWhom.nullable(),
    actives: Actives,
    usage: Usage.nullable(),
  })
  .strict()

export const ProductDetailsSchema = z
  .object({
    v: z.literal(1),
    tagline: z.array(Line).max(3),
    intro: z.array(Line).max(12),
    extra: z.array(Extra).max(4),
    howItWorks: HowItWorks.nullable(),
    actives: Actives,
    forWhom: ForWhom.nullable(),
    usage: Usage.nullable(),
    lifehack: Lifehack.nullable(),
    pro: Pro.nullable(),
  })
  .strict()
  .refine((d) => d.intro.length > 0 || d.howItWorks || d.forWhom, 'пустая карточка')

export type ProductDetails = z.infer<typeof ProductDetailsSchema>

type HowItWorksValue = NonNullable<ProductDetails['howItWorks']>
type ItemValue = HowItWorksValue['items'][number]

const formatItem = (item: ItemValue): string => (item.title ? `${item.title}: ${item.text}` : item.text)

export function flattenDetails(d: ProductDetails): { description: string; usage: string | null } {
  const blocks: string[] = []
  if (d.tagline.length > 0) blocks.push(d.tagline.join('\n\n'))
  if (d.intro.length > 0) blocks.push(d.intro.join('\n\n'))
  for (const extra of d.extra) {
    const body = [...extra.paragraphs, ...extra.items].join('\n')
    blocks.push(extra.heading ? `${extra.heading}:\n${body}` : body)
  }
  if (d.howItWorks) {
    const how = d.howItWorks
    const body = [...how.lead, ...how.items.map(formatItem), how.result ?? ''].filter(Boolean).join('\n')
    blocks.push(how.heading ? `${how.heading}:\n${body}` : body)
  }
  if (d.forWhom) {
    const forWhom = d.forWhom
    blocks.push(['Кому подойдёт:', ...(forWhom.lead ? [forWhom.lead] : []), ...forWhom.items, ...forWhom.note].join('\n'))
  }
  if (d.actives.length > 0) blocks.push(`Активные ингредиенты:\n${d.actives.join('\n')}`)
  if (d.lifehack) blocks.push(`Лайфхак:\n${d.lifehack.paragraphs.join('\n\n')}`)

  const usage = d.usage ? [...d.usage.steps.map(formatItem), ...d.usage.notes].join('\n\n') : null
  return { description: blocks.join('\n\n'), usage }
}

export function readDetails(json: unknown): ProductDetails | null {
  if (json === null || json === undefined) return null
  const parsed = ProductDetailsSchema.safeParse(json)
  if (parsed.success) return parsed.data
  console.warn('product details: невалидная карточка, выводим только текст', parsed.error.issues.slice(0, 3))
  return null
}

// Текст карточки → description/usage. Единая точка для импорта и админки.
// usage отсутствует в результате, если в карточке нет способа применения:
// тогда существующее значение в базе не трогаем.
export function syncedText(d: ProductDetails): { description: string; usage?: string } {
  const flat = flattenDetails(d)
  return flat.usage === null ? { description: flat.description } : { description: flat.description, usage: flat.usage }
}

export const TEXT_LIMITS = { description: 20000, usage: 10000 } as const

export function textLimitIssue(text: { description: string; usage?: string }): string | null {
  if (text.description.length > TEXT_LIMITS.description) return `описание длиннее ${TEXT_LIMITS.description} знаков`
  if (text.usage !== undefined && text.usage.length > TEXT_LIMITS.usage) return `применение длиннее ${TEXT_LIMITS.usage} знаков`
  return null
}

export const ruErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return {
        message: issue.received === z.ZodParsedType.undefined ? 'поле обязательно' : `ожидалось: ${issue.expected}, пришло: ${issue.received}`,
      }
    case z.ZodIssueCode.too_small:
      return { message: issue.type === 'string' && issue.minimum === 1 ? 'не может быть пустым' : `минимум ${issue.minimum}` }
    case z.ZodIssueCode.too_big:
      return { message: `максимум ${issue.maximum}` }
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `лишние поля: ${issue.keys.join(', ')}` }
    case z.ZodIssueCode.invalid_literal:
      return { message: `допустимо только ${String(issue.expected)}` }
    case z.ZodIssueCode.invalid_string:
      return { message: 'неверный формат' }
    default:
      return { message: ctx.defaultError }
  }
}
