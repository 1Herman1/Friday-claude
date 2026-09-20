import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

export function HeroSection() {
  const { openQuiz } = useDrawer()

  return (
    <section className="bg-background pt-12 md:pt-24 pb-20 md:pb-32">
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
            <h1 className="text-display font-heading font-bold mb-2 md:mb-10 leading-tight">
              ПРО-КОСМЕТИКА
              <span className="block">ИЗ ИСПАНИИ</span>
            </h1>

            {/* Subtitle */}
            <p className="text-body leading-body text-muted-foreground mb-10 md:mb-3 max-w-prose">
              Два бренда фармацевтического производства — для домашнего ухода и
              для работы в кабинете косметолога.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-1 mb-3 md:mb-4">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center bg-primary text-primary-foreground font-heading font-bold px-6 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11"
              >
                Смотреть каталог
              </Link>
              <button
                onClick={openQuiz}
                className="inline-flex items-center justify-center bg-accent text-foreground font-heading font-bold px-6 py-3 rounded-pill border-2 border-accent transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11"
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
            <div className="absolute inset-0 bg-accent rounded-block hidden md:block" aria-hidden="true" />

            {/* Product card (beige) */}
            <div className="relative z-10 bg-background rounded-block p-2 md:p-10 max-w-[320px] ml-auto mt-[180px] md:-ml-10">
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
              <button className="w-full bg-primary text-primary-foreground font-heading font-bold py-3 px-6 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11">
                В корзину
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
