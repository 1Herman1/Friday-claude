export interface QuizOption {
  value: string
  label: string
  description?: string
}

export interface QuizQuestion {
  id: string
  question: string
  multiple?: boolean
  showIf?: (answers: Partial<QuizAnswers>) => boolean
  options: QuizOption[]
}

export interface QuizAnswers {
  audience?: 'self' | 'man'
  skin?: 'oily' | 'combination' | 'normal' | 'dry' | 'sensitive' | 'unknown'
  need?: string // одно из needs labels
  extras?: string[] // подмножество ['eye_area', 'sun_protection', 'cleansing']
  format?: 'full' | 'core'
  isPregnant?: boolean // только для хранения в состоянии клиента
}

// Q1. Для кого подбираем уход?
const q1: QuizQuestion = {
  id: 'audience',
  question: 'Для кого подбираем уход?',
  options: [
    { value: 'self', label: 'Для себя' },
    { value: 'man', label: 'Для мужчины' },
  ],
}

// Q2. Ваш тип кожи
const q2: QuizQuestion = {
  id: 'skin',
  question: 'Ваш тип кожи',
  options: [
    { value: 'oily', label: 'Жирная' },
    { value: 'combination', label: 'Комбинированная' },
    { value: 'normal', label: 'Нормальная' },
    { value: 'dry', label: 'Сухая' },
    { value: 'sensitive', label: 'Чувствительная' },
    { value: 'unknown', label: 'Не знаю' },
  ],
}

// Q3. Беременность или кормление
const q3: QuizQuestion = {
  id: 'isPregnant',
  question: 'Вы беременны или кормите грудью?',
  options: [
    { value: 'yes', label: 'Да' },
    { value: 'no', label: 'Нет' },
    { value: 'prefer_not', label: 'Не хочу отвечать' },
  ],
}

// Q4. Главная задача
const q4: QuizQuestion = {
  id: 'need',
  question: 'Главная задача',
  options: [
    { value: 'hydration', label: 'Увлажнение' },
    { value: 'firming', label: 'Укрепление и лифтинг' },
    { value: 'radiance', label: 'Придание сияния коже' },
    { value: 'pigmentation', label: 'Выравнивание цвета и рельефа' },
    { value: 'sebum_control', label: 'Себорегуляция' },
    { value: 'sensitivity', label: 'Снятие признаков раздражения' },
    { value: 'regeneration', label: 'Регенерация' },
    { value: 'nourishing', label: 'Питание' },
  ],
}

// Q5. Что ещё важно? (multi)
const q5: QuizQuestion = {
  id: 'extras',
  question: 'Что ещё важно?',
  multiple: true,
  options: [
    { value: 'eye_area', label: 'Зона вокруг глаз' },
    { value: 'sun_protection', label: 'Защита от солнца' },
    { value: 'cleansing', label: 'Глубокое очищение' },
    { value: 'none', label: 'Ничего из этого' },
  ],
}

// Q6. Какой формат?
const q6: QuizQuestion = {
  id: 'format',
  question: 'Какой формат?',
  options: [
    { value: 'full', label: 'Полная программа ухода' },
    { value: 'core', label: 'Только основное (сыворотка и крем)' },
  ],
}

export const allQuestions: QuizQuestion[] = [q1, q2, q3, q4, q5, q6]

export function getVisibleQuestions(answers: Partial<QuizAnswers>): QuizQuestion[] {
  return allQuestions.filter((q) => {
    if (q.showIf) {
      return q.showIf(answers)
    }
    return true
  })
}
