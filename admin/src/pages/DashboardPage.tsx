import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, syncApi, type DashboardStats, type SyncStatusResponse } from '../lib/api'
import { formatPrice } from '../lib/format'
import SyncStatusBadge from '../components/SyncStatusBadge'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:        { label: 'Новый',       color: 'bg-amber-100 text-amber-700' },
  confirmed:  { label: 'Подтверждён', color: 'bg-blue-100 text-blue-700' },
  in_transit: { label: 'Доставка',    color: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Доставлен',   color: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Отменён',     color: 'bg-red-100 text-red-600' },
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function SimpleBarChart({
  data,
  period,
}: {
  data: Array<{ date: string; orders: number; visits: number }>
  period: 'today' | 'week' | 'month' | 'year'
}) {
  if (!data || data.length === 0) return null

  const maxOrders = Math.max(...data.map(d => d.orders), 1)
  const maxVisits = Math.max(...data.map(d => d.visits), 1)
  const max = Math.max(maxOrders, maxVisits)

  const formatDate = (dateStr: string) => {
    if (period === 'year') {
      // YYYY-MM-01 → MM.YYYY
      return dateStr.slice(5, 7) + '.' + dateStr.slice(0, 4)
    }
    // YYYY-MM-DD → DD.MM
    return dateStr.slice(8, 10) + '.' + dateStr.slice(5, 7)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Заказы и посещения</h3>
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-min pb-4">
          {data.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <div className="flex items-end gap-1 h-40">
                <div
                  className="w-3 bg-blue-500 rounded-t"
                  style={{ height: `${(item.orders / max) * 100}%` }}
                  title={`Заказы: ${item.orders}`}
                />
                <div
                  className="w-3 bg-purple-500 rounded-t"
                  style={{ height: `${(item.visits / max) * 100}%` }}
                  title={`Посещения: ${item.visits}`}
                />
              </div>
              <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 justify-center mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-gray-600">Заказы</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded" />
          <span className="text-gray-600">Посещения</span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month')
  const [userType, setUserType] = useState<'all' | 'registered' | 'guest'>('all')

  const loadStats = (p?: 'today' | 'week' | 'month' | 'year', u?: 'all' | 'registered' | 'guest') => {
    const pVal = p ?? period
    const uVal = u ?? userType
    setLoading(true)
    Promise.all([
      dashboardApi.stats({ period: pVal, userType: uVal }).then(r => setStats(r.data)),
      syncApi.status().then(r => setSyncStatus(r.data)),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handlePeriodChange = (p: 'today' | 'week' | 'month' | 'year') => {
    setPeriod(p)
    loadStats(p, userType)
  }

  const handleUserTypeChange = (u: 'all' | 'registered' | 'guest') => {
    setUserType(u)
    loadStats(period, u)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    )
  }

  if (!stats) return <p className="text-gray-500">Не удалось загрузить статистику</p>

  const cardBreakdown = stats.ordersTodayBreakdown
    ? `Картой: ${stats.ordersTodayBreakdown.paidCard.count} · Наличными: ${stats.ordersTodayBreakdown.paidCash.count} · Не оплачено: ${stats.ordersTodayBreakdown.unpaid.count}`
    : undefined

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Дашборд</h1>

      {/* Sync status */}
      {syncStatus && (
        <div className="mb-6">
          <SyncStatusBadge lastSuccess={syncStatus.lastSuccess} lastFailed={syncStatus.last} compact />
        </div>
      )}

      {/* Period Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 mb-2">
          {(['today', 'week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p === 'today' ? 'Сегодня' : p === 'week' ? '7 дней' : p === 'month' ? '30 дней' : 'Год'}
            </button>
          ))}
        </div>

        {/* User Type Tabs */}
        <div className="flex gap-2 mb-2">
          {(['all', 'registered', 'guest'] as const).map(u => (
            <button
              key={u}
              onClick={() => handleUserTypeChange(u)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                userType === u
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {u === 'all' ? 'Все' : u === 'registered' ? 'Пользователи' : 'Гости'}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Фильтр влияет на заказы, выручку и новых пользователей; посещения и подборы считаются по всем
        </p>
      </div>

      {/* Today Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Заказы сегодня"
          value={String(stats.ordersToday)}
          sub={cardBreakdown}
        />
        <StatCard
          label="Выручка сегодня"
          value={formatPrice(stats.revenueToday)}
          sub={`оплаченные заказы · за 30 дней: ${formatPrice(stats.revenueMonth)}`}
        />
        <StatCard
          label="Пользователей"
          value={String(stats.totalUsers)}
          sub={`новых сегодня: ${stats.newUsersToday}`}
        />
        <StatCard
          label="Товаров в каталоге"
          value={String(stats.totalProducts)}
        />
      </div>

      {/* Period Stats */}
      {stats.period && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Заказы за период"
            value={String(stats.period.orders)}
          />
          <StatCard
            label="Выручка за период"
            value={formatPrice(stats.period.revenue)}
          />
          <StatCard
            label="Новые пользователи"
            value={String(stats.period.newUsers)}
          />
          <StatCard
            label="Посетители"
            value={String(stats.period.visits)}
          />
          <StatCard
            label="Подборы корма"
            value={String(stats.period.quizSessions)}
          />
        </div>
      )}

      {/* Chart */}
      {stats.series && stats.series.length > 0 && (
        <div className="mb-8">
          <SimpleBarChart data={stats.series} period={period} />
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Последние заказы</h2>
          <Link to="/orders" className="text-sm text-blue-600 hover:underline">Все заказы</Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Заказ</th>
                <th className="px-5 py-3 font-medium">Покупатель</th>
                <th className="px-5 py-3 font-medium">Сумма</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map(order => {
                const s = STATUS_LABEL[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link to={`/orders/${order.id}`} className="font-mono text-blue-600 hover:underline text-xs">
                        #{order.id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {order.user?.name || order.user?.email || order.user?.phone || '—'}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                )
              })}
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">Заказов пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
