import { Prisma } from '@prisma/client'

/**
 * Быстрые фильтры каталога (кнопки над выдачей). Каждый собирает условие из
 * того, что реально есть у товара: теги подбора, готовые флаги и — там, где
 * признака нет вовсе — название лечебной линейки.
 */
export const CATALOG_TAGS = [
  'kidney',
  'allergy',
  'kitten',
  'puppy',
  'weight',
  'urinary',
  'digestion',
  'senior',
  'grain-free',
  'holistic',
] as const

export type CatalogTag = (typeof CATALOG_TAGS)[number]

export function isCatalogTag(value: string): value is CatalogTag {
  return (CATALOG_TAGS as readonly string[]).includes(value)
}

/** Товар помечен тегом подбора — вручную или автоматически. */
function hasQuizTag(tag: string): Prisma.ProductWhereInput {
  return { OR: [{ quizTags: { has: tag } }, { autoQuizTags: { has: tag } }] }
}

function nameContains(...parts: string[]): Prisma.ProductWhereInput {
  return { OR: parts.map((p) => ({ name: { contains: p, mode: 'insensitive' as const } })) }
}

function any(...conditions: Prisma.ProductWhereInput[]): Prisma.ProductWhereInput {
  return { OR: conditions }
}

export function buildTagCondition(tag: CatalogTag): Prisma.ProductWhereInput {
  switch (tag) {
    case 'kidney':
      // Отдельного признака «почки» нет: такие рационы называются Renal.
      return nameContains('Renal')
    case 'allergy':
      return any(hasQuizTag('special:hypoallergenic'), hasQuizTag('health:allergy'), {
        isHypoallergenic: true,
      })
    case 'kitten':
      return hasQuizTag('age:kitten')
    case 'puppy':
      return hasQuizTag('age:puppy')
    case 'senior':
      return hasQuizTag('age:senior')
    case 'weight':
      return any(hasQuizTag('weight:overweight'), { isWeightControl: true })
    case 'urinary':
      return any(hasQuizTag('health:urinary'), nameContains('Urinary', 'Struvite', 'Oxalate'))
    case 'digestion':
      return any(hasQuizTag('health:digestion'), nameContains('Gastro'))
    case 'grain-free':
      return any(hasQuizTag('philosophy:grainfree'), { isGrainFree: true })
    case 'holistic':
      return nameContains('Holistic')
  }
}
