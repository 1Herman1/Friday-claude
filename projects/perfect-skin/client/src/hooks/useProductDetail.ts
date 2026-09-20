import { useEffect, useState } from 'react'
import { fetchApi, ApiError } from '@/lib/api'
import type { ProductCardExtended } from '@/types/api'

interface UseProductDetailReturn {
  data: ProductCardExtended | null
  loading: boolean
  error: ApiError | null
}

export function useProductDetail(slug: string | undefined): UseProductDetailReturn {
  const [data, setData] = useState<ProductCardExtended | null>(null)
  const [loading, setLoading] = useState(!!slug)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!slug) {
      setData(null)
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetchApi<ProductCardExtended>(`/api/v1/products/${slug}`)
        setData(response)
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err)
        } else {
          setError(new ApiError(500, 'UNKNOWN_ERROR', 'Неизвестная ошибка'))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [slug])

  return { data, loading, error }
}
