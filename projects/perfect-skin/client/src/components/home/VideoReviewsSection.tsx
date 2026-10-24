import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { fetchVideoReviews, type PublicVideoReview } from '@/lib/admin-api'
import { isDemoSections } from '@/lib/demo-mode'
import { useHomeList } from '@/hooks/useHomeList'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { SectionHeader } from '@/components/home/SectionHeader'
import { IconArrowRight, IconPause, IconPlay, IconVolume, IconVolumeOff } from '@/components/icons'

const MIN_REVIEWS = 3
const MAX_REVIEWS = 12
const SWIPE_MIN_PX = 40
const SWIPE_MIN_SPEED = 0.3
const EASE_OUT = 'cubic-bezier(0.23,1,0.32,1)'

type Slot = { x: number; depth: number; rot: number; scale: number; veil: number; layer: number }
type Layout = { steps: Slot[]; far: Slot }
type Pose = { transform: string; opacity: number; veil: number; layer: number; hidden: boolean }
type Seam = { timers: number[]; frames: number[] }
type VideoList = { items: PublicVideoReview[]; demo: boolean }

// Объёмное кольцо: x — % ширины слайда, depth — доля --vr-w, rot — градусы
const RING: Layout = {
  steps: [
    { x: 0, depth: 0, rot: 0, scale: 1, veil: 0, layer: 40 },
    { x: 72, depth: 0.3, rot: 25, scale: 0.92, veil: 0.35, layer: 30 },
    { x: 130, depth: 0.65, rot: 38, scale: 0.84, veil: 0.55, layer: 20 },
    { x: 176, depth: 1.05, rot: 48, scale: 0.76, veil: 0.75, layer: 10 },
  ],
  far: { x: 195, depth: 1.5, rot: 56, scale: 0.68, veil: 0.75, layer: 0 },
}

// Плоская раскладка для prefers-reduced-motion
const FLAT: Layout = {
  steps: [
    { x: 0, depth: 0, rot: 0, scale: 1, veil: 0, layer: 40 },
    { x: 62, depth: 0, rot: 0, scale: 0.84, veil: 0.35, layer: 30 },
    { x: 112, depth: 0, rot: 0, scale: 0.7, veil: 0.55, layer: 20 },
    { x: 152, depth: 0, rot: 0, scale: 0.58, veil: 0.75, layer: 10 },
  ],
  far: { x: 176, depth: 0, rot: 0, scale: 0.48, veil: 0.75, layer: 0 },
}

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } }

const CONTROL =
  'inline-flex size-11 items-center justify-center rounded-pill bg-dark/70 text-dark-foreground backdrop-blur-sm hover:bg-dark/85 transition-transform duration-160 ease-out active:scale-97 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card'

const ARROW =
  'inline-flex size-12 shrink-0 items-center justify-center rounded-pill border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-transform duration-160 ease-out active:scale-97 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

async function loadVideoReviews(): Promise<VideoList> {
  if (isDemoSections()) return { items: (await import('@/lib/home-demo')).DEMO_VIDEOS, demo: true }
  const { items } = await fetchVideoReviews({ limit: MAX_REVIEWS })
  return { items: items.filter((item) => item.mp4Url && item.posterUrl).slice(0, MAX_REVIEWS), demo: false }
}

/** Позиция слайда относительно активного по кругу: -n/2 < rel <= n/2 */
function relativeIndex(index: number, active: number, n: number): number {
  const rel = (((index - active) % n) + n) % n
  return rel > n / 2 ? rel - n : rel
}

function slotTransform(slot: Slot, sign: number): string {
  return `translateX(${sign * slot.x}%) translateZ(calc(var(--vr-w) * ${-slot.depth})) rotateY(${sign * slot.rot}deg) scale(${slot.scale})`
}

function pose(rel: number, n: number, maxVisible: number, reduced: boolean): Pose {
  const dist = Math.abs(rel)
  const hidden = dist > maxVisible || (n % 2 === 0 && dist === n / 2)
  const layout = reduced ? FLAT : RING
  const slot = hidden ? layout.far : layout.steps[dist]
  return {
    transform: slotTransform(slot, rel < 0 ? -1 : 1),
    opacity: hidden ? 0 : 1,
    veil: slot.veil,
    layer: slot.layer,
    hidden,
  }
}

function writePose(el: HTMLDivElement, target: Pose) {
  el.style.transform = target.transform
  el.style.opacity = String(target.opacity)
}

function cancelSeam(seam: Seam) {
  seam.timers.forEach((id) => window.clearTimeout(id))
  seam.frames.forEach((id) => cancelAnimationFrame(id))
  seam.timers = []
  seam.frames = []
}

// Перескок через шов кольца: за шаром на старой стороне (160 мс) → за шаром на новой → выход на место
function crossSeam(el: HTMLDivElement, seam: Seam, from: number, to: number, target: Pose, fromVisible: boolean) {
  const enter = (duration: number | null) => {
    el.style.transition = 'none'
    el.style.transform = slotTransform(RING.far, to < 0 ? -1 : 1)
    el.style.opacity = '0'
    seam.frames.push(
      requestAnimationFrame(() => {
        seam.frames.push(
          requestAnimationFrame(() => {
            seam.timers = []
            seam.frames = []
            el.style.transition = duration ? `transform ${duration}ms ${EASE_OUT}, opacity ${duration}ms ${EASE_OUT}` : ''
            writePose(el, target)
          }),
        )
      }),
    )
  }

  if (fromVisible) {
    el.style.transition = `transform 160ms ${EASE_OUT}, opacity 160ms ${EASE_OUT}`
    el.style.transform = slotTransform(RING.far, from < 0 ? -1 : 1)
    el.style.opacity = '0'
    seam.timers.push(window.setTimeout(() => enter(240), 160))
  } else {
    enter(null)
  }
}

function VideoCoverflow({ items, demo }: { items: PublicVideoReview[]; demo: boolean }) {
  const n = items.length
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(true)
  const [manualStart, setManualStart] = useState<number | null>(null)
  const [inView, setInView] = useState(false)
  const [tabVisible, setTabVisible] = useState(!document.hidden)
  const [saveData] = useState(() => Boolean((navigator as NavigatorWithConnection).connection?.saveData))
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const isWide = useMediaQuery('(min-width: 1280px)')
  const isTablet = useMediaQuery('(min-width: 768px)')
  const maxVisible = isWide ? 3 : isTablet ? 2 : 1

  const noAutoplay = reduced || saveData
  const mountVideo = !noAutoplay || manualStart === active

  const sceneRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const seams = useRef<Seam[]>(Array.from({ length: n }, () => ({ timers: [], frames: [] })))
  const prevSlotsRef = useRef<number[]>([])
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const swiped = useRef(false)

  useEffect(() => () => seams.current.forEach(cancelSeam), [])

  const goTo = (index: number) => {
    setActive(((index % n) + n) % n)
    setManualStart(null)
  }

  const togglePlay = () => {
    if (!mountVideo) {
      setManualStart(active)
      setPlaying(true)
      return
    }
    setPlaying((value) => !value)
  }

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= 0.5), {
      threshold: 0.5,
    })
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muted
    if (playing && inView && tabVisible) {
      video.play().catch((error: unknown) => {
        if (error instanceof Error && error.name === 'NotAllowedError') setPlaying(false)
      })
    }
    else video.pause()
  }, [active, mountVideo, muted, playing, inView, tabVisible])

  useLayoutEffect(() => {
    const rels = Array.from({ length: n }, (_, i) => relativeIndex(i, active, n))
    const prev = prevSlotsRef.current
    prevSlotsRef.current = rels
    rels.forEach((rel, i) => {
      const el = slideRefs.current[i]
      if (!el) return
      const seam = seams.current[i]
      const pending = seam.timers.length + seam.frames.length > 0
      cancelSeam(seam)
      el.style.transition = ''
      const target = pose(rel, n, maxVisible, reduced)
      const crossed = prev.length === n && Math.abs(rel - prev[i]) > n / 2
      if (!crossed || reduced) {
        if (pending) writePose(el, target)
        return
      }
      const fromVisible = !pending && !pose(prev[i], n, maxVisible, false).hidden
      crossSeam(el, seam, prev[i], rel, target, fromVisible)
    })
  }, [active, n, maxVisible, reduced])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    goTo(active + (event.key === 'ArrowRight' ? 1 : -1))
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swiped.current = false
    swipeStart.current = { x: event.clientX, y: event.clientY, t: event.timeStamp }
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) <= Math.abs(dy)) return
    const speed = Math.abs(dx) / Math.max(event.timeStamp - start.t, 1)
    if (Math.abs(dx) > SWIPE_MIN_PX || speed > SWIPE_MIN_SPEED) {
      swiped.current = true
      goTo(active + (dx < 0 ? 1 : -1))
    }
  }

  const onMediaTap = () => {
    if (swiped.current) {
      swiped.current = false
      return
    }
    togglePlay()
  }

  const current = items[active]

  return (
    <div onKeyDown={onKeyDown}>
      <div
        ref={sceneRef}
        role="region"
        aria-roledescription="карусель"
        aria-label="Видеоотзывы"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className="relative mx-auto h-[calc(var(--vr-w)*16/9)] touch-pan-y select-none rounded-block [--vr-w:14rem] md:[--vr-w:16.25rem] xl:[--vr-w:18.75rem] min-[1680px]:[--vr-w:21.25rem] [perspective:calc(var(--vr-w)*4)] [perspective-origin:50%_50%] motion-reduce:[perspective:none] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {items.map((item, index) => {
          const isActive = index === active
          const pos = pose(relativeIndex(index, active, n), n, maxVisible, reduced)
          const label = `${demo ? 'Пример отзыва. ' : ''}Видеоотзыв: ${item.authorName}${item.product ? `, ${item.product.name}` : ''}`
          return (
            <div
              key={item.id}
              ref={(el) => {
                slideRefs.current[index] = el
              }}
              role="group"
              aria-roledescription="слайд"
              aria-label={`${index + 1} из ${n}`}
              aria-hidden={isActive ? undefined : true}
              style={{ transform: pos.transform, zIndex: pos.layer, opacity: pos.opacity }}
              className={`absolute top-0 left-[calc(50%_-_var(--vr-w)/2)] w-[var(--vr-w)] aspect-[9/16] overflow-hidden rounded-block bg-muted origin-center shadow-[0_24px_48px_-24px_rgb(20_32_46_/_0.45)] [backface-visibility:hidden] transition-[transform,opacity] duration-[400ms] ease-out motion-reduce:transition-none ${pos.hidden ? 'pointer-events-none' : ''}`}
            >
              {isActive && mountVideo ? (
                <video
                  ref={videoRef}
                  muted={muted}
                  playsInline
                  loop
                  preload="metadata"
                  poster={item.posterUrl}
                  aria-label={label}
                  onClick={onMediaTap}
                  className="h-full w-full object-cover"
                >
                  {item.webmUrl && <source src={item.webmUrl} type="video/webm" />}
                  <source src={item.mp4Url} type="video/mp4" />
                </video>
              ) : (
                <img
                  src={item.posterUrl}
                  alt=""
                  loading="lazy"
                  onClick={isActive ? onMediaTap : undefined}
                  className="h-full w-full object-cover"
                />
              )}

              {demo && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-3 left-3 rounded-pill bg-dark/70 px-3 py-1.5 font-heading text-label font-semibold uppercase tracking-wide text-dark-foreground backdrop-blur-sm"
                >
                  Пример отзыва
                </span>
              )}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-background transition-opacity duration-[400ms] ease-out motion-reduce:transition-none"
                style={{ opacity: pos.veil }}
              />

              {!isActive && !pos.hidden && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Показать отзыв ${index + 1}: ${item.authorName}`}
                  onClick={() => goTo(index)}
                  className="absolute inset-0 z-[5] cursor-pointer"
                />
              )}

              {isActive && mountVideo && (
                <div className="absolute top-3 right-3 z-10 flex gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={playing ? 'Поставить на паузу' : 'Воспроизвести'}
                    className={CONTROL}
                  >
                    {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMuted((value) => !value)}
                    aria-label={muted ? 'Включить звук' : 'Выключить звук'}
                    aria-pressed={!muted}
                    className={CONTROL}
                  >
                    {muted ? <IconVolumeOff size={20} /> : <IconVolume size={20} />}
                  </button>
                </div>
              )}

              {isActive && !mountVideo && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label="Воспроизвести отзыв"
                  className="absolute left-1/2 top-1/2 z-10 inline-flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill bg-dark/70 text-dark-foreground backdrop-blur-sm hover:bg-dark/85 transition-transform duration-160 ease-out active:scale-97 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card"
                >
                  <IconPlay size={24} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="container-app">
        <div className="mx-auto mt-6 grid max-w-[34rem] grid-cols-2 items-center gap-x-3 gap-y-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start md:gap-6">
          <button
            type="button"
            aria-label="Предыдущий отзыв"
            onClick={() => goTo(active - 1)}
            className={`${ARROW} row-start-2 justify-self-start md:col-start-1 md:row-start-1`}
          >
            <IconArrowRight size={20} className="rotate-180" />
          </button>
          <div
            key={active}
            className="col-span-2 row-start-1 text-center md:col-span-1 md:col-start-2 animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none"
          >
            <p className="font-heading text-body-sm font-semibold tabular-nums text-muted-foreground">
              {active + 1} / {n}
            </p>
            <p className="mt-2 font-heading text-body font-semibold text-foreground">{current.authorName}</p>
            {current.caption && (
              <p className="mt-1 text-body-sm leading-body text-muted-foreground line-clamp-2">{current.caption}</p>
            )}
            {current.product && (
              <Link
                to={`/product/${current.product.slug}`}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-pill border border-border-strong px-4 text-body-sm font-semibold text-primary hover:bg-primary/5 transition-transform duration-160 ease-out active:scale-97 motion-reduce:transition-none"
              >
                {current.product.name} <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <button
            type="button"
            aria-label="Следующий отзыв"
            onClick={() => goTo(active + 1)}
            className={`${ARROW} row-start-2 justify-self-end md:col-start-3 md:row-start-1`}
          >
            <IconArrowRight size={20} />
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          Отзыв {active + 1} из {n}{demo ? ' (пример)' : ''}: {current.authorName}
        </p>
      </div>
    </div>
  )
}

export function VideoReviewsSection() {
  const list = useHomeList<VideoList>(loadVideoReviews, { items: [], demo: false })
  if (!list || list.items.length < MIN_REVIEWS) return null

  return (
    <section aria-labelledby="home-video-title" className="overflow-x-clip bg-background py-10 md:py-14">
      <div className="container-app">
        <SectionHeader
          eyebrow="Отзывы"
          title="Покупатели о средствах"
          titleId="home-video-title"
          sub="Показывают средства, которыми пользуются, и рассказывают, как они подошли коже."
        />
      </div>
      <VideoCoverflow items={list.items} demo={list.demo} />
    </section>
  )
}
