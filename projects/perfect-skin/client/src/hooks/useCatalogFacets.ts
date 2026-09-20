import { useEffect, useState } from 'react'
import { fetchApi, ApiError } from '@/lib/api'
import type { Facets } from '@/types/api'
import type { CatalogFilters } from './useCatalogList'

interface UseCatalogFacetsReturn {
  data: Facets | null
  loading: boolean
  error: ApiError | null
}

export function useCatalogFacets(filters: Omit<CatalogFilters, 'sort' | 'limit' | 'offset'>): UseCatalogFacetsReturn {
  const [data, setData] = useState<Facets | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()

        if (filters.category) params.append('category', filters.category)
        if (filters.brand?.length) {
          filters.brand.forEach(b => params.append('brand', b))
        }
        if (filters.line?.length) {
          filters.line.forEach(l => params.append('line', l))
        }
        if (filters.need?.length) {
          filters.need.forEach(n => params.append('need', n))
        }
        if (filters.skin?.length) {
          filters.skin.forEach(s => params.append('skin', s))
        }
        if (filters.minPrice !== undefined) params.append('minPrice', String(filters.minPrice))
        if (filters.maxPrice !== undefined) params.append('maxPrice', String(filters.maxPrice))

        const response = await fetchApi<Facets>(
          `/api/v1/products/facets?${params.toString()}`
        )
        if (!cancelled) setData(response)
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
    let cancelled = false
    fetchData()
    return () => {
      cancelled = true
    }
  }, [filters])

  return { data, loading, error }
}
