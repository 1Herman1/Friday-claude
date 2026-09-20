import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchApi, ApiError } from '@/lib/api'
import type { ProductsListResponse } from '@/types/api'

export function useProductSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductsListResponse['items']>([])
  const [popular, setPopular] = useState<ProductsListResponse['items']>([])
  const [isLoading, setIsLoading] = useState(false)

  const debounceTimeoutRef = useRef<number | null>(null)
  const requestIdRef = useRef<number>(0)
  const popularCachedRef = useRef(false)

  // Загружаем популярные товары один раз при первом открытии
  const loadPopular = useCallback(async () => {
    if (popularCachedRef.current) return

    try {
      const res = await fetchApi<ProductsListResponse>(
        '/api/v1/products?sort=popular&limit=6'
      )
      setPopular(res.items)
      popularCachedRef.current = true
    } catch {
      setPopular([])
      popularCachedRef.current = true
    }
  }, [])

  // Дебаунс поиска
  useEffect(() => {
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current)
    }

    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setResults([])
      return
    }

    if (trimmedQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    const currentRequestId = ++requestIdRef.current

    debounceTimeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await fetchApi<ProductsListResponse>(
          `/api/v1/products?q=${encodeURIComponent(trimmedQuery)}&limit=6`
        )
        // Применяем результат только если это всё ещё актуальный запрос
        if (currentRequestId === requestIdRef.current) {
          setResults(res.items)
        }
      } catch (err) {
        if (currentRequestId === requestIdRef.current) {
          // Не показываем ошибку при вводе, просто пустой список
          if (err instanceof ApiError && err.code !== 'NETWORK_ERROR') {
            setResults([])
          } else {
            setResults([])
          }
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    }, 300)

    return () => {
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [query])

  const clear = () => {
    setQuery('')
    setResults([])
  }

  return {
    query,
    setQuery,
    results,
    popular,
    loadPopular,
    isLoading,
    clear,
  }
}
