import { Fragment, useEffect, useRef, useState } from 'react'
import { useProductDetail } from '@/hooks/useProductDetail'
import { PriceTag } from '@/components/product/PriceTag'
import { ProductCard } from '@/components/catalog/ProductCard'
import { useCart } from '@/context/CartContext'
import { useDrawer } from '@/context/DrawerContext'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { Link } from 'react-router-dom'
import { splitName } from '@/lib/split-name'
import { BESTSELLER_SCENE_SLUGS } from '@/components/home/bestseller-slugs'
import { setScenePinned, useScenePinned } from '@/lib/scene-pin'
import { isAutoScrolling } from '@/lib/scroll-top'

// Ролики сцены: сегмент i — рука от товара i к товару i+1 (кадры k_i → k_{i+1}).
const SCENE = '/video/bestsellers'
// Имена файлов при замене роликов не меняются — метка версии не даёт браузеру показать старые из кэша.
const MEDIA_V = '?v=20261014'
// Размытая копия стартового кадра (~0,6 КБ): видна сразу, пока кадры и ролики ещё грузятся
const SCENE_PLACEHOLDER = {
  desktop: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gAPTGF2YzYxLjMuMTAwAP/bAEMADQkKCwoIDQsKCw4ODQ8TIBUTEhITJxweFyAuKTEwLiktLDM6Sj4zNkY3LC1AV0FGTE5SU1IyPlphWlBgSlFST//bAEMBDg4OExETJhUVJk81LTVPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT//AABEIABIAIAMBIgACEQEDEQH/xAAaAAACAwEBAAAAAAAAAAAAAAAAAwEEBQYH/8QAIxAAAgICAgEEAwAAAAAAAAAAAQIAAwQRElFBFCEjgTJhkv/EABUBAQEAAAAAAAAAAAAAAAAAAAMC/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAECUf/aAAwDAQACEQMRAD8A9Gi7W4Vu5BIUE6A2TJ5ReQEtx7K391ZCCPqSpz1rXvtvTtUWO/k8fXcrFLtFTfrfSATVyHXHx7Uqx2tZiWUeORA7/cWasfe+T/yYNyaa415DfiYQiUUU7Ce4mEIdJH//2Q==',
  mobile: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gAPTGF2YzYxLjMuMTAwAP/bAEMADQkKCwoIDQsKCw4ODQ8TIBUTEhITJxweFyAuKTEwLiktLDM6Sj4zNkY3LC1AV0FGTE5SU1IyPlphWlBgSlFST//bAEMBDg4OExETJhUVJk81LTVPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT//AABEIACAAEgMBIgACEQEDEQH/xAAYAAADAQEAAAAAAAAAAAAAAAAABAUCBv/EACoQAAEEAAQEBQUAAAAAAAAAAAEAAgMRBBITIQUUMUEjMlFTYXFygZGS/8QAFgEBAQEAAAAAAAAAAAAAAAAAAwIB/8QAGREBAQEBAQEAAAAAAAAAAAAAAQACERJh/9oADAMBAAIRAxEAPwDreLTwxRtbLK1hcdgep/CkSzNByRsdJJV5elfX0T/E2Dm5peS1XxwtLH5iLt2/6HdE+CEbM0VBgF10pBoVny5CkamJ9hn9oThjdflKFHK/XysYm3F/hk5oi2wQp2PGNnhfDG7Ta5oAdTTRsKjIaOw7Jd5SLGFnXPfD7/cELF/CFPW3hf/Z',
}
const segments = ['0-1', '1-2', '2-3', '3-4']
const VIDEO_CONFIG = {
  desktop: segments.map((s) => `${SCENE}/desktop/${s}.mp4`),
  mobile: segments.map((s) => `${SCENE}/mobile/${s}.mp4`),
  // Постер ролика — его первый кадр; статичный шаг — кадр, где товар уже в руке.
  startPoster: (fmt: 'desktop' | 'mobile', idx: number) => `${SCENE}/${fmt}/k${idx}.jpg${MEDIA_V}`,
  stepPoster: (fmt: 'desktop' | 'mobile', idx: number) => `${SCENE}/${fmt}/k${idx + 1}.jpg${MEDIA_V}`,
}


// Товар снят или скрыт (API ответил 404): карточка показывает эти данные вместо пустоты
const MISSING_PRODUCTS: Record<string, { brand: string; brandSlug: string; title: string; desc: string }> = {
  'scrub-lotion-krem-dlya-snyatiya-makiyazha': { brand: 'ISSEIMI', brandSlug: 'isseimi', title: 'SCRUB LOTION', desc: 'Крем для снятия макияжа' },
  'kerathor-plus-izotonicheskij-tonik': { brand: 'ISSEIMI', brandSlug: 'isseimi', title: 'KERATHOR PLUS', desc: 'Изотонический тоник' },
  'hidrorrenovadora-krem-dlya-stimulirovaniya-tkanej': { brand: 'ISSEIMI', brandSlug: 'isseimi', title: 'HIDRORRENOVADORA', desc: 'Крем для стимулирования тканей' },
  'serum-triple-accion-syvorotka-trojnogo-dejstviya': { brand: 'GLACÉE Skincare', brandSlug: 'glacee-skincare', title: 'SERUM TRIPLE ACCIÓN', desc: 'Сыворотка тройного действия' },
}

// Зоны флаконов в процентах кадра: [слева, справа, сверху, снизу]
const BOTTLE_ZONES: Record<'desktop' | 'mobile', [left: number, right: number, top: number, bottom: number][]> = {
  desktop: [
    [45.0, 51.8, 38, 85],
    [52.4, 59.2, 38, 85],
    [59.8, 69.6, 62, 86],
    [70.2, 76.0, 46, 85],
  ],
  mobile: [
    [10, 28.5, 33, 69],
    [29.5, 47, 33, 69],
    [48, 74.5, 52, 70],
    [76, 91, 42, 69],
  ],
}

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
  const endRef = useRef<HTMLDivElement>(null)
  // Кадры сцены качаем только рядом с экраном и для текущего и соседних шагов; показанный кадр не убираем
  const shownRef = useRef(new Set<number>())
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
  const products = BESTSELLER_SCENE_SLUGS.map(slug => ({
    slug,
    ...useProductDetail(slug),
  }))

  const { addItem } = useCart()
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
  // Свой плавный уход из сцены: флаг держится до прибытия к цели, таймер — запасной
  const releaseTimer = useRef(0)
  const releaseTargetRef = useRef<number | null>(null)
  const endRelease = () => {
    releasingRef.current = false
    releaseTargetRef.current = null
    window.clearTimeout(releaseTimer.current)
  }
  const release = (target: number) => {
    const top = Math.max(0, Math.min(target, document.documentElement.scrollHeight - window.innerHeight))
    releasingRef.current = true
    releaseTargetRef.current = top
    window.clearTimeout(releaseTimer.current)
    releaseTimer.current = window.setTimeout(endRelease, 3000)
    window.scrollTo({ top, behavior: 'smooth' })
  }
  // Выход вниз: jumpTo ставит на паузу играющий ролик и встаёт на 4-м товаре, иначе ролики доиграют на ходу скролла.
  // Фокус переносится за сцену, чтобы Tab после «Пропустить» не возвращал в неё.
  const exitDown = () => {
    const el = containerRef.current
    if (!el) return
    jumpTo(3)
    release(el.getBoundingClientRect().top + window.scrollY + el.scrollHeight)
    endRef.current?.focus({ preventScroll: true })
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
        exitDown()
        return
      }
      segRef.current = at + 1
      startClip(at + 1)
      placeAt(at + 1, el)
      return
    }
    if (playingNow === null && at < 0) {
      release(rect.top + window.scrollY - window.innerHeight)
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
      if (releaseTargetRef.current !== null && Math.abs(window.scrollY - releaseTargetRef.current) <= 2) endRelease()

      // Пока сцена на экране — шапка (и на телефоне нижняя панель) спрятаны
      setScenePinned(pinned)
      if (!isWideScene()) {
        // Сцена ушла вверх за экран — уход закончен; уход вверх снимает прибытие или таймер
        if (!pinned) { if (rect.top <= 1) endRelease() }
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
      // Плавный уход вниз (release): промежуточные позиции не должны сбивать остановки и запускать ролики
      if (!releasingRef.current) onDesktopScroll(Math.min(4, Math.floor(scrollProgress * 5)) - 1, pinned)
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
      endRelease()
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
    const fmtNow = isDesktop ? 'desktop' : 'mobile'
    const preload = (src: string) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.setAttribute('fetchpriority', 'high')
        img.onload = img.onerror = () => resolve()
        img.src = src
      })
    // Очередь, а не толпа: на медленной сети параллельные ролики забирали канал у кадров,
    // и сцена стояла пустой. Сначала кадры старта и первого товара, потом ролики по одному.
    void (async () => {
      await preload(VIDEO_CONFIG.startPoster(fmtNow, 0))
      await preload(VIDEO_CONFIG.stepPoster(fmtNow, 0))
      for (let i = 0; i < list.length; i++) {
        if (!alive) return
        try {
          const res = await fetch(`${list[i].replace(/\.mp4$/, `.${ext}`)}${MEDIA_V}`, { signal: abort.signal })
          // Сервер на несуществующий файл может вернуть index.html со статусом 200.
          if (!res.ok || !res.headers.get('content-type')?.startsWith('video/')) continue
          const blob = await res.blob()
          if (!alive) return
          const url = URL.createObjectURL(blob)
          urls.push(url)
          setBlobs((prev) => prev.map((b, j) => (j === i ? url : b)))
        } catch {
          // Без ролика шаг остаётся стоп-кадром; при уходе со страницы загрузка прервана.
          if (!alive) return
        }
      }
    })()
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

  // Один жест (колесо, свайп) — один ролик с родной скоростью до следующего товара и остановка.
  // Жест во время ролика сразу ставит его товар и запускает следующий; без ролика в памяти — стоп-кадр.
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
  // Клик по флакону или делению: сразу этот товар; играющий ролик jumpTo сам ставит на паузу
  const goTo = (i: number) => {
    const el = containerRef.current
    if (!el) return
    jumpTo(i)
    placeAt(i, el)
  }

  // Вычисляем высоту контейнера (~520vh)

  // Проверяем загрузку товаров

  if (isReducedMotion) {
    // Без анимаций (системная настройка «Уменьшить движение»): те же товары обычными карточками
    // каталога — фото товара, цена, «В корзину». Снятые с продажи не показываем.
    const shown = products.filter((p) => p.data)
    return (
      <section className="bg-background py-10 md:py-14">
        <div className="container-app">
          <p className="text-label font-semibold uppercase tracking-wide text-primary mb-2 lg:text-body-sm">Выбор косметологов</p>
          <h2 className="text-h2 font-heading font-bold mb-8">Бестселлеры</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {shown.map((p) => p.data && <ProductCard key={p.slug} product={p.data} />)}
          </div>
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
  if (isNear) [view.segment - 1, view.segment, view.segment + 1].forEach((i) => { if (i >= 0 && i < 4) shownRef.current.add(i) })
  const wants = (idx: number) => shownRef.current.has(idx)
  const cardIdx = view.cardIdx
  const cardProduct = cardIdx >= 0 ? products[cardIdx] : undefined
  const cardData = cardProduct?.data
  const mProduct = cardProduct ?? products[0]
  const mData = mProduct?.data
  const addCurrent = async () => {
    if (cardData?.variants[0]) {
      await addItem(cardData.variants[0].id, 1)
    }
  }

  const sceneName = (idx: number) => products[idx]?.data?.name ?? MISSING_PRODUCTS[BESTSELLER_SCENE_SLUGS[idx]]?.title
  const progressBar = (
    <div className="flex gap-2">
      {[0, 1, 2, 3].map(idx => {
        const name = sceneName(idx)
        return (
          <button
            key={idx}
            type="button"
            onClick={() => goTo(idx)}
            aria-label={name ? `Показать товар ${idx + 1}: ${name}` : `Показать товар ${idx + 1}`}
            aria-current={cardIdx === idx ? 'true' : undefined}
            className="relative flex-1 py-5 -my-5 pointer-events-auto cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="h-1 bg-foreground/10 rounded-full overflow-hidden">
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
          </button>
        )
      })}
    </div>
  )

  const cardMissing = cardProduct?.error?.status === 404 ? MISSING_PRODUCTS[cardProduct.slug] : undefined
  const cardBrand = cardData ? cardData.brand?.name : cardMissing?.brand
  const mMissing = mProduct?.error?.status === 404 ? MISSING_PRODUCTS[mProduct.slug] : undefined
  const mBrand = mData ? mData.brand?.name : mMissing?.brand
  const headTop = isDesktop ? 'top-12' : 'top-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))]'

  const bottleButtons = BOTTLE_ZONES[fmt].map(([left, right, top, bottom], idx) => {
    const name = sceneName(idx)
    return (
      <button
        key={idx}
        type="button"
        onClick={() => goTo(idx)}
        aria-label={name ? `Показать: ${name}` : `Показать товар ${idx + 1}`}
        className="absolute pointer-events-auto cursor-pointer rounded-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        style={{ left: `${left}%`, width: `${right - left}%`, top: `${top}%`, height: `${bottom - top}%` }}
      />
    )
  })

  return (
    <section ref={containerRef} style={{ height: '520vh' }} className="bg-background">
      {/* Программа чтения с экрана: все четыре товара сразу. С клавиатуры товары выбираются
          кнопками сцены (флаконы, деления), поэтому ссылки здесь вне порядка Tab */}
      <ul className="sr-only" aria-label="Бестселлеры">
        {products.map((p) => p.data && (
          <li key={p.slug}>
            <Link to={`/product/${p.slug}`} tabIndex={-1}>{p.data.name}</Link>
          </li>
        ))}
      </ul>
      {/* Sticky container: touch-none только там, где свайп — шаг сцены; на тач-экране шире 768 страница должна прокручиваться */}
      <div ref={stickyRef} className={`sticky top-0 h-screen overflow-hidden bg-background ${isDesktop ? '' : 'supports-[height:100dvh]:h-dvh'} ${scenePinned && !isDesktop ? 'touch-none' : ''}`}>
        {/* «Пропустить» — первым в порядке Tab; плашка держит контраст и поверх руки на планшете */}
        <div className="absolute inset-x-0 top-0 z-20 pointer-events-none">
          <div className="container-app">
            <div className="relative">
              <button
                type="button"
                onClick={exitDown}
                aria-label="Пропустить бестселлеры"
                className={`absolute right-0 ${headTop} -translate-y-4 md:-translate-y-3 pointer-events-auto min-h-11 -mr-3 inline-flex items-center text-body-sm font-semibold text-muted-foreground hover:text-primary transition-colors duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring rounded-pill`}
              >
                {/* Видимая плашка ниже зоны нажатия (44 px), чтобы на узком экране не касаться заголовка */}
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-background/90 shadow-sm">
                  Пропустить
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
        {/* Видео фреймы */}
        {/* Телефон: кадр 9:16 во всю ширину, ряд товаров — посередине между заголовком и карточкой */}
        <div
          className={`absolute overflow-hidden ${isDesktop ? 'inset-0' : 'inset-x-0 aspect-[9/16] md:[--scene-shift:6rem] lg:[--scene-shift:10rem] [mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_86%,transparent)]'}`}
          style={isDesktop ? undefined : { top: `calc((100dvh - 4rem) / 2 - ${(MOBILE_BAND * 1600) / 9}vw + var(--scene-shift, 0px))` }}
        >
          {/* Размытая заглушка: под кадрами, видна, пока они не пришли — пустого экрана нет ни на какой сети */}
          <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center blur-xl scale-110" style={{ backgroundImage: `url(${SCENE_PLACEHOLDER[fmt]})` }} />
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
                poster={wants(idx) ? VIDEO_CONFIG.startPoster(fmt, idx) : undefined}
                muted
                playsInline
                preload="auto"
                aria-hidden="true"
              />
              {/* Остановка: кадр «товар в руке» — тот же, что последний кадр ролика, поэтому подмена мгновенная */}
              {wants(idx) && (
                <img
                  src={VIDEO_CONFIG.stepPoster(fmt, idx)}
                  alt=""
                  aria-hidden="true"
                  className={`absolute inset-0 w-full h-full object-cover ${
                    view.segment === idx && isHold ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}
              {/* Ролик ещё не в памяти — стартовый кадр шага, на остановке он растворяется в кадр товара */}
              {view.segment === idx && !blobs[idx] && wants(idx) && (
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
          {!isDesktop && <div className="absolute inset-0 z-[1] pointer-events-none">{bottleButtons}</div>}
        </div>

        {/* Мягкий стык фона с соседними секциями */}
        <div aria-hidden="true" className={`absolute inset-x-0 top-0 h-24 ${isDesktop ? '' : 'hidden'} bg-gradient-to-b from-background to-transparent pointer-events-none z-10`} />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
        {/* Компьютер: края кадра (дорисованная стена и стол) растворяются в фоне страницы */}
        <div aria-hidden="true" className={`${isDesktop ? '' : 'hidden'} absolute inset-y-0 left-0 w-[44%] bg-gradient-to-r from-background from-30% via-background/60 via-60% to-transparent pointer-events-none z-10`} />
        <div aria-hidden="true" className={`${isDesktop ? '' : 'hidden'} absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-background via-background/50 to-transparent pointer-events-none z-10`} />
        <div aria-hidden="true" className={`${isDesktop ? '' : 'hidden'} absolute inset-y-0 right-0 w-[12%] bg-gradient-to-l from-background via-background/50 to-transparent pointer-events-none z-10`} />

        {isDesktop && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[1920/1068] z-[15] pointer-events-none"
            style={{ width: 'max(100%, calc(100vh * 1920 / 1068))' }}
          >
            {bottleButtons}
          </div>
        )}

        {/* Слой по сетке container-app: заголовок, карточка, прогресс */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="container-app h-full">
            <div className="relative h-full">
              <div className={`absolute left-0 ${headTop}`}>
                <p className="text-label font-semibold uppercase tracking-wide text-primary mb-2 lg:text-body-sm">Выбор косметологов</p>
                <h2 className="text-h2 font-heading font-bold min-[1800px]:text-[clamp(3rem,2.6vw,4.25rem)]">Бестселлеры</h2>
              </div>

              {/* Карточка товара - десктоп */}
              <div className={`absolute left-0 top-[54%] -translate-y-[8.5rem] min-[1800px]:-translate-y-[9rem] ${isDesktop ? '' : 'hidden'}`}>
                {cardProduct && (cardData || cardMissing) && (
                  <div
                    className={`bg-card rounded-block shadow-lg w-[24rem] p-[clamp(1.5rem,1.7vw,2.5rem)] min-[1800px]:p-7 [&_button]:min-h-12 [&_a.rounded-pill]:min-h-12 transition-[opacity,transform,visibility] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                      cardIdx >= 0
                        ? 'opacity-100 translate-x-0 visible pointer-events-auto'
                        : 'opacity-0 -translate-x-4 invisible pointer-events-none'
                    }`}
                  >
                    <div key={cardProduct.slug} className="animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none">
                      {cardBrand && (
                        <div className="text-label font-semibold uppercase tracking-wide text-muted-foreground mb-2 min-[1800px]:text-body-sm">{cardBrand}</div>
                      )}
                      <h3 className="text-[clamp(1.25rem,0.55rem+0.95vw,1.625rem)] min-[1800px]:text-[1.4375rem] leading-tight font-heading font-bold text-foreground mb-3 text-pretty">
                        {cardData ? (
                          <Link to={`/product/${cardProduct.slug}`} className="hover:text-primary hover:underline underline-offset-4 transition-colors duration-200">
                            <span className="block">{splitName(cardData.name).title}</span>{' '}
                            <span className="block">{splitName(cardData.name).desc}</span>
                          </Link>
                        ) : (
                          <>
                            <span className="block">{cardMissing?.title}</span>{' '}
                            <span className="block">{cardMissing?.desc}</span>
                          </>
                        )}
                      </h3>
                      {cardData?.variants[0] && (
                        <div className="text-[clamp(0.875rem,0.4rem+0.5vw,1.125rem)] text-muted-foreground mb-4">{cardData.variants[0].volumeLabel}</div>
                      )}
                      {cardData ? (
                        <>
                          <div className="mb-5 [&_.text-lg]:text-[clamp(1.5rem,0.7rem+1.1vw,2.25rem)]">
                            <PriceTag
                              price={cardData.minPrice}
                              oldPrice={cardData.oldPrice ?? undefined}
                              hidden={cardData.priceHidden}
                              size="lg"
                            />
                          </div>
                          <ProductCardButton product={cardData} user={user} onAddToCart={addCurrent} />
                        </>
                      ) : (
                        <>
                          <p className="mb-5 text-body-sm text-muted-foreground">Сейчас нет в продаже</p>
                          <Link
                            to={`/catalog?brand=${cardMissing?.brandSlug}`}
                            className="flex items-center justify-center w-full px-4 py-2 min-h-11 border border-primary text-primary rounded-pill font-heading font-bold text-body-sm hover:bg-primary hover:text-primary-foreground transition-colors duration-200 motion-reduce:transition-none"
                          >
                            Смотреть в каталоге
                          </Link>
                        </>
                      )}
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
              {/* Полоса прогресса (десктоп). Рисуется только в своём формате: fillRefs держит одну копию,
                  иначе покадровое обновление уходит в скрытую мобильную полосу */}
              <div className={`absolute bottom-12 inset-x-0 ${isDesktop ? '' : 'hidden'}`}>{isDesktop && progressBar}</div>
            </div>
          </div>
        </div>

        {/* Карточка товара - мобильный (снизу); до первого товара — невидимая заглушка, чтобы полоса прогресса не прыгала */}
        <div className={`${isDesktop ? 'hidden' : ''} absolute bottom-0 left-0 right-0 z-20 h-36 flex flex-col justify-end gap-2 px-6 md:px-12 md:[&>*]:max-w-[30rem] pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none`}>
          {!isDesktop && progressBar}
          <div className="relative">
          <p aria-hidden={cardIdx >= 0} className={`absolute inset-0 flex items-center text-body-sm md:text-body text-muted-foreground transition-opacity duration-300 ${cardIdx >= 0 ? 'opacity-0' : 'opacity-100'}`}>
            Листайте — рука покажет каждый товар
          </p>
          {mProduct && (mData || mMissing) && (
            <div
              className={`relative bg-card rounded-block shadow-md px-4 py-3 flex items-center gap-3 transition-[opacity,transform,visibility] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                cardIdx >= 0
                  ? 'opacity-100 translate-y-0 visible pointer-events-auto'
                  : 'opacity-0 translate-y-6 invisible pointer-events-none'
              }`}
            >
              <Fragment key={mProduct.slug}>
              <div className="min-w-0 flex-1 animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none">
                {mBrand && (
                  <div className="text-label leading-tight uppercase tracking-wide text-muted-foreground md:text-body-sm">
                    {mBrand}
                    {mData?.variants[0]?.volumeLabel && <span className="font-semibold normal-case"> · {mData.variants[0].volumeLabel}</span>}
                  </div>
                )}
                <h3 className="text-sm md:text-body font-heading font-semibold text-foreground line-clamp-3 leading-snug min-h-[3lh] md:min-h-0">
                  {/* Вся карточка — ссылка на товар (растянутая ссылка); кнопка «В корзину» лежит выше неё */}
                  {mData ? (
                    <Link
                      to={`/product/${mProduct.slug}`}
                      className="hover:text-primary hover:underline underline-offset-4 after:absolute after:inset-0 after:rounded-block after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
                    >
                      <span className="block">{splitName(mData.name).title}</span>{' '}
                      <span className="block font-normal">{splitName(mData.name).desc}</span>
                    </Link>
                  ) : (
                    <>
                      <span className="block">{mMissing?.title}</span>{' '}
                      <span className="block font-normal">{mMissing?.desc}</span>
                    </>
                  )}
                </h3>
                {mMissing && <p className="text-body-sm text-muted-foreground">Сейчас нет в продаже</p>}
              </div>
              <div className="relative z-10 shrink-0 w-28 flex flex-col items-center gap-1.5">
                {mData ? (
                  <>
                    <PriceTag
                      price={mData.minPrice}
                      oldPrice={mData.oldPrice ?? undefined}
                      hidden={mData.priceHidden}
                      size="lg"
                    />
                    <ProductCardButton product={mData} user={user} onAddToCart={addCurrent} />
                  </>
                ) : (
                  <Link
                    to={`/catalog?brand=${mMissing?.brandSlug}`}
                    className="flex items-center justify-center w-full min-h-11 px-2 border border-primary text-primary rounded-pill font-heading font-bold text-body-sm leading-tight text-center hover:bg-primary hover:text-primary-foreground transition-colors duration-200 motion-reduce:transition-none"
                  >
                    Смотреть в каталоге
                  </Link>
                )}
              </div>
              </Fragment>
            </div>
          )}
          </div>
        </div>
      </div>
      {/* Сюда уходит фокус после «Пропустить»: следующий Tab — уже секция после сцены */}
      <div ref={endRef} tabIndex={-1} className="outline-none" />
    </section>
  )
}

interface ProductCardButtonProps {
  product: any
  user: any
  onAddToCart: () => Promise<void>
}

function ProductCardButton({ product, user, onAddToCart }: ProductCardButtonProps) {
  // В сцене корзина сама не выезжает; после добавления кнопка становится путём в корзину
  // и остаётся им, пока не сменится товар (карточка перемонтируется по слагу).
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'added'>('idle')
  const { openCart } = useDrawer()
  const timerRef = useRef(0)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  const isProProduct = product?.isProfessional && !isApprovedPro(user)

  const handleClick = async () => {
    if (state === 'added') {
      openCart()
      return
    }
    if (!product?.inStock || product?.variants?.length === 0) return

    try {
      setState('loading')
      await onAddToCart()
      setState('success')
      timerRef.current = window.setTimeout(() => setState('added'), 1500)
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
      disabled={(!product?.inStock && state !== 'added') || state === 'loading'}
      className={`w-full py-2 px-3 leading-tight font-heading font-bold rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 min-h-11 text-body-sm ${
        state === 'added' ? 'border border-primary text-primary bg-card' : 'bg-primary text-primary-foreground'
      }`}
    >
      {state === 'added'
        ? 'В корзине →'
        : state === 'success'
          ? 'Добавлено'
          : state === 'loading'
            ? 'Добавляю...'
            : product?.inStock
              ? 'В корзину'
              : 'Нет в наличии'}
    </button>
  )
}
