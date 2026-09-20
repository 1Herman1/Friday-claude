import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CheckIcon, PawIcon, HeartIcon, HeartSolidIcon } from '../icons'
import { useCart } from '../../context/CartContext'
import { useFavorites } from '../../context/FavoritesContext'
import type { Product } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { isSellable } from '@simba/shared'
import { apiErrorMessage } from '../../lib/api-error'

export default function ProductCard({ product }: { product: Product }) {
  const firstSellable = useMemo(() => product.variants.find(v => isSellable(v)), [product.variants])
  const [selectedVariant, setSelectedVariant] = useState(firstSellable ?? product.variants[0])
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const { addItem } = useCart()
  const { isFavorite, toggle } = useFavorites()
  const liked = isFavorite(product.id)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await addItem(selectedVariant.id, 1)
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
    } catch (err) {
      const message = apiErrorMessage(err, 'Не получилось добавить товар')
      setError(message)
      setTimeout(() => setError(null), 2000)
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await toggle(product.id)
    } catch {
      // ignore
    }
  }

  // Ни одной продаваемой фасовки: карточка не должна рекламировать ни цену,
  // ни скидку, ни остаток — иначе рядом с «Нет в наличии» висит «0 ₽» и «−100%».
  const unavailable = !isSellable(selectedVariant)

  const discount = selectedVariant.oldPrice
    ? Math.round((1 - selectedVariant.price / selectedVariant.oldPrice) * 100)
    : null

  return (
    <Link to={`/product/${product.slug}`}
      className="group bg-white rounded-card overflow-hidden hover:shadow-card hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-100 ease flex flex-col">

      {/* Изображение */}
      <div
        className="relative bg-white h-44 flex items-center justify-center border-b border-line overflow-hidden group"
        onMouseMove={(e) => {
          if (product.images.length <= 1) return
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left) / rect.width
          const index = Math.min(Math.floor(x * product.images.length), product.images.length - 1)
          setActiveImageIndex(index)
        }}
        onMouseLeave={() => setActiveImageIndex(0)}>
        {product.images[activeImageIndex] ? (
          <img
            src={product.images[activeImageIndex]}
            alt={product.name}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain p-2 transition-opacity duration-100 ease"
          />
        ) : product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <PawIcon className="w-16 h-16 text-navy-100" />
        )}
        {discount && !unavailable && (
          <span className="absolute top-2 left-2 bg-amber-400 text-navy-900 text-xs font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </span>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {product.isGrainFree && (
            <span className="bg-white/90 text-navy-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full shadow-sm">Без зерна</span>
          )}
          {product.isHypoallergenic && (
            <span className="bg-white/90 text-navy-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full shadow-sm">Гипоалл.</span>
          )}
        </div>

        {product.images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none group-hover:opacity-100 lg:opacity-0 transition-opacity">
            {product.images.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-[width,background-color] ${
                  i === activeImageIndex ? 'bg-navy-700 w-2' : 'bg-navy-200 w-1.5'
                }`}
              />
            ))}
          </div>
        )}

        <button
          onClick={handleToggleFavorite}
          aria-label={liked ? 'Убрать из избранного' : 'Добавить в избранное'}
          className="btn-press absolute bottom-2 right-2 w-11 h-11 bg-white rounded-full shadow-sm flex items-center justify-center">
          {liked ? (
            <HeartSolidIcon className={`w-4 h-4 transition-colors fill-current text-red-500 ico-pop`} key="on" />
          ) : (
            <HeartIcon className={`w-4 h-4 transition-colors fill-none stroke-navy-300`} key="off" />
          )}
        </button>
      </div>

      {/* Контент */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-navy-500 mb-1">{product.brand?.name ?? ''}</p>
        <h3 className="text-sm font-semibold text-navy-900 mb-2 flex-1"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {product.name}
        </h3>

        <div className="flex flex-wrap gap-1 mb-3">
          {product.variants.map(v => {
            const sellable = isSellable(v)
            return (
              <button
                key={v.id}
                onClick={e => { e.preventDefault(); if (sellable) setSelectedVariant(v) }}
                disabled={!sellable}
                className={`btn-press text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  !sellable
                    ? 'border-line text-navy-300 cursor-not-allowed bg-blue-50'
                    : selectedVariant.id === v.id
                    ? 'bg-ink border-ink text-white font-medium'
                    : 'border-line text-navy-700 [@media(hover:hover)]:hover:border-ink'
                }`}>
                {v.weight} кг{!sellable && ' — нет'}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {unavailable ? (
            // Цену показываем приглушённой, если она есть: у распроданного товара
            // она осмысленна, а у незаполненного импортом (price = 0) — нет.
            // «Нет в наличии» уже написано на кнопке, второй раз не повторяем.
            selectedVariant.price > 0 && (
              <span className="text-lg font-bold text-navy-300">{formatPrice(selectedVariant.price)}</span>
            )
          ) : (
            <>
              <span className="text-lg font-bold text-navy-900">
                {formatPrice(selectedVariant.price)}
              </span>
              {selectedVariant.oldPrice && (
                <span className="text-sm text-navy-300 line-through">
                  {formatPrice(selectedVariant.oldPrice)}
                </span>
              )}
            </>
          )}
        </div>

        {!unavailable && (
          <p className={`text-xs font-medium mb-3 ${
            selectedVariant.stock <= 5 ? 'text-destructive' : 'text-navy-500'
          }`}>
            Есть в наличии: {selectedVariant.stock}
          </p>
        )}

        <button
          onClick={handleAddToCart}
          disabled={unavailable}
          className={`w-full py-2 rounded-pill ${
            error
              ? 'bg-white border border-destructive text-destructive'
              : added
                ? 'bg-white border border-line text-navy-900'
                : unavailable
                  ? 'bg-blue-50 border border-line text-navy-400 cursor-not-allowed'
                  : 'btn-primary'
          }`}>
          {error ? (
            <span className="text-xs">{error}</span>
          ) : added ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <CheckIcon className="w-4 h-4 text-success" />
              Добавлено
            </span>
          ) : unavailable ? (
            'Нет в наличии'
          ) : (
            'В корзину'
          )}
        </button>
      </div>
    </Link>
  )
}
