import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchApi, ApiError } from '@/lib/api'
import { IconSearch, IconPackage } from '@/components/icons'
import { OrderView, type OrderDetail } from '@/components/orders/OrderView'

export function TrackOrderPage() {
  const [searchParams] = useSearchParams()
  const isDemoMode = import.meta.env.VITE_API_MODE === 'snapshot'

  const [number, setNumber] = useState(() => {
    const param = searchParams.get('number')
    return param ? param.toUpperCase() : ''
  })
  const [email, setEmail] = useState(() => searchParams.get('email') || '')
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Нормализация номера заказа
  const normalizeOrderNumber = (value: string): string => {
    const trimmed = value.trim().toUpperCase()
    // Если это только цифры, добавляем префикс PS-
    if (/^\d+$/.test(trimmed)) {
      return `PS-${trimmed}`
    }
    return trimmed
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeOrderNumber(e.target.value)
    setNumber(normalized)
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await fetchApi<OrderDetail>(
        `/api/v1/orders/track?number=${encodeURIComponent(number)}&email=${encodeURIComponent(email)}`
      )
      setOrder(result)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ORDER_NOT_FOUND') {
          setError('Заказ не найден. Проверьте номер и email')
        } else if (err.code === 'VALIDATION_ERROR') {
          setError('Проверьте формат номера (PS-000123) и email')
        } else if (err.code === 'RATE_LIMITED') {
          setError('Слишком много попыток — подождите немного')
        } else {
          setError(err.message || 'Ошибка при проверке заказа')
        }
      } else {
        setError('Нет соединения с сервером')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setNumber('')
    setEmail('')
    setOrder(null)
    setError('')
  }

  // Демо-режим
  if (isDemoMode) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-accent border border-accent rounded-block p-6">
            <div className="flex items-start gap-4">
              <IconPackage className="w-6 h-6 text-foreground flex-shrink-0 mt-1" />
              <div className="flex-1 text-left">
                <h3 className="font-heading font-semibold text-foreground mb-1">
                  Проверка заказа заработает после запуска магазина
                </h3>
                <p className="text-sm text-foreground">
                  Сейчас магазин в режиме демонстрации
                </p>
              </div>
            </div>
            <a
              href="/catalog"
              className="inline-block mt-4 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
            >
              В каталог
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Успех: показываем заказ
  if (order) {
    return (
      <div>
        <OrderView order={order} />
        <div className="container-app pb-12">
          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-muted text-foreground font-bold rounded-pill hover:bg-muted/80 transition-colors min-h-11"
            >
              Проверить другой заказ
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Форма
  return (
    <div className="container-app py-12 md:py-20">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2 uppercase tracking-tight">
            Проверка заказа
          </h1>
          <p className="text-body-sm text-muted-foreground">
            Введите номер заказа и email, указанный при оформлении — вход не нужен
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="order-number"
              className="block text-sm font-semibold text-foreground mb-2"
            >
              Номер заказа
            </label>
            <input
              id="order-number"
              type="text"
              value={number}
              onChange={handleNumberChange}
              placeholder="PS-000123"
              className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Допускается ввод без префикса PS-
            </p>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-foreground mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="your@email.com"
              className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
            />
          </div>

          {error && (
            <div
              className="bg-destructive/10 border border-destructive rounded-block p-4"
              role="alert"
            >
              <p className="text-sm text-destructive font-semibold">
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!number.trim() || !email.trim() || loading}
            className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors min-h-11"
          >
            {loading ? 'Проверяем…' : 'Проверить'}
          </button>
        </form>

        {!order && (
          <div className="mt-8 p-6 bg-card border border-border rounded-block text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <IconSearch className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Введите данные заказа, чтобы проверить статус доставки
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
