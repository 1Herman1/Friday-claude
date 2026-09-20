import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '@/lib/format'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useFavorites } from '@/context/FavoritesContext'
import { IconHeart, IconHeartSolid } from '../icons'
import type { ProductCard as ProductCardType } from '@/types/api'

interface ProductCardProps {
  product: ProductCardType
  onAddToCart?: (productId: string) => void
  // Первые карточки над фолдом — часть LCP, им eager + high priority.
  eager?: boolean
}

export function ProductCard({ product, onAddToCart, eager }: ProductCardProps) {
  const { addItem } = useCart()
  const { openCart } = useDrawer()
  const { isFavorite, toggle } = useFavorites()
  const [addingState, setAddingState] = useState<'idle' | 'loading' | 'success'>('idle')

  const isFav = isFavorite(product.slug)

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
    <div className="bg-card rounded-block overflow-hidden transition-transform duration-200 hover:-translate-y-1">
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
                className="w-full aspect-[3/4] object-contain rounded-media"
              />
            </picture>
          ) : (
            <div className="w-full aspect-[3/4] flex items-center justify-center bg-muted text-muted-foreground rounded-media">
              Нет изображения
            </div>
          )}
        </Link>

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
      <div className="p-2">
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
          className="block text-body font-sans font-bold text-foreground mb-3 hover:text-primary transition-colors"
        >
          {product.name}
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-lg font-semibold text-foreground">{formatPrice(product.minPrice)}</span>
          {product.oldPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
        </div>

        {/* Button */}
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
      </div>
    </div>
  )
}
