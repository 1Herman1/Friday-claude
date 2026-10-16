import { z } from 'zod'

export const DetailsOverridesFileSchema = z.object({
  _meta: z.object({ note: z.string().min(1) }),
  overrides: z.record(z.object({ actives: z.array(z.string().min(1)) }).strict()),
})

export type DetailsOverrides = z.infer<typeof DetailsOverridesFileSchema>['overrides']

// Правки клиента заменяют actives целиком; итог проверяет ProductDetailsSchema при записи карточки.
export function applyActivesOverrides<T extends { slug: string; details: { actives: string[] } }>(
  units: readonly T[],
  overrides: DetailsOverrides,
): T[] {
  const slugs = new Set(units.map((unit) => unit.slug))
  const unknown = Object.keys(overrides).filter((slug) => !slugs.has(slug))
  if (unknown.length > 0) throw new Error(`правки клиента для товаров без карточки: ${unknown.join(', ')}`)

  return units.map((unit) => {
    const override = overrides[unit.slug]
    return override ? { ...unit, details: { ...unit.details, actives: override.actives } } : unit
  })
}
