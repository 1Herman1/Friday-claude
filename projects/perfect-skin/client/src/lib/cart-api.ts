import { DemoCartApi } from './cart-demo'
import { fetchApi } from './api'
import type { Cart } from '@/types/api'

export interface DeliveryMethod {
  code: string
  title: string
  hint?: string
  cost: number
  isFree: boolean
  freeFrom?: number
  amountToFree?: number
  requiresAddress: boolean
  requiresPvzCode?: boolean
}

export interface DeliveryQuote {
  subtotal: number
  promo: { code: string; percent: number; discount: number; subtotal: number } | null
  goodsAfterDiscount: number
  methods: DeliveryMethod[]
}

export interface PromoResult {
  code: string
  percent: number
  discount: number
  subtotal: number
}

export interface CartApi {
  getCart(): Promise<Cart>
  addItem(variantId: string, quantity: number): Promise<Cart>
  updateItem(itemId: string, quantity: number): Promise<Cart>
  removeItem(itemId: string): Promise<Cart>
  clear(): Promise<void>
  getDeliveryMethods(promoCode?: string): Promise<DeliveryQuote>
  validatePromo(code: string): Promise<PromoResult>
}

// Live-реализация поверх API сервера
class LiveCartApi implements CartApi {
  async getCart(): Promise<Cart> {
    return fetchApi<Cart>('/api/v1/cart')
  }

  async addItem(variantId: string, quantity: number): Promise<Cart> {
    return fetchApi<Cart>('/api/v1/cart/items', {
      method: 'POST',
      body: JSON.stringify({ variantId, quantity }),
    })
  }

  async updateItem(itemId: string, quantity: number): Promise<Cart> {
    return fetchApi<Cart>(`/api/v1/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    })
  }

  async removeItem(itemId: string): Promise<Cart> {
    return fetchApi<Cart>(`/api/v1/cart/items/${itemId}`, {
      method: 'DELETE',
    })
  }

  async clear(): Promise<void> {
    await fetchApi<void>('/api/v1/cart', {
      method: 'DELETE',
    })
  }

  async getDeliveryMethods(promoCode?: string): Promise<DeliveryQuote> {
    const params = new URLSearchParams()
    if (promoCode) params.append('promo', promoCode)
    return fetchApi<DeliveryQuote>(`/api/v1/delivery/methods?${params}`)
  }

  async validatePromo(code: string): Promise<PromoResult> {
    return fetchApi<PromoResult>('/api/v1/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }
}

// Singleton для повторного использования
let instance: CartApi | undefined

export function cartApi(): CartApi {
  if (!instance) {
    const apiMode = import.meta.env.VITE_API_MODE
    if (apiMode === 'snapshot') {
      // В демо-режиме используем DemoCartApi (статический импорт: require
      // в браузерной сборке не существует, а Vite вырежет неиспользуемую
      // ветку из live-бандла по константе VITE_API_MODE).
      instance = new DemoCartApi()
    } else {
      instance = new LiveCartApi()
    }
  }
  return instance as CartApi
}
