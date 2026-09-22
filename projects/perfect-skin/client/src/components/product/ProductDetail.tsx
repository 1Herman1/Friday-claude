import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { IconHeart, IconHeartSolid } from '../icons'
import { PriceTag } from './PriceTag'
import { StickyProductPanel } from './StickyProductPanel'
import { RelatedProducts } from './RelatedProducts'
import { NoImage } from '@/components/catalog/NoImage'
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
  const { user } = useAuth()
  const [addingState, setAddingState] = useState<'idle' | 'loading' | 'success'>('idle')

  // Выбранный вариант: по умолчанию первый видимый (не скрытый), иначе первый
  const defaultVariantId = product?.variants?.find(v => !v.priceHidden)?.id || product?.variants?.[0]?.id
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId)

  const selectedVariant = product?.variants?.find(v => v.id === selectedVariantId) || product?.variants?.[0]
  const isFav = isFavorite(product?.slug || '')
  const isVariantProOnly = selectedVariant?.priceHidden && !isApprovedPro(user)

  const handleAddToCart = async () => {
    if (!product.inStock || !selectedVariant) return

    try {
      setAddingState('loading')
      await addItem(selectedVariant.id, 1)
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
            <NoImage aspectRatio="aspect-square" />
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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4 hyphens-auto break-words min-w-0">
              {product.name}
            </h1>

            {/* Brand */}
            {product.brand && (
              <p className="text-foreground mb-4">
                <span className="font-semibold">Бренд:</span> {product.brand.name}
              </p>
            )}

            {/* Variant Selector - if multiple variants available */}
            {product.variants && product.variants.length > 1 && (
              <div className="mb-6">
                <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-widest">
                  Фасовка
                </div>
                <div className="flex flex-wrap gap-3" role="group" aria-label="Фасовка">
                  {product.variants.map(variant => {
                    const isSelected = variant.id === selectedVariantId
                    const isProOnly = variant.priceHidden && !isApprovedPro(user)
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantId(variant.id)}
                        aria-pressed={isSelected}
                        className={`
                          px-6 py-3 rounded-pill border text-body-sm font-semibold
                          transition-colors duration-200 min-h-11
                          ${isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border-strong text-foreground hover:border-primary'
                          }
                        `}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span>{variant.volumeLabel}</span>
                          {isProOnly && (
                            <span className="text-label opacity-70">для кабинета</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Single Volume Badge - if only one variant */}
            {product.variants && product.variants.length === 1 && selectedVariant?.volumeLabel && (
              <div className="inline-block px-3 py-1 bg-muted rounded-full text-sm text-foreground mb-6">
                {selectedVariant.volumeLabel}
              </div>
            )}

            {/* Price */}
            <div className="mb-6">
              <div className="text-3xl font-semibold text-foreground">
                <PriceTag
                  price={selectedVariant?.retailPrice || null}
                  oldPrice={selectedVariant?.oldRetailPrice || null}
                  hidden={selectedVariant?.priceHidden}
                  size="lg"
                />
              </div>
            </div>
          </div>

          {/* Add to Cart Button + Favorite */}
          <div ref={addToCartButtonRef} className="flex gap-3">
            {isVariantProOnly ? (
              <Link
                to="/pro/register"
                className="flex-1 py-3 px-6 bg-accent text-accent-foreground text-center font-semibold font-sans rounded-pill hover:opacity-90 transition-opacity min-h-11 text-lg flex items-center justify-center"
              >
                Для специалистов
              </Link>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock || !selectedVariant || addingState === 'loading'}
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
            )}

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
          {product.inStock && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-2 bg-success/10 text-success rounded-full text-sm font-semibold">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  В наличии
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Доставка СДЭК 2–4 дня
              </p>
              {selectedVariant?.stock !== undefined && selectedVariant.stock <= 3 && (
                <p className="text-sm text-urgency font-semibold">
                  Осталось {selectedVariant.stock} {selectedVariant.stock === 1 ? 'шт.' : selectedVariant.stock % 10 === 1 && selectedVariant.stock % 100 !== 11 ? 'шт.' : 'шт.'}
                </p>
              )}
            </div>
          )}
          {!product.inStock && (
            <p className="text-sm text-destructive font-semibold">Нет в наличии</p>
          )}
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
        selectedVariantId={selectedVariantId}
        onAddToCart={() => console.log('Add to cart:', product.id)}
      />
    </div>
  )
}
