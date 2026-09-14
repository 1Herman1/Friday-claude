import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { calcOrderTotals, type DeliveryKind, type DeliveryOptionKey, type PickupPoint, type AddressSuggestion, type PromoRule, deliveryKindOf } from '@simba/shared'
import { useCart } from '../context/CartContext'
import { cartApi, authApi, ordersApi, deliveryApi, type CartItem, type DeliveryQuote } from '../lib/api'
import { apiErrorMessage } from '../lib/api-error'
import { formatPrice, formatBonuses, formatDateTime } from '../lib/format'
import { normalizePhone, isValidPhoneRU, handlePhoneInput } from '../lib/phone'
import { CheckIcon, ArrowLeftIcon, CreditCardIcon, GiftIcon, CloseIcon } from '../components/icons'
import LoginForm from '../components/auth/LoginForm'
import AddressSuggest from '../components/checkout/AddressSuggest'
import { PickupPointPicker } from '../components/checkout/PickupPointPicker'
import { useAuth } from '../context/AuthContext'

/** Задержка ступени появления. Значения — из хореографии экрана успеха:
    шаг 60-80мс, последняя ступень стартует на 380мс. */
const inDelay = (ms: number) => ({ '--in-delay': `${ms}ms` }) as React.CSSProperties

/** Частицы заданы константой, а не Math.random(): случайные позиции меняли бы
    картинку на каждом рендере, и её нельзя было бы проверить скриншотом.
    dx/dy — разлёт от центра галочки, rot — доворот к концу полёта. */
const CONFETTI = [
  { dx: -78, dy: -34, rot: -140, delay: 0,   color: 'bg-amber-400' },
  { dx: -54, dy: -58, rot: 96,   delay: 40,  color: 'bg-amber-300' },
  { dx: -22, dy: -70, rot: -64,  delay: 20,  color: 'bg-success' },
  { dx: 16,  dy: -74, rot: 128,  delay: 60,  color: 'bg-ink' },
  { dx: 48,  dy: -60, rot: -108, delay: 30,  color: 'bg-amber-500' },
  { dx: 74,  dy: -30, rot: 72,   delay: 70,  color: 'bg-amber-400' },
  { dx: 86,  dy: 10,  rot: -152, delay: 50,  color: 'bg-amber-300' },
  { dx: 66,  dy: 46,  rot: 116,  delay: 90,  color: 'bg-success' },
  { dx: 30,  dy: 68,  rot: -88,  delay: 110, color: 'bg-ink' },
  { dx: -10, dy: 74,  rot: 144,  delay: 80,  color: 'bg-amber-500' },
  { dx: -46, dy: 62,  rot: -120, delay: 120, color: 'bg-amber-400' },
  { dx: -74, dy: 28,  rot: 84,   delay: 100, color: 'bg-amber-300' },
  { dx: -90, dy: -6,  rot: -100, delay: 140, color: 'bg-ink' },
  { dx: 92,  dy: -12, rot: 132,  delay: 130, color: 'bg-success' },
]

function SuccessConfetti() {
  return (
    <div
      className="absolute inset-x-0 top-0 h-44 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={`confetti-piece ${c.color}`}
          style={{
            '--dx': `${c.dx}px`,
            '--dy': `${c.dy}px`,
            '--rot': `${c.rot}deg`,
            '--c-delay': `${c.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

type PaymentMethod = 'card' | 'cash_on_delivery'
type Step = 'delivery' | 'payment' | 'confirm'

/// Запасной список, когда расчёт тарифов не удался. Только самовывоз: он
/// единственный не зависит от внешних служб. Выдумывать цены остальных нельзя —
/// раньше здесь стоял массив из семи служб с price: 0, и покупатель выбирал
/// «бесплатную» доставку, которой не существует.
const PICKUP_ONLY: DeliveryQuote[] = [{
  provider: 'pickup',
  key: 'pickup',
  kind: 'store',
  title: 'Самовывоз',
  description: 'Магазин на ул. Ленина, 12',
  price: 0,
  daysMin: 0,
  daysMax: 0,
  available: true,
}]

const PROVIDER_ICONS: Record<string, string> = {
  simba_courier: '',
  cdek: '',
  yandex: '',
  ozon_pvz: '',
  pickup: '',
}

const DELIVERY_LABELS: Record<DeliveryOptionKey, string> = {
  simba_courier: 'Курьер Simba',
  cdek_pvz: 'СДЭК — в пункт выдачи',
  yandex_pvz: 'Яндекс Доставка — в пункт выдачи',
  ozon_pvz: 'Ozon — в пункт выдачи',
  pickup: 'Самовывоз',
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'delivery', label: 'Доставка' },
  { key: 'payment', label: 'Оплата' },
  { key: 'confirm', label: 'Подтверждение' },
]

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { clear: clearCart } = useCart()
  const { isLoggedIn: authLoggedIn } = useAuth()
  const legacyIsLoggedIn = !!localStorage.getItem('token')
  const [step, setStep] = useState<Step>('delivery')
  const [option, setOption] = useState<DeliveryOptionKey>('simba_courier')
  const [payment, setPayment] = useState<PaymentMethod>('card')
  const [bonusSpend, setBonusSpend] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [orderPayment, setOrderPayment] = useState<PaymentMethod>('card')
  const [orderBonusEarned, setOrderBonusEarned] = useState(0)
  const [orderTotal, setOrderTotal] = useState(0)
  const [orderBonusUsed, setOrderBonusUsed] = useState(0)
  const [orderCreatedAt, setOrderCreatedAt] = useState('')
  const [entered, setEntered] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Валидация полей — какие уже трогали
  const [touched, setTouched] = useState({
    deliveryCity: false,
    deliveryStreet: false,
    deliveryHouse: false,
    deliveryPickupPoint: false,
    contactName: false,
    contactEmail: false,
    contactPhone: false,
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!orderPlaced) return
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [orderPlaced])
  const [quotes, setQuotes] = useState<DeliveryQuote[]>([])
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [quotesError, setQuotesError] = useState<string | null>(null)
  const [quotesRetry, setQuotesRetry] = useState(0)

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartLoading, setCartLoading] = useState(true)
  const [userBonusPoints, setUserBonusPoints] = useState(0)
  const [orderError, setOrderError] = useState<string | null>(null)

  const [address, setAddress] = useState({
    city: 'Москва',
    street: '',
    house: '',
    apartment: '',
    entrance: '',
    floor: '',
    intercom: '',
    addressType: 'apartment' as 'apartment' | 'house',
    comment: '',
    postalCode: '',
    lat: 0,
    lon: 0,
  })

  const [pickupPoint, setPickupPoint] = useState<PickupPoint | null>(null)
  const [features, setFeatures] = useState<{ suggest: boolean }>({ suggest: false })

  // Загрузить features при монтировании
  useEffect(() => {
    deliveryApi.features().then(res => {
      setFeatures(res.data)
    }).catch(() => {
      setFeatures({ suggest: false })
    })
  }, [])

  // Вид доставки из ключа варианта
  const kind: DeliveryKind = deliveryKindOf(option)

  // Если доставка не курьером, отключить наличные
  const isCourierDelivery = kind === 'courier'
  useEffect(() => {
    if (!isCourierDelivery && payment === 'cash_on_delivery') {
      setPayment('card')
    }
  }, [isCourierDelivery, payment])

  // При смене варианта доставки — сбросить пункт выдачи и очистить координаты
  useEffect(() => {
    setPickupPoint(null)
    // Сбросить координаты для других видов доставки
    if (kind !== 'pickup_point') {
      setAddress(a => ({ ...a, lat: 0, lon: 0 }))
    }
  }, [option, kind])

  useEffect(() => {
    Promise.all([
      cartApi.get().then(res => setCartItems(res.data.items)).catch(() => setCartItems([])),
      authApi.me().then(res => setUserBonusPoints(res.data.bonusPoints)).catch(() => setUserBonusPoints(0)),
    ]).finally(() => setCartLoading(false))
  }, [])

  const totalWeight = cartItems.reduce((s, i) => s + i.productVariant.weight * i.quantity, 0)

  // Запрашиваем котировки при вводе города и других параметров
  useEffect(() => {
    // Пока корзина не загрузилась, вес нулевой, и сервер справедливо отвечает отказом
    if (!address.city || address.city.length < 3 || totalWeight <= 0) return
    const timer = setTimeout(async () => {
      setQuotesLoading(true)
      setQuotesError(null)
      try {
        const res = await deliveryApi.quotes({
          city: address.city,
          street: address.street,
          house: address.house,
          weightKg: totalWeight,
          subtotal: cartItems.reduce((s, i) => s + i.productVariant.price * i.quantity, 0),
          lat: address.lat || undefined,
          lon: address.lon || undefined,
          postalCode: address.postalCode || undefined,
        })
        setQuotes(res.data.quotes)
        setQuotesError(null)
      } catch (err) {
        setQuotesError(apiErrorMessage(err, 'Не удалось рассчитать доставку. Попробуйте ещё раз.'))
        setQuotes([])
      } finally {
        setQuotesLoading(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [address.city, address.street, address.house, address.lat, address.lon, address.postalCode, totalWeight, quotesRetry])

  const selectedQuote = quotes.find(q => q.key === option)
  const deliveryCost = selectedQuote?.price ?? 0

  // Читаем промокод из sessionStorage
  const readPromo = (): (PromoRule & { code: string }) | null => {
    try {
      const stored = sessionStorage.getItem('promo')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  const promo = readPromo()
  const promoCode = promo?.code

  // Валидация полей шага доставки
  const validateDeliveryStep = (): boolean => {
    const errors: Record<string, string> = {}

    if (kind === 'courier') {
      if (!address.city.trim()) {
        errors.deliveryCity = 'Укажите город'
      }
      if (!address.street.trim()) {
        errors.deliveryStreet = 'Укажите улицу'
      }
      if (!address.house.trim()) {
        errors.deliveryHouse = 'Укажите номер дома'
      }
    } else if (kind === 'pickup_point') {
      if (!address.city.trim()) {
        errors.deliveryCity = 'Укажите город'
      }
      if (!pickupPoint) {
        errors.deliveryPickupPoint = 'Выберите пункт выдачи на карте или в списке'
      }
    }

    if (!legacyIsLoggedIn) {
      if (!contactName.trim()) {
        errors.contactName = 'Укажите имя'
      }
      if (!contactEmail.trim()) {
        errors.contactEmail = 'Укажите email'
      } else if (!/^[^\s@]+@[^\s@]+\.[a-zA-Zа-яА-Я]{2,}$/.test(contactEmail)) {
        errors.contactEmail = 'Проверьте адрес — похоже, есть опечатка'
      }
      if (!contactPhone.trim()) {
        errors.contactPhone = 'Укажите телефон'
      } else if (!isValidPhoneRU(contactPhone)) {
        errors.contactPhone = 'Укажите российский номер'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNextFromDelivery = () => {
    setTouched(t => ({
      ...t,
      deliveryCity: true,
      deliveryStreet: true,
      deliveryHouse: true,
      deliveryPickupPoint: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
    }))

    if (validateDeliveryStep()) {
      setStep('payment')
    }
  }

  const totals = calcOrderTotals({
    items: cartItems.map(i => ({ price: i.productVariant.price, quantity: i.quantity, isSubscription: i.isSubscription })),
    promo,
    bonusRequested: bonusSpend ? userBonusPoints : 0,
    availableBonus: userBonusPoints,
    deliveryCost,
  })

  const subtotal = totals.subtotal
  const promoDiscount = totals.promoDiscount
  const bonusUsedScoins = totals.bonusUsed
  const bonusDiscount = bonusUsedScoins * 100
  const total = totals.total
  const bonusEarned = totals.bonusEarned

  const stepIndex = STEPS.findIndex(s => s.key === step)

  const handlePlaceOrder = async () => {
    setPlacingOrder(true)
    setOrderError(null)
    try {
      const promoData = readPromo()
      const cartRes = await cartApi.get()

      // Служба доставки берётся напрямую из котировки
      const deliveryMethod = selectedQuote?.provider ?? 'simba_courier'

      const createOrderPayload: Parameters<typeof ordersApi.create>[0] = {
        cartId: cartRes.data.id,
        deliveryMethod,
        comment: address.comment || undefined,
        bonusUsed: bonusUsedScoins,
        promoCode: promoData?.code,
        deliveryCost,
        paymentMethod: payment,
      }

      // Доставка до дома — адрес
      if (kind === 'courier' && address.street) {
        createOrderPayload.deliveryAddress = {
          city: address.city,
          street: address.street,
          house: address.house,
          apartment: address.apartment || undefined,
          entrance: address.entrance || undefined,
          floor: address.floor || undefined,
          intercom: address.intercom || undefined,
          addressType: address.addressType || undefined,
          postalCode: address.postalCode || undefined,
          lat: address.lat || undefined,
          lon: address.lon || undefined,
        }
      }

      // Пункт выдачи — пункт целиком
      if (kind === 'pickup_point' && pickupPoint) {
        createOrderPayload.deliveryPoint = pickupPoint
      }

      // Для гостя добавить контактные данные
      if (!legacyIsLoggedIn && (contactName || contactEmail || contactPhone)) {
        createOrderPayload.contact = {
          name: contactName || undefined,
          email: contactEmail || undefined,
          phone: normalizePhone(contactPhone) || undefined,
        }
      }

      const res = await ordersApi.create(createOrderPayload)
      setOrderId(res.data.id)
      setOrderPayment(payment)
      setOrderBonusEarned(res.data.bonusEarned)
      setOrderTotal(res.data.total)
      setOrderBonusUsed(res.data.bonusUsed)
      setOrderCreatedAt(res.data.createdAt)
      setOrderPlaced(true)
      await clearCart()
      sessionStorage.removeItem('promo')
    } catch (err: unknown) {
      const errCode = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      const errMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Не удалось оформить заказ. Попробуйте ещё раз.'

      // Если ошибка в промокоде — удалить его и показать ошибку сервера
      if (errCode === 'PROMO_INVALID') {
        sessionStorage.removeItem('promo')
      }

      setOrderError(errMessage)
    } finally {
      setPlacingOrder(false)
    }
  }

  if (cartLoading) {
    return (
      <div className="min-h-[100dvh] bg-blue-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (orderPlaced) {
    const paymentLabel = orderPayment === 'card' ? 'Картой' : 'Наличными'
    return (
      <div className="min-h-[100dvh] bg-blue-50 flex items-center justify-center px-4 py-10">
        <div className={`stagger-in ${entered ? 'is-in' : ''} relative w-full max-w-sm bg-white border border-line rounded-card animate-card-in`}>
          {!reduceMotion && <SuccessConfetti />}

          {/* Верх — что произошло. */}
          <div className="px-6 pt-8 text-center" style={inDelay(0)}>
            <div className="w-20 h-20 bg-success-tint rounded-full flex items-center justify-center mx-auto mb-5 ico-ring-in">
              {/* Задержка живёт на обёртке: --draw-delay наследуется до пути
                  внутри svg, где её и читает .icon-check-path. */}
              <div style={{ '--draw-delay': '220ms' } as React.CSSProperties}>
                <CheckIcon className="w-9 h-9 text-success ico-draw" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-navy-900">Заказ оформлен!</h1>
            <p className="mt-1 text-sm text-navy-500">Мы уже собираем его</p>
          </div>

          {/* Факты — то, что покупатель переписывает или фотографирует. */}
          <dl className="px-6 pt-6 pb-6 grid grid-cols-2 gap-x-4 gap-y-5" style={inDelay(200)}>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-navy-500 mb-1">Номер заказа</dt>
              <dd className="text-lg font-black text-navy-900 tracking-wide tabular-nums">
                #{orderId ? orderId.slice(-6).toUpperCase() : '—'}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-xs font-bold uppercase tracking-wider text-navy-500 mb-1">Сумма</dt>
              <dd className="text-lg font-black text-navy-900 tabular-nums">{formatPrice(orderTotal)}</dd>
            </div>
            {orderCreatedAt && (
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-navy-500 mb-1">Дата</dt>
                <dd className="text-base font-bold text-navy-900 tabular-nums">{formatDateTime(orderCreatedAt)}</dd>
              </div>
            )}
            <div className="text-right">
              <dt className="text-xs font-bold uppercase tracking-wider text-navy-500 mb-1">Оплата</dt>
              <dd className="inline-flex items-center justify-end gap-2 text-base font-bold text-navy-900">
                <CreditCardIcon className="w-5 h-5 text-navy-400" />
                {paymentLabel}
              </dd>
            </div>
            {orderBonusUsed > 0 && (
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-navy-500 mb-1">Списано бонусов</dt>
                <dd className="text-base font-bold text-amber-600 tabular-nums">−{formatBonuses(orderBonusUsed)}</dd>
              </div>
            )}
          </dl>

          {/* Разрез отделяет «что произошло» от «что дальше». */}
          <div className="px-6" style={inDelay(260)}>
            <div className="h-0.5 receipt-dash" aria-hidden="true" />
          </div>

          {/* Низ — что дальше. */}
          <div className="px-6 pt-6 pb-5" style={inDelay(320)}>
            <div className="flex items-center gap-3 bg-amber-50 rounded-xl px-4 py-3">
              <GiftIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-navy-700">
                Начислено <span className="font-bold text-amber-600">+{formatBonuses(orderBonusEarned)}</span>
              </p>
            </div>
            {orderPayment === 'cash_on_delivery' && (
              <p className="mt-3 text-xs text-navy-500">Оплата наличными курьеру при получении</p>
            )}
            <p className="mt-3 text-xs text-navy-500">
              {contactEmail || authLoggedIn
                ? 'Отправим письмо, когда заказ будет подтверждён'
                : 'Сохраните номер заказа — по нему найдём его в поддержке'}
            </p>
          </div>

          <div className="px-6 pb-6 flex flex-col gap-3" style={inDelay(380)}>
            {!authLoggedIn ? (
              <>
                {/* Лейбл про результат, а не про механику: аккаунта у гостя ещё
                    нет, «войти» ему нечем. Email ушёл в подпись — при пустом
                    поле прежний лейбл давал дыру «Войти по  и получить…». */}
                <Link to={contactEmail ? `/auth?email=${encodeURIComponent(contactEmail)}` : '/auth'}
                  className="block btn-primary py-3 text-center">
                  Забрать 300 бонусов
                </Link>
                {contactEmail && (
                  <p className="text-xs text-navy-500 text-center -mt-1">
                    Войдите по {contactEmail} — бонусы придут на счёт
                  </p>
                )}
                <Link to="/" className="btn-outline w-full py-3 rounded-xl text-base font-medium">
                  На главную
                </Link>
              </>
            ) : (
              <>
                <Link to="/profile" className="block btn-primary py-3 text-center">
                  Мои заказы
                </Link>
                <Link to="/" className="btn-outline w-full py-3 rounded-xl text-base font-medium">
                  На главную
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-blue-50 pb-6">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Шапка */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/cart" className="text-navy-400 hover:text-navy-700 transition-colors">
            <ArrowLeftIcon className="ico-nudge ico-nudge--back w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-navy-900">Оформление заказа</h1>
        </div>

        {/* Прогресс шагов */}
        <div className="flex items-center mb-6">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <button
                onClick={() => i < stepIndex && setStep(s.key)}
                className={`flex items-center gap-2 ${i < stepIndex ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-100 ease ${
                  i < stepIndex ? 'bg-amber-400 text-navy-900' :
                  i === stepIndex ? 'bg-amber-400 text-navy-900' :
                  'bg-white border border-line text-navy-500'
                }`}>
                  {i < stepIndex ? <CheckIcon className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${
                  i === stepIndex ? 'block text-navy-900' : 'hidden sm:block text-navy-400'
                }`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < stepIndex ? 'bg-amber-400' : 'bg-line'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Левая часть — шаги */}
          <div className="lg:col-span-2">

            {/* ШАГ 1 — Доставка */}
            {step === 'delivery' && (
              <div className="bg-white rounded-2xl p-5">
                <h2 className="font-bold text-navy-900 mb-4">Способ доставки</h2>

                {quotesLoading && (
                  <div className="flex items-center gap-2 text-sm text-navy-400 mb-3">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Рассчитываем стоимость доставки...
                  </div>
                )}

                {quotesError && (
                  <div className="mb-4 p-3 rounded-xl bg-white border border-destructive">
                    <p className="text-sm text-destructive mb-2">{quotesError}</p>
                    <button
                      onClick={() => {
                        setQuotesError(null)
                        setQuotesRetry((n) => n + 1)
                      }}
                      className="text-xs font-medium text-destructive underline">
                      Попробовать ещё раз
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-2 mb-5">
                  {(quotes.length > 0 ? quotes : PICKUP_ONLY).map(opt => {
                    // yandex_pvz с ошибкой "Выберите пункт выдачи" - показывается как доступный
                    const isSelectPickupPointError = opt.key === 'yandex_pvz' && opt.error === 'Выберите пункт выдачи'
                    const isDisabled = !opt.available && !isSelectPickupPointError

                    const selectable = !isDisabled
                    const active = option === opt.key
                    // Описание сервера часто повторяет подпись варианта («СДЭК — в пункт
                    // выдачи» / «В пункт выдачи») — тогда это шум, а не информация.
                    const label = opt.title || DELIVERY_LABELS[opt.key]
                    const description =
                      opt.description && !label.toLowerCase().includes(opt.description.toLowerCase())
                        ? opt.description
                        : null
                    const freeHint =
                      opt.freeFrom != null && opt.price > 0 ? `Бесплатно от ${formatPrice(opt.freeFrom)}` : null
                    const days =
                      opt.daysMax > 0
                        ? opt.daysMin === opt.daysMax ? `${opt.daysMin} дн.` : `${opt.daysMin}–${opt.daysMax} дн.`
                        : selectable ? 'Сегодня' : null

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => selectable && setOption(opt.key as DeliveryOptionKey)}
                        disabled={isDisabled}
                        aria-pressed={active}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-[border-color,background-color] text-left ${
                          isDisabled ? 'border-line bg-blue-50 cursor-not-allowed' :
                          active
                            ? 'border-ink bg-white'
                            : 'border-line bg-white hover:border-navy-300'
                        }`}>
                        {PROVIDER_ICONS[opt.provider] ? <span className="text-2xl">{PROVIDER_ICONS[opt.provider]}</span> : null}
                        {/* Недоступная служба — приглушённые токены, а не opacity на всей
                            строке: прозрачность гасила и текст, и рамку, и радио разом, а
                            красный у семи мёртвых строк перекрикивал три живые. */}
                        <div className="flex-1 min-w-0">
                          <span className={`block font-semibold text-sm ${isDisabled ? 'text-navy-400' : 'text-navy-900'}`}>
                            {label}
                          </span>
                          {isDisabled && <span className="block text-xs text-navy-500">{opt.error}</span>}
                          {description && <span className="block text-xs text-navy-500">{description}</span>}
                          {days && <span className={`block text-xs mt-0.5 ${isDisabled ? 'text-navy-400' : 'text-navy-500'}`}>{days}</span>}
                          {freeHint && !isDisabled && <span className="block text-xs mt-0.5 text-navy-500">{freeHint}</span>}
                        </div>
                        {selectable && (
                          <span className="flex-shrink-0 text-right text-sm font-bold tabular-nums text-navy-900">
                            {isSelectPickupPointError
                              ? <span className="text-xs font-medium text-navy-500">после выбора пункта</span>
                              : opt.price > 0
                                ? formatPrice(opt.price)
                                : <span className="text-success font-semibold">Бесплатно</span>}
                          </span>
                        )}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          active ? 'border-ink bg-ink' : 'border-line'
                        }`}>
                          {active && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Адрес — для курьера или ПВЗ */}
                {kind === 'courier' && (
                  <div>
                    <h3 className="font-semibold text-navy-900 mb-3 text-sm">Адрес доставки</h3>
                    <div className="flex flex-col gap-3">
                      {/* Город для курьера — всегда текстовое поле */}
                      <div>
                        <input
                          type="text"
                          placeholder="Город"
                          aria-label="Город"
                          aria-invalid={!!validationErrors.deliveryCity && touched.deliveryCity}
                          value={address.city}
                          onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                          onBlur={() => setTouched(t => ({ ...t, deliveryCity: true }))}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm text-navy-900 focus:outline-none focus:ring-2 transition-colors ${
                            validationErrors.deliveryCity && touched.deliveryCity
                              ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                              : 'border-line focus:border-line focus:ring-navy-200'
                          }`}
                        />
                        {validationErrors.deliveryCity && touched.deliveryCity && (
                          <p className="text-xs text-destructive mt-1">{validationErrors.deliveryCity}</p>
                        )}
                      </div>

                      {/* Адрес — через AddressSuggest или обычные поля */}
                      {features.suggest ? (
                        <AddressSuggest
                          id="address-suggest"
                          value={address.street}
                          onChange={text => setAddress(a => ({ ...a, street: text }))}
                          onSelect={(suggestion: AddressSuggestion) => {
                            setAddress(a => ({
                              ...a,
                              street: suggestion.street || suggestion.value || a.street,
                              house: suggestion.house || a.house,
                              postalCode: suggestion.postalCode || a.postalCode,
                              lat: suggestion.lat || a.lat,
                              lon: suggestion.lon || a.lon,
                            }))
                          }}
                          error={validationErrors.deliveryStreet && touched.deliveryStreet ? validationErrors.deliveryStreet : undefined}
                        />
                      ) : (
                        <div>
                          <input
                            type="text"
                            placeholder="Улица"
                            aria-label="Улица"
                            aria-invalid={!!validationErrors.deliveryStreet && touched.deliveryStreet}
                            value={address.street}
                            onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
                            onBlur={() => setTouched(t => ({ ...t, deliveryStreet: true }))}
                            className={`w-full px-4 py-2.5 rounded-xl border text-sm text-navy-900 focus:outline-none focus:ring-2 transition-colors ${
                              validationErrors.deliveryStreet && touched.deliveryStreet
                                ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                                : 'border-line focus:border-line focus:ring-navy-200'
                            }`}
                          />
                          {validationErrors.deliveryStreet && touched.deliveryStreet && (
                            <p className="text-xs text-destructive mt-1">{validationErrors.deliveryStreet}</p>
                          )}
                        </div>
                      )}

                      {/* Дом — в обеих ветках suggest и без */}
                      <div>
                        <label htmlFor="delivery-house" className="block text-sm font-medium text-navy-900 mb-1">
                          Дом
                        </label>
                        <input
                          id="delivery-house"
                          type="text"
                          placeholder="Дом"
                          aria-label="Дом"
                          required
                          aria-invalid={!!validationErrors.deliveryHouse && touched.deliveryHouse}
                          value={address.house}
                          onChange={e => setAddress(a => ({ ...a, house: e.target.value }))}
                          onBlur={() => setTouched(t => ({ ...t, deliveryHouse: true }))}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm text-navy-900 focus:outline-none focus:ring-2 transition-colors ${
                            validationErrors.deliveryHouse && touched.deliveryHouse
                              ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                              : 'border-line focus:border-line focus:ring-navy-200'
                          }`}
                        />
                        {validationErrors.deliveryHouse && touched.deliveryHouse && (
                          <p className="text-xs text-destructive mt-1">{validationErrors.deliveryHouse}</p>
                        )}
                      </div>

                      {/* Переключатель: Квартира / Частный дом */}
                      <div className="flex gap-2" role="radiogroup" aria-label="Тип адреса">
                        <button
                          type="button"
                          onClick={() => setAddress(a => ({ ...a, addressType: 'apartment' }))}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${
                            address.addressType === 'apartment'
                              ? 'bg-ink text-white border-ink'
                              : 'bg-white text-navy-700 border-line'
                          }`}
                          role="radio"
                          aria-checked={address.addressType === 'apartment'}
                        >
                          Квартира
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddress(a => ({ ...a, addressType: 'house' }))}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${
                            address.addressType === 'house'
                              ? 'bg-ink text-white border-ink'
                              : 'bg-white text-navy-700 border-line'
                          }`}
                          role="radio"
                          aria-checked={address.addressType === 'house'}
                        >
                          Частный дом
                        </button>
                      </div>

                      {/* Поля для квартиры */}
                      {address.addressType === 'apartment' && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label htmlFor="delivery-apartment" className="block text-sm font-medium text-navy-900 mb-1">
                              Квартира
                            </label>
                            <input
                              id="delivery-apartment"
                              type="text"
                              placeholder="Квартира"
                              required
                              value={address.apartment}
                              onChange={e => setAddress(a => ({ ...a, apartment: e.target.value }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-line text-sm text-navy-900 focus:outline-none focus:border-line focus:ring-2 focus:ring-navy-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="delivery-entrance" className="block text-sm font-medium text-navy-900 mb-1">
                              Подъезд
                            </label>
                            <input
                              id="delivery-entrance"
                              type="text"
                              placeholder="Подъезд"
                              value={address.entrance}
                              onChange={e => setAddress(a => ({ ...a, entrance: e.target.value }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-line text-sm text-navy-900 focus:outline-none focus:border-line focus:ring-2 focus:ring-navy-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="delivery-floor" className="block text-sm font-medium text-navy-900 mb-1">
                              Этаж
                            </label>
                            <input
                              id="delivery-floor"
                              type="text"
                              placeholder="Этаж"
                              value={address.floor}
                              onChange={e => setAddress(a => ({ ...a, floor: e.target.value }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-line text-sm text-navy-900 focus:outline-none focus:border-line focus:ring-2 focus:ring-navy-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="delivery-intercom" className="block text-sm font-medium text-navy-900 mb-1">
                              Домофон
                            </label>
                            <input
                              id="delivery-intercom"
                              type="text"
                              placeholder="Домофон"
                              value={address.intercom}
                              onChange={e => setAddress(a => ({ ...a, intercom: e.target.value }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-line text-sm text-navy-900 focus:outline-none focus:border-line focus:ring-2 focus:ring-navy-200"
                            />
                          </div>
                        </div>
                      )}

                      <textarea
                        placeholder="Комментарий к заказу (необязательно)"
                        aria-label="Комментарий к заказу"
                        value={address.comment}
                        onChange={e => setAddress(a => ({ ...a, comment: e.target.value }))}
                        rows={2}
                        className="w-full px-4 py-2.5 rounded-xl border border-line text-sm text-navy-900 focus:outline-none focus:border-line focus:ring-2 focus:ring-navy-200 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Пункт выдачи — для ПВЗ */}
                {kind === 'pickup_point' && (
                  <div>
                    <h3 className="font-semibold text-navy-900 mb-3 text-sm">Пункт выдачи</h3>
                    <div className="flex flex-col gap-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Город"
                          aria-label="Город"
                          aria-invalid={!!validationErrors.deliveryCity && touched.deliveryCity}
                          value={address.city}
                          onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                          onBlur={() => setTouched(t => ({ ...t, deliveryCity: true }))}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm text-navy-900 focus:outline-none focus:ring-2 transition-colors ${
                            validationErrors.deliveryCity && touched.deliveryCity
                              ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                              : 'border-line focus:border-line focus:ring-navy-200'
                          }`}
                        />
                        {validationErrors.deliveryCity && touched.deliveryCity && (
                          <p className="text-xs text-destructive mt-1">{validationErrors.deliveryCity}</p>
                        )}
                      </div>

                      {address.city.trim().length >= 2 && selectedQuote?.provider && (selectedQuote.provider === 'cdek' || selectedQuote.provider === 'yandex') && (
                        <div>
                          <PickupPointPicker
                            provider={selectedQuote.provider}
                            city={address.city}
                            cityCoords={address.lat && address.lon ? { lat: address.lat, lon: address.lon } : undefined}
                            selected={pickupPoint}
                            onSelect={(point) => {
                              setPickupPoint(point)
                              // Ошибка «выберите пункт» после выбора не имеет смысла — гасим сразу.
                              setValidationErrors((e) => {
                                const { deliveryPickupPoint: _omit, ...rest } = e
                                return rest
                              })
                            }}
                          />
                          {validationErrors.deliveryPickupPoint && touched.deliveryPickupPoint && (
                            <p className="text-xs text-destructive mt-2">{validationErrors.deliveryPickupPoint}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Контактные данные для гостя */}
                {!legacyIsLoggedIn && (
                  <div className="mt-5">
                    <h3 className="font-semibold text-navy-900 mb-3 text-sm">Контактные данные</h3>
                    <div className="flex flex-col gap-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Имя"
                          aria-label="Имя"
                          aria-invalid={!!validationErrors.contactName && touched.contactName}
                          value={contactName}
                          onChange={e => setContactName(e.target.value)}
                          onBlur={() => setTouched(t => ({ ...t, contactName: true }))}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm text-navy-900 focus:outline-none focus:ring-2 transition-colors ${
                            validationErrors.contactName && touched.contactName
                              ? 'border-destructive focus:border-destructive focus:ring-destructive/30'
                              : 'border-line focus:border-line focus:ring-navy-200'
                          }`}
                        />
                        {validationErrors.contactName && touched.contactName && (
                          <p className="text-xs text-destructive mt-1">{validationErrors.contactName}</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="email"
                          placeholder="Email"
                          aria-label="Email"
                          aria-invalid={!!validationErrors.contactEmail && touched.contactEmail}
                          value={contactEmail}
                          onChange={e => setContactEmail(e.target.value)}
                          onBlur={() => setTouched(t => ({ ...t, contactEmail: true }))}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm text-navy-900 focus:outline-none focus:ring-2 transition-colors ${
                            validationErrors.contactEmail && touched.contactEmail
                              ? 'border-destructive focus:border-destructive focus:ring-destructive/30'
                              : 'border-line focus:border-line focus:ring-navy-200'
                          }`}
                        />
                        {validationErrors.contactEmail && touched.contactEmail && (
                          <p className="text-xs text-destructive mt-1">{validationErrors.contactEmail}</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="tel"
                          placeholder="Телефон"
                          aria-label="Телефон"
                          aria-invalid={!!validationErrors.contactPhone && touched.contactPhone}
                          inputMode="tel"
                          value={contactPhone}
                          onChange={e => setContactPhone(handlePhoneInput(e.target.value))}
                          onBlur={() => setTouched(t => ({ ...t, contactPhone: true }))}
                          className={`w-full px-4 py-2.5 rounded-xl border text-navy-900 focus:outline-none focus:ring-2 ${
                            validationErrors.contactPhone && touched.contactPhone
                              ? 'border-destructive focus:border-destructive focus:ring-destructive/30'
                              : 'border-line focus:border-line focus:ring-navy-200'
                          }`}
 />
 {validationErrors.contactPhone && touched.contactPhone && (
 <p className="text-destructive mt-1">{validationErrors.contactPhone}</p>
 )}
 </div>
 </div>
 </div>
 )}

 <button
 onClick={handleNextFromDelivery}
 className="w-full mt-5 btn-primary press-wide py-3">
 Далее: Оплата
 </button>
 </div>
 )}

 {/* ШАГ 2 — Оплата */}
 {step === 'payment' && (
 <div className="bg-white p-5">
 <h2 className="text-navy-900 mb-4">Способ оплаты</h2>

 <div className="flex flex-col gap-2 mb-5">
 {[
 { key: 'card' as PaymentMethod, title: 'Картой онлайн', desc: 'Visa, Mastercard, МИР — безопасный платёж' },
                    { key: 'cash_on_delivery' as PaymentMethod, title: 'Наличными курьеру', desc: 'Только при доставке курьером до двери' },
                  ].map(opt => {
                    // Наличные доступны только при доставке курьером Simba
                    const isDisabled = opt.key === 'cash_on_delivery' && selectedQuote?.provider !== 'simba_courier'
                    return (
                      <button
                        key={opt.key}
                        onClick={() => !isDisabled && setPayment(opt.key)}
                        disabled={isDisabled}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-[border-color,background-color] text-left ${
                          isDisabled
                            ? 'border-line bg-blue-50 opacity-60 cursor-not-allowed'
                            : payment === opt.key
                              ? 'border-ink bg-white'
                              : 'border-line bg-white hover:border-navy-300'
                        }`}>
                        <div className="flex-1">
                          <p className="font-semibold text-navy-900 text-sm">{opt.title}</p>
                          {isDisabled ? (
                            <p className="text-xs text-navy-500">Доступно только при доставке курьером до двери</p>
                          ) : (
                            <p className="text-xs text-navy-500">{opt.desc}</p>
                          )}
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          payment === opt.key ? 'border-ink bg-ink' : 'border-line'
                        }`}>
                          {payment === opt.key && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Бонусы — только для авторизованных */}
                {authLoggedIn && (() => {
                  // Расчитаем максимально доступно в этом заказе
                  const totalsWithMaxBonus = calcOrderTotals({
                    items: cartItems.map(i => ({ price: i.productVariant.price, quantity: i.quantity, isSubscription: i.isSubscription })),
                    promo,
                    bonusRequested: userBonusPoints,
                    availableBonus: userBonusPoints,
                    deliveryCost,
                  })
                  const maxAvailableBonus = totalsWithMaxBonus.bonusUsed

                  const canUseBonus = maxAvailableBonus > 0
                  const actualBonusUsed = bonusSpend ? maxAvailableBonus : 0
                  const isBonusLimited = bonusSpend && maxAvailableBonus < userBonusPoints

                  return (
                    <div className={`rounded-xl border p-4 mb-5 transition-[border-color,background-color] duration-100 ease ${
                      bonusSpend && canUseBonus ? 'border-amber-200 bg-amber-50' :
                      bonusSpend && !canUseBonus ? 'border-line bg-blue-50 opacity-60' :
                      'border-line'
                    }`}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bonusSpend && canUseBonus}
                          onChange={e => setBonusSpend(canUseBonus && e.target.checked)}
                          disabled={!canUseBonus}
                          className={`w-4 h-4 accent-amber-400 ${!canUseBonus ? 'cursor-not-allowed' : ''}`}
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-navy-900 text-sm">Списать бонусы</p>
                          {canUseBonus ? (
                            <div className="text-xs text-navy-500">
                              {bonusSpend ? (
                                <>
                                  <p>
                                    Спишем <span className="font-bold text-amber-600">{formatBonuses(actualBonusUsed)}</span> = {actualBonusUsed.toLocaleString('ru-RU')} ₽
                                    {userBonusPoints > 0 && ` из ${userBonusPoints.toLocaleString('ru-RU')}`}
                                  </p>
                                  {isBonusLimited && (
                                    <p className="text-navy-500 mt-1">Бонусами можно оплатить до половины заказа</p>
                                  )}
                                </>
                              ) : (
                                <p>
                                  Доступно к списанию: <span className="font-bold text-amber-600">{formatBonuses(maxAvailableBonus)}</span> = {maxAvailableBonus.toLocaleString('ru-RU')} ₽
                                  {userBonusPoints > 0 && ` из ${userBonusPoints.toLocaleString('ru-RU')}`}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-navy-500">Сумма заказа слишком мала для списания</p>
                          )}
                        </div>
                      </label>
                    </div>
                  )
                })()}

                {/* Блок входа для гостей */}
                {!authLoggedIn && !legacyIsLoggedIn && (
                  <div className="rounded-xl border border-line bg-blue-50 p-4 mb-5">
                    <p className="text-sm text-navy-700 mb-3">
                      Войдите, чтобы списать бонусы
                    </p>
                    <button
                      onClick={() => setLoginModalOpen(true)}
                      className="w-full btn-primary press-wide py-2">
                      Войти в аккаунт
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('delivery')}
                    className="flex-1 border border-line text-navy-500 font-medium py-3 rounded-xl hover:bg-blue-50 transition-colors duration-100 ease text-sm">
                    Назад
                  </button>
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-[2] btn-primary press-wide py-3">
                    Далее: Подтверждение
                  </button>
                </div>
              </div>
            )}

            {/* ШАГ 3 — Подтверждение */}
            {step === 'confirm' && (
              <div className="bg-white rounded-2xl p-5">
                <h2 className="font-bold text-navy-900 mb-4">Проверьте заказ</h2>

                {/* Краткая сводка */}
                <div className="flex flex-col gap-3 mb-4 p-4 bg-white border border-line rounded-xl">
                  <div className="flex justify-between text-sm">
                    <span className="text-navy-500">Доставка</span>
                    <span className="font-medium text-navy-900">
                      {DELIVERY_LABELS[option]}
                    </span>
                  </div>
                  {kind === 'courier' && address.street && (
                    <div className="flex justify-between text-sm">
                      <span className="text-navy-500">Адрес</span>
                      <span className="font-medium text-navy-900 text-right max-w-[200px]">
                        {address.city}, {address.street}, д.{address.house}
                        {address.apartment && `, кв.${address.apartment}`}
                      </span>
                    </div>
                  )}
                  {kind === 'pickup_point' && pickupPoint && (
                    <div className="flex justify-between text-sm">
                      <span className="text-navy-500">Пункт выдачи</span>
                      <span className="font-medium text-navy-900 text-right max-w-[220px]">
                        {pickupPoint.name}
                        <span className="block text-xs font-normal text-navy-500">{pickupPoint.address}</span>
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-navy-500">Оплата</span>
                    <span className="font-medium text-navy-900">
                      {payment === 'card' ? 'Картой онлайн' : 'Наличными курьеру'}
                    </span>
                  </div>
                </div>

                {/* Товары */}
                <div className="flex flex-col gap-2 mb-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.productVariant.product.images?.[0] && (
                          <img src={item.productVariant.product.images[0]} alt={item.productVariant.product.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy-900 truncate">{item.productVariant.product.name}</p>
                        <p className="text-xs text-navy-500">{item.productVariant.weight} кг · {item.quantity} шт.</p>
                      </div>
                      <span className="text-sm font-bold text-navy-900 flex-shrink-0">
                        {formatPrice(item.productVariant.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Блок входа для гостей */}
                {!authLoggedIn && !legacyIsLoggedIn && (
                  <div className="mt-4 rounded-xl border border-line bg-blue-50 p-4 mb-5">
                    <p className="text-sm text-navy-700 mb-3">
                      Войдите, чтобы получить бонусы за заказ
                    </p>
                    <button
                      onClick={() => setLoginModalOpen(true)}
                      className="w-full btn-primary press-wide py-2">
                      Войти в аккаунт
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('payment')}
                    className="flex-1 border border-line text-navy-500 font-medium py-3 rounded-xl hover:bg-blue-50 transition-colors duration-100 ease text-sm">
                    Назад
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={placingOrder}
                    className="flex-[2] btn-primary press-wide py-3 disabled:opacity-60">
                    {placingOrder ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Оформляем...
                      </span>
                    ) : 'Оформить заказ'}
                  </button>
                </div>

                {orderError && (
                  <p className="text-center text-sm text-destructive mt-3">{orderError}</p>
                )}
                <p className="text-center text-xs text-navy-500 mt-3">
                  Нажимая кнопку, вы соглашаетесь с{' '}
                  <Link to="/offer" className="text-navy-700 hover:text-navy-500 transition-colors duration-100 ease">условиями оферты</Link>
                </p>
              </div>
            )}
          </div>

          {/* Правая часть — итого (sticky). На телефоне — первой: иначе
              «Оформить заказ» нажимается раньше, чем виден итог. */}
          <div className="lg:col-span-1 order-first lg:order-none">
            <div className="bg-white rounded-2xl p-5 sticky top-24">
              <h3 className="font-bold text-navy-900 mb-3">Ваш заказ</h3>

              <div className="flex flex-col gap-1.5 mb-3">
                {cartItems.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-navy-500 truncate mr-2">
                      {item.productVariant.product.name} ×{item.quantity}
                    </span>
                    <span className="text-navy-900 font-medium flex-shrink-0">
                      {formatPrice(item.productVariant.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-line pt-3 flex flex-col gap-1.5 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-navy-500">Доставка</span>
                  {deliveryCost > 0
                    ? <span className="text-navy-900 font-medium">{formatPrice(deliveryCost)}</span>
                    : <span className="text-success font-medium">Бесплатно</span>
                  }
                </div>
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-navy-500">Промокод</span>
                    <span className="text-amber-600 font-medium">−{formatPrice(promoDiscount)}</span>
                  </div>
                )}
                {bonusSpend && (
                  <div className="flex justify-between text-sm">
                    <span className="text-navy-500">Бонусы</span>
                    <span className="text-amber-600 font-medium">−{formatPrice(bonusDiscount)}</span>
                  </div>
                )}
                {cartItems.some(i => i.isSubscription) && (
                  <div className="mt-2 pt-2 border-t border-amber-100">
                    <p className="text-xs text-navy-500 leading-relaxed">Подписка: −7 % на отмеченные товары</p>
                  </div>
                )}
              </div>

              <div className="border-t border-line pt-3 flex justify-between mb-3">
                <span className="font-bold text-navy-900">Итого</span>
                <span className="font-black text-xl text-navy-900">{formatPrice(total)}</span>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-navy-600">
                За этот заказ вы получите <span className="font-bold text-amber-600">+{formatBonuses(bonusEarned)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Модальное окно входа */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-navy-900/40"
            onClick={() => setLoginModalOpen(false)}
            aria-hidden="true"
          />
          {/* Modal */}
          <div className="relative bg-white rounded-t-card md:rounded-card w-full md:max-w-sm p-6 md:p-8 shadow-lg max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-navy-400 hover:text-navy-700 transition-colors"
              aria-label="Закрыть">
              <CloseIcon className="w-5 h-5" />
            </button>
            <LoginForm
              onSuccess={(bonusGranted) => {
                setLoginModalOpen(false)
                // Перезагружаем данные пользователя и корзину после входа
                authApi.me().then(res => {
                  setUserBonusPoints(res.data.bonusPoints ?? 0)
                }).catch(() => {})
              }}
              hideWelcomeBonus
            />
          </div>
        </div>
      )}
    </div>
  )
}
