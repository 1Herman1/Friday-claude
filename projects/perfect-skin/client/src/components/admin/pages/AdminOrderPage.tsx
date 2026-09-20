import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { adminGetOrder, adminUpdateOrder, type AdminOrderDetail } from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { OrderView, type OrderDetail } from '@/components/orders/OrderView'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новый' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'packed', label: 'Собирается' },
  { value: 'in_transit', label: 'Отправлен' },
  { value: 'delivered', label: 'Доставлен' },
  { value: 'cancelled', label: 'Отменён' },
]

const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Не оплачен' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'refunded', label: 'Возвращён' },
]

export function AdminOrderPage() {
  const { id: number } = useParams<{ id: string }>()
  const [adminOrder, setAdminOrder] = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    status: '',
    paymentStatus: '',
    deliveryTrackNumber: '',
    adminNote: '',
  })

  useEffect(() => {
    const load = async () => {
      if (!number) return
      try {
        const data = await adminGetOrder(number)
        setAdminOrder(data)
        setFormData({
          status: data.status || '',
          paymentStatus: data.paymentStatus || 'unpaid',
          deliveryTrackNumber: data.deliveryTrackNumber || '',
          adminNote: data.adminNote || '',
        })
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message || 'Ошибка при загрузке заказа')
        } else {
          setError('Нет соединения с сервером')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [number])

  const handleSave = async () => {
    if (!number) return
    if (!window.confirm('Вы уверены? Это обновит заказ в системе')) {
      return
    }

    setSaving(true)
    setError('')
    setSaveSuccess(false)

    try {
      const updated = await adminUpdateOrder(number, {
        status: formData.status,
        paymentStatus: formData.paymentStatus,
        deliveryTrackNumber: formData.deliveryTrackNumber,
        adminNote: formData.adminNote,
      })
      setAdminOrder(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при сохранении')
      } else {
        setError('Нет соединения с сервером')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAsPaid = async () => {
    if (!number) return
    if (!window.confirm('Отметить заказ как оплаченный?')) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const updated = await adminUpdateOrder(number, {
        paymentStatus: 'paid',
      })
      setAdminOrder(updated)
      setFormData((prev) => ({
        ...prev,
        paymentStatus: 'paid',
      }))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при сохранении')
      } else {
        setError('Нет соединения с сервером')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container-app py-12">
        <div className="text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  if (error && !adminOrder) {
    return (
      <div className="container-app py-12">
        <div className="max-w-2xl">
          <Link
            to="/admin/orders"
            className="inline-block mb-6 text-primary hover:underline"
          >
            ← Вернуться к заказам
          </Link>
          <div className="bg-destructive/10 text-destructive p-4 rounded-block">
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (!adminOrder) {
    return (
      <div className="container-app py-12">
        <div className="text-muted-foreground">Заказ не найден</div>
      </div>
    )
  }

  // Преобразуем AdminOrderDetail в OrderDetail для OrderView
  const orderForView: OrderDetail = {
    number: adminOrder.number,
    createdAt: adminOrder.createdAt,
    status: adminOrder.status,
    items: adminOrder.items,
    recipient: adminOrder.user,
    deliveryMethod: adminOrder.deliveryMethod,
    address: adminOrder.address,
    pvzCode: adminOrder.pvzCode,
    subtotal: adminOrder.subtotal,
    discount: adminOrder.discount,
    deliveryCost: adminOrder.deliveryCost,
    total: adminOrder.total,
    comment: adminOrder.comment,
  }

  return (
    <div className="container-app py-12 md:py-16">
      <Link
        to="/admin/orders"
        className="inline-block mb-8 text-primary hover:underline"
      >
        ← Вернуться к заказам
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Order View */}
        <div className="lg:col-span-2">
          <OrderView order={orderForView} />
        </div>

        {/* Admin Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-block p-6 sticky top-24">
            <h2 className="text-lg font-heading font-semibold text-foreground mb-6">
              Управление
            </h2>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-block mb-4">
                {error}
              </div>
            )}

            {saveSuccess && (
              <div className="bg-success/10 text-success text-sm p-3 rounded-block mb-4">
                Изменения сохранены
              </div>
            )}

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label
                  htmlFor="status"
                  className="block text-label font-sans text-muted-foreground mb-2"
                >
                  Статус заказа
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Status */}
              <div>
                <label
                  htmlFor="paymentStatus"
                  className="block text-label font-sans text-muted-foreground mb-2"
                >
                  Статус оплаты
                </label>
                <select
                  id="paymentStatus"
                  value={formData.paymentStatus}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, paymentStatus: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
                >
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Track Number */}
              <div>
                <label
                  htmlFor="trackNumber"
                  className="block text-label font-sans text-muted-foreground mb-2"
                >
                  Трек-номер доставки
                </label>
                <input
                  id="trackNumber"
                  type="text"
                  value={formData.deliveryTrackNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deliveryTrackNumber: e.target.value,
                    }))
                  }
                  placeholder="Номер отслеживания…"
                  className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground placeholder:text-muted-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Admin Note */}
              <div>
                <label
                  htmlFor="adminNote"
                  className="block text-label font-sans text-muted-foreground mb-2"
                >
                  Служебная заметка
                </label>
                <textarea
                  id="adminNote"
                  value={formData.adminNote}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, adminNote: e.target.value }))
                  }
                  placeholder="Внутренние заметки…"
                  rows={4}
                  className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground placeholder:text-muted-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-border">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full px-6 py-3 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-11"
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>

                <button
                  onClick={handleMarkAsPaid}
                  disabled={saving || formData.paymentStatus === 'paid'}
                  className="w-full px-6 py-3 bg-success text-success-foreground font-sans font-semibold rounded-block hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-11"
                >
                  Отметить оплаченным
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
