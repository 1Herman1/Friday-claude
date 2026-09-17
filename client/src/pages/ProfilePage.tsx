import { useState, useEffect } from 'react'
import { LOYALTY_STYLE, LOYALTY_CURRENT_MARK } from '../lib/loyalty-style'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, ordersApi, usersApi, bonusesApi, subscriptionsApi, type User, type Order, type BonusTransaction, type Subscription } from '../lib/api'
import { formatPrice, formatBonuses } from '../lib/format'
import { CheckIcon, StepCurrentIcon, StepPendingIcon, ChevronDownIcon } from '../components/icons'
import { LOYALTY_TIERS, subscriptionPrice, type BonusLevel } from '@simba/shared'
import LoginForm from '../components/auth/LoginForm'
import { useAuth } from '../context/AuthContext'

type OrderStatus = 'new' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled'

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  in_transit: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-400',
  confirmed: 'bg-amber-100 text-amber-600',
  in_transit: 'bg-purple-100 text-purple-600',
  delivered: 'bg-green-100 text-success',
  cancelled: 'bg-red-100 text-red-500',
}

const STATUS_STEPS: OrderStatus[] = ['new', 'confirmed', 'in_transit', 'delivered']

// Шкала нагрева: холод → тепло → жар

type Tab = 'orders' | 'bonuses' | 'subscriptions' | 'settings'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [tab, setTab] = useState<Tab>('orders')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all')
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [bonusTransactions, setBonusTransactions] = useState<BonusTransaction[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingBonuses, setLoadingBonuses] = useState(false)
  const [bonusesError, setBonusesError] = useState<string | null>(null)
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<string | null>(null)
  const [editingIntervalWeeks, setEditingIntervalWeeks] = useState(2)
  const [editingNextDate, setEditingNextDate] = useState('')
  const [pendingSubscriptionId, setPendingSubscriptionId] = useState<string | null>(null)
  const [subscriptionActionError, setSubscriptionActionError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [deletionCodeSent, setDeletionCodeSent] = useState(false)
  const [deletionCode, setDeletionCode] = useState('')
  const [verifyingDeletion, setVerifyingDeletion] = useState(false)

  async function runSubscriptionAction(id: string, action: () => Promise<unknown>) {
    setPendingSubscriptionId(id)
    setSubscriptionActionError(null)
    try {
      await action()
      const res = await subscriptionsApi.list()
      setSubscriptions(res.data)
      setEditingSubscription(null)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setSubscriptionActionError(
        status === 404
          ? 'Подписка уже отменена или не найдена'
          : status === 403
          ? 'Нет доступа к этой подписке'
          : 'Не удалось выполнить действие, попробуйте ещё раз'
      )
    } finally {
      setPendingSubscriptionId(null)
    }
  }

  async function handleExport() {
    setExporting(true)
    setDataError(null)
    try {
      const res = await authApi.exportMe()
      const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      a.href = url
      a.download = `simba-data-${dateStr}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setDataError('Не удалось скачать данные. Попробуйте ещё раз.')
    } finally {
      setExporting(false)
    }
  }

  async function handleRequestDeleteCode() {
    if (!confirm('Удалить аккаунт? Контакты, адреса, питомцы и подписки будут стёрты, заказы останутся без ваших данных. Отменить это нельзя.')) {
      return
    }
    setDeleting(true)
    setDataError(null)
    setDeletionCode('')
    try {
      await authApi.requestDeleteCode()
      setDeletionCodeSent(true)
    } catch (err) {
      setDataError('Не удалось отправить код. Попробуйте ещё раз.')
      setDeleting(false)
    }
  }

  async function handleConfirmDeleteAccount() {
    if (!deletionCode.trim()) {
      setDataError('Введите код из письма')
      return
    }
    setVerifyingDeletion(true)
    setDataError(null)
    try {
      await authApi.deleteMe(deletionCode)
      logout()
      navigate('/')
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 400) {
        setDataError('Неверный или просроченный код')
      } else if (status === 429) {
        setDataError('Слишком много попыток. Попробуйте через 15 минут.')
      } else {
        setDataError('Не удалось удалить аккаунт. Попробуйте ещё раз.')
      }
      setVerifyingDeletion(false)
    }
  }

  function handleCancelDeletion() {
    setDeletionCodeSent(false)
    setDeletionCode('')
    setDeleting(false)
    setDataError(null)
  }

  useEffect(() => {
    authApi.me()
      .then(res => {
        setUser(res.data)
        setProfileForm({
          name: res.data.name ?? '',
          phone: res.data.phone ?? '',
          email: res.data.email ?? '',
        })
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => setLoadingUser(false))
    ordersApi.list()
      .then(res => setOrders(res.data))
      .catch(() => setOrders([]))
  }, [])

  // Загружаем историю бонусов когда переходим на таб "bonuses"
  useEffect(() => {
    if (tab !== 'bonuses') return
    setLoadingBonuses(true)
    setBonusesError(null)
    bonusesApi.transactions()
      .then(res => setBonusTransactions(res.data))
      .catch(() => setBonusesError('Не удалось загрузить историю'))
      .finally(() => setLoadingBonuses(false))
  }, [tab])

  // Загружаем подписки когда переходим на таб "subscriptions"
  useEffect(() => {
    if (tab !== 'subscriptions') return
    setLoadingSubscriptions(true)
    setSubscriptionsError(null)
    subscriptionsApi.list()
      .then(res => setSubscriptions(res.data))
      .catch(() => setSubscriptionsError('Не удалось загрузить подписки'))
      .finally(() => setLoadingSubscriptions(false))
  }, [tab])

  const currentLevelTier = LOYALTY_TIERS.find(t => (user?.bonusLevel ?? 'newcomer') === t.key) ?? LOYALTY_TIERS[0]
  const nextLevelTier = LOYALTY_TIERS.find(t => t.minPoints > currentLevelTier.minPoints)
  const bonusPoints = user?.bonusPoints ?? 0
  const progressToNext = nextLevelTier
    ? Math.min(100, ((bonusPoints - currentLevelTier.minPoints) / (nextLevelTier.minPoints - currentLevelTier.minPoints)) * 100)
    : 100

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus)

  if (loadingUser) {
    return (
      <div className="min-h-[100dvh] bg-blue-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Гостевая сессия — это настоящая учётная запись с именем «Гость»
  // (server/src/routes/auth/guest-session.ts:33), поэтому раньше профиль
  // рисовал её как свою и войти было неоткуда. Признак isGuest приходит
  // из /auth/me по типу токена.
  if (!user || user.isGuest) {
    return (
      <div className="min-h-[100dvh] bg-blue-50">
        <div className="max-w-md mx-auto px-4 py-10 md:py-20">
          <div className="bg-white rounded-2xl p-6 mb-4">
            {/* Своего заголовка страница не ставит: он есть у формы, а два
                подряд читались бы как ошибка вёрстки. */}
            <p className="text-sm text-navy-500 mb-6">
              Войдите, чтобы управлять заказами, следить за бонусами и хранить адреса доставки.
            </p>
            <LoginForm />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Шапка профиля */}
        <div className="bg-white rounded-2xl p-5 mb-4 flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-navy-900 truncate">{user?.name ?? '—'}</h1>
            <p className="text-sm text-navy-400 truncate">{user?.phone ?? user?.email ?? '—'}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ${LOYALTY_STYLE[user?.bonusLevel ?? 'newcomer']}`}>
            {currentLevelTier.label}
          </span>
        </div>

        {/* Табы */}
        <div className="flex bg-white rounded-2xl p-1 mb-4 gap-1">
          {([
            { key: 'orders', label: 'Заказы' },
            { key: 'bonuses', label: 'Бонусы' },
            { key: 'subscriptions', label: 'Подписки' },
            { key: 'settings', label: 'Настройки' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-100 ease ${
                tab === t.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-navy-400 hover:text-navy-700'
              }`}>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── ЗАКАЗЫ ── */}
        {tab === 'orders' && (
          <div>
            {/* Фильтр по статусу */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
              {([
                { value: 'all', label: 'Все' },
                { value: 'in_transit', label: 'В пути' },
                { value: 'delivered', label: 'Доставлены' },
                { value: 'new', label: 'Новые' },
                { value: 'cancelled', label: 'Отменены' },
              ] as { value: OrderStatus | 'all'; label: string }[]).map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilterStatus(f.value)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                    filterStatus === f.value
                      ? 'bg-blue-200 text-navy-900'
                      : 'bg-white text-navy-500 hover:bg-blue-50'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center">
                <p className="text-navy-400">Заказов не найдено</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {filteredOrders.map(order => {
                const isExpanded = expandedOrder === order.id
                const stepIndex = STATUS_STEPS.indexOf(order.status)
                const dateStr = new Date(order.createdAt).toLocaleDateString('ru-RU')

                return (
                  <div key={order.id} className="bg-white rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="w-full px-5 py-4 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-navy-900 text-sm">#{order.id.slice(-6).toUpperCase()}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status]}`}>
                            {STATUS_LABEL[order.status]}
                          </span>
                        </div>
                        <p className="text-xs text-navy-400">{dateStr} · {order.deliveryMethod}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-navy-900">{formatPrice(order.total)}</p>
                        {order.bonusEarned > 0 && (
                          <p className="text-xs text-amber-500">+{formatBonuses(order.bonusEarned)}</p>
                        )}
                      </div>
                      <ChevronDownIcon open={isExpanded} className="flex-shrink-0 text-navy-300 w-4 h-4" />
                    </button>

                    {/* Раскрытый блок */}
                    {isExpanded && (
                      <div className="border-t border-blue-50 px-5 py-4">

                        {/* Прогресс доставки */}
                        {order.status !== 'cancelled' && (
                          <div className="mb-5">
                            <div className="relative flex items-center justify-between mb-2">
                              {STATUS_STEPS.map((s, i) => (
                                <div key={s} className="flex flex-col items-center flex-1">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-colors duration-100 ease ${
                                    i <= stepIndex
                                      ? 'bg-primary text-white'
                                      : 'bg-primary-tint text-navy-500'
                                  }`}>
                                    {i < stepIndex ? (
                                      <CheckIcon className="w-4 h-4" />
                                    ) : i === stepIndex ? (
                                      <StepCurrentIcon className="w-4 h-4" />
                                    ) : (
                                      <StepPendingIcon className="w-4 h-4" />
                                    )}
                                  </div>
                                  <span className="text-[10px] text-navy-400 mt-1 text-center leading-tight">
                                    {STATUS_LABEL[s]}
                                  </span>
                                </div>
                              ))}
                              {/* Линии между шагами */}
                              <div className="absolute top-3.5 left-0 right-0 flex px-3.5">
                                {STATUS_STEPS.slice(0, -1).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`flex-1 h-0.5 transition-colors duration-100 ease ${i < stepIndex ? 'bg-primary' : 'bg-line'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Товары */}
                        <div className="flex flex-col gap-2 mb-4">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 rounded-lg flex-shrink-0">
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-navy-900 font-medium truncate">{item.productName}</p>
                                <p className="text-xs text-navy-400">{item.variantWeight} кг · {item.quantity} шт.</p>
                              </div>
                              <span className="text-sm font-semibold text-navy-900 flex-shrink-0">
                                {formatPrice(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Кнопки */}
                        <div className="flex gap-2 flex-wrap">
                          {order.status === 'delivered' && (
                            <button className="flex-1 btn-primary py-2">
                              Повторить заказ
                            </button>
                          )}
                          <button className="flex-1 border border-line text-navy-500 font-medium py-2 rounded-xl text-sm hover:bg-blue-50 transition-colors duration-100 ease">
                            Детали заказа
                          </button>
                          {(order.status === 'new' || order.status === 'confirmed') && (
                            <button className="flex-1 border border-red-100 text-red-400 font-medium py-2 rounded-xl text-sm hover:bg-red-50 transition-colors">
                              Отменить
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SCOINS ── */}
        {tab === 'bonuses' && (
          <div className="flex flex-col gap-4">
            {/* Баланс */}
            <div className="bg-white rounded-2xl p-6 text-center">
              <p className="text-sm text-navy-400 mb-1">Ваш счёт бонусов</p>
              <p className="text-5xl font-black text-amber-400 mb-1">{bonusPoints.toLocaleString('ru-RU')}</p>
              <p className="text-sm text-navy-400">бонусов · 1 бонус = 1 ₽</p>
            </div>

            {/* Уровень */}
            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-navy-900">Уровень</h3>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${LOYALTY_STYLE[user?.bonusLevel ?? 'newcomer']}`}>
                  {currentLevelTier.label}
                </span>
              </div>
              {nextLevelTier && (
                <>
                  <div className="h-2 bg-blue-50 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-amber-400 rounded-full origin-left transition-transform duration-300"
                      style={{ transform: `scaleX(${progressToNext / 100})` }}
                    />
                  </div>
                  <p className="text-xs text-navy-400">
                    До уровня <span className="font-semibold text-navy-700">«{nextLevelTier.label}»</span>:{' '}
                    {formatBonuses(Math.max(0, nextLevelTier.minPoints - bonusPoints))}
                  </p>
                </>
              )}

              <div className="grid grid-cols-3 gap-2 mt-4">
                {/* Градус показываем у всех трёх ступеней, как в корзине: иначе
                    лестница видна только на своей клетке и подниматься некуда. */}
                {LOYALTY_TIERS.map((tier) => {
                  const isCurrentLevel = user?.bonusLevel === tier.key
                  return (
                    <div
                      key={tier.key}
                      className={`rounded-xl p-3 text-center ${LOYALTY_STYLE[tier.key]} ${
                        isCurrentLevel ? LOYALTY_CURRENT_MARK : 'opacity-60'
                      }`}>
                      <p className="text-xs font-bold">{tier.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* История бонусов */}
            <div className="bg-white rounded-2xl p-5">
              <h3 className="font-bold text-navy-900 mb-3">История операций</h3>

              {loadingBonuses && (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin w-6 h-6 text-navy-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              )}

              {!loadingBonuses && bonusesError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                  <p className="text-sm text-red-600">{bonusesError}</p>
                </div>
              )}

              {!loadingBonuses && !bonusesError && bonusTransactions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-navy-500 mb-3">Операций с бонусами пока нет</p>
                  <Link to="/" className="inline-block text-navy-700 font-medium text-sm hover:text-primary-hover transition-colors duration-100 ease">
                    Перейти в каталог
                  </Link>
                </div>
              )}

              {!loadingBonuses && !bonusesError && bonusTransactions.length > 0 && (
                <div className="divide-y divide-line">
                  {bonusTransactions.map(tx => {
                    const typeLabels: Record<string, string> = {
                      welcome: 'Приветственные бонусы',
                      earned: 'Начислено за заказ',
                      spent: 'Списано при оформлении',
                      refund_used: 'Возврат при отмене заказа',
                      revoke_earned: 'Снятие начисления за отменённый заказ',
                      admin_adjust: 'Корректировка',
                    }

                    const date = new Date(tx.createdAt)
                    const dateStr = date.toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
                    })
                    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

                    const isIncome = tx.amount > 0
                    const amountDisplay = (isIncome ? '+' : '') + tx.amount

                    return (
                      <div key={tx.id} className="flex items-center justify-between py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-navy-900 font-medium">
                            {typeLabels[tx.type] || tx.type}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-navy-400">{dateStr}, {timeStr}</p>
                            {tx.orderId && (
                              <Link
                                to="#"
                                className="text-xs text-navy-700 hover:text-primary-hover transition-colors duration-100 ease">
                                #{tx.orderId.slice(-6).toUpperCase()}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className={`text-sm font-bold tabular-nums ${
                            isIncome ? 'text-navy-900' : 'text-navy-500'
                          }`}>
                            {amountDisplay} бонусов
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ПОДПИСКИ ── */}
        {tab === 'subscriptions' && (
          <div className="flex flex-col gap-4">
            {loadingSubscriptions && (
              <div className="bg-white rounded-2xl p-10 flex items-center justify-center">
                <svg className="animate-spin w-6 h-6 text-navy-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            )}

            {!loadingSubscriptions && subscriptionsError && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
                <p className="text-sm text-red-600">{subscriptionsError}</p>
              </div>
            )}

            {subscriptionActionError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <p className="text-sm text-red-600">{subscriptionActionError}</p>
              </div>
            )}

            {!loadingSubscriptions && !subscriptionsError && (
              <div className="bg-white border border-line rounded-card p-4 mb-4">
                <p className="text-xs text-navy-500 leading-relaxed">
                  Подписка — это скидка 7 % на выбранный корм и напоминание о следующей покупке раз в выбранный интервал. Мы свяжемся с вами перед доставкой, чтобы подтвердить заказ. Изменить интервал, поставить на паузу или отменить можно в любой момент.
                </p>
              </div>
            )}

            {!loadingSubscriptions && !subscriptionsError && subscriptions.length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center">
                <p className="text-navy-500 mb-3">У вас ещё нет активных подписок</p>
                <Link to="/catalog" className="inline-block btn-primary px-6 py-2">
                  Перейти в каталог
                </Link>
              </div>
            )}

            {!loadingSubscriptions && !subscriptionsError && subscriptions.length > 0 && (
              <div className="flex flex-col gap-3">
                {subscriptions.map(sub => {
                  const intervalWeeks = Math.round(sub.intervalDays / 7)
                  const nextDate = new Date(sub.nextDeliveryAt)
                  const dateStr = nextDate.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: nextDate.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
                  })

                  const isEditing = editingSubscription === sub.id

                  return (
                    <div key={sub.id} className="bg-white rounded-2xl p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-16 h-16 bg-blue-50 rounded-xl flex-shrink-0 flex items-center justify-center">
                          {sub.product?.images?.[0] ? (
                            <img src={sub.product.images[0]} alt="" className="max-h-full max-w-full object-contain p-1" />
                          ) : (
                            <span className="text-2xl">🐾</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-navy-900 mb-1">{sub.product?.name ?? 'Товар'}</h4>
                          <p className="text-sm text-navy-500 mb-2">
                            {intervalWeeks} недель · Следующая доставка {dateStr}
                          </p>
                          {sub.productVariant && (
                            <p className="text-sm font-semibold text-navy-900">
                              {formatPrice(subscriptionPrice(sub.productVariant.price))}
                            </p>
                          )}
                          <p className="text-xs text-navy-400">{sub.deliveryMethod}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                          sub.isPaused ? 'bg-red-100 text-red-600' : 'bg-green-100 text-success'
                        }`}>
                          {sub.isPaused ? 'Пауза' : 'Активна'}
                        </span>
                      </div>

                      {/* Редактирование */}
                      {isEditing && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-xl flex flex-col gap-2">
                          <label className="text-xs text-navy-500 font-medium">Интервал доставки</label>
                          <div className="flex gap-2">
                            {[2, 4, 6, 8].map(weeks => (
                              <button
                                key={weeks}
                                onClick={() => setEditingIntervalWeeks(weeks)}
                                className={`flex-1 text-xs px-2 py-1.5 rounded-lg border ${
                                  editingIntervalWeeks === weeks
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-white border-line text-navy-500 hover:border-primary'
                                }`}>
                                {weeks}н
                              </button>
                            ))}
                          </div>

                          <label className="text-xs text-navy-500 font-medium mt-2">Дата следующей доставки</label>
                          <input
                            type="date"
                            value={editingNextDate}
                            onChange={e => setEditingNextDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />

                          <div className="flex gap-2 mt-2">
                            <button
                              disabled={pendingSubscriptionId === sub.id}
                              onClick={() =>
                                runSubscriptionAction(sub.id, () =>
                                  subscriptionsApi.update(sub.id, {
                                    intervalDays: editingIntervalWeeks * 7,
                                    nextDeliveryAt: editingNextDate ? new Date(editingNextDate).toISOString() : undefined,
                                  })
                                )
                              }
                              className="flex-1 bg-primary text-white text-xs py-1.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                              {pendingSubscriptionId === sub.id ? 'Сохранение…' : 'Сохранить'}
                            </button>
                            <button
                              disabled={pendingSubscriptionId === sub.id}
                              onClick={() => setEditingSubscription(null)}
                              className="flex-1 bg-blue-50 text-navy-700 text-xs py-1.5 rounded-lg font-medium hover:bg-blue-100 disabled:opacity-50">
                              Отменить
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Кнопки действий */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={pendingSubscriptionId === sub.id}
                          onClick={() =>
                            runSubscriptionAction(sub.id, () =>
                              subscriptionsApi.update(sub.id, { isPaused: !sub.isPaused })
                            )
                          }
                          className="flex-1 text-xs py-2 rounded-lg border border-primary text-primary-hover font-medium hover:bg-blue-50 disabled:opacity-50">
                          {sub.isPaused ? 'Возобновить' : 'Пауза'}
                        </button>

                        <button
                          disabled={pendingSubscriptionId === sub.id}
                          onClick={() => runSubscriptionAction(sub.id, () => subscriptionsApi.skip(sub.id))}
                          className="flex-1 text-xs py-2 rounded-lg border border-line text-navy-700 font-medium hover:bg-blue-50 disabled:opacity-50">
                          Пропустить
                        </button>

                        <button
                          disabled={pendingSubscriptionId === sub.id}
                          onClick={() => {
                            setSubscriptionActionError(null)
                            setEditingSubscription(sub.id)
                            setEditingIntervalWeeks(intervalWeeks)
                            setEditingNextDate(sub.nextDeliveryAt.split('T')[0])
                          }}
                          className="flex-1 text-xs py-2 rounded-lg border border-line text-navy-700 font-medium hover:bg-blue-50 disabled:opacity-50">
                          Изменить
                        </button>

                        <button
                          disabled={pendingSubscriptionId === sub.id}
                          onClick={() => {
                            if (confirm('Вы уверены, что хотите отменить подписку?')) {
                              runSubscriptionAction(sub.id, () => subscriptionsApi.cancel(sub.id))
                            }
                          }}
                          className="flex-1 text-xs py-2 rounded-lg border border-red-100 text-red-400 font-medium hover:bg-red-50 disabled:opacity-50">
                          {pendingSubscriptionId === sub.id ? 'Отмена…' : 'Отменить подписку'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── НАСТРОЙКИ ── */}
        {tab === 'settings' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-5">
              <h3 className="font-bold text-navy-900 mb-4">Личные данные</h3>
              <div className="flex flex-col gap-3">
                {([
                  { label: 'Имя', key: 'name' },
                  { label: 'Телефон', key: 'phone' },
                  { label: 'Email', key: 'email' },
                ] as { label: string; key: keyof typeof profileForm }[]).map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-navy-400 block mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={profileForm[field.key]}
                      onChange={e => setProfileForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-line text-sm text-navy-900 focus:outline-none focus:border-line focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                ))}
                {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                {saveSuccess && <p className="text-xs text-success">Данные сохранены</p>}
                <button
                  disabled={savingProfile}
                  onClick={async () => {
                    setSavingProfile(true)
                    setSaveError(null)
                    setSaveSuccess(false)
                    try {
                      const res = await usersApi.updateProfile(profileForm)
                      setUser(res.data)
                      setSaveSuccess(true)
                    } catch {
                      setSaveError('Не удалось сохранить. Попробуйте ещё раз.')
                    } finally {
                      setSavingProfile(false)
                    }
                  }}
                  className="btn-primary py-2.5 mt-1 disabled:opacity-50">
                  {savingProfile ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5">
              <h3 className="font-bold text-navy-900 mb-3">Мои данные</h3>
              <p className="text-sm text-navy-500 mb-4 leading-relaxed">
                Скачайте копию всех данных, которые мы о вас храним, или удалите аккаунт. Подробнее в <Link to="/privacy" className="text-primary-hover font-medium underline underline-offset-2">политике конфиденциальности</Link>.
              </p>
              <div className="flex flex-col gap-2 mb-3">
                <button
                  disabled={exporting}
                  onClick={handleExport}
                  className="btn-outline rounded-xl py-2.5">
                  {exporting ? 'Скачивание...' : 'Скачать мои данные (JSON)'}
                </button>
                {!deletionCodeSent ? (
                  <button
                    disabled={deleting}
                    onClick={handleRequestDeleteCode}
                    className="border-destructive/40 text-destructive font-medium py-2.5 rounded-xl text-sm hover:bg-destructive/5 transition-colors border disabled:opacity-50 btn-outline">
                    {deleting ? 'Отправка...' : 'Удалить аккаунт'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="deletion-code" className="text-xs text-navy-400 block mb-1">
                        Код из письма
                      </label>
                      <p className="text-xs text-navy-500 mb-2">
                        Мы отправили код на {user?.email}
                      </p>
                      <input
                        id="deletion-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={deletionCode}
                        onChange={e => setDeletionCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full px-4 py-2.5 rounded-xl border border-line text-sm text-navy-900 focus:outline-none focus:border-line focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={verifyingDeletion}
                        onClick={handleConfirmDeleteAccount}
                        className="flex-1 bg-destructive text-white font-medium py-2.5 rounded-xl text-sm hover:opacity-90 transition-colors disabled:opacity-50">
                        {verifyingDeletion ? 'Удаление...' : 'Подтвердить удаление'}
                      </button>
                      <button
                        disabled={verifyingDeletion}
                        onClick={handleCancelDeletion}
                        className="flex-1 bg-white text-navy-500 font-medium py-2.5 rounded-xl text-sm hover:bg-blue-50 transition-colors border border-line disabled:opacity-50">
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {dataError && <p role="alert" className="text-xs text-destructive">{dataError}</p>}
            </div>

            <button
              onClick={() => { logout(); navigate('/auth') }}
              className="btn-outline rounded-xl w-full py-3 mt-6">
              Выйти из аккаунта
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
