import { useEffect, useState } from 'react'
import { fetchApi, ApiError } from '@/lib/api'
import type { CategoriesTreeResponse } from '@/types/api'

interface UseCatalogTreeReturn {
  data: CategoriesTreeResponse[] | null
  loading: boolean
  error: ApiError | null
}

export function useCatalogTree(): UseCatalogTreeReturn {
  const [data, setData] = useState<CategoriesTreeResponse[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetchApi<CategoriesTreeResponse[]>('/api/v1/categories/tree')
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
  }, [])

  return { data, loading, error }
}
