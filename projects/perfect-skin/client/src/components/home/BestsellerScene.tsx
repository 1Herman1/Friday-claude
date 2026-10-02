import { useEffect, useRef, useState } from 'react'
import { useProductDetail } from '@/hooks/useProductDetail'
import { PriceTag } from '@/components/product/PriceTag'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { Link } from 'react-router-dom'

// Ролики сцены: сегмент i — рука от товара i к товару i+1 (кадры k_i → k_{i+1}).
const SCENE = '/video/bestsellers'
const segments = ['0-1', '1-2', '2-3', '3-4']
const VIDEO_CONFIG = {
  desktop: segments.map((s) => `${SCENE}/desktop/${s}.mp4`),
  mobile: segments.map((s) => `${SCENE}/mobile/${s}.mp4`),
  // Постер ролика — его первый кадр; статичный шаг — кадр, где товар уже в руке.
  startPoster: (fmt: 'desktop' | 'mobile', idx: number) => `${SCENE}/${fmt}/k${idx}.jpg`,
  stepPoster: (fmt: 'desktop' | 'mobile', idx: number) => `${SCENE}/${fmt}/k${idx + 1}.jpg`,
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
  const videoReadyRef = useRef<boolean[]>([false, false, false, false])
  const lastVideoTimeRef = useRef<number[]>([0, 0, 0, 0])
  const [state, setState] = useState<SceneState>({ progress: 0, segment: 0, local: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const [videoReady, setVideoReady] = useState<boolean[]>([false, false, false, false])
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

  // Отслеживаем размер экрана и перезагружаем видео при смене breakpoint
  useEffect(() => {
    const handleResize = () => {
      const newIsDesktop = window.innerWidth >= 768
      if (newIsDesktop !== isDesktop) {
        setIsDesktop(newIsDesktop)
        // Перезагружаем видео при смене breakpoint чтобы применилась новая source
        videoRefs.current.forEach((video) => {
          if (video) {
            video.load()
          }
        })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isDesktop])

  // IntersectionObserver для запуска/остановки rAF и предзагрузки видео
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
        // Когда секция приближается к viewport, предзагружаем видео
        if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
          videoRefs.current.forEach((video) => {
            if (video && !video.src && !video.querySelector('source')) return
            if (video) {
              video.load()
              video
                .play()
                .then(() => video.pause())
                .catch(() => {})
            }
          })
        }
      },
      { threshold: 0.1, rootMargin: '50% 0px' }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Обработка скролла
  useEffect(() => {
    if (!isVisible || isReducedMotion) return

    const handleScroll = () => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const containerHeight = containerRef.current.scrollHeight
      const viewportHeight = window.innerHeight

      // Скролл-позиция контейнера относительно viewport
      const scrollTop = -rect.top
      const scrollProgress = Math.max(0, Math.min(1, scrollTop / (containerHeight - viewportHeight)))

      const segment = Math.floor(scrollProgress * 4)
      const localRaw = (scrollProgress * 4) % 1
      const local = scrollProgress >= 1 ? 1 : localRaw

      const finalSegment = scrollProgress >= 1 ? 3 : Math.min(segment, 3)

      setState({
        progress: scrollProgress,
        segment: finalSegment,
        local,
      })

      // Обновляем currentTime активного видео
      const video = videoRefs.current[finalSegment]
      if (video && video.duration) {
        const targetTime = local * video.duration
        const lastTime = lastVideoTimeRef.current[finalSegment]
        if (Math.abs(targetTime - lastTime) > video.duration / 30) {
          video.currentTime = targetTime
          lastVideoTimeRef.current[finalSegment] = targetTime
        }
      }

      // Обновляем статус готовности видео
      const newReady = [...videoReady]
      videoRefs.current.forEach((video, idx) => {
        if (video) {
          newReady[idx] = video.readyState >= 2
        }
      })
      setVideoReady(newReady)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    // Страница может открыться уже прокрученной — считаем положение сразу.
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isVisible, isReducedMotion, videoReady])

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
                  src={VIDEO_CONFIG.stepPoster(isDesktop ? 'desktop' : 'mobile', idx)}
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

  const progressBar = (
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
  )

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
        <div className="absolute inset-x-0 top-24 bottom-36 md:inset-0">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-full h-full transition-opacity duration-300 ${
                state.segment === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <video
                ref={el => {
                  videoRefs.current[idx] = el
                  if (el) {
                    const handleReady = () => {
                      const newReady = [...videoReady]
                      newReady[idx] = el.readyState >= 2
                      setVideoReady(newReady)
                      videoReadyRef.current[idx] = el.readyState >= 2
                    }
                    el.addEventListener('loadeddata', handleReady)
                    el.addEventListener('canplay', handleReady)
                    return () => {
                      el.removeEventListener('loadeddata', handleReady)
                      el.removeEventListener('canplay', handleReady)
                    }
                  }
                }}
                className="w-full h-full object-cover md:object-center"
                style={
                  !isDesktop
                    ? { objectPosition: 'center 88%' }
                    : undefined
                }
                poster={VIDEO_CONFIG.startPoster(isDesktop ? 'desktop' : 'mobile', idx)}
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
              {/* Overlay постера пока видео не готово */}
              {state.segment === idx && !videoReady[idx] && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <img
                    src={VIDEO_CONFIG.startPoster(isDesktop ? 'desktop' : 'mobile', idx)}
                    alt=""
                    className="w-full h-full object-cover"
                    style={
                      !isDesktop
                        ? { objectPosition: 'center 88%' }
                        : undefined
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Карточка товара - десктоп (слева) */}
        <div className="hidden md:flex absolute inset-y-0 left-12 items-center justify-start pointer-events-none">
          {(() => {
            const currentProduct = visibleProducts[state.segment]
            if (!currentProduct || !currentProduct.data) return null

            const productData = currentProduct.data
            return (
              <div
                className={`bg-card rounded-block shadow-lg p-5 pointer-events-auto max-w-sm transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none motion-reduce:translate-x-0 ${
                  state.local > 0.5
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-4'
                }`}
              >
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

        {/* Карточка товара - мобильный (снизу) */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 h-36 flex flex-col justify-end gap-2 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          {progressBar}
          {(() => {
            const currentProduct = visibleProducts[state.segment]
            if (!currentProduct || !currentProduct.data) return null

            const productData = currentProduct.data
            return (
              <div
                className={`bg-card rounded-block shadow-md px-3 py-2.5 flex items-center gap-3 pointer-events-auto transition-all duration-200 ${
                  state.local > 0.5
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-6'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {productData.brand && (
                    <div className="text-[10px] leading-tight uppercase tracking-wide text-muted-foreground">
                      {productData.brand.name}
                    </div>
                  )}
                  <h3 className="text-xs font-heading font-semibold text-foreground line-clamp-2 leading-snug">
                    {productData.name}
                  </h3>
                  <div className="mt-1">
                    <PriceTag
                      price={productData.minPrice}
                      oldPrice={productData.oldPrice ?? undefined}
                      hidden={productData.priceHidden}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="shrink-0 w-32">
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
              </div>
            )
          })()}
        </div>

        {/* Полоса прогресса (десктоп) */}
        <div className="hidden md:block absolute md:bottom-12 md:left-12 md:right-12 z-20">
          {progressBar}
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
        className="w-full py-2 px-4 bg-accent text-accent-foreground text-center font-sans font-medium rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11 flex items-center justify-center text-xs md:text-sm"
      >
        Для специалистов
      </Link>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={!product?.inStock || state === 'loading'}
      className="w-full py-2 px-4 bg-primary text-primary-foreground font-sans font-medium rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 min-h-11 text-xs md:text-sm"
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
