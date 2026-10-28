import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchAdminPostDetail, createAdminPost, updateAdminPost, deleteAdminPost, searchPublicProducts, type PostKind } from '@/lib/admin-api'
import { renderMarkdown } from '@/lib/markdown'

interface Product {
  id: string
  slug: string
  name: string
  image: string | null
  minPrice: number
  brand: { id: string; name: string; slug: string } | null
}

interface FormData {
  title: string
  slug: string
  body: string
  excerpt: string | null
  publishedAt: string | null
  kind: PostKind
  isAd: boolean
  advertiser: string
  erid: string
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

export function AdminPostEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [form, setForm] = useState<FormData>({
    title: '',
    slug: '',
    body: '',
    excerpt: null,
    publishedAt: null,
    kind: 'article',
    isAd: false,
    advertiser: '',
    erid: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  

  // Product search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Load post on mount
  useEffect(() => {
    if (!isNew && id) {
      const load = async () => {
        try {
          const post = await fetchAdminPostDetail(id)
          const publishedMs = post.publishedAt ? new Date(post.publishedAt).getTime() : null
          setForm({
            title: post.title,
            slug: post.slug,
            body: post.body,
            excerpt: post.excerpt || null,
            publishedAt:
              publishedMs === null
                ? null
                : new Date(publishedMs - new Date(publishedMs).getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
            kind: post.kind,
            isAd: post.isAd,
            advertiser: post.advertiser ?? '',
            erid: post.erid ?? '',
          })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
        } finally {
          setLoading(false)
        }
      }
      load()
    }
  }, [id, isNew])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearchError(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await searchPublicProducts(searchQuery)
        if (cancelled) return
        setSearchResults(results)
        setSearchError(null)
      } catch (err) {
        if (cancelled) return
        setSearchResults([])
        setSearchError(err instanceof Error ? err.message : 'Не удалось найти товар')
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setSearchLoading(false)
    }
  }, [searchQuery])

  // Слаг из заголовка — только для новой статьи и пока слаг не правили руками
  useEffect(() => {
    if (!isNew || slugTouched) return
    setForm((prev) => ({ ...prev, slug: slugify(prev.title) }))
  }, [form.title, isNew, slugTouched])

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.body.trim()) {
      setError('Заполните обязательные поля: заголовок, слаг и содержимое')
      return
    }

    const payload = {
      title: form.title,
      slug: form.slug,
      body: form.body,
      excerpt: form.excerpt || null,
      audience: 'public' as const,
      kind: form.kind,
      isAd: form.isAd,
      advertiser: form.isAd ? form.advertiser.trim() || null : null,
      erid: form.isAd ? form.erid.trim() || null : null,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
    }

    try {
      setSaving(true)
      setError(null)

      if (isNew) {
        await createAdminPost(payload)
      } else if (id) {
        await updateAdminPost(id, payload)
      }

      navigate('/admin/posts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || isNew) return
    if (!confirm('Удалить статью?')) return

    try {
      setSaving(true)
      await deleteAdminPost(id)
      navigate('/admin/posts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении')
      setSaving(false)
    }
  }

  const insertProduct = (slug: string) => {
    const textarea = bodyRef.current
    if (!textarea) return

    const { selectionStart, selectionEnd } = textarea
    const before = form.body.substring(0, selectionStart)
    const after = form.body.substring(selectionEnd)
    const newBody = `${before}\n\n[[product:${slug}]]\n\n${after}`

    setForm((prev) => ({ ...prev, body: newBody }))
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(selectionStart + 2 + 12 + slug.length + 4, selectionStart + 2 + 12 + slug.length + 4)
    }, 0)
  }

  if (loading) {
    return (
      <div className="container-app py-12">
        <div className="text-center text-muted-foreground">Загрузка…</div>
      </div>
    )
  }


  return (
    <div className="container-app py-12 md:py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-h2 font-heading font-bold text-foreground uppercase">
          {isNew ? 'Новая статья' : 'Редактировать'}
        </h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-block">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-label font-semibold mb-2 text-foreground">
              Заголовок <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Название статьи"
              className="w-full px-4 py-3 border border-border rounded-block bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-label font-semibold mb-2 text-foreground">
              Слаг <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true)
                setForm((prev) => ({ ...prev, slug: e.target.value }))
              }}
              placeholder="avtogeneriruyetsya-iz-zagolovka"
              className="w-full px-4 py-3 border border-border rounded-block bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-body-sm font-mono"
            />
            <p className="text-body-sm text-muted-foreground mt-1">
              Латиница, цифры и дефисы. URL будет /{form.kind === 'news' ? 'news' : 'blog'}/{form.slug}
            </p>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-label font-semibold mb-2 text-foreground">
              Выдержка (для списка)
            </label>
            <textarea
              value={form.excerpt || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value || null }))}
              placeholder="Краткое описание для списка статей"
              rows={2}
              className="w-full px-4 py-3 border border-border rounded-block bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Content Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-label font-semibold text-foreground">
                Содержимое (Markdown) <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowSearch(!showSearch)}
                className="text-body-sm px-3 py-1 rounded-block bg-muted text-foreground hover:bg-muted/70 transition-colors"
              >
                {showSearch ? 'Скрыть' : 'Вставить товар'}
              </button>
            </div>

            {showSearch && (
              <div className="mb-4 p-4 bg-muted/20 rounded-block border border-border">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск товара…"
                  className="w-full px-3 py-2 border border-border rounded-block bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-2"
                />
                {searchLoading && (
                  <p className="text-body-sm text-muted-foreground">Поиск…</p>
                )}
                {searchError && <p role="alert" className="text-body-sm text-destructive">{searchError}</p>}
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => insertProduct(product.slug)}
                        className="w-full text-left p-2 rounded-block hover:bg-muted transition-colors"
                      >
                        <p className="text-body-sm font-medium text-foreground">{product.name}</p>
                        <p className="text-body-sm text-muted-foreground">{product.slug}</p>
                      </button>
                    ))}
                  </div>
                )}
                {!searchLoading && searchQuery && searchResults.length === 0 && (
                  <p className="text-body-sm text-muted-foreground">Товары не найдены</p>
                )}
              </div>
            )}

            <textarea
              ref={bodyRef}
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
              placeholder="Напишите содержимое…&#10;&#10;Поддерживаемые форматы:&#10;- **жирный текст**&#10;- *курсив*&#10;- ## Заголовок&#10;- [ссылка](url)&#10;- [[product:slug]] для вставки товара"
              rows={20}
              className="w-full px-4 py-3 border border-border rounded-block bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-body-sm resize-none"
            />
          </div>

          {/* Kind */}
          <div>
            <label htmlFor="post-kind" className="block text-label font-semibold mb-2 text-foreground">
              Тип материала
            </label>
            <select
              id="post-kind"
              value={form.kind}
              onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value === 'news' ? 'news' : 'article' }))}
              className="w-full px-4 py-3 border border-border rounded-block bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="article">Статья</option>
              <option value="news">Новость</option>
            </select>
          </div>

          {/* Ad */}
          <div className="space-y-4 p-6 bg-card border border-border rounded-block">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isAd}
                onChange={(e) => setForm((prev) => ({ ...prev, isAd: e.target.checked }))}
                className="w-4 h-4 rounded border-border-strong"
              />
              <span className="text-label font-semibold text-foreground">Реклама</span>
            </label>
            {form.isAd && (
              <>
                <div>
                  <label htmlFor="post-advertiser" className="block text-label font-semibold mb-2 text-foreground">
                    Рекламодатель
                  </label>
                  <input
                    id="post-advertiser"
                    type="text"
                    value={form.advertiser}
                    onChange={(e) => setForm((prev) => ({ ...prev, advertiser: e.target.value }))}
                    className="w-full px-4 py-3 border border-border rounded-block bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="post-erid" className="block text-label font-semibold mb-2 text-foreground">
                    erid
                  </label>
                  <input
                    id="post-erid"
                    type="text"
                    value={form.erid}
                    onChange={(e) => setForm((prev) => ({ ...prev, erid: e.target.value }))}
                    className="w-full px-4 py-3 border border-border rounded-block bg-card text-foreground font-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </>
            )}
          </div>

          {/* Publish date */}
          <div>
            <label className="block text-label font-semibold mb-2 text-foreground">
              Дата публикации
            </label>
            <input
              type="datetime-local"
              value={form.publishedAt || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, publishedAt: e.target.value || null }))}
              className="w-full px-4 py-3 border border-border rounded-block bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-body-sm text-muted-foreground mt-1">
              Оставьте пусто чтобы сохранить как черновик
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-block hover:bg-primary/90 disabled:opacity-50 transition-colors font-sans font-medium"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button
              onClick={() => navigate('/admin/posts')}
              className="px-6 py-3 border border-border text-foreground rounded-block hover:bg-muted transition-colors font-sans font-medium"
            >
              Отменить
            </button>
            {!isNew && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="ml-auto px-6 py-3 bg-destructive/10 text-destructive rounded-block hover:bg-destructive/20 disabled:opacity-50 transition-colors font-sans font-medium"
              >
                Удалить
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="sticky top-6 space-y-6">
            <div className="bg-card border border-border rounded-block p-6">
              <h3 className="text-label font-semibold mb-4 text-foreground uppercase">
                Превью
              </h3>

              <div className="space-y-4">
                {form.title && (
                  <div>
                    <p className="text-h4 font-heading font-bold text-foreground">
                      {form.title}
                    </p>
                  </div>
                )}

                {form.excerpt && (
                  <p className="text-body-sm text-muted-foreground italic">
                    {form.excerpt}
                  </p>
                )}

                {form.publishedAt && (
                  <p className="text-body-sm text-muted-foreground">
                    {new Date(form.publishedAt).toLocaleDateString('ru-RU')}
                  </p>
                )}
              </div>
            </div>

            {form.body && (() => {
              const rendered = renderMarkdown(form.body, { products: [] })
              return (
                <div className="bg-card border border-border rounded-block p-6">
                  <h3 className="text-label font-semibold mb-4 text-foreground uppercase">
                    Рендер
                  </h3>
                  <div className="text-body-sm space-y-2 max-h-96 overflow-y-auto">
                    {rendered.slice(0, 5)}
                    {rendered.length > 5 && (
                      <p className="text-muted-foreground">…</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
