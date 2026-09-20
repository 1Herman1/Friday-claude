export function WhyHeberFarma() {
  return (
    <section className="bg-muted text-foreground py-20 md:py-32">
      <div className="container-app">
        <div className="rounded-block bg-card ring-1 ring-inset ring-border p-6 md:p-10">
          <h2 className="text-h2 font-heading font-bold mb-6">
            Почему Heber Farma
          </h2>

          <div className="max-w-prose">
            <p className="text-body leading-body text-foreground mb-6">
              Heber Farma — испанский фармацевтический концерн с более чем
              30-летней историей разработки и производства космецевтики.
            </p>

            <p className="text-body leading-body text-muted-foreground mb-8">
              Продукция сертифицирована и используется в косметологических
              кабинетах по всему миру. Мы гарантируем качество и безопасность
              каждого средства.
            </p>

            {/* Stats Grid - only unique stats */}
            <div className="grid grid-cols-2 gap-3 md:gap-6">
              {/* Stat 1: 30+ years */}
              <div>
                <div className="text-display font-heading font-bold text-foreground mb-2">
                  30+
                </div>
                <p className="text-body-sm text-muted-foreground">
                  Лет исследований
                </p>
              </div>

              {/* Stat 2: Certified */}
              <div>
                <div className="text-display font-heading font-bold text-foreground mb-2">
                  100%
                </div>
                <p className="text-body-sm text-muted-foreground">
                  Сертифицировано
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
