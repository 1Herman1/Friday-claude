import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

export function HeroSection() {
  const { openQuiz } = useDrawer()
  const [video, setVideo] = useState<'desk' | 'mob' | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const portrait = window.matchMedia('(orientation: portrait)').matches
    setVideo(portrait ? 'mob' : 'desk')
  }, [])

  return (
    <section
      className="relative isolate overflow-hidden bg-background h-[100svh] min-h-[560px]"
      style={{ marginTop: 'calc(-1 * var(--header-h, 72px))' }}
    >
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
          className="w-full h-full object-cover object-[50%_20%] landscape:object-[75%_35%] landscape:lg:object-[50%_35%] portrait:object-contain portrait:object-top"
        />
      </picture>

      {video && (
        <video
          key={video}
          poster={`/video/hero/${video}-start.webp`}
          muted
          playsInline
          autoPlay
          preload="auto"
          aria-hidden="true"
          className="absolute inset-0 -z-10 w-full h-full object-cover object-[50%_20%] landscape:object-[75%_35%] landscape:lg:object-[50%_35%] portrait:object-contain portrait:object-top"
        >
          <source src={`/video/hero/${video}.webm`} type="video/webm" />
          <source src={`/video/hero/${video}.mp4`} type="video/mp4" onError={() => setVideo(null)} />
        </video>
      )}

      <div className="absolute inset-x-0 bottom-0 h-[55%] portrait:h-[62%] -z-10 bg-gradient-to-t from-background via-background/80 to-transparent landscape:lg:hidden" />

      <div
        className="container-app h-full flex flex-col justify-end pb-10 md:pb-14 landscape:lg:max-w-none landscape:lg:justify-center landscape:lg:pb-24 landscape:lg:[@media(max-height:700px)]:pb-12"
        style={{ paddingTop: 'var(--header-h, 72px)' }}
      >
        <div className="max-w-[560px] landscape:lg:max-w-none">
          <p className="mb-3 text-label font-semibold uppercase tracking-wide text-primary landscape:lg:mb-4 landscape:lg:text-body-sm landscape:2xl:mb-6">
            ИСПАНИЯ · HEBER FARMA · С 2017 ГОДА
          </p>

          <h1 className="mb-4 md:mb-6 text-4xl sm:text-5xl md:text-6xl font-heading font-bold leading-[1.02] landscape:lg:text-hero landscape:2xl:mb-8">
            <span className="block landscape:lg:whitespace-nowrap">
              ПРО-<br className="hidden landscape:lg:inline" />КОСМЕТИКА
            </span>
            <span className="block landscape:lg:whitespace-nowrap">ИЗ ИСПАНИИ</span>
          </h1>

          <p className="mb-6 md:mb-8 max-w-prose text-body leading-body text-foreground landscape:lg:text-lead landscape:lg:max-w-[min(30vw,65ch)] landscape:2xl:mb-12">
            Два бренда фармацевтического производства — для домашнего ухода и
            для работы в кабинете косметолога.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 landscape:lg:gap-4">
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center min-h-12 px-6 py-3 landscape:2xl:px-8 landscape:2xl:py-4 rounded-pill bg-primary text-primary-foreground font-heading font-bold text-body transition-[opacity,transform] duration-160 ease-out hover:opacity-90 active:scale-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Смотреть каталог
            </Link>
            <button
              onClick={openQuiz}
              className="inline-flex items-center justify-center min-h-12 px-6 py-3 landscape:2xl:px-8 landscape:2xl:py-4 rounded-pill border border-primary text-primary bg-background/40 backdrop-blur-sm font-heading font-bold text-body transition-[opacity,transform] duration-160 ease-out hover:opacity-90 active:scale-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Подобрать уход
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
