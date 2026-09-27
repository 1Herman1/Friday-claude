import type { ProductCard, ProductsListResponse } from '@/types/api'
import { fetchApi } from './api'
import type { QuizAnswers } from './quiz-config'

// Словарь для преобразования кодов needs/extras в человекочитаемые фразы
export const NEEDS_LABELS: Record<string, string> = {
  hydration: 'увлажнение',
  anti_age: 'лифтинг и упругость',
  pigmentation: 'выравнивание тона',
  acne: 'борьба с акне',
  sensitivity: 'снятие раздражения',
  redness: 'борьба с красотой',
  cleansing: 'глубокое очищение',
  sun_protection: 'защита от солнца',
  firming: 'укрепление',
  eye_area: 'уход за веками',
  post_procedure: 'восстановление после процедур',
  regeneration: 'регенерация',
  radiance: 'сияние',
  sebum_control: 'себорегуляция',
  hygiene: 'гигиена',
  barrier: 'восстановление барьера',
  daily_care: 'ежедневный уход',
  express_care: 'экспресс-уход',
  intensive_care: 'интенсивный уход',
  nourishing: 'питание',
}

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

// Коды компонентов, противопоказанные при беременности
const PREGNANCY_CONTRAINDICATED_CODES = [
  'retinol', // ретинол
  'acid', // кислоты
  'anti_age', // анти-эйдж средства часто содержат ретинол
]

export async function matchProducts(answers: QuizAnswers): Promise<QuizResult> {
  const { audience, skin, need, extras: rawExtras, format, isPregnant } = answers

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
      // Фильтруем товары при беременности — исключаем контрапоказанные
      let items = response.items
      if (isPregnant) {
        items = items.filter((product) => {
          const hasContraindicated = product.needs.some((needCode) =>
            PREGNANCY_CONTRAINDICATED_CODES.some((code) => needCode.includes(code))
          )
          return !hasContraindicated
        })
      }
      categoryToProducts[cat] = items
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
        const label = NEEDS_LABELS[extra] || extra
        reasonParts.push(label)
      }
    }

    if (normalizedSkin !== 'unknown') {
      if (product.skinTypes.includes(normalizedSkin)) {
        reasonParts.push('для вашей кожи')
      } else if (product.skinTypes.includes('all_types')) {
        reasonParts.push('универсально')
      }
    }

    reason = reasonParts.join(', ') || 'подходит для ежедневного ухода'

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
