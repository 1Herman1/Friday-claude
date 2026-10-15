import { Link } from 'react-router-dom'
import { ProductCard } from '@/components/catalog/ProductCard'
import { BESTSELLER_SCENE_SLUGS } from '@/components/home/bestseller-slugs'
import { useCatalogList } from '@/hooks/useCatalogList'
import type { CatalogFilters } from '@/hooks/useCatalogList'

const POPULAR_FILTERS: CatalogFilters = {
  sort: 'popular',
  limit: 8,
  offset: 0,
}

function SectionHeading() {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <h2 className="text-h2 font-heading font-bold">Выбор покупателей</h2>
      <Link
        to="/catalog"
        className="min-h-11 inline-flex items-center gap-1 text-body-sm font-semibold text-primary hover:underline underline-offset-4 shrink-0"
      >
        Весь каталог →
      </Link>
    </div>
  )
}

export function PopularSection() {
  const { data, loading, error } = useCatalogList(POPULAR_FILTERS)
  // Секция дополнительная: при сбое API тихо не показываем её, сцена выше и каталог работают
  if (error) return null

  if (loading) {
    return (
      <section className="bg-background py-10 md:py-14">
        <div className="container-app">
          <SectionHeading />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-block overflow-hidden">
                <div className="w-full h-64 bg-muted animate-pulse motion-reduce:animate-none" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse motion-reduce:animate-none w-1/2" />
                  <div className="h-5 bg-muted rounded animate-pulse motion-reduce:animate-none" />
                  <div className="h-4 bg-muted rounded animate-pulse motion-reduce:animate-none w-1/3" />
                  <div className="h-11 bg-muted rounded-pill animate-pulse motion-reduce:animate-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const products = (data?.items || [])
    .filter((product) => !BESTSELLER_SCENE_SLUGS.includes(product.slug))
    .slice(0, 4)

  if (products.length === 0) {
    return null
  }

  return (
    <section className="bg-background py-10 md:py-14">
      <div className="container-app">
        <SectionHeading />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}
