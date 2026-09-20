import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { cartApi, type CartItem } from '../lib/api'

interface CartContextType {
  count: number
  addItem: (productVariantId: string, quantity?: number, options?: { isSubscription?: boolean; intervalWeeks?: number }) => Promise<{ data: { items: CartItem[] } }>
  updateItem: (cartItemId: string, quantity: number, options?: { isSubscription?: boolean; intervalWeeks?: number }) => Promise<{ data: { items: CartItem[] } }>
  removeItem: (cartItemId: string) => Promise<{ data: { items: CartItem[] } }>
  clear: () => Promise<void>
  isLoading: boolean
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Загружаем начальное количество при старте
  useEffect(() => {
    const loadCart = async () => {
      try {
        const res = await cartApi.get()
        const total = res.data.items.reduce((sum, item) => sum + item.quantity, 0)
        setCount(total)
      } catch {
        setCount(0)
      } finally {
        setIsLoading(false)
      }
    }
    loadCart()
  }, [])

  const addItem = async (productVariantId: string, quantity = 1, options?: { isSubscription?: boolean; intervalWeeks?: number }) => {
    try {
      const res = await cartApi.addItem(productVariantId, quantity, options)
      const total = res.data.items.reduce((sum, item) => sum + item.quantity, 0)
      setCount(total)
      return res
    } catch (error) {
      console.error('Failed to add item to cart:', error)
      throw error
    }
  }

  const updateItem = async (cartItemId: string, quantity: number, options?: { isSubscription?: boolean; intervalWeeks?: number }) => {
    try {
      const res = await cartApi.updateItem(cartItemId, quantity, options)
      const total = res.data.items.reduce((sum, item) => sum + item.quantity, 0)
      setCount(total)
      return res
    } catch (error) {
      console.error('Failed to update cart item:', error)
      throw error
    }
  }

  const removeItem = async (cartItemId: string) => {
    try {
      const res = await cartApi.removeItem(cartItemId)
      const total = res.data.items.reduce((sum, item) => sum + item.quantity, 0)
      setCount(total)
      return res
    } catch (error) {
      console.error('Failed to remove cart item:', error)
      throw error
    }
  }

  const clear = async () => {
    try {
      await cartApi.clear()
      setCount(0)
    } catch (error) {
      console.error('Failed to clear cart:', error)
      throw error
    }
  }

  return (
    <CartContext.Provider value={{ count, addItem, updateItem, removeItem, clear, isLoading }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextType {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
