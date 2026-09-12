import type { DeliveryKind, DeliveryOptionKey, AddressSuggestion, PickupPoint, PickupPointProvider } from '@simba/shared'
import axios from 'axios'
import type { QuizAnswers } from './quiz-config'

// ─── HTTP клиент ────────────────────────────────────────────────────────────

// Без явного VITE_API_URL на проде бьём по своему же домену: адрес получается
// относительным, и запрос уходит туда, откуда отдан сайт. На Vercel его
// подхватывает правило перенаправления /api/* на сервер — браузер при этом
// видит только https-адрес витрины, поэтому нет ни mixed content, ни CORS.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3000'),
  withCredentials: true,
  // Массивы — повторяющимся ключом (tags=a&tags=b), а не скобками (tags[]=a).
  // Fastify поднят без своего парсера query, то есть разбирает её парсером Node,
  // а тот скобки не раскрывает: `tags[]=kidney` приходил ключом "tags[]", zod
  // видел tags === undefined и МОЛЧА отбрасывал фильтр — все кнопки быстрых
  // фильтров каталога показывали весь каталог. Чиним на клиенте, а не заплаткой
  // в схеме: так закрыты разом все текущие и будущие массивные параметры.
  paramsSerializer: {
    serialize: (params: Record<string, unknown>) => {
      const search = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item !== undefined && item !== null) search.append(key, String(item))
          }
        } else {
          search.append(key, String(value))
        }
      }
      return search.toString()
    },
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  const guestToken = localStorage.getItem('guestToken')
  const authToken = token || guestToken
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`
  return config
})

// Система обработки 401 через колбэк вместо жёсткого редиректа.
// Приложение регистрирует обработчик, который может вызвать роутер без перезагрузки.
type OnUnauthorizedCallback = () => void | Promise<void>
let onUnauthorizedCallback: OnUnauthorizedCallback | null = null

export function registerUnauthorizedHandler(callback: OnUnauthorizedCallback): void {
  onUnauthorizedCallback = callback
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('token')
      // Если был обычный токен (не гостевой) — уведомить приложение о неавторизации
      if (token) {
        localStorage.removeItem('token')
        if (onUnauthorizedCallback) {
          // Приложение сам решит, куда идти (через роутер, без перезагрузки)
          onUnauthorizedCallback()
        } else {
          // Запасной вариант если колбэк не зарегистрирован
          window.location.href = '/auth'
        }
      } else {
        // Гостевой токен истёк — просто удаляем, не выкидываем гостя
        localStorage.removeItem('guestToken')
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Убедиться, что у гостя есть гостевой токен.
 * Если нет ни обычного токена, ни гостевого — запросить гостевую сессию.
 */
export async function ensureGuestSession(): Promise<void> {
  const token = localStorage.getItem('token')
  const guestToken = localStorage.getItem('guestToken')

  if (token || guestToken) {
    // Уже есть токен
    return
  }

  try {
    const res = await api.post<{ token: string }>('/api/auth/guest-session')
    localStorage.setItem('guestToken', res.data.token)
  } catch {
    // Ошибка при создании гостевой сессии — просто продолжаем, может быть сетевая ошибка
    console.error('Failed to create guest session')
  }
}

// ─── Типы ───────────────────────────────────────────────────────────────────

export type SortValue = 'popular' | 'price_asc' | 'price_desc' | 'newest' | 'in_stock'

export interface ProductVariant {
  id: string
  weight: number
  price: number
  oldPrice: number | null
  stock: number
  sku: string | null
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string
  brand: { id: string; name: string; slug: string } | null
  images: string[]
  isGrainFree: boolean
  isHypoallergenic: boolean
  isWeightControl: boolean
  isFeatured: boolean
  protein: number | null
  fat: number | null
  fiber: number | null
  ash: number | null
  ingredients: string | null
  variants: ProductVariant[]
  categories: { category: { id: string; name: string; slug: string } }[]
}

export interface CartItem {
  id: string
  productVariantId: string
  productId: string
  quantity: number
  isSubscription?: boolean
  subscriptionIntervalDays?: number
  productVariant: ProductVariant & { product: Pick<Product, 'id' | 'name' | 'slug' | 'images'> }
}

export interface Cart {
  id: string
  items: CartItem[]
}

export interface Order {
  id: string
  status: 'new' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled'
  deliveryMethod: string
  subtotal: number
  total: number
  bonusUsed: number
  bonusEarned: number
  promoCode?: string
  paymentStatus: string
  createdAt: string
  items: {
    id: string
    productName: string
    variantWeight: number
    price: number
    quantity: number
  }[]
}

export interface User {
  id: string
  name: string
  email: string | null
  phone: string | null
  bonusPoints: number
  bonusLevel: 'newcomer' | 'active' | 'premium'
  role: string
  isGuest?: boolean
}

/// Службы доставки на витрине. Решение владельца: только 4 способа.
/// На сервере в истории могут быть старые (post, ozon, dostavista), но новые
/// котировки приходят только эти четыре.
export type DeliveryProviderKey =
  | 'simba_courier' | 'cdek' | 'yandex' | 'ozon' | 'pickup'

export interface DeliveryQuote {
  provider: DeliveryProviderKey
  key: DeliveryOptionKey
  /** По виду чекаут решает, что спросить: адрес, пункт на карте или ничего. */
  kind: DeliveryKind
  title: string
  description: string
  price: number
  daysMin: number
  daysMax: number
  available: boolean
  error?: string
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  sendOtp: (email: string) =>
    api.post('/api/auth/send-otp', { email }),

  verifyOtp: (email: string, code: string, guestToken?: string) => {
    const body: { email: string; code: string; guestToken?: string } = { email, code }
    if (guestToken) body.guestToken = guestToken
    return api.post<{ token: string; user: User; bonusGranted?: number; cartMerged?: boolean }>('/api/auth/verify-otp', body)
  },

  me: () =>
    api.get<User>('/api/auth/me'),
}

// ─── Пользователи ────────────────────────────────────────────────────────────

export const usersApi = {
  updateProfile: (data: { name?: string; phone?: string; email?: string }) =>
    api.put<User>('/api/users/profile', data),
}

// ─── Товары ──────────────────────────────────────────────────────────────────

export const productsApi = {
  list: (params?: {
    search?: string
    category?: string
    brand?: string
    format?: 'dry' | 'wet'
    purpose?: 'medical'
    species?: 'cat' | 'dog'
    tags?: string[]
    sort?: SortValue
    page?: number
    limit?: number
    featured?: 'true' | 'false'
  }) => api.get<{ items: Product[]; total: number; page: number; totalPages: number }>('/api/products/list', { params }),

  popular: (limit?: number) =>
    api.get<{ items: Product[]; basis: 'sales' | 'curated' }>('/api/products/popular', { params: { limit } }),

  bySlug: (slug: string) =>
    api.get<Product>(`/api/products/${slug}`),

  related: (slug: string) =>
    api.get<Product[]>(`/api/products/${slug}/related`),
}

// ─── Категории ───────────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  slug: string
}

export const categoriesApi = {
  tree: () =>
    api.get<Category[]>('/api/categories/tree'),
}

// ─── Бренды ──────────────────────────────────────────────────────────────────

export interface Brand {
  id: string
  name: string
  slug: string
  logo: string | null
  accentColor: string | null
  logoFit: 'wide' | 'mid' | 'mark' | null
  productCount: number
}

export interface Banner {
  id: string
  title: string
  subtitle: string | null
  image: string
  /** Отдельная картинка для телефона. Пусто — показываем десктопную. */
  imageMobile: string | null
  /** Накладывать ли заголовок, подпись и кнопку поверх картинки. */
  showText: boolean
  link: string | null
  buttonText: string | null
}

export const bannersApi = {
  /// Главная берёт баннеры отсюда, а не из массива в компоненте: владелец
  /// меняет их сам через админку.
  list: (params?: { page?: string; position?: string }) =>
    api.get<Banner[]>('/api/banners', { params }),
}

export const brandsApi = {
  list: () =>
    api.get<Brand[]>('/api/brands'),
}

// ─── Избранное ───────────────────────────────────────────────────────────────

export interface Favorite {
  userId: string
  productId: string
  createdAt: string
  product: Product
}

export const favoritesApi = {
  getAll: async () => {
    await ensureGuestSession()
    return api.get<Favorite[]>('/api/favorites')
  },

  add: async (productId: string) => {
    await ensureGuestSession()
    return api.post<Favorite>(`/api/favorites/${productId}`)
  },

  remove: async (productId: string) => {
    await ensureGuestSession()
    return api.delete(`/api/favorites/${productId}`)
  },
}

// ─── Корзина ─────────────────────────────────────────────────────────────────

export const cartApi = {
  get: async () => {
    await ensureGuestSession()
    return api.get<Cart>('/api/cart')
  },

  addItem: async (
    productVariantId: string,
    quantity = 1,
    options?: { isSubscription?: boolean; intervalWeeks?: number }
  ) => {
    await ensureGuestSession()
    const data: any = { productVariantId, quantity }
    if (options?.isSubscription) {
      data.isSubscription = true
      if (options.intervalWeeks) {
        data.subscriptionIntervalDays = options.intervalWeeks * 7
      }
    }
    return api.post<Cart>('/api/cart/items', data)
  },

  updateItem: async (cartItemId: string, quantity: number, options?: { isSubscription?: boolean; intervalWeeks?: number }) => {
    await ensureGuestSession()
    const data: any = { quantity }
    if (options?.isSubscription !== undefined) {
      data.isSubscription = options.isSubscription
      if (options.isSubscription && options.intervalWeeks) {
        data.subscriptionIntervalDays = options.intervalWeeks * 7
      }
    }
    return api.put<Cart>(`/api/cart/items/${cartItemId}`, data)
  },

  removeItem: async (cartItemId: string) => {
    await ensureGuestSession()
    return api.delete<Cart>(`/api/cart/items/${cartItemId}`)
  },

  clear: async () => {
    await ensureGuestSession()
    return api.delete('/api/cart')
  },
}

// ─── Заказы ──────────────────────────────────────────────────────────────────

export const ordersApi = {
  list: () =>
    api.get<Order[]>('/api/orders'),

  byId: (id: string) =>
    api.get<Order>(`/api/orders/${id}`),

  create: (data: {
    cartId: string
    deliveryMethod: 'simba_courier' | 'cdek' | 'yandex' | 'ozon' | 'pickup'
    deliveryAddress?: { city: string; street?: string; house?: string; apartment?: string; entrance?: string; floor?: string; intercom?: string; addressType?: 'apartment' | 'house'; postalCode?: string; lat?: number; lon?: number }
    deliveryPoint?: PickupPoint
    comment?: string
    hasSpecialPackaging?: boolean
    bonusUsed?: number
    promoCode?: string
    deliveryCost?: number
    paymentMethod?: 'card' | 'cash_on_delivery'
    contact?: { name?: string; email?: string; phone?: string }
  }) => api.post<Order>('/api/orders', data),
}

// ─── Адреса ──────────────────────────────────────────────────────────────────

export const addressApi = {
  suggest: (query: string) =>
    api.post<{ suggestions: AddressSuggestion[] }>('/api/address/suggest', { query }),
}

// ─── Доставка ────────────────────────────────────────────────────────────────

export const deliveryApi = {
  options: () =>
    api.get<{ options: Array<{ key: DeliveryOptionKey; kind: DeliveryKind; title: string; subtitle: string | null; price: number }> }>('/api/delivery/options'),

  features: () =>
    api.get<{ suggest: boolean; map: boolean }>('/api/delivery/features'),

  quotes: (params: {
    city: string
    street?: string
    house?: string
    postalCode?: string
    /// Координаты приходят с карты. Яндекс.Доставка без них не считает —
    /// раньше она молча подставляла центр Москвы и называла чужую цену.
    lat?: number
    lon?: number
    pickupPoint?: PickupPoint
    weightKg: number
  }) => api.post<{ quotes: DeliveryQuote[] }>('/api/delivery/quotes', params),

  pickupPoints: (params: { provider: PickupPointProvider; city: string; lat?: number; lon?: number }) =>
    api.get<{ points: PickupPoint[] }>('/api/delivery/pickup-points', { params }),

  createOrder: (data: {
    provider: string
    orderId: string
    address: object
    weightKg: number
    recipientName: string
    recipientPhone: string
  }) => api.post('/api/delivery/create', data),
}

// ─── Бонусы ──────────────────────────────────────────────────────────────

export interface BonusTransaction {
  id: string
  type: 'welcome' | 'earned' | 'spent' | 'refund_used' | 'revoke_earned' | 'admin_adjust'
  amount: number
  balanceAfter: number
  comment: string | null
  createdAt: string
  orderId: string | null
}

export const bonusesApi = {
  transactions: () =>
    api.get<BonusTransaction[]>('/api/bonuses/transactions'),
}

// ─── Квиз ────────────────────────────────────────────────────────────────

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
  bonus: { amount: number; status: 'granted' | 'already_granted' | 'guest'; balance: number | null }
}

export const quizApi = {
  match: (answers: Partial<QuizAnswers>) =>
    api.post<QuizMatchResponse>('/api/quiz/match', answers),

  getSession: (id: string) =>
    api.get<QuizMatchResponse>(`/api/quiz/${id}`),

  claimBonus: (sessionId: string) =>
    api.post<{ granted: boolean; amount: number; balance: number }>('/api/quiz/claim', { sessionId }),
}

// ─── Подписки ───────────────────────────────────────────────────────────────

export interface Subscription {
  id: string
  userId: string
  productVariantId: string
  productId: string
  intervalDays: number
  nextDeliveryAt: string
  deliveryMethod: string
  deliveryAddress: object | null
  isPaused: boolean
  isActive: boolean
  paymentMethodId: string | null
  createdAt: string
  product?: Product
  productVariant?: ProductVariant
}

export const subscriptionsApi = {
  list: () =>
    api.get<Subscription[]>('/api/subscriptions'),

  update: (id: string, patch: Partial<{ isPaused: boolean; nextDeliveryAt: string; intervalDays: number; productVariantId: string; deliveryMethod: string; deliveryAddress: object }>) =>
    api.patch<Subscription>(`/api/subscriptions/${id}`, patch),

  skip: (id: string) =>
    api.post<Subscription>(`/api/subscriptions/${id}/skip`),

  cancel: (id: string) =>
    api.delete<void>(`/api/subscriptions/${id}`),
}
