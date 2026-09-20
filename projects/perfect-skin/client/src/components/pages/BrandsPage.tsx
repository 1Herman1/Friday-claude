import { Link } from 'react-router-dom'
import { useCatalogFacets } from '@/hooks/useCatalogFacets'
import { pluralize } from '@/lib/format'

interface BrandConfig {
  id: string
  name: string
  badge: string
  photo: string
  description: string[]
  lines: { slug: string; name: string }[]
}

const brandsData: BrandConfig[] = [
  {
    id: 'isseimi',
    name: 'ISSEIMI',
    badge: 'Премиум+',
    photo: '/photos/m3.png',
    description: [
      'Космецевтика с активными концентратами — пептидный ряд, стволовые клетки, факторы роста.',
      'Три специализированные линейки: Base для домашнего ухода, MD для интенсивных концентратов, Nat Collection на натуральных маслах и экстрактах.',
    ],
    lines: [
      { slug: 'isseimi-base', name: 'Base' },
      { slug: 'isseimi-md', name: 'MD' },
      { slug: 'isseimi-nat-collection', name: 'Nat Collection' },
    ],
  },
  {
    id: 'glacee-skincare',
    name: 'GLACÉE Skincare',
    badge: 'Премиум',
    photo: '/photos/5462985731371375342.jpg',
    description: [
      'Ежедневный премиум-уход с термальной водой и озоном — европейское качество с понятными протоколами.',
      'Отдельная мужская линейка Man Line и готовые подарочные боксы.',
    ],
    lines: [{ slug: 'glacee-skincare-man-line', name: 'Man Line' }],
  },
]

// Стабильная ссылка: инлайновый {} перезапускал бы эффект каждый рендер.
const EMPTY_FILTERS = {}

export function BrandsPage() {
  const facets = useCatalogFacets(EMPTY_FILTERS)
  const facetLines = facets.data?.lines || []

  // Создаём карту для быстрого поиска счётчиков
  const lineCountMap = new Map(facetLines.map((line) => [line.value, line.count]))

  return (
    <div className="container-app py-12 md:py-20">
      {/* Header */}
      <div className="mb-12 md:mb-16">
        <h1 className="text-2xl font-heading font-bold uppercase tracking-tight text-foreground mb-4">
          Два бренда, одно производство
        </h1>
        <p className="text-base text-muted-foreground max-w-prose">
          Обе линейки выпускает испанский фармконцерн Heber Farma.
        </p>
      </div>

      {/* Brands Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        {brandsData.map((brand) => (
          <div
            key={brand.id}
            className="border border-border rounded-block bg-card overflow-hidden"
          >
            {/* Photo */}
            <img
              src={brand.photo}
              alt={brand.name}
              width={600}
              height={400}
              loading="lazy"
              className="w-full h-auto object-cover aspect-[3/2] rounded-media"
            />

            {/* Content */}
            <div className="p-8 md:p-10">
              {/* Badge */}
              <div className="inline-flex bg-primary text-primary-foreground px-3 py-1 rounded-pill text-label font-bold uppercase tracking-wide mb-6">
                {brand.badge}
              </div>

              {/* Brand name */}
              <h2 className="text-h3 font-heading font-bold text-foreground mb-4">
                {brand.name}
              </h2>

              {/* Description */}
              <div className="space-y-4 mb-8">
                {brand.description.map((para, i) => (
                  <p key={i} className="text-body leading-body text-muted-foreground">
                    {para}
                  </p>
                ))}
              </div>

              {/* Lines Grid */}
              <div className="grid grid-cols-1 gap-2 mb-8">
                {brand.lines.map((line) => {
                  const count = lineCountMap.get(line.slug) ?? 0
                  return (
                    <Link
                      key={line.slug}
                      to={`/catalog/all?brand=${brand.id}&line=${line.slug}`}
                      className="block p-4 border border-border rounded-block bg-background hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-heading font-semibold text-foreground mb-1">
                            {brand.name} {line.name}
                          </h3>
                          <p className="text-body-sm text-muted-foreground">
                            {count} {pluralize(count, ['товар', 'товара', 'товаров'])}
                          </p>
                        </div>
                        <div className="ml-4 text-muted-foreground group-hover:text-foreground transition-colors">
                          →
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* CTA */}
              <Link
                to={`/catalog/all?brand=${brand.id}`}
                className="inline-block w-full px-6 py-3 bg-primary text-primary-foreground text-center font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
              >
                Все товары {brand.name}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
