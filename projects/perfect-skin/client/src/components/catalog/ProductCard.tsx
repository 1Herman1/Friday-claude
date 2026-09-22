import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { IconHeart, IconHeartSolid } from '../icons'
import { PriceTag } from '@/components/product/PriceTag'
import { NoImage } from './NoImage'
import type { ProductCard as ProductCardType } from '@/types/api'

interface ProductCardProps {
  product: ProductCardType
  onAddToCart?: (productId: string) => void
  // Первые карточки над фолдом — часть LCP, им eager + high priority.
  eager?: boolean
  // Aspect ratio для фото (по умолчанию 3/4, для related используем 4/5)
  aspectRatio?: '3/4' | '4/5'
}

export function ProductCard({ product, onAddToCart, eager, aspectRatio = '3/4' }: ProductCardProps) {
  const { addItem } = useCart()
  const { openCart } = useDrawer()
  const { isFavorite, toggle } = useFavorites()
  const { user } = useAuth()
  const [addingState, setAddingState] = useState<'idle' | 'loading' | 'success'>('idle')

  const isFav = isFavorite(product.slug)
  const isProProduct = product.isProfessional && !isApprovedPro(user)

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggle(product.slug)
  }

  const handleAddToCart = async () => {
    if (!product.inStock || product.variants.length === 0) return

    try {
      setAddingState('loading')
      await addItem(product.variants[0].id, 1)
      setAddingState('success')
      openCart()

      // Показываем "Добавлено ✓" на 1.5 секунды
      setTimeout(() => {
        setAddingState('idle')
      }, 1500)
    } catch {
      setAddingState('idle')
      // Ошибка будет показана в CartDrawer
    }

    if (onAddToCart) {
      onAddToCart(product.id)
    }
  }

  return (
    <div className="bg-card rounded-block overflow-hidden transition-transform duration-200 hover:-translate-y-1 flex flex-col h-full">
      {/* Image */}
      <div className="relative">
        <Link to={`/product/${product.slug}`} className="block overflow-hidden bg-card">
          {product.image ? (
            <picture>
              <source
                type="image/webp"
                srcSet={`/products-optimized/${product.slug}/card.webp 1x, /products-optimized/${product.slug}/card@2x.webp 2x`}
              />
              <img
                src={product.image}
                alt={product.name}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={eager ? 'high' : undefined}
                decoding="async"
                className={`w-full object-contain rounded-media ${
                  aspectRatio === '4/5' ? 'aspect-[4/5]' : 'aspect-[3/4]'
                }`}
              />
            </picture>
          ) : (
            <NoImage aspectRatio={aspectRatio === '4/5' ? 'aspect-[4/5]' : 'aspect-[3/4]'} />
          )}
        </Link>

        {/* Pro Badge */}
        {isProProduct && (
          <div className="absolute bottom-2 left-2 bg-accent px-3 py-1 rounded-pill">
            <span className="text-xs font-semibold text-accent">Для специалистов</span>
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          aria-pressed={isFav}
          aria-label={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
          className="absolute top-2 right-2 w-11 h-11 bg-card/90 rounded-pill flex items-center justify-center hover:bg-card transition-colors duration-200"
        >
          {isFav ? (
            <IconHeartSolid className="w-5 h-5 text-primary" />
          ) : (
            <IconHeart className="w-5 h-5 text-foreground" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Brand and Line */}
        {(product.brand || product.line) && (
          <div className="text-xs text-muted-foreground mb-2">
            {product.brand?.name && <span>{product.brand.name}</span>}
            {product.brand?.name && product.line?.name && <span> • </span>}
            {product.line?.name && <span>{product.line.name}</span>}
          </div>
        )}

        {/* Name */}
        <Link
          to={`/product/${product.slug}`}
          className="block text-body font-sans font-bold text-foreground mb-3 hover:text-primary transition-colors line-clamp-2 h-[3rem] min-w-0 hyphens-auto"
        >
          {product.name}
        </Link>

        {/* Price and Button */}
        <div className="mt-auto">
          {/* Price */}
          <div className="mb-4">
            <PriceTag
              price={product.minPrice}
              oldPrice={product.oldPrice}
              hidden={product.priceHidden}
              size="lg"
            />
          </div>

          {/* Button or Pro Link */}
          {isProProduct ? (
            <Link
              to="/pro"
              className="w-full py-3 px-6 bg-accent text-accent text-center font-sans font-semibold rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11 flex items-center justify-center"
            >
              Для специалистов
            </Link>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={!product.inStock || addingState === 'loading'}
              className="w-full py-3 px-6 bg-primary text-primary-foreground font-sans font-semibold rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 min-h-11"
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
        </div>
      </div>
    </div>
  )
}
