import type { SkinType, Concern, DeliveryMethod, OrderStatus, PaymentStatus } from './db.js'

export const SKIN_TYPES: Record<SkinType, string> = {
  normal: 'Нормальная',
  dry: 'Сухая',
  oily: 'Жирная / проблемная',
  combination: 'Комбинированная',
  sensitive: 'Чувствительная',
  mature: 'Возрастная',
  all_types: 'Для всех типов кожи',
}

export const CONCERNS: Record<Concern, string> = {
  hydration: 'Увлажнение',
  firming: 'Укрепление и лифтинг',
  regeneration: 'Регенерация',
  radiance: 'Придание сияния коже',
  pigmentation: 'Выравнивание цвета и рельефа',
  sebum_control: 'Себорегуляция',
  cleansing: 'Глубокое очищение и детоксикация',
  hygiene: 'Гигиена',
  sensitivity: 'Снятие признаков раздражения',
  barrier: 'Повышение защитных свойств',
  daily_care: 'Ежедневный уход',
  express_care: 'Экспресс-уход',
  intensive_care: 'Интенсивный уход',
  nourishing: 'Питание',
  anti_age: 'Антивозрастной уход',
  acne: 'Проблемная кожа',
  redness: 'Покраснения',
  sun_protection: 'Защита от солнца',
  eye_area: 'Зона вокруг глаз',
  post_procedure: 'Постпроцедурный уход',
}

export const DELIVERY_METHODS: Record<DeliveryMethod, { title: string; hint: string }> = {
  pickup: {
    title: 'Самовывоз',
    hint: 'Москва, Звенигородское шоссе, 3Ас1',
  },
  cdek_pvz: {
    title: 'СДЭК — пункт выдачи или постамат',
    hint: 'Бесплатно от 6 000 ₽',
  },
  cdek_courier: {
    title: 'СДЭК — курьер',
    hint: 'Бесплатно от 10 000 ₽',
  },
}

export const ORDER_STATUSES: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  packed: 'Упакован',
  in_transit: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}

export const PAYMENT_STATUSES: Record<PaymentStatus, string> = {
  pending: 'Ожидание оплаты',
  paid: 'Оплачено',
  failed: 'Ошибка оплаты',
  refunded: 'Возвращено',
}
