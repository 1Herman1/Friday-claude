import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'

interface FavoritesContextType {
  slugs: Set<string>
  count: number
  isFavorite: (slug: string) => boolean
  toggle: (slug: string) => void
  remove: (slug: string) => void
  rename: (from: string, to: string) => void
  clear: () => void
}

const FavoritesContext = createContext<FavoritesContextType | null>(null)
const STORAGE_KEY = 'ps_favorites'
const LIMIT = 57

function loadFromStorage(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return new Set()
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.slice(0, LIMIT))
  } catch {
    return new Set()
  }
}

function saveToStorage(slugs: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(slugs).slice(0, LIMIT)))
  } catch {
    // Игнорируем ошибку localStorage (квота, частный режим браузера)
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<Set<string>>(loadFromStorage)

  // Синхронизируем вкладки через window 'storage'
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setSlugs(loadFromStorage())
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const count = slugs.size

  const isFavorite = useCallback((slug: string) => slugs.has(slug), [slugs])

  const toggle = useCallback((slug: string) => {
    setSlugs(prev => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        // Не добавляем сверх лимита
        if (next.size >= LIMIT) {
          return prev
        }
        next.add(slug)
      }
      saveToStorage(next)
      return next
    })
  }, [])

  const remove = useCallback((slug: string) => {
    setSlugs(prev => {
      const next = new Set(prev)
      next.delete(slug)
      saveToStorage(next)
      return next
    })
  }, [])

  // Товар сменил адрес: заменяем запись на новый slug, сохраняя место в списке
  const rename = useCallback((from: string, to: string) => {
    setSlugs(prev => {
      if (from === to || !prev.has(from)) return prev
      const next = new Set<string>()
      prev.forEach(s => {
        if (s === from) next.add(to)
        else if (s !== to) next.add(s)
      })
      saveToStorage(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSlugs(new Set())
    saveToStorage(new Set())
  }, [])

  const value = useMemo(
    () => ({ slugs, count, isFavorite, toggle, remove, rename, clear }),
    [slugs, count, isFavorite, toggle, remove, rename, clear]
  )

  return (
    <FavoritesContext.Provider value={value}>
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
