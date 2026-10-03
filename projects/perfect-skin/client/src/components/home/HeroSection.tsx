import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

export function HeroSection() {
  const { openQuiz } = useDrawer()

  return (
    <section className="bg-background pt-8 md:pt-12 pb-10 md:pb-14">
      <div className="container-app">
        {/* Grid: left (text) + right (card with accent bg) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-20 items-stretch">
          {/* LEFT: Text, buttons, tags */}
          <div>
            {/* Badge */}
            <div className="inline-block bg-accent text-foreground px-1 py-0.5 rounded-pill text-label font-bold uppercase tracking-wide mb-2 md:mb-3">
              ИСПАНИЯ · HEBER FARMA · С 2017 ГОДА
            </div>

            {/* Main heading */}
            <div className="max-w-[680px]">
              <h1 className="text-5xl md:text-6xl font-heading font-bold mb-2 md:mb-10 leading-[1.12]">
                ПРО-КОСМЕТИКА
                <span className="block">ИЗ ИСПАНИИ</span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-body leading-body text-muted-foreground mb-10 md:mb-3 max-w-prose">
              Два бренда фармацевтического производства — для домашнего ухода и
              для работы в кабинете косметолога.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6 md:mb-10">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center bg-primary text-primary-foreground font-heading font-bold px-6 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11"
              >
                Смотреть каталог
              </Link>
              <button
                onClick={openQuiz}
                className="inline-flex items-center justify-center border border-primary text-primary bg-transparent font-heading font-bold px-6 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11"
              >
                Подобрать уход
              </button>
            </div>

            {/* Benefit tags */}
            <div className="flex flex-col gap-3">
              <div className="text-body-sm font-bold text-foreground">
                40+ ПОЗИЦИЙ
              </div>
              <div className="text-body-sm font-bold text-foreground">
                ОФИЦИАЛЬНЫЙ ДИСТРИБЬЮТОР
              </div>
              <div className="text-body-sm font-bold text-foreground">
                ВСЯ ПРОДУКЦИЯ СЕРТИФИЦИРОВАНА
              </div>
            </div>
          </div>

          {/* RIGHT: hero photo */}
          <picture className="block w-full aspect-[4/5] lg:aspect-auto lg:h-full lg:min-h-[560px]">
            <source
              type="image/webp"
              srcSet="/photos/hero-face-768.webp 768w, /photos/hero-face.webp 1200w"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <img
              src="/photos/hero-face.jpg"
              alt="Лицо девушки, проступающее сквозь слой крема"
              width={1200}
              height={1490}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover object-[60%_35%] rounded-block"
            />
          </picture>
        </div>
      </div>
    </section>
  )
}
