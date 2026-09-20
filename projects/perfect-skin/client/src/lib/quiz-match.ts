import type { ProductCard, ProductsListResponse } from '@/types/api'
import { fetchApi } from './api'
import type { QuizAnswers } from './quiz-config'

export interface QuizResultStep {
  category: string // slug категории
  title: string // русское имя шага (Очищение, Тоник, и т.д.)
  product: ProductCard
  reason: string // почему выбран этот товар
}

export interface QuizResult {
  steps: QuizResultStep[]
  relaxed: boolean // true если совпадений было мало
}

const CATEGORY_TITLES: Record<string, string> = {
  ochishchenie: 'Очищение',
  toniki: 'Тоник',
  syvorotki: 'Сыворотка',
  'kremy-dlya-litsa-i-shei': 'Крем',
  spf: 'SPF',
  'kremy-dlya-vek': 'Крем для век',
}

const MAN_LINE = 'glacee-skincare-man-line'

function scoreProduct(
  product: ProductCard,
  need: string,
  extras: string[],
  skin: string
): number {
  let score = 0

  // Главный need +3
  if (product.needs.includes(need)) {
    score += 3
  }

  // Каждый extra +1
  for (const extra of extras) {
    if (product.needs.includes(extra)) {
      score += 1
    }
  }

  // Тип кожи: точный +2, all_types +1, unknown -
  if (skin !== 'unknown') {
    if (product.skinTypes.includes(skin)) {
      score += 2
    } else if (product.skinTypes.includes('all_types')) {
      score += 1
    }
  }

  return score
}

function selectBestProduct(
  products: ProductCard[],
  need: string,
  extras: string[],
  skin: string
): ProductCard | null {
  if (products.length === 0) return null

  // Скорируем все товары
  const scored = products.map((p) => ({
    product: p,
    score: scoreProduct(p, need, extras, skin),
  }))

  // Сортируем по score (убывание), затем по исходному порядку (tie-break)
  scored.sort((a, b) => b.score - a.score)

  return scored[0].product
}

export async function matchProducts(answers: QuizAnswers): Promise<QuizResult> {
  const { audience, skin, need, extras: rawExtras, format } = answers

  // Нормализуем skin
  const normalizedSkin = skin || 'unknown'

  // Нормализуем extras: убираем 'none'
  const extras = (rawExtras || []).filter((e) => e !== 'none')

  // Определяем шаги по формату
  let categories: string[] = []

  if (format === 'full') {
    categories = ['ochishchenie', 'toniki', 'syvorotki', 'kremy-dlya-litsa-i-shei']

    // SPF всегда в полной программе
    categories.push('spf')

    // Крем для век если есть в extras
    if (extras.includes('eye_area')) {
      categories.push('kremy-dlya-vek')
    }
  } else if (format === 'core') {
    categories = ['syvorotki', 'kremy-dlya-litsa-i-shei']

    // Очищение если есть в extras
    if (extras.includes('cleansing')) {
      categories.unshift('ochishchenie')
    }

    // Крем для век если есть в extras
    if (extras.includes('eye_area')) {
      categories.push('kremy-dlya-vek')
    }
  }

  // Загружаем товары для каждой категории
  const categoryToProducts: Record<string, ProductCard[]> = {}
  for (const cat of categories) {
    const filter = audience === 'man' ? `?category=${cat}&limit=60&sort=popular&line=${MAN_LINE}` : `?category=${cat}&limit=60&sort=popular`
    const url = `/api/v1/products${filter}`
    try {
      const response = await fetchApi<ProductsListResponse>(url)
      categoryToProducts[cat] = response.items
    } catch {
      categoryToProducts[cat] = []
    }
  }

  // Собираем результаты по каждой категории
  const steps: QuizResultStep[] = []

  for (const cat of categories) {
    const products = categoryToProducts[cat] || []

    // Пропускаем пустые категории
    if (products.length === 0) continue

    const product = selectBestProduct(
      products,
      need || '',
      extras,
      normalizedSkin
    )

    if (!product) continue

    // Генерируем reason
    let reason = ''
    const reasonParts: string[] = []

    if (product.needs.includes(need || '')) {
      reasonParts.push('подходит по задаче')
    }

    for (const extra of extras) {
      if (product.needs.includes(extra)) {
        reasonParts.push(extra)
      }
    }

    if (normalizedSkin !== 'unknown') {
      if (product.skinTypes.includes(normalizedSkin)) {
        reasonParts.push('для вашей кожи')
      } else if (product.skinTypes.includes('all_types')) {
        reasonParts.push('универсально')
      }
    }

    reason = reasonParts.join(', ') || 'лучший выбор'

    steps.push({
      category: cat,
      title: CATEGORY_TITLES[cat] || cat,
      product,
      reason,
    })
  }

  // Если < 2 шагов, повторяем без учёта кожи
  let relaxed = false
  if (steps.length < 2) {
    relaxed = true

    for (const cat of categories) {
      // Пропускаем уже добавленные
      if (steps.some((s) => s.category === cat)) continue

      const products = categoryToProducts[cat] || []
      if (products.length === 0) continue

      const product = selectBestProduct(products, need || '', extras, 'unknown')
      if (!product) continue

      steps.push({
        category: cat,
        title: CATEGORY_TITLES[cat] || cat,
        product,
        reason: 'ближайшее совпадение',
      })
    }
  }

  return { steps, relaxed }
}
