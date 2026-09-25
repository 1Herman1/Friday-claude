import { Link } from 'react-router-dom'

interface BrandData {
  slug: string
  to: string
  name: string
  audience: string
  phrase: string
  lines: [string, string][]
  photo: {
    png: string
    webp: string | null
    alt: string
    w: number
    h: number
  }
}

const BRANDS: BrandData[] = [
  {
    slug: 'isseimi',
    to: '/catalog/all?brand=isseimi',
    name: 'ISSEIMI',
    audience: 'Для кабинета и домашнего курса',
    phrase: 'Активные концентраты: пептиды, озон, пчелиный яд, стволовые клетки.',
    lines: [
      ['Base', 'дом'],
      ['MD', 'кабинет'],
      ['Nat Collection', 'натуральные масла'],
    ],
    photo: {
      png: '/photos/m3.png',
      webp: null,
      alt: 'Сыворотки ISSEIMI FGF',
      w: 1122,
      h: 1402,
    },
  },
  {
    slug: 'glacee-skincare',
    to: '/catalog/all?brand=glacee-skincare',
    name: 'GLACÉE Skincare',
    audience: 'Для ежедневного ухода',
    phrase: 'Понятные протоколы на каждый день и готовые подарочные наборы.',
    lines: [['Man Line', 'для мужчин']],
    photo: {
      png: '/photos/m1.png',
      webp: '/photos/m1.webp',
      alt: 'GLACÉE Skincare: крем GEN ADN и сыворотка Triple Acción',
      w: 1200,
      h: 1200,
    },
  },
]

export function BrandsSection() {
  return (
    <section className="bg-background py-10 md:py-14">
      <div className="container-app">
        <div className="mb-8 md:mb-12">
          <h2 className="text-h2 font-heading font-bold mb-3">
            Два бренда из Испании
          </h2>
          <p className="text-body text-muted-foreground max-w-prose">
            Выберите бренд — откроется его каталог.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 md:gap-8">
          {BRANDS.map((b) => (
            <Link
              key={b.slug}
              to={b.to}
              className="group block rounded-block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <picture>
                {b.photo.webp && (
                  <source srcSet={b.photo.webp} type="image/webp" />
                )}
                <img
                  src={b.photo.png}
                  alt={b.photo.alt}
                  width={b.photo.w}
                  height={b.photo.h}
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-[3/2] object-cover rounded-block"
                />
              </picture>

              <p className="pt-4 md:pt-6 text-label font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {b.audience}
              </p>

              <h3 className="mt-2 text-h3 font-heading font-bold uppercase group-hover:underline underline-offset-4 decoration-1">
                {b.name}
              </h3>

              <p className="mt-3 text-body-sm text-muted-foreground max-w-[46ch]">
                {b.phrase}
              </p>

              <p className="mt-3 text-body-sm text-foreground">
                {b.lines.map((line, idx) => (
                  <span key={idx}>
                    {idx > 0 && <span> · </span>}
                    <span className="font-semibold">{line[0]}</span>
                    <span className="text-muted-foreground"> — {line[1]}</span>
                  </span>
                ))}
              </p>

              <span className="mt-4 inline-flex items-center gap-1 text-body-sm font-semibold text-primary">
                Смотреть каталог{' '}
                <span
                  aria-hidden
                  className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none"
                >
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
