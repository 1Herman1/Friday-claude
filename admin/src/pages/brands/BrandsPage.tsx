import { useEffect, useState } from 'react'
import { brandsApi, type Brand } from '../../lib/api'
import { imageSrc, siteUrl } from '../../lib/media'
import { ImageField } from '../../components/ImageField'

const empty = (): Partial<Brand> => ({ name: '', slug: '', logo: '', accentColor: '', logoFit: null, description: '' })

function autoSlug(n: string) {
  return n.toLowerCase().replace(/[а-яё]/g, (c: string) => ({
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
    к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
    х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  }[c] ?? c)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Partial<Brand> | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [brokenLogos, setBrokenLogos] = useState<Set<string>>(new Set())

  const load = () => {
    setLoading(true)
    setError('')
    brandsApi.list()
      .then(r => setBrands(r.data))
      .catch(() => setError('Не удалось загрузить бренды'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditId(null); setForm(empty()); setError('') }
  const openEdit = (b: Brand) => { setEditId(b.id); setForm({ ...b }); setError('') }
  const closeForm = () => { setForm(null); setEditId(null) }

  const handleSave = async () => {
    if (!form?.name) { setError('Введите название'); return }
    if (!form?.slug) { setError('Введите slug'); return }
    setSaving(true); setError('')
    try {
      const data = {
        ...form,
        logo: form.logo || null,
        accentColor: form.accentColor || null,
        logoFit: form.logoFit || null,
      }
      if (editId) {
        const res = await brandsApi.update(editId, data)
        setBrands(prev => prev.map(b => b.id === editId ? res.data : b))
      } else {
        const res = await brandsApi.create(data)
        setBrands(prev => [...prev, res.data])
      }
      closeForm()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить бренд "${name}"? Товары с этим брендом не удалятся.`)) return
    try {
      await brandsApi.delete(id)
      setBrands(prev => prev.filter(b => b.id !== id))
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка удаления')
    }
  }

  const setField = (field: keyof Brand, value: unknown) =>
    setForm(prev => prev ? { ...prev, [field]: value } : prev)

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const res = await brandsApi.uploadImage(file)
      setField('logo', res.data.url)
    } catch (e) {
      const fromBody = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setError(typeof fromBody === 'string' && fromBody ? fromBody : 'Не удалось загрузить картинку')
    } finally {
      setUploading(false)
      e.currentTarget.value = ''
    }
  }

  const logoPreview = (b: Brand) => {
    if (b.logo) return imageSrc(b.logo)
    return `${siteUrl()}/brands/${b.slug}.png`
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Бренды</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          + Добавить
        </button>
      </div>

      {form !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">{editId ? 'Редактировать' : 'Новый бренд'}</h2>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Название *</label>
              <input value={form.name ?? ''} onChange={e => {
                setField('name', e.target.value)
                if (!editId) setField('slug', autoSlug(e.target.value))
              }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Slug *</label>
              <input value={form.slug ?? ''} onChange={e => setField('slug', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400" />
            </div>
            <div className="md:col-span-2">
              <ImageField
                label="Логотип"
                hint="PNG/SVG на прозрачном фоне, файл или путь"
                placeholder="/brands/farmina.png"
                value={form.logo ?? ''}
                onChange={(v) => setField('logo', v)}
                onFile={handleImageSelect}
                uploading={uploading}
              />
            </div>
            <div className="md:col-span-2 grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Фирменный цвет</label>
                <div className="flex gap-2">
                  <input type="color" value={form.accentColor ?? '#C4D3E0'} onChange={e => setField('accentColor', e.target.value)}
                    className="w-16 h-10 rounded-lg border border-line cursor-pointer" />
                  <input value={form.accentColor ?? ''} onChange={e => setField('accentColor', e.target.value)} placeholder="#RRGGBB"
                    className="flex-1 px-3 py-2 rounded-lg border border-line text-sm font-mono focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Вписывание логотипа</label>
                <select value={form.logoFit ?? ''} onChange={e => setField('logoFit', e.target.value as 'wide' | 'mid' | 'mark' | null || null)}
                  className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-primary">
                  <option value="">Средний (mid, по умолчанию)</option>
                  <option value="wide">Широкий (wide)</option>
                  <option value="mark">Знак (mark)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Описание</label>
              <input value={form.description ?? ''} onChange={e => setField('description', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy-500 text-xs border-b border-line bg-blue-50">
                <th className="px-5 py-3 font-medium">Бренд</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">Цвет</th>
                <th className="px-5 py-3 font-medium">Товаров</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {brands.map(b => (
                <tr key={b.id} className="border-b border-line hover:bg-blue-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {brokenLogos.has(b.id)
                        ? <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center text-xs text-navy-500">?</div>
                        : <img src={logoPreview(b)} alt={b.name} className="w-8 h-8 object-contain rounded" onError={() => setBrokenLogos(prev => new Set([...prev, b.id]))} />
                      }
                      <span className="font-medium text-navy-900">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-navy-500 font-mono text-xs">{b.slug}</td>
                  <td className="px-5 py-3">
                    <div className="w-4 h-4 rounded" style={{ background: b.accentColor ?? '#C4D3E0' }} />
                  </td>
                  <td className="px-5 py-3 text-navy-600">{b._count?.products ?? 0}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(b)} className="text-primary-hover hover:underline text-xs font-medium">Изменить</button>
                      <button onClick={() => handleDelete(b.id, b.name)} className="text-destructive hover:underline text-xs">Удалить</button>
                    </div>
                  </td>
                </tr>
              ))}
              {brands.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-navy-500">Брендов пока нет</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
