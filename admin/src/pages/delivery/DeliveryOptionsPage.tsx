import { useEffect, useState } from 'react'
import { deliveryOptionsApi, type DeliveryOption } from '../../lib/api'

/**
 * Формат цены для показа и ввода. В БД цена в копейках, админке показываем рубли.
 */
function formatPrice(kopiykas: number): string {
  return (kopiykas / 100).toFixed(2)
}

/**
 * Парсим рубли в копейки для отправки на сервер.
 */
function parsePrice(rubles: string): number {
  return Math.round(parseFloat(rubles) * 100)
}

function etaLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—'
  if (min != null && max != null && min !== max) return `${min}–${max}`
  const d = max ?? min ?? 0
  return d === 0 ? 'в день заказа' : String(d)
}

export default function DeliveryOptionsPage() {
  const [options, setOptions] = useState<DeliveryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})

  const load = () => {
    setLoading(true)
    deliveryOptionsApi.list()
      .then(r => {
        setOptions(r.data)
        // Инициализируем форму с текущими значениями
        const data: Record<string, any> = {}
        r.data.forEach(opt => {
          data[opt.key] = { ...opt }
        })
        setFormData(data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleChange = (key: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const handleSave = async (key: string) => {
    setError('')
    setSaving(key)
    try {
      const data = formData[key]
      // Парсим цену: пользователь вводит в рублях, отправляем в копейках
      const priceValue = data.priceInput ? parsePrice(data.priceInput) : data.price
      const expenseValue = data.expenseInput ? parsePrice(data.expenseInput) : data.expense

      const updateData: Record<string, any> = {
        title: data.title,
        subtitle: data.subtitle || null,
        price: priceValue,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      }

      if (data.expense !== undefined) {
        updateData.expense = expenseValue
      }
      updateData.etaMin = data.etaMin === '' || data.etaMin == null ? null : Number(data.etaMin)
      updateData.etaMax = data.etaMax === '' || data.etaMax == null ? null : Number(data.etaMax)
      updateData.freeFrom = data.freeFromInput ? parsePrice(data.freeFromInput) : null

      const res = await deliveryOptionsApi.update(key, updateData)

      // Обновляем список
      setOptions(prev =>
        prev.map(opt => opt.key === key ? res.data : opt)
      )

      // Обновляем форму с возвращённым значением (цена может быть целой)
      setFormData(prev => ({
        ...prev,
        [key]: { ...res.data, priceInput: formatPrice(res.data.price), expenseInput: res.data.expense !== undefined ? formatPrice(res.data.expense) : '', freeFromInput: res.data.freeFrom != null ? formatPrice(res.data.freeFrom) : '' },
      }))

      setEditingKey(null)
    } catch (e) {
      const fromBody = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setError(typeof fromBody === 'string' && fromBody ? fromBody : 'Не удалось сохранить')
    } finally {
      setSaving(null)
    }
  }

  const startEdit = (key: string) => {
    const opt = options.find(o => o.key === key)
    if (opt) {
      setFormData(prev => ({
        ...prev,
        [key]: { ...opt, priceInput: formatPrice(opt.price), expenseInput: opt.expense !== undefined ? formatPrice(opt.expense) : '', freeFromInput: opt.freeFrom != null ? formatPrice(opt.freeFrom) : '' },
      }))
      setEditingKey(key)
    }
  }

  const cancelEdit = () => {
    setEditingKey(null)
  }

  const KIND_LABELS: Record<string, { icon: string; label: string }> = {
    simba_courier: { icon: '🚗', label: 'Курьер' },
    cdek_pvz: { icon: '📦', label: 'СДЭК' },
    yandex_pvz: { icon: '📦', label: 'Яндекс' },
    ozon_pvz: { icon: '📦', label: 'Ozon' },
    pickup: { icon: '🏪', label: 'Самовывоз' },
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Доставка</h1>
        <p className="text-sm text-gray-600">
          Эти цены, сроки и порог бесплатной доставки видит покупатель в оформлении заказа, в корзине, на странице «Доставка» и в карточке товара. Меняются сразу, без выкатки.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Способ</th>
                  <th className="px-5 py-3 font-medium">Название</th>
                  <th className="px-5 py-3 font-medium">Подпись</th>
                  <th className="px-5 py-3 font-medium">Цена (₽)</th>
                  <th className="px-5 py-3 font-medium">Расход (₽)</th>
                  <th className="px-5 py-3 font-medium">Срок, дн.</th>
                  <th className="px-5 py-3 font-medium">Бесплатно от (₽)</th>
                  <th className="px-5 py-3 font-medium">Порядок</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {options.map(opt => {
                  const isEditing = editingKey === opt.key
                  const data = formData[opt.key] || opt
                  const kind = KIND_LABELS[opt.key]

                  return (
                    <tr key={opt.key} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-600">
                        <span className="text-lg">{kind?.icon}</span> {kind?.label}
                      </td>

                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={data.title}
                            onChange={e => handleChange(opt.key, 'title', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
                            maxLength={60}
                          />
                        ) : (
                          <span className="text-gray-900">{opt.title}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={data.subtitle || ''}
                            onChange={e => handleChange(opt.key, 'subtitle', e.target.value || null)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
                            maxLength={120}
                            placeholder="Опционально"
                          />
                        ) : (
                          <span className="text-gray-600 text-xs">{opt.subtitle || '—'}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={data.priceInput ?? formatPrice(data.price)}
                            onChange={e => handleChange(opt.key, 'priceInput', e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
                            step="0.01"
                            min="0"
                          />
                        ) : (
                          <span className="text-gray-900 font-medium">{formatPrice(opt.price)}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={data.expenseInput ?? ''}
                            onChange={e => handleChange(opt.key, 'expenseInput', e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
                            step="0.01"
                            min="0"
                            placeholder="—"
                          />
                        ) : (
                          <span className="text-gray-600">{opt.expense !== undefined ? formatPrice(opt.expense) : '—'}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" max="60" value={data.etaMin ?? ''} placeholder="от"
                              onChange={e => handleChange(opt.key, 'etaMin', e.target.value)}
                              className="w-14 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400" />
                            <span className="text-gray-400">–</span>
                            <input type="number" min="0" max="60" value={data.etaMax ?? ''} placeholder="до"
                              onChange={e => handleChange(opt.key, 'etaMax', e.target.value)}
                              className="w-14 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400" />
                          </div>
                        ) : (
                          <span className="text-gray-600">{etaLabel(opt.etaMin, opt.etaMax)}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input type="number" step="0.01" min="0" value={data.freeFromInput ?? ''} placeholder="нет"
                            onChange={e => handleChange(opt.key, 'freeFromInput', e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400" />
                        ) : (
                          <span className="text-gray-600">{opt.freeFrom != null ? formatPrice(opt.freeFrom) : '—'}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={data.sortOrder}
                            onChange={e => handleChange(opt.key, 'sortOrder', parseInt(e.target.value))}
                            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
                          />
                        ) : (
                          <span className="text-gray-600">{opt.sortOrder}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {isEditing ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={data.isActive}
                              onChange={e => handleChange(opt.key, 'isActive', e.target.checked)}
                              className="w-4 h-4 rounded accent-blue-600"
                            />
                            <span className="text-xs text-gray-600">
                              {data.isActive ? 'Вкл' : 'Выкл'}
                            </span>
                          </label>
                        ) : (
                          <button
                            onClick={() => {
                              // Быстрое включение/выключение без редактирования.
                              // Только сам флаг: параллельный handleSave слал
                              // второй PATCH тем же ключом и мог перетереть цену.
                              deliveryOptionsApi.update(opt.key, { isActive: !opt.isActive })
                                .then(res => {
                                  setOptions(prev => prev.map(o => o.key === opt.key ? res.data : o))
                                })
                                .catch(e => {
                                  const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
                                  setError(typeof msg === 'string' ? msg : 'Не удалось сохранить')
                                })
                            }}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                              opt.isActive
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {opt.isActive ? 'Включён' : 'Выключен'}
                          </button>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSave(opt.key)}
                                disabled={saving === opt.key}
                                className="text-blue-600 hover:underline text-xs font-medium disabled:opacity-50"
                              >
                                {saving === opt.key ? 'Сохраняем…' : 'Сохранить'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-gray-500 hover:underline text-xs"
                              >
                                Отмена
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEdit(opt.key)}
                              className="text-blue-600 hover:underline text-xs font-medium"
                            >
                              Изменить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        <span className="font-medium">Расход</span> — сколько способ стоит магазину. Для СДЭК и Яндекса считается по тарифу службы на каждый заказ, здесь — для курьера и самовывоза.
      </p>
    </div>
  )
}
