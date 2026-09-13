import { useEffect, useState } from 'react'
import { bannersApi, type Banner } from '../../lib/api'
import { imageSrc } from '../../lib/media'
import { ImageField } from '../../components/ImageField'

const BANNER_TYPES = [
  { key: 'promo', label: 'Акции (главная)', page: 'home', position: 'main_slider', hint: 'Карусель на главной, любое количество' },
  { key: 'about', label: 'О нас', page: 'about', position: 'main_slider', hint: 'Одна картинка в секции «О нас» на главной и на странице «О нас»' },
  { key: 'other', label: 'Другое', hint: 'Страница и позиция вручную' },
] as const

const PAGE_LABELS: Record<string, string> = { home: 'Главная', catalog: 'Каталог', about: 'О нас', other: 'Другое' }
const POSITION_LABELS: Record<string, string> = {
  main_slider: 'Главный слайдер',
  promo_strip: 'Промо-полоса',
  sidebar: 'Сайдбар',
}

const typeOf = (b: Banner): string => {
  if (b.page === 'home' && b.position === 'main_slider') return 'promo'
  if (b.page === 'about' && b.position === 'main_slider') return 'about'
  return 'other'
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
    setError('')
    bannersApi.list()
      .then(r => setBanners(r.data))
      .catch(() => setError('Не удалось загрузить баннеры'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = (type: string = 'promo') => {
    setEditId(null)
    const t = BANNER_TYPES.find(x => x.key === type)
    setForm({ ...empty(), ...(t && t.key !== 'other' ? { page: t.page, position: t.position } : {}) })
    setError('')
  }
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
    try {
      await bannersApi.delete(id)
      setBanners(prev => prev.filter(b => b.id !== id))
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Ошибка при удалении баннера')
    }
  }

  const toggleActive = async (b: Banner) => {
    try {
      const res = await bannersApi.update(b.id, { isActive: !b.isActive })
      setBanners(prev => prev.map(x => x.id === b.id ? res.data : x))
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Ошибка при изменении баннера')
    }
  }

  const moveInSection = async (b: Banner, direction: 'up' | 'down') => {
    const section = banners.filter(x => x.page === b.page && x.position === b.position).sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = section.findIndex(x => x.id === b.id)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === section.length - 1)) return

    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    const ids = section.map(x => x.id)
    ;[ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]]

    try {
      await bannersApi.reorder(ids)
      load()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Ошибка при перемещении баннера')
    }
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
        <button onClick={() => openCreate('promo')} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          + Добавить акцию
        </button>
      </div>

      {error && !form && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
          {error}
        </div>
      )}

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
              <label className="block text-xs text-gray-500 mb-1">Тип баннера</label>
              <select value={typeOf(form as Banner)} onChange={e => {
                const t = BANNER_TYPES.find(x => x.key === e.target.value)
                if (t && t.key !== 'other') {
                  setField('page', t.page)
                  setField('position', t.position)
                }
              }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
                {BANNER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">{BANNER_TYPES.find(x => x.key === typeOf(form as Banner))?.hint}</p>
            </div>

            {typeOf(form as Banner) === 'other' && (
              <>
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
              </>
            )}
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
        </div>
      ) : (
        <>
          {/* Акции (главная) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Акции (главная)</h2>
                <p className="text-xs text-gray-500">Карусель на главной, любое количество</p>
              </div>
              <button onClick={() => openCreate('promo')} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                + Добавить акцию
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {banners.filter(b => b.page === 'home' && b.position === 'main_slider').sort((a, b) => a.sortOrder - b.sortOrder).map((b, idx, arr) => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-b-0">
                      <td className="px-4 py-3 w-full">
                        <div className="flex items-center gap-3">
                          <img src={imageSrc(b.image)} alt={b.title} className="w-12 h-8 object-cover rounded bg-gray-100"
                            onError={e => (e.currentTarget.style.display = 'none')} />
                          <div>
                            <p className="font-medium text-gray-900">{b.title}</p>
                            {b.subtitle && <p className="text-xs text-gray-500">{b.subtitle}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => toggleActive(b)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                            b.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {b.isActive ? 'Активен' : 'Скрыт'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1">
                          <button onClick={() => moveInSection(b, 'up')} disabled={idx === 0}
                            className="px-2 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Переместить вверх">
                            ↑
                          </button>
                          <button onClick={() => moveInSection(b, 'down')} disabled={idx === arr.length - 1}
                            className="px-2 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Переместить вниз">
                            ↓
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-3">
                          <button onClick={() => openEdit(b)} className="text-blue-600 hover:underline text-xs font-medium">Изменить</button>
                          <button onClick={() => handleDelete(b.id)} className="text-red-500 hover:underline text-xs">Удалить</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {banners.filter(b => b.page === 'home' && b.position === 'main_slider').length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Акций пока нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* О нас */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">О нас</h2>
                <p className="text-xs text-gray-500">Одна картинка на главной и на странице «О нас»</p>
              </div>
              {!banners.some(b => b.page === 'about' && b.position === 'main_slider' && b.isActive) && (
                <button onClick={() => openCreate('about')} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                  + Добавить баннер «О нас»
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {banners.filter(b => b.page === 'about' && b.position === 'main_slider').sort((a, b) => a.sortOrder - b.sortOrder).map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-b-0">
                      <td className="px-4 py-3 w-full">
                        <div className="flex items-center gap-3">
                          <img src={imageSrc(b.image)} alt={b.title} className="w-12 h-8 object-cover rounded bg-gray-100"
                            onError={e => (e.currentTarget.style.display = 'none')} />
                          <div>
                            <p className="font-medium text-gray-900">{b.title}</p>
                            {b.subtitle && <p className="text-xs text-gray-500">{b.subtitle}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => toggleActive(b)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                            b.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {b.isActive ? 'Активен' : 'Скрыт'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {b.isActive && <span className="text-xs text-gray-500">Чтобы заменить картинку — нажмите «Изменить»</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-3">
                          <button onClick={() => openEdit(b)} className="text-blue-600 hover:underline text-xs font-medium">Изменить</button>
                          <button onClick={() => handleDelete(b.id)} className="text-red-500 hover:underline text-xs">Удалить</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {banners.filter(b => b.page === 'about' && b.position === 'main_slider').length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Баннера пока нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Другое */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Другое</h2>
                <p className="text-xs text-gray-500">Баннеры на других страницах и позициях</p>
              </div>
              <button onClick={() => openCreate('other')} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                + Добавить баннер
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {banners.filter(b => !(b.page === 'home' && b.position === 'main_slider') && !(b.page === 'about' && b.position === 'main_slider')).sort((a, b) => a.sortOrder - b.sortOrder).map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-b-0">
                      <td className="px-4 py-3 w-full">
                        <div className="flex items-center gap-3">
                          <img src={imageSrc(b.image)} alt={b.title} className="w-12 h-8 object-cover rounded bg-gray-100"
                            onError={e => (e.currentTarget.style.display = 'none')} />
                          <div>
                            <p className="font-medium text-gray-900">{b.title}</p>
                            <p className="text-xs text-gray-500">{PAGE_LABELS[b.page]} — {POSITION_LABELS[b.position]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => toggleActive(b)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                            b.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {b.isActive ? 'Активен' : 'Скрыт'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-3">
                          <button onClick={() => openEdit(b)} className="text-blue-600 hover:underline text-xs font-medium">Изменить</button>
                          <button onClick={() => handleDelete(b.id)} className="text-red-500 hover:underline text-xs">Удалить</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {banners.filter(b => !(b.page === 'home' && b.position === 'main_slider') && !(b.page === 'about' && b.position === 'main_slider')).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">Баннеров пока нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

