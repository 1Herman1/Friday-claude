import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlaceholderIcon } from '../icons'
import { type BlogCategory } from '../../content/blog'
import { useBlogPosts } from '../../hooks/useBlog'
import { useReveal } from '../../hooks/useReveal'
import { useSiteText } from '../../context/SiteTextsContext'

const CATEGORIES: BlogCategory[] = ['Сравнения кормов', 'Питание', 'Здоровье', 'Кошки', 'Собаки', 'Ветдиеты']

const POSTS_ON_HOME = 6

/** Каскад при скролле: старт 120мс (после заголовка и чипов), шаг 60мс, кап 4 ступени. */
const revealDelay = (i: number) => `${120 + Math.min(i, 3) * 60}ms`
/** Каскад при смене фильтра: короче — действие повторяемое. Шаг 40мс, кап 4 ступени. */
const swapDelay = (i: number) => `${Math.min(i, 3) * 40}ms`

const CHIP_BASE =
  'px-4 min-h-11 rounded-full font-semibold text-sm transition-[background-color,border-color,color,transform] duration-100 ease active:scale-[0.97]'
const CHIP_ON = 'bg-ink text-white border border-ink'
const CHIP_OFF = 'bg-white border border-line text-navy-700 [@media(hover:hover)]:hover:bg-ink [@media(hover:hover)]:hover:border-ink [@media(hover:hover)]:hover:text-white'

export default function BlogSection() {
  /** Наблюдатель на самой группе: секция подключена без обёртки <Reveal>,
      поэтому класс is-visible ей должен ставить собственный хук. */
  const groupRef = useReveal<HTMLDivElement>()
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null)
  const blogTitle = useSiteText('home.blog.title', 'Блог')
  const blogSubtitle = useSiteText('home.blog.subtitle', 'Разбираем составы кормов и отвечаем на вопросы, которые чаще всего задают на консультациях.')
  /** Растёт с каждым переключением фильтра. 0 = первая отрисовка: там работает scroll-reveal, а не swap-анимация. */
  const [swapCount, setSwapCount] = useState(0)

  const { posts } = useBlogPosts()
  const filtered = selectedCategory
    ? posts.filter((post) => post.categories.includes(selectedCategory))
    : posts
  const visible = filtered.slice(0, POSTS_ON_HOME)

  const swapping = swapCount > 0
  const swapClass = swapping ? 'animate-card-in' : ''

  const handleCategoryClick = (category: BlogCategory | null) => {
    if (category === selectedCategory) return
    setSelectedCategory(category)
    setSwapCount((n) => n + 1)
  }

  const cardStyle = (i: number) =>
    ({ '--reveal-delay': revealDelay(i), animationDelay: swapDelay(i) }) as CSSProperties

  return (
    <section id="blog" aria-labelledby="blog-title" className="scroll-mt-24 py-12 md:py-16">
      <div ref={groupRef} className="reveal-group max-w-7xl mx-auto px-4">
        <div className="reveal-item">
          <h2 id="blog-title" className="text-3xl md:text-4xl font-bold text-navy-900">
            {blogTitle}
          </h2>
          <p className="mt-3 text-base md:text-lg text-navy-500 max-w-prose leading-relaxed">
            {blogSubtitle}
          </p>
        </div>

        <div
          role="group"
          aria-label="Фильтр статей по категориям"
          className="reveal-item mt-6 flex flex-wrap gap-2"
          style={{ '--reveal-delay': '60ms' } as CSSProperties}
        >
          <button
            type="button"
            aria-pressed={selectedCategory === null}
            onClick={() => handleCategoryClick(null)}
            className={`${CHIP_BASE} ${selectedCategory === null ? CHIP_ON : CHIP_OFF}`}
          >
            Все
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={selectedCategory === category}
              onClick={() => handleCategoryClick(category)}
              className={`${CHIP_BASE} ${selectedCategory === category ? CHIP_ON : CHIP_OFF}`}
            >
              {category}
            </button>
          ))}
        </div>

        {visible.length > 0 ? (
          <div
            key={selectedCategory ?? 'all'}
            className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {visible.map((post, i) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                style={cardStyle(i)}
                className={`reveal-item ${swapClass} bg-white border border-line rounded-card overflow-hidden transition-[transform,box-shadow,border-color] duration-100 ease hover:border-navy-300 hover:shadow-card hover:-translate-y-0.5`}
              >
                {post.cover ? (
                  <img src={post.cover} alt={post.title} loading="lazy" className="w-full aspect-[16/10] object-cover" />
                ) : (
                  <div className="w-full aspect-[16/10] bg-blue-50 flex items-center justify-center text-navy-300">
                    <ImagePlaceholderIcon className="w-12 h-12" />
                  </div>
                )}

                <div className="p-5">
                  <p className="text-xs uppercase tracking-wide text-navy-500 font-semibold mb-2">
                    {post.categories.join(' · ')}
                  </p>
                  <h3 className="font-bold text-lg text-navy-900 mb-2 line-clamp-2">{post.title}</h3>
                  <p className="text-sm text-navy-500 mb-4 line-clamp-2">{post.excerpt}</p>
                  <p className="text-sm text-navy-500 tabular-nums">
                    {new Date(post.date + 'T00:00:00Z').toLocaleDateString('ru-RU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            key={`empty-${selectedCategory ?? 'all'}`}
            className={`reveal-item ${swapClass} mt-8 bg-white border border-line rounded-card p-6`}
          >
            <h3 className="font-bold text-lg text-navy-900 mb-1">Пока нет статей в этой категории</h3>
            <p className="text-navy-500 leading-relaxed mb-4 max-w-prose">
              Материал в работе. Посмотрите остальные статьи — там есть разборы кормов и советы по питанию.
            </p>
            <button
              type="button"
              onClick={() => handleCategoryClick(null)}
              className="btn-primary px-6"
            >
              Показать все статьи
            </button>
          </div>
        )}

        <div className="reveal-item mt-8 flex justify-center" style={{ '--reveal-delay': '300ms' } as CSSProperties}>
          <Link to="/blog" className="btn-primary px-6">
            Все статьи
          </Link>
        </div>
      </div>
    </section>
  )
}
