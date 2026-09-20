import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { blogApi, productsApi, BLOG_CATEGORIES, type BlogPost, type BlogStatus, type Product } from '../../lib/api'

type Form = {
  slug: string
  title: string
  subtitle: string
  body: string
  categories: string[]
  date: string
  status: BlogStatus
  cover: string
  metaTitle: string
  metaDescription: string
}

const empty = (): Form => ({
  slug: '', title: '', subtitle: '', body: '', categories: [],
  date: new Date().toISOString().slice(0, 10), status: 'draft', cover: '', metaTitle: '', metaDescription: '',
})

function autoSlug(n: string) {
  return n.toLowerCase().replace(/[а-яё]/g, (c: string) => ({
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
    к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
    х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  }[c] ?? c)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
}

const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400'
const CATALOG_LINKS = [
  { label: 'Каталог', href: '/catalog' },
  { label: 'Корма для собак', href: '/catalog?species=dog' },
  { label: 'Корма для кошек', href: '/catalog?species=cat' },
  { label: 'Ветаптека', href: '/catalog?category=care' },
  { label: 'Доставка', href: '/delivery' },
]

export default function BlogEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [form, setForm] = useState<Form>(empty())
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [uploading, setUploading] = useState(false)
  const [linkQuery, setLinkQuery] = useState('')
  const [linkResults, setLinkResults] = useState<Product[]>([])
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!id) return
    blogApi.byId(id)
      .then(r => {
        const p = r.data
        setForm({
          slug: p.slug, title: p.title, subtitle: p.subtitle ?? '', body: p.body, categories: p.categories,
          date: p.date.slice(0, 10), status: p.status, cover: p.cover ?? '', metaTitle: p.metaTitle ?? '', metaDescription: p.metaDescription ?? '',
        })
      })
      .catch(() => setError('Статья не найдена'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const q = linkQuery.trim()
    if (q.length < 2) { setLinkResults([]); return }
    const t = setTimeout(() => {
      productsApi.list({ search: q, limit: 8 }).then(r => setLinkResults(r.data.items)).catch(() => setLinkResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [linkQuery])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  const onTitle = (v: string) => {
    set('title', v)
    if (!slugTouched) set('slug', autoSlug(v))
  }

  const toggleCategory = (c: string) =>
    set('categories', form.categories.includes(c) ? form.categories.filter(x => x !== c) : [...form.categories, c])

  const insertAtCursor = (text: string) => {
    const el = bodyRef.current
    if (!el) { set('body', form.body + text); return }
    const start = el.selectionStart ?? form.body.length
    const end = el.selectionEnd ?? start
    const selected = form.body.slice(start, end)
    const chunk = text.replace('%s', selected)
    const next = form.body.slice(0, start) + chunk + form.body.slice(end)
    set('body', next)
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + chunk.length })
  }

  const insertLink = (label: string, href: string) => {
    const el = bodyRef.current
    const selected = el ? form.body.slice(el.selectionStart, el.selectionEnd) : ''
    insertAtCursor(`[${selected || label}](${href})`)
    setLinkQuery('')
    setLinkResults([])
  }

  const handleUpload = async (file: File, target: 'cover' | 'body') => {
    setUploading(true)
    setError('')
    try {
      const r = await blogApi.uploadImage(file)
      if (target === 'cover') set('cover', r.data.url)
      else insertAtCursor(`\n\n![](${r.data.url})\n\n`)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'Не удалось загрузить картинку')
    } finally {
      setUploading(false)
    }
  }

  const save = async (status?: BlogStatus) => {
    setSaving(true)
    setError('')
    setSaved('')
    const payload = {
      ...form,
      status: status ?? form.status,
      subtitle: form.subtitle || null,
      cover: form.cover || null,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
    }
    try {
      const r: { data: BlogPost } = isNew ? await blogApi.create(payload) : await blogApi.update(id, payload)
      if (status) set('status', status)
      setSaved(status === 'published' ? 'Опубликовано' : 'Сохранено')
      if (isNew) navigate(`/blog/${r.data.id}`, { replace: true })
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <Link to="/blog" className="text-xs text-gray-500 hover:text-gray-900">← Блог</Link>
          <h1 className="text-xl font-bold text-gray-900">{isNew ? 'Новая статья' : 'Редактирование статьи'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-700">{saved}</span>}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${form.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {form.status === 'published' ? 'Опубликована' : 'Черновик'}
          </span>
          {!isNew && form.status === 'published' && (
            <a href={`/blog/${form.slug}`} target="_blank" rel="noreferrer" className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">Открыть на сайте</a>
          )}
          <button onClick={() => save()} disabled={saving || !form.title || !form.slug}
            className="px-4 py-2 bg-gray-100 text-gray-800 text-sm font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50">
            {form.status === 'published' ? 'Сохранить' : 'Сохранить черновик'}
          </button>
          {form.status !== 'published' && (
            <button onClick={() => save('published')} disabled={saving || !form.title || !form.slug}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50">
              Опубликовать
            </button>
          )}
          {form.status === 'published' && !isNew && (
            <button onClick={() => save('draft')} disabled={saving}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50 disabled:opacity-50">
              Снять с публикации
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Заголовок</label>
              <input value={form.title} onChange={e => onTitle(e.target.value)} className={input} maxLength={200} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Подзаголовок (краткое описание в списке)</label>
              <textarea value={form.subtitle} onChange={e => set('subtitle', e.target.value)} className={input} rows={2} maxLength={500} />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="text-xs text-gray-500">Текст статьи (Markdown: ## заголовок, **жирный**, - список, [ссылка](/catalog))</label>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => insertAtCursor('## %s')} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">H2</button>
                  <button type="button" onClick={() => insertAtCursor('### %s')} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">H3</button>
                  <button type="button" onClick={() => insertAtCursor('**%s**')} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 font-bold">B</button>
                  <button type="button" onClick={() => insertAtCursor('\n- %s')} className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">• список</button>
                  <label className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 cursor-pointer">
                    {uploading ? '…' : '🖼 картинка'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'body'); e.target.value = '' }} />
                  </label>
                </div>
              </div>
              <textarea ref={bodyRef} value={form.body} onChange={e => set('body', e.target.value)}
                className={`${input} font-mono text-[13px] leading-relaxed min-h-[480px]`} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Вставить ссылку в текст</h2>
            <p className="text-xs text-gray-500 mb-3">Выделите слово в тексте и нажмите на товар или раздел — на него встанет ссылка. Без выделения вставится название.</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {CATALOG_LINKS.map(l => (
                <button key={l.href} type="button" onClick={() => insertLink(l.label, l.href)} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">{l.label}</button>
              ))}
            </div>
            <input value={linkQuery} onChange={e => setLinkQuery(e.target.value)} placeholder="Найти товар по названию…" className={input} />
            {linkResults.length > 0 && (
              <ul className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-64 overflow-auto">
                {linkResults.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => insertLink(p.name, `/product/${p.slug}`)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      {p.name} <span className="text-xs text-gray-400">/product/{p.slug}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Дата публикации</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Адрес (слаг)</label>
              <input value={form.slug} onChange={e => { setSlugTouched(true); set('slug', e.target.value) }} className={`${input} font-mono`} maxLength={120} />
              <p className="text-[11px] text-gray-400 mt-1">simbazoo.ru/blog/{form.slug || '…'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Рубрики</label>
              <div className="flex flex-wrap gap-1.5">
                {BLOG_CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => toggleCategory(c)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${form.categories.includes(c) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-xs text-gray-500 mb-2">Обложка</label>
            {form.cover ? (
              <div className="mb-2">
                <img src={form.cover} alt="" className="w-full aspect-[16/10] object-cover rounded-lg bg-gray-100" />
                <button type="button" onClick={() => set('cover', '')} className="mt-1 text-xs text-red-500 hover:underline">Убрать</button>
              </div>
            ) : (
              <div className="w-full aspect-[16/10] rounded-lg bg-gray-100 mb-2" />
            )}
            <label className="inline-block px-3 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer">
              {uploading ? 'Загрузка…' : 'Загрузить картинку'}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'cover'); e.target.value = '' }} />
            </label>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">SEO</h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Meta title</label>
              <input value={form.metaTitle} onChange={e => set('metaTitle', e.target.value)} className={input} maxLength={200} placeholder={form.title} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Meta description</label>
              <textarea value={form.metaDescription} onChange={e => set('metaDescription', e.target.value)} className={input} rows={3} maxLength={500} placeholder={form.subtitle} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
