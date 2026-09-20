import { fetchApi } from './api'

/**
 * Тип заказа на странице админа
 */
export interface AdminOrder {
  id: string
  number: string
  createdAt: string
  status: string
  user: {
    name: string
    phone: string
    email?: string
  }
  total: number
  adminNote?: string
  paymentStatus?: string
  deliveryTrackNumber?: string
}

/**
 * Детальный заказ администратора
 */
export interface AdminOrderDetail extends AdminOrder {
  items: {
    productName: string
    brandName?: string | null
    volumeLabel?: string | null
    price: number
    quantity: number
    lineTotal: number
  }[]
  subtotal: number
  discount?: number
  deliveryCost: number
  deliveryMethod: string
  address?: {
    city: string
    street: string
    house: string
    apartment?: string | null
    index: string
  }
  pvzCode?: string
  comment?: string
}

/**
 * Список заказов с фильтрацией
 */
export interface AdminOrdersResponse {
  items: AdminOrder[]
  total: number
  skip: number
  limit: number
}

/**
 * Вариант товара (для админки)
 */
export interface AdminVariant {
  id: string
  productId: string
  product: {
    id: string
    name: string
    slug: string
    isProfessional?: boolean
    brand: {
      id: string
      name: string
    } | null
  }
  volumeValue: number
  volumeUnit: 'ml' | 'g' | 'pcs'
  volumeLabel: string | null
  retailPrice: number
  oldRetailPrice: number | null
  wholesalePrice?: number | null
  stock: number
  sku: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Товар для админки
 */
export interface AdminProduct {
  id: string
  slug: string
  name: string
  brand: string
  description?: string
  variants: AdminVariant[]
  isActive: boolean
  isProfessional?: boolean
}

/**
 * Ответ дашборда
 */
export interface AdminDashboardData {
  ordersByStatus: {
    new: number
    confirmed: number
    packed: number
    in_transit: number
    delivered: number
    cancelled: number
  }
  revenue: {
    today: number
    week: number
    month: number
  }
  recentOrders: Array<{
    id: string
    number: string
    createdAt: string
    recipientName: string
    total: number
    status: string
    paymentStatus: string
  }>
  lowStock: Array<{
    variantId: string
    productName: string
    volumeLabel: string
    stock: number
  }>
  salesByDay: Array<{
    date: string
    ordersCount: number
    revenue: number
  }>
}

// ============ Функции API ============

/**
 * Получить список заказов
 */
export async function adminListOrders(
  params?: {
    status?: string
    search?: string
    skip?: number
    limit?: number
  }
): Promise<AdminOrdersResponse> {
  const query = new URLSearchParams()
  if (params?.status) query.append('status', params.status)
  if (params?.search) query.append('search', params.search)
  if (params?.skip !== undefined) query.append('skip', String(params.skip))
  if (params?.limit !== undefined) query.append('limit', String(params.limit))

  const url = `/api/v1/admin/orders${query.toString() ? `?${query.toString()}` : ''}`
  return fetchApi<AdminOrdersResponse>(url)
}

/**
 * Получить заказ по номеру
 */
export async function adminGetOrder(number: string): Promise<AdminOrderDetail> {
  return fetchApi<AdminOrderDetail>(`/api/v1/admin/orders/${encodeURIComponent(number)}`)
}

/**
 * Обновить заказ
 */
export async function adminUpdateOrder(
  number: string,
  body: {
    status?: string
    adminNote?: string
    paymentStatus?: string
    deliveryTrackNumber?: string
  }
): Promise<AdminOrderDetail> {
  return fetchApi<AdminOrderDetail>(
    `/api/v1/admin/orders/${encodeURIComponent(number)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  )
}

/**
 * Получить варианты товаров (постраничное)
 */
export async function adminListVariants(
  params?: {
    search?: string
    isActive?: boolean
    lowStock?: boolean
    offset?: number
    limit?: number
  }
): Promise<{
  items: AdminVariant[]
  total: number
  limit: number
  offset: number
}> {
  const query = new URLSearchParams()
  if (params?.search) query.append('search', params.search)
  if (params?.isActive !== undefined) query.append('isActive', String(params.isActive))
  if (params?.lowStock !== undefined) query.append('lowStock', String(params.lowStock))
  if (params?.offset !== undefined) query.append('offset', String(params.offset))
  if (params?.limit !== undefined) query.append('limit', String(params.limit))

  const url = `/api/v1/admin/variants${query.toString() ? `?${query.toString()}` : ''}`
  return fetchApi<{ items: AdminVariant[]; total: number; limit: number; offset: number }>(url)
}

/**
 * Обновить вариант товара
 */
export async function adminUpdateVariant(
  id: string,
  body: {
    stock?: number
    retailPrice?: number
    wholesalePrice?: number
    isActive?: boolean
  }
): Promise<AdminVariant> {
  return fetchApi<AdminVariant>(
    `/api/v1/admin/variants/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  )
}

/**
 * Обновить товар
 */
export async function adminUpdateProduct(
  id: string,
  body: {
    name?: string
    description?: string
    isActive?: boolean
    isFeatured?: boolean
    isProfessional?: boolean
  }
): Promise<AdminProduct> {
  return fetchApi<AdminProduct>(
    `/api/v1/admin/products/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  )
}

/**
 * Получить данные дашборда
 */
export async function adminDashboard(): Promise<AdminDashboardData> {
  return fetchApi<AdminDashboardData>('/api/v1/admin/dashboard')
}

// ============ Партнёры и промокоды ============

export interface AdminPartner {
  id: string
  name: string
  contact: string | null
  commissionPercent: number
  isActive: boolean
  codesCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminPromoCode {
  id: string
  code: string
  percent: number
  partner: { id: string; name: string } | null
  maxRedemptions: number | null
  usedCount: number
  minOrderAmount: number | null
  startsAt: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

export interface PayoutReportRow {
  partnerId: string
  partnerName: string
  commissionPercent: number
  ordersCount: number
  paidOrdersCount: number
  revenue: number
  clientDiscount: number
  payout: number
}

export interface PayoutReport {
  rows: PayoutReportRow[]
  totals: {
    ordersCount: number
    paidOrdersCount: number
    revenue: number
    clientDiscount: number
    payout: number
  }
}

/**
 * Получить список партнёров
 */
export async function adminListPartners(): Promise<AdminPartner[]> {
  return fetchApi<AdminPartner[]>('/api/v1/admin/partners')
}

/**
 * Создать партнёра
 */
export async function adminCreatePartner(body: {
  name: string
  contact?: string
  commissionPercent: number
}): Promise<AdminPartner> {
  return fetchApi<AdminPartner>('/api/v1/admin/partners', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Обновить партнёра
 */
export async function adminUpdatePartner(
  id: string,
  body: {
    name?: string
    contact?: string
    commissionPercent?: number
    isActive?: boolean
  }
): Promise<AdminPartner> {
  return fetchApi<AdminPartner>(
    `/api/v1/admin/partners/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  )
}

/**
 * Получить список промокодов
 */
export async function adminListPromoCodes(): Promise<AdminPromoCode[]> {
  return fetchApi<AdminPromoCode[]>('/api/v1/admin/promo-codes')
}

/**
 * Создать промокод
 */
export async function adminCreatePromoCode(body: {
  code: string
  percent: number
  partnerId?: string
  maxRedemptions?: number
  minOrderAmount?: number
  startsAt?: string
  expiresAt?: string
}): Promise<AdminPromoCode> {
  return fetchApi<AdminPromoCode>('/api/v1/admin/promo-codes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Обновить промокод
 */
export async function adminUpdatePromoCode(
  id: string,
  body: {
    percent?: number
    partnerId?: string | null
    isActive?: boolean
    maxRedemptions?: number | null
    minOrderAmount?: number | null
    startsAt?: string
    expiresAt?: string
  }
): Promise<AdminPromoCode> {
  return fetchApi<AdminPromoCode>(
    `/api/v1/admin/promo-codes/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  )
}

/**
 * Получить отчёт по выплатам партнёрам
 */
export async function adminGetPayoutReport(from: string, to: string): Promise<PayoutReport> {
  const query = new URLSearchParams()
  query.append('from', from)
  query.append('to', to)

  return fetchApi<PayoutReport>(`/api/v1/admin/partners/report?${query.toString()}`)
}

// ============ Статьи (Posts) ============

export interface AdminPost {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body: string
  coverImage: string | null
  audience: 'public' | 'retail'
  seoTitle: string | null
  seoDescription: string | null
  publishedAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminPostsListResponse {
  items: AdminPost[]
  total: number
  limit: number
  offset: number
}

/**
 * Получить список статей (админ)
 */
export async function fetchAdminPosts(params?: {
  published?: boolean
  limit?: number
  offset?: number
}): Promise<AdminPostsListResponse> {
  const query = new URLSearchParams()
  if (params?.published !== undefined) query.append('published', String(params.published))
  if (params?.limit !== undefined) query.append('limit', String(params.limit))
  if (params?.offset !== undefined) query.append('offset', String(params.offset))

  const url = `/api/v1/admin/posts${query.toString() ? `?${query.toString()}` : ''}`
  return fetchApi<AdminPostsListResponse>(url)
}

/**
 * Получить статью по ID (админ)
 */
export async function fetchAdminPostDetail(id: string): Promise<AdminPost> {
  return fetchApi<AdminPost>(`/api/v1/admin/posts/${encodeURIComponent(id)}`)
}

/**
 * Создать статью
 */
export async function createAdminPost(body: {
  title: string
  slug: string
  body: string
  excerpt?: string
  coverImage?: string
  audience?: 'public' | 'retail'
  seoTitle?: string
  seoDescription?: string
  publishedAt?: string | null
}): Promise<AdminPost> {
  return fetchApi<AdminPost>('/api/v1/admin/posts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Обновить статью
 */
export async function updateAdminPost(
  id: string,
  body: {
    title?: string
    slug?: string
    body?: string
    excerpt?: string | null
    coverImage?: string | null
    audience?: 'public' | 'retail'
    seoTitle?: string | null
    seoDescription?: string | null
    publishedAt?: string | null
    isActive?: boolean
  }
): Promise<AdminPost> {
  return fetchApi<AdminPost>(
    `/api/v1/admin/posts/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  )
}

/**
 * Удалить статью (soft delete)
 */
export async function deleteAdminPost(id: string): Promise<void> {
  return fetchApi<void>(`/api/v1/admin/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/**
 * Получить список опубликованных статей (публик)
 */
export async function fetchPublicPosts(params?: {
  limit?: number
  offset?: number
}): Promise<AdminPostsListResponse> {
  const query = new URLSearchParams()
  if (params?.limit !== undefined) query.append('limit', String(params.limit))
  if (params?.offset !== undefined) query.append('offset', String(params.offset))

  const url = `/api/v1/posts${query.toString() ? `?${query.toString()}` : ''}`
  return fetchApi<AdminPostsListResponse>(url)
}

export interface PublicPost extends AdminPost {
  products: Array<{
    id: string
    slug: string
    name: string
    image: string | null
    minPrice: number
    brand: { id: string; name: string; slug: string } | null
  }>
}

/**
 * Получить опубликованную статью по слагу (публик)
 */
export async function fetchPublicPostBySlug(slug: string): Promise<PublicPost> {
  return fetchApi<PublicPost>(`/api/v1/posts/${encodeURIComponent(slug)}`)
}

/**
 * Поиск товаров (публик) для вставки в статью
 */
export async function searchPublicProducts(query: string): Promise<Array<{
  id: string
  slug: string
  name: string
  image: string | null
  minPrice: number
  brand: { id: string; name: string; slug: string } | null
}>> {
  const params = new URLSearchParams()
  params.append('q', query)
  params.append('limit', '10')

  return fetchApi(`/api/v1/products?${params.toString()}`)
    .then((result: any) => result.items || [])
}

// ============ Синхронизация с 1С ============

/**
 * Запись журнала синхронизации
 */
export interface SyncLogItem {
  id: string
  direction: 'import' | 'export' | 'auth'
  status: 'success' | 'failed' | 'pending'
  itemsCount: number
  errorText?: string | null
  createdAt: string
}

/**
 * Получить журнал синхронизации
 */
export async function getSyncLog(): Promise<{ items: SyncLogItem[] }> {
  return fetchApi<{ items: SyncLogItem[] }>('/api/v1/admin/sync-log')
}

// ============ Популярные товары ============

export interface PopularProduct {
  id: string
  name: string
  slug: string
  image: string | null
  minPrice: number
  popularPin: number
}

/**
 * Получить список закреплённых популярных товаров
 */
export async function adminGetPopular(): Promise<PopularProduct[]> {
  return fetchApi<PopularProduct[]>('/api/v1/admin/popular')
}

/**
 * Установить порядок популярных товаров
 */
export async function adminSetPopular(productIds: string[]): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(
    '/api/v1/admin/popular',
    {
      method: 'PUT',
      body: JSON.stringify({ productIds }),
    }
  )
}
