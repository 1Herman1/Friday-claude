import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchPublicPosts, type PostKind, type PublicPostListItem } from '@/lib/admin-api'
import { BTN_OUTLINE, LINK_MORE } from '@/components/about/classes'
import { PostCard } from '@/components/home/BlogSection'

const PAGE_SIZE = 12

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

interface Feed {
  kind: PostKind | null
  items: PublicPostListItem[]
  total: number
}

export function BlogPage() {
  const [searchParams] = useSearchParams()
  const kindParam = searchParams.get('kind')
  const kind: PostKind | null = kindParam === 'article' || kindParam === 'news' ? kindParam : null

  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const visible = feed?.kind === kind ? feed : null
  const posts = visible?.items ?? []
  const loading = visible === null && error === null

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setError(null)
      try {
        const result = await fetchPublicPosts({ kind: kind ?? undefined, limit: PAGE_SIZE, offset: 0 })
        if (!cancelled) setFeed({ kind, items: result.items, total: result.total })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [kind])

  const loadMore = async () => {
    if (!visible) return
    setLoadingMore(true)
    setError(null)
    try {
      const result = await fetchPublicPosts({ kind: kind ?? undefined, limit: PAGE_SIZE, offset: visible.items.length })
      setFeed((prev) =>
        prev && prev.kind === kind ? { ...prev, items: [...prev.items, ...result.items], total: result.total } : prev,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
    } finally {
      setLoadingMore(false)
    }
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
        <div className="container-app mb-8">
          <div role="alert" className="rounded-block bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        </div>
      )}

      <div className="container-app pb-12 md:pb-20">
        {loading ? (
          <div className="py-24 text-center text-muted-foreground">Загрузка…</div>
        ) : posts.length === 0 && !error ? (
          <div className="py-12">
            <div className="bg-card rounded-block p-12 text-center">
              <p className="text-muted-foreground">{EMPTY_TEXT[kind ?? 'all']}</p>
              <Link to="/catalog" className={`${LINK_MORE} mt-4`}>
                Перейти в каталог <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} headingLevel={2} showKind />
              ))}
            </div>
            {visible && posts.length < visible.total && (
              <div className="mt-8 flex justify-center">
                <button type="button" onClick={loadMore} disabled={loadingMore} className={BTN_OUTLINE}>
                  {loadingMore ? 'Загрузка…' : 'Показать ещё'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
