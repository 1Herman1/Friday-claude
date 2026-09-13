import { Link } from 'react-router-dom'
import { useReveal } from '../../hooks/useReveal'
import { useSiteText } from '../../context/SiteTextsContext'
import { useCategoryTree, findNode } from '../../hooks/useCategoryTree'

const categories = [
  {
    id: 'dogs',
    slug: 'dogs-food',
    label: 'СОБАКИ',
    href: '/catalog?species=dog',
    image: '/categories/dogs.png',
    fit: 'contain' as const,
  },
  {
    id: 'cats',
    slug: 'cats-food',
    label: 'КОТЫ И КОШКИ',
    href: '/catalog?species=cat',
    image: '/categories/cats.png',
    fit: 'contain' as const,
  },
  {
    id: 'vet',
    slug: 'care',
    label: 'ВЕТАПТЕКА',
    href: '/catalog?category=care',
    image: '/categories/vet.png',
    // Нос и лапа — фотография без прозрачности: заполняет плитку целиком.
    fit: 'cover' as const,
  },
]

export default function CategoryTiles() {
  const tree = useCategoryTree()
  const labelOf = (cat: { slug: string; label: string }) => findNode(tree, cat.slug)?.name.toUpperCase() ?? cat.label
  const groupRef = useReveal<HTMLDivElement>()
  const categoriesTitle = useSiteText('home.categories.title', 'Категории')

  return (
    <section id="categories" className="scroll-mt-24 py-12 md:py-16">
      <div ref={groupRef} className="reveal-group max-w-7xl mx-auto px-4">
        <h2 className="reveal-item text-2xl font-bold text-navy-900">{categoriesTitle}</h2>

        {/* Три равные плитки в сетку: мобиль — вертикальный стек, планшет+ — три в ряд.
            Пропорция ~1:1.2, так что на 3 колонки aspect-ratio[4/5] = 80% по высоте. */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={cat.href}
              aria-label={labelOf(cat)}
              /* Серая плитка и радиус 32px — по референсу текущего сайта клиента
                 (решение владельца, исключение из шкалы радиусов MASTER). */
              className="reveal-item category-tile group relative block overflow-hidden rounded-card bg-[#D9D9D9] aspect-[4/3] sm:aspect-[4/5]"
            >
              {/* Вырезанный объект на прозрачном фоне, прижат к низу и центру */}
              <img
                src={cat.image}
                alt=""
                aria-hidden="true"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
                className={
                  cat.fit === 'cover'
                    ? 'category-tile__img pointer-events-none select-none absolute inset-0 h-full w-full object-cover'
                    : 'category-tile__img pointer-events-none select-none absolute inset-x-0 bottom-0 h-[88%] mx-auto w-auto object-contain'
                }
              />

              {/* Подпись внизу поверх затемняющего градиента — читается и на светлой шерсти */}
              <div className="category-tile__scrim absolute inset-x-0 bottom-0 pt-16 pb-6 flex items-end justify-center bg-gradient-to-t from-black/55 to-transparent">
                <span className="category-tile__label text-center uppercase tracking-wide font-semibold text-lg lg:text-xl text-white">
                  {labelOf(cat)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
