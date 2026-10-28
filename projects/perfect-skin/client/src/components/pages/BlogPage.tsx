import { useState, useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { fetchPublicPosts, type PostKind, type PublicPostListItem } from '@/lib/admin-api'
import { BTN_OUTLINE, LINK_MORE } from '@/components/about/classes'
import { PostCard } from '@/components/home/BlogSection'
import { usePageMeta } from '@/hooks/usePageMeta'
import { SECTION_PATH } from '@/lib/post-path'

const PAGE_SIZE = 12

const PAGE_TEXT: Record<PostKind, { title: string; sub: string; empty: string }> = {
  article: {
    title: 'Статьи об уходе',
    sub: 'Полезная информация о косметологии, уходе за кожей и новых товарах от ISSEIMI и GLACÉE Skincare.',
    empty: 'Статей пока нет',
  },
  news: {
    title: 'Новости',
    sub: 'Поступления, акции и изменения в работе магазина.',
    empty: 'Новостей пока нет',
  },
}

interface Feed {
  kind: PostKind
  items: PublicPostListItem[]
  total: number
}

export function BlogPage({ kind }: { kind: PostKind }) {
  const [searchParams] = useSearchParams()
  const legacyKind = searchParams.get('kind')
  const text = PAGE_TEXT[kind]

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
        const result = await fetchPublicPosts({ kind, limit: PAGE_SIZE, offset: 0 })
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

  usePageMeta({ title: `${text.title} — Perfect Skin`, description: text.sub, path: SECTION_PATH[kind] })

  const loadMore = async () => {
    if (!visible) return
    setLoadingMore(true)
    setError(null)
    try {
      const result = await fetchPublicPosts({ kind, limit: PAGE_SIZE, offset: visible.items.length })
      setFeed((prev) =>
        prev && prev.kind === kind ? { ...prev, items: [...prev.items, ...result.items], total: result.total } : prev,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
    } finally {
      setLoadingMore(false)
    }
  }

  // Старые ссылки вида /blog?kind=news ведут в новый раздел
  if (legacyKind !== null) {
    return <Navigate to={legacyKind === 'news' ? SECTION_PATH.news : SECTION_PATH.article} replace />
  }

  return (
    <div className="bg-background">
      <div className="container-app py-12 md:py-20">
        <h1 className="text-h3 md:text-h2 font-heading font-bold uppercase tracking-tight text-foreground mb-8">
          {text.title}
        </h1>
        <p className="text-base text-muted-foreground max-w-prose">{text.sub}</p>
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
              <p className="text-muted-foreground">{text.empty}</p>
              <Link to="/catalog" className={`${LINK_MORE} mt-4`}>
                Перейти в каталог <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} headingLevel={2} />
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
