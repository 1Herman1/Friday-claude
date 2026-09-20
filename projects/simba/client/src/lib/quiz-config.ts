export interface QuizOption {
  /** Силуэт питомца рядом с текстом. Только у первого вопроса. */
  pet?: 'dog' | 'cat'
  value: string
  label: string
  description?: string
}

export interface QuizQuestion {
  id: string // ключ поля в ответах (species, age, health, avoid, format, flavor, philosophy, brand)
  branch: 'common' | 'dog' | 'cat' // common для Q0, dog для D1-D9, cat для C1-C9
  question: string // точный текст из брифа
  multiple?: boolean // true для health (D5/C5)
  showIf?: (answers: Partial<QuizAnswers>) => boolean // условные вопросы
  options: QuizOption[]
}

export interface QuizAnswers {
  // Common
  species?: 'dog' | 'cat'

  // Dog & Cat common
  age?: string // 'puppy' | 'adult' | 'senior' (dog), 'kitten' | 'adult' | 'senior' (cat)
  weight?: 'normal' | 'overweight' | 'underweight'
  health?: string[] // ['digestion', 'skin', 'allergy', 'sterilized', 'joints', 'none'] (dog)
  // или ['digestion', 'hairball', 'skin', 'allergy', 'urinary', 'longhair', 'none'] (cat)
  avoid?: string[] // ['chicken', 'beef', 'grain', 'unknown'] (dog), ['chicken', 'fish', 'grain', 'unknown'] (cat)
  format?: 'dry' | 'wet' | 'mixed'
  flavor?: string // 'chicken' | 'lamb' | 'fish' | 'game' | 'any' (dog)
  // или 'chicken' | 'fish' | 'game' | 'picky' | 'any' (cat)
  philosophy?: 'grainfree' | 'lowgrain' | 'classic' | 'any'
  brand?: string // 'farmina' | 'monge' | 'hills' | 'happydog' | 'any' (dog)
  // или 'farmina' | 'monge' | 'hills' | 'happycat' | 'any' (cat)

  // Dog only
  size?: 'mini' | 'small' | 'medium' | 'large' | 'giant'
  activity?: 'low' | 'normal' | 'high'

  // Cat only
  sterilized?: boolean
  lifestyle?: 'indoor' | 'outdoor'
}

// Q0. Стартовый вопрос (общий)
const q0: QuizQuestion = {
  id: 'species',
  branch: 'common',
  question: 'Для кого подбираем корм?',
  options: [
    { value: 'dog', label: 'Для собаки', pet: 'dog' },
    { value: 'cat', label: 'Для кошки', pet: 'cat' },
  ],
}

// === ВЕТКА D — СОБАКА ===

// D1. Возраст
const d1: QuizQuestion = {
  id: 'age',
  branch: 'dog',
  question: 'Сколько лет вашей собаке?',
  options: [
    { value: 'puppy', label: 'Щенок (до 12 мес; для крупных пород — до 18 мес)' },
    { value: 'adult', label: 'Взрослая (1–7 лет)' },
    { value: 'senior', label: 'Пожилая (7+ лет)' },
  ],
}

// D2. Размер
const d2: QuizQuestion = {
  id: 'size',
  branch: 'dog',
  question: 'Какого размера ваша собака?',
  options: [
    { value: 'mini', label: 'Мини (до 5 кг) — той, чихуахуа, йорк' },
    { value: 'small', label: 'Малая (5–10 кг) — шпиц, мопс, джек-рассел' },
    { value: 'medium', label: 'Средняя (10–25 кг) — кокер, бигль, бордер-колли' },
    { value: 'large', label: 'Крупная (25–45 кг) — лабрадор, овчарка, хаски' },
    { value: 'giant', label: 'Гигант (45+ кг) — алабай, дог, сенбернар' },
  ],
}

// D5. Особенности здоровья (множественный выбор)
const d5: QuizQuestion = {
  id: 'health',
  branch: 'dog',
  question: 'Что из этого про вашего питомца? (можно выбрать несколько или ничего)',
  multiple: true,
  options: [
    {
      value: 'digestion',
      label: 'Чувствительное пищеварение',
      description: 'нестабильный стул, срыгивания',
    },
    {
      value: 'skin',
      label: 'Чувствительная кожа, зуд, тусклая шерсть',
    },
    {
      value: 'allergy',
      label: 'Пищевая аллергия / непереносимость',
      description: 'подтверждённая или подозрение',
    },
    {
      value: 'overweight',
      label: 'Есть лишний вес',
    },
    {
      value: 'underweight',
      label: 'Есть недостаток веса — видны рёбра',
    },
    {
      value: 'sterilized',
      label: 'Стерилизована/кастрирован',
    },
    {
      value: 'joints',
      label: 'Проблемы с суставами / крупная порода в зоне риска',
    },
    {
      value: 'none',
      label: 'Ничего из перечисленного',
    },
  ],
}

// D5a. Уточнение аллергии (условный)
const d5a: QuizQuestion = {
  id: 'avoid',
  branch: 'dog',
  question: 'От чего была реакция?',
  multiple: true,
  showIf: (a) => a.health?.includes('allergy') ?? false,
  options: [
    { value: 'chicken', label: 'Курица' },
    { value: 'beef', label: 'Говядина' },
    { value: 'grain', label: 'Зерновые (пшеница, кукуруза)' },
    { value: 'unknown', label: 'Не знаем, но реакция есть' },
  ],
}

// D6. Тип корма
const d6: QuizQuestion = {
  id: 'format',
  branch: 'dog',
  question: 'Какой формат корма предпочитаете?',
  options: [
    { value: 'dry', label: 'Сухой' },
    { value: 'wet', label: 'Влажный' },
    { value: 'mixed', label: 'Сухой + влажный (смешанное кормление)' },
  ],
}

// D7. Вкусовые предпочтения
const d7: QuizQuestion = {
  id: 'flavor',
  branch: 'dog',
  question: 'Какой вкус собака ест охотнее всего?',
  options: [
    { value: 'chicken', label: 'Курица / птица' },
    { value: 'lamb', label: 'Ягнёнок' },
    { value: 'fish', label: 'Рыба (лосось, сельдь)' },
    { value: 'game', label: 'Дичь / кабан / оленина' },
    { value: 'any', label: 'Ест всё — посоветуйте вы' },
  ],
}

// D8. Отношение к составу
const d8: QuizQuestion = {
  id: 'philosophy',
  branch: 'dog',
  question: 'Как относитесь к зерну в корме?',
  options: [
    {
      value: 'any',
      label: 'Не разбираюсь — решите за меня',
    },
    {
      value: 'grainfree',
      label: 'Без зерна, побольше мяса',
      description: 'Похоже на натуральное питание',
    },
    {
      value: 'lowgrain',
      label: 'Немного зерна — так мягче для желудка',
    },
    {
      value: 'classic',
      label: 'Классический состав — сбалансированный, без ограничений',
    },
  ],
}

// D9. Предпочитаемый бренд
const d9: QuizQuestion = {
  id: 'brand',
  branch: 'dog',
  question: 'Есть ли бренд, которому вы уже доверяете?',
  options: [
    { value: 'farmina', label: 'Farmina' },
    { value: 'monge', label: 'Monge' },
    { value: 'hills', label: "Hill's" },
    { value: 'happydog', label: 'Happy Dog' },
    { value: 'any', label: 'Нет предпочтений — подберите лучший вариант', description: 'Так подбор точнее — мы не ограничены одной маркой' },
  ],
}

// === ВЕТКА C — КОШКА ===

// C1. Возраст
const c1: QuizQuestion = {
  id: 'age',
  branch: 'cat',
  question: 'Сколько лет вашей кошке/коту?',
  options: [
    { value: 'kitten', label: 'Котёнок (до 12 мес)' },
    { value: 'adult', label: 'Взрослая кошка / взрослый кот (1–7 лет)' },
    { value: 'senior', label: 'Пожилая кошка / пожилой кот (7+ лет)' },
  ],
}

// C3. Образ жизни
const c3: QuizQuestion = {
  id: 'lifestyle',
  branch: 'cat',
  question: 'Как живёт ваша кошка/кот?',
  options: [
    { value: 'indoor', label: 'Только дома (indoor)' },
    { value: 'outdoor', label: 'Дом + самовыгул / дача летом' },
  ],
}

// C5. Особенности здоровья (множественный выбор)
const c5: QuizQuestion = {
  id: 'health',
  branch: 'cat',
  question: 'Что из этого про вашего питомца? (можно выбрать несколько или ничего)',
  multiple: true,
  options: [
    {
      value: 'digestion',
      label: 'Чувствительное пищеварение',
    },
    {
      value: 'hairball',
      label: 'Частое вылизывание, комки шерсти, рвота шерстью',
    },
    {
      value: 'skin',
      label: 'Чувствительная кожа / тусклая шерсть',
    },
    {
      value: 'allergy',
      label: 'Пищевая аллергия / непереносимость',
    },
    {
      value: 'urinary',
      label:
        'Были проблемы с мочевыделительной системой (МКБ, цистит)',
    },
    {
      value: 'longhair',
      label: 'Длинношёрстная порода (мейн-кун, перс, сибирская)',
    },
    {
      value: 'overweight',
      label: 'Есть лишний вес',
    },
    {
      value: 'underweight',
      label: 'Есть недостаток веса — видны рёбра',
    },
    {
      value: 'sterilized',
      label: 'Стерилизована или кастрирован',
    },
    {
      value: 'none',
      label: 'Ничего из перечисленного',
    },
  ],
}

// C5a. Уточнение аллергии (условный)
const c5a: QuizQuestion = {
  id: 'avoid',
  branch: 'cat',
  question: 'От чего была реакция?',
  multiple: true,
  showIf: (a) => a.health?.includes('allergy') ?? false,
  options: [
    { value: 'chicken', label: 'Курица' },
    { value: 'fish', label: 'Рыба' },
    { value: 'grain', label: 'Зерновые' },
    { value: 'unknown', label: 'Не знаем' },
  ],
}

// C6. Тип корма
const c6: QuizQuestion = {
  id: 'format',
  branch: 'cat',
  question: 'Какой формат корма предпочитаете?',
  options: [
    { value: 'dry', label: 'Сухой' },
    { value: 'wet', label: 'Влажный (паучи, консервы)' },
    { value: 'mixed', label: 'Сухой + влажный' },
  ],
}

// C7. Вкусовые предпочтения
const c7: QuizQuestion = {
  id: 'flavor',
  branch: 'cat',
  question: 'Что ваша кошка/кот ест охотнее всего?',
  options: [
    { value: 'chicken', label: 'Курица / птица' },
    { value: 'fish', label: 'Рыба (лосось, сельдь, треска)' },
    { value: 'game', label: 'Утка / кролик / дичь' },
    {
      value: 'picky',
      label: 'Привередничает, часто отказывается от еды',
    },
    { value: 'any', label: 'Ест всё' },
  ],
}

// C8. Отношение к составу
const c8: QuizQuestion = {
  id: 'philosophy',
  branch: 'cat',
  question: 'Как относитесь к зерну в корме?',
  options: [
    {
      value: 'any',
      label: 'Не разбираюсь — решите за меня',
    },
    {
      value: 'grainfree',
      label: 'Без зерна, побольше мяса',
      description: 'Похоже на натуральное питание',
    },
    {
      value: 'lowgrain',
      label: 'Немного зерна — так мягче для желудка',
    },
    {
      value: 'classic',
      label: 'Классический состав — сбалансированный, без ограничений',
    },
  ],
}

// C9. Предпочитаемый бренд
const c9: QuizQuestion = {
  id: 'brand',
  branch: 'cat',
  question: 'Есть ли бренд, которому вы уже доверяете?',
  options: [
    { value: 'farmina', label: 'Farmina' },
    { value: 'monge', label: 'Monge' },
    { value: 'hills', label: "Hill's" },
    { value: 'happycat', label: 'Happy Cat' },
    { value: 'any', label: 'Нет предпочтений — подберите лучший вариант', description: 'Так подбор точнее — мы не ограничены одной маркой' },
  ],
}

// Все вопросы
export const allQuestions: QuizQuestion[] = [
  q0,
  // Dog
  d1,
  d2,
  d5,
  d5a,
  d6,
  d7,
  d8,
  d9,
  // Cat
  c1,
  c3,
  c5,
  c5a,
  c6,
  c7,
  c8,
  c9,
]

// Получить видимые вопросы для текущего состояния
export function getVisibleQuestions(answers: Partial<QuizAnswers>): QuizQuestion[] {
  const questions = allQuestions.filter((q) => {
    // Q0 всегда видима
    if (q.branch === 'common') return true

    // Если species не выбран — только common вопросы
    if (!answers.species) return false

    // Фильтруем по ветке
    if (q.branch === 'dog' && answers.species === 'dog') {
      // Проверяем showIf
      return !q.showIf || q.showIf(answers)
    }

    if (q.branch === 'cat' && answers.species === 'cat') {
      // Проверяем showIf
      return !q.showIf || q.showIf(answers)
    }

    return false
  })

  return questions
}
