import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFavorites } from '../../context/FavoritesContext'
import { useCart } from '../../context/CartContext'
import { formatPrice, pluralize } from '../../lib/format'
import { PawIcon, HeartSolidIcon } from '../icons'
import SideDrawer from './SideDrawer'

type Props = {
  open: boolean
  onClose: () => void
}

export default function FavoritesDrawer({ open, onClose }: Props) {
  const { items, remove, count } = useFavorites()
  const { addItem } = useCart()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const handleRemove = async (productId: string) => {
    setRemovingId(productId)
    setError('')
    try {
      await remove(productId)
      setTimeout(() => {
        setRemovingId(null)
      }, 300)
    } catch (err: any) {
      setRemovingId(null)
      setError(err?.response?.data?.error || 'Ошибка при удалении из избранного')
    }
  }

  const handleClearAll = async () => {
    const prevItems = items
    setError('')

    const results = await Promise.allSettled(items.map(fav => remove(fav.productId)))

    const failed = results
      .map((result, idx) => (result.status === 'rejected' ? prevItems[idx] : null))
      .filter((fav): fav is (typeof items)[0] => fav !== null)

    if (failed.length > 0) {
      setError(`Не удалось удалить ${pluralize(failed.length, 'товар', 'товара', 'товаров')}`)
    }
  }

  const handleAddToCart = async (productId: string) => {
    try {
      const favorite = items.find(f => f.productId === productId)
      if (!favorite) return
      await addItem(favorite.product.variants[0].id, 1)
      setAddedIds(prev => new Set([...prev, productId]))
      setTimeout(() => {
        setAddedIds(prev => {
          const next = new Set(prev)
          next.delete(productId)
          return next
        })
      }, 1500)
    } catch { /* ignore */ }
  }

  // Контент
  let content: React.ReactNode

  if (items.length === 0) {
    content = (
      <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
        <PawIcon className="w-12 h-12 text-navy-200" />
        <p className="text-center">
          <span className="block font-bold text-navy-900 mb-1">Здесь пока пусто</span>
          <span className="block text-sm text-navy-500">Нажмите на сердечко у товара — он сохранится здесь</span>
        </p>
        <Link
          to="/catalog"
          onClick={onClose}
          className="btn-primary px-6 py-2"
        >
          Перейти в каталог
        </Link>
      </div>
    )
  } else {
    content = (
      <>
        {/* Ошибка */}
        {error && (
          <div className="mx-4 mt-3 rounded-card bg-red-50 text-destructive text-sm px-3 py-2 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Скрыть сообщение"
              className="text-destructive hover:text-red-700 ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Список товаров */}
        <ul className="px-4 divide-y divide-line">
          {items.map(favorite => {
            const product = favorite.product
            const variant = product.variants[0]
            const isAdded = addedIds.has(product.id)

            return (
              <li
                key={favorite.productId}
                className={`flex gap-3 py-4 transition-opacity duration-200 ease-smooth ${
 removingId === product.id ? 'opacity-0' : 'opacity-100'
 }`}
 >
 <Link
 to={`/product/${product.slug}`}
 onClick={onClose}
 className="flex-shrink-0 w-16 h-16 bg-blue-50 flex items-center justify-center overflow-hidden"
 >
 {product.images[0] ? (
 <img src={product.images[0]} className="max-h-full max-w-full object-contain p-1"alt={product.name} />
 ) : (
 <PawIcon className="w-8 h-8 text-navy-200"/>
 )}
 </Link>
 <div className="flex-1 min-w-0">
 <Link
 to={`/product/${product.slug}`}
 onClick={onClose}
 className="block text-navy-900 leading-snug line-clamp-2 hover:text-primary-hover"
 >
 {product.name}
 </Link>
 <p className="mt-0.5 text-navy-500">{variant.weight} кг</p>
 <div className="mt-2 flex items-center justify-between gap-2">
 {/* Кнопка"В корзину"*/}
 <button
 type="button"
 onClick={() => handleAddToCart(product.id)}
 className={`btn-primary h-9 px-3 ${
 isAdded ? 'bg-white border border-line text-navy-900' : ''
 }`}
                    >
                      {isAdded ? 'Добавлено' : 'В корзину'}
                    </button>

                    {/* Цена */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-navy-900 tabular-nums">
                        {formatPrice(variant.price)}
                      </span>
                      {variant.oldPrice && (
                        <span className="text-xs text-navy-300 line-through tabular-nums">
                          {formatPrice(variant.oldPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Убрать из избранного"
                  onClick={() => handleRemove(product.id)}
                  className="btn-press flex-shrink-0 w-11 h-11 flex items-center justify-center text-destructive hover:text-red-700"
                >
                  <HeartSolidIcon className="w-4 h-4 fill-current text-red-500" />
                </button>
              </li>
            )
          })}
        </ul>
      </>
    )
  }

  // Шапка с кнопкой "Очистить всё"
  const titleSuffix = count > 0 ? <span className="text-base font-normal text-navy-400">({count})</span> : null

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Избранное"
      titleSuffix={titleSuffix}
    >
      <>
        {items.length > 0 && (
          <div className="px-4 pt-3 flex justify-end">
            <button
              type="button"
              onClick={handleClearAll}
              className="btn-press text-sm text-navy-500 hover:text-destructive"
            >
              Очистить всё
            </button>
          </div>
        )}
        {content}
      </>
    </SideDrawer>
  )
}
