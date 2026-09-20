import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMetaTags } from '../hooks/useMetaTags'
import { useSiteText } from '../context/SiteTextsContext'
import { type BlogCategory } from '../content/blog'
import { useBlogPosts } from '../hooks/useBlog'
import { ArrowLeftIcon, ArrowRightIcon } from '../components/icons'
import BlogCoverFallback from '../components/BlogCoverFallback'

const CATEGORIES: BlogCategory[] = ['Сравнения кормов', 'Питание', 'Здоровье', 'Кошки', 'Собаки', 'Ветдиеты']

const POSTS_PER_PAGE = 6

export default function BlogPage() {
  useMetaTags({
    title: 'Блог о питании кошек и собак — Симба',
    description: 'Статьи о кормах, питании, здоровье кошек и собак. Сравнения кормов, советы ветеринара, ветдиеты.',
  })

  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const { posts: publishedPosts } = useBlogPosts()

  const filteredPosts = selectedCategory
    ? publishedPosts.filter((post) => post.categories.includes(selectedCategory))
    : publishedPosts

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)

  const startIdx = (currentPage - 1) * POSTS_PER_PAGE
  const endIdx = startIdx + POSTS_PER_PAGE
  const displayedPosts = filteredPosts.slice(startIdx, endIdx)

  const handleCategoryClick = (category: BlogCategory | null) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pageBlogTitle = useSiteText('page.blog.title', 'Блог')

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      {/* Заголовок */}
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-6">{pageBlogTitle}</h1>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 mb-10">
        <button
          onClick={() => handleCategoryClick(null)}
          className={`px-4 min-h-11 rounded-full font-semibold text-sm transition-colors duration-100 ease ${
            selectedCategory === null
              ? 'bg-ink border border-ink text-white'
              : 'bg-white border border-line text-navy-700 [@media(hover:hover)]:hover:bg-ink [@media(hover:hover)]:hover:border-ink [@media(hover:hover)]:hover:text-white'
          }`}
        >
          Все
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            className={`px-4 min-h-11 rounded-full font-semibold text-sm transition-colors duration-100 ease ${
              selectedCategory === category
                ? 'bg-ink border border-ink text-white'
                : 'bg-white border border-line text-navy-700 [@media(hover:hover)]:hover:bg-ink [@media(hover:hover)]:hover:border-ink [@media(hover:hover)]:hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Сетка карточек */}
      {displayedPosts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {displayedPosts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="bg-white border border-line rounded-card overflow-hidden transition-[transform,box-shadow,border-color] duration-100 ease hover:border-navy-300 hover:shadow-card hover:-translate-y-0.5"
              >
                {/* Обложка */}
                {post.cover ? (
                  <img src={post.cover} alt={post.title} className="w-full aspect-[16/10] object-cover" />
                ) : (
                  <BlogCoverFallback />
                )}

                {/* Контент */}
                <div className="p-5">
                  {/* Категории */}
                  <p className="text-xs uppercase tracking-wide text-navy-500 font-semibold mb-2">
                    {post.categories.join(' · ')}
                  </p>

                  {/* Заголовок */}
                  <h3 className="font-bold text-lg text-navy-900 mb-2 line-clamp-2">{post.title}</h3>

                  {/* Описание */}
                  <p className="text-sm text-navy-500 mb-4 line-clamp-2">{post.excerpt}</p>

                  {/* Дата */}
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

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {currentPage > 1 && (
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="w-11 h-11 rounded-xl border border-line text-navy-900 hover:bg-blue-50 transition-colors duration-100 ease flex items-center justify-center"
                  aria-label="Предыдущая страница"
                >
                  <ArrowLeftIcon className="ico-nudge ico-nudge--back w-5 h-5" />
                </button>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`min-w-11 min-h-11 rounded-xl font-semibold transition-colors duration-100 ease ${
                    currentPage === page
                      ? 'bg-ink text-white'
                      : 'bg-white border border-line text-navy-900 hover:bg-blue-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              {currentPage < totalPages && (
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="w-11 h-11 rounded-xl border border-line text-navy-900 hover:bg-blue-50 transition-colors duration-100 ease flex items-center justify-center"
                  aria-label="Следующая страница"
                >
                  <ArrowRightIcon className="ico-nudge w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        /* Пустое состояние */
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-navy-900 mb-2">Нет статей в этой категории</h2>
          <p className="text-navy-500 mb-6">Мы продолжаем писать новые материалы. Попробуйте выбрать другую категорию.</p>
          <button
            onClick={() => handleCategoryClick(null)}
            className="btn-primary px-6"
          >
            Показать все статьи
          </button>
        </div>
      )}
    </div>
  )
}
