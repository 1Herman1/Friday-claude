import { useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Link } from 'react-router-dom'

const categories = [
  {
    num: '01',
    title: 'Уход за лицом',
    eyebrow: 'Кремы, сыворотки и маски ISSEIMI',
    slug: 'kremy-dlya-litsa-i-shei',
    photo: '/products-optimized/dinamizante-vosstanavlivayushhij-krem/card.webp',
    bgColor: 'bg-accent',
  },
  {
    num: '02',
    title: 'Сыворотки',
    eyebrow: 'Активные концентраты для интенсивного ухода',
    slug: 'syvorotki',
    photo: '/products-optimized/collagen-booster-vosstanavlivayushhaya-syvorotka/card.webp',
    bgColor: 'bg-accent/60',
  },
  {
    num: '03',
    title: 'Маски',
    eyebrow: 'Питающие и очищающие маски для лица',
    slug: 'maski',
    photo: '/products-optimized/tts-energizing-mask-maska-so-stvolovymi-kletkami/card.webp',
    bgColor: 'bg-accent/30',
  },
  {
    num: '04',
    title: 'Наборы',
    eyebrow: 'Готовые программы ухода и подарочные боксы',
    slug: 'nabory',
    photo:
      '/products-optimized/podarochnyj-nabor-bee-venom-s-pchelinym-yadom-dlya-razglazhivaniya-morshhin-i-ustraneniya-tusklosti-kozhi/card.webp',
    bgColor: 'bg-muted',
  },
]

export function CategoryAccordion() {
  // На sm/md: сетка 2×2. На lg: гармошка с раскрытием на hover.
  const [activeIdx, setActiveIdx] = useState(0)
  // Живой отслеживатель: однократный замер window.innerWidth не переживает
  // поворот планшета и изменение размера окна.
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return (
    <section id="catalog" className="bg-background py-10 md:py-14">
      <div className="container-app">
        <h2 className="text-h2 font-heading font-bold mb-3 md:mb-8">
          Категории
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:flex gap-3 md:gap-2 lg:gap-3 lg:h-[420px]">
          {categories.map((cat, idx) => {
            const active = activeIdx === idx
            return (
              <Link
                key={cat.slug}
                to={`/catalog/${cat.slug}`}
                onMouseEnter={() => isDesktop && setActiveIdx(idx)}
                onFocus={() => isDesktop && setActiveIdx(idx)}
                onClick={() => !isDesktop && setActiveIdx(idx)}
                onTouchStart={() => !isDesktop && setActiveIdx(idx)}
                className={`
                  relative min-w-0 overflow-hidden rounded-block group
                  transition-[flex-grow] duration-300 ease-out
                  ${cat.bgColor} text-foreground
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                  min-h-44 lg:min-h-0
                  lg:flex-grow
                `}
                style={isDesktop ? { flexGrow: active ? 5 : 1, flexBasis: 0 } : {}}
                aria-expanded={isDesktop ? active : undefined}
              >
                {/* Свёрнутый корешок: вертикальная подпись (только десктоп LG) */}
                <div
                  className={`hidden lg:flex absolute inset-0 items-center justify-center transition-opacity duration-200 flex-col gap-2 ${
                    active ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <span className="text-label font-semibold">{cat.num}</span>
                  <span className="spine-vertical">{cat.title}</span>
                  <span className="text-xl" aria-hidden="true">↓</span>
                </div>

                {/* Раскрытое содержимое */}
                <div
                  className={`p-5 md:p-8 flex flex-col h-full transition-opacity duration-300 ${
                    active ? 'lg:opacity-100' : 'lg:opacity-0'
                  }`}
                >
                  <div className="text-label font-semibold opacity-70 mb-2 lg:whitespace-nowrap">
                    {cat.eyebrow}
                  </div>
                  <h3 className="text-h3 md:text-h2 font-heading font-bold mb-4">
                    {cat.title}
                  </h3>
                  <span
                    className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    →
                  </span>
                  <img
                    src={cat.photo}
                    alt=""
                    loading="lazy"
                    className="absolute right-2 bottom-0 w-32 md:w-36 lg:w-64 max-w-[42%] lg:max-w-[55%] object-contain pointer-events-none select-none mix-blend-multiply"
                  />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
