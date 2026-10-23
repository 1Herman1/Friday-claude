import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchPublicPosts, type PostKind, type PublicPostListItem } from '@/lib/admin-api'
import { formatPostDate } from '@/lib/format'
import { LABEL } from '@/components/about/classes'
import { PostAdNote } from '@/components/blog/PostAdNote'

const TABS: { kind: PostKind | null; label: string }[] = [
  { kind: null, label: 'Все' },
  { kind: 'article', label: 'Статьи' },
  { kind: 'news', label: 'Новости' },
]

const EMPTY_TEXT: Record<'all' | PostKind, string> = {
  all: 'Статей и новостей пока нет',
  article: 'Статей пока нет',
  news: 'Новостей пока нет',
}

export function BlogPage() {
  const [searchParams] = useSearchParams()
  const kindParam = searchParams.get('kind')
  const kind: PostKind | null = kindParam === 'article' || kindParam === 'news' ? kindParam : null

  const [posts, setPosts] = useState<PublicPostListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchPublicPosts({ kind: kind ?? undefined, limit: 12, offset: 0 })
        setPosts(result.items)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [kind])

  if (loading) {
    return (
      <div className="container-app py-24">
        <div className="text-center text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="container-app py-12 md:py-20">
        <h1 className="text-h3 md:text-h2 font-heading font-bold uppercase tracking-tight text-foreground mb-8">
          Статьи и новости
        </h1>
        <p className="text-base text-muted-foreground max-w-prose mb-8">
          Полезная информация о косметологии, уходе за кожей и новых товарах от ISSEIMI и GLACÉE Skincare.
        </p>
        <nav aria-label="Тип материалов" className="flex gap-2 border-b border-border">
          {TABS.map((tab) => {
            const isActive = tab.kind === kind
            return (
              <Link
                key={tab.label}
                to={tab.kind ? `/blog?kind=${tab.kind}` : '/blog'}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center px-4 -mb-px border-b-2 font-heading font-semibold text-body-sm transition-colors ${
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {error && (
        <div className="container-app mb-8 p-4 bg-destructive/10 text-destructive rounded-block">
          {error}
        </div>
      )}

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="container-app py-12">
          <div className="bg-card border border-border rounded-block p-12 text-center">
            <p className="text-muted-foreground">{EMPTY_TEXT[kind ?? 'all']}</p>
          </div>
        </div>
      ) : (
        <div className="container-app pb-12 md:pb-20">
          <div className="space-y-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group bg-card border border-border rounded-block p-6 hover:border-primary transition-colors block"
              >
                <div className="space-y-4">
                  <h2 className="text-xl font-heading font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h2>

                  {post.excerpt && (
                    <p className="text-body text-muted-foreground line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}

                  <PostAdNote isAd={post.isAd} advertiser={post.advertiser} erid={post.erid} />

                  <div className="flex items-center justify-between pt-2">
                    <time dateTime={post.publishedAt} className={`${LABEL} text-muted-foreground`}>
                      {formatPostDate(post.publishedAt)}
                    </time>
                    <span className="text-primary font-semibold">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
