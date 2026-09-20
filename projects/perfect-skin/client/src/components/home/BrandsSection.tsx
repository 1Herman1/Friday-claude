export function BrandsSection() {
  return (
    <section className="bg-background py-10 md:py-14">
      <div className="container-app">
        <div className="mb-12 md:mb-16">
          <h2 className="text-h2 font-heading font-bold mb-4">
            Два бренда, одно производство
          </h2>
          <p className="text-body leading-body text-muted-foreground max-w-prose">
            Обе линейки выпускает испанский фармконцерн Heber Farma.
          </p>
        </div>

        {/* Brands Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ISSEIMI Card */}
          <div className="bg-card rounded-block overflow-hidden">
            {/* Image */}
            <img
              src="/photos/m3.png"
              alt="ISSEIMI косметика"
              width={400}
              height={300}
              loading="lazy"
              className="w-full h-auto object-cover aspect-[3/2]"
            />
            {/* Content */}
            <div className="bg-card p-6 md:p-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1 rounded-pill text-label font-bold uppercase tracking-wide mb-4">
                Премиум+
              </div>

              <h3 className="text-h3 font-heading font-bold mb-3 uppercase">
                ISSEIMI
              </h3>
              <p className="text-body leading-body text-muted-foreground mb-4">
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
          <div className="bg-card rounded-block overflow-hidden">
            {/* Image */}
            <img
              src="/photos/5462985731371375247.jpg"
              alt="GLACÉE Skincare"
              width={400}
              height={300}
              loading="lazy"
              className="w-full h-auto object-cover aspect-[3/2]"
            />
            {/* Content */}
            <div className="bg-card p-6 md:p-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1 rounded-pill text-label font-bold uppercase tracking-wide mb-4">
                Премиум
              </div>

              <h3 className="text-h3 font-heading font-bold mb-3 uppercase">
                GLACÉE Skincare
              </h3>
              <p className="text-body leading-body text-muted-foreground mb-4">
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
    </section>
  )
}
