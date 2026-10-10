import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

export function CtaTiles() {
  const { openQuiz } = useDrawer()

  return (
    <section className="bg-background">
      <div className="container-app">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3 mb-10 md:mb-14">
          {/* Tile 1: Quiz — кликабельна целиком (кнопка растянута на плитку) */}
          <div className="press-tile bg-accent text-foreground rounded-block p-8 lg:p-16 flex flex-col items-center text-center hover:-translate-y-1">
            <h2 className="text-h3 lg:text-h2 font-heading font-bold mb-4 md:mb-6 [text-wrap:balance]">
              Подобрать косметику
            </h2>
            <p className="text-body leading-body text-foreground mb-6 md:mb-10 opacity-90 max-w-[34ch] [text-wrap:pretty]">
              Ответьте на 5 вопросов о типе кожи и задаче — соберём программу
              ухода из средств ISSEIMI и GLACÉE.
            </p>
            <button
              onClick={openQuiz}
              className="press-cta mt-auto w-full max-w-[16rem] bg-primary text-primary-foreground font-heading font-bold px-6 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-12 after:absolute after:-inset-[100vmax] after:content-['']"
            >
              Начать подбор
            </button>
          </div>

          {/* Tile 2: Consultation */}
          <Link
            to="/consultation"
            className="press-tile group border border-primary rounded-block p-8 lg:p-16 bg-transparent hover:-translate-y-1 flex flex-col items-center text-center no-underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <h2 className="text-h3 lg:text-h2 font-heading font-bold mb-4 md:mb-6 text-primary [text-wrap:balance]">
              Консультация косметолога
            </h2>
            <p className="text-body leading-body text-muted-foreground mb-6 md:mb-10 max-w-[34ch] [text-wrap:pretty]">
              Опишите задачу — специалист перезвонит или напишет и подскажет уход.
            </p>
            <span className="press-cta mt-auto w-full max-w-[16rem] border border-primary text-primary font-heading font-bold px-6 py-3 rounded-pill transition-colors duration-100 group-hover:bg-primary group-hover:text-background group-[.is-pressed]:bg-primary group-[.is-pressed]:text-background min-h-12 flex items-center justify-center">
              Записаться
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
