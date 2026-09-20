import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

export function CtaTiles() {
  const { openQuiz } = useDrawer()

  return (
    <section className="bg-background">
      <div className="container-app">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3 mb-10 md:mb-14">
          {/* Tile 1: Quiz */}
          <div className="bg-accent text-foreground rounded-block p-8 lg:p-16 transition-transform duration-200 hover:-translate-y-1">
            <h2 className="text-h3 lg:text-h2 font-heading font-bold mb-4 md:mb-6 hyphens-auto">
              Подобрать косметику
            </h2>
            <p className="text-body leading-body text-foreground mb-2 md:mb-10 opacity-90">
              Ответьте на 5 вопросов о типе кожи и задаче — соберём программу
              ухода из средств ISSEIMI и GLACÉE.
            </p>
            <button onClick={openQuiz} className="bg-primary text-primary-foreground font-heading font-bold px-2 md:px-10 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11">
              Начать подбор
            </button>
          </div>

          {/* Tile 2: Consultation */}
          <Link to="/contacts" className="border border-primary rounded-block p-8 lg:p-16 bg-transparent transition-transform duration-200 hover:-translate-y-1 block no-underline hover:no-underline">
            <h2 className="text-h3 lg:text-h2 font-heading font-bold mb-4 md:mb-6 text-primary hyphens-auto">
              Консультация косметолога
            </h2>
            <p className="text-body leading-body text-muted-foreground mb-2 md:mb-10">
              Опишите проблему и приложите фото. Специалист ответит и подберёт
              средства под вашу кожу.
            </p>
            <span className="border border-primary text-primary font-heading font-bold px-2 md:px-10 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11 flex items-center justify-center">
              Связаться
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
