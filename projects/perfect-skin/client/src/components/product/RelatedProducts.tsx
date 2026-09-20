import { useMemo } from 'react'
import { useCatalogList } from '@/hooks/useCatalogList'
import { ProductCard } from '@/components/catalog/ProductCard'

interface RelatedProductsProps {
  categorySlug: string | undefined
  currentProductSlug: string
}

export function RelatedProducts({
  categorySlug,
  currentProductSlug,
}: RelatedProductsProps) {
  // Нестабильная ссылка на объект фильтров зацикливала фетч: каждый рендер —
  // новый объект — новый запрос — новый рендер. Мемоизация рвёт петлю.
  const filters = useMemo(
    () => ({ category: categorySlug, limit: 3, offset: 0 }),
    [categorySlug]
  )
  const { data: products, loading } = useCatalogList(filters)

  if (!categorySlug) return null

  // Filter out current product
  const relatedProducts =
    products?.items.filter(p => p.slug !== currentProductSlug).slice(0, 3) || []

  if (relatedProducts.length === 0 && !loading) return null

  return (
    <div className="mt-12 pt-12 border-t border-border">
      <h2 className="text-2xl font-heading font-bold text-foreground mb-6">
        Другие товары раздела
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse">
              <div className="w-full h-64 bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-5 bg-gray-200 rounded" />
                <div className="h-11 bg-gray-200 rounded-full" />
              </div>
            </div>
          ))
        ) : (
          relatedProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))
        )}
      </div>
    </div>
  )
}
