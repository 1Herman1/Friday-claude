import type { Concern, SkinType } from '../../../../../node_modules/.prisma/ps-client/index.js'

/**
 * Таблица соответствия русских подписей типов кожи к Enum SkinType.
 * Используется в сиде и импортах.
 */
export const SKIN_TYPES_MAP: Record<string, SkinType[]> = {
  'Нормальная': ['normal'],
  'Сухая': ['dry'],
  'Чувствительная': ['sensitive'],
  'Жирная / Проблемная / Комбинированная': ['oily', 'combination'],
  'Возрастная': ['mature'],
  'Для всех типов кожи': ['all_types'],
}

/**
 * Таблица соответствия русских названий забот (keyNeeds) к Enum Concern.
 * Используется в сиде.
 */
export const NEEDS_MAP: Record<string, Concern> = {
  'Увлажнение': 'hydration',
  'Укрепление и лифтинг': 'firming',
  'Регенерация': 'regeneration',
  'Придание сияния коже': 'radiance',
  'Выравнивание цвета и рельефа': 'pigmentation',
  'Себорегуляция': 'sebum_control',
  'Глубокое очищение и детоксикация': 'cleansing',
  'Гигиена': 'hygiene',
  'Снятие признаков раздражения кожи': 'sensitivity',
  'Повышение защитных свойств кожи': 'barrier',
  'Ежедневный уход': 'daily_care',
  'Экспресс-уход': 'express_care',
  'Интенсивный уход': 'intensive_care',
  'Питание': 'nourishing',
}
