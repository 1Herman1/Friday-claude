import { useCallback, useRef, useState } from 'react'
import { useDrawer } from '@/context/DrawerContext'
import { BTN_PRIMARY, LABEL } from '@/components/about/classes'
import { IconArrowRight, IconPhone } from '@/components/icons'
import { ConsultationPopup } from './ConsultationPopup'

export function CtaTiles() {
  const { openQuiz } = useDrawer()
  const [consultOpen, setConsultOpen] = useState(false)
  const consultRef = useRef<HTMLButtonElement>(null)
  const closeConsult = useCallback(() => setConsultOpen(false), [])

  return (
    <section aria-labelledby="home-quiz-title" className="bg-background py-10 md:py-14">
      <div className="container-app">
        <div className="press-tile grid overflow-hidden rounded-block bg-accent text-accent-foreground lg:grid-cols-12 transition-transform duration-200 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex flex-col p-6 md:p-10 xl:p-12 lg:col-span-5">
            <p className={`${LABEL} text-accent-foreground`}>Подбор ухода · 6 вопросов</p>
            <h2 id="home-quiz-title" className="mt-3 text-h2 [text-wrap:balance]">Подобрать косметику</h2>
            <p className="mt-4 max-w-[40ch] text-body leading-body text-accent-foreground [text-wrap:pretty]">
              Ответьте на&nbsp;вопросы о&nbsp;типе кожи и&nbsp;задаче&nbsp;— соберём программу ухода из&nbsp;средств ISSEIMI и&nbsp;GLACÉE.
            </p>
            <button
              type="button"
              onClick={openQuiz}
              className={`press-cta ${BTN_PRIMARY} mt-8 lg:self-start after:absolute after:-inset-[100vmax] after:content-['']`}
            >
              Начать подбор
            </button>
          </div>

          {/* pointer-events-none: картинка позиционирована и иначе перекрыла бы растяжку кнопки — клик по ней не открывал бы подбор */}
          <figure aria-hidden="true" className="pointer-events-none relative aspect-[16/9] bg-card lg:col-span-7 lg:aspect-auto lg:min-h-full">
            <img
              src="/photos/cta/quiz-ritual.webp"
              srcSet="/photos/cta/quiz-ritual-800.webp 800w, /photos/cta/quiz-ritual.webp 1600w"
              sizes="(min-width:1024px) 58vw, 100vw"
              width={1600}
              height={900}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <figcaption className="absolute bottom-3 left-3 rounded-media bg-card/90 px-3 py-2 md:bottom-6 md:left-6 md:px-4 md:py-3">
              <span className={`${LABEL} block text-muted-foreground`}>Программа ухода</span>
              <span className="mt-1 block text-body-sm font-semibold text-foreground">Очищение · Сыворотка · Крем</span>
            </figcaption>
          </figure>
        </div>

        <button
          ref={consultRef}
          type="button"
          onClick={() => setConsultOpen(true)}
          aria-haspopup="dialog"
          className="group mt-3 flex min-h-11 w-full items-center gap-4 border-b border-border py-5 text-left md:mt-4 md:gap-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-pill bg-muted text-primary">
            <IconPhone size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-body font-bold text-foreground md:text-[1.125rem]">Консультация косметолога</span>
            <span className="mt-0.5 block text-body-sm text-muted-foreground">
              Специалист перезвонит или подскажет уход по&nbsp;телефону
            </span>
          </span>
          <span className="ml-auto hidden font-heading font-semibold text-primary md:inline">Записаться</span>
          <IconArrowRight size={22} className="shrink-0 text-primary transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
        </button>
      </div>

      <ConsultationPopup open={consultOpen} onClose={closeConsult} returnFocusTo={consultRef} />
    </section>
  )
}
