import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPublicPostBySlug } from '@/lib/admin-api'
import { renderMarkdown } from '@/lib/markdown'

interface ProductCard {
  id: string
  slug: string
  name: string
  image: string | null
  minPrice: number
  brand: { id: string; name: string; slug: string } | null
}

interface Post {
  id: string
  slug: string
  title: string
  body: string
  excerpt: string | null
  publishedAt: string | null
  createdAt: string
  products: ProductCard[]
}

export function BlogPostPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState<Post | null>(null)
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
            <button
              onClick={() => navigate('/blog')}
              className="text-primary hover:underline mb-8"
            >
              ← Вернуться к статьям
            </button>
            <div className="bg-card border border-border rounded-block p-12 text-center">
              <p className="text-destructive">
                {error || 'Статья не найдена'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const publishDate = new Date(post.publishedAt || post.createdAt)
  const dateStr = publishDate.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="bg-background">
      <div className="container-app py-12 md:py-16">
        {/* Navigation */}
        <button
          onClick={() => navigate('/blog')}
          className="text-primary hover:underline mb-8 font-sans text-body-sm"
        >
          ← Все статьи
        </button>

        {/* Header */}
        <div className="max-w-prose mb-12">
          <p className="text-label text-muted-foreground uppercase mb-4">
            {dateStr}
          </p>

          <h1 className="text-h2 font-heading font-bold text-foreground mb-6">
            {post.title}
          </h1>

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
          <button
            onClick={() => navigate('/blog')}
            className="text-primary hover:underline font-sans text-body-sm"
          >
            ← Все статьи
          </button>
        </div>
      </div>
    </div>
  )
}
