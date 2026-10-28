import { useState, useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { fetchPublicPostBySlug, type PostKind, type PublicPost } from '@/lib/admin-api'
import { renderMarkdown } from '@/lib/markdown'
import { formatPostDate } from '@/lib/format'
import { PostAdNote } from '@/components/blog/PostAdNote'
import { usePageMeta } from '@/hooks/usePageMeta'
import { SECTION_PATH, postPath } from '@/lib/post-path'

const BACK_LABEL: Record<PostKind, string> = { article: '← Все статьи', news: '← Все новости' }
const BACK_CLASS = 'text-primary hover:underline font-sans text-body-sm'

export function BlogPostPage({ section }: { section: PostKind }) {
  const { slug } = useParams()
  const [post, setPost] = useState<PublicPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setError('Статья не найдена')
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        const data = await fetchPublicPostBySlug(slug)
        setPost(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  usePageMeta({
    title: post ? `${post.title} — Perfect Skin` : 'Perfect Skin',
    description: post?.excerpt ?? '',
    path: post ? postPath(post) : SECTION_PATH[section],
  })

  if (loading) {
    return (
      <div className="container-app py-24">
        <div className="text-center text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="bg-background">
        <div className="container-app py-12 md:py-24">
          <div className="max-w-prose">
            <Link to={SECTION_PATH[section]} className={`${BACK_CLASS} mb-8 inline-block`}>
              {BACK_LABEL[section]}
            </Link>
            <div className="bg-card border border-border rounded-block p-12 text-center">
              <p className="text-destructive">
                {error || (section === 'news' ? 'Новость не найдена' : 'Статья не найдена')}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Пост открыт не в своём разделе (/blog/<новость> или /news/<статья>) — единый адрес
  if (post.kind !== section) return <Navigate to={postPath(post)} replace />

  const dateStr = formatPostDate(post.publishedAt || post.createdAt)

  return (
    <div className="bg-background">
      <div className="container-app py-12 md:py-16">
        {/* Navigation */}
        <Link to={SECTION_PATH[post.kind]} className={`${BACK_CLASS} mb-8 inline-block`}>
          {BACK_LABEL[post.kind]}
        </Link>

        {/* Header */}
        <div className="max-w-prose mb-12">
          <p className="text-label text-muted-foreground uppercase mb-4">
            {dateStr}
          </p>

          <h1 className="text-h2 font-heading font-bold text-foreground mb-6">
            {post.title}
          </h1>

          <p className="text-body-sm text-muted-foreground mb-2">Редакция Perfect Skin</p>
          <PostAdNote isAd={post.isAd} advertiser={post.advertiser} erid={post.erid} className="mb-6" />

          {post.excerpt && (
            <p className="text-base text-muted-foreground leading-body mb-8">
              {post.excerpt}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="max-w-prose prose prose-sm prose-dark mb-16">
          <div className="text-body text-foreground space-y-4 leading-relaxed">
            {renderMarkdown(post.body, { products: post.products })}
          </div>
        </div>

        {/* Call-to-action: Browse catalog */}
        <div className="max-w-prose bg-card border border-border rounded-block p-6 mb-16">
          <p className="text-body text-foreground mb-4">
            Найти нужную косметику можно в каталоге.
          </p>
          <a
            href="/catalog/all"
            className="inline-block px-6 py-3 border border-primary text-primary font-bold rounded-pill hover:bg-primary/5 transition-colors min-h-11"
          >
            Смотреть в каталоге
          </a>
        </div>

        {/* Footer divider */}
        <div className="border-t border-border pt-12 mt-16">
          <Link to={SECTION_PATH[post.kind]} className={BACK_CLASS}>
            {BACK_LABEL[post.kind]}
          </Link>
        </div>
      </div>
    </div>
  )
}
