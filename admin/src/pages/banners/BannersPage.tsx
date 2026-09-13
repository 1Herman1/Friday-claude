import { useEffect, useState } from 'react'
import { bannersApi, type Banner } from '../../lib/api'
import { imageSrc } from '../../lib/media'
import { ImageField } from '../../components/ImageField'

const PAGE_LABELS: Record<string, string> = { home: 'Главная', catalog: 'Каталог', about: 'О нас', other: 'Другое' }
const POSITION_LABELS: Record<string, string> = {
  main_slider: 'Главный слайдер',
  promo_strip: 'Промо-полоса',
  sidebar: 'Сайдбар',
}

const empty = (): Partial<Banner> => ({
  title: '',
  subtitle: '',
  image: '',
  imageMobile: '',
  showText: true,
  link: '',
  buttonText: '',
  page: 'home',
  position: 'main_slider',
  isActive: true,
  sortOrder: 0,
})

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Partial<Banner> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = () => {
    setLoading(true)
    bannersApi.list().then(r => setBanners(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditId(null); setForm(empty()); setError('') }
  const openEdit = (b: Banner) => { setEditId(b.id); setForm({ ...b }); setError('') }
  const closeForm = () => { setForm(null); setEditId(null) }

  const handleSave = async () => {
    if (!form?.title) { setError('Введите заголовок'); return }
    if (!form?.image) { setError('Загрузите или выберите изображение'); return }
    setSaving(true); setError('')
    try {
      if (editId) {
        const res = await bannersApi.update(editId, form)
        setBanners(prev => prev.map(b => b.id === editId ? res.data : b))
      } else {
        const res = await bannersApi.create(form)
        setBanners(prev => [...prev, res.data])
      }
      closeForm()
    } catch (e) {
      const fromBody = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setError(typeof fromBody === 'string' && fromBody ? fromBody : 'Не удалось сохранить баннер')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить баннер?')) return
    await bannersApi.delete(id)
    setBanners(prev => prev.filter(b => b.id !== id))
  }

  const toggleActive = async (b: Banner) => {
    const res = await bannersApi.update(b.id, { isActive: !b.isActive })
    setBanners(prev => prev.map(x => x.id === b.id ? res.data : x))
  }

  const setField = (field: keyof Banner, value: unknown) =>
    setForm(prev => prev ? { ...prev, [field]: value } : prev)

  const handleImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'image' | 'imageMobile',
  ) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    // загрузить на сервер
    setUploading(true)
    setError('')
    try {
      const res = await bannersApi.uploadImage(file)
      setField(field, res.data.url)
    } catch (e) {
      // Сервер отвечает готовой русской фразой, в том числе про неподключённое
      // хранилище. Угадывать причину по подстроке не нужно — раньше проверка
      // искала «MinIO» в тексте, которого сервер не присылал, и администратор
      // видел английское «Failed to upload file».
      const fromBody = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setError(typeof fromBody === 'string' && fromBody ? fromBody : 'Не удалось загрузить картинку')
    } finally { setUploading(false) }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Баннеры и акции</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          + Добавить баннер
        </button>
      </div>

      {form !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editId ? 'Редактировать баннер' : 'Новый баннер'}</h2>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Заголовок *</label>
              <input value={form.title ?? ''} onChange={e => setField('title', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Подзаголовок</label>
              <input value={form.subtitle ?? ''} onChange={e => setField('subtitle', e.target.value)} placeholder="Дополнительный текст"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ссылка (необязательно)</label>
              <input value={form.link ?? ''} onChange={e => setField('link', e.target.value)} placeholder="/catalog"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Текст кнопки</label>
              <input value={form.buttonText ?? ''} onChange={e => setField('buttonText', e.target.value)} placeholder="Узнать больше"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
              <ImageField
                label="Картинка — компьютер *"
                hint="2560 × 640 px"
                placeholder="/banners/desktop/akciya.jpg"
                value={form.image ?? ''}
                onChange={(v) => setField('image', v)}
                onFile={(e) => handleImageSelect(e, 'image')}
                uploading={uploading}
              />
              {/* Отдельный файл для телефона: широкая картинка на узком экране
                  либо обрезается по краям, либо мельчает до нечитаемости.
                  Поле необязательное — пусто, значит телефон получит ту же. */}
              <ImageField
                label="Картинка — телефон"
                hint="1170 × 672 px, необязательно"
                placeholder="/banners/mobile/akciya.jpg"
                value={form.imageMobile ?? ''}
                onChange={(v) => setField('imageMobile', v)}
                onFile={(e) => handleImageSelect(e, 'imageMobile')}
                uploading={uploading}
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={form.showText ?? true}
                  onChange={e => setField('showText', e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded accent-blue-600" />
                <span className="text-sm text-gray-700">
                  Показывать текст поверх картинки
                  <span className="block text-xs text-gray-500">
                    Снимите, если заголовок и кнопка уже нарисованы на самой картинке —
                    иначе поверх ляжет второй заголовок.
                  </span>
                </span>
              </label>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Страница</label>
              <select value={form.page ?? 'home'} onChange={e => setField('page', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
                {Object.entries(PAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Позиция</label>
              <select value={form.position ?? 'main_slider'} onChange={e => setField('position', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
                {Object.entries(POSITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Порядок</label>
              <input type="number" value={form.sortOrder ?? 0} onChange={e => setField('sortOrder', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive ?? true} onChange={e => setField('isActive', e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600" />
                <span className="text-sm text-gray-700">Активен</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button onClick={closeForm} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200">Отмена</button>
          </div>
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
                  <th className="px-5 py-3 font-medium">Баннер</th>
                  <th className="px-5 py-3 font-medium">Страница</th>
                  <th className="px-5 py-3 font-medium">Позиция</th>
                  <th className="px-5 py-3 font-medium">Порядок</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {banners.map(b => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img src={b.image} alt={b.title} className="w-12 h-8 object-cover rounded bg-gray-100"
                          onError={e => (e.currentTarget.style.display = 'none')} />
                        <div>
                          <p className="font-medium text-gray-900">{b.title}</p>
                          {b.subtitle && <p className="text-xs text-gray-500">{b.subtitle}</p>}
                          {b.link && <p className="text-xs text-gray-400">{b.link}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{PAGE_LABELS[b.page]}</td>
                    <td className="px-5 py-3 text-gray-600">{POSITION_LABELS[b.position]}</td>
                    <td className="px-5 py-3 text-gray-600">{b.sortOrder}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => toggleActive(b)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                          b.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {b.isActive ? 'Активен' : 'Скрыт'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(b)} className="text-blue-600 hover:underline text-xs font-medium">Изменить</button>
                        <button onClick={() => handleDelete(b.id)} className="text-red-500 hover:underline text-xs">Удалить</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {banners.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">Баннеров пока нет</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

