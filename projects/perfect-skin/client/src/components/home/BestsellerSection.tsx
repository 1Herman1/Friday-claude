import { ProductCard } from '@/components/catalog/ProductCard'
import { useCatalogList } from '@/hooks/useCatalogList'
import type { CatalogFilters } from '@/hooks/useCatalogList'

const BESTSELLER_FILTERS: CatalogFilters = {
  sort: 'popular',
  limit: 4,
  offset: 0,
}

export function BestsellerSection() {
  const { data, loading } = useCatalogList(BESTSELLER_FILTERS)

  if (loading) {
    return (
      <section className="bg-background py-10 md:py-14">
        <div className="container-app">
          <h2 className="text-h2 font-heading font-bold mb-8">Бестселлеры</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-block overflow-hidden">
                <div className="w-full h-64 bg-muted animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                  <div className="h-5 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
                  <div className="h-11 bg-muted rounded-pill animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const products = data?.items || []

  if (products.length === 0) {
    return null
  }

  return (
    <section className="bg-background py-10 md:py-14">
      <div className="container-app">
        <h2 className="text-h2 font-heading font-bold mb-8">Бестселлеры</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {products.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              eager={i < 4}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
