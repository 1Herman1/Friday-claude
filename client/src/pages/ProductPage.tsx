import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { productsApi, type Product, type ProductVariant } from '../lib/api'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { formatPrice } from '../lib/format'
import { HeartIcon, HeartSolidIcon, CheckIcon } from '../components/icons'
import { isSellable } from '@simba/shared'
import { apiErrorMessage } from '../lib/api-error'
import { useDeliveryOptions, etaLabel } from '../hooks/useDeliveryOptions'
import ProductReviews from '../components/product/ProductReviews'

export default function ProductPage() {
  const deliveryOptions = useDeliveryOptions()
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [activeTab, setActiveTab] = useState<'about' | 'specs' | 'reviews'>('about')
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [mode, setMode] = useState<'once' | 'subscription'>('once')
  const [intervalWeeks, setIntervalWeeks] = useState(2)
  const { addItem } = useCart()
  const { isFavorite, toggle } = useFavorites()

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    productsApi.bySlug(slug)
      .then(res => {
        setProduct(res.data)
        setRelated(res.data.related ?? [])
        const firstSellable = res.data.variants.find(v => isSellable(v))
        setSelectedVariant(firstSellable ?? res.data.variants[0] ?? null)
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [slug])

  const availableTabs = useMemo(() => {
    if (!product) return []
    return [
      { key: 'about' as const, label: 'О товаре', enabled: product.showAboutTab !== false },
      { key: 'specs' as const, label: 'Характеристики', enabled: product.showSpecsTab !== false },
      { key: 'reviews' as const, label: 'Отзывы', enabled: product.showReviewsTab !== false },
    ].filter(t => t.enabled)
  }, [product?.showAboutTab, product?.showSpecsTab, product?.showReviewsTab])

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(t => t.key === activeTab)) {
      setActiveTab(availableTabs[0].key)
    }
  }, [availableTabs, activeTab])

  const handleAddToCart = async () => {
    if (!selectedVariant) return
    setError(null)
    try {
      await addItem(selectedVariant.id, quantity, {
        isSubscription: mode === 'subscription',
        intervalWeeks: mode === 'subscription' ? intervalWeeks : undefined,
      })
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } catch (err) {
      const message = apiErrorMessage(err, 'Не получилось добавить товар')
      setError(message)
      setTimeout(() => setError(null), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!product || !selectedVariant) {
    return (
      <div className="min-h-[100dvh] bg-blue-50 flex flex-col items-center justify-center gap-4">
        <p className="text-navy-500 text-lg">Товар не найден</p>
        <Link to="/catalog" className="text-navy-700 hover:text-primary-hover transition-colors duration-100 ease">В каталог</Link>
      </div>
    )
  }

  const discount = selectedVariant.oldPrice
    ? Math.round((1 - selectedVariant.price / selectedVariant.oldPrice) * 100)
    : null

  return (
    <div className="min-h-[100dvh] bg-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-4">

        {/* Хлебные крошки */}
        <nav className="flex items-center gap-2 text-sm text-navy-300 mb-6 flex-wrap">
          <Link to="/" className="hover:text-primary-hover transition-colors">Главная</Link>
          <span>/</span>
          <Link to="/catalog" className="hover:text-primary-hover transition-colors">Каталог</Link>
          <span>/</span>
          <Link to="/catalog?category=cats-food" className="hover:text-primary-hover transition-colors">Корм для кошек</Link>
          <span>/</span>
          <span className="text-navy-700 truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Основной блок */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

          {/* Левая колонка — Галерея */}
          <div className="flex gap-3">
            {/* Миниатюры */}
            {product.images.length > 1 && (
              <div className="flex flex-col gap-2">
                {product.images.slice(0, 4).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-16 rounded-xl bg-white border flex items-center justify-center text-2xl transition-[border-color,box-shadow] overflow-hidden ${
                      activeImage === i ? 'border-ink shadow-md' : 'border-line opacity-60 hover:opacity-100'
                    }`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Большое фото */}
            <div
              className="flex-1 bg-white rounded-2xl flex items-center justify-center min-h-[400px] relative overflow-hidden group"
              onMouseMove={(e) => {
                if (product.images.length <= 1) return
                const rect = e.currentTarget.getBoundingClientRect()
                const x = (e.clientX - rect.left) / rect.width
                const index = Math.min(Math.floor(x * product.images.length), product.images.length - 1)
                setActiveImage(index)
              }}
              onMouseLeave={() => setActiveImage(0)}>
              {product.images.length > 0
                ? <img src={product.images[activeImage] ?? product.images[0]} alt={product.name} className="w-full h-full object-contain p-4 transition-opacity duration-100 ease" />
                : null
              }

              {discount && (
                <span className="absolute top-4 left-4 bg-amber-400 text-navy-900 font-bold px-3 py-1 rounded-full text-sm">
                  -{discount}%
                </span>
              )}

              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {product.isGrainFree && (
                  <span className="bg-blue-100 text-navy-700 text-xs font-medium px-2 py-1 rounded-full">Без зерна</span>
                )}
                {product.isHypoallergenic && (
                  <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">Гипоалл.</span>
                )}
              </div>

              {product.images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none group-hover:opacity-100 lg:opacity-0 transition-opacity">
                  {product.images.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-[width,background-color] ${
                        i === activeImage ? 'bg-navy-700 w-2' : 'bg-navy-200 w-1.5'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Правая колонка — Инфо */}
          <div className="flex flex-col gap-4">

            {/* Бренд */}
            {product.brand && (
            <Link to={`/catalog?brand=${product.brand.slug}`}
              className="text-navy-700 font-semibold text-sm hover:text-navy-900 transition-colors w-fit">
              {product.brand.name}
            </Link>
          )}

            {/* Название */}
            <h1 className="text-xl font-bold text-navy-900 leading-snug">{product.name}</h1>

            {product.variants[0]?.sku && (
              <span className="text-navy-300 text-sm">Арт. {product.variants[0].sku}</span>
            )}

            {/* Варианты веса */}
            <div>
              <p className="text-sm text-navy-500 mb-2">Вес упаковки:</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map(v => {
                  const selected = selectedVariant.id === v.id
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`btn-press flex flex-col items-center px-4 py-2 rounded-xl border ${
                        selected
                          ? 'bg-ink border-ink text-white font-semibold'
                          : 'bg-white border-line text-navy-700 [@media(hover:hover)]:hover:border-ink'
                      }`}>
                      <span className={`font-bold ${selected ? 'text-white' : 'text-navy-900'}`}>{v.weight} кг</span>
                      <span className={`text-xs ${selected ? 'text-white/70' : 'text-navy-500'}`}>{(Math.round(v.price / v.weight) / 100).toLocaleString('ru-RU')} ₽/кг</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Режим покупки — разово или подписка */}
            <div>
              <p className="text-sm text-navy-500 mb-2">Способ покупки:</p>
              <div className="flex gap-2">
                {(['once', 'subscription'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`btn-press flex-1 px-4 py-2 rounded-xl border ${
                      mode === m
                        ? 'bg-ink border-ink text-white font-semibold'
                        : 'bg-white border-line text-navy-700 [@media(hover:hover)]:hover:border-ink'
                    }`}>
                    {m === 'once' ? 'Разово' : 'Подписка −7%'}
                  </button>
                ))}
              </div>
            </div>

            {/* Интервал подписки */}
            {mode === 'subscription' && (
              <div>
                <p className="text-sm text-navy-500 mb-2">Интервал доставки:</p>
                <div className="flex flex-wrap gap-2">
                  {[2, 4, 6, 8].map(weeks => (
                    <button
                      key={weeks}
                      onClick={() => setIntervalWeeks(weeks)}
                      className={`btn-press px-4 py-2 rounded-xl border ${
                        intervalWeeks === weeks
                          ? 'bg-ink border-ink text-white font-semibold'
                          : 'bg-white border-line text-navy-700 [@media(hover:hover)]:hover:border-ink'
                      }`}>
                      {weeks} недель
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Цена */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-black text-navy-900">
                {formatPrice(selectedVariant.price)}
              </span>
              {selectedVariant.oldPrice && (
                <span className="text-lg text-navy-300 line-through">
                  {formatPrice(selectedVariant.oldPrice)}
                </span>
              )}
              {discount && (
                <span className="text-amber-500 font-bold text-sm">Скидка {discount}%</span>
              )}
              {selectedVariant.stock > 0 && (
                <span className={`text-sm font-medium ${
                  selectedVariant.stock <= 5 ? 'text-destructive' : 'text-navy-500'
                }`}>
                  Есть в наличии: {selectedVariant.stock}
                </span>
              )}
            </div>

            {/* Количество + кнопки */}
            <div className="flex gap-3 items-center">
              {/* Счётчик */}
              <div className="flex items-center border border-blue-100 rounded-xl overflow-hidden bg-white">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="btn-press w-11 h-11 flex items-center justify-center text-navy-500 hover:bg-blue-50 text-lg font-bold">
                  −
                </button>
                <span className="w-10 text-center font-bold text-navy-900">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)}
                  className="btn-press w-11 h-11 flex items-center justify-center text-navy-500 hover:bg-blue-50 text-lg font-bold">
                  +
                </button>
              </div>

              {/* В корзину */}
              <button
                onClick={handleAddToCart}
                disabled={!selectedVariant || !isSellable(selectedVariant, quantity)}
                className={`flex-1 py-3 rounded-pill min-h-[2.75rem] border font-semibold text-[13px] ${
                  error
                    ? 'bg-white text-destructive border-destructive'
                    : added
                      ? 'bg-white border-line text-navy-900'
                      : !selectedVariant || !isSellable(selectedVariant, quantity)
                        ? 'bg-blue-50 text-navy-400 border-line cursor-not-allowed'
                        : 'btn-primary border-transparent'
                }`}>
                {error
                  ? error
                  : added
                    ? <span className="inline-flex items-center justify-center gap-1.5"><CheckIcon className="w-4 h-4 text-success" />Добавлено в корзину</span>
                    : !selectedVariant || !isSellable(selectedVariant, quantity)
                      ? 'Недостаточно товара'
                      : 'Добавить в корзину'}
              </button>

              {/* В избранное */}
              <button
                onClick={() => toggle(product.id)}
                aria-label={isFavorite(product.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                className="btn-press w-11 h-11 border border-blue-100 rounded-xl flex items-center justify-center bg-white hover:border-blue-200">
                {isFavorite(product.id) ? (
                  <HeartSolidIcon className={`w-5 h-5 transition-colors fill-current text-red-500 ico-pop`} key="on" />
                ) : (
                  <HeartIcon className={`w-5 h-5 transition-colors fill-none stroke-navy-300`} key="off" />
                )}
              </button>
            </div>

            {/* Бонусы */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-navy-900">Дарим 100 бонусов за отзыв с фото</p>
              <p className="text-xs text-navy-400">1 бонус = 1 рубль скидки на следующий заказ</p>
            </div>

            {/* Доставка */}
            <div className="bg-white rounded-xl border border-line divide-y divide-blue-50">
              {/* Способы и цены — из прайс-листа доставки, который ведёт владелец в админке. */}
              {deliveryOptions.map(d => {
                const eta = etaLabel(d)
                const desc = [
                  d.price === 0 ? 'бесплатно' : formatPrice(d.price),
                  d.freeFrom != null && d.price > 0 ? `бесплатно от ${formatPrice(d.freeFrom)}` : null,
                  eta,
                ].filter(Boolean).join(', ')
                return (
                  <div key={d.key} className="flex items-center gap-3 p-3">
                    <div className="flex-1">
                      <span className="font-medium text-navy-900 text-sm">{d.title}</span>
                      <span className="text-navy-400 text-xs ml-2">{desc}</span>
                    </div>
                  </div>
                )
              })}
              <div className="p-3">
                <Link to="/delivery" className="text-navy-700 text-xs underline underline-offset-2 hover:text-navy-900 transition-colors">Подробнее об условиях доставки</Link>
              </div>
            </div>

          </div>
        </div>

        {/* Табы */}
        {availableTabs.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden mb-8">
            <div className="flex border-b border-line">
              {availableTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`btn-press px-6 py-4 text-sm font-medium border-b-2 ${
                    activeTab === tab.key
                      ? 'border-ink text-navy-900'
                      : 'border-transparent text-navy-500 hover:text-navy-700'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'about' && (
                <div className="prose max-w-none">
                  <div className="text-navy-700 leading-relaxed whitespace-pre-line text-sm">{product.description}</div>
                  {(product.protein || product.fat) && (
                    <div className="mt-6 grid grid-cols-4 gap-4">
                      {[
                        { label: 'Белки', value: product.protein, unit: '%' },
                        { label: 'Жиры', value: product.fat, unit: '%' },
                        { label: 'Клетчатка', value: product.fiber, unit: '%' },
                        { label: 'Зола', value: product.ash, unit: '%' },
                      ].map(n => n.value && (
                        <div key={n.label} className="bg-blue-50 rounded-xl p-3 text-center">
                          <p className="text-2xl font-black text-blue-300">{n.value}</p>
                          <p className="text-xs text-navy-400">{n.label} {n.unit}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {product.ingredients && (
                    <div className="mt-4">
                      <p className="font-semibold text-navy-900 mb-1 text-sm">Состав:</p>
                      <p className="text-navy-500 text-sm">{product.ingredients}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'specs' && (
                <div className="divide-y divide-line">
                  {[
                    product.brand && { label: 'Бренд', value: product.brand.name },
                    { label: 'Белки', value: product.protein ? `${product.protein}%` : null },
                    { label: 'Жиры', value: product.fat ? `${product.fat}%` : null },
                    { label: 'Клетчатка', value: product.fiber ? `${product.fiber}%` : null },
                    { label: 'Зола', value: product.ash ? `${product.ash}%` : null },
                  ].filter((s): s is { label: string; value: string } => !!s && !!s.value).map(spec => (
                    <div key={spec.label} className="flex py-3">
                      <span className="text-navy-400 text-sm w-48 flex-shrink-0">{spec.label}</span>
                      <span className="text-navy-900 text-sm font-medium">{spec.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'reviews' && (
                <ProductReviews productId={product.id} />
              )}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-navy-900 mb-4">Похожие товары</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map(r => {
                const v = r.variants[0]
                return (
                  <Link key={r.id} to={`/product/${r.slug}`}
                    className="bg-white rounded-2xl p-4 hover:shadow-lg hover:-translate-y-1 transition-[transform,box-shadow] duration-100">
                    <div className="bg-blue-50 rounded-xl h-32 flex items-center justify-center mb-3 overflow-hidden">
                      {r.images?.[0] && <img src={r.images[0]} alt={r.name} className="w-full h-full object-cover" />}
                    </div>
                    <p className="text-xs text-navy-300 mb-1">{r.brand?.name ?? ''}</p>
                    <p className="text-sm font-semibold text-navy-900 mb-2"
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {r.name}
                    </p>
                    {v && (
                      <>
                        <p className="text-xs text-navy-400 mb-2">{v.weight} кг</p>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-navy-900">{formatPrice(v.price)}</span>
                          {v.oldPrice && <span className="text-xs text-navy-300 line-through">{formatPrice(v.oldPrice)}</span>}
                        </div>
                      </>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
