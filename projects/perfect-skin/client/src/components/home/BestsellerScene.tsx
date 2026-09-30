import { useEffect, useRef, useState } from 'react'
import { useProductDetail } from '@/hooks/useProductDetail'
import { PriceTag } from '@/components/product/PriceTag'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { Link } from 'react-router-dom'

// TODO: Заменить на реальные пути когда видеофайлы готовы
// Структура: desktop (16:9) и mobile (9:16) для каждого сегмента
const VIDEO_CONFIG = {
  desktop: [
    '/video/2-3.mp4',
    '/video/3-5.mp4',
    '/video/5-7.mp4',
    '/video/7-9.mp4',
  ],
  mobile: [
    '/video/2-3.mp4',
    '/video/3-5.mp4',
    '/video/5-7.mp4',
    '/video/7-9.mp4',
  ],
  posters: [
    '/video/posters/poster-2-3.jpg',
    '/video/posters/poster-3-5.jpg',
    '/video/posters/poster-5-7.jpg',
    '/video/posters/poster-7-9.jpg',
  ],
}

const PRODUCT_SLUGS = [
  'scrub-lotion-krem-dlya-snyatiya-makiyazha',
  'kerathor-plus-izotonicheskij-tonik',
  'hidrorrenovadora-krem-dlya-stimulirovaniya-tkanej',
  'serum-triple-accion-syvorotka-trojnogo-dejstviya',
]

interface SceneState {
  progress: number // 0..1
  segment: number // 0..3
  local: number // 0..1 внутри сегмента
}

export function BestsellerScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null, null])
  const [state, setState] = useState<SceneState>({ progress: 0, segment: 0, local: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)

  // Загружаем товары по слагам
  const products = PRODUCT_SLUGS.map(slug => ({
    slug,
    ...useProductDetail(slug),
  }))

  const { addItem } = useCart()
  const { openCart } = useDrawer()
  const { user } = useAuth()

  // Проверяем prefers-reduced-motion
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setIsReducedMotion(prefersReduced)

    const listener = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches)
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', listener)
    return () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener('change', listener)
  }, [])

  // Отслеживаем размер экрана
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // IntersectionObserver для запуска/остановки rAF
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Обработка скролла
  useEffect(() => {
    if (!isVisible || isReducedMotion) return

    let lastVideoTime = 0

    const handleScroll = () => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const containerHeight = containerRef.current.scrollHeight
      const viewportHeight = window.innerHeight

      // Скролл-позиция контейнера относительно viewport
      const scrollTop = -rect.top
      const scrollProgress = Math.max(0, Math.min(1, scrollTop / (containerHeight - viewportHeight)))

      const segment = Math.floor(scrollProgress * 4)
      const local = (scrollProgress * 4) % 1

      setState({
        progress: scrollProgress,
        segment: Math.min(segment, 3),
        local,
      })

      // Обновляем currentTime активного видео
      const video = videoRefs.current[Math.min(segment, 3)]
      if (video && video.duration) {
        const targetTime = local * video.duration
        if (Math.abs(targetTime - lastVideoTime) > video.duration / 30) {
          video.currentTime = targetTime
          lastVideoTime = targetTime
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isVisible, isReducedMotion])

  // Очищаем видео при размонтировании
  useEffect(() => {
    return () => {
      videoRefs.current.forEach(video => {
        if (video) {
          video.pause()
          video.src = ''
        }
      })
    }
  }, [])

  // Вычисляем высоту контейнера (~520vh)
  const containerHeight = typeof window !== 'undefined' ? window.innerHeight * 5.2 : 0

  // Проверяем загрузку товаров
  const visibleProducts = products.filter(p => p.data)

  if (isReducedMotion) {
    // Режим reduced-motion: показываем 4 статичных шага в виде списка
    return (
      <section className="bg-background">
        <div className="container-app py-16 space-y-12">
          <div className="space-y-4">
            <p className="text-label uppercase text-muted-foreground">Выбор косметологов</p>
            <h2 className="text-h2 font-heading font-bold">Бестселлеры</h2>
          </div>

          {visibleProducts.map((product, idx) => (
            <div
              key={product.slug}
              className="flex gap-8 items-start"
            >
              <div className="flex-shrink-0 w-32 h-32 bg-muted rounded-block overflow-hidden flex items-center justify-center">
                <img
                  src={VIDEO_CONFIG.posters[idx]}
                  alt={`Шаг ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {product.data && (
                <div className="flex-1">
                  <div className="text-label uppercase text-muted-foreground mb-2">
                    {product.data.brand?.name}
                  </div>
                  <h3 className="text-h3 font-heading font-bold mb-2">{product.data.name}</h3>
                  <div className="mb-4">
                    {product.data.variants[0] && (
                      <div className="text-sm text-muted-foreground mb-2">
                        {product.data.variants[0].volumeLabel}
                      </div>
                    )}
                    <PriceTag
                      price={product.data.minPrice}
                      oldPrice={product.data.oldPrice}
                      hidden={product.data.priceHidden}
                      size="lg"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Link
                      to={`/product/${product.slug}`}
                      className="text-primary hover:underline font-semibold text-sm"
                    >
                      Подробнее
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section ref={containerRef} style={{ height: `${containerHeight}px` }} className="bg-background">
      {/* Sticky container */}
      <div ref={stickyRef} className="sticky top-0 h-screen overflow-hidden bg-card">
        {/* Заголовок */}
        <div className="absolute top-6 left-6 md:top-12 md:left-12 z-20 pointer-events-none">
          <p className="text-label uppercase text-muted-foreground mb-2">Выбор косметологов</p>
          <h2 className="text-h2 font-heading font-bold">Бестселлеры</h2>
        </div>

        {/* Видео фреймы */}
        <div className="absolute inset-0">
          {[0, 1, 2, 3].map(idx => (
            <video
              key={idx}
              ref={el => {
                videoRefs.current[idx] = el
              }}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                state.segment === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              poster={VIDEO_CONFIG.posters[idx]}
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
            >
              <source
                src={isDesktop ? VIDEO_CONFIG.desktop[idx] : VIDEO_CONFIG.mobile[idx]}
                type="video/mp4"
              />
            </video>
          ))}
        </div>

        {/* Карточка товара - десктоп (слева) */}
        <div className="hidden md:flex absolute inset-y-0 left-0 w-1/3 items-center justify-start pointer-events-none p-6 md:p-12">
          {(() => {
            const currentProduct = visibleProducts[state.segment]
            if (!currentProduct || !currentProduct.data) return null

            const productData = currentProduct.data
            return (
              <div
                className={`bg-card rounded-block shadow-lg p-5 pointer-events-auto transition-all duration-200 ${
                  state.local > 0.5
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-12'
                }`}
              >
                {/* Фото товара */}
                {productData.image && (
                  <div className="w-32 h-40 bg-muted rounded-media overflow-hidden mb-4 flex-shrink-0">
                    <img
                      src={productData.image}
                      alt={productData.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* Бренд */}
                {productData.brand && (
                  <div className="text-label uppercase text-muted-foreground mb-2">
                    {productData.brand.name}
                  </div>
                )}

                {/* Название */}
                <h3 className="text-body font-heading font-bold text-foreground mb-2 line-clamp-2">
                  {productData.name}
                </h3>

                {/* Объём */}
                {productData.variants[0] && (
                  <div className="text-xs text-muted-foreground mb-3">
                    {productData.variants[0].volumeLabel}
                  </div>
                )}

                {/* Цена */}
                <div className="mb-4">
                  <PriceTag
                    price={productData.minPrice}
                    oldPrice={productData.oldPrice ?? undefined}
                    hidden={productData.priceHidden}
                    size="sm"
                  />
                </div>

                {/* Кнопка и ссылка */}
                <div className="flex gap-2 flex-col">
                  <ProductCardButton
                    product={productData}
                    user={user}
                    onAddToCart={async () => {
                      if (productData.variants[0]) {
                        await addItem(productData.variants[0].id, 1)
                        openCart()
                      }
                    }}
                  />
                  <Link
                    to={`/product/${currentProduct.slug}`}
                    className="text-primary hover:underline font-semibold text-xs"
                  >
                    Подробнее
                  </Link>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Карточка товара - мобильный (снизу) */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 pointer-events-none p-4 h-1/3">
          {(() => {
            const currentProduct = visibleProducts[state.segment]
            if (!currentProduct || !currentProduct.data) return null

            const productData = currentProduct.data
            return (
              <div
                className={`bg-card rounded-block shadow-lg p-4 h-full flex flex-col pointer-events-auto transition-all duration-200 ${
                  state.local > 0.5
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-12'
                }`}
              >
                {/* Название и бренд */}
                <div className="mb-2">
                  {productData.brand && (
                    <div className="text-label uppercase text-muted-foreground">
                      {productData.brand.name}
                    </div>
                  )}
                  <h3 className="text-sm font-heading font-bold text-foreground line-clamp-2">
                    {productData.name}
                  </h3>
                </div>

                {/* Цена */}
                <div className="mb-3">
                  <PriceTag
                    price={productData.minPrice}
                    oldPrice={productData.oldPrice ?? undefined}
                    hidden={productData.priceHidden}
                    size="sm"
                  />
                </div>

                {/* Кнопка */}
                <ProductCardButton
                  product={productData}
                  user={user}
                  onAddToCart={async () => {
                    if (productData.variants[0]) {
                      await addItem(productData.variants[0].id, 1)
                      openCart()
                    }
                  }}
                />
              </div>
            )
          })()}
        </div>

        {/* Полоса прогресса (снизу) */}
        <div className="absolute bottom-6 md:bottom-12 left-6 md:left-12 right-6 md:right-12 z-20">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                className="h-1 flex-1 bg-muted rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      state.segment > idx
                        ? '100%'
                        : state.segment === idx
                          ? `${state.local * 100}%`
                          : '0%',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

interface ProductCardButtonProps {
  product: any
  user: any
  onAddToCart: () => Promise<void>
}

function ProductCardButton({ product, user, onAddToCart }: ProductCardButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle')
  const isProProduct = product?.isProfessional && !isApprovedPro(user)

  const handleClick = async () => {
    if (!product?.inStock || product?.variants?.length === 0) return

    try {
      setState('loading')
      await onAddToCart()
      setState('success')
      setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('idle')
    }
  }

  if (isProProduct) {
    return (
      <Link
        to="/pro"
        className="w-full py-2 px-4 bg-accent text-accent-foreground text-center font-sans font-semibold rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11 flex items-center justify-center text-sm"
      >
        Для специалистов
      </Link>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={!product?.inStock || state === 'loading'}
      className="w-full py-2 px-4 bg-primary text-primary-foreground font-sans font-semibold rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 min-h-11 text-sm"
    >
      {state === 'success'
        ? 'Добавлено ✓'
        : state === 'loading'
          ? 'Добавляю...'
          : product?.inStock
            ? 'В корзину'
            : 'Нет в наличии'}
    </button>
  )
}
