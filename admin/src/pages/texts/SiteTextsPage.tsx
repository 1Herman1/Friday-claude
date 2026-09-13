import { useEffect, useMemo, useState } from 'react'
import { siteTextsApi, type SiteTextItem } from '../../lib/api'

const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400'

export default function SiteTextsPage() {
  const [items, setItems] = useState<SiteTextItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const load = () => {
    setLoading(true)
    siteTextsApi.list()
      .then(r => { setItems(r.data.items); setDrafts({}) })
      .catch(() => setError('Не удалось загрузить тексты'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const map = new Map<string, SiteTextItem[]>()
    for (const it of items) {
      if (q && !`${it.label} ${it.value} ${it.group}`.toLowerCase().includes(q)) continue
      map.set(it.group, [...(map.get(it.group) ?? []), it])
    }
    return [...map.entries()]
  }, [items, filter])

  const apply = (updated: SiteTextItem) => {
    setItems(prev => prev.map(i => i.key === updated.key ? updated : i))
    setDrafts(prev => { const n = { ...prev }; delete n[updated.key]; return n })
  }

  const save = async (it: SiteTextItem) => {
    const value = drafts[it.key]
    if (value === undefined || value === it.value) return
    setBusy(it.key)
    setError('')
    try {
      const r = await siteTextsApi.update(it.key, value)
      apply(r.data)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'Не удалось сохранить')
    } finally {
      setBusy(null)
    }
  }

  const reset = async (it: SiteTextItem) => {
    setBusy(it.key)
    setError('')
    try {
      const r = await siteTextsApi.reset(it.key)
      apply(r.data)
    } catch {
      setError('Не удалось вернуть стандартный текст')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Тексты сайта</h1>
        <p className="text-sm text-gray-600">Заголовки и подзаголовки разделов. Меняются на сайте сразу после сохранения, без выкатки.</p>
      </div>

      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Поиск по тексту или разделу…" className={`${input} mb-4`} />

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>
      ) : groups.map(([group, list]) => (
        <section key={group} className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
          <h2 className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-100">{group}</h2>
          <div className="divide-y divide-gray-100">
            {list.map(it => {
              const draft = drafts[it.key] ?? it.value
              const dirty = drafts[it.key] !== undefined && drafts[it.key] !== it.value
              const long = it.defaultValue.length > 70
              return (
                <div key={it.key} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <label htmlFor={it.key} className="text-sm font-medium text-gray-900">{it.label}</label>
                    {it.isOverridden && (
                      <button onClick={() => reset(it)} disabled={busy === it.key} className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50" title={`Стандартный текст: ${it.defaultValue}`}>
                        Вернуть стандартный
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 items-start">
                    {long ? (
                      <textarea id={it.key} value={draft} rows={3} maxLength={2000} className={input}
                        onChange={e => setDrafts(d => ({ ...d, [it.key]: e.target.value }))} />
                    ) : (
                      <input id={it.key} value={draft} maxLength={2000} className={input}
                        onChange={e => setDrafts(d => ({ ...d, [it.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') save(it) }} />
                    )}
                    <button onClick={() => save(it)} disabled={!dirty || busy === it.key}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 shrink-0">
                      {busy === it.key ? '…' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
