import { useParams, useSearchParams } from 'react-router-dom'
import { useMemo } from 'react'
import { CatalogGrid } from '@/components/catalog/CatalogGrid'
import { ProductGrid } from '@/components/catalog/ProductGrid'
import { Filters } from '@/components/catalog/Filters'
import { useCatalogTree } from '@/hooks/useCatalogTree'
import { useCatalogList } from '@/hooks/useCatalogList'
import { useCatalogFacets } from '@/hooks/useCatalogFacets'
import type { CatalogFilters } from '@/hooks/useCatalogList'

export function CatalogPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  // Parse filters from URL
  const filters = useMemo<CatalogFilters>(() => {
    return {
      category: slug && slug !== 'all' ? slug : searchParams.get('category') || undefined,
      brand: searchParams.getAll('brand'),
      line: searchParams.getAll('line'),
      need: searchParams.getAll('need'),
      skin: searchParams.getAll('skin'),
      minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined,
      q: searchParams.get('q') || undefined,
      sort: (searchParams.get('sort') as 'newest' | 'price_asc' | 'price_desc' | 'popular') || 'newest',
      limit: 24,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    }
  }, [slug, searchParams])

  const facetFilters = useMemo<Omit<CatalogFilters, 'sort' | 'limit' | 'offset'>>(() => {
    const { sort, limit, offset, ...rest } = filters
    return rest
  }, [filters])

  // If no slug, show categories grid
  if (!slug) {
    const { data: categories, loading, error } = useCatalogTree()

    if (loading) {
      return (
        <div className="container-app py-12 md:py-24">
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-gray-200 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="container-app py-12 md:py-24">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="font-heading font-bold text-red-900 mb-2">Ошибка загрузки</h2>
            <p className="text-red-800 mb-4">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-1 py-0.5 bg-red-900 text-white rounded-full hover:bg-red-800 transition-colors"
            >
              Повторить
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="container-app py-12 md:py-24">
        <h1 className="text-display font-heading font-bold mb-2 md:mb-3">Каталог</h1>
        {categories && <CatalogGrid categories={categories} />}
      </div>
    )
  }

  // Show listing with filters
  const { data: products, loading: productsLoading, error: productsError } = useCatalogList(filters)
  const { data: facets } = useCatalogFacets(facetFilters)

  const handleFilterChange = (newFilters: any) => {
    const params = new URLSearchParams()

    if (slug && slug !== 'all') {
      params.set('category', slug)
    }

    if (newFilters.brand?.length) {
      newFilters.brand.forEach((b: string) => params.append('brand', b))
    }
    if (newFilters.line?.length) {
      newFilters.line.forEach((l: string) => params.append('line', l))
    }
    if (newFilters.need?.length) {
      newFilters.need.forEach((n: string) => params.append('need', n))
    }
    if (newFilters.skin?.length) {
      newFilters.skin.forEach((s: string) => params.append('skin', s))
    }
    if (newFilters.minPrice !== undefined) {
      params.set('minPrice', String(newFilters.minPrice))
    }
    if (newFilters.maxPrice !== undefined) {
      params.set('maxPrice', String(newFilters.maxPrice))
    }
    if (filters.q) {
      params.set('q', filters.q)
    }
    if (newFilters.sort && newFilters.sort !== 'newest') {
      params.set('sort', newFilters.sort)
    }
    if (newFilters.offset !== undefined) {
      params.set('offset', String(newFilters.offset))
    }

    setSearchParams(params)
  }

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams)
    if (sort === 'newest') {
      params.delete('sort')
    } else {
      params.set('sort', sort)
    }
    params.delete('offset')
    setSearchParams(params)
  }

  const handleLoadMore = () => {
    const newOffset = (filters.offset || 0) + (filters.limit || 24)
    handleFilterChange({
      ...filters,
      offset: newOffset,
    })
  }

  const handleClearSearch = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('q')
    params.delete('offset')
    setSearchParams(params)
  }

  return (
    <div className="container-app py-12 md:py-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-display font-heading font-bold mb-2 md:mb-3">
          {filters.q ? `Результаты поиска: „${filters.q}"` : slug === 'all' ? 'Все средства' : 'Каталог'}
        </h1>
        {filters.q && (
          <button
            onClick={handleClearSearch}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-muted text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors"
          >
            Сбросить поиск
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>

      {/* Error */}
      {productsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-2 text-center">
          <h2 className="font-heading font-bold text-red-900 mb-2">Ошибка загрузки</h2>
          <p className="text-red-800 mb-4">{productsError.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-1 py-0.5 bg-red-900 text-white rounded-full hover:bg-red-800 transition-colors"
          >
            Повторить
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Filters */}
        <div className="lg:col-span-1">
          <Filters
            facets={facets}
            selectedFilters={facetFilters}
            onFilterChange={handleFilterChange}
            showCategories={slug === 'all'}
          />
        </div>

        {/* Products */}
        <div className="lg:col-span-3">
          {/* Sort and Info */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              {products ? `Показано ${Math.min((filters.offset || 0) + (products.items?.length || 0), products.total)} из ${products.total}` : ''}
            </p>
            <select
              value={filters.sort || 'newest'}
              onChange={e => handleSortChange(e.target.value)}
              className="px-1 py-0.5 border border-border rounded text-sm text-foreground bg-card min-h-10"
            >
              <option value="newest">Новинки</option>
              <option value="price_asc">Цена: возрастание</option>
              <option value="price_desc">Цена: убывание</option>
              <option value="popular">Популярные</option>
            </select>
          </div>

          {/* Products Grid */}
          <ProductGrid
            products={products?.items || []}
            loading={productsLoading}
            onAddToCart={id => console.log('Add to cart:', id)}
            onReset={() => handleFilterChange({})}
          />

          {/* Load More */}
          {products && (filters.offset || 0) + (filters.limit || 24) < products.total && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                className="px-2 py-3 bg-primary text-primary-foreground font-semibold rounded-full hover:opacity-90 transition-opacity min-h-11"
              >
                Показать ещё
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
