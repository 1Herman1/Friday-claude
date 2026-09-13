import { useEffect, useState } from 'react'
import { usersApi, type User } from '../../lib/api'
import { LOYALTY_TIERS } from '@simba/shared'

const ROLES = ['customer', 'products_manager', 'orders_manager', 'super_admin']

function getLevelLabel(levelKey: string): string {
  const tier = LOYALTY_TIERS.find(t => t.key === levelKey)
  return tier ? tier.label : levelKey
}

const ROLE_LABEL: Record<string, string> = {
  customer: 'Покупатель',
  products_manager: 'Менеджер товаров',
  orders_manager: 'Менеджер заказов',
  super_admin: 'Супер-админ',
}

const ROLE_STYLE: Record<string, string> = {
  customer: 'bg-gray-100 text-gray-600',
  products_manager: 'bg-blue-100 text-blue-700',
  orders_manager: 'bg-purple-100 text-purple-700',
  super_admin: 'bg-red-100 text-red-700',
}

type TabType = 'registered' | 'guests' | 'all'
type SortType = 'lastSeen' | 'created' | 'orders'

const SORT_LABELS: Record<SortType, string> = {
  lastSeen: 'По активности',
  created: 'По дате регистрации',
  orders: 'По числу заказов',
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [tab, setTab] = useState<TabType>('all')
  const [sort, setSort] = useState<SortType>('lastSeen')

  const load = (p = page, s = search, t = tab, so = sort) => {
    setLoading(true)
    const params: Record<string, unknown> = { page: p, limit: 20, type: t, sort: so }
    if (s) params.search = s
    usersApi.list(params)
      .then(r => { setUsers(r.data.items); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1, search, tab, sort) }, 300)
    return () => clearTimeout(t)
  }, [search, tab, sort])

  useEffect(() => { load(page, search, tab, sort) }, [page])

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdatingId(userId)
    try {
      await usersApi.updateRole(userId, role)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    } finally { setUpdatingId(null) }
  }

  const handleResetPassword = async (userId: string) => {
    if (!resetPasswordValue.trim()) {
      setResetMessage({ type: 'error', text: 'Введите новый пароль' })
      return
    }

    if (resetPasswordValue.length < 8) {
      setResetMessage({ type: 'error', text: 'Пароль минимум 8 символов' })
      return
    }

    setUpdatingId(userId)
    try {
      await usersApi.resetPassword(userId, resetPasswordValue)
      setResetMessage({ type: 'success', text: 'Пароль успешно сброшен' })
      setResetPasswordId(null)
      setResetPasswordValue('')
    } catch (err: any) {
      const errorText = err.response?.data?.error || 'Ошибка при сбросе пароля'
      setResetMessage({ type: 'error', text: errorText })
    } finally {
      setUpdatingId(null)
    }
  }

  const totalPages = Math.ceil(total / 20)
  const tabLabel = { registered: 'Пользователи', guests: 'Гости с действиями', all: 'Все' }[tab]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {tabLabel} <span className="text-gray-400 font-normal text-base">({total})</span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['registered', 'guests', 'all'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1) }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              tab === t
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tabLabel === { registered: 'Пользователи', guests: 'Гости с действиями', all: 'Все' }[t]
              ? { registered: 'Пользователи', guests: 'Гости с действиями', all: 'Все' }[t]
              : 'Tab'}
          </button>
        ))}
      </div>

      {/* Search and Sort */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени, email, телефону..."
          className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortType)}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          {(Object.entries(SORT_LABELS) as [SortType, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Пользователь</th>
                  <th className="px-5 py-3 font-medium">Контакт</th>
                  <th className="px-5 py-3 font-medium">Последняя активность</th>
                  <th className="px-5 py-3 font-medium">Корзина</th>
                  <th className="px-5 py-3 font-medium">Избранное</th>
                  <th className="px-5 py-3 font-medium">Подборы</th>
                  <th className="px-5 py-3 font-medium">Заказов</th>
                  <th className="px-5 py-3 font-medium">Бонусы</th>
                  <th className="px-5 py-3 font-medium">Роль</th>
                  <th className="px-5 py-3 font-medium">Дата</th>
                  <th className="px-5 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{user.name || '—'}</p>
                      <p className="text-xs text-gray-400 font-mono">{user.id.slice(-8)}</p>
                      {user.isGuest && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded inline-block mt-1">
                          гость
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <p>{user.email || '—'}</p>
                      <p className="text-xs text-gray-400">{user.phone || ''}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {new Date(user.lastSeenAt).toLocaleDateString('ru-RU')}
                      <p className="text-xs text-gray-400">{new Date(user.lastSeenAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{user.cartItems}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{user._count?.favorites ?? 0}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{user._count?.quizSessions ?? 0}</td>
                    <td className="px-5 py-3 text-gray-700">{user._count?.orders ?? 0}</td>
                    <td className="px-5 py-3">
                      <span className="text-amber-600 font-medium">{user.bonusPoints}</span>
                      <span className="text-xs text-gray-400 ml-1">({getLevelLabel(user.bonusLevel)})</span>
                    </td>
                    <td className="px-5 py-3">
                      {!user.isGuest ? (
                        <select
                          value={user.role}
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                          disabled={updatingId === user.id}
                          className={`text-xs px-2 py-1 rounded-lg font-medium border-0 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer ${ROLE_STYLE[user.role] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-5 py-3">
                      {!user.isGuest && (
                        <button
                          onClick={() => { setResetPasswordId(user.id); setResetPasswordValue(''); setResetMessage(null) }}
                          disabled={updatingId === user.id}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                        >
                          Сбросить пароль
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-5 py-12 text-center text-gray-400">
                      {search ? 'Ничего не найдено' : 'Пользователей пока нет'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Показано {users.length} из {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40">←</button>
              <span className="px-3 py-1.5 text-sm text-gray-700">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40">→</button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetPasswordId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Сбросить пароль</h3>

            {resetMessage && (
              <div
                className={`px-4 py-3 rounded-lg text-sm font-medium mb-4 ${
                  resetMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {resetMessage.text}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Новый пароль</label>
              <input
                type="password"
                value={resetPasswordValue}
                onChange={e => setResetPasswordValue(e.target.value)}
                disabled={updatingId === resetPasswordId}
                placeholder="Минимум 8 символов"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setResetPasswordId(null)}
                disabled={updatingId === resetPasswordId}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleResetPassword(resetPasswordId)}
                disabled={updatingId === resetPasswordId}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {updatingId === resetPasswordId ? 'Загрузка...' : 'Сбросить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
