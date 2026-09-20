import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFavorites } from '@/context/FavoritesContext'
import { useCart } from '@/context/CartContext'
import { formatPrice } from '@/lib/format'
import { fetchApi } from '@/lib/api'
import { IconHeartSolid, IconHeart } from '../icons'
import SideDrawer from '../cart/SideDrawer'
import type { ProductCardExtended } from '@/types/api'

type Props = {
  open: boolean
  onClose: () => void
}

export default function FavoritesDrawer({ open, onClose }: Props) {
  const { slugs, remove, clear, count } = useFavorites()
  const { addItem } = useCart()

  const [products, setProducts] = useState<Map<string, ProductCardExtended>>(new Map())
  const [loading, setLoading] = useState(false)
  const [removingSlug, setRemovingSlug] = useState<string | null>(null)
  const [addedSlugs, setAddedSlugs] = useState<Set<string>>(new Set())
  const cacheRef = useRef<Map<string, ProductCardExtended>>(new Map())

  // Загружаем товары батчами при открытии и смене favorite list
  useEffect(() => {
    if (!open) return
    if (slugs.size === 0) {
      // «Очистить всё»: без этого карта товаров переживает опустошение слагов.
      setProducts(new Map())
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        // Определяем, какие товары нужно загрузить
        const toLoad = Array.from(slugs).filter(slug => !cacheRef.current.has(slug))

        if (toLoad.length === 0) {
          // Уже все в кэше — выстраиваем в порядке slugs
          const ordered = new Map<string, ProductCardExtended>()
          slugs.forEach(slug => {
            const product = cacheRef.current.get(slug)
            if (product) ordered.set(slug, product)
          })
          setProducts(ordered)
          return
        }

        // Батчим по 6
        const batchSize = 6
        const results = new Map<string, ProductCardExtended>()

        for (let i = 0; i < toLoad.length; i += batchSize) {
          const batch = toLoad.slice(i, i + batchSize)

          const batchResults = await Promise.allSettled(
            batch.map(slug =>
              fetchApi<ProductCardExtended>(`/api/v1/products/${slug}`)
            )
          )

          batchResults.forEach((result, idx) => {
            const slug = batch[idx]
            if (result.status === 'fulfilled') {
              const product = result.value
              cacheRef.current.set(slug, product)
              results.set(slug, product)
            } else {
              // Протухший slug — удаляем из избранного
              remove(slug)
            }
          })
        }

        // Собираем в порядке slugs: кэшированные + новые
        const ordered = new Map<string, ProductCardExtended>()
        slugs.forEach(slug => {
          const cached = cacheRef.current.get(slug)
          if (cached) ordered.set(slug, cached)
        })

        setProducts(ordered)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [open, slugs, remove])

  const handleRemove = (slug: string) => {
    setRemovingSlug(slug)
    setTimeout(() => {
      remove(slug)
      setRemovingSlug(null)
    }, 300)
  }

  const handleClearAll = () => {
    clear()
  }

  const handleAddToCart = async (slug: string) => {
    const product = products.get(slug)
    if (!product || !product.inStock || product.variants.length === 0) return

    try {
      await addItem(product.variants[0].id, 1)
      setAddedSlugs(prev => new Set([...prev, slug]))
      setTimeout(() => {
        setAddedSlugs(prev => {
          const next = new Set(prev)
          next.delete(slug)
          return next
        })
      }, 1500)
    } catch {
      // Ошибка будет показана в CartDrawer
    }
  }

  // Пустое состояние
  if (!loading && products.size === 0) {
    return (
      <SideDrawer open={open} onClose={onClose} title="Избранное">
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
          <IconHeart className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-heading font-bold text-foreground mb-1">Здесь пока пусто</p>
            <p className="text-sm text-muted-foreground">Нажмите на сердечко у товара — он сохранится здесь</p>
          </div>
          <Link
            to="/catalog/all"
            onClick={onClose}
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11"
          >
            В каталог
          </Link>
        </div>
      </SideDrawer>
    )
  }

  // Скелет загрузки
  if (loading && products.size === 0) {
    return (
      <SideDrawer open={open} onClose={onClose} title="Избранное">
        <div className="px-4 py-4 flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 py-4 animate-pulse">
              <div className="w-16 h-16 bg-muted rounded-media flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 bg-muted rounded-block w-3/4" />
                <div className="h-3 bg-muted rounded-block w-1/2" />
                <div className="h-8 bg-muted rounded-pill w-20 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </SideDrawer>
    )
  }

  // Список товаров
  const productList = (
    <ul className="px-4 divide-y divide-border">
      {Array.from(products.values()).map(product => {
        const variant = product.variants[0]
        const isAdded = addedSlugs.has(product.slug)
        const isFading = removingSlug === product.slug

        return (
          <li
            key={product.slug}
            className={`flex gap-3 py-4 transition-opacity duration-300 ease-smooth ${
              isFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {/* Image */}
            <Link
              to={`/product/${product.slug}`}
              onClick={onClose}
              className="flex-shrink-0 w-16 h-16 rounded-media bg-muted flex items-center justify-center overflow-hidden"
            >
              {product.image ? (
                <img
                  src={`/products-optimized/${product.slug}/card.webp`}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    // Fallback на product.image если optimized недоступна
                    const img = e.target as HTMLImageElement
                    if (product.image && img.src !== product.image) {
                      img.src = product.image
                    }
                  }}
                />
              ) : (
                <div className="text-muted-foreground text-xs">Нет фото</div>
              )}
            </Link>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Link
                to={`/product/${product.slug}`}
                onClick={onClose}
                className="block text-sm font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors"
              >
                {product.name}
              </Link>

              {/* Volume */}
              {variant.volumeLabel && (
                <p className="text-xs text-muted-foreground mt-1">{variant.volumeLabel}</p>
              )}

              {/* Price */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {formatPrice(variant.retailPrice)}
                </span>
                {variant.oldRetailPrice && (
                  <span className="text-xs text-muted-foreground line-through tabular-nums">
                    {formatPrice(variant.oldRetailPrice)}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              {/* Add to Cart */}
              <button
                type="button"
                onClick={() => handleAddToCart(product.slug)}
                disabled={!product.inStock}
                className={`h-9 px-3 rounded-pill text-xs font-bold transition-colors duration-200 min-h-11 ${
                  isAdded
                    ? 'bg-white border border-border text-foreground'
                    : product.inStock
                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                      : 'opacity-50 cursor-not-allowed bg-primary text-primary-foreground'
                }`}
              >
                {isAdded ? 'Добавлено ✓' : product.inStock ? 'В корзину' : 'Нет в наличии'}
              </button>

              {/* Remove */}
              <button
                type="button"
                onClick={() => handleRemove(product.slug)}
                aria-label="Убрать из избранного"
                className="w-11 h-11 flex items-center justify-center hover:bg-muted rounded-pill transition-colors duration-200"
              >
                <IconHeartSolid className="w-5 h-5 text-primary" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )

  // Footer с "Очистить всё"
  const footerContent = count > 0 ? (
    <button
      type="button"
      onClick={handleClearAll}
      className="w-full py-3 px-6 border border-border text-foreground font-semibold rounded-pill hover:bg-muted transition-colors duration-200"
    >
      Очистить всё
    </button>
  ) : null

  const titleSuffix = count > 0 ? <span className="text-base font-normal text-muted-foreground">({count})</span> : null

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Избранное"
      titleSuffix={titleSuffix}
      footer={footerContent}
    >
      {productList}
    </SideDrawer>
  )
}
