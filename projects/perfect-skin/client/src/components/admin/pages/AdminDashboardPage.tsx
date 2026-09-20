import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminDashboard, type AdminDashboardData } from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const result = await adminDashboard()
        setData(result)
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message || 'Ошибка при загрузке данных')
        } else {
          setError('Нет соединения с сервером')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="container-app py-12">
        <div className="text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container-app py-12">
        <div className="bg-destructive/10 text-destructive p-4 rounded-block">
          {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container-app py-12">
        <div className="text-muted-foreground">Данные не загружены</div>
      </div>
    )
  }

  // Find max revenue for chart scaling
  const maxRevenue = Math.max(...data.salesByDay.map((d) => d.revenue || 0), 1)

  return (
    <div className="container-app py-12 md:py-16">
      <h1 className="text-h2 font-heading font-bold text-foreground mb-8 uppercase">
        Дашборд
      </h1>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-card p-6 rounded-block border border-border">
          <div className="text-muted-foreground text-sm font-sans mb-2">
            Новые заказы
          </div>
          <div className="text-3xl font-heading font-bold text-primary">
            {data.ordersByStatus.new}
          </div>
        </div>

        <div className="bg-card p-6 rounded-block border border-border">
          <div className="text-muted-foreground text-sm font-sans mb-2">
            Выручка сегодня
          </div>
          <div className="text-2xl font-heading font-bold text-success tabular-nums">
            {formatPrice(data.revenue.today)}
          </div>
        </div>

        <div className="bg-card p-6 rounded-block border border-border">
          <div className="text-muted-foreground text-sm font-sans mb-2">
            Выручка за неделю
          </div>
          <div className="text-2xl font-heading font-bold text-success tabular-nums">
            {formatPrice(data.revenue.week)}
          </div>
        </div>

        <div className="bg-card p-6 rounded-block border border-border">
          <div className="text-muted-foreground text-sm font-sans mb-2">
            Выручка за месяц
          </div>
          <div className="text-2xl font-heading font-bold text-success tabular-nums">
            {formatPrice(data.revenue.month)}
          </div>
        </div>
      </div>

      {/* Status strip */}
      <div className="bg-card p-6 rounded-block border border-border mb-12">
        <h2 className="text-h4 font-heading font-bold text-foreground mb-4">
          Статусы заказов
        </h2>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-badge text-sm font-sans">
            <span className="text-muted-foreground">Новые:</span>
            <span className="font-semibold text-primary">{data.ordersByStatus.new}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-badge text-sm font-sans">
            <span className="text-muted-foreground">Подтверждены:</span>
            <span className="font-semibold text-foreground">{data.ordersByStatus.confirmed}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-badge text-sm font-sans">
            <span className="text-muted-foreground">Упакованы:</span>
            <span className="font-semibold text-foreground">{data.ordersByStatus.packed}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-badge text-sm font-sans">
            <span className="text-muted-foreground">В пути:</span>
            <span className="font-semibold text-foreground">{data.ordersByStatus.in_transit}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-badge text-sm font-sans">
            <span className="text-muted-foreground">Доставлены:</span>
            <span className="font-semibold text-success">{data.ordersByStatus.delivered}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-badge text-sm font-sans">
            <span className="text-muted-foreground">Отменены:</span>
            <span className="font-semibold text-destructive">{data.ordersByStatus.cancelled}</span>
          </div>
        </div>
      </div>

      {/* Sales chart */}
      <div className="bg-card p-6 rounded-block border border-border mb-12">
        <h2 className="text-h4 font-heading font-bold text-foreground mb-6">
          Продажи за 30 дней
        </h2>
        <div className="flex items-end justify-between gap-1 h-32 mb-4">
          {data.salesByDay.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary rounded-sm transition-colors hover:bg-primary/80"
                style={{
                  height: `${(day.revenue / maxRevenue) * 128}px`,
                  minHeight: day.revenue > 0 ? '4px' : '0px',
                }}
                title={`${day.date}: ${day.ordersCount} заказов, ${formatPrice(day.revenue)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground font-sans">
          {data.salesByDay.length > 0 && (
            <>
              <span>{data.salesByDay[0].date}</span>
              <span>{data.salesByDay[data.salesByDay.length - 1].date}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Recent orders */}
        <div className="lg:col-span-2">
          <h2 className="text-h4 font-heading font-bold text-foreground mb-4">
            Последние заказы
          </h2>
          <div className="bg-card rounded-block border border-border overflow-hidden">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-muted-foreground font-semibold">
                    Номер
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-semibold">
                    Дата
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-semibold">
                    Получатель
                  </th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-semibold">
                    Сумма
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-semibold">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Нет заказов
                    </td>
                  </tr>
                ) : (
                  data.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to={`/admin/orders/${order.id}`} className="text-primary hover:underline font-semibold">
                          {order.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {order.recipientName}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground font-semibold tabular-nums">
                        {formatPrice(order.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-badge text-xs font-semibold ${
                          order.status === 'new' ? 'bg-primary/10 text-primary' :
                          order.status === 'delivered' ? 'bg-success/10 text-success' :
                          order.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {order.status === 'new' && 'Новый'}
                          {order.status === 'confirmed' && 'Подтвержден'}
                          {order.status === 'packed' && 'Упакован'}
                          {order.status === 'in_transit' && 'В пути'}
                          {order.status === 'delivered' && 'Доставлен'}
                          {order.status === 'cancelled' && 'Отменен'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low stock */}
        <div>
          <h2 className="text-h4 font-heading font-bold text-foreground mb-4">
            Заканчиваются запасы
          </h2>
          <div className="bg-card rounded-block border border-border overflow-hidden">
            {data.lowStock.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Нет товаров с низким запасом
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.lowStock.map((item) => (
                  <div key={item.variantId} className="p-4 hover:bg-muted/30">
                    <div className="text-sm font-semibold text-foreground mb-1">
                      {item.productName}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {item.volumeLabel}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Остаток:</span>
                      <span className="text-sm font-semibold text-destructive">
                        {item.stock} шт
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
