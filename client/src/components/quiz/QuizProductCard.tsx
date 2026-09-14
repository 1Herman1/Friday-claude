import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import type { QuizProductCard as QuizProductCardType } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { CheckIcon } from '../icons'

const ADDED_CLASS = 'rounded-pill min-h-[2.75rem] bg-white border border-line text-navy-900 font-semibold text-[13px]'
const OUTLINE_CLASS = 'btn-glow rounded-pill min-h-[2.75rem] bg-white border border-ink text-ink font-semibold text-[13px] [@media(hover:hover)]:hover:bg-ink [@media(hover:hover)]:hover:text-white transition-colors'

interface QuizProductCardProps {
  product: QuizProductCardType
  variant?: 'main' | 'alt'
  onAddToCart?: () => void
  added?: boolean
}

export default function QuizProductCard({
  product,
  variant = 'main',
  onAddToCart,
  added = false,
}: QuizProductCardProps) {
  const isMain = variant === 'main'
  const [isAdding, setIsAdding] = useState(false)
  const { addItem } = useCart()

  const handleAddToCart = async () => {
    if (!product.variant || isAdding) return

    setIsAdding(true)
    try {
      await addItem(product.variant.id, 1)
      onAddToCart?.()
    } catch (error) {
      console.error('Failed to add to cart:', error)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <article
      className={`relative bg-white rounded-card border border-line overflow-hidden hover:shadow-card transition-shadow duration-100 ease ${
        isMain ? 'md:flex gap-6' : ''
      }`}
    >
      {/* Image container */}
      <div
        className={`${
          isMain ? 'md:w-1/2' : 'w-full'
        } bg-blue-50 flex items-center justify-center ${
          isMain ? 'h-80 md:h-96' : 'h-48'
        } relative flex-shrink-0`}
      >
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            width={600}
            height={600}
            loading="lazy"
            decoding="async"
          />
        )}

        {/* Badges */}
        {product.badges.length > 0 && (
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {product.badges.map((badge) => (
              <span
                key={badge}
                className="bg-white/90 text-navy-700 text-xs font-medium px-2 py-1 rounded-full shadow-sm"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${isMain ? 'md:w-1/2' : 'w-full'} p-4 md:p-6 flex flex-col`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-navy-500">{product.brandName}</p>
          {product.matchScore >= 0.6 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-900 tabular-nums">
              <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
              Совпадение {Math.round(Math.min(100, product.matchScore * 100))}%
            </span>
          )}
        </div>

        <h3 className="text-lg md:text-xl font-semibold text-navy-900 mb-3 flex-1">
          <Link to={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {product.name}
          </Link>
        </h3>

        {/* Price */}
        <div className="mb-4">
          {product.variant && (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-navy-900 tabular-nums">
                  {formatPrice(product.variant.price)}
                </span>
                {product.variant.oldPrice && (
                  <span className="text-sm text-navy-300 line-through tabular-nums">
                    {formatPrice(product.variant.oldPrice)}
                  </span>
                )}
              </div>
              <p className="text-xs text-navy-500 tabular-nums">
                Вес: {product.variant.weight} кг
              </p>
            </>
          )}
        </div>

        {/* CTA Button */}
        {product.variant && (
          <button
            onClick={handleAddToCart}
            disabled={isAdding}
            className={`relative z-10 w-full py-3 duration-100 ease disabled:opacity-50 disabled:cursor-not-allowed ${
              added ? ADDED_CLASS : isMain ? 'btn-primary border border-transparent' : OUTLINE_CLASS
            }`}
          >
            {added ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                <CheckIcon className="ico-draw w-4 h-4 text-success" />
                В корзине
              </span>
            ) : (
              'В корзину'
            )}
          </button>
        )}
      </div>
    </article>
  )
}
