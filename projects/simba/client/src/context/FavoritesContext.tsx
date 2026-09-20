import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'
import { favoritesApi, type Favorite } from '../lib/api'

interface FavoritesContextType {
  items: Favorite[]
  ids: Set<string>
  count: number
  isFavorite: (productId: string) => boolean
  add: (productId: string) => Promise<void>
  remove: (productId: string) => Promise<void>
  toggle: (productId: string) => Promise<void>
  isLoading: boolean
}

const FavoritesContext = createContext<FavoritesContextType | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Favorite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Товары, для которых add() ушёл на сервер, но getAll() ещё не вернулся —
  // отдельно от items, чтобы сердечко подсвечивалось мгновенно, но список в
  // попапе (он читает favorite.product.*) никогда не получал запись без
  // реального объекта товара.
  const [optimisticAdds, setOptimisticAdds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const res = await favoritesApi.getAll()
        setItems(res.data)
      } catch {
        setItems([])
      } finally {
        setIsLoading(false)
      }
    }
    loadFavorites()
  }, [])

  const ids = useMemo(() => {
    const set = new Set(items.map(f => f.productId))
    optimisticAdds.forEach(id => set.add(id))
    return set
  }, [items, optimisticAdds])

  const count = ids.size

  const isFavorite = (productId: string) => ids.has(productId)

  const add = async (productId: string) => {
    setOptimisticAdds(prev => new Set(prev).add(productId))
    try {
      await favoritesApi.add(productId)
      const res = await favoritesApi.getAll()
      setItems(res.data)
    } catch (err) {
      throw err
    } finally {
      setOptimisticAdds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const remove = async (productId: string) => {
    const previousItems = items
    setItems(prev => prev.filter(f => f.productId !== productId))
    try {
      await favoritesApi.remove(productId)
    } catch (err) {
      setItems(previousItems)
      throw err
    }
  }

  const toggle = async (productId: string) => {
    if (isFavorite(productId)) {
      await remove(productId)
    } else {
      await add(productId)
    }
  }

  return (
    <FavoritesContext.Provider value={{ items, ids, count, isFavorite, add, remove, toggle, isLoading }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites(): FavoritesContextType {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider')
  }
  return context
}
