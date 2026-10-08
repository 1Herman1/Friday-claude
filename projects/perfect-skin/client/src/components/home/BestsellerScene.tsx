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
  const primedRef = useRef(false)
  const targetRef = useRef({ idx: 0, frac: 0 })
  const rafRef = useRef<number | null>(null)
  const smoothRef = useRef([0, 0, 0, 0])

  const tick = () => {
    rafRef.current = null
    const { idx, frac } = targetRef.current
    const video = videoRefs.current[idx]
    if (!video || !video.duration) return
    const target = frac * (video.duration - 0.05)
    const cur = smoothRef.current[idx]
    const next = Math.abs(target - cur) < 1 / 60 ? target : cur + (target - cur) * 0.18
    smoothRef.current[idx] = next
    if (!video.seeking) video.currentTime = next
    if (next !== target) rafRef.current = requestAnimationFrame(tick)
  }
  const videoReadyRef = useRef<boolean[]>([false, false, false, false])
  const [state, setState] = useState<SceneState>({ progress: 0, segment: 0, local: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const [isNear, setIsNear] = useState(false)
  const [, setVideoReady] = useState<boolean[]>([false, false, false, false])
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const markReady = () =>
    setVideoReady((prev) => {
      const next = prev.map((r, i) => r || (videoRefs.current[i]?.readyState ?? 0) >= 2)
      return next.every((r, i) => r === prev[i]) ? prev : next
    })
  // Десктоп: ролик не скрабится скроллом. Один жест — один ролик с родной скоростью,
  // остановка на товаре. stop = товар в руке (0..3), playing = индекс играющего ролика.
  const [stop, setStop] = useState(-1)
  const [playing, setPlaying] = useState<number | null>(null)
  const [playFrac, setPlayFrac] = useState(0)
  const stopRef = useRef(-1)
  const playingRef = useRef<number | null>(null)
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)

  // Загружаем товары по слагам
  const products = PRODUCT_SLUGS.map(slug => ({
    slug,
    ...useProductDetail(slug),
  }))

  const { addItem } = useCart()
  const { openCart } = useDrawer()
  const { user } = useAuth()

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

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
        primedRef.current = false
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
        if (!primedRef.current && (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight)) {
          primedRef.current = true
          setIsNear(true)
          videoRefs.current.forEach((video) => {
            if (!video) return
            video.muted = true
            video.setAttribute('muted', '')
            video
              .play()
              .then(() => video.pause())
              .catch(() => {})
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

      if (window.innerWidth >= 768) {
        onDesktopScroll(Math.min(4, Math.floor(scrollProgress * 5)) - 1, rect.top <= 1 && rect.bottom >= viewportHeight - 1)
        markReady()
        return
      }

      setState({
        progress: scrollProgress,
        segment: finalSegment,
        local,
      })

      const moveShare = 0.7
      const k = Math.min(1, local / moveShare)
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      targetRef.current = { idx: finalSegment, frac: scrollProgress >= 1 ? 1 : eased }
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick)

      markReady()
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    // Страница может открыться уже прокрученной — считаем положение сразу.
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isVisible, isReducedMotion])

  // Компьютер: один жест колеса или тачпада — один шаг. Пока сцена закреплена, прокрутку
  // страницы гасим сами: инерция тачпада не проскакивает товары, а после четвёртого товара
  // сцену отпускает только новый жест. Жест во время ролика сразу доводит его до товара
  // и запускает следующий — быстрый скролл не ждёт конца анимации.
  useEffect(() => {
    if (!isVisible || isReducedMotion || !isDesktop) return
    let lastTs = 0
    let lastAbs = 0
    let lastStepTs = 0
    const placeAt = (seg: number, el: HTMLElement) => {
      const span = el.scrollHeight - window.innerHeight
      const top = el.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: top + span * ((seg + 1.1) / 5), behavior: 'instant' as ScrollBehavior })
    }
    const onWheel = (e: WheelEvent) => {
      const el = containerRef.current
      if (!el || Math.abs(e.deltaY) < 1) return
      const now = performance.now()
      const dt = now - lastTs
      const abs = Math.abs(e.deltaY)
      const notch = e.deltaMode === 1 || (abs >= 50 && abs === Math.round(abs) && (dt > 180 || Math.abs(abs - lastAbs) < 1))
      const fresh = dt > 180 || (notch && now - lastStepTs > 220) || (abs > lastAbs * 1.6 && abs > 30 && now - lastStepTs > 300)
      lastTs = now
      lastAbs = abs
      const rect = el.getBoundingClientRect()
      if (rect.top > 1 || rect.bottom < window.innerHeight - 1) return
      const down = e.deltaY > 0
      const playingNow = playingRef.current
      const at = playingNow ?? stopRef.current
      e.preventDefault()
      if (!fresh) return
      lastStepTs = now
      if (down) {
        if (playingNow !== null) {
          finishClip(playingNow)
          if (playingNow < 3) {
            segRef.current = playingNow + 1
            startClip(playingNow + 1)
            placeAt(playingNow + 1, el)
          }
          return
        }
        if (at >= 3) {
          const span = el.scrollHeight - window.innerHeight
          window.scrollTo({ top: rect.top + window.scrollY + span + 2, behavior: 'instant' as ScrollBehavior })
          return
        }
        segRef.current = at + 1
        startClip(at + 1)
        placeAt(at + 1, el)
        return
      }
      const prev = playingNow !== null ? playingNow - 1 : at - 1
      if (playingNow === null && at < 0) {
        window.scrollTo({ top: rect.top + window.scrollY - 2, behavior: 'instant' as ScrollBehavior })
        return
      }
      placeAt(prev, el)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [isVisible, isReducedMotion, isDesktop])

  // Ролики целиком в памяти до показа: потоковая догрузка подвешивала 3-й и 4-й ролик.
  // Пока ролик шага не в памяти (медленная сеть, экономия трафика), сцена листает
  // стоп-кадры — без пустого экрана и подвисаний; догрузился — дальше идёт видео.
  const [blobs, setBlobs] = useState<(string | null)[]>([null, null, null, null])
  const blobsRef = useRef(blobs)
  blobsRef.current = blobs
  useEffect(() => {
    if (!isNear || isReducedMotion) return
    let alive = true
    const urls: string[] = []
    const probe = document.createElement('video')
    // VP9 в 4–5 раз легче H.264 при том же качестве (SSIM 0,99); mp4 — для Safari.
    const ext = probe.canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'mp4'
    const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (net?.saveData || /(^|-)2g$/.test(net?.effectiveType ?? '')) return
    const list = isDesktop ? VIDEO_CONFIG.desktop : VIDEO_CONFIG.mobile
    list.forEach(async (src, i) => {
      try {
        const res = await fetch(src.replace(/\.mp4$/, `.${ext}`))
        if (!res.ok) return
        const url = URL.createObjectURL(await res.blob())
        urls.push(url)
        if (alive) setBlobs((prev) => prev.map((b, j) => (j === i ? url : b)))
      } catch {
        // Без ролика шаг остаётся стоп-кадром.
      }
    })
    return () => {
      alive = false
      urls.forEach((u) => URL.revokeObjectURL(u))
      setBlobs([null, null, null, null])
    }
  }, [isNear, isReducedMotion, isDesktop])

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

  // Десктоп, как на витрине: пока крутят колесо — ролик идёт с родной скоростью,
  // перестали — замирает; быстрый скролл сразу переключает на следующий ролик.
  // Сегмент 0 — статичный кадр «первый товар в руке», сегменты 1..3 — ролики.
  // Ролик всегда доигрывает до товара: быстрый скролл ставит следующие в очередь.
  const segRef = useRef(-1)
  function startClip(clip: number) {
    if (!blobsRef.current[clip]) {
      segRef.current = Math.max(segRef.current, clip)
      playingRef.current = null
      stopRef.current = clip
      setStop(clip)
      setPlaying(null)
      return
    }
    const video = videoRefs.current[clip]
    playingRef.current = clip
    setPlaying(clip)
    setPlayFrac(0)
    if (!video) return
    video.currentTime = 0
    video.onended = () => {
      if (playingRef.current !== clip) return
      playingRef.current = null
      stopRef.current = clip
      setStop(clip)
      setPlaying(null)
      if (segRef.current > clip) startClip(clip + 1)
    }
    video.ontimeupdate = () => video.duration && setPlayFrac(video.currentTime / video.duration)
    video.play().catch(() => {})
  }
  // Жест во время ролика: ролик сразу встаёт на свой товар.
  function finishClip(clip: number) {
    const video = videoRefs.current[clip]
    if (video) {
      video.onended = null
      video.pause()
      if (video.duration) video.currentTime = video.duration
    }
    playingRef.current = null
    stopRef.current = clip
    setStop(clip)
    setPlaying(null)
  }
  // Остановки: -1 — рука над товарами, 0..3 — товар в руке; ролик c ведёт к товару c.
  function onDesktopScroll(seg: number, pinned: boolean) {
    segRef.current = seg
    if ((!pinned && playingRef.current === null) || seg < stopRef.current || (playingRef.current !== null && seg < playingRef.current)) {
      if (playingRef.current !== null) videoRefs.current[playingRef.current]?.pause()
      playingRef.current = null
      stopRef.current = seg
      setStop(seg)
      setPlaying(null)
      if (seg < 0 && videoRefs.current[0]) videoRefs.current[0].currentTime = 0
      return
    }
    // Скролл только запускает ролик; дальше он сам доигрывает до товара.
    if (playingRef.current === null && seg > stopRef.current) startClip(stopRef.current + 1)
  }

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
            <p className="text-label font-semibold uppercase tracking-wide text-primary lg:text-body-sm">Выбор косметологов</p>
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

  const fmt: 'desktop' | 'mobile' = isDesktop ? 'desktop' : 'mobile'
  // Десктоп: segment = видимый ролик; на остановке — точный кадр товара stop.
  const view = isDesktop
    ? { segment: playing ?? Math.max(stop, 0), isHold: playing === null && stop >= 0, cardIdx: playing ?? stop, local: playing !== null ? playFrac : stop >= 0 ? 1 : 0 }
    : {
        segment: state.segment,
        isHold: state.progress >= 1 || state.local >= (blobs[state.segment] ? 0.7 : 0.5),
        // Карточка держится между остановками: до новой остановки показан предыдущий товар.
        cardIdx: state.local > 0.55 || state.progress >= 1 ? state.segment : state.segment - 1,
        local: state.local,
      }
  const isHold = view.isHold
  const cardIdx = view.cardIdx
  const cardProduct = cardIdx >= 0 ? products[cardIdx] : undefined
  const cardData = cardProduct?.data
  const mProduct = cardProduct ?? products[0]
  const mData = mProduct?.data
  const addCurrent = async () => {
    if (cardData?.variants[0]) {
      await addItem(cardData.variants[0].id, 1)
      openCart()
    }
  }

  const progressBar = (
    <div className="flex gap-2">
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                className="h-1 flex-1 bg-foreground/10 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-primary"
                  style={{
                    width:
                      view.segment > idx
                        ? '100%'
                        : view.segment === idx
                          ? `${view.local * 100}%`
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
      <div ref={stickyRef} className="sticky top-0 h-screen overflow-hidden bg-background">
        {/* Видео фреймы */}
        <div className="absolute inset-x-0 top-24 bottom-0 overflow-hidden md:inset-0">
          {/* Телефон: кадр крупнее в 1,8 раза — центр масштаба на ряду товаров */}
          <div className="absolute inset-0 max-md:scale-[1.8] max-md:origin-[50%_50%]">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-300 ${
                view.segment === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <video
                ref={el => {
                  videoRefs.current[idx] = el
                  if (el) {
                    el.muted = true
                    el.setAttribute('muted', '')
                    const handleReady = () => {
                      videoReadyRef.current[idx] = el.readyState >= 2
                      markReady()
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
                    ? { objectPosition: 'center top' }
                    : undefined
                }
                src={blobs[idx] ?? undefined}
                poster={VIDEO_CONFIG.startPoster(fmt, idx)}
                muted
                playsInline
                preload="auto"
                aria-hidden="true"
              />
              {/* Остановка: точный кадр «товар в руке» поверх ролика */}
              <img
                src={VIDEO_CONFIG.stepPoster(fmt, idx)}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                  view.segment === idx && isHold ? 'opacity-100' : 'opacity-0'
                }`}
                style={!isDesktop ? { objectPosition: 'center top' } : undefined}
              />
              {/* Ролик ещё не в памяти — стартовый кадр шага, на остановке он растворяется в кадр товара */}
              {view.segment === idx && !blobs[idx] && (
                <img
                  src={VIDEO_CONFIG.startPoster(fmt, idx)}
                  alt=""
                  aria-hidden="true"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHold ? 'opacity-0' : 'opacity-100'}`}
                  style={!isDesktop ? { objectPosition: 'center top' } : undefined}
                />
              )}
            </div>
          ))}
          </div>
        </div>

        {/* Мягкий стык фона с соседними секциями */}
        <div aria-hidden="true" className="absolute inset-x-0 top-24 md:top-0 h-24 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
        {/* Компьютер: края кадра (дорисованная стена и стол) растворяются в фоне страницы */}
        <div aria-hidden="true" className="hidden md:block absolute inset-y-0 left-0 w-[44%] bg-gradient-to-r from-background from-30% via-background/60 via-60% to-transparent pointer-events-none z-10" />
        <div aria-hidden="true" className="hidden md:block absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-background via-background/50 to-transparent pointer-events-none z-10" />
        <div aria-hidden="true" className="hidden md:block absolute inset-y-0 right-0 w-[12%] bg-gradient-to-l from-background via-background/50 to-transparent pointer-events-none z-10" />

        {/* Слой по сетке container-app: заголовок, карточка, прогресс */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="container-app h-full">
            <div className="relative h-full">
              <div className="absolute top-6 md:top-12 left-0">
                <p className="text-label font-semibold uppercase tracking-wide text-primary mb-2 lg:text-body-sm">Выбор косметологов</p>
                <h2 className="text-h2 font-heading font-bold min-[1800px]:text-[clamp(3rem,2.6vw,4.25rem)]">Бестселлеры</h2>
              </div>

              {/* Карточка товара - десктоп */}
              <div className="hidden md:block absolute left-0 bottom-[17%]">
                {cardData && cardProduct && (
                  <div
                    className={`bg-card rounded-block shadow-lg w-[clamp(22rem,24vw,32rem)] p-[clamp(1.25rem,1.3vw,2rem)] transition-[opacity,transform,visibility] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                      cardIdx >= 0
                        ? 'opacity-100 translate-x-0 visible pointer-events-auto'
                        : 'opacity-0 -translate-x-4 invisible pointer-events-none'
                    }`}
                  >
                    <div key={cardProduct.slug} className="animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none">
                      {cardData.brand && (
                        <div className="text-label uppercase text-muted-foreground mb-2 min-[1800px]:text-body-sm">{cardData.brand.name}</div>
                      )}
                      <h3 className="text-[clamp(1rem,0.4rem+0.75vw,1.5rem)] font-heading font-bold text-foreground mb-2 text-balance">
                        <Link to={`/product/${cardProduct.slug}`} className="hover:text-primary hover:underline underline-offset-4 transition-colors duration-200">
                          {cardData.name}
                        </Link>
                      </h3>
                      {cardData.variants[0] && (
                        <div className="text-[clamp(0.75rem,0.3rem+0.5vw,1rem)] text-muted-foreground mb-3">{cardData.variants[0].volumeLabel}</div>
                      )}
                      <div className="mb-4 [&_.text-lg]:text-[clamp(1.125rem,0.5rem+0.8vw,1.75rem)]">
                        <PriceTag
                          price={cardData.minPrice}
                          oldPrice={cardData.oldPrice ?? undefined}
                          hidden={cardData.priceHidden}
                          size="lg"
                        />
                      </div>
                      <ProductCardButton product={cardData} user={user} onAddToCart={addCurrent} />
                    </div>
                  </div>
                )}
              </div>

              {/* Полоса прогресса (десктоп) */}
              <div className="hidden md:block absolute bottom-12 inset-x-0">{progressBar}</div>
            </div>
          </div>
        </div>

        {/* Карточка товара - мобильный (снизу); до первого товара — невидимая заглушка, чтобы полоса прогресса не прыгала */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 z-20 h-36 flex flex-col justify-end gap-2 px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          {progressBar}
          {mData && mProduct && (
            <div
              className={`bg-card rounded-block shadow-md px-3 py-2.5 flex items-center gap-3 transition-[opacity,transform,visibility] duration-200 ${
                cardIdx >= 0
                  ? 'opacity-100 translate-y-0 visible pointer-events-auto'
                  : 'opacity-0 translate-y-6 invisible pointer-events-none'
              }`}
            >
              <div key={mProduct.slug} className="min-w-0 flex-1 animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none">
                {mData.brand && (
                  <div className="text-label leading-tight uppercase tracking-wide text-muted-foreground">
                    {mData.brand.name}
                  </div>
                )}
                <h3 className="text-sm font-heading font-semibold text-foreground line-clamp-3 leading-snug min-h-[3lh]">
                  <Link to={`/product/${mProduct.slug}`} className="hover:text-primary hover:underline underline-offset-4">
                    {mData.name}
                  </Link>
                </h3>
                <div className="mt-1">
                  <PriceTag
                    price={mData.minPrice}
                    oldPrice={mData.oldPrice ?? undefined}
                    hidden={mData.priceHidden}
                    size="sm"
                  />
                </div>
              </div>
              <div className="shrink-0 w-28">
                <ProductCardButton product={mData} user={user} onAddToCart={addCurrent} />
              </div>
            </div>
          )}
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
        className="w-full py-2 px-4 bg-accent text-accent-foreground text-center font-heading font-bold rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11 flex items-center justify-center text-body-sm"
      >
        Для специалистов
      </Link>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={!product?.inStock || state === 'loading'}
      className="w-full py-2 px-4 bg-primary text-primary-foreground font-heading font-bold rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 min-h-11 text-body-sm"
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
