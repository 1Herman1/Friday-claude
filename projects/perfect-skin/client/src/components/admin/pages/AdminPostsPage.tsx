import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { fetchAdminPosts, type AdminPost, type PostKind } from '@/lib/admin-api'

export function AdminPostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [kindFilter, setKindFilter] = useState<PostKind | ''>('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchAdminPosts({ kind: kindFilter || undefined, limit: 50, offset: 0 })
        setPosts(result.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [kindFilter])

  if (loading) {
    return (
      <div className="container-app py-12">
        <div className="text-center text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  return (
    <div className="container-app py-12 md:py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-h2 font-heading font-bold text-foreground uppercase">
          Статьи
        </h1>
        <button
          onClick={() => navigate('/admin/posts/new')}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-block hover:bg-primary/90 transition-colors font-sans font-medium"
        >
          Новая статья
        </button>
      </div>

      <div className="mb-6">
        <label htmlFor="posts-kind" className="block text-label font-semibold mb-2 text-foreground">
          Тип
        </label>
        <select
          id="posts-kind"
          value={kindFilter}
          onChange={(e) => {
            const value = e.target.value
            setKindFilter(value === 'article' || value === 'news' ? value : '')
          }}
          className="px-4 py-2 border border-border rounded-block bg-card text-foreground min-h-11 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Все</option>
          <option value="article">Статьи</option>
          <option value="news">Новости</option>
        </select>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-block">
          {error}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="bg-card border border-border rounded-block p-12 text-center">
          <p className="text-muted-foreground">Статей нет</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-block overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-label font-semibold text-foreground uppercase">
                  Заголовок
                </th>
                <th className="px-6 py-4 text-left text-label font-semibold text-foreground uppercase">
                  Тип
                </th>
                <th className="px-6 py-4 text-left text-label font-semibold text-foreground uppercase">
                  Статус
                </th>
                <th className="px-6 py-4 text-left text-label font-semibold text-foreground uppercase">
                  Дата
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, idx) => (
                <tr
                  key={post.id}
                  className={`border-b border-border hover:bg-muted/30 transition-colors ${
                    idx % 2 === 1 ? 'bg-muted/10' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <Link to={`/admin/posts/${post.id}`} className="hover:text-primary transition-colors">
                      <div>
                        <p className="text-body font-medium text-foreground">{post.title}</p>
                        <p className="text-body-sm text-muted-foreground">{post.slug}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-body-sm text-foreground">
                    {post.kind === 'news' ? 'Новость' : 'Статья'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-label font-semibold ${
                      post.publishedAt
                        ? 'bg-success/20 text-success'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}>
                      {post.publishedAt ? 'Опубликовано' : 'Черновик'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-body-sm text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
