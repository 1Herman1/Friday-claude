import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon } from '../icons'
import { bannersApi, type Banner } from '../../lib/api'
import { useMediaQuery } from '../../hooks/useMediaQuery'

interface DragState {
  startX: number
  currentX: number
  startTime: number
  isDragging: boolean
}

// Оформление слайда в базе не хранится — владелец меняет содержание, а не
// градиенты. Точки используют единую схему цветов (bg-navy-900).
const THEMES = [
  {
    bg: 'from-blue-100 to-blue-200',
    textColor: 'text-navy-900',
    subtitleColor: 'text-navy-500',
    accent: 'btn-primary',
  },
  {
    bg: 'from-amber-300 to-amber-400',
    textColor: 'text-navy-900',
    subtitleColor: 'text-navy-700',
    accent: 'btn-primary',
  },
  {
    bg: 'from-navy-700 to-navy-900',
    textColor: 'text-white',
    subtitleColor: 'text-blue-100',
    accent: 'btn-primary',
  },
]

const SLIDE_MS = 6500
const DRAG_THRESHOLD = 0.12 // 12% ширины трека
const DRAG_THRESHOLD_PX = 6 // 6px для блокирования клика
const VELOCITY_THRESHOLD = 0.5 // px/мс
const TRANSITION_DURATION_MS = 300

/** Телефон и компьютер получают разные файлы: широкая десктопная картинка на
    узком экране либо обрезается по краям, либо мельчает до нечитаемости.
    Точка переключения — та же, что у Tailwind md (768px). */
function BannerImage({
  banner,
  priority,
  alt = '',
  className,
}: {
  banner: Banner
  priority: boolean
  alt?: string
  className: string
}) {
  return (
    <picture>
      {banner.imageMobile && <source media="(max-width: 767px)" srcSet={banner.imageMobile} />}
      <img
        src={banner.image}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        fetchPriority={priority ? 'high' : 'auto' as any}
        draggable={false}
        className={className}
      />
    </picture>
  )
}

interface SlideProps {
  banner: Banner
  trackIndex: number
  isActive: boolean
  theme: typeof THEMES[0]
  onNavigate?: (trackIndex: number) => void
  isDragging?: boolean
  widthPercent: number
  isClone?: boolean
}

function Slide({ banner, trackIndex, isActive, theme, onNavigate, isDragging, widthPercent, isClone }: SlideProps) {
  return (
    <div
      className="carousel-slide shrink-0"
      role="presentation"
      aria-hidden={!isActive || isClone}
      onClick={() => !isActive && onNavigate?.(trackIndex)}
      tabIndex={isClone ? -1 : undefined}
      style={{
        width: `${widthPercent}%`,
        opacity: isActive ? 1 : 0.6,
        transition: isDragging ? 'none' : 'opacity 300ms var(--ease-out)',
        cursor: !isActive ? 'pointer' : 'default',
      }}
    >
      {banner.showText ? (
        <div className={`bg-gradient-to-r ${theme.bg} h-56 md:h-auto md:aspect-[2/1] flex items-center rounded-banner`}>
          <div
            className="max-w-7xl mx-auto px-8 md:px-12 flex items-center justify-between w-full h-full animate-fade-in"
            tabIndex={isActive && !isClone ? 0 : -1}
          >
            <div className="max-w-lg pt-4 pb-10 md:py-6">
              <h2 className={`text-2xl md:text-4xl font-black mb-2 md:mb-3 ${theme.textColor}`}>
                {banner.title}
              </h2>
              {banner.subtitle && (
                <p className={`text-sm md:text-base mb-4 md:mb-6 ${theme.subtitleColor}`}>
                  {banner.subtitle}
                </p>
              )}
              <Link
                to={banner.link ?? "/catalog"}
                className={`inline-block ${theme.accent}`}
                tabIndex={isActive && !isClone ? 0 : -1}
              >
                {banner.buttonText ?? "Смотреть"}
              </Link>
            </div>

            <BannerImage
              banner={banner}
              priority={isActive && !isClone}
              className="hidden md:block h-full w-auto max-w-[48%] object-contain object-bottom select-none pointer-events-none"
            />
          </div>
        </div>
      ) : (
        <Link
          to={banner.link ?? "/catalog"}
          className="block overflow-hidden rounded-banner animate-fade-in aspect-[1520/1035] md:aspect-[2/1]"
          tabIndex={isActive && !isClone ? 0 : -1}
          onClick={(e) => {
            if (!isActive) {
              e.preventDefault()
            }
          }}
        >
          <BannerImage
            banner={banner}
            priority={isActive && !isClone}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
        </Link>
      )}
    </div>
  )
}

export default function BannerCarousel() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [banners, setBanners] = useState<Banner[]>([])
  const [trackIndex, setTrackIndex] = useState(1) // Start at 1 (first real slide, with clone-last to the left)
  const [mobileIndex, setMobileIndex] = useState(0) // For native scroll on mobile
  const [isPaused, setIsPaused] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldTransition, setShouldTransition] = useState(true) // For no-transition jumps
  const [containerWidth, setContainerWidth] = useState(0)
  const dragStateRef = useRef<DragState>({ startX: 0, currentX: 0, startTime: 0, isDragging: false })
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null) // For mobile native scroll
  const lastDragDistanceRef = useRef(0)
  const transitionEndTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    bannersApi
      .list({ page: 'home', position: 'main_slider' })
      .then((res) => setBanners(res.data))
      .catch(() => setBanners([]))
  }, [])

  // Mobile native scroll: track active index
  useEffect(() => {
    if (!isMobile || !scrollRef.current) return

    const el = scrollRef.current
    const handleScroll = () => {
      if (!el || el.children.length === 0) return

      const slideWidth = (el.children[0] as HTMLElement).offsetWidth
      const gap = 16 // gap-4 in tailwind = 16px
      const scrollLeft = el.scrollLeft
      const index = Math.round(scrollLeft / (slideWidth + gap))
      setMobileIndex(Math.min(index, banners.length - 1))
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [isMobile, banners.length])

  // Measure container width and track changes with ResizeObserver
  useEffect(() => {
    const track = trackRef.current
    if (!track?.parentElement) return

    const container = track.parentElement
    setContainerWidth(container.offsetWidth)

    const resizeObserver = new ResizeObserver(() => {
      setContainerWidth(container.offsetWidth)
    })
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // Listen to pointer events on document to catch pointerup outside element
  useEffect(() => {
    const handleDocumentPointerMove = (e: PointerEvent): void => {
      if (!dragStateRef.current.isDragging) return
      handlePointerMove(e.clientX)
    }

    const handleDocumentPointerUp = (): void => {
      if (!dragStateRef.current.isDragging) return
      handlePointerUp()
    }

    document.addEventListener('pointermove', handleDocumentPointerMove)
    document.addEventListener('pointerup', handleDocumentPointerUp)
    document.addEventListener('pointercancel', handleDocumentPointerUp)

    return () => {
      document.removeEventListener('pointermove', handleDocumentPointerMove)
      document.removeEventListener('pointerup', handleDocumentPointerUp)
      document.removeEventListener('pointercancel', handleDocumentPointerUp)
    }
  }, [banners.length])

  useEffect(() => {
    if (isPaused || banners.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => {
      setTrackIndex((prev) => prev + 1)
      setIsAnimating(true)
    }, SLIDE_MS)
    return () => clearInterval(timer)
  }, [isPaused, banners.length])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'touch' && e.pointerType !== 'pen') return

    const track = trackRef.current
    if (!track) return

    track.setPointerCapture(e.pointerId)
    dragStateRef.current = {
      startX: e.clientX,
      currentX: e.clientX,
      startTime: Date.now(),
      isDragging: true,
    }
    setIsPaused(true)
    setIsAnimating(false)
  }

  function handlePointerMove(clientX: number): void {
    const state = dragStateRef.current
    if (!state.isDragging) return

    const track = trackRef.current
    if (!track) return

    state.currentX = clientX

    const dx = state.currentX - state.startX
    lastDragDistanceRef.current = dx

    // No rubber-banding on infinite carousel
    setDragX(dx)
  }


  function handlePointerUp(): void {
    const state = dragStateRef.current
    if (!state.isDragging) return

    const track = trackRef.current
    if (!track) {
      state.isDragging = false
      return
    }

    // Захват указателя браузер снимает сам на pointerup/pointercancel.
    state.isDragging = false

    const trackWidth = track.offsetWidth
    const dx = state.currentX - state.startX
    const timeDelta = Date.now() - state.startTime
    const velocity = timeDelta > 0 ? Math.abs(dx) / timeDelta : 0

    const thresholdPx = (trackWidth / banners.length) * DRAG_THRESHOLD

    if (Math.abs(dx) > thresholdPx || velocity > VELOCITY_THRESHOLD) {
      if (dx < 0) {
        // Свайп влево — следующий слайд
        setTrackIndex((prev) => prev + 1)
      } else {
        // Свайп вправо — предыдущий слайд
        setTrackIndex((prev) => prev - 1)
      }
    }

    setDragX(0)
    setIsAnimating(true)
    setIsPaused(false)
  }


  function handleClickCapture(e: React.MouseEvent): void {
    if (Math.abs(lastDragDistanceRef.current) > DRAG_THRESHOLD_PX) {
      e.preventDefault()
      e.stopPropagation()
      lastDragDistanceRef.current = 0
    }
  }

  function prev(): void {
    setTrackIndex((idx) => idx - 1)
    setIsAnimating(true)
  }

  function next(): void {
    setTrackIndex((idx) => idx + 1)
    setIsAnimating(true)
  }

  const n = banners.length
  const hasClones = n >= 2
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Re-enable transition on next frame after disabling it, with double RAF for safety
  useEffect(() => {
    if (!shouldTransition) {
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShouldTransition(true)
        })
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [shouldTransition])

  // Fallback: if prefers-reduced-motion is on, transitionend never fires, so handle it with setTimeout
  useEffect(() => {
    if (prefersReducedMotion && isAnimating && !dragStateRef.current.isDragging) {
      if (trackIndex === n + 1 || trackIndex === 0) {
        transitionEndTimeoutRef.current = setTimeout(() => {
          if (trackIndex === n + 1) {
            setTrackIndex(1)
          } else if (trackIndex === 0) {
            setTrackIndex(n)
          }
        }, TRANSITION_DURATION_MS)
      }
    }
    return () => {
      if (transitionEndTimeoutRef.current) {
        clearTimeout(transitionEndTimeoutRef.current)
      }
    }
  }, [trackIndex, n, isAnimating, prefersReducedMotion])

  if (banners.length === 0) return null

  // Derive current (real slide index) from trackIndex
  const current = hasClones ? (trackIndex - 1 + n) % n : trackIndex

  const theme = THEMES[current % THEMES.length]

  // Peek mode calculation: desktop PEEK=11%, GAP=5.5%, SLIDE=67; mobile peek 9%, gap 16px, slide 82%
  const peekPercent = isMobile ? 9 : 11
  const gapPercent = isMobile ? 0 : 5.5
  const slideWidthPercent = 100 - peekPercent * 2 - gapPercent * 2

  // Use measured containerWidth from state, fallback to window width if not measured yet
  const effectiveContainerW = containerWidth || window.innerWidth
  const peekPx = (peekPercent / 100) * effectiveContainerW
  const gapPx = isMobile ? 16 : (gapPercent / 100) * effectiveContainerW
  const slideWidthPx = (slideWidthPercent / 100) * effectiveContainerW

  // Position calculation: active slide offset = peek + gap (desktop) or peek (mobile)
  const activeOffsetPx = isMobile ? peekPx : peekPx + gapPx
  const slidePositionPx = trackIndex * (slideWidthPx + gapPx) - activeOffsetPx + dragX

  const isTransitioning = shouldTransition && isAnimating && !dragStateRef.current.isDragging && !prefersReducedMotion

  // Handle transitionend event to jump from clone back to real slide
  const handleTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current || e.propertyName !== 'transform') return

    if (transitionEndTimeoutRef.current) {
      clearTimeout(transitionEndTimeoutRef.current)
    }

    if (trackIndex === n + 1) {
      // At clone-first, jump to real first (trackIndex = 1)
      setShouldTransition(false)
      setTrackIndex(1)
    } else if (trackIndex === 0) {
      // At clone-last, jump to real last (trackIndex = n)
      setShouldTransition(false)
      setTrackIndex(n)
    }
  }

  if (isMobile) {
    // Mobile: native scroll with snap
    return (
      <section
        id="banners"
        aria-label="Акции и предложения"
        className="scroll-mt-24"
      >
        <div className="overflow-hidden">
          <div
            ref={scrollRef}
            /* На телефоне слайд во всю ширину с гаттером страницы 16px, сосед
               не выглядывает — решение владельца. */
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 px-4 scroll-px-4"
            style={{ scrollPaddingInline: '16px' }}
            role="region"
            aria-roledescription="carousel"
          >
            {banners.map((banner, index) => (
              <Slide
                key={banner.id}
                banner={banner}
                trackIndex={index}
                isActive
                isDragging={false}
                theme={THEMES[index % THEMES.length]}
                widthPercent={100}
              />
            ))}
          </div>
        </div>

        {/* Dots below the banner */}
        {n > 1 && (
          <div className="mt-3 flex justify-center">
            {banners.map((b, i) => (
              <button
                type="button"
                key={b.id}
                onClick={() => {
                  if (scrollRef.current && scrollRef.current.children.length > i) {
                    const slideWidth = (scrollRef.current.children[i] as HTMLElement).offsetWidth
                    const gap = 16
                    scrollRef.current.scrollTo({
                      left: i * (slideWidth + gap),
                      behavior: prefersReducedMotion ? 'auto' : 'smooth',
                    })
                  }
                }}
                className="w-11 h-11 flex items-center justify-center"
                aria-label={`Перейти к баннеру ${i + 1}`}
                aria-current={mobileIndex === i ? 'page' : undefined}
              >
                <span
                  className={`block h-2 rounded-full transition-[width,background-color] ${
                    mobileIndex === i ? 'w-6 bg-navy-900' : 'w-2 bg-navy-900/30'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </section>
    )
  }

  // Desktop: JS drag with infinite carousel
  return (
    <section
      id="banners"
      aria-label="Акции и предложения"
      className="scroll-mt-24 relative overflow-hidden"
      onMouseEnter={() => !dragStateRef.current.isDragging && setIsPaused(true)}
      onMouseLeave={() => !dragStateRef.current.isDragging && setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex cursor-grab active:cursor-grabbing select-none"
          style={{
            touchAction: 'pan-y',
            columnGap: `${gapPx}px`,
            // В пикселях, не в процентах: для первого слайда смещение отрицательное,
            // и `-${-7}%` давал невалидный `--7%` — трансформ молча отбрасывался.
            transform: `translateX(${-slidePositionPx}px)`,
            transition: isTransitioning ? 'transform 300ms var(--ease-out)' : 'none',
          }}
          onPointerDown={handlePointerDown}
          onClickCapture={handleClickCapture}
          onTransitionEnd={handleTrackTransitionEnd}
          aria-roledescription="carousel"
        >
          {hasClones && (
            <Slide
              key="clone-last"
              banner={banners[n - 1]}
              trackIndex={0}
              isActive={trackIndex === 0}
              isDragging={dragStateRef.current.isDragging}
              theme={THEMES[(n - 1) % THEMES.length]}
              widthPercent={slideWidthPercent}
              isClone
              onNavigate={(idx) => {
                setTrackIndex(idx)
                setIsAnimating(true)
              }}
            />
          )}
          {banners.map((banner, index) => (
            <Slide
              key={banner.id}
              banner={banner}
              trackIndex={index + 1}
              isActive={trackIndex === index + 1}
              isDragging={dragStateRef.current.isDragging}
              theme={THEMES[index % THEMES.length]}
              widthPercent={slideWidthPercent}
              onNavigate={(idx) => {
                setTrackIndex(idx)
                setIsAnimating(true)
              }}
            />
          ))}
          {hasClones && (
            <Slide
              key="clone-first"
              banner={banners[0]}
              trackIndex={n + 1}
              isActive={trackIndex === n + 1}
              isDragging={dragStateRef.current.isDragging}
              theme={THEMES[0]}
              widthPercent={slideWidthPercent}
              isClone
              onNavigate={(idx) => {
                setTrackIndex(idx)
                setIsAnimating(true)
              }}
            />
          )}
        </div>
      </div>

      {/* Стрелки — скрыть если только один баннер */}
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Предыдущий баннер"
            className="hidden md:flex absolute top-0 bottom-0 my-auto w-11 h-11 rounded-full bg-white hover:shadow-md shadow-card items-center justify-center text-navy-700 transition-[background-color,box-shadow]"
            style={{ left: 'calc(13.75% - 22px)' }}
          >
            <ArrowLeftIcon className="w-4.5 h-4.5 ico-nudge ico-nudge--back" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Следующий баннер"
            className="hidden md:flex absolute top-0 bottom-0 my-auto w-11 h-11 rounded-full bg-white hover:shadow-md shadow-card items-center justify-center text-navy-700 transition-[background-color,box-shadow]"
            style={{ right: 'calc(13.75% - 22px)' }}
          >
            <ArrowRightIcon className="w-4.5 h-4.5 ico-nudge" />
          </button>
        </>
      )}

      {/* Dots below the banner */}
      {n > 1 && (
        <div className="mt-3 flex justify-center">
          {banners.map((b, i) => (
            <button
              type="button"
              key={b.id}
              onClick={() => {
                setTrackIndex(i + 1)
                setIsAnimating(true)
              }}
              className="w-11 h-11 flex items-center justify-center"
              aria-label={`Перейти к баннеру ${i + 1}`}
              aria-current={i + 1 === trackIndex ? 'page' : undefined}
            >
              <span
                className={`block h-2 rounded-full transition-[width,background-color] ${
                  i + 1 === trackIndex ? 'w-6 bg-navy-900' : 'w-2 bg-navy-900/30'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
