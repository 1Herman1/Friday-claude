import { useState } from 'react'
import { Link } from 'react-router-dom'

const categories = [
  {
    num: '01',
    title: 'Уход за лицом',
    shortLabel: 'Лицо',
    desc: 'Кремы, сыворотки и маски ISSEIMI для домашнего и кабинетного ухода.',
    slug: 'kremy-dlya-litsa-i-shei',
    bgColor: 'bg-accent',
    textColor: 'text-foreground',
  },
  {
    num: '02',
    title: 'Сыворотки',
    shortLabel: 'Сыворотки',
    desc: 'Активные концентраты для интенсивного ухода.',
    slug: 'syvorotki',
    bgColor: 'bg-border',
    textColor: 'text-foreground',
  },
  {
    num: '03',
    title: 'Маски',
    shortLabel: 'Маски',
    desc: 'Питающие и очищающие маски для лица.',
    slug: 'maski',
    bgColor: 'bg-primary-foreground',
    textColor: 'text-foreground',
    borderClass: 'ring-1 ring-inset ring-border',
  },
  {
    num: '04',
    title: 'Наборы',
    shortLabel: 'Наборы',
    desc: 'Готовые программы ухода и подарочные боксы.',
    slug: 'nabory',
    bgColor: 'bg-muted',
    textColor: 'text-foreground',
  },
]

export function CategoryAccordion() {
  const [activeIdx, setActiveIdx] = useState(0)

  return (
    <section id="catalog" className="bg-background py-20 md:py-32">
      <div className="container-app">
        <h2 className="text-h2 font-heading font-bold mb-3 md:mb-16">
          Категории
        </h2>

        {/* Accordion: Desktop flex-row, mobile flex-col */}
        <div
          className="flex flex-col md:flex-row gap-3 md:gap-1 md:h-full"
          style={{ minHeight: '160px' }}
        >
          {categories.map((cat, idx) => (
            <Link
              key={cat.slug}
              to={`/catalog/${cat.slug}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onFocus={() => setActiveIdx(idx)}
              className={`
                relative flex-1 min-w-0 overflow-hidden rounded-block
                transition-[flex] duration-300 ease-out
                group
                ${cat.bgColor} ${cat.textColor} ${cat.borderClass || ''}
                md:hover:flex-grow-[2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                md:min-h-96 min-h-40
              `}
              style={{
                flex: activeIdx === idx && typeof window !== 'undefined' && window.innerWidth >= 768 ? '1.5 1 0' : '1 1 0',
              }}
            >
              {/* Spine (vertical) - desktop only */}
              <div className="hidden md:flex absolute left-0 top-0 bottom-0 items-center justify-center w-12 md:w-16 flex-shrink-0 pointer-events-none">
                <div className="spine-vertical">
                  {cat.title}
                </div>
              </div>

              {/* Number - desktop large, mobile hidden */}
              <div
                className="hidden md:flex absolute right-2 bottom-2 text-9xl font-heading font-900 opacity-12 pointer-events-none leading-none"
              >
                {cat.num}
              </div>

              {/* Open content - visible on desktop hover, visible on mobile */}
              <div className="absolute inset-0 p-4 md:p-10 flex flex-col justify-start opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="text-label font-bold opacity-70 mb-2">
                  {cat.num} · {cat.shortLabel}
                </div>
                <h3 className="text-h3 font-heading font-bold mb-3">
                  {cat.title}
                </h3>
                <p className="text-body leading-body opacity-90 mb-4">
                  {cat.desc}
                </p>
                <div className="hidden md:block mt-auto text-body font-bold opacity-60">→</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
