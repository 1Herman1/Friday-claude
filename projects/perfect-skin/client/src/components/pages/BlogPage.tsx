import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchPublicPosts } from '@/lib/admin-api'

interface Post {
  id: string
  slug: string
  title: string
  excerpt: string | null
  publishedAt: string | null
  createdAt: string
}

export function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchPublicPosts({ limit: 12, offset: 0 })
        setPosts(result.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
        <p className="text-base text-muted-foreground max-w-prose mb-12">
          Полезная информация о косметологии, уходе за кожей и новых товарах от ISSEIMI и GLACÉE Skincare.
        </p>
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
            <p className="text-muted-foreground">Статей пока нет</p>
          </div>
        </div>
      ) : (
        <div className="container-app pb-12 md:pb-20">
          <div className="space-y-6">
            {posts.map((post) => {
              const publishDate = post.publishedAt
                ? new Date(post.publishedAt)
                : new Date(post.createdAt)
              const dateStr = publishDate.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })

              return (
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

                    <div className="flex items-center justify-between pt-2">
                      <p className="text-label text-muted-foreground uppercase">
                        {dateStr}
                      </p>
                      <span className="text-primary font-semibold">→</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
