import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

export function HeroSection() {
  const { openQuiz } = useDrawer()
  const [video, setVideo] = useState<'desk' | 'mob' | null>(null)
  // После основного ролика — петля «живого» лица (моргание, лёгкое движение головы).
  // Её первый кадр совпадает с последним кадром ролика, поэтому подмена не видна.
  const [loadIdle, setLoadIdle] = useState(false)
  const [idle, setIdle] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const idleRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const portrait = window.matchMedia('(orientation: portrait)').matches
    setVideo(portrait ? 'mob' : 'desk')
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section || !idle) return
    // Петля играет, только пока первый экран виден
    const io = new IntersectionObserver(([entry]) => {
      const el = idleRef.current
      if (!el) return
      if (entry.isIntersecting) el.play().catch(() => {})
      else el.pause()
    })
    io.observe(section)
    return () => io.disconnect()
  }, [idle])

  const videoClass =
    'absolute inset-0 -z-10 w-full h-full object-cover object-[50%_20%] landscape:object-[75%_35%] landscape:lg:object-[50%_35%] portrait:object-[50%_0%] md:portrait:object-[50%_10%]'

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-background h-[100svh] min-h-[560px] md:mt-[calc(-1*var(--header-h,72px))] max-md:min-h-[480px] max-md:h-[calc(100svh-var(--header-h,72px)-64px-env(safe-area-inset-bottom))] max-md:ios:h-[calc(100svh-var(--header-h,72px))]"
    >
      {/* Телефон: баннер начинается под шапкой; на Android кончается над нижней панелью,
          на iOS уходит под плавающую «пилюлю», а текст и кнопки стоят над ней */}
      <picture className="absolute inset-0 -z-10">
        <source
          media="(orientation: portrait)"
          type="image/webp"
          srcSet="/photos/hero-tall-720.webp 720w, /photos/hero-tall-1080.webp 1080w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/photos/hero-wide-1600.webp 1600w, /photos/hero-wide-2560.webp 2560w"
          sizes="100vw"
        />
        <img
          src="/photos/hero-wide.jpg"
          alt="Лицо девушки, проступающее сквозь слой крема"
          width={1920}
          height={1072}
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover object-[50%_20%] landscape:object-[75%_35%] landscape:lg:object-[50%_35%] portrait:object-[50%_0%] md:portrait:object-[50%_10%]"
        />
      </picture>

      {video && loadIdle && (
        <video
          ref={idleRef}
          muted
          playsInline
          loop
          preload="auto"
          aria-hidden="true"
          onPlaying={() => setIdle(true)}
          className={videoClass}
        >
          <source src={`/video/hero/${video}-idle.webm`} type="video/webm" />
          <source src={`/video/hero/${video}-idle.mp4`} type="video/mp4" />
        </video>
      )}

      {video && (
        <video
          key={video}
          ref={(el) => {
            if (!el || el.dataset.started) return
            el.dataset.started = '1'
            el.muted = true
            el.defaultMuted = true
            el.setAttribute('muted', '')
            el.play().catch(() => setVideo(null))
          }}
          poster={`/video/hero/${video}-start.webp`}
          muted
          playsInline
          autoPlay
          preload="auto"
          aria-hidden="true"
          onPlaying={() => setLoadIdle(true)}
          onEnded={() => {
            const el = idleRef.current
            if (!el) return
            el.muted = true
            el.play().catch(() => {})
          }}
          className={`${videoClass} ${idle ? 'invisible' : ''}`}
        >
          <source src={`/video/hero/${video}.webm`} type="video/webm" />
          <source src={`/video/hero/${video}.mp4`} type="video/mp4" onError={() => setVideo(null)} />
        </video>
      )}

      <div className="absolute inset-x-0 bottom-0 h-[55%] portrait:h-[62%] max-md:ios:portrait:h-[72%] -z-10 bg-gradient-to-t from-background via-background/80 to-transparent landscape:lg:hidden" />

      <div
        className="container-app h-full flex flex-col justify-end pt-4 pb-6 max-md:ios:pb-[calc(env(safe-area-inset-bottom)+96px)] md:pt-[var(--header-h,72px)] md:pb-14 landscape:lg:justify-center landscape:lg:pb-24 landscape:lg:[@media(max-height:900px)]:pb-12"
      >
        <div className="max-w-[560px] landscape:lg:max-w-none">
          <p className="mb-3 text-label font-semibold uppercase tracking-wide text-primary landscape:lg:mb-4 lg:text-body-sm landscape:2xl:mb-6">
            ИСПАНИЯ · HEBER FARMA · С 2017 ГОДА
          </p>

          <h1 className="mb-3 md:mb-6 text-4xl sm:text-5xl md:text-6xl font-heading font-bold leading-[1.02] landscape:lg:text-hero landscape:2xl:mb-8">
            <span className="block landscape:lg:whitespace-nowrap">
              ПРО-<br className="hidden landscape:lg:inline" />КОСМЕТИКА
            </span>
            <span className="block landscape:lg:whitespace-nowrap">ИЗ ИСПАНИИ</span>
          </h1>

          <p className="mb-5 md:mb-8 max-w-prose text-body-sm md:text-body leading-body text-foreground landscape:lg:text-lead landscape:lg:max-w-[min(30vw,34rem)] [text-wrap:pretty] landscape:2xl:mb-12">
            ISSEIMI и&nbsp;GLACÉE Skincare — фармацевтическое производство Испании
            для домашнего ухода и&nbsp;работы в&nbsp;кабинете косметолога.
          </p>

          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3 landscape:lg:gap-4">
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center min-h-12 px-3 sm:px-6 py-3 max-sm:text-body-sm landscape:2xl:px-8 landscape:2xl:py-4 rounded-pill bg-primary text-primary-foreground font-heading font-bold text-body transition-[opacity,transform] duration-160 ease-out hover:opacity-90 active:scale-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Смотреть каталог
            </Link>
            <button
              onClick={openQuiz}
              className="inline-flex items-center justify-center min-h-12 px-3 sm:px-6 py-3 max-sm:text-body-sm landscape:2xl:px-8 landscape:2xl:py-4 rounded-pill border border-primary text-primary bg-background/40 backdrop-blur-sm font-heading font-bold text-body transition-[opacity,transform] duration-160 ease-out hover:opacity-90 active:scale-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Подобрать уход
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
