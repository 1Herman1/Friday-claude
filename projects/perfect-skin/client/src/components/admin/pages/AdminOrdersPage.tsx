import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminListOrders, type AdminOrder } from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  packed: 'Собирается',
  in_transit: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}

const STATUS_CLASSES: Record<string, string> = {
  new: 'bg-accent text-foreground',
  confirmed: 'bg-accent text-foreground',
  packed: 'bg-primary/10 text-primary',
  in_transit: 'bg-primary/10 text-primary',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
}

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [skip, setSkip] = useState(0)
  const limit = 20

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await adminListOrders({
        status: status || undefined,
        search: search || undefined,
        skip,
        limit,
      })
      setOrders(result.items)
      setTotal(result.total)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при загрузке заказов')
      } else {
        setError('Нет соединения с сервером')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [status, skip])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSkip(0)
    load()
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value)
    setSkip(0)
  }

  const handleNext = () => {
    if (skip + limit < total) {
      setSkip(skip + limit)
    }
  }

  const handlePrev = () => {
    if (skip > 0) {
      setSkip(Math.max(0, skip - limit))
    }
  }

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}.${month}.${year}`
    } catch {
      return dateStr
    }
  }

  return (
    <div className="container-app py-12 md:py-16">
      <h1 className="text-h2 font-heading font-bold text-foreground mb-8 uppercase">
        Заказы
      </h1>

      {/* Filters */}
      <div className="bg-card border border-border rounded-block p-6 mb-8">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label
                htmlFor="status"
                className="block text-label font-sans text-muted-foreground mb-2"
              >
                Статус
              </label>
              <select
                id="status"
                value={status}
                onChange={handleStatusChange}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              >
                <option value="">Все статусы</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label
                htmlFor="search"
                className="block text-label font-sans text-muted-foreground mb-2"
              >
                Поиск
              </label>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Номер или имя…"
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground placeholder:text-muted-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Submit */}
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-6 py-2 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 transition-colors min-h-11"
              >
                Поиск
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-block mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-block overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Номер
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Дата
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Получатель
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Нет заказов
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.number} className="border-b border-border hover:bg-muted/30">
                    <td className="px-6 py-4 text-foreground font-semibold">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="text-primary hover:underline focus-visible:outline-ring"
                      >
                        {order.number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      <div>{order.user.name}</div>
                      <div className="text-xs text-muted-foreground">{order.user.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-foreground font-semibold tabular-nums">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-pill text-xs font-semibold ${
                          STATUS_CLASSES[order.status] || 'bg-muted text-foreground'
                        }`}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && orders.length > 0 && (
        <div className="flex items-center justify-between text-sm font-sans text-muted-foreground">
          <div>
            Показано {skip + 1}–{Math.min(skip + limit, total)} из {total}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrev}
              disabled={skip === 0}
              className="px-4 py-2 border border-border rounded-block text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-11"
            >
              Назад
            </button>
            <button
              onClick={handleNext}
              disabled={skip + limit >= total}
              className="px-4 py-2 border border-border rounded-block text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-11"
            >
              Дальше
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
