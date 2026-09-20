import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '@/lib/format'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useFavorites } from '@/context/FavoritesContext'
import { IconHeart, IconHeartSolid } from '../icons'
import { StickyProductPanel } from './StickyProductPanel'
import { RelatedProducts } from './RelatedProducts'
import type { ProductCardExtended } from '@/types/api'

interface ProductDetailProps {
  product: ProductCardExtended
  loading?: boolean
  error?: Error | null
}

export function ProductDetail({ product, loading, error }: ProductDetailProps) {
  const addToCartButtonRef = useRef<HTMLDivElement>(null)
  const { addItem } = useCart()
  const { openCart } = useDrawer()
  const { isFavorite, toggle } = useFavorites()
  const [addingState, setAddingState] = useState<'idle' | 'loading' | 'success'>('idle')

  const isFav = isFavorite(product?.slug || '')

  const handleAddToCart = async () => {
    if (!product.inStock || product.variants.length === 0) return

    try {
      setAddingState('loading')
      await addItem(product.variants[0].id, 1)
      setAddingState('success')
      openCart()

      setTimeout(() => {
        setAddingState('idle')
      }, 1500)
    } catch {
      setAddingState('idle')
    }
  }

  if (error) {
    return (
      <div className="container-app py-12 md:py-24">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="font-heading font-bold text-red-900 mb-2">Ошибка загрузки</h2>
          <p className="text-red-800 mb-4">{error.message}</p>
          <Link to="/catalog/all" className="px-1 py-0.5 bg-red-900 text-white rounded-full hover:bg-red-800 transition-colors">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    )
  }

  if (loading || !product) {
    return (
      <div className="container-app py-12 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
          <div className="aspect-square bg-gray-200 rounded-lg" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-12 bg-gray-200 rounded-full" />
            <div className="space-y-3 pt-6">
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-4/5" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const primaryImage = product.images?.[0] || product.image
  const categorySlug = product.categories?.[0]?.slug

  return (
    <div className="container-app py-12 md:py-24 pb-24 md:pb-12">
      {/* Breadcrumbs */}
      <nav className="mb-2 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
        <Link to="/catalog/all" className="hover:text-foreground transition-colors">
          Каталог
        </Link>
        {product.categories?.[0] && (
          <>
            <span>/</span>
            <Link
              to={`/catalog/${categorySlug}`}
              className="hover:text-foreground transition-colors"
            >
              {product.categories[0].name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground font-semibold">{product.name}</span>
      </nav>

      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mb-3 md:mb-6">
        {/* Image */}
        <div>
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={`${product.name} от ${product.brand?.name || 'производителя'}`}
              className="w-full aspect-square object-cover rounded-media bg-card"
            />
          ) : (
            <div className="w-full aspect-square bg-muted rounded-media flex items-center justify-center text-muted-foreground">
              Нет изображения
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div>
            {/* Line */}
            {product.line && (
              <div className="text-xs font-semibold text-muted-foreground mb-3">
                {product.line.name}
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4 break-words">
              {product.name}
            </h1>

            {/* Brand */}
            {product.brand && (
              <p className="text-foreground mb-4">
                <span className="font-semibold">Бренд:</span> {product.brand.name}
              </p>
            )}

            {/* Volume */}
            {product.variants?.[0]?.volumeLabel && (
              <div className="inline-block px-3 py-1 bg-muted rounded-full text-sm text-foreground mb-6">
                {product.variants[0].volumeLabel}
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-3xl font-semibold text-foreground">
                {formatPrice(product.minPrice)}
              </span>
              {product.oldPrice && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.oldPrice)}
                </span>
              )}
            </div>
          </div>

          {/* Add to Cart Button + Favorite */}
          <div ref={addToCartButtonRef} className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!product.inStock || addingState === 'loading'}
              className="flex-1 py-3 px-6 bg-primary text-primary-foreground font-semibold font-sans rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity min-h-11 text-lg"
            >
              {addingState === 'success'
                ? 'Добавлено ✓'
                : addingState === 'loading'
                  ? 'Добавляю...'
                  : product.inStock
                    ? 'В корзину'
                    : 'Нет в наличии'}
            </button>

            <button
              onClick={() => toggle(product.slug)}
              aria-pressed={isFav}
              aria-label={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
              className="w-12 h-12 border border-border rounded-pill flex items-center justify-center hover:bg-muted transition-colors duration-200 flex-shrink-0"
            >
              {isFav ? (
                <IconHeartSolid className="w-5 h-5 text-primary" />
              ) : (
                <IconHeart className="w-5 h-5 text-foreground" />
              )}
            </button>
          </div>

          {/* Stock Status */}
          <p className="text-sm text-muted-foreground">
            {product.inStock ? (
              <span className="text-success">В наличии</span>
            ) : (
              <span className="text-destructive">Нет в наличии</span>
            )}
          </p>
        </div>
      </div>

      {/* Info Blocks */}
      <div className="space-y-8 border-t border-border pt-8">
        {/* Description */}
        {product.description && (
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-4">
              Действие
            </h2>
            <p className="text-foreground whitespace-pre-line leading-relaxed">
              {product.description}
            </p>
          </div>
        )}

        {/* Usage */}
        {product.usage && (
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-4">
              Применение
            </h2>
            <p className="text-foreground whitespace-pre-line leading-relaxed">
              {product.usage}
            </p>
          </div>
        )}

        {/* Ingredients */}
        {product.ingredients && product.ingredients.length > 0 && (
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-4">
              Активные компоненты
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {product.ingredients
                .toSorted((a, b) => {
                  if (a.isKey !== b.isKey) return a.isKey ? -1 : 1
                  return a.name.localeCompare(b.name)
                })
                .map(ingredient => (
                  <div
                    key={ingredient.slug}
                    className="flex flex-col gap-1"
                  >
                    <p className={`text-foreground ${ingredient.isKey ? 'font-bold' : ''}`}>
                      {ingredient.name}
                    </p>
                    {ingredient.concentration && (
                      <p className="text-sm text-muted-foreground">
                        {ingredient.concentration}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* INCI */}
        {product.inciText && (
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-4">
              Состав (INCI)
            </h2>
            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
              {product.inciText}
            </p>
          </div>
        )}
      </div>

      {/* Related Products */}
      <RelatedProducts
        categorySlug={categorySlug}
        currentProductSlug={product.slug}
      />

      {/* Sticky Panel */}
      <StickyProductPanel
        product={product}
        buttonRef={addToCartButtonRef}
        onAddToCart={() => console.log('Add to cart:', product.id)}
      />
    </div>
  )
}
