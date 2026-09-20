import { useEffect, useState } from 'react'
import { promoApi, type PromoCode } from '../../lib/api'
import { formatPrice } from '../../lib/format'

const empty = (): Partial<PromoCode> => ({
  code: '',
  type: 'percent',
  value: 10,
  minSubtotal: null,
  startsAt: null,
  endsAt: null,
  maxUses: null,
  perUserLimit: null,
  isActive: true,
  comment: '',
})

const statusLabel: Record<string, { label: string; bgColor: string; textColor: string }> = {
  active: { label: 'Действует', bgColor: 'bg-green-100', textColor: 'text-green-700' },
  scheduled: { label: 'Запланирован', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
  expired: { label: 'Истёк', bgColor: 'bg-gray-100', textColor: 'text-gray-600' },
  exhausted: { label: 'Исчерпан', bgColor: 'bg-gray-100', textColor: 'text-gray-600' },
  disabled: { label: 'Отключён', bgColor: 'bg-gray-100', textColor: 'text-gray-600' },
}

const formatDiscount = (p: PromoCode): string => {
  return p.type === 'percent' ? `${p.value}%` : formatPrice(p.value)
}

const formatConditions = (p: PromoCode): string => {
  const parts: string[] = []
  if (p.minSubtotal) {
    parts.push(`Мин. ${formatPrice(p.minSubtotal)}`)
  }
  if (p.startsAt || p.endsAt) {
    const start = p.startsAt ? new Date(p.startsAt).toLocaleDateString('ru-RU') : '—'
    const end = p.endsAt ? new Date(p.endsAt).toLocaleDateString('ru-RU') : '—'
    parts.push(`${start} - ${end}`)
  }
  return parts.length > 0 ? parts.join(' • ') : '—'
}

const formatUsage = (p: PromoCode): string => {
  if (!p.maxUses) return `${p.usedCount}/∞`
  return `${p.usedCount}/${p.maxUses}`
}

export default function PromoCodesPage() {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Partial<PromoCode> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    promoApi.list().then(r => setPromos(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditId(null)
    setForm(empty())
    setError('')
  }
  const openEdit = (p: PromoCode) => { setEditId(p.id); setForm({ ...p }); setError('') }
  const closeForm = () => { setForm(null); setEditId(null) }

  const handleSave = async () => {
    if (!form?.code) { setError('Введите код'); return }
    if (!form?.value) { setError('Введите значение'); return }

    setSaving(true)
    setError('')
    try {
      const data = {
        ...form,
        // Если это фиксированная сумма, конвертируем рубли в копейки
        value: form.type === 'fixed' && typeof form.value === 'number' ? Math.round(form.value * 100) : form.value,
        minSubtotal: form.minSubtotal ? Math.round(form.minSubtotal * 100) : null,
      }

      if (editId) {
        const res = await promoApi.update(editId, data)
        setPromos(prev => prev.map(p => p.id === editId ? res.data : p))
      } else {
        const res = await promoApi.create(data)
        setPromos(prev => [...prev, res.data])
      }
      closeForm()
    } catch (e) {
      const fromBody = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setError(typeof fromBody === 'string' && fromBody ? fromBody : 'Не удалось сохранить промокод')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить промокод? В старых заказах код останется записан')) return
    await promoApi.delete(id)
    setPromos(prev => prev.filter(p => p.id !== id))
  }

  const toggleActive = async (p: PromoCode) => {
    const res = await promoApi.setActive(p.id, !p.isActive)
    setPromos(prev => prev.map(x => x.id === p.id ? res.data : x))
  }

  const setField = (field: keyof PromoCode, value: unknown) =>
    setForm(prev => prev ? { ...prev, [field]: value } : prev)

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Промокоды</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          + Добавить промокод
        </button>
      </div>

      {form !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editId ? 'Редактировать промокод' : 'Новый промокод'}</h2>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Код *</label>
              <input
                type="text"
                value={(form.code ?? '').toUpperCase()}
                onChange={e => setField('code', e.target.value.toUpperCase())}
                placeholder="SUMMER20"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2">Тип *</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.type === 'percent'}
                    onChange={() => setField('type', 'percent')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Процент</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.type === 'fixed'}
                    onChange={() => setField('type', 'fixed')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Фиксированная сумма</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Значение * {form.type === 'fixed' ? '(₽)' : '(%)'}
              </label>
              <input
                type="number"
                value={form.value ?? ''}
                onChange={e => setField('value', parseInt(e.target.value) || 0)}
                placeholder={form.type === 'percent' ? '10' : '300'}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Мин. сумма заказа (₽)</label>
              <input
                type="number"
                value={form.minSubtotal ? form.minSubtotal / 100 : ''}
                onChange={e => setField('minSubtotal', e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null)}
                placeholder="500"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Действует с</label>
              <input
                type="datetime-local"
                value={form.startsAt ? new Date(form.startsAt).toISOString().slice(0, 16) : ''}
                onChange={e => setField('startsAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Действует до</label>
              <input
                type="datetime-local"
                value={form.endsAt ? new Date(form.endsAt).toISOString().slice(0, 16) : ''}
                onChange={e => setField('endsAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Макс. использований</label>
              <input
                type="number"
                value={form.maxUses ?? ''}
                onChange={e => setField('maxUses', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="∞"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Лимит на пользователя</label>
              <input
                type="number"
                value={form.perUserLimit ?? ''}
                onChange={e => setField('perUserLimit', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="1"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Комментарий</label>
              <input
                type="text"
                value={form.comment ?? ''}
                onChange={e => setField('comment', e.target.value || null)}
                placeholder="Сезонная акция"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={e => setField('isActive', e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-700">Активен</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button onClick={closeForm} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200">
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Код</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Скидка</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Условия</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Использовано</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Статус</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {promos.map(p => {
                  const status = statusLabel[p.status] || statusLabel.disabled
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono font-medium text-gray-900">{p.code}</p>
                          {p.comment && <p className="text-xs text-gray-500">{p.comment}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDiscount(p)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{formatConditions(p)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatUsage(p)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${status.bgColor} ${status.textColor}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline text-xs font-medium">
                            Изменить
                          </button>
                          <button
                            onClick={() => toggleActive(p)}
                            className="text-gray-600 hover:underline text-xs"
                          >
                            {p.isActive ? 'Отключить' : 'Включить'}
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline text-xs">
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {promos.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Промокодов пока нет
            </div>
          )}
        </div>
      )}
    </div>
  )
}
