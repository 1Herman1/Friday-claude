import { useDrawer } from '@/context/DrawerContext'

export function CtaTiles() {
  const { openQuiz } = useDrawer()

  return (
    <section className="bg-background">
      <div className="container-app">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-2 mb-20 md:mb-32">
          {/* Tile 1: Quiz */}
          <div className="bg-accent text-foreground rounded-block p-10 md:p-16 transition-transform duration-300 hover:scale-97">
            <h2 className="text-h2 font-heading font-bold mb-4 md:mb-6">
              Подобрать косметику
            </h2>
            <p className="text-body leading-body text-foreground mb-2 md:mb-10 opacity-90">
              Ответьте на 5 вопросов о типе кожи и задаче — соберём программу
              ухода из средств ISSEIMI и GLACÉE.
            </p>
            <button onClick={openQuiz} className="bg-foreground text-accent font-heading font-bold px-2 md:px-10 py-3 md:py-1 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11 md:min-h-11">
              Начать подбор
            </button>
          </div>

          {/* Tile 2: Consultation */}
          <div className="border border-border rounded-block p-10 md:p-16 bg-card transition-transform duration-300 hover:scale-97">
            <h2 className="text-h2 font-heading font-bold mb-4 md:mb-6">
              Консультация косметолога
            </h2>
            <p className="text-body leading-body text-muted-foreground mb-2 md:mb-10">
              Опишите проблему и приложите фото. Специалист ответит и подберёт
              средства под вашу кожу.
            </p>
            <button className="bg-foreground text-card font-heading font-bold px-2 md:px-10 py-3 md:py-1 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11 md:min-h-11">
              Записаться
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
