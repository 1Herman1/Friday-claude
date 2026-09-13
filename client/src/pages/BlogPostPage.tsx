import { useParams, Link } from 'react-router-dom'
import { useMetaTags } from '../hooks/useMetaTags'
import { useBlogPosts, useBlogPost } from '../hooks/useBlog'
import { renderMarkdown } from '../lib/markdown'
import { ArrowLeftIcon, ImagePlaceholderIcon } from '../components/icons'
import NotFoundPage from './NotFoundPage'

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const { post, loading } = useBlogPost(slug)
  const { posts: publishedPosts } = useBlogPosts()

  // Хуки — до любых ранних return, иначе React ругается на их порядок.
  useMetaTags({
    title: post?.metaTitle ?? 'Блог — Симба',
    description: post?.metaDescription ?? '',
  })

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-navy-500">Загружаем статью…</div>
  }

  // Черновик по прямой ссылке открываться не должен: у него нет тела, и это
  // была бы пустая страница, которую поисковик засчитает как «тонкую».
  if (!slug || !post || post.status !== 'published' || (!post.body && !post.markdown)) {
    return <NotFoundPage />
  }

  const allPosts = publishedPosts.filter((p) => p.slug !== slug)

  // Получаем посты из той же категории
  const sameCategoryPosts = allPosts.filter((p) =>
    p.categories.some((cat) => post.categories.includes(cat))
  )

  // Если меньше 3 - добавляем свежие посты
  let relatedPosts = sameCategoryPosts.slice(0, 3)
  if (relatedPosts.length < 3) {
    const freshPosts = allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    relatedPosts = [...relatedPosts, ...freshPosts.filter((p) => !relatedPosts.includes(p))].slice(0, 3)
  }

  return (
    <div className="py-10 md:py-14">
      {/* Текст статьи держит читаемую ширину; «Читайте также» и CTA ниже
          выходят на общую ширину сетки, как «Рекомендуем» в каталоге. */}
      <div className="max-w-3xl mx-auto px-4">
      {/* Разметка для поисковика: без картинки и автора-человека — их у нас нет,
          а выдумывать поля в разметке хуже, чем их не иметь. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.metaDescription,
            datePublished: post.date,
            dateModified: post.date,
            author: { '@type': 'Organization', name: 'Симба' },
            publisher: { '@type': 'Organization', name: 'Симба' },
            mainEntityOfPage: `${window.location.origin}/blog/${post.slug}`,
          }).replace(/</g, '\\u003c'),
        }}
      />

      {/* Хлебная крошка */}
      <Link to="/blog" className="inline-flex items-center gap-2 text-navy-700 hover:text-primary-hover transition-colors duration-100 ease mb-6 text-sm">
        <ArrowLeftIcon className="ico-nudge ico-nudge--back w-4 h-4" />
        Блог
      </Link>

      {/* Категории */}
      <p className="text-xs uppercase tracking-wide text-primary-hover font-semibold mb-3">{post.categories.join(' · ')}</p>

      {/* Заголовок */}
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-4">{post.title}</h1>

      {/* Дата */}
      <p className="text-navy-500 tabular-nums mb-8">
        {new Date(post.date + 'T00:00:00Z').toLocaleDateString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })}
      </p>

      {/* Обложка */}
      {post.cover ? (
        <img src={post.cover} alt={post.title} className="w-full aspect-[16/9] object-cover rounded-card mb-10" />
      ) : (
        <div className="w-full aspect-[16/9] bg-primary-tint flex items-center justify-center text-primary-soft rounded-card mb-10">
          <ImagePlaceholderIcon className="w-12 h-12" />
        </div>
      )}

      {/* Тело статьи */}
      <article
        className="text-navy-500 leading-relaxed mb-12
          [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-navy-900 [&>h2]:mt-10 [&>h2]:mb-3
          [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-navy-900 [&>h3]:mt-6 [&>h3]:mb-2
          [&>p]:mb-4
          [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4
          [&>li]:mb-1
          [&_a]:text-primary-hover [&_a]:underline"
      >
        {post.markdown ? renderMarkdown(post.markdown) : post.body && post.body()}
      </article>
      </div>

      <div className="max-w-7xl mx-auto px-4">
      {/* Читайте также */}
      {relatedPosts.length > 0 && (
        <section className="mb-12 border-t border-line pt-10">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Читайте также</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.slug}
                to={`/blog/${relatedPost.slug}`}
                className="bg-white border border-line rounded-card overflow-hidden transition-[transform] duration-100 ease hover:border-primary-soft hover:shadow-card hover:-translate-y-0.5"
              >
                {/* Обложка */}
                {relatedPost.cover ? (
                  <img src={relatedPost.cover} alt={relatedPost.title} className="w-full aspect-[16/10] object-cover" />
                ) : (
                  <div className="w-full aspect-[21/9] bg-primary-tint flex items-center justify-center text-primary-soft">
                    <ImagePlaceholderIcon className="w-12 h-12" />
                  </div>
                )}

                {/* Контент */}
                <div className="p-5">
                  {/* Категории */}
                  <p className="text-xs uppercase tracking-wide text-primary-hover font-semibold mb-2">
                    {relatedPost.categories.join(' · ')}
                  </p>

                  {/* Заголовок */}
                  <h3 className="font-bold text-lg text-navy-900 mb-2 line-clamp-2">{relatedPost.title}</h3>

                  {/* Описание */}
                  <p className="text-sm text-navy-500 mb-4 line-clamp-2">{relatedPost.excerpt}</p>

                  {/* Дата */}
                  <p className="text-sm text-navy-500 tabular-nums">
                    {new Date(relatedPost.date + 'T00:00:00Z').toLocaleDateString('ru-RU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="max-w-3xl mx-auto mt-10 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4 gap-3">
        <p className="text-navy-500">Не знаете, какой корм подойдёт питомцу?</p>
        <Link
          to="/questionnaire"
          className="btn-primary px-6 w-full sm:w-auto whitespace-nowrap"
        >
          Подобрать за минуту
        </Link>
      </div>
      </div>
    </div>
  )
}
