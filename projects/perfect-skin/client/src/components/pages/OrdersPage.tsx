import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { fetchApi } from '@/lib/api'
import { formatPrice, pluralize } from '@/lib/format'
import { IconPackage } from '@/components/icons'

interface OrderPreview {
  number: string
  createdAt: string
  status: string
  total: number
  itemsCount: number
  previewImages: string[]
}

export function OrdersPage() {
  const navigate = useNavigate()
  const { isAuthed, isLoading: authLoading } = useAuth()
  const [orders, setOrders] = useState<OrderPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthed) {
      navigate('/auth?next=/orders')
      return
    }

    const loadOrders = async () => {
      try {
        const result = await fetchApi<{ items: OrderPreview[]; total: number }>('/api/v1/orders')
        setOrders(result.items)
      } catch (err) {
        // Игнорируем ошибки загрузки
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [isAuthed, authLoading, navigate])

  if (loading) {
    return (
      <div className="container-app py-12 text-center text-muted-foreground">
        Загрузка…
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-sm mx-auto text-center">
          <IconPackage className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
            Заказов пока нет
          </h1>
          <p className="text-body text-muted-foreground mb-8">
            Начните с просмотра нашего каталога
          </p>
          <a
            href="/catalog"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
          >
            В каталог
          </a>
        </div>
      </div>
    )
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

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      new: 'Новый',
      confirmed: 'Подтверждён',
      packed: 'Собирается',
      in_transit: 'Отправлен',
      delivered: 'Доставлен',
      cancelled: 'Отменён',
    }
    return labels[status] || status
  }

  const getStatusClasses = (status: string): string => {
    switch (status) {
      case 'new':
      case 'confirmed':
        return 'bg-accent text-foreground'
      case 'packed':
      case 'in_transit':
        return 'bg-primary/10 text-primary'
      case 'delivered':
        return 'bg-success/10 text-success'
      case 'cancelled':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-primary/10 text-primary'
    }
  }

  return (
    <div className="container-app py-12 md:py-16">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-8 uppercase tracking-tight">
        Мои заказы
      </h1>

      <div className="grid gap-4">
        {orders.map((order) => (
          <a
            key={order.number}
            href={`/orders/${order.number}`}
            className="block bg-card border border-border rounded-block p-6 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Информация */}
              <div className="md:col-span-2">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-heading font-semibold text-foreground">
                      {order.number}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span className={`inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-pill ${getStatusClasses(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                <p className="text-body-sm text-muted-foreground">
                  {order.itemsCount} {pluralize(order.itemsCount, ['товар', 'товара', 'товаров'])}
                </p>
              </div>

              {/* Сумма */}
              <div className="md:text-right md:flex md:flex-col md:justify-center">
                <p className="text-lg font-heading font-bold text-primary tabular-nums">
                  {formatPrice(order.total)}
                </p>
              </div>
            </div>

            {/* Превью изображений */}
            {order.previewImages && order.previewImages.length > 0 && (
              <div className="mt-4 flex gap-2">
                {order.previewImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Товар ${idx + 1}`}
                    className="w-12 h-12 rounded-media object-contain bg-card"
                  />
                ))}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}
