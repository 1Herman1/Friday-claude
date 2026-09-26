import { MEDICAL_LINES } from '../services/product.service.js'

export type ProductType = 'medical' | 'treats' | 'vet' | 'care' | 'dry' | 'wet'

export interface TypedProduct {
  name: string
  quizTags: string[]
  autoQuizTags: string[]
}

export const VET_WORDS = ['антипаразит', 'капли', 'витамин', 'таблет', 'суспенз', 'ошейник']

export const CARE_WORDS = [
  'шампунь',
  'лосьон',
  'крем',
  'гель-мыло',
  'зубная паста',
  'паста для вывода шерсти',
  'спрей',
  'нейтрализатор запаха',
  'салфетк',
]

function hasTag(product: TypedProduct, tag: string): boolean {
  return product.quizTags.includes(tag) || product.autoQuizTags.includes(tag)
}

/** Тип товара для дерева «Вид → Тип → Назначение»; null — товар остаётся только в корне вида. */
export function classifyType(product: TypedProduct): ProductType | null {
  if (MEDICAL_LINES.some((line) => product.name.includes(line))) return 'medical'
  if (/лакомств|лакомый|snack|treat/i.test(product.name)) return 'treats'

  const lower = product.name.toLowerCase()
  if (VET_WORDS.some((word) => lower.includes(word))) return 'vet'
  if (CARE_WORDS.some((word) => lower.includes(word))) return 'care'

  if (hasTag(product, 'format:dry')) return 'dry'
  if (hasTag(product, 'format:wet')) return 'wet'
  return null
}
