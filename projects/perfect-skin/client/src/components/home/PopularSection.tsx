import { Link } from 'react-router-dom'
import { ProductCard } from '@/components/catalog/ProductCard'
import { ProductGridSkeleton } from '@/components/home/ProductGridSkeleton'
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
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-8">
      <h2 className="text-h2 font-heading font-bold">Выбор покупателей</h2>
      <Link
        to="/catalog"
        className="min-h-11 inline-flex items-center gap-1 text-body-sm font-semibold text-primary hover:underline underline-offset-4 shrink-0"
      >
        Весь каталог <span aria-hidden="true">→</span>
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
          <ProductGridSkeleton />
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
