import { Prisma, BonusTxType } from '@prisma/client'
import type { QuizAnswers } from '../schemas/quiz.schema'
import { isQuizTag } from '../lib/quiz-tags'
import { applyBonusChange } from './bonus.service'
import { mergeQuizTags } from './quiz-autotag'

const QUIZ_BONUS = 300

export interface QuizUserTags {
  species: 'species:dog' | 'species:cat'
  age: string
  size: string | null
  format: 'format:dry' | 'format:wet' | 'mixed'
  brand: string | null
  avoid: string[]
  health: string[]
  philosophy: string | null
  soft: string[]
}

export interface QuizProductCard {
  id: string
  slug: string
  name: string
  brandName: string | null
  image: string | null
  matchScore: number
  variant: { id: string; weight: number; price: number; oldPrice: number | null; stock: number } | null
  badges: string[]
}

export interface QuizMatchResponse {
  sessionId: string
  main: QuizProductCard
  pair: QuizProductCard | null
  alternatives: QuizProductCard[]
  reasons: string[]
  disclaimers: string[]
  relaxed: string[]
  fallbackNote: string | null
  shortfall: { found: number } | null
  bonus: { amount: 300; status: 'granted' | 'already_granted' | 'guest'; balance: number | null }
}

function normalizeAnswers(answers: QuizAnswers): QuizUserTags {
  const species = answers.species === 'dog' ? 'species:dog' : 'species:cat'

  const age = `age:${answers.age}`

  let size: string | null = null
  if (answers.species === 'dog') {
    size = `size:${answers.size}`
  } else {
    size = 'size:all'
  }

  const format = answers.format === 'mixed' ? 'mixed' : (`format:${answers.format}` as const)

  const brand =
    answers.brand === 'any' ? null : `brand:${answers.brand}`

  const avoid = [...answers.avoid]

  const health: string[] = []
  for (const h of answers.health) {
    if (h !== 'none') {
      health.push(`health:${h}`)
    }
  }

  if (answers.species === 'cat' && 'sterilized' in answers && answers.sterilized) {
    if (!health.includes('health:sterilized')) {
      health.push('health:sterilized')
    }
  }

  const philosophy =
    answers.philosophy === 'any' ? null : `philosophy:${answers.philosophy}`

  const soft: string[] = []

  const flavorValue = answers.flavor
  if (flavorValue !== 'any') {
    if (answers.species === 'cat' && flavorValue === 'picky') {
      soft.push('special:palatable')
    } else {
      soft.push(`flavor:${flavorValue}`)
    }
  }

  if (answers.species === 'dog' && answers.activity !== 'normal') {
    soft.push(`activity:${answers.activity}`)
  }

  if (answers.species === 'cat' && 'lifestyle' in answers) {
    soft.push(`lifestyle:${answers.lifestyle}`)
  }

  if (answers.weight !== 'normal') {
    soft.push(`weight:${answers.weight}`)
  }

  return {
    species,
    age,
    size,
    format,
    brand,
    avoid,
    health,
    philosophy,
    soft,
  }
}

function passesHardFilters(u: QuizUserTags, product: { quizTags: string[]; brandSlug?: string; variants: Array<{ stock: number }> }, formatRequested: 'format:dry' | 'format:wet' | 'mixed', level: number): boolean {
  const has = (t: string) => product.quizTags.includes(t)
  const levelNum = level as 0 | 1 | 2 | 3 | 4 | 5 | 6

  // 1. Вид: никогда не ослабляется
  if (!has(u.species)) return false

  // 2. Явные аллергены (avoid, кроме 'unknown'): никогда не ослабляется
  for (const allergen of u.avoid) {
    if (has(`contains:${allergen}`)) return false
  }

  // 3. avoid:unknown
  if (u.avoid.includes('unknown')) {
    if (levelNum < 4) {
      if (!has('special:monoprotein') && !has('special:hypoallergenic')) {
        return false
      }
    }
  }

  // 4. Формат: при level<5 — точное совпадение; при level>=5 — игнор
  if (levelNum < 5) {
    if (formatRequested !== 'mixed') {
      if (!has(formatRequested)) {
        return false
      }
    }
  }

  // 5. Бренд: при level<1 и u.brand!==null — точный brandSlug; при level>=1 — снято
  if (levelNum < 1 && u.brand !== null) {
    const brandValue = BRAND_ANSWER_TO_SLUG[u.brand.replace('brand:', '')] ?? u.brand.replace('brand:', '')
    if (product.brandSlug !== brandValue) {
      return false
    }
  }

  // 6. Размер (только собаки, u.size!==null): при level<2 — точный; при level===2 — плюс соседние; при level>2 — игнор
  if (u.size !== null && u.size !== 'size:all') {
    if (levelNum < 2) {
      if (!has('size:all') && !has(u.size)) {
        return false
      }
    } else if (levelNum === 2) {
      const sizeValue = u.size.replace('size:', '')
      const sizes = ['mini', 'small', 'medium', 'large', 'giant']
      const idx = sizes.indexOf(sizeValue)
      const allowedSizes = [
        `size:${sizeValue}`,
        'size:all',
        idx > 0 ? `size:${sizes[idx - 1]}` : null,
        idx < sizes.length - 1 ? `size:${sizes[idx + 1]}` : null,
      ].filter(Boolean)
      if (!allowedSizes.some((s) => has(s as string))) {
        return false
      }
    }
  }

  // 7. Возраст: при level<3 — age:all или точный; при level>=3 — разрешить смежность adult↔senior
  if (levelNum < 3) {
    if (!has('age:all') && !has(u.age)) {
      return false
    }
  } else if (levelNum >= 3) {
    const ageValue = u.age.replace('age:', '')
    if (ageValue === 'puppy' || ageValue === 'kitten') {
      // puppy/kitten никогда не смешиваются
      if (!has('age:all') && !has(u.age)) {
        return false
      }
    } else if (ageValue === 'adult' || ageValue === 'senior') {
      // adult и senior могут смешиваться
      const allowedAges = [`age:${ageValue}`, 'age:all', 'age:adult', 'age:senior']
      if (!allowedAges.some((a) => has(a))) {
        return false
      }
    }
  }

  // 8. Наличие: при level<6 — stock>0; при level===6 — снято
  if (levelNum < 6) {
    const hasStock = product.variants.some((v) => v.stock > 0)
    if (!hasStock) {
      return false
    }
  }

  // 9. Всегда: isActive=true и quizTags.length>0
  if (product.quizTags.length === 0) {
    return false
  }

  return true
}

function scoreProduct(u: QuizUserTags, quizTags: string[]): number {
  const has = (t: string) => quizTags.includes(t)
  let score = 0
  for (const t of u.health) {
    if (has(t)) score += 3
  }
  if (u.philosophy && has(`philosophy:${u.philosophy.replace('philosophy:', '')}`)) {
    score += 2
  }
  for (const t of u.soft) {
    if (has(t)) score += 1
  }
  // Доля закрытых потребностей ЭТОГО покупателя, 0..1: делим на максимум,
  // достижимый при его ответах, а не на абстрактные 28 — иначе у всех «11%».
  const max = u.health.length * 3 + (u.philosophy ? 2 : 0) + u.soft.length
  return max === 0 ? 0 : Math.min(1, score / max)
}

// Значения анкеты (без дефиса) → slug бренда в БД (с дефисом)
const BRAND_ANSWER_TO_SLUG: Record<string, string> = {
  farmina: 'farmina',
  monge: 'monge',
  // После слияния дублей у Hill's в базе остался слаг с дефисом.
  hills: 'hill-s',
  happydog: 'happy-dog',
  happycat: 'happy-cat',
}

/**
 * Плашка под результатом подбора.
 *
 * Про смену марки говорим по ФАКТУ выданного товара, а не по факту снятия
 * фильтра. Раньше признаком служило `relaxed.includes('brand')`, и это врало:
 * цикл уровней уходит с нулевого, как только в выбранной марке нашлось меньше
 * трёх позиций, но сами товары этой марки остаются в пуле и всплывают наверх.
 * Покупатель видел предупреждение о чужом бренде над товаром своего.
 *
 * Считается в одном месте: подбор и восстановление сессии обязаны отвечать
 * одинаково, иначе перезагрузка страницы меняла бы текст под тем же товаром.
 */
function buildFallbackNote(
  brandAnswer: string | null,
  relaxed: string[],
  resultBrandSlugs: (string | undefined)[]
): string | null {
  if (brandAnswer !== null && relaxed.includes('brand')) {
    const answer = brandAnswer.replace('brand:', '')
    const wanted = BRAND_ANSWER_TO_SLUG[answer] ?? answer
    // Смешанный подбор выдаёт две карточки: молчим, если марку удержала хотя бы одна.
    if (!resultBrandSlugs.some((slug) => slug === wanted)) {
      return 'Точного совпадения в выбранной марке нет — подобрали похожий корм другого проверенного бренда'
    }
  }
  return relaxed.length > 0 ? 'Специально подобрано под особенности вашего питомца' : null
}

function getBrandPriority(brandSlug?: string): number {
  if (brandSlug === 'farmina') return 3
  if (brandSlug === 'monge') return 2
  return 1
}

async function matchQuiz(
  prisma: Prisma.TransactionClient,
  answers: QuizAnswers,
): Promise<Omit<QuizMatchResponse, 'sessionId' | 'bonus'>> {
  const u = normalizeAnswers(answers)

  const speciesValue = u.species.replace('species:', '')

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [{ quizTags: { has: u.species } }, { autoQuizTags: { has: u.species } }],
    },
    take: 500,
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      quizTags: true,
      autoQuizTags: true,
      isFeatured: true,
      brand: { select: { name: true, slug: true } },
      variants: {
        where: { isActive: true },
        select: { id: true, weight: true, price: true, oldPrice: true, stock: true },
      },
    },
  })

  interface ProductWithScore {
    id: string
    name: string
    slug: string
    images: string[]
    quizTags: string[]
    allTags: string[]
    isFeatured: boolean
    brand: { name: string; slug: string } | null
    variants: Array<{ id: string; weight: number; price: number; oldPrice: number | null; stock: number }>
    score: number
    relaxed: string[]
    format: 'dry' | 'wet'
  }

  // Precompute merged tags и format один раз для каждого товара
  interface PrecomputedProduct {
    id: string
    name: string
    slug: string
    images: string[]
    quizTags: string[]
    allTags: string[]
    isFeatured: boolean
    brand: { name: string; slug: string } | null
    variants: Array<{ id: string; weight: number; price: number; oldPrice: number | null; stock: number }>
    format: 'dry' | 'wet'
  }

  const precomputed: PrecomputedProduct[] = products.map((p) => {
    const allTags = mergeQuizTags(p.quizTags, p.autoQuizTags || [])
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      images: p.images,
      quizTags: p.quizTags,
      allTags,
      isFeatured: p.isFeatured,
      brand: p.brand,
      variants: p.variants,
      format: allTags.includes('format:wet') ? 'wet' : 'dry',
    }
  })

  const getDryPool = (lvl: number): ProductWithScore[] => {
    return precomputed
      .filter((p) => passesHardFilters(u, { quizTags: p.allTags, brandSlug: p.brand?.slug, variants: p.variants }, 'format:dry', lvl))
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        images: p.images,
        quizTags: p.quizTags,
        allTags: p.allTags,
        isFeatured: p.isFeatured,
        brand: p.brand,
        variants: p.variants,
        score: scoreProduct(u, p.allTags),
        relaxed: getRelaxedForLevel(lvl),
        format: p.format,
      }))
  }

  const getWetPool = (lvl: number): ProductWithScore[] => {
    return precomputed
      .filter((p) => passesHardFilters(u, { quizTags: p.allTags, brandSlug: p.brand?.slug, variants: p.variants }, 'format:wet', lvl))
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        images: p.images,
        quizTags: p.quizTags,
        allTags: p.allTags,
        isFeatured: p.isFeatured,
        brand: p.brand,
        variants: p.variants,
        score: scoreProduct(u, p.allTags),
        relaxed: getRelaxedForLevel(lvl),
        format: p.format,
      }))
  }

  function getRelaxedForLevel(level: number): string[] {
    const result: string[] = []
    if (level >= 1) result.push('brand')
    if (level >= 2) result.push('size')
    if (level >= 3 && !result.includes('size')) result.push('size', 'age')
    if (level >= 3 && result.includes('size')) result.push('age')
    if (level >= 4) result.push('avoid')
    if (level >= 5) result.push('format')
    if (level === 6) result.push('stock')
    return result
  }

  function sortAndTiebreak(items: ProductWithScore[]): ProductWithScore[] {
    return items.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.brand?.slug !== b.brand?.slug) {
        return getBrandPriority(b.brand?.slug) - getBrandPriority(a.brand?.slug)
      }
      if (a.isFeatured !== b.isFeatured) return b.isFeatured ? 1 : -1
      const aStock = a.variants.reduce((sum, v) => sum + v.stock, 0)
      const bStock = b.variants.reduce((sum, v) => sum + v.stock, 0)
      if (aStock !== bStock) return bStock - aStock
      const aMinPrice = Math.min(...a.variants.map((v) => v.price))
      const bMinPrice = Math.min(...b.variants.map((v) => v.price))
      if (aMinPrice !== bMinPrice) return aMinPrice - bMinPrice
      return a.id.localeCompare(b.id)
    })
  }

  let pool: ProductWithScore[] = []
  let relaxedUsed: string[] = []

  for (let level = 0; level <= 6; level++) {
    if (u.format === 'mixed') {
      const dryPool = getDryPool(level)
      const wetPool = getWetPool(level)
      if (dryPool.length >= 1 && wetPool.length >= 1 && dryPool.length + wetPool.length >= 3) {
        // При mixed сортируем сквозным score, чтобы main выбирался оптимально
        pool = sortAndTiebreak([...dryPool, ...wetPool])
        relaxedUsed = getRelaxedForLevel(level)
        break
      }
    } else {
      const currentPool = u.format === 'format:dry' ? getDryPool(level) : getWetPool(level)
      if (currentPool.length >= 3) {
        pool = sortAndTiebreak(currentPool)
        relaxedUsed = getRelaxedForLevel(level)
        break
      }
    }
  }

  if (pool.length === 0) {
    // Fallback: берём всё, что есть на максимальном уровне ослабления
    for (let level = 6; level >= 0; level--) {
      if (u.format === 'mixed') {
        const dryPool = getDryPool(level)
        const wetPool = getWetPool(level)
        if (dryPool.length >= 1 && wetPool.length >= 1) {
          pool = sortAndTiebreak([...dryPool, ...wetPool])
          relaxedUsed = getRelaxedForLevel(level)
          break
        }
      } else {
        const currentPool = u.format === 'format:dry' ? getDryPool(level) : getWetPool(level)
        if (currentPool.length >= 1) {
          pool = sortAndTiebreak(currentPool)
          relaxedUsed = getRelaxedForLevel(level)
          break
        }
      }
    }
  }

  if (pool.length === 0) {
    throw new Error('Каталог подбора пуст')
  }

  // Главная рекомендация
  let main: ProductWithScore
  if (u.brand !== null) {
    main = pool[0]
  } else {
    const priorityProduct = pool.find((p) => p.brand?.slug === 'farmina' || p.brand?.slug === 'monge')
    if (priorityProduct) {
      main = priorityProduct
    } else {
      // Бренд владелец не называл, значит и ослаблять нечего: попадали сюда
      // всегда, из-за чего подпись «Специально подобрано…» висела почти на
      // каждой выдаче и обесценивалась.
      main = pool[0]
    }
  }

  // Пара при format:mixed
  let pair: ProductWithScore | null = null
  if (u.format === 'mixed') {
    const mainFormat = main.format
    const pairFormat = mainFormat === 'dry' ? 'wet' : 'dry'
    pair = pool.find((p) => p.id !== main.id && p.format === pairFormat) || null
  }

  // Альтернативы: при mixed — 1 товар, иначе — 2
  const usedIds = new Set<string>([main.id])
  if (pair) usedIds.add(pair.id)
  const altCount = u.format === 'mixed' && pair ? 1 : 2
  const alternatives = pool.filter((p) => !usedIds.has(p.id)).slice(0, altCount)

  const resultProductIds = [main.id, pair?.id, ...alternatives.map((a) => a.id)].filter((id): id is string => id !== undefined)

  const selectVariant = (variants: Array<{ id: string; weight: number; price: number; oldPrice: number | null; stock: number }>) => {
    // Выбираем первый со stock > 0, при равенстве остатка — более дешёвый
    const available = variants.filter((v) => v.stock > 0)
    if (available.length === 0) return variants[0] || null
    return available.reduce((best, v) => v.price < best.price ? v : best)
  }

  const buildProductCard = (p: ProductWithScore): QuizProductCard => {
    const variant = selectVariant(p.variants)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brandName: p.brand?.name || null,
      image: p.images[0] || null,
      matchScore: p.score,
      variant: variant
        ? {
            id: variant.id,
            weight: variant.weight,
            price: variant.price,
            oldPrice: variant.oldPrice,
            stock: variant.stock,
          }
        : null,
      badges: getBadges(p.allTags),
    }
  }

  const reasons = buildReasons(u, main.allTags)
  const disclaimers = buildDisclaimers(u)

  const fallbackNote = buildFallbackNote(u.brand, relaxedUsed, [main.brand?.slug, pair?.brand?.slug])

  const totalCards = 1 + (pair ? 1 : 0) + alternatives.length
  const shortfall = totalCards < 3 ? { found: totalCards } : null

  return {
    main: buildProductCard(main),
    pair: pair ? buildProductCard(pair) : null,
    alternatives: alternatives.map(buildProductCard),
    reasons,
    disclaimers,
    relaxed: relaxedUsed,
    fallbackNote,
    shortfall,
  }
}

function getBadges(quizTags: string[]): string[] {
  const badges: string[] = []
  if (quizTags.includes('philosophy:grainfree')) badges.push('Беззерновой')
  if (quizTags.includes('special:monoprotein')) badges.push('Монопротеин')
  if (quizTags.includes('special:hypoallergenic')) badges.push('Гипоаллергенный')
  return badges
}

function buildReasons(u: QuizUserTags, productTags: string[]): string[] {
  const has = (t: string) => productTags.includes(t)
  const reasons: string[] = []

  const philosophyMap: Record<string, string> = {
    'philosophy:grainfree': 'Беззерновой, максимум мяса — как вы и хотели',
    'philosophy:lowgrain': 'Низкозерновой рецепт — мягкий баланс, как вы выбрали',
    'philosophy:classic': 'Классический проверенный рацион',
  }

  if (u.philosophy && has(u.philosophy)) {
    reasons.push(philosophyMap[u.philosophy])
  }

  const healthMap: Record<string, string> = {
    'health:digestion': 'Мягко для чувствительного пищеварения',
    'health:skin': 'Поддержка кожи и блеска шерсти',
    'health:allergy': 'Ограниченный список ингредиентов — снижает риск реакции при аллергии',
    'health:sterilized': 'Рассчитан для стерилизованных питомцев',
    'health:joints': 'Поддержка суставов и связок',
    'health:hairball': 'Помогает выводить комки шерсти',
    'health:urinary': 'Профилактика здоровья мочевыводящих путей',
    'health:longhair': 'Для длинношёрстных пород',
  }

  for (const h of u.health) {
    if (has(h) && reasons.length < 4) {
      reasons.push(healthMap[h])
    }
  }

  const sizeMap: Record<string, string> = {
    'size:mini': 'Подходит для мини-пород',
    'size:small': 'Подходит для малых пород',
    'size:medium': 'Подходит для средних пород',
    'size:large': 'Подходит для крупных пород',
    'size:giant': 'Подходит для гигантских пород',
  }

  if (u.size && u.size !== 'size:all' && has(u.size) && reasons.length < 4) {
    reasons.push(sizeMap[u.size])
  }

  const ageMap: Record<string, string> = {
    'age:puppy': 'Возрастная формула — для щенков',
    'age:kitten': 'Возрастная формула — для котят',
    'age:adult': 'Возрастная формула — для взрослых питомцев',
    'age:senior': 'Возрастная формула — для пожилых питомцев',
  }

  if (has(u.age) && reasons.length < 4) {
    reasons.push(ageMap[u.age])
  }

  const flavorMap: Record<string, string> = {
    'flavor:chicken': 'Курица — вкус, который любит ваш питомец',
    'flavor:lamb': 'Ягнёнок — вкус, который любит ваш питомец',
    'flavor:fish': 'Рыба — вкус, который любит ваш питомец',
    'flavor:game': 'Дичь — вкус, который любит ваш питомец',
    'flavor:beef': 'Говядина — вкус, который любит ваш питомец',
    'flavor:turkey': 'Индейка — вкус, который любит ваш питомец',
    'flavor:duck': 'Утка — вкус, который любит ваш питомец',
    'flavor:rabbit': 'Кролик — вкус, который любит ваш питомец',
  }

  for (const f of u.soft) {
    if (f.startsWith('flavor:') && has(f) && reasons.length < 4) {
      reasons.push(flavorMap[f])
    }
  }

  if (has('special:palatable') && u.soft.includes('special:palatable') && reasons.length < 4) {
    reasons.push('Высокая поедаемость — для привередливых')
  }

  if (u.soft.includes('weight:overweight') && has('weight:overweight') && reasons.length < 4) {
    reasons.push('Контроль веса')
  }

  return reasons.slice(0, 4)
}

function buildDisclaimers(u: QuizUserTags): string[] {
  const disclaimers: string[] = []
  if (u.health.includes('health:urinary')) {
    disclaimers.push('Диетические рационы при МКБ подбирает ветеринарный врач. Мы порекомендовали профилактический корм для здоровья мочевыводящих путей.')
  }
  if (u.avoid.includes('unknown')) {
    disclaimers.push('Реакцию на конкретный белок стоит подтвердить у ветеринарного врача. Мы подобрали монопротеиновый рацион.')
  }
  return disclaimers
}

async function grantQuizBonus(prisma: Prisma.TransactionClient, userId: string, sessionId: string) {
  const granted = await prisma.user.updateMany({
    where: { id: userId, welcomeBonusGranted: false },
    data: { welcomeBonusGranted: true },
  })
  if (granted.count === 1) {
    await applyBonusChange(prisma, { userId, amount: QUIZ_BONUS, type: 'quiz', comment: 'Бонусы за прохождение подбора корма' })
    await prisma.quizSession.update({ where: { id: sessionId }, data: { bonusGranted: true } })
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { bonusPoints: true } })
    return { status: 'granted' as const, balance: user.bonusPoints }
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { bonusPoints: true } })
  return { status: 'already_granted' as const, balance: user.bonusPoints }
}

export async function runQuizMatch(
  prisma: Prisma.TransactionClient,
  answers: QuizAnswers,
  userId?: string,
): Promise<QuizMatchResponse> {
  const matchResult = await matchQuiz(prisma, answers)

  const session = await prisma.quizSession.create({
    data: {
      userId: userId || null,
      species: answers.species as 'cat' | 'dog',
      answers,
      tags: matchResult.relaxed,
      resultProductIds: matchResult.main.id ? [
        matchResult.main.id,
        matchResult.pair?.id,
        ...matchResult.alternatives.map((a) => a.id),
      ].filter((id): id is string => !!id) : [],
      relaxed: matchResult.relaxed,
    },
  })

  let bonus: QuizMatchResponse['bonus']

  if (userId) {
    const bonusResult = await grantQuizBonus(prisma, userId, session.id)
    bonus = { amount: 300, status: bonusResult.status, balance: bonusResult.balance }
  } else {
    bonus = { amount: 300, status: 'guest', balance: null }
  }

  return {
    sessionId: session.id,
    main: matchResult.main,
    pair: matchResult.pair,
    alternatives: matchResult.alternatives,
    reasons: matchResult.reasons,
    disclaimers: matchResult.disclaimers,
    relaxed: matchResult.relaxed,
    fallbackNote: matchResult.fallbackNote,
    shortfall: matchResult.shortfall,
    bonus,
  }
}

export async function getQuizSession(prisma: Prisma.TransactionClient, sessionId: string): Promise<QuizMatchResponse | null> {
  const session = await prisma.quizSession.findUnique({ where: { id: sessionId } })
  if (!session) return null

  const productIds = session.resultProductIds
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      quizTags: true,
      autoQuizTags: true,
      isFeatured: true,
      brand: { select: { name: true, slug: true } },
      variants: {
        where: { isActive: true },
        select: { id: true, weight: true, price: true, oldPrice: true, stock: true },
      },
    },
  })

  const productMap = new Map(products.map((p) => [p.id, p]))
  const u = normalizeAnswers(session.answers as unknown as QuizAnswers)

  const selectVariant = (variants: Array<{ id: string; weight: number; price: number; oldPrice: number | null; stock: number }>) => {
    const available = variants.filter((v) => v.stock > 0)
    if (available.length === 0) return variants[0] || null
    return available.reduce((best, v) => v.price < best.price ? v : best)
  }

  const buildCard = (id: string): QuizProductCard => {
    const p = productMap.get(id)
    if (!p) throw new Error(`Product ${id} not found`)
    const allTags = mergeQuizTags(p.quizTags, p.autoQuizTags)
    const variant = selectVariant(p.variants)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brandName: p.brand?.name || null,
      image: p.images[0] || null,
      matchScore: scoreProduct(u, allTags),
      variant: variant ? { id: variant.id, weight: variant.weight, price: variant.price, oldPrice: variant.oldPrice, stock: variant.stock } : null,
      badges: getBadges(allTags),
    }
  }

  const main = buildCard(session.resultProductIds[0])
  const pair = session.resultProductIds[1] ? buildCard(session.resultProductIds[1]) : null
  const alternatives = session.resultProductIds.slice(pair ? 2 : 1, pair ? 4 : 3).map(buildCard)

  const mainTags = mergeQuizTags(
    productMap.get(session.resultProductIds[0])?.quizTags || [],
    productMap.get(session.resultProductIds[0])?.autoQuizTags || []
  )
  const reasons = buildReasons(u, mainTags)

  const mainProduct = productMap.get(session.resultProductIds[0])
  const pairProduct = pair ? productMap.get(session.resultProductIds[1]) : null
  const fallbackNote = buildFallbackNote(u.brand, session.relaxed, [
    mainProduct?.brand?.slug,
    pairProduct?.brand?.slug,
  ])

  const totalCards = 1 + (pair ? 1 : 0) + alternatives.length
  const shortfall = totalCards < 3 ? { found: totalCards } : null

  return {
    sessionId: session.id,
    main,
    pair,
    alternatives,
    reasons,
    disclaimers: buildDisclaimers(u),
    relaxed: session.relaxed,
    fallbackNote,
    shortfall,
    bonus: { amount: 300, status: session.bonusGranted ? 'already_granted' : 'guest', balance: null },
  }
}

export async function claimQuizBonus(prisma: Prisma.TransactionClient, sessionId: string, userId: string): Promise<{ granted: boolean; amount: number; balance: number }> {
  const session = await prisma.quizSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw new Error('Session not found')
  }

  if (session.userId !== null && session.userId !== userId) {
    throw new Error('IDOR')
  }

  if (session.userId === null) {
    // Условный update вместо безусловного: если сессию параллельно уже
    // забрал другой пользователь, count будет 0 и мы не перезапишем чужую.
    const claimed = await prisma.quizSession.updateMany({
      where: { id: sessionId, userId: null },
      data: { userId },
    })
    if (claimed.count === 0) {
      const fresh = await prisma.quizSession.findUniqueOrThrow({ where: { id: sessionId } })
      if (fresh.userId !== userId) {
        throw new Error('IDOR')
      }
    }
  }

  const result = await grantQuizBonus(prisma, userId, sessionId)
  return {
    granted: result.status === 'granted',
    amount: QUIZ_BONUS,
    balance: result.balance,
  }
}

export async function getQuizCoverage(prisma: Prisma.TransactionClient) {
  // Считаем по тем же тегам, что и сам подбор: иначе отчёт показывает дыры
  // там, где квиз на самом деле находит товары.
  const load = async (species: 'dog' | 'cat') => {
    const rows = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { quizTags: { has: `species:${species}` } },
          { autoQuizTags: { has: `species:${species}` } },
        ],
      },
      take: 500,
      select: { quizTags: true, autoQuizTags: true },
    })
    return rows.map((p) => ({ quizTags: mergeQuizTags(p.quizTags, p.autoQuizTags) }))
  }

  const products = await load('dog')
  const catProducts = await load('cat')

  const ages = {
    dog: ['puppy', 'adult', 'senior'],
    cat: ['kitten', 'adult', 'senior'],
  }
  const sizes = ['mini', 'small', 'medium', 'large', 'giant']
  const formats = ['dry', 'wet']

  const coverage: Array<{ species: string; age: string; size: string | null; format: string; count: number }> = []

  for (const species of ['dog', 'cat']) {
    const speciesProducts = species === 'dog' ? products : catProducts
    const speciesAges = ages[species as keyof typeof ages]

    for (const age of speciesAges) {
      for (const size of species === 'dog' ? sizes : [null]) {
        for (const format of formats) {
          const count = speciesProducts.filter((p) => {
            const hasSpecies = p.quizTags.includes(`species:${species}`)
            const hasAge = p.quizTags.includes(`age:${age}`) || p.quizTags.includes('age:all')
            const hasSize = species === 'cat' ? true : p.quizTags.includes(`size:${size}`) || p.quizTags.includes('size:all')
            const hasFormat = p.quizTags.includes(`format:${format}`)
            return hasSpecies && hasAge && hasSize && hasFormat
          }).length

          coverage.push({
            species,
            age,
            size: species === 'dog' ? size : null,
            format,
            count,
          })
        }
      }
    }
  }

  return coverage.sort((a, b) => a.count - b.count)
}
