import { z } from 'zod'
import { ProductDetailsSchema, type ProductDetails } from './product-details.js'

const Replacement = z.object({ from: z.string().min(1), to: z.string() }).strict()

const DetailsOverride = z
  .object({
    actives: z.array(z.string().min(1)).optional(),
    removeHowItWorks: z.array(z.string().min(1)).optional(),
    replace: z.array(Replacement).optional(),
  })
  .strict()
  .refine(
    (override) => override.actives !== undefined || override.removeHowItWorks !== undefined || override.replace !== undefined,
    'правка без операций',
  )

export const DetailsOverridesFileSchema = z.object({
  _meta: z.object({ note: z.string().min(1) }),
  overrides: z.record(DetailsOverride),
})

export type DetailsOverrides = z.infer<typeof DetailsOverridesFileSchema>['overrides']
type DetailsOverride = DetailsOverrides[string]

// Walker не трогает ключ actives: состав меняется только своей операцией.
function mapStrings(value: unknown, fn: (text: string) => string): unknown {
  if (typeof value === 'string') return fn(value)
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, key === 'actives' ? item : mapStrings(item, fn)]),
    )
  }
  return value
}

function removeHowItWorksItems(slug: string, details: ProductDetails, titles: string[]): ProductDetails {
  const items = details.howItWorks?.items ?? []
  const missing = titles.filter((title) => !items.some((item) => item.title === title))
  if (missing.length > 0) throw new Error(`правка ${slug}: нет пункта «Как работает» с заголовком: ${missing.join(', ')}`)
  if (!details.howItWorks) return details
  return {
    ...details,
    howItWorks: {
      ...details.howItWorks,
      items: items.filter((item) => item.title === null || !titles.includes(item.title)),
    },
  }
}

function replaceText(slug: string, details: ProductDetails, replacements: DetailsOverride['replace'] = []): unknown {
  return replacements.reduce<unknown>((current, { from, to }) => {
    let hits = 0
    const next = mapStrings(current, (text) => {
      const parts = text.split(from)
      hits += parts.length - 1
      return parts.join(to)
    })
    if (hits === 0) throw new Error(`правка ${slug}: фрагмент «${from}» не найден`)
    return next
  }, details)
}

function applyOverride(slug: string, details: ProductDetails, override: DetailsOverride): ProductDetails {
  const withActives: ProductDetails = { ...details, actives: override.actives ?? details.actives }
  const withoutItems = removeHowItWorksItems(slug, withActives, override.removeHowItWorks ?? [])
  return ProductDetailsSchema.parse(replaceText(slug, withoutItems, override.replace))
}

// Правки клиента применяются поверх разбора; итог проверяет ProductDetailsSchema.
export function applyDetailsOverrides<T extends { slug: string; details: ProductDetails }>(
  units: readonly T[],
  overrides: DetailsOverrides,
): T[] {
  const slugs = new Set(units.map((unit) => unit.slug))
  const unknown = Object.keys(overrides).filter((slug) => !slugs.has(slug))
  if (unknown.length > 0) throw new Error(`правки клиента для товаров без карточки: ${unknown.join(', ')}`)

  return units.map((unit) => {
    const override = overrides[unit.slug]
    return override ? { ...unit, details: applyOverride(unit.slug, unit.details, override) } : unit
  })
}
