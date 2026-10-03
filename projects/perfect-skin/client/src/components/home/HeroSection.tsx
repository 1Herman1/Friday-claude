import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

export function HeroSection() {
  const { openQuiz } = useDrawer()

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
          className="w-full h-full object-cover object-[50%_20%] landscape:object-[75%_35%]"
        />
      </picture>

      <div className="absolute inset-x-0 bottom-0 h-[55%] -z-10 bg-gradient-to-t from-background via-background/80 to-transparent landscape:lg:hidden" />

      <div className="container-app h-full flex flex-col justify-end landscape:lg:justify-center pb-10 md:pb-14 landscape:lg:pb-0" style={{ paddingTop: 'var(--header-h, 72px)' }}>
        <div className="max-w-[560px] landscape:lg:max-w-[36%]">
          <div className="inline-block bg-accent text-foreground px-1 py-0.5 rounded-pill text-label font-bold uppercase tracking-wide mb-3">
            ИСПАНИЯ · HEBER FARMA · С 2017 ГОДА
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-bold mb-4 md:mb-6 leading-[1.08]">
            ПРО-КОСМЕТИКА
            <span className="block">ИЗ ИСПАНИИ</span>
          </h1>

          <p className="text-body leading-body text-muted-foreground mb-6 md:mb-8 max-w-prose">
            Два бренда фармацевтического производства — для домашнего ухода и
            для работы в кабинете косметолога.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center bg-primary text-primary-foreground font-heading font-bold px-6 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11"
            >
              Смотреть каталог
            </Link>
            <button
              onClick={openQuiz}
              className="inline-flex items-center justify-center border border-primary text-primary bg-background/40 backdrop-blur-sm font-heading font-bold px-6 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11"
            >
              Подобрать уход
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
