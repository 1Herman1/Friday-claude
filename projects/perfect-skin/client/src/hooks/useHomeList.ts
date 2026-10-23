import { useEffect, useState } from 'react'

// Секция дополнительная: при сбое тихо возвращаем пустой список, и секция не выводится
export function useHomeList<T>(load: () => Promise<T[]>): T[] | null {
  const [items, setItems] = useState<T[] | null>(null)

  useEffect(() => {
    let cancelled = false
    load()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return items
}
