import { ApiError } from './api'
import { loadSnapshot } from './snapshot'
import type { Cart, CartItem, CartWarning, ProductCardExtended } from '@/types/api'
import type { CartApi, DeliveryQuote, PromoResult } from './cart-api'

const DEMO_CART_KEY = 'ps_demo_cart'
const ITEM_LIMIT = 50
const FREE_PVZ_THRESHOLD = 600000 // 6 000 ₽
const FREE_COURIER_THRESHOLD = 1000000 // 10 000 ₽
const DELIVERY_COST = 20000 // 200 ₽

interface DemoCartItemData {
  variantId: string
  quantity: number
}

export class DemoCartApi implements CartApi {
  private loadCart(): DemoCartItemData[] {
    try {
      const stored = localStorage.getItem(DEMO_CART_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  private saveCart(items: DemoCartItemData[]): void {
    try {
      localStorage.setItem(DEMO_CART_KEY, JSON.stringify(items))
    } catch {
      // Игнорируем ошибки localStorage (может быть переполнена)
    }
  }

  private async buildCart(items: DemoCartItemData[]): Promise<Cart> {
    const cartItems: CartItem[] = []
    const warnings: CartWarning[] = []
    let subtotal = 0

    const snap = await loadSnapshot()

    for (const demoItem of items) {
      try {
        // Товар ищем по id варианта — в localStorage хранится только variantId.
        const entry = snap.products.find((sp) =>
          sp.detail.variants.some((v) => v.id === demoItem.variantId)
        )
        if (!entry) continue
        const product: ProductCardExtended = entry.detail
        const variant = product.variants.find((v) => v.id === demoItem.variantId)
        if (!variant) continue

        // Клампим количество к stock, добавляем warning если изменилось
        let finalQuantity = demoItem.quantity
        if (finalQuantity > variant.stock) {
          finalQuantity = Math.max(0, variant.stock)
          warnings.push({
            code: 'STOCK_REDUCED',
            itemId: demoItem.variantId,
            available: finalQuantity,
            message: `Осталось только ${finalQuantity} шт.`,
          })
        }

        if (finalQuantity === 0) {
          warnings.push({
            code: 'ITEM_UNAVAILABLE',
            itemId: demoItem.variantId,
            message: 'Товар закончился',
          })
          continue
        }

        const lineTotal = variant.retailPrice * finalQuantity
        cartItems.push({
          id: demoItem.variantId,
          productId: product.id,
          variantId: demoItem.variantId,
          quantity: finalQuantity,
          product: {
            name: product.name,
            slug: product.slug,
            image: product.image,
            brandName: product.brand?.name || '',
          },
          variant: {
            volumeLabel: variant.volumeLabel,
            retailPrice: variant.retailPrice,
            oldRetailPrice: variant.oldRetailPrice,
            stock: variant.stock,
          },
          lineTotal,
        })

        subtotal += lineTotal
      } catch {
        // Пропускаем товары, которые не найдены
      }
    }

    const itemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

    return {
      id: null,
      items: cartItems,
      itemsCount,
      subtotal,
      warnings,
    }
  }

  async getCart(): Promise<Cart> {
    const items = this.loadCart()
    return this.buildCart(items)
  }

  async addItem(variantId: string, quantity: number): Promise<Cart> {
    const items = this.loadCart()

    // Проверяем лимит позиций
    if (items.length >= ITEM_LIMIT && !items.some(i => i.variantId === variantId)) {
      throw new ApiError(409, 'CART_ITEM_LIMIT', 'Максимум 50 товаров в корзине')
    }

    // Находим или создаём строку
    const existingIndex = items.findIndex(i => i.variantId === variantId)
    if (existingIndex >= 0) {
      items[existingIndex].quantity += quantity
    } else {
      items.push({ variantId, quantity })
    }

    this.saveCart(items)
    return this.buildCart(items)
  }

  async updateItem(itemId: string, quantity: number): Promise<Cart> {
    const items = this.loadCart()
    const index = items.findIndex(i => i.variantId === itemId)

    if (index < 0) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Товар не найден в корзине')
    }

    if (quantity <= 0) {
      items.splice(index, 1)
    } else {
      items[index].quantity = quantity
    }

    this.saveCart(items)
    return this.buildCart(items)
  }

  async removeItem(itemId: string): Promise<Cart> {
    const items = this.loadCart()
    const filtered = items.filter(i => i.variantId !== itemId)
    this.saveCart(filtered)
    return this.buildCart(filtered)
  }

  async clear(): Promise<void> {
    this.saveCart([])
  }

  async getDeliveryMethods(): Promise<DeliveryQuote> {
    const cart = await this.buildCart(this.loadCart())
    const subtotal = cart.subtotal
    if (cart.items.length === 0) {
      throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
    }
    const cdek = (freeFrom: number) => ({
      cost: subtotal >= freeFrom ? 0 : DELIVERY_COST,
      isFree: subtotal >= freeFrom,
      freeFrom,
      amountToFree: Math.max(0, freeFrom - subtotal),
    })
    return {
      subtotal,
      promo: null,
      goodsAfterDiscount: subtotal,
      methods: [
        {
          code: 'pickup',
          title: 'Самовывоз',
          hint: 'Москва, Звенигородское шоссе, 3Ас1',
          cost: 0,
          isFree: true,
          requiresAddress: false,
          requiresPvzCode: false,
        },
        {
          code: 'cdek_pvz',
          title: 'ПВЗ СДЭК',
          ...cdek(FREE_PVZ_THRESHOLD),
          requiresAddress: false,
          requiresPvzCode: true,
        },
        {
          code: 'cdek_courier',
          title: 'Курьер СДЭК',
          ...cdek(FREE_COURIER_THRESHOLD),
          requiresAddress: true,
          requiresPvzCode: false,
        },
      ],
    }
  }

  async validatePromo(): Promise<PromoResult> {
    throw new ApiError(404, 'PROMO_NOT_FOUND', 'Промокоды заработают после запуска магазина')
  }
}
