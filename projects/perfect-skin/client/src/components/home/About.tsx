export function About() {
  return (
    <section id="about" className="bg-background py-10 md:py-14">
      <div className="container-app">
        <div className="max-w-prose mb-16 md:mb-24">
          <h2 className="text-h2 font-heading font-bold mb-6">О компании</h2>
          <p className="text-body leading-body text-foreground mb-6">
            Perfect Skin — официальный дистрибьютор испанского фармацевтического
            концерна Heber Farma с 2017 года. Концерн занимается разработкой и
            производством премиум-косметики более 30 лет.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Stat 1: 30+ years */}
          <div>
            <div className="text-display font-heading font-bold text-foreground mb-2">
              30+
            </div>
            <p className="text-body-sm text-muted-foreground">
              Лет исследований
            </p>
          </div>

          {/* Stat 2: 100% certified */}
          <div>
            <div className="text-display font-heading font-bold text-foreground mb-2">
              100%
            </div>
            <p className="text-body-sm text-muted-foreground">
              Сертифицировано
            </p>
          </div>

          {/* Stat 3: 9+ years on market */}
          <div>
            <div className="text-display font-heading font-bold text-foreground mb-2">
              9+
            </div>
            <p className="text-body-sm text-muted-foreground">
              Лет на рынке
            </p>
          </div>

          {/* Stat 4: 40+ countries */}
          <div>
            <div className="text-display font-heading font-bold text-foreground mb-2">
              40+
            </div>
            <p className="text-body-sm text-muted-foreground">
              Стран-партнёров
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
