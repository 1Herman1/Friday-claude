import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { blogApi, type BlogPostRow, type BlogStatus } from '../../lib/api'

const STATUS_LABEL: Record<BlogStatus, string> = { draft: 'Черновик', published: 'Опубликована' }

export default function BlogListPage() {
  const [items, setItems] = useState<BlogPostRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState<BlogStatus | ''>('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    blogApi.list({ status: status || undefined, search: query || undefined, page, limit: 30 })
      .then(r => { setItems(r.data.items); setTotal(r.data.total); setTotalPages(r.data.totalPages) })
      .catch(() => setError('Не удалось загрузить статьи'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status, query, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (p: BlogPostRow) => {
    if (!confirm(`Удалить статью «${p.title}»? Отменить нельзя.`)) return
    try {
      await blogApi.delete(p.id)
      load()
    } catch {
      setError('Не удалось удалить')
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Блог</h1>
          <p className="text-sm text-gray-600">Всего статей: {total}. Черновики на сайте не видны.</p>
        </div>
        <Link to="/blog/new" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          + Новая статья
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {([['', 'Все'], ['published', 'Опубликованные'], ['draft', 'Черновики']] as const).map(([v, l]) => (
          <button key={v} onClick={() => { setStatus(v); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${status === v ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {l}
          </button>
        ))}
        <form className="ml-auto flex gap-2" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1) }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по заголовку или слагу"
            className="w-64 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
          <button type="submit" className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Найти</button>
        </form>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">Статей нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Статья</th>
                  <th className="px-5 py-3 font-medium">Рубрики</th>
                  <th className="px-5 py-3 font-medium">Дата</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {p.cover
                          ? <img src={p.cover} alt="" className="w-14 h-10 rounded object-cover bg-gray-100 shrink-0" />
                          : <div className="w-14 h-10 rounded bg-gray-100 shrink-0" />}
                        <div className="min-w-0">
                          <Link to={`/blog/${p.id}`} className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1">{p.title}</Link>
                          <div className="text-xs text-gray-400 truncate">/blog/{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{p.categories.join(', ') || '—'}</td>
                    <td className="px-5 py-3 text-gray-600 tabular-nums">{new Date(p.date).toLocaleDateString('ru-RU')}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Link to={`/blog/${p.id}`} className="text-blue-600 hover:underline text-xs font-medium mr-3">Изменить</Link>
                      <button onClick={() => handleDelete(p)} className="text-red-500 hover:underline text-xs">Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40">←</button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  )
}
