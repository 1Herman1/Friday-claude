import { ProductCard } from './ProductCard'
import { useDrawer } from '@/context/DrawerContext'
import type { ProductCard as ProductCardType } from '@/types/api'

interface ProductGridProps {
  products: ProductCardType[]
  onReset?: () => void
  loading?: boolean
  onAddToCart?: (productId: string) => void
}

function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-block overflow-hidden">
      <div className="w-full h-64 bg-muted animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        <div className="h-5 bg-muted rounded animate-pulse" />
        <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
        <div className="h-11 bg-muted rounded-pill animate-pulse" />
      </div>
    </div>
  )
}

export function ProductGrid({ products, onReset, loading, onAddToCart }: ProductGridProps) {
  const { openQuiz } = useDrawer()

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="col-span-full py-16 text-center">
        <h3 className="text-xl font-heading font-bold text-foreground mb-3">Подберём под вашу кожу</h3>
        <p className="text-muted-foreground mb-6">
          Под эти фильтры ничего не нашлось — ответьте на пять вопросов, и мы
          соберём программу ухода под ваш тип кожи.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={openQuiz}
            className="inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-pill bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity duration-200"
          >
            Подобрать уход
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-pill border border-border text-foreground font-semibold"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
      {products.map((product, i) => (
        <ProductCard
          eager={i < 3}
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  )
}
