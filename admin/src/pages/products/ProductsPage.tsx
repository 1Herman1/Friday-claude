import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { productsApi, type AdminProductRow } from '../../lib/api'
import { formatPrice } from '../../lib/format'

const STATUSES = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'hidden', label: 'Скрытые' },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<AdminProductRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = (p = page, s = search, st = status) => {
    setLoading(true)
    const params: Record<string, unknown> = { page: p, limit: 20, status: st }
    if (s) params.search = s
    productsApi.adminList(params)
      .then(r => { setProducts(r.data.items); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => load(page, search, status), 300)
    return () => clearTimeout(t)
  }, [page, search, status])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  const toggleActive = async (product: AdminProductRow) => {
    setTogglingId(product.id)
    setError('')
    try {
      await productsApi.setVisibility(product.id, !product.isActive)
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, isActive: !p.isActive, hiddenManually: p.isActive } : p
      ))
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Ошибка при изменении статуса')
    } finally { setTogglingId(null) }
  }

  const handleHide = async (id: string, name: string) => {
    if (!confirm(`Скрыть "${name}" с сайта? Синхронизация его не вернёт, показать можно кнопкой статуса.`)) return
    setTogglingId(id)
    setError('')
    try {
      await productsApi.delete(id)
      setProducts(prev => prev.filter(p => p.id !== id))
      setTotal(t => t - 1)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Ошибка при удалении товара')
    } finally { setTogglingId(null) }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">Товары <span className="text-gray-400 font-normal text-base">({total})</span></h1>
        <div className="flex gap-2">
          <Link to="/import" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Импорт CSV
          </Link>
          <Link to="/products/new" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            + Добавить товар
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => handleStatusChange(s.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              status === s.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Поиск по названию..."
          className="w-full max-w-sm px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Товар</th>
                  <th className="px-5 py-3 font-medium">Бренд</th>
                  <th className="px-5 py-3 font-medium">Вариантов</th>
                  <th className="px-5 py-3 font-medium">Цена от</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 line-clamp-1">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.slug}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.brand?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{p.variants.length}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {p.variants.length > 0
                        ? formatPrice(Math.min(...p.variants.map(v => v.price)))
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => toggleActive(p)}
                          disabled={togglingId === p.id}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer disabled:opacity-40 transition-colors ${
                            p.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {togglingId === p.id ? '...' : p.isActive ? 'Активен' : 'Скрыт'}
                        </button>
                        {p.hiddenManually && (
                          <p className="text-xs text-gray-400">скрыт вручную</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Link to={`/products/${p.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                          Редактировать
                        </Link>
                        <button
                          onClick={() => handleHide(p.id, p.name)}
                          disabled={togglingId === p.id}
                          className="text-red-500 hover:underline text-xs font-medium disabled:opacity-40"
                        >
                          {togglingId === p.id ? '...' : 'Скрыть'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      {search ? 'Ничего не найдено' : 'Товаров пока нет'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Показано {products.length} из {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40">←</button>
              <span className="px-3 py-1.5 text-sm text-gray-700">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
