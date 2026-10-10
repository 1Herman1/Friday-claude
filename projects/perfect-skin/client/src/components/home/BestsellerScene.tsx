import { useEffect, useRef, useState } from 'react'
import { useProductDetail } from '@/hooks/useProductDetail'
import { PriceTag } from '@/components/product/PriceTag'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { Link } from 'react-router-dom'
import { splitName } from '@/lib/split-name'
import { setScenePinned, useScenePinned } from '@/lib/scene-pin'
import { isAutoScrolling } from '@/lib/scroll-top'

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

// Горизонтальный ролик — только на широком экране; планшет стоя получает вертикальный,
// иначе обрезка по краям прячет четвёртый товар.
function isWideScene() {
  return window.innerWidth >= 768 && window.innerWidth / window.innerHeight >= 1.2
}

// Ролики играют сами; первый (самый спокойный) чуть быстрее, остальные — родной скоростью
const PLAY_RATE = { desktop: [1.4, 1.05, 1, 1], mobile: [1.25, 1.05, 1, 1] }
// Телефон: ряд товаров в кадре 9:16 — по центру на 51 % высоты кадра
const MOBILE_BAND = 0.51

export function BestsellerScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null, null])
  const primedRef = useRef(false)
  const videoReadyRef = useRef<boolean[]>([false, false, false, false])
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
  const fillRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])
  const stopRef = useRef(-1)
  const playingRef = useRef<number | null>(null)
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? isWideScene() : true)

  // Загружаем товары по слагам
  const products = PRODUCT_SLUGS.map(slug => ({
    slug,
    ...useProductDetail(slug),
  }))

  const { addItem } = useCart()
  const { openCart } = useDrawer()
  const { user } = useAuth()

  // Своя плавная прокрутка при выходе из сцены: пока она идёт, телефон её не ловит
  const releasingRef = useRef(false)
  // Пока сцена закреплена, браузер не начинает прокрутку от касания вовсе — свайп превращается в шаг
  const scenePinned = useScenePinned()
  useEffect(() => () => {
    playingRef.current = null
    setScenePinned(false)
    document.documentElement.style.overflow = ''
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
      const newIsDesktop = isWideScene()
      if (newIsDesktop !== isDesktop) {
        setIsDesktop(newIsDesktop)
        setScenePinned(false)
        // Другой формат — другие ролики: играющий ролик не доиграет, сцена встаёт в начало.
        videoRefs.current.forEach((video) => {
          if (video) {
            video.onended = null
            video.ontimeupdate = null
            video.pause()
          }
        })
        playingRef.current = null
        stopRef.current = -1
        segRef.current = -1
        setPlaying(null)
        setStop(-1)
        setPlayFrac(0)
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
        }
      },
      { threshold: 0.1, rootMargin: '50% 0px' }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [isReducedMotion])

  // Шаг сцены: anchor — положение страницы для остановки seg (-1 — рука над товарами)
  const anchorOf = (seg: number, el: HTMLElement) => {
    const span = el.scrollHeight - window.innerHeight
    return el.getBoundingClientRect().top + window.scrollY + span * ((seg + 1.1) / 5)
  }
  const placeAt = (seg: number, el: HTMLElement) =>
    window.scrollTo({ top: anchorOf(seg, el), behavior: 'instant' as ScrollBehavior })
  // Один жест — один шаг. Жест во время ролика сразу ставит его товар и запускает следующий;
  // после четвёртого товара жест уводит к следующей секции, до первого — к предыдущей.
  const releaseTimer = useRef(0)
  const release = () => {
    releasingRef.current = true
    window.clearTimeout(releaseTimer.current)
    releaseTimer.current = window.setTimeout(() => { releasingRef.current = false }, 1200)
  }
  const step = (down: boolean) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const playingNow = playingRef.current
    const at = playingNow ?? stopRef.current
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
        release()
        window.scrollTo({ top: rect.top + window.scrollY + el.scrollHeight, behavior: 'smooth' })
        return
      }
      segRef.current = at + 1
      startClip(at + 1)
      placeAt(at + 1, el)
      return
    }
    if (playingNow === null && at < 0) {
      release()
      window.scrollTo({ top: rect.top + window.scrollY - window.innerHeight, behavior: 'smooth' })
      return
    }
    const prev = playingNow !== null ? playingNow - 1 : at - 1
    jumpTo(prev)
    placeAt(prev, el)
  }

  // Обработка скролла
  useEffect(() => {
    if (!isVisible || isReducedMotion) return

    let freezeTimer = 0
    const handleScroll = () => {
      const el = containerRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const scrollProgress = Math.max(0, Math.min(1, -rect.top / (el.scrollHeight - viewportHeight)))
      const pinned = rect.top <= 1 && rect.bottom >= viewportHeight - 1

      // Телефон: пока сцена на экране — шапка и нижняя панель спрятаны
      setScenePinned(pinned && !isWideScene())
      if (!isWideScene()) {
        if (!pinned) releasingRef.current = false
        else if (!releasingRef.current && !isAutoScrolling()) {
          // Страница внутри сцены сдвинулась не свайпом сцены (инерция броска, начатое
          // снаружи перетаскивание) — ловим её на текущем шаге, товары не проскакивают.
          const anchor = anchorOf(playingRef.current ?? stopRef.current, el)
          if (Math.abs(window.scrollY - anchor) > 2) {
            const root = document.documentElement
            root.style.overflow = 'hidden'
            window.scrollTo({ top: anchor, behavior: 'instant' as ScrollBehavior })
            window.clearTimeout(freezeTimer)
            freezeTimer = window.setTimeout(() => { root.style.overflow = '' }, 120)
            return
          }
        }
      }
      onDesktopScroll(Math.min(4, Math.floor(scrollProgress * 5)) - 1, pinned)
      markReady()
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    // Страница может открыться уже прокрученной — считаем положение сразу.
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.clearTimeout(freezeTimer)
      document.documentElement.style.overflow = ''
      setScenePinned(false)
    }
  }, [isVisible, isReducedMotion])

  // Колесо и тачпад: один жест — один шаг. Пока сцена закреплена, прокрутку страницы гасим
  // сами: инерция тачпада не проскакивает товары, а после четвёртого товара сцену отпускает
  // только новый жест.
  useEffect(() => {
    if (!isVisible || isReducedMotion) return
    let lastTs = 0
    let lastAbs = 0
    let lastStepTs = 0
    const onWheel = (e: WheelEvent) => {
      const el = containerRef.current
      // Колесо над корзиной, поиском и другими слоями поверх сцены — их собственное.
      if (!el || e.ctrlKey || Math.abs(e.deltaY) < 1 || !(e.target instanceof Node) || !el.contains(e.target)) return
      const now = performance.now()
      const dt = now - lastTs
      const abs = Math.abs(e.deltaY)
      const notch = e.deltaMode === 1 || (abs >= 50 && abs === Math.round(abs) && (dt > 180 || Math.abs(abs - lastAbs) < 1))
      const fresh = dt > 180 || (notch && now - lastStepTs > 220) || (abs > lastAbs * 1.6 && abs > 30 && now - lastStepTs > 300)
      lastTs = now
      lastAbs = abs
      const rect = el.getBoundingClientRect()
      if (rect.top > 1 || rect.bottom < window.innerHeight - 1) return
      e.preventDefault()
      if (!fresh) return
      lastStepTs = now
      step(e.deltaY > 0)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [isVisible, isReducedMotion])

  // Телефон и планшет: один свайп — один шаг. Пока сцена закреплена, страница не прокручивается
  // (preventDefault на touchmove) — поэтому и панели браузера не выезжают.
  useEffect(() => {
    if (!isVisible || isReducedMotion || isDesktop) return
    let startedPinned = false
    let startY = 0
    let stepped = false
    const pinnedNow = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return r.top <= 1 && r.bottom >= window.innerHeight - 1
    }
    const onStart = (e: TouchEvent) => {
      const el = containerRef.current
      if (!el || e.touches.length !== 1) return
      // Касание во время плавного выхода — пользователь перехватил управление
      releasingRef.current = false
      startedPinned = pinnedNow(el)
      startY = e.touches[0].clientY
      stepped = false
    }
    const onMove = (e: TouchEvent) => {
      const el = containerRef.current
      if (!el || !startedPinned || e.touches.length !== 1 || !(e.target instanceof Node) || !el.contains(e.target)) return
      if (e.cancelable) e.preventDefault()
      if (stepped) return
      const dy = e.touches[0].clientY - startY
      if (Math.abs(dy) < 24) return
      stepped = true
      step(dy < 0)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
    }
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
    const abort = new AbortController()
    const probe = document.createElement('video')
    // VP9 в 4–5 раз легче H.264 при том же качестве (SSIM 0,99); mp4 — для Safari.
    const ext = probe.canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'mp4'
    const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (net?.saveData || /(^|-)2g$/.test(net?.effectiveType ?? '')) return
    const list = isDesktop ? VIDEO_CONFIG.desktop : VIDEO_CONFIG.mobile
    list.forEach(async (src, i) => {
      try {
        const res = await fetch(src.replace(/\.mp4$/, `.${ext}`), { signal: abort.signal })
        // Сервер на несуществующий файл может вернуть index.html со статусом 200.
        if (!res.ok || !res.headers.get('content-type')?.startsWith('video/')) return
        const blob = await res.blob()
        if (!alive) return
        const url = URL.createObjectURL(blob)
        urls.push(url)
        setBlobs((prev) => prev.map((b, j) => (j === i ? url : b)))
      } catch {
        // Без ролика шаг остаётся стоп-кадром.
      }
    })
    return () => {
      alive = false
      abort.abort()
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
      // Ролик ещё не в памяти — стоп-кадры: сразу встаём туда, куда прокрутили.
      const target = Math.min(3, Math.max(segRef.current, clip))
      segRef.current = target
      playingRef.current = null
      stopRef.current = target
      setStop(target)
      setPlaying(null)
      return
    }
    const video = videoRefs.current[clip]
    playingRef.current = clip
    setPlaying(clip)
    setPlayFrac(0)
    if (!video) return
    video.currentTime = 0
    video.playbackRate = PLAY_RATE[isWideScene() ? 'desktop' : 'mobile'][clip]
    video.onended = () => {
      if (playingRef.current !== clip) return
      playingRef.current = null
      stopRef.current = clip
      setStop(clip)
      setPlaying(null)
      if (segRef.current > clip) startClip(clip + 1)
    }
    video.ontimeupdate = () => {
      if (playingRef.current === clip && video.duration) setPlayFrac(video.currentTime / video.duration)
    }
    // Бегунок идёт за роликом каждый кадр, а не 4 раза в секунду, как timeupdate.
    const follow = () => {
      if (playingRef.current !== clip) return
      const fill = fillRefs.current[clip]
      if (fill && video.duration) fill.style.width = `${(video.currentTime / video.duration) * 100}%`
      requestAnimationFrame(follow)
    }
    requestAnimationFrame(follow)
    // pause() от следующего жеста отклоняет play() с AbortError — это не сбой ролика
    video.play().catch((e: unknown) => {
      if ((e as { name?: string })?.name !== 'AbortError' && playingRef.current === clip) finishClip(clip)
    })
  }
  // Жест во время ролика: ролик сразу встаёт на свой товар.
  function finishClip(clip: number) {
    const video = videoRefs.current[clip]
    if (video) {
      video.onended = null
      video.ontimeupdate = null
      video.pause()
      if (video.duration) video.currentTime = video.duration
    }
    playingRef.current = null
    stopRef.current = clip
    setStop(clip)
    setPlaying(null)
  }
  // Назад и вне сцены — без проигрывания: сразу точный кадр шага seg.
  function jumpTo(seg: number) {
    if (playingRef.current !== null) videoRefs.current[playingRef.current]?.pause()
    playingRef.current = null
    stopRef.current = seg
    segRef.current = seg
    setStop(seg)
    setPlaying(null)
    if (seg < 0 && videoRefs.current[0]) videoRefs.current[0].currentTime = 0
  }
  // Остановки: -1 — рука над товарами, 0..3 — товар в руке; ролик c ведёт к товару c.
  function onDesktopScroll(seg: number, pinned: boolean) {
    segRef.current = seg
    if ((!pinned && playingRef.current === null) || seg < stopRef.current || (playingRef.current !== null && seg < playingRef.current)) {
      jumpTo(seg)
      return
    }
    // Скролл только запускает ролик; дальше он сам доигрывает до товара.
    if (playingRef.current === null && seg > stopRef.current) startClip(stopRef.current + 1)
  }

  // Вычисляем высоту контейнера (~520vh)

  // Проверяем загрузку товаров

  if (isReducedMotion) {
    // Режим reduced-motion: показываем 4 статичных шага в виде списка
    return (
      <section className="bg-background">
        <div className="container-app py-16 space-y-12">
          <div className="space-y-4">
            <p className="text-label font-semibold uppercase tracking-wide text-primary lg:text-body-sm">Выбор косметологов</p>
            <h2 className="text-h2 font-heading font-bold">Бестселлеры</h2>
          </div>

          {products.map((product, idx) => product.data && (
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
  // segment = видимый ролик; на остановке — точный кадр товара stop.
  const view = {
    segment: playing ?? Math.max(stop, 0),
    isHold: playing === null && stop >= 0,
    cardIdx: playing ?? stop,
    local: playing !== null ? playFrac : stop >= 0 ? 1 : 0,
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
                  ref={(el) => { fillRefs.current[idx] = el }}
                  className={`h-full bg-primary ${
                    playing === idx
                      ? ''
                      : 'transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none'
                  }`}
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
    <section ref={containerRef} style={{ height: '520vh' }} className="bg-background">
      {/* Скринридер и клавиатура: все четыре товара сразу, без привязки к прокрутке сцены */}
      <ul className="sr-only" aria-label="Бестселлеры">
        {products.map((p) => p.data && (
          <li key={p.slug}>
            <Link to={`/product/${p.slug}`} tabIndex={-1}>{p.data.name}</Link>
          </li>
        ))}
      </ul>
      {/* Sticky container */}
      <div ref={stickyRef} className={`sticky top-0 h-screen overflow-hidden bg-background ${isDesktop ? '' : 'supports-[height:100dvh]:h-dvh'} ${scenePinned ? 'touch-none' : ''}`}>
        {/* Видео фреймы */}
        {/* Телефон: кадр 9:16 во всю ширину, ряд товаров — посередине между заголовком и карточкой */}
        <div
          className={`absolute overflow-hidden ${isDesktop ? 'inset-0' : 'inset-x-0 aspect-[9/16] [mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_86%,transparent)]'}`}
          style={isDesktop ? undefined : { top: `calc((100dvh - 4rem) / 2 - ${(MOBILE_BAND * 1600) / 9}vw)` }}
        >
          <div className="absolute inset-0">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`absolute inset-0 ${
                view.segment === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <video
                ref={el => {
                  videoRefs.current[idx] = el
                  // Колбэк вызывается на каждом рендере — слушатели вешаем один раз на элемент
                  if (el && !el.dataset.wired) {
                    el.dataset.wired = '1'
                    el.muted = true
                    el.setAttribute('muted', '')
                    const handleReady = () => {
                      videoReadyRef.current[idx] = el.readyState >= 2
                      markReady()
                    }
                    el.addEventListener('loadeddata', handleReady)
                    el.addEventListener('canplay', handleReady)
                  }
                }}
                className="w-full h-full object-cover"
                src={blobs[idx] ?? undefined}
                poster={VIDEO_CONFIG.startPoster(fmt, idx)}
                muted
                playsInline
                preload="auto"
                aria-hidden="true"
              />
              {/* Остановка: кадр «товар в руке» — тот же, что последний кадр ролика, поэтому подмена мгновенная */}
              <img
                src={VIDEO_CONFIG.stepPoster(fmt, idx)}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 w-full h-full object-cover ${
                  view.segment === idx && isHold ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {/* Ролик ещё не в памяти — стартовый кадр шага, на остановке он растворяется в кадр товара */}
              {view.segment === idx && !blobs[idx] && (
                <img
                  src={VIDEO_CONFIG.startPoster(fmt, idx)}
                  alt=""
                  aria-hidden="true"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHold ? 'opacity-0' : 'opacity-100'}`}
                />
              )}
            </div>
          ))}
          </div>
        </div>

        {/* Мягкий стык фона с соседними секциями */}
        <div aria-hidden="true" className={`absolute inset-x-0 top-0 h-24 ${isDesktop ? '' : 'hidden'} bg-gradient-to-b from-background to-transparent pointer-events-none z-10`} />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
        {/* Компьютер: края кадра (дорисованная стена и стол) растворяются в фоне страницы */}
        <div aria-hidden="true" className={`${isDesktop ? '' : 'hidden'} absolute inset-y-0 left-0 w-[44%] bg-gradient-to-r from-background from-30% via-background/60 via-60% to-transparent pointer-events-none z-10`} />
        <div aria-hidden="true" className={`${isDesktop ? '' : 'hidden'} absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-background via-background/50 to-transparent pointer-events-none z-10`} />
        <div aria-hidden="true" className={`${isDesktop ? '' : 'hidden'} absolute inset-y-0 right-0 w-[12%] bg-gradient-to-l from-background via-background/50 to-transparent pointer-events-none z-10`} />

        {/* Слой по сетке container-app: заголовок, карточка, прогресс */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="container-app h-full">
            <div className="relative h-full">
              <div className={`absolute left-0 ${isDesktop ? 'top-12' : 'top-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))]'}`}>
                <p className="text-label font-semibold uppercase tracking-wide text-primary mb-2 lg:text-body-sm">Выбор косметологов</p>
                <h2 className="text-h2 font-heading font-bold min-[1800px]:text-[clamp(3rem,2.6vw,4.25rem)]">Бестселлеры</h2>
              </div>

              {/* Карточка товара - десктоп */}
              <div className={`absolute left-0 top-[54%] -translate-y-[8.5rem] min-[1800px]:-translate-y-[9rem] ${isDesktop ? '' : 'hidden'}`}>
                {cardData && cardProduct && (
                  <div
                    className={`bg-card rounded-block shadow-lg w-[24rem] p-[clamp(1.5rem,1.7vw,2.5rem)] min-[1800px]:p-7 [&_button]:min-h-12 [&_a.rounded-pill]:min-h-12 transition-[opacity,transform,visibility] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                      cardIdx >= 0
                        ? 'opacity-100 translate-x-0 visible pointer-events-auto'
                        : 'opacity-0 -translate-x-4 invisible pointer-events-none'
                    }`}
                  >
                    <div key={cardProduct.slug} className="animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none">
                      {cardData.brand && (
                        <div className="text-label font-semibold uppercase tracking-wide text-muted-foreground mb-2 min-[1800px]:text-body-sm">{cardData.brand.name}</div>
                      )}
                      <h3 className="text-[clamp(1.25rem,0.55rem+0.95vw,1.625rem)] min-[1800px]:text-[1.4375rem] leading-tight font-heading font-bold text-foreground mb-3 text-pretty">
                        <Link to={`/product/${cardProduct.slug}`} className="hover:text-primary hover:underline underline-offset-4 transition-colors duration-200">
                          <span className="block">{splitName(cardData.name).title}</span>{' '}
                          <span className="block">{splitName(cardData.name).desc}</span>
                        </Link>
                      </h3>
                      {cardData.variants[0] && (
                        <div className="text-[clamp(0.875rem,0.4rem+0.5vw,1.125rem)] text-muted-foreground mb-4">{cardData.variants[0].volumeLabel}</div>
                      )}
                      <div className="mb-5 [&_.text-lg]:text-[clamp(1.5rem,0.7rem+1.1vw,2.25rem)]">
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

              {/* Подсказка на входе в сцену: исчезает после первого шага */}
              <p
                aria-hidden={cardIdx >= 0}
                className={`absolute bottom-[4.5rem] left-0 flex items-center gap-2 text-body-sm text-muted-foreground transition-opacity duration-300 ${isDesktop ? '' : 'hidden'} ${cardIdx >= 0 ? 'opacity-0' : 'opacity-100'}`}
              >
                <svg width="16" height="22" viewBox="0 0 16 22" fill="none" aria-hidden="true" className="shrink-0">
                  <rect x="1" y="1" width="14" height="20" rx="7" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="7" y="5" width="2" height="5" rx="1" fill="currentColor" className="motion-safe:animate-pulse" />
                </svg>
                Прокрутите — рука покажет каждый товар
              </p>
              {/* Полоса прогресса (десктоп) */}
              <div className={`absolute bottom-12 inset-x-0 ${isDesktop ? '' : 'hidden'}`}>{progressBar}</div>
            </div>
          </div>
        </div>

        {/* Карточка товара - мобильный (снизу); до первого товара — невидимая заглушка, чтобы полоса прогресса не прыгала */}
        <div className={`${isDesktop ? 'hidden' : ''} absolute bottom-0 left-0 right-0 z-20 h-36 flex flex-col justify-end gap-2 px-6 md:px-12 md:[&>*]:max-w-[30rem] pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none`}>
          {progressBar}
          <div className="relative">
          <p aria-hidden={cardIdx >= 0} className={`absolute inset-0 flex items-center text-body-sm text-muted-foreground transition-opacity duration-300 ${cardIdx >= 0 ? 'opacity-0' : 'opacity-100'}`}>
            Листайте — рука покажет каждый товар
          </p>
          {mData && mProduct && (
            <div
              className={`relative bg-card rounded-block shadow-md px-4 py-3 flex items-center gap-3 transition-[opacity,transform,visibility] duration-200 ${
                cardIdx >= 0
                  ? 'opacity-100 translate-y-0 visible pointer-events-auto'
                  : 'opacity-0 translate-y-6 invisible pointer-events-none'
              }`}
            >
              <div key={mProduct.slug} className="min-w-0 flex-1 animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none">
                {mData.brand && (
                  <div className="text-label leading-tight uppercase tracking-wide text-muted-foreground">
                    {mData.brand.name}
                    {mData.variants[0]?.volumeLabel && <span className="font-semibold normal-case"> · {mData.variants[0].volumeLabel}</span>}
                  </div>
                )}
                <h3 className="text-sm font-heading font-semibold text-foreground line-clamp-3 leading-snug min-h-[3lh] md:min-h-0">
                  {/* Вся карточка — ссылка на товар (растянутая ссылка); кнопка «В корзину» лежит выше неё */}
                  <Link
                    to={`/product/${mProduct.slug}`}
                    className="hover:text-primary hover:underline underline-offset-4 after:absolute after:inset-0 after:rounded-block after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
                  >
                    <span className="block">{splitName(mData.name).title}</span>{' '}
                    <span className="block font-normal">{splitName(mData.name).desc}</span>
                  </Link>
                </h3>
              </div>
              <div key={mProduct.slug} className="relative z-10 shrink-0 w-28 flex flex-col items-center gap-1.5">
                <PriceTag
                  price={mData.minPrice}
                  oldPrice={mData.oldPrice ?? undefined}
                  hidden={mData.priceHidden}
                  size="lg"
                />
                <ProductCardButton product={mData} user={user} onAddToCart={addCurrent} />
              </div>
            </div>
          )}
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
      className="w-full py-2 px-3 leading-tight bg-primary text-primary-foreground font-heading font-bold rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 min-h-11 text-body-sm"
    >
      {state === 'success'
        ? 'Добавлено'
        : state === 'loading'
          ? 'Добавляю...'
          : product?.inStock
            ? 'В корзину'
            : 'Нет в наличии'}
    </button>
  )
}
