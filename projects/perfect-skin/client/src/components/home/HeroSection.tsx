import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

export function HeroSection() {
  const { openQuiz } = useDrawer()

  return (
    <section className="bg-background pt-8 md:pt-12 pb-10 md:pb-14">
      <div className="container-app">
        {/* Grid: left (text) + right (card with accent bg) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-20 items-start">
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

          {/* RIGHT: Accent background with product card */}
          <div className="relative min-h-[500px] flex items-start justify-end">
            {/* Accent bg block (golden) */}
            <picture className="absolute inset-0 hidden md:block">
              <source srcSet="/photos/m4.webp" type="image/webp" />
              <img
                src="/photos/m4.png"
                className="w-full h-full object-cover rounded-block"
                alt="Косметика ISSEIMI в воде"
                width={1122}
                height={1402}
                fetchPriority="high"
              />
            </picture>

            {/* Product card (beige) */}
            <Link to="/product/bee-venom-cream-antivozrastnoj-krem" className="relative z-10 bg-background rounded-block p-6 md:p-10 max-w-[320px] ml-auto mt-32 md:mt-48 md:-ml-10 block hover:no-underline">
              {/* Badge */}
              <div className="text-label font-bold text-gold-text mb-2">
                ХИТ ПРОДАЖ · ISSEIMI BASE
              </div>

              {/* Product title */}
              <h2 className="text-h3 md:text-h2 font-heading font-bold mb-1">
                Beevenom Cream
              </h2>

              {/* Product description */}
              <p className="text-body leading-body text-muted-foreground mb-2">
                Антивозрастной крем с пчелиным ядом
              </p>

              {/* Price */}
              <div className="text-price font-sans font-semibold tabular-nums text-2xl text-foreground mb-2">
                8&nbsp;077&nbsp;₽
              </div>

              {/* CTA Button */}
              <span className="w-full bg-primary text-primary-foreground font-heading font-bold py-3 px-6 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11 flex items-center justify-center">
                В корзину
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
