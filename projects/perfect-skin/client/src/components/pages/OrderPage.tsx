import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { fetchApi, ApiError } from '@/lib/api'
import { IconSearch } from '@/components/icons'
import { OrderView, type OrderDetail } from '@/components/orders/OrderView'

export function OrderPage() {
  const { number } = useParams<{ number: string }>()
  const navigate = useNavigate()
  const { isAuthed, isLoading: authLoading } = useAuth()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthed) {
      navigate('/auth?next=/orders')
      return
    }

    const loadOrder = async () => {
      if (!number) return

      try {
        const result = await fetchApi<OrderDetail>(`/api/v1/orders/${number}`)
        setOrder(result)
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ORDER_NOT_FOUND') {
          setNotFound(true)
        }
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [number, isAuthed, authLoading, navigate])

  if (loading) {
    return (
      <div className="container-app py-12 text-center text-muted-foreground">
        Загрузка…
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-sm mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <IconSearch className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
            Заказ не найден
          </h1>
          <p className="text-body text-muted-foreground mb-8">
            Проверьте номер заказа
          </p>
          <a
            href="/orders"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
          >
            Мои заказы
          </a>
        </div>
      </div>
    )
  }

  if (!order) {
    return null
  }

  return (
    <div>
      <OrderView order={order} />
      <div className="container-app pb-12">
        <div className="flex justify-center">
          <a
            href="/orders"
            className="px-4 py-3 bg-muted text-foreground font-bold rounded-pill hover:bg-muted/80 transition-colors min-h-11"
          >
            Назад к заказам
          </a>
        </div>
      </div>
    </div>
  )
}
