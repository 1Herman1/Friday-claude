import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersApi, type UserDetail } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { LOYALTY_TIERS } from '@simba/shared'

const BONUS_TX_TYPE_LABELS: Record<string, string> = {
  welcome: 'Приветственные',
  earned: 'Начисление за заказ',
  spent: 'Списание',
  refund_used: 'Возврат списанных',
  revoke_earned: 'Отмена начисления',
  admin_adjust: 'Корректировка админом',
  quiz: 'За подбор',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Картой',
  cash_on_delivery: 'Наличными',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  in_transit: 'В доставке',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'В ожидании',
  paid: 'Оплачено',
  failed: 'Ошибка',
  refunded: 'Возвращено',
}

function getLevelLabel(key: string): string {
  const tier = LOYALTY_TIERS.find(t => t.key === key)
  return tier ? tier.label : key
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [activeModalType, setActiveModalType] = useState<'block' | 'unblock' | 'bonus' | null>(null)
  const [bonusForm, setBonusForm] = useState({ amount: '', comment: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!id) return
    usersApi.byId(id)
      .then(r => setDetail(r.data))
      .catch(err => {
        const msg = err.response?.data?.error || 'Ошибка загрузки'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSetActive = async (isActive: boolean) => {
    if (!detail) return
    setUpdating(true)
    setError('')
    setSuccess('')
    try {
      const res = await usersApi.setActive(detail.user.id, isActive)
      setDetail(prev => prev ? {
        ...prev,
        user: { ...prev.user, isActive: res.data.isActive },
      } : null)
      setSuccess(isActive ? 'Пользователь разблокирован' : 'Пользователь заблокирован')
      setActiveModalType(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка')
    } finally {
      setUpdating(false)
    }
  }

  const handleAdjustBonus = async () => {
    if (!detail || !bonusForm.amount || !bonusForm.comment.trim()) {
      setError('Заполните все поля')
      return
    }
    setUpdating(true)
    setError('')
    setSuccess('')
    try {
      const res = await usersApi.adjustBonus(detail.user.id, parseInt(bonusForm.amount), bonusForm.comment)
      setDetail(prev => prev ? {
        ...prev,
        user: { ...prev.user, bonusPoints: res.data.balanceAfter, bonusLevel: res.data.bonusLevel },
      } : null)
      setSuccess(`Баланс обновлён до ${res.data.balanceAfter}`)
      setBonusForm({ amount: '', comment: '' })
      setActiveModalType(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Пользователь не найден'}</p>
          <button
            onClick={() => navigate('/users')}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Вернуться к списку
          </button>
        </div>
      </div>
    )
  }

  const { user, stats, orders, bonusTransactions, addresses, pets, subscriptions } = detail

  return (
    <div className="p-8">
      {/* Header with info */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/users')}
          className="text-blue-600 hover:text-blue-700 mb-4 font-medium"
        >
          ← Вернуться
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{user.name || 'Безымянный'}</h1>
            <p className="text-gray-500 font-mono text-sm">{user.id}</p>
          </div>

          <div className="flex gap-2">
            {user.isGuest && <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">Гость</span>}
            {!user.isActive && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm">Заблокирован</span>}
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Email</p>
          <p className="font-medium text-gray-900">{user.email || '—'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Телефон</p>
          <p className="font-medium text-gray-900">{user.phone || '—'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Роль</p>
          <p className="font-medium text-gray-900">
            {user.role === 'customer' ? 'Покупатель' : user.role}
          </p>
        </div>
      </div>

      {/* Dates and Bonus */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Создан</p>
          <p className="font-medium text-gray-900">{new Date(user.createdAt).toLocaleDateString('ru-RU')}</p>
          <p className="text-xs text-gray-500">{new Date(user.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Последняя активность</p>
          {user.lastSeenAt ? (
            <>
              <p className="font-medium text-gray-900">{new Date(user.lastSeenAt).toLocaleDateString('ru-RU')}</p>
              <p className="text-xs text-gray-500">{new Date(user.lastSeenAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
            </>
          ) : (
            <p className="text-gray-400">—</p>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Бонусы</p>
          <p className="font-medium text-amber-600 text-lg">{user.bonusPoints}</p>
          <p className="text-xs text-gray-500">{getLevelLabel(user.bonusLevel)}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        {user.isActive ? (
          <button
            onClick={() => setActiveModalType('block')}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium"
          >
            Заблокировать
          </button>
        ) : (
          <button
            onClick={() => setActiveModalType('unblock')}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium"
          >
            Разблокировать
          </button>
        )}

        <button
          onClick={() => setActiveModalType('bonus')}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
        >
          Начислить/списать бонусы
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Заказов</p>
          <p className="text-2xl font-bold text-gray-900">{stats.ordersCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Оплачено</p>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.paidTotal)}</p>
          <p className="text-xs text-gray-500">оплачено {stats.paidOrdersCount} заказов</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">В корзине / Избранное</p>
          <p className="text-2xl font-bold text-gray-900">{stats.cartItems} / {stats.favoritesCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Подборы</p>
          <p className="text-2xl font-bold text-gray-900">{stats.quizSessions}</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Заказы (последние 50)</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Заказов нет</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Оплата</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Метод</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Сумма</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Позиций</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Дата</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-blue-600 font-mono text-xs">{order.id.slice(-8)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_STYLE[order.status] || ''}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatPrice(order.total)}</td>
                    <td className="px-4 py-3 text-center">{order.items?.length ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bonus Transactions */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">История бонусов (последние 100)</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {bonusTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Операций нет</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Тип</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Сумма</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Баланс</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Комментарий</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Дата</th>
                </tr>
              </thead>
              <tbody>
                {bonusTransactions.map((tx, idx) => (
                  <tr key={`${tx.createdAt}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-medium">
                      {BONUS_TX_TYPE_LABELS[tx.type] || tx.type}
                    </td>
                    <td className={`px-4 py-3 font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="px-4 py-3 font-medium">{tx.balanceAfter}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{tx.comment || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(tx.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Addresses */}
      {addresses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Адреса ({addresses.length})</h2>
          <div className="grid grid-cols-2 gap-4">
            {addresses.map(addr => (
              <div key={addr.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="font-medium text-gray-900">{addr.label}</p>
                <p className="text-sm text-gray-600">{addr.city}, {addr.street} {addr.house}</p>
                {addr.apartment && <p className="text-sm text-gray-600">кв. {addr.apartment}</p>}
                <p className="text-xs text-gray-500 mt-1">{addr.postalCode}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pets */}
      {pets.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Питомцы ({pets.length})</h2>
          <div className="grid grid-cols-2 gap-4">
            {pets.map(pet => (
              <div key={pet.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="font-medium text-gray-900">{pet.name}</p>
                <p className="text-sm text-gray-600">{pet.species} {pet.breed ? `• ${pet.breed}` : ''}</p>
                {pet.birthDate && <p className="text-xs text-gray-500 mt-1">{new Date(pet.birthDate).toLocaleDateString('ru-RU')}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Подписки ({subscriptions.length})</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Товар</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Фасовка</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(sub => (
                  <tr key={sub.id} className="border-b border-gray-50">
                    <td className="px-4 py-3">{sub.product.name}</td>
                    <td className="px-4 py-3 text-gray-600">{sub.variant.weight} г</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block/Unblock Modal */}
      {activeModalType === 'block' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Заблокировать пользователя?</h3>
            <p className="text-gray-600 mb-6">После блокировки пользователь не сможет войти в аккаунт.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveModalType(null)}
                disabled={updating}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={() => handleSetActive(false)}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {updating ? 'Загрузка...' : 'Заблокировать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Modal */}
      {activeModalType === 'unblock' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Разблокировать пользователя?</h3>
            <p className="text-gray-600 mb-6">Пользователь получит доступ к своему аккаунту.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveModalType(null)}
                disabled={updating}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={() => handleSetActive(true)}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {updating ? 'Загрузка...' : 'Разблокировать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus Modal */}
      {activeModalType === 'bonus' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Корректировка бонусов</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Сумма (со знаком)</label>
              <input
                type="number"
                value={bonusForm.amount}
                onChange={e => setBonusForm(prev => ({ ...prev, amount: e.target.value }))}
                disabled={updating}
                placeholder="100 или -50"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Причина</label>
              <textarea
                value={bonusForm.comment}
                onChange={e => setBonusForm(prev => ({ ...prev, comment: e.target.value }))}
                disabled={updating}
                placeholder="Опишите причину корректировки"
                maxLength={200}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">{bonusForm.comment.length}/200</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveModalType(null)}
                disabled={updating}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleAdjustBonus}
                disabled={updating || !bonusForm.amount || !bonusForm.comment.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {updating ? 'Загрузка...' : 'Применить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
