import { useEffect, useState } from 'react'
import { reviewsApi, type Review } from '../../lib/api'
import { ImageField } from '../../components/ImageField'
import { imageSrc } from '../../lib/media'

const STATUS_LABEL: Record<'pending' | 'approved' | 'rejected', string> = {
  pending: 'На модерации',
  approved: 'Одобрен',
  rejected: 'Отклонен',
}

const STATUS_BADGE: Record<'pending' | 'approved' | 'rejected', string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

const emptyReview = (): Partial<Review> => ({
  authorName: '',
  rating: 5,
  text: '',
  photo: null,
  status: 'approved',
})

export default function ReviewsPage() {
  const [items, setItems] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | ''>('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [form, setForm] = useState<Partial<Review> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    reviewsApi
      .list({ status: status || undefined, search: query || undefined, page, limit: 30 })
      .then(r => {
        setItems(r.data.items)
        setTotal(r.data.total)
        setTotalPages(r.data.totalPages)
      })
      .catch(() => setError('Не удалось загрузить отзывы'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [status, query, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditId(null)
    setForm(emptyReview())
    setFormError('')
  }

  const openEdit = (r: Review) => {
    setEditId(r.id)
    setForm({ ...r })
    setFormError('')
  }

  const closeForm = () => {
    setForm(null)
    setEditId(null)
  }

  const setField = (field: keyof Review, value: unknown) =>
    setForm(prev => (prev ? { ...prev, [field]: value } : prev))

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    setUploading(true)
    setFormError('')
    try {
      const res = await reviewsApi.uploadImage(file)
      setField('photo', res.data.url)
    } catch (e) {
      const fromBody = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setFormError(typeof fromBody === 'string' && fromBody ? fromBody : 'Не удалось загрузить фото')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form?.authorName?.trim()) {
      setFormError('Введите имя автора')
      return
    }
    if (!form?.text?.trim()) {
      setFormError('Введите текст отзыва')
      return
    }
    if (!form?.rating || form.rating < 1 || form.rating > 5) {
      setFormError('Выберите оценку от 1 до 5')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (editId) {
        const res = await reviewsApi.update(editId, form)
        setItems(prev => prev.map(r => (r.id === editId ? res.data : r)))
      } else {
        const res = await reviewsApi.create(form)
        setItems(prev => [res.data, ...prev])
      }
      closeForm()
      load()
    } catch (e) {
      const fromBody = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setFormError(typeof fromBody === 'string' && fromBody ? fromBody : 'Не удалось сохранить отзыв')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      await reviewsApi.update(id, { status: newStatus })
      load()
    } catch {
      setError('Не удалось обновить статус')
    }
  }

  const handleDelete = async (review: Review) => {
    if (!confirm(`Удалить отзыв от ${review.authorName}?`)) return
    try {
      await reviewsApi.delete(review.id)
      load()
    } catch {
      setError('Не удалось удалить')
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Отзывы</h1>
          <p className="text-sm text-gray-600">Всего отзывов: {total}. На модерации скрывает до одобрения.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          + Добавить отзыв
        </button>
      </div>

      {form !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editId ? 'Редактировать отзыв' : 'Новый отзыв'}</h2>
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Имя автора *</label>
              <input
                value={form.authorName ?? ''}
                onChange={e => setField('authorName', e.target.value)}
                placeholder="Иван Петров"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Оценка *</label>
              <select
                value={form.rating ?? 5}
                onChange={e => setField('rating', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              >
                <option value={5}>5 звёзд</option>
                <option value={4}>4 звезды</option>
                <option value={3}>3 звезды</option>
                <option value={2}>2 звезды</option>
                <option value={1}>1 звезда</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Текст отзыва *</label>
              <textarea
                value={form.text ?? ''}
                onChange={e => setField('text', e.target.value)}
                placeholder="Напишите честный отзыв..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <ImageField
                label="Фото отзыва (необязательно)"
                hint="JPG, PNG, WebP или GIF"
                placeholder="/reviews/photo.jpg"
                value={form.photo ?? ''}
                onChange={v => setField('photo', v)}
                onFile={handleImageUpload}
                uploading={uploading}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Статус</label>
              <select
                value={form.status ?? 'approved'}
                onChange={e => setField('status', e.target.value as 'approved' | 'pending' | 'rejected')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
              >
                <option value="approved">Одобрен</option>
                <option value="pending">На модерации</option>
                <option value="rejected">Отклонен</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button
              onClick={closeForm}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {([['', 'Все'], ['pending', 'На модерации'], ['approved', 'Одобренные'], ['rejected', 'Отклоненные']] as const).map(([v, l]) => (
          <button key={v} onClick={() => { setStatus(v); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${status === v ? 'bg-blue-600 text-white' : 'border border-gray-300 text-black hover:bg-white transition-colors'}`}>
            {l}
          </button>
        ))}
        <form
          className="ml-auto flex gap-2"
          onSubmit={e => {
            e.preventDefault()
            setQuery(search.trim())
            setPage(1)
          }}
        >
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или тексту"
            className="w-64 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
          />
          <button type="submit" className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            Найти
          </button>
        </form>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">Отзывов нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Отзыв</th>
                  <th className="px-5 py-3 font-medium">Товар</th>
                  <th className="px-5 py-3 font-medium">Рейтинг</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{r.authorName}</p>
                        <p className="text-xs text-gray-600 line-clamp-2">{r.text}</p>
                        {r.user && <p className="text-xs text-gray-500">{r.user.email}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs max-w-xs">
                      {r.product ? (
                        <div>
                          <p className="font-medium">{r.product.name}</p>
                          <p className="text-gray-400">/{r.product.slug}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Не привязан</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex gap-0.5 justify-center">
                        {[1, 2, 3, 4, 5].map(i => (
                          <span key={i} className={i <= r.rating ? 'text-amber-500' : 'text-gray-300'}>
                            ★
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Изменить
                      </button>
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(r.id, 'approved')}
                            className="text-green-600 hover:underline text-xs font-medium"
                          >
                            Одобрить
                          </button>
                          <button
                            onClick={() => handleStatusChange(r.id, 'rejected')}
                            className="text-red-600 hover:underline text-xs font-medium"
                          >
                            Отклонить
                          </button>
                        </>
                      )}
                      <button onClick={() => handleDelete(r)} className="text-red-500 hover:underline text-xs">
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
