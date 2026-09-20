export function BrandsSection() {
  return (
    <section className="bg-background py-20 md:py-32">
      <div className="container-app">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-20 mb-20 md:mb-32">
          {/* Aside: Title + Subtitle */}
          <div>
            <h2 className="text-h2 font-heading font-bold mb-4">
              Два бренда, одно производство
            </h2>
            <p className="text-body leading-body text-muted-foreground">
              Обе линейки выпускает испанский фармконцерн Heber Farma.
            </p>
          </div>

          {/* Brands Grid */}
          <div className="grid grid-cols-1 gap-2 md:gap-6">
            {/* ISSEIMI Card */}
            <div className="border border-border rounded-block p-8 md:p-10 bg-card relative overflow-hidden">
              {/* Background image */}
              <img
                src="/photos/m3.png"
                alt="ISSEIMI косметика"
                width={400}
                height={400}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover opacity-10"
              />

              {/* Badge */}
              <div className="absolute top-4 md:top-6 right-4 md:right-6 bg-primary text-primary-foreground px-3 py-1 rounded-pill text-label font-bold uppercase tracking-wide z-10">
                Премиум+
              </div>

              {/* Content */}
              <div className="relative z-20">
                <h3 className="text-h3 font-heading font-bold mb-4">
                  ISSEIMI
                </h3>
                <p className="text-body leading-body text-muted-foreground mb-6">
                  Космецевтика с активными концентратами: пчелиный яд, озон,
                  пептиды, стволовые клетки. Три линейки — Base для домашнего
                  ухода, MD для кабинета, Nat Collection на натуральных маслах.
                </p>
                <div className="flex flex-wrap gap-2 text-body-sm text-muted-foreground">
                  <span>ISSEIMI Base</span>
                  <span>·</span>
                  <span>ISSEIMI MD</span>
                  <span>·</span>
                  <span>ISSEIMI Nat Collection</span>
                </div>
              </div>
            </div>

            {/* GLACÉE Card */}
            <div className="border border-border rounded-block p-8 md:p-10 bg-card relative overflow-hidden">
              {/* Background image */}
              <img
                src="/photos/5462985731371375247.jpg"
                alt="GLACÉE Skincare"
                width={400}
                height={400}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover opacity-10"
              />

              {/* Badge */}
              <div className="absolute top-4 md:top-6 right-4 md:right-6 bg-primary text-primary-foreground px-3 py-1 rounded-pill text-label font-bold uppercase tracking-wide z-10">
                Премиум
              </div>

              {/* Content */}
              <div className="relative z-20">
                <h3 className="text-h3 font-heading font-bold mb-4">
                  GLACÉE Skincare
                </h3>
                <p className="text-body leading-body text-muted-foreground mb-6">
                  Ежедневный уход с европейским качеством и понятными
                  протоколами. Отдельная мужская линейка и готовые подарочные
                  боксы.
                </p>
                <div className="flex flex-wrap gap-2 text-body-sm text-muted-foreground">
                  <span>GLACÉE Skincare Man Line</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
