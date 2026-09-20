import { useState, useEffect, useRef, useCallback } from 'react'
import { productsApi, type Product } from '../lib/api'

export function useProductSearch() {
  const [value, setValue] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [popular, setPopular] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [total, setTotal] = useState(0)

  const debounceTimeoutRef = useRef<number | null>(null)
  const requestIdRef = useRef<number>(0)

  // Загружаем популярные товары один раз при первом открытии
  const loadPopular = useCallback(async () => {
    try {
      const res = await productsApi.popular(6)
      setPopular(res.data.items)
    } catch {
      setPopular([])
    }
  }, [])

  // Дебаунс поиска
  useEffect(() => {
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current)
    }

    if (!value.trim()) {
      setResults([])
      setSelectedIndex(-1)
      setTotal(0)
      return
    }

    setLoading(true)
    const currentRequestId = ++requestIdRef.current

    debounceTimeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await productsApi.list({ search: value, limit: 6 })
        // Применяем результат только если это всё ещё актуальный запрос
        if (currentRequestId === requestIdRef.current) {
          setResults(res.data.items)
          setTotal(res.data.total)
          setSelectedIndex(-1)
        }
      } catch {
        if (currentRequestId === requestIdRef.current) {
          setResults([])
          setTotal(0)
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [value])

  const clear = () => {
    setValue('')
    setResults([])
    setSelectedIndex(-1)
    setTotal(0)
  }

  const reset = () => {
    setValue('')
    setResults([])
    setSelectedIndex(-1)
    setTotal(0)
    // popular не сбрасываем — кэшируем
  }

  return {
    value,
    setValue,
    results,
    popular,
    loadPopular,
    loading,
    selectedIndex,
    setSelectedIndex,
    total,
    clear,
    reset,
  }
}
