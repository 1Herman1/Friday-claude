import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PeriodData {
  from: string
  to: string
  orders: number
  revenue: number
  newUsers: number
  activeGuests: number
  visits: number
  quizSessions: number
}

export interface ChartSeries {
  date: string
  orders: number
  revenue: number
  visits: number
}

export interface DashboardStats {
  ordersToday: number
  ordersMonth: number
  revenueToday: number
  revenueMonth: number
  totalUsers: number
  newUsersToday: number
  totalProducts: number
  recentOrders: Order[]
  period?: PeriodData
  series?: ChartSeries[]
}

export interface ProductVariant {
  id: string
  weight: number
  price: number
  oldPrice?: number
  stock: number
  sku?: string
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string
  brandId?: string
  brand?: { id: string; name: string; slug: string } | null
  images: string[]
  isActive: boolean
  isGrainFree: boolean
  isHypoallergenic: boolean
  isWeightControl: boolean
  isFeatured: boolean
  protein?: number
  fat?: number
  fiber?: number
  ash?: number
  ingredients?: string
  seoTitle?: string
  seoDescription?: string
  variants: ProductVariant[]
  categories: { categoryId: string }[]
  createdAt: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  parentId?: string
  isActive: boolean
  sortOrder: number
  seoTitle?: string
  seoDescription?: string
}

export interface CategoryNode extends Category {
  productCount: number
  children: CategoryNode[]
}

export interface Brand {
  id: string
  name: string
  slug: string
  logo?: string
  accentColor?: string | null
  logoFit?: 'wide' | 'mid' | 'mark' | null
  description?: string
  _count?: { products: number }
}

export interface Banner {
  id: string
  title: string
  subtitle?: string
  image: string
  /** Отдельная картинка для телефона. Пусто — телефон получит десктопную. */
  imageMobile?: string
  /** Накладывать ли заголовок, подпись и кнопку поверх картинки. */
  showText: boolean
  link?: string
  buttonText?: string
  page: 'home' | 'catalog' | 'other'
  position: 'main_slider' | 'promo_strip' | 'sidebar'
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export interface DeliveryOption {
  key: string
  title: string
  subtitle: string | null
  price: number
  expense?: number
  etaMin: number | null
  etaMax: number | null
  freeFrom: number | null
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

export type BlogStatus = 'draft' | 'published'
export const BLOG_CATEGORIES = ['Сравнения кормов', 'Питание', 'Здоровье', 'Кошки', 'Собаки', 'Ветдиеты'] as const

export interface BlogPostRow {
  id: string
  slug: string
  title: string
  subtitle: string | null
  categories: string[]
  date: string
  readingMinutes: number
  status: BlogStatus
  cover: string | null
  updatedAt: string
}

export interface BlogPost extends BlogPostRow {
  body: string
  metaTitle: string | null
  metaDescription: string | null
}

export interface SiteTextItem {
  key: string
  label: string
  group: string
  defaultValue: string
  value: string
  isOverridden: boolean
}

export interface OrderItem {
  id: string
  productName: string
  variantWeight: number
  price: number
  quantity: number
}

export interface Order {
  id: string
  status: string
  deliveryMethod?: string
  deliveryPoint?: { id: string; name: string; address: string }
  deliveryCost?: number
  deliveryExpense?: number | null
  deliveryExpenseNote?: string | null
  subtotal: number
  total: number
  bonusUsed: number
  bonusEarned: number
  promoCode?: string
  paymentStatus: string
  createdAt: string
  user?: { id: string; name?: string; email?: string; phone?: string }
  items: OrderItem[]
}

export interface User {
  id: string
  name?: string
  email?: string
  phone?: string
  role: string
  bonusPoints: number
  bonusLevel: string
  createdAt: string
  lastSeenAt: string
  isGuest: boolean
  cartItems: number
  _count?: { orders: number; favorites: number; quizSessions: number }
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

// ─── API methods ──────────────────────────────────────────────────────────────

export const authApi = {
  adminLogin: (username: string, password: string) =>
    api.post<{
      token: string
      user: { id: string; email?: string; phone?: string; name: string; role: string; bonusPoints: number; bonusLevel: string }
    }>('/api/auth/admin-login', { username, password }),
  me: () => api.get<{ userId: string; role: string; name?: string }>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/api/auth/change-password', { currentPassword, newPassword }),
}

export const dashboardApi = {
  stats: (period?: 'week' | 'month' | 'year') => {
    const params = period ? { period } : {}
    return api.get<DashboardStats>('/api/admin/dashboard', { params })
  },
}

export const productsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Product>>('/api/products/list', { params }),
  byId: (id: string) => api.get<Product>(`/api/admin/products/${id}`),
  create: (data: unknown) => api.post<Product>('/api/admin/products', data),
  update: (id: string, data: unknown) => api.put<Product>(`/api/admin/products/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/products/${id}`),
  importCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{
      created: number
      updated: number
      skippedNoPrice: string[]
      skippedNonProduct: string[]
      createdBrands: string[]
      createdCategories: string[]
      errors: string[]
    }>('/api/admin/import/csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const categoriesApi = {
  list: () => api.get<{ items: CategoryNode[] }>('/api/admin/categories'),
  create: (data: unknown) => api.post<CategoryNode>('/api/admin/categories', data),
  update: (id: string, data: unknown) => api.put<CategoryNode>(`/api/admin/categories/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/categories/${id}`),
  reorder: (items: Array<{ id: string; parentId?: string; sortOrder: number }>) =>
    api.put('/api/admin/categories/reorder', { items }),
}

export const brandsApi = {
  list: () => api.get<Brand[]>('/api/admin/brands'),
  create: (data: unknown) => api.post<Brand>('/api/admin/brands', data),
  update: (id: string, data: unknown) => api.put<Brand>(`/api/admin/brands/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/brands/${id}`),
}

export const ordersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Order>>('/api/admin/orders', { params }),
  byId: (id: string) => api.get<Order>(`/api/admin/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api.put<Order>(`/api/admin/orders/${id}/status`, { status }),
  updatePayment: (id: string, paymentStatus: 'paid' | 'failed' | 'refunded') =>
    api.put<Order>(`/api/admin/orders/${id}/payment`, { paymentStatus }),
  recomputeDeliveryExpense: (id: string) =>
    api.post<{ deliveryExpense: number | null; deliveryExpenseNote: string | null }>(`/api/admin/orders/${id}/delivery-expense/recompute`, {}),
}

export const usersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<User>>('/api/admin/users', { params }),
  updateRole: (id: string, role: string) =>
    api.put(`/api/admin/users/${id}/role`, { role }),
  resetPassword: (id: string, newPassword: string) =>
    api.put(`/api/admin/users/${id}/password`, { newPassword }),
}

export const bannersApi = {
  list: () => api.get<Banner[]>('/api/admin/banners'),
  create: (data: unknown) => api.post<Banner>('/api/admin/banners', data),
  update: (id: string, data: unknown) => api.put<Banner>(`/api/admin/banners/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/banners/${id}`),
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ key: string; url: string }>('/api/admin/banners/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const deliveryOptionsApi = {
  list: () => api.get<DeliveryOption[]>('/api/admin/delivery-options'),
  update: (key: string, data: unknown) => api.patch<DeliveryOption>(`/api/admin/delivery-options/${key}`, data),
}

export const blogApi = {
  list: (params?: { status?: BlogStatus; search?: string; page?: number; limit?: number }) =>
    api.get<{ items: BlogPostRow[]; total: number; page: number; totalPages: number }>('/api/admin/blog', { params }),
  byId: (id: string) => api.get<BlogPost>(`/api/admin/blog/${id}`),
  create: (data: unknown) => api.post<BlogPost>('/api/admin/blog', data),
  update: (id: string, data: unknown) => api.put<BlogPost>(`/api/admin/blog/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/blog/${id}`),
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ key: string; url: string }>('/api/admin/blog/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const siteTextsApi = {
  list: () => api.get<{ items: SiteTextItem[] }>('/api/admin/site-texts'),
  update: (key: string, value: string) => api.put<SiteTextItem>(`/api/admin/site-texts/${encodeURIComponent(key)}`, { value }),
  reset: (key: string) => api.post<SiteTextItem>(`/api/admin/site-texts/reset/${encodeURIComponent(key)}`),
}

export interface SyncRunExample {
  variantId: string
  name: string
  oldPrice: number
  newPrice: number
  oldStock: number
  newStock: number
  skipReason?: string
}

export interface SyncRunReport {
  aborted?: boolean
  abortReason?: string
  receivedFromMs: number
  matched: number
  pricesUpdated: number
  stocksUpdated: number
  productsActivated: number
  skippedZeroPriceCount: number
  skippedPriceDropCount: number
  notFoundInMs: number
  examples: {
    zeroCost: Array<{ variantId: string; name: string }>
    skippedPriceDrop: SyncRunExample[]
    notFoundInMs: Array<{ variantId: string; name: string }>
    onlyInMs: Array<{ variantId: string; name: string }>
    ambiguous: Array<{ variantId: string; name: string; matches: string[] }>
  }
}

export interface SyncRun {
  id: string
  trigger: 'cron' | 'admin' | 'manual'
  status: 'running' | 'success' | 'failed' | 'aborted'
  dryRun: boolean
  startedAt: string
  finishedAt?: string
  itemsFromMs: number
  matched: number
  priceUpdated: number
  stockUpdated: number
  productsActivated: number
  missingInMs: number
  skipped: number
  error?: string
  report?: SyncRunReport
}

export interface SyncStatusResponse {
  last?: SyncRun
  lastSuccess?: SyncRun
  history: SyncRun[]
}

export const syncApi = {
  status: () => api.get<SyncStatusResponse>('/api/admin/sync/moysklad'),
  run: (dryRun: boolean) => api.post<{ runId: string }>('/api/admin/sync/moysklad', { dryRun }),
  get: (id: string) => api.get<SyncRun>(`/api/admin/sync/moysklad/${id}`),
}
