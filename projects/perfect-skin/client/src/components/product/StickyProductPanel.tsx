import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { IconHeart, IconHeartSolid } from '../icons'
import { PriceTag } from './PriceTag'
import type { ProductCardExtended } from '@/types/api'

interface StickyProductPanelProps {
  product: ProductCardExtended
  buttonRef: React.RefObject<HTMLDivElement>
  selectedVariantId?: string
  onAddToCart?: () => void
}

export function StickyProductPanel({
  product,
  buttonRef,
  selectedVariantId,
  onAddToCart,
}: StickyProductPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { addItem } = useCart()
  const { openCart } = useDrawer()
  const { isFavorite, toggle } = useFavorites()
  const { user } = useAuth()
  const [addingState, setAddingState] = useState<'idle' | 'loading' | 'success'>('idle')

  const selectedVariant = product?.variants?.find(v => v.id === selectedVariantId) || product?.variants?.[0]
  const isFav = isFavorite(product.slug)
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

    if (onAddToCart) {
      onAddToCart()
    }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky panel when button is NOT visible
        setIsVisible(!entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    if (buttonRef.current) {
      observer.observe(buttonRef.current)
    }

    return () => {
      if (buttonRef.current) {
        observer.unobserve(buttonRef.current)
      }
    }
  }, [buttonRef])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 shadow-lg z-40 animate-in slide-in-from-bottom-2">
      <div className="container-app flex items-center justify-between gap-4">
        {/* Price */}
        <p className="font-semibold text-foreground whitespace-nowrap tabular-nums text-lg">
          <PriceTag
            price={selectedVariant?.retailPrice || null}
            oldPrice={selectedVariant?.oldRetailPrice || null}
            hidden={selectedVariant?.priceHidden}
            size="sm"
          />
        </p>

        {/* Button + Favorite */}
        <div className="flex gap-2 flex-shrink-0">
          {isVariantProOnly ? (
            <Link
              to="/pro/register"
              className="px-6 py-2.5 bg-accent text-accent-foreground text-center font-semibold rounded-full hover:opacity-90 transition-opacity whitespace-nowrap min-h-11 flex items-center"
            >
              Специалистам
            </Link>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={!product.inStock || addingState === 'loading'}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity whitespace-nowrap min-h-11"
            >
              {addingState === 'success'
                ? 'Добавлено ✓'
                : addingState === 'loading'
                  ? 'Добавляю...'
                  : product.inStock
                    ? 'В корзину'
                    : 'Недоступно'}
            </button>
          )}

          <button
            onClick={() => toggle(product.slug)}
            aria-pressed={isFav}
            aria-label={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
            className="w-11 h-11 flex items-center justify-center hover:bg-muted rounded-full transition-colors duration-200 flex-shrink-0"
          >
            {isFav ? (
              <IconHeartSolid className="w-5 h-5 text-primary" />
            ) : (
              <IconHeart className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
