import { useEffect, useState } from 'react'

// Секция дополнительная: при сбое тихо возвращаем fallback, и секция не выводится
export function useHomeList<T>(load: () => Promise<T>, fallback: T): T | null {
  const [items, setItems] = useState<T | null>(null)

  useEffect(() => {
    let cancelled = false
    load()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch(() => {
        if (!cancelled) setItems(fallback)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return items
}
