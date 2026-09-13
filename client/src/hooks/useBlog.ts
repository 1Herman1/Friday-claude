import { useEffect, useState } from 'react'
import { blogApi, type BlogPostDto } from '../lib/api'
import { BLOG_POSTS, type BlogPost } from '../content/blog'

/** Статьи блога с сервера (их редактирует владелец в админке). Если API недоступен —
    встроенные статьи, чтобы раздел не пустел. */
function fromDto(p: BlogPostDto): BlogPost {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.subtitle ?? '',
    categories: p.categories as BlogPost['categories'],
    date: p.date.slice(0, 10),
    readingMinutes: p.readingMinutes,
    status: p.status,
    cover: p.cover ?? undefined,
    metaTitle: p.metaTitle ?? p.title,
    metaDescription: p.metaDescription ?? p.subtitle ?? '',
    markdown: p.body,
  }
}

const staticPublished = () =>
  BLOG_POSTS.filter((p) => p.status === 'published').sort((a, b) => (a.date < b.date ? 1 : -1))

let listCache: BlogPost[] | null = null

export function useBlogPosts(): { posts: BlogPost[]; loading: boolean } {
  const [posts, setPosts] = useState<BlogPost[]>(listCache ?? [])
  const [loading, setLoading] = useState(listCache === null)
  useEffect(() => {
    if (listCache) return
    let alive = true
    blogApi.list({ limit: 50 })
      .then((r) => { listCache = r.data.items.map(fromDto) })
      .catch(() => { listCache = staticPublished() })
      .finally(() => { if (alive) { setPosts(listCache ?? []); setLoading(false) } })
    return () => { alive = false }
  }, [])
  return { posts, loading }
}

export function useBlogPost(slug: string | undefined): { post: BlogPost | null; loading: boolean } {
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!slug) { setLoading(false); return }
    let alive = true
    setLoading(true)
    blogApi.get(slug)
      .then((r) => { if (alive) setPost(fromDto(r.data)) })
      .catch((err) => {
        if (!alive) return
        // 404 — статьи нет; сетевая ошибка — пробуем встроенную.
        const status = (err as { response?: { status?: number } }).response?.status
        const fallback = status === 404 ? null : BLOG_POSTS.find((p) => p.slug === slug && p.status === 'published') ?? null
        setPost(fallback)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [slug])
  return { post, loading }
}
