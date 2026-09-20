import { QUIZ_TAGS, isQuizTag, type QuizTag } from '../lib/quiz-tags.js'

export type AutotagInput = {
  name: string
  categorySlugs: string[]
  filters: { filter: string; value: string }[]
}

function normalizeCase(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е')
}

function containsSubstring(haystack: string, needle: string): boolean {
  return normalizeCase(haystack).includes(normalizeCase(needle))
}

function matchesRegex(text: string, pattern: string): boolean {
  try {
    const re = new RegExp(pattern, 'i')
    return re.test(text)
  } catch {
    return false
  }
}

/** Явные упоминания вида в названии — голые формы слов, не только «для кошек». */
function speciesMentions(nameLower: string): { cat: boolean; dog: boolean } {
  const cat =
    containsSubstring(nameLower, 'кошек') ||
    containsSubstring(nameLower, 'кошки') ||
    containsSubstring(nameLower, 'кошке') ||
    containsSubstring(nameLower, 'кошач') ||
    containsSubstring(nameLower, 'котят') ||
    containsSubstring(nameLower, 'котов') ||
    matchesRegex(nameLower, '\\bcat\\b') ||
    containsSubstring(nameLower, 'for cats') ||
    containsSubstring(nameLower, 'feline')
  const dog =
    containsSubstring(nameLower, 'собак') ||
    containsSubstring(nameLower, 'щенк') ||
    containsSubstring(nameLower, 'щенят') ||
    matchesRegex(nameLower, '\\bdog\\b') ||
    containsSubstring(nameLower, 'for dogs') ||
    containsSubstring(nameLower, 'canine')
  return { cat, dog }
}

/**
 * Оба вида названы явно («для собак и кошек»). determineSpecies в этом случае
 * возвращает null — так же, как и когда не определил ничего, — поэтому бэкфиллу
 * нужен отдельный предикат: «универсальный» и «неизвестный» — разные решения.
 */
export function mentionsBothSpecies(name: string): boolean {
  const m = speciesMentions(normalizeCase(name))
  return m.cat && m.dog
}

/**
 * Вид по словам в произвольном тексте — например, в пути папки МоегоСклада
 * («Корм/Grandorf/Grandorf для кошек»). Назван один вид — он и возвращается,
 * названы оба или ни одного — null.
 *
 * Отдельной реализации здесь быть не должно: свой список форм для папок уже
 * подвёл — «кошк» не совпадает с «кошек», и семнадцать товаров молча остались
 * без вида.
 */
export function speciesFromText(text: string): 'dog' | 'cat' | null {
  const m = speciesMentions(normalizeCase(text))
  if (m.cat && !m.dog) return 'cat'
  if (m.dog && !m.cat) return 'dog'
  return null
}

export function determineSpecies(
  name: string,
  categorySlugs: string[]
): 'dog' | 'cat' | null {
  const nameLower = normalizeCase(name)
  const categoryPath = categorySlugs.map(normalizeCase).join(' ')

  // Category slugs
  if (categoryPath.includes('cats-') || categoryPath.includes('cat-') || categoryPath.includes('кошк')) {
    return 'cat'
  }
  if (categoryPath.includes('dogs-') || categoryPath.includes('dog-') || categoryPath.includes('собак')) {
    return 'dog'
  }

  const { cat: mentionsCat, dog: mentionsDog } = speciesMentions(nameLower)

  // «Шампунь для собак и кошек» — универсальный уход, а не корм для кого-то
  // одного. Такой товар в подбор не идёт: иначе он всплывёт как рекомендация
  // по питанию.
  if (mentionsCat && mentionsDog) {
    return null
  }

  // Один вид в названии → явное упоминание
  if (mentionsCat) {
    return 'cat'
  }
  if (mentionsDog) {
    return 'dog'
  }

  // 251 товар в каталоге вообще без категорий, и вид у них читается только по
  // маркерам линейки. Маркеры ниже в этом каталоге однозначны: стерилизация,
  // «indoor», когтеточка, Hill's y/d — исключительно кошачьи; размер породы,
  // выгул, Hill's u/d — исключительно собачьи. Кошачьи проверяем первыми:
  // «Sterilised Mini» не бывает, а вот осечься на слове Adult легко.
  if (
    matchesRegex(nameLower, 'kitten') ||
    matchesRegex(nameLower, 'steril') ||
    matchesRegex(nameLower, 'neutered') ||
    matchesRegex(nameLower, 'indoor') ||
    matchesRegex(nameLower, 'matisse') ||
    matchesRegex(nameLower, 'когтеточк') ||
    matchesRegex(nameLower, 'для вывода шерсти') ||
    matchesRegex(nameLower, 'hairball') ||
    containsSubstring(nameLower, 'y/d') || // Hill's Prescription Diet y/d
    matchesRegex(nameLower, 'fibre response') ||
    matchesRegex(nameLower, 'urinary stress')
  ) {
    return 'cat'
  }

  if (
    matchesRegex(nameLower, 'puppy') ||
    matchesRegex(nameLower, 'junior') ||
    matchesRegex(nameLower, 'cibau') ||
    matchesRegex(nameLower, 'mini') ||
    matchesRegex(nameLower, 'medium') ||
    matchesRegex(nameLower, 'maxi') ||
    matchesRegex(nameLower, 'giant') ||
    matchesRegex(nameLower, '\\bsmall\\b') ||
    matchesRegex(nameLower, 'all breeds') ||
    matchesRegex(nameLower, 'для выгула') ||
    matchesRegex(nameLower, 'дождевик') ||
    matchesRegex(nameLower, 'симпарика') ||
    containsSubstring(nameLower, 'u/d') || // Hill's Prescription Diet u/d
    matchesRegex(nameLower, 'i/d low fat') ||
    matchesRegex(nameLower, 'derm complete') ||
    matchesRegex(nameLower, 'derm defense')
  ) {
    return 'dog'
  }

  return null
}

export function isUniversalCare(name: string, categorySlugs: string[]): boolean {
  const nameLower = normalizeCase(name)

  // Проверка категории: slug содержит слово "care" или начинается с "care"
  for (const slug of categorySlugs) {
    const slugNorm = normalizeCase(slug)
    if (slugNorm === 'care' || slugNorm.startsWith('care-')) {
      return true
    }
  }

  // Проверка названия: универсальный уход
  const careKeywords = [
    'гель-мыло',
    'лосьон',
    'воск для лап',
    'расческ',
    'расчёск',
    'когтерез',
    'зубная щетк',
    'нейтрализатор запаха',
    'ветеринарный паспорт',
    'пеленк',
    'пивных дрожжей',
    "brewer's yeast",
    'шампунь',
    'салфетк',
  ]

  for (const keyword of careKeywords) {
    if (containsSubstring(nameLower, keyword)) {
      return true
    }
  }

  return false
}

function deriveFormat(filters: { filter: string; value: string }[]): QuizTag[] {
  const tags: QuizTag[] = []

  for (const f of filters) {
    if (normalizeCase(f.filter) === 'вид' || normalizeCase(f.filter) === 'вид животного') {
      if (containsSubstring(f.value, 'Сухой') && isQuizTag('format:dry')) {
        tags.push('format:dry')
      } else if (containsSubstring(f.value, 'Влажный') && isQuizTag('format:wet')) {
        tags.push('format:wet')
      }
    }
  }

  return tags
}

function deriveAge(
  species: 'dog' | 'cat',
  filters: { filter: string; value: string }[]
): QuizTag[] {
  const tags: QuizTag[] = []

  for (const f of filters) {
    if (normalizeCase(f.filter) === 'возраст питомца') {
      const val = normalizeCase(f.value)

      if (val.includes('до 1 года')) {
        if (species === 'cat') {
          if (isQuizTag('age:kitten')) tags.push('age:kitten')
        } else {
          if (isQuizTag('age:puppy')) tags.push('age:puppy')
        }
      } else if (val.includes('от 1 года') || val.includes('взрослые')) {
        if (isQuizTag('age:adult')) tags.push('age:adult')
      } else if (val.includes('от 7 лет')) {
        if (isQuizTag('age:senior')) tags.push('age:senior')
      }
    }
  }

  // Default fallback
  if (tags.length === 0 && isQuizTag('age:all')) {
    tags.push('age:all')
  }

  return tags
}

function deriveFlavor(filters: { filter: string; value: string }[]): QuizTag[] {
  const tags: QuizTag[] = []
  const seen = new Set<string>()

  for (const f of filters) {
    if (normalizeCase(f.filter) === 'вкус') {
      const val = normalizeCase(f.value)

      const flavorMap: Record<string, (QuizTag | null)[]> = {
        'flavor:chicken': ['flavor:chicken', 'contains:chicken'],
        'flavor:lamb': ['flavor:lamb', 'contains:lamb'],
        'flavor:fish': ['flavor:fish', 'contains:fish'],
        'flavor:beef': ['flavor:beef', 'contains:beef'],
        'flavor:turkey': ['flavor:turkey'],
        'flavor:duck': ['flavor:duck'],
        'flavor:rabbit': ['flavor:rabbit'],
      }

      // Check each flavor
      if (
        containsSubstring(val, 'курица') ||
        containsSubstring(val, 'цыплён') ||
        containsSubstring(val, 'цыпленок')
      ) {
        for (const tag of flavorMap['flavor:chicken']) {
          if (tag && isQuizTag(tag) && !seen.has(tag)) {
            tags.push(tag)
            seen.add(tag)
          }
        }
      }

      if (
        containsSubstring(val, 'ягнён') ||
        containsSubstring(val, 'ягненок') ||
        containsSubstring(val, 'ягнёнок')
      ) {
        for (const tag of flavorMap['flavor:lamb']) {
          if (tag && isQuizTag(tag) && !seen.has(tag)) {
            tags.push(tag)
            seen.add(tag)
          }
        }
      }

      if (
        containsSubstring(val, 'лосось') ||
        containsSubstring(val, 'тунец') ||
        containsSubstring(val, 'рыба') ||
        containsSubstring(val, 'сельд') ||
        containsSubstring(val, 'треска') ||
        containsSubstring(val, 'форель')
      ) {
        for (const tag of flavorMap['flavor:fish']) {
          if (tag && isQuizTag(tag) && !seen.has(tag)) {
            tags.push(tag)
            seen.add(tag)
          }
        }
      }

      if (containsSubstring(val, 'говядина') || containsSubstring(val, 'говяжий')) {
        for (const tag of flavorMap['flavor:beef']) {
          if (tag && isQuizTag(tag) && !seen.has(tag)) {
            tags.push(tag)
            seen.add(tag)
          }
        }
      }

      if (containsSubstring(val, 'индейка')) {
        for (const tag of flavorMap['flavor:turkey']) {
          if (tag && isQuizTag(tag) && !seen.has(tag)) {
            tags.push(tag)
            seen.add(tag)
          }
        }
      }

      if (containsSubstring(val, 'утка')) {
        for (const tag of flavorMap['flavor:duck']) {
          if (tag && isQuizTag(tag) && !seen.has(tag)) {
            tags.push(tag)
            seen.add(tag)
          }
        }
      }

      if (containsSubstring(val, 'кролик')) {
        for (const tag of flavorMap['flavor:rabbit']) {
          if (tag && isQuizTag(tag) && !seen.has(tag)) {
            tags.push(tag)
            seen.add(tag)
          }
        }
      }
    }
  }

  return tags
}

function deriveGrain(filters: { filter: string; value: string }[]): QuizTag[] {
  const tags: QuizTag[] = []

  for (const f of filters) {
    if (normalizeCase(f.filter) === 'вкус') {
      const val = normalizeCase(f.value)

      if (
        containsSubstring(val, 'спельт') ||
        containsSubstring(val, 'овес') ||
        containsSubstring(val, 'овёс') ||
        containsSubstring(val, 'рис') ||
        containsSubstring(val, 'пшениц') ||
        containsSubstring(val, 'кукуруз') ||
        containsSubstring(val, 'ячмен')
      ) {
        if (isQuizTag('contains:grain')) {
          tags.push('contains:grain')
        }
      }
    }
  }

  return tags
}

function deriveHealth(filters: { filter: string; value: string }[]): QuizTag[] {
  const tags: QuizTag[] = []
  const seen = new Set<string>()

  for (const f of filters) {
    if (normalizeCase(f.filter) === 'патология') {
      const val = normalizeCase(f.value)

      if (containsSubstring(val, 'без патологий')) {
        continue
      }

      if (
        containsSubstring(val, 'улучшение работы жкт') ||
        containsSubstring(val, 'чувствительное пищеварение')
      ) {
        if (isQuizTag('health:digestion') && !seen.has('health:digestion')) {
          tags.push('health:digestion')
          seen.add('health:digestion')
        }
      }

      if (containsSubstring(val, 'кожные заболевания')) {
        if (isQuizTag('health:skin') && !seen.has('health:skin')) {
          tags.push('health:skin')
          seen.add('health:skin')
        }
      }

      if (containsSubstring(val, 'аллергия')) {
        if (isQuizTag('health:allergy') && !seen.has('health:allergy')) {
          tags.push('health:allergy')
          seen.add('health:allergy')
        }
        if (isQuizTag('special:hypoallergenic') && !seen.has('special:hypoallergenic')) {
          tags.push('special:hypoallergenic')
          seen.add('special:hypoallergenic')
        }
      }

      // По основе слова: в данных встречается и «Мочекаменная болезнь»,
      // и «Профилактика мочекаменной болезни».
      if (containsSubstring(val, 'мочекамен')) {
        if (isQuizTag('health:urinary') && !seen.has('health:urinary')) {
          tags.push('health:urinary')
          seen.add('health:urinary')
        }
      }

      if (
        containsSubstring(val, 'контроль веса') ||
        containsSubstring(val, 'снижение избыточной массы')
      ) {
        if (isQuizTag('weight:overweight') && !seen.has('weight:overweight')) {
          tags.push('weight:overweight')
          seen.add('weight:overweight')
        }
      }

      if (containsSubstring(val, 'поддержание здоровья суставов')) {
        if (isQuizTag('health:joints') && !seen.has('health:joints')) {
          tags.push('health:joints')
          seen.add('health:joints')
        }
      }
    }
  }

  return tags
}

function derivePhilosophy(name: string): QuizTag[] {
  const tags: QuizTag[] = []

  if (
    matchesRegex(name, 'Grain Free') ||
    matchesRegex(name, 'GrainFree') ||
    matchesRegex(name, '\\bGF\\b') ||
    containsSubstring(name, 'Беззернов')
  ) {
    if (isQuizTag('philosophy:grainfree')) {
      tags.push('philosophy:grainfree')
    }
  } else if (
    matchesRegex(name, 'Ancestral Grain') ||
    matchesRegex(name, 'Low Grain') ||
    containsSubstring(name, 'Спельт')
  ) {
    if (isQuizTag('philosophy:lowgrain')) {
      tags.push('philosophy:lowgrain')
    }
  }

  return tags
}

function deriveSize(species: 'dog' | 'cat', name: string): QuizTag[] {
  if (species !== 'dog') {
    return isQuizTag('size:all') ? ['size:all'] : []
  }

  const tests = [
    { pattern: 'Mini', tag: 'size:mini' },
    { pattern: 'Small\\s*&\\s*Toy', tag: 'size:mini' },
    // \b в JS не работает с кириллицей (\w — только латиница), поэтому границы
    // слова задаём явно: иначе «Той» поймается внутри «стойкий», «который».
    { pattern: '(^|[^а-яё])той([^а-яё]|$)', tag: 'size:mini' },
    { pattern: 'Small', tag: 'size:small' },
    { pattern: 'Medium', tag: 'size:medium' },
    { pattern: 'Maxi', tag: 'size:large' },
    { pattern: 'Large', tag: 'size:large' },
    { pattern: 'Giant', tag: 'size:giant' },
    { pattern: 'All Breeds|All Size|All Sizes', tag: 'size:all' },
  ]

  for (const test of tests) {
    if (matchesRegex(name, test.pattern) && isQuizTag(test.tag)) {
      return [test.tag as QuizTag]
    }
  }

  return isQuizTag('size:all') ? ['size:all'] : []
}

export function deriveQuizTags(input: AutotagInput): QuizTag[] {
  const species = determineSpecies(input.name, input.categorySlugs)

  if (!species) {
    return []
  }

  const tags: QuizTag[] = []

  tags.push((`species:${species}` as const) as QuizTag)

  tags.push(...deriveFormat(input.filters))
  tags.push(...deriveAge(species, input.filters))
  tags.push(...deriveFlavor(input.filters))
  tags.push(...deriveGrain(input.filters))
  tags.push(...deriveHealth(input.filters))
  tags.push(...derivePhilosophy(input.name))
  tags.push(...deriveSize(species, input.name))

  // Deduplicate and validate
  const unique = new Set<QuizTag>()
  for (const tag of tags) {
    if (isQuizTag(tag)) {
      unique.add(tag)
    }
  }

  return Array.from(unique)
}

export function mergeQuizTags(manual: string[], auto: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  // Manually tagged: get all namespaces
  const manualNamespaces = new Set<string>()
  for (const tag of manual) {
    const ns = tag.split(':')[0]
    manualNamespaces.add(ns)
  }

  // Add all manual tags
  for (const tag of manual) {
    if (!seen.has(tag)) {
      result.push(tag)
      seen.add(tag)
    }
  }

  // Add auto tags, but skip if namespace is overridden by manual
  for (const tag of auto) {
    const ns = tag.split(':')[0]
    if (!manualNamespaces.has(ns) && !seen.has(tag)) {
      result.push(tag)
      seen.add(tag)
    }
  }

  return result
}
