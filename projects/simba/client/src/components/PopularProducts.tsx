import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { productsApi, type Product } from '../lib/api'
import { useSiteText } from '../context/SiteTextsContext'
import ProductCard from './catalog/ProductCard'
import { ArrowLeftIcon, ArrowRightIcon } from './icons'

/** Ширина карточки в ленте: на десктопе ровно четыре в ряд с зазором gap-6. */
const CARD_WIDTH = 'w-[62%] sm:w-[31%] md:w-[calc((100%-4.5rem)/4)]'

type Props = {
  /** Главная страница всегда показывает «Популярные товары»; на остальных
      страницах секция называется «Рекомендуем» — это не то же самое место,
      что на главной, и заголовок не должен путать пользователя. */
  variant?: 'home' | 'default'
}

export default function PopularProducts({ variant = 'default' }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const trackRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    productsApi
      .popular(8)
      .then((res) => {
        setProducts(res.data.items)
      })
      .catch((err) => {
        setError(err?.response?.data?.error || 'Ошибка при загрузке товаров')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Стрелка гаснет на краю ленты — иначе пользователь жмёт и ничего не происходит.
  const syncArrows = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < max - 4)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    syncArrows()
    el.addEventListener('scroll', syncArrows, { passive: true })
    window.addEventListener('resize', syncArrows)
    return () => {
      el.removeEventListener('scroll', syncArrows)
      window.removeEventListener('resize', syncArrows)
    }
  }, [products, syncArrows])

  /** Листаем на одну карточку, вычисляя её реальную ширину с gap. */
  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el || el.children.length < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Шаг между началами соседних карточек = ширина карточки + gap
    const cardStep = el.children[1].getBoundingClientRect().left - el.children[0].getBoundingClientRect().left
    el.scrollBy({ left: direction * cardStep, behavior: reduce ? 'auto' : 'smooth' })
  }

  // Пока грузится — держим место скелетонами: без них между шапкой и
  // подвалом на миг образуется пустая яма, и на медленной сети это заметно.
  if (loading) {
    return (
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-8 w-56 bg-blue-50 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-blue-50 rounded-card h-72 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (error || products.length === 0) {
    return null
  }

  const popularTitle = useSiteText('home.popular.title', 'Популярные товары')
  const recommendTitle = useSiteText('home.recommend.title', 'Рекомендуем')
  const title = variant === 'home' ? popularTitle : recommendTitle
  const hasArrows = canScrollLeft || canScrollRight

  return (
    <section className="py-12 md:py-16" aria-label={title}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-navy-900">{title}</h2>

          {hasArrows && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                disabled={!canScrollLeft}
                aria-label="Предыдущие товары"
                className="btn-press w-11 h-11 rounded-full bg-white border border-line flex items-center justify-center text-navy-700 hover:border-primary-soft disabled:opacity-40 disabled:pointer-events-none"
              >
                <ArrowLeftIcon />
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                disabled={!canScrollRight}
                aria-label="Следующие товары"
                className="btn-press w-11 h-11 rounded-full bg-white border border-line flex items-center justify-center text-navy-700 hover:border-primary-soft disabled:opacity-40 disabled:pointer-events-none"
              >
                <ArrowRightIcon />
              </button>
            </div>
          )}
        </div>

        {/* Одна лента для всех экранов: лишние карточки спрятаны за краем и
            листаются стрелкой на десктопе, пальцем — на телефоне.
            scroll-snap ставит карточку к левому краю, чтобы после листания
            не оставалось «половинки» товара. */}
        <div
          ref={trackRef}
          className="flex gap-4 md:gap-6 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        >
          {products.map((product) => (
            <div key={product.id} className={`flex-shrink-0 snap-start ${CARD_WIDTH}`}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-8">
          <Link to="/catalog" className="btn-primary px-8 py-3">
            Весь каталог
          </Link>
        </div>
      </div>
    </section>
  )
}
