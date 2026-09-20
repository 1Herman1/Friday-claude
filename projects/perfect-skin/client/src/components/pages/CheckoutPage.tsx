import { useState, useEffect } from 'react'
import { formatPrice } from '@/lib/format'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { fetchApi, ApiError } from '@/lib/api'
import { cartApi } from '@/lib/cart-api'
import type { DeliveryMethod, DeliveryQuote } from '@/lib/cart-api'
import { IconTruck, IconStore, IconPackage, IconCheck, IconClose } from '@/components/icons'

interface DeliveryMethodResponse extends DeliveryMethod {
  code: string
}

interface Order {
  number: string
  createdAt: string
}

export function CheckoutPage() {
  const { user, isAuthed } = useAuth()
  const { cart, isLoading: cartLoading, refresh: refreshCart } = useCart()
  const api = cartApi()

  // Загрузка
  const [loading, setLoading] = useState(true)
  const [methods, setMethods] = useState<DeliveryMethodResponse[]>([])
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string
    discount: number
    percent: number
  } | null>(null)
  const [validatingPromo, setValidatingPromo] = useState(false)
  const [promoError, setPromoError] = useState('')

  // Получатель
  const [recipient, setRecipient] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  })

  // Адрес
  const [pvzCode, setPvzCode] = useState('')
  const [address, setAddress] = useState({
    city: '',
    street: '',
    house: '',
    apartment: '',
    index: '',
  })

  const [comment, setComment] = useState('')
  const [quote, setQuote] = useState<DeliveryQuote | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [orderPlaced, setOrderPlaced] = useState<Order | null>(null)

  // Загружаем методы доставки
  useEffect(() => {
    let cancelled = false
    const loadMethods = async () => {
      try {
        const result = await api.getDeliveryMethods(appliedPromo?.code)
        if (cancelled) return
        setQuote(result)
        setMethods(result.methods as DeliveryMethodResponse[])
        if (result.methods.length > 0) {
          setSelectedMethod((prev) => prev || result.methods[0].code)
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === 'CART_EMPTY') {
          // Корзина пуста — показать экран пустой корзины
          return
        }
      } finally {
        setLoading(false)
      }
    }

    loadMethods()
    return () => {
      cancelled = true
    }
  }, [appliedPromo?.code])

  const currentMethod = methods.find((m) => m.code === selectedMethod)
  const isDemoMode = import.meta.env.VITE_API_MODE === 'snapshot'

  // Вычисляем суммы
  const subtotal = quote?.subtotal ?? cart?.subtotal ?? 0
  const discount = quote?.promo?.discount ?? appliedPromo?.discount ?? 0
  const goodsAfterDiscount = quote?.goodsAfterDiscount ?? subtotal - discount
  const deliveryCost = currentMethod?.isFree ? 0 : (currentMethod?.cost ?? 0)
  const total = goodsAfterDiscount + deliveryCost

  // Обработка промокода
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return

    setValidatingPromo(true)
    setPromoError('')

    try {
      const result = await api.validatePromo(promoCode)
      setAppliedPromo({
        code: result.code,
        discount: result.discount,
        percent: result.percent,
      })
      setPromoCode('')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'PROMO_NOT_FOUND') {
          setPromoError(err.message || 'Промокод не найден')
        } else if (err.code === 'PROMO_MIN_AMOUNT') {
          const minAmount = err.details?.minOrderAmount as number | undefined
          setPromoError(
            `Минимальная сумма заказа: ${minAmount ? formatPrice(minAmount) : '?'}`
          )
        } else {
          setPromoError(err.message || 'Ошибка при проверке промокода')
        }
      } else {
        setPromoError('Ошибка при проверке промокода')
      }
    } finally {
      setValidatingPromo(false)
    }
  }

  // Отправка заказа
  const handleSubmit = async () => {
    // Для гостя требуем email
    if (!isAuthed && !recipient.email.trim()) {
      setSubmitError('Укажите email для получения подтверждения')
      return
    }

    setSubmitting(true)
    setSubmitError('')

    try {
      const body: Record<string, unknown> = {
        deliveryMethod: selectedMethod,
        recipient: {
          name: recipient.name,
          phone: recipient.phone,
          ...(recipient.email && { email: recipient.email }),
        },
        expectedTotal: total,
      }

      // Добавляем адрес если требуется
      if (currentMethod?.requiresAddress) {
        body.address = {
          city: address.city,
          street: address.street,
          house: address.house,
          apartment: address.apartment || null,
          index: address.index,
        }
      }

      // Добавляем код ПВЗ если требуется
      if (currentMethod?.requiresPvzCode) {
        body.cdekPvzCode = pvzCode
      }

      if (appliedPromo) {
        body.promoCode = appliedPromo.code
      }

      if (comment) {
        body.comment = comment
      }

      const response = await fetchApi<Order>('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      setOrderPlaced(response)
      await refreshCart()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_REQUIRED') {
          setSubmitError('Укажите email для получения подтверждения')
        } else if (err.code === 'TOTAL_MISMATCH') {
          setSubmitError(
            'Суммы изменились. Пожалуйста, проверьте и попробуйте ещё раз'
          )
          // Перезагружаем методы доставки для актуальных цен
          const updated = await api.getDeliveryMethods(appliedPromo?.code)
          setQuote(updated)
          setMethods(updated.methods as DeliveryMethodResponse[])
        } else if (err.code === 'OUT_OF_STOCK' || err.code === 'ITEM_UNAVAILABLE') {
          setSubmitError('Один или несколько товаров закончились')
          await refreshCart()
        } else if (err.code === 'PVZ_CODE_REQUIRED') {
          setSubmitError('Укажите код ПВЗ')
        } else if (err.code === 'ADDRESS_REQUIRED') {
          setSubmitError('Укажите адрес доставки')
        } else if (err.code === 'RATE_LIMITED') {
          setSubmitError('Слишком много заказов. Попробуйте позже')
        } else {
          setSubmitError(err.message || 'Ошибка при оформлении заказа')
        }
      } else {
        setSubmitError('Ошибка при оформлении заказа')
      }
      setSubmitting(false)
    }
  }

  // Экран успеха
  if (orderPlaced) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-sm mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <IconCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
            Заказ принят
          </h1>
          <p className="text-body text-muted-foreground mb-1">
            Номер заказа: <span className="font-semibold">{orderPlaced.number}</span>
          </p>
          <p className="text-body-sm text-muted-foreground mb-8">
            Мы напишем вам на почту о статусе заказа
          </p>

          {!isAuthed && (
            <div className="bg-primary/5 border border-primary/20 rounded-block p-4 mb-8">
              <p className="text-sm text-foreground mb-3">
                Заказ привязан к <span className="font-semibold">{recipient.email}</span>. Войдите по этому адресу, чтобы отслеживать статус
              </p>
              <Link
                to={`/auth?next=/orders`}
                className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
              >
                Войти
              </Link>
              <p className="text-sm text-muted-foreground mt-4">
                Или проверяйте статус по номеру заказа и email — вход не обязателен со ссылкой{' '}
                <Link to={`/track?number=${orderPlaced.number}`} className="underline underline-offset-2">
                  Проверить статус без входа
                </Link>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <a
              href="/orders"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
            >
              Мои заказы
            </a>
            <a
              href="/catalog"
              className="inline-block px-6 py-3 border border-border text-foreground font-bold rounded-pill hover:bg-muted transition-colors min-h-11"
            >
              В каталог
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Корзина пуста (только когда корзина и методы уже загружены,
  // иначе на первом рендере мигает ложное «пусто»)
  if (!loading && !cartLoading && (!cart || cart.items.length === 0)) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-sm mx-auto text-center">
          <IconPackage className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
            Корзина пуста
          </h1>
          <p className="text-body text-muted-foreground mb-8">
            Добавьте товары перед оформлением заказа
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

  if (loading) {
    return (
      <div className="container-app py-12 text-center text-muted-foreground">
        Загрузка…
      </div>
    )
  }

  return (
    <div className="container-app py-12 md:py-16">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-8 uppercase tracking-tight">
        Оформление заказа
      </h1>

      {isDemoMode ? (
        <div className="max-w-md mx-auto">
          <div className="bg-accent border border-accent rounded-block p-6">
            <div className="flex items-start gap-4">
              <IconPackage className="w-6 h-6 text-foreground flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-heading font-semibold text-foreground mb-1">
                  Приём заказов ещё не открыт
                </h3>
                <p className="text-sm text-foreground">
                  Магазин откроется после запуска
                </p>
              </div>
            </div>
            <Link
              to="/catalog"
              className="inline-block mt-4 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
            >
              В каталог
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Основная форма */}
          <div className="lg:col-span-2 space-y-8">
            {/* Способ доставки */}
              <div className="bg-card border border-border rounded-block p-6">
                <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">
                  Способ доставки
                </h2>
                <div className="grid gap-3">
                  {methods.map((method) => (
                    <label
                      key={method.code}
                      className="flex items-start gap-3 p-4 border border-border rounded-block cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name="delivery"
                        value={method.code}
                        checked={selectedMethod === method.code}
                        onChange={(e) => setSelectedMethod(e.target.value)}
                        className="mt-1 w-5 h-5 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {method.code === 'pickup' && (
                            <IconStore className="w-5 h-5 text-primary" />
                          )}
                          {method.code === 'cdek_pvz' && (
                            <IconPackage className="w-5 h-5 text-primary" />
                          )}
                          {method.code === 'cdek_courier' && (
                            <IconTruck className="w-5 h-5 text-primary" />
                          )}
                          <span className="font-semibold text-foreground">
                            {method.title}
                          </span>
                        </div>
                        {method.hint && (
                          <p className="text-body-sm text-muted-foreground mb-2">
                            {method.hint}
                          </p>
                        )}
                        <div className="flex items-baseline gap-2">
                          {method.isFree ? (
                            <span className="text-sm font-semibold text-primary">
                              Бесплатно
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-foreground">
                              {formatPrice(method.cost)}
                            </span>
                          )}
                          {method.amountToFree != null && method.amountToFree > 0 && (
                            <span className="text-xs text-muted-foreground">
                              До бесплатной доставки ещё{' '}
                              {formatPrice(method.amountToFree)}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Поле для кода ПВЗ */}
                {currentMethod?.requiresPvzCode && (
                  <div className="mt-4">
                    <label
                      htmlFor="pvz-code"
                      className="block text-sm font-semibold text-foreground mb-2"
                    >
                      Код ПВЗ СДЭК
                    </label>
                    <input
                      id="pvz-code"
                      type="text"
                      value={pvzCode}
                      onChange={(e) => setPvzCode(e.target.value)}
                      placeholder="Например: 62901"
                      className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                    />
                  </div>
                )}

                {/* Адрес */}
                {currentMethod?.requiresAddress && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="city"
                          className="block text-sm font-semibold text-foreground mb-2"
                        >
                          Город
                        </label>
                        <input
                          id="city"
                          type="text"
                          value={address.city}
                          onChange={(e) =>
                            setAddress({ ...address, city: e.target.value })
                          }
                          placeholder="Москва"
                          className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="index"
                          className="block text-sm font-semibold text-foreground mb-2"
                        >
                          Индекс
                        </label>
                        <input
                          id="index"
                          type="text"
                          maxLength={6}
                          value={address.index}
                          onChange={(e) =>
                            setAddress({ ...address, index: e.target.value })
                          }
                          placeholder="123456"
                          className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="street"
                        className="block text-sm font-semibold text-foreground mb-2"
                      >
                        Улица
                      </label>
                      <input
                        id="street"
                        type="text"
                        value={address.street}
                        onChange={(e) =>
                          setAddress({ ...address, street: e.target.value })
                        }
                        placeholder="Тверская"
                        className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="house"
                          className="block text-sm font-semibold text-foreground mb-2"
                        >
                          Дом
                        </label>
                        <input
                          id="house"
                          type="text"
                          value={address.house}
                          onChange={(e) =>
                            setAddress({ ...address, house: e.target.value })
                          }
                          placeholder="1"
                          className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="apartment"
                          className="block text-sm font-semibold text-foreground mb-2"
                        >
                          Квартира (опц.)
                        </label>
                        <input
                          id="apartment"
                          type="text"
                          value={address.apartment}
                          onChange={(e) =>
                            setAddress({ ...address, apartment: e.target.value })
                          }
                          placeholder="101"
                          className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Получатель */}
              <div className="bg-card border border-border rounded-block p-6">
                <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">
                  Получатель
                </h2>
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-semibold text-foreground mb-2"
                    >
                      Имя
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={recipient.name}
                      onChange={(e) =>
                        setRecipient({ ...recipient, name: e.target.value })
                      }
                      placeholder="Иван Сидоров"
                      className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-semibold text-foreground mb-2"
                    >
                      Телефон
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={recipient.phone}
                      onChange={(e) =>
                        setRecipient({ ...recipient, phone: e.target.value })
                      }
                      placeholder="+7 (901) 123-45-67"
                      className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-semibold text-foreground mb-2"
                    >
                      Email{isAuthed ? ' (опц.)' : ''}
                    </label>
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      value={recipient.email}
                      onChange={(e) =>
                        setRecipient({ ...recipient, email: e.target.value })
                      }
                      placeholder="ivan@example.com"
                      className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                    />
                    {!isAuthed && (
                      <p className="text-xs text-muted-foreground mt-2">
                        На него придёт подтверждение и доступ к заказу
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Промокод */}
              <div className="bg-card border border-border rounded-block p-6">
                <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">
                  Промокод
                </h2>
                {appliedPromo ? (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-2 bg-primary/10 text-primary text-sm font-semibold rounded-pill">
                      {appliedPromo.code}
                    </span>
                    <button
                      onClick={() => setAppliedPromo(null)}
                      className="w-11 h-11 flex items-center justify-center text-foreground hover:bg-muted rounded-pill transition-colors duration-200 -mr-2"
                      aria-label="Убрать промокод"
                    >
                      <IconClose className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value)
                        setPromoError('')
                      }}
                      placeholder="Введите код"
                      className="flex-1 px-4 py-3 text-base rounded-pill border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11"
                    />
                    <button
                      onClick={handleApplyPromo}
                      disabled={!promoCode.trim() || validatingPromo}
                      className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors min-h-11"
                    >
                      Применить
                    </button>
                  </div>
                )}
                {promoError && (
                  <p className="text-sm text-destructive mt-2">{promoError}</p>
                )}
              </div>

              {/* Комментарий */}
              <div className="bg-card border border-border rounded-block p-6">
                <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">
                  Комментарий к заказу
                </h2>
                <textarea
                  value={comment}
                  onChange={(e) =>
                    setComment(e.target.value.slice(0, 500))
                  }
                  maxLength={500}
                  placeholder="Напишите пожелания к доставке…"
                  rows={3}
                  className="w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {comment.length}/500
                </p>
              </div>

            {submitError && (
            <div className="bg-destructive/10 border border-destructive rounded-block p-4">
              <p className="text-sm text-destructive font-semibold">
                {submitError}
              </p>
            </div>
          )}
          </div>

          {/* Боковая сводка */}
          <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-block p-6 sticky top-6">
            <h2 className="text-lg font-heading font-semibold text-foreground mb-4">
              Сумма заказа
            </h2>

            <div className="space-y-2 mb-4 pb-4 border-b border-border">
              <div className="flex justify-between text-body-sm">
                <span className="text-muted-foreground">Товары</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatPrice(subtotal)}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-body-sm">
                  <span className="text-muted-foreground">Скидка</span>
                  <span className="font-semibold text-primary tabular-nums">
                    −{formatPrice(discount)}
                  </span>
                </div>
              )}

              {currentMethod && deliveryCost > 0 && (
                <div className="flex justify-between text-body-sm">
                  <span className="text-muted-foreground">Доставка</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatPrice(deliveryCost)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-baseline mb-6">
              <span className="font-heading font-bold text-foreground">
                Итого
              </span>
              <span className="font-heading font-bold text-2xl text-primary tabular-nums">
                {formatPrice(total)}
              </span>
            </div>

            <div className="mb-4 text-xs text-muted-foreground space-y-2">
              <p>Оплата: СБП или карта. Косметика надлежащего качества возврату не подлежит (ПП РФ №55).</p>
              <p>Нажимая кнопку, вы соглашаетесь с <a href="/offer" target="_blank" rel="noopener" className="underline underline-offset-2">условиями оферты</a></p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !recipient.name ||
                !recipient.phone ||
                (!isAuthed && !recipient.email.trim())
              }
              className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors min-h-11 mb-4"
            >
              {submitting ? 'Оформляем заказ…' : 'Оформить заказ'}
            </button>

            {!recipient.name || !recipient.phone || (!isAuthed && !recipient.email.trim()) ? (
              <p aria-live="polite" className="text-xs text-muted-foreground text-center">
                {!isAuthed
                  ? 'Заполните имя, телефон и email'
                  : 'Заполните имя и телефон'}
              </p>
            ) : null}

            <div className="border-t border-border pt-4 mt-4">
              <h3 className="font-heading font-semibold text-foreground text-sm mb-3">
                Товары в заказе
              </h3>
              <div className="divide-y divide-border">
                {cart?.items.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-xs leading-snug font-semibold text-foreground line-clamp-2">
                      {item.product.name}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground mt-1">
                      {item.variant.volumeLabel} × {item.quantity} шт.
                    </p>
                    <p className="text-xs leading-snug font-semibold text-foreground mt-1">
                      {formatPrice(item.lineTotal)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
