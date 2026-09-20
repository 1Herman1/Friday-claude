import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { cartApi } from '@/lib/cart-api'
import type { Cart } from '@/types/api'

interface CartContextType {
  cart: Cart | null
  isLoading: boolean
  count: number
  addItem: (variantId: string, quantity: number) => Promise<void>
  updateItem: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  refresh: () => Promise<void>
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const api = cartApi()

  // Загружаем корзину при монтировании
  useEffect(() => {
    const loadCart = async () => {
      try {
        const data = await api.getCart()
        setCart(data)
      } catch {
        // При ошибке оставляем null, UI покажет пустую корзину
        setCart(null)
      } finally {
        setIsLoading(false)
      }
    }
    loadCart()
  }, [api])

  const refresh = async () => {
    try {
      const data = await api.getCart()
      setCart(data)
    } catch {
      setCart(null)
    }
  }

  const addItem = async (variantId: string, quantity: number) => {
    try {
      const data = await api.addItem(variantId, quantity)
      setCart(data)
    } catch (error) {
      throw error
    }
  }

  const updateItem = async (itemId: string, quantity: number) => {
    try {
      const data = await api.updateItem(itemId, quantity)
      setCart(data)
    } catch (error) {
      throw error
    }
  }

  const removeItem = async (itemId: string) => {
    try {
      const data = await api.removeItem(itemId)
      setCart(data)
    } catch (error) {
      throw error
    }
  }

  const count = cart?.itemsCount ?? 0

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        count,
        addItem,
        updateItem,
        removeItem,
        refresh,
      }}
    >
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
