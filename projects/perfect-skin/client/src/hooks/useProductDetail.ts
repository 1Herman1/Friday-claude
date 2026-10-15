import { useEffect, useRef, useState } from 'react'
import { fetchApi, ApiError } from '@/lib/api'
import type { ProductCardExtended } from '@/types/api'

interface UseProductDetailReturn {
  data: ProductCardExtended | null
  loading: boolean
  error: ApiError | null
  // slug, по которому загружены data: отличает свежий ответ от данных прошлого товара
  loadedSlug: string | null
}

export function useProductDetail(slug: string | undefined): UseProductDetailReturn {
  const [data, setData] = useState<ProductCardExtended | null>(null)
  const [loading, setLoading] = useState(!!slug)
  const [error, setError] = useState<ApiError | null>(null)
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null)

  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    if (!slug) {
      setData(null)
      setLoading(false)
      return
    }
    // Переход со старого адреса на новый: товар уже загружен — второй запрос и мигание не нужны
    if (dataRef.current?.slug === slug) {
      setLoadedSlug(slug)
      setLoading(false)
      return
    }

    // Быстрый переход A→B: поздний ответ по A не должен лечь под адрес B
    let ignore = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetchApi<ProductCardExtended>(`/api/v1/products/${slug}`)
        if (ignore) return
        setData(response)
        setLoadedSlug(slug)
      } catch (err) {
        if (ignore) return
        if (err instanceof ApiError) {
          setError(err)
        } else {
          setError(new ApiError(500, 'UNKNOWN_ERROR', 'Неизвестная ошибка'))
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchData()
    return () => {
      ignore = true
    }
  }, [slug])

  return { data, loading, error, loadedSlug }
}
