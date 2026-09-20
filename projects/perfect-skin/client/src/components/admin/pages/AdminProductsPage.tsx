import { useEffect, useState } from 'react'
import { adminListVariants, adminUpdateVariant, adminUpdateProduct, adminGetPopular, adminSetPopular, searchPublicProducts, type AdminVariant, type PopularProduct } from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'

type Tab = 'variants' | 'popular'

export function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('variants')
  const [variants, setVariants] = useState<AdminVariant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 20

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await adminListVariants({
        search: search || undefined,
        lowStock: lowStockOnly || undefined,
        offset,
        limit,
      })
      setVariants(result.items)
      setTotal(result.total)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при загрузке товаров')
      } else {
        setError('Нет соединения с сервером')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [lowStockOnly, offset])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    load()
  }

  const handleNext = () => {
    if (offset + limit < total) {
      setOffset(offset + limit)
    }
  }

  const handlePrev = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit))
    }
  }

  return (
    <div className="container-app py-12 md:py-16">
      <h1 className="text-h2 font-heading font-bold text-foreground mb-8 uppercase">
        Товары
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border">
        <button
          onClick={() => {
            setActiveTab('variants')
            setOffset(0)
          }}
          className={`px-4 py-3 font-sans font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'variants'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Варианты
        </button>
        <button
          onClick={() => setActiveTab('popular')}
          className={`px-4 py-3 font-sans font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'popular'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Популярные
        </button>
      </div>

      {/* Content by tab */}
      {activeTab === 'variants' && (
        <>
      {/* Filters */}
      <div className="bg-card border border-border rounded-block p-6 mb-8">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label
                htmlFor="search"
                className="block text-label font-sans text-muted-foreground mb-2"
              >
                Поиск
              </label>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Название или SKU…"
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground placeholder:text-muted-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Submit */}
            <div className="flex items-end gap-4">
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 transition-colors min-h-11"
              >
                Поиск
              </button>
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="lowStock"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked)
                setOffset(0)
              }}
              className="w-4 h-4 rounded border-border-strong cursor-pointer"
            />
            <label htmlFor="lowStock" className="text-label font-sans text-foreground cursor-pointer">
              Только заканчивающиеся (≤ 3)
            </label>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-block mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-block overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Товар
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Объём
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Цена
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Опт, ₽
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Остаток
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Активен
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Для кабинета
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : variants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    Нет товаров
                  </td>
                </tr>
              ) : (
                variants.map((variant, idx) => {
                  const isFirstVariant = idx === 0 || variants[idx - 1].productId !== variant.productId
                  return (
                    <VariantRow
                      key={variant.id}
                      variant={variant}
                      onUpdate={() => load()}
                      productId={variant.productId}
                      isFirstVariant={isFirstVariant}
                      isProfessional={variant.product?.isProfessional}
                    />
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && variants.length > 0 && (
        <div className="flex items-center justify-between text-sm font-sans text-muted-foreground">
          <div>
            Показано {offset + 1}–{Math.min(offset + limit, total)} из {total}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrev}
              disabled={offset === 0}
              className="px-4 py-2 border border-border rounded-block text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-11"
            >
              Назад
            </button>
            <button
              onClick={handleNext}
              disabled={offset + limit >= total}
              className="px-4 py-2 border border-border rounded-block text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-11"
            >
              Дальше
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {activeTab === 'popular' && (
        <PopularTab />
      )}
    </div>
  )
}

// ──────────────────────────────── Вкладка "Популярные" ────────────────────────────────

function PopularTab() {
  const [popular, setPopular] = useState<PopularProduct[]>([])
  const [localOrder, setLocalOrder] = useState<PopularProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; slug: string; image: string | null; minPrice: number }>>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminGetPopular()
      setPopular(data)
      setLocalOrder(data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка загрузки'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const results = await searchPublicProducts(q)
      // Filter out already pinned products
      const pinnedIds = new Set(localOrder.map((p) => p.id))
      setSearchResults(results.filter((r) => !pinnedIds.has(r.id)))
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAddProduct = (product: (typeof searchResults)[0]) => {
    setLocalOrder([
      ...localOrder,
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.image,
        minPrice: product.minPrice,
        popularPin: localOrder.length + 1,
      },
    ])
    setSearchQuery('')
    setSearchResults([])
  }

  const handleRemoveProduct = (id: string) => {
    setLocalOrder(localOrder.filter((p) => p.id !== id))
  }

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const arr = [...localOrder]
      ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
      setLocalOrder(arr)
    }
  }

  const handleMoveDown = (index: number) => {
    if (index < localOrder.length - 1) {
      const arr = [...localOrder]
      ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
      setLocalOrder(arr)
    }
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const ids = localOrder.map((p) => p.id)
      await adminSetPopular(ids)
      setSuccess('Порядок сохранён')
      setTimeout(() => setSuccess(''), 3000)
      await load()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка при сохранении'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const canSave = JSON.stringify(localOrder.map((p) => p.id)) !== JSON.stringify(popular.map((p) => p.id))

  return (
    <>
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-block mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-success/10 text-success p-4 rounded-block mb-6">
          {success}
        </div>
      )}

      {/* Search box */}
      <div className="bg-card border border-border rounded-block p-6 mb-8">
        <h2 className="text-lg font-heading font-bold text-foreground mb-4">Добавить товар</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Поиск товара…"
            className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground placeholder:text-muted-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
          />

          {searchLoading && (
            <div className="text-sm text-muted-foreground">Поиск…</div>
          )}

          {searchResults.length > 0 && (
            <div className="border border-border rounded-block max-h-60 overflow-y-auto">
              {searchResults.map((product) => (
                <div
                  key={product.id}
                  className="p-3 border-b border-border last:border-b-0 hover:bg-muted flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground truncate">
                      {product.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatPrice(product.minPrice)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddProduct(product)}
                    className="px-3 py-1 bg-primary text-primary-foreground font-sans text-xs font-semibold rounded-block hover:bg-primary/90"
                  >
                    Добавить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* List of popular products */}
      <div className="bg-card border border-border rounded-block p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-heading font-bold text-foreground">
            Закреплённые товары ({localOrder.length})
          </h2>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-6 py-2 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение…' : 'Сохранить порядок'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка…</div>
        ) : localOrder.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Нет закреплённых товаров</div>
        ) : (
          <ol className="space-y-2">
            {localOrder.map((product, index) => (
              <li
                key={product.id}
                className="flex items-center gap-4 p-4 border border-border rounded-block hover:bg-muted transition-colors"
              >
                <span className="text-lg font-heading font-bold text-muted-foreground w-8 text-right">
                  {index + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">{product.name}</div>
                  <div className="text-xs text-muted-foreground">{formatPrice(product.minPrice)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Вверх"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === localOrder.length - 1}
                    className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Вниз"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRemoveProduct(product.id)}
                    className="p-2 text-destructive hover:text-destructive/80"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}

// ──────────────────────────────── Строка варианта ────────────────────────────────

interface VariantRowProps {
  variant: AdminVariant
  onUpdate: () => void
  isProfessional?: boolean
  productId?: string
  isFirstVariant?: boolean
}

function VariantRow({ variant, onUpdate, isProfessional, productId, isFirstVariant }: VariantRowProps) {
  const [priceEdit, setPriceEdit] = useState(false)
  const [priceValue, setPriceValue] = useState(formatPriceForInput(variant.retailPrice))
  const [priceError, setPriceError] = useState('')
  const [priceSaving, setPriceSaving] = useState(false)
  const [priceFlash, setPriceFlash] = useState(false)

  const [wholesaleEdit, setWholesaleEdit] = useState(false)
  const [wholesaleValue, setWholesaleValue] = useState(formatPriceForInput(variant.wholesalePrice || 0))
  const [wholesaleError, setWholesaleError] = useState('')
  const [wholesaleSaving, setWholesaleSaving] = useState(false)
  const [wholesaleFlash, setWholesaleFlash] = useState(false)

  const [stockEdit, setStockEdit] = useState(false)
  const [stockValue, setStockValue] = useState(String(variant.stock))
  const [stockError, setStockError] = useState('')
  const [stockSaving, setStockSaving] = useState(false)
  const [stockFlash, setStockFlash] = useState(false)

  const [isActiveSaving, setIsActiveSaving] = useState(false)
  const [isActiveFlash, setIsActiveFlash] = useState(false)

  const [isProfessionalSaving, setIsProfessionalSaving] = useState(false)
  const [isProfessionalFlash, setIsProfessionalFlash] = useState(false)

  const handleToggleProfessional = async () => {
    if (!productId || !isFirstVariant) return
    try {
      setIsProfessionalSaving(true)
      await adminUpdateProduct(productId, { isProfessional: !isProfessional })
      setIsProfessionalFlash(true)
      setTimeout(() => setIsProfessionalFlash(false), 600)
      onUpdate()
    } catch (err) {
      console.error('Failed to update professional status:', err)
    } finally {
      setIsProfessionalSaving(false)
    }
  }

  const handlePriceBlur = async () => {
    setPriceError('')
    const trimmed = priceValue.trim()
    if (!trimmed) {
      setPriceEdit(false)
      setPriceValue(formatPriceForInput(variant.retailPrice))
      return
    }

    try {
      const kopecks = parsePrice(trimmed)
      if (kopecks <= 0) {
        setPriceError('Цена должна быть больше 0')
        return
      }

      if (kopecks === variant.retailPrice) {
        setPriceEdit(false)
        return
      }

      setPriceSaving(true)
      await adminUpdateVariant(variant.id, { retailPrice: kopecks })
      setPriceFlash(true)
      setTimeout(() => setPriceFlash(false), 600)
      setPriceEdit(false)
      onUpdate()
    } catch (err) {
      if (err instanceof ApiError) {
        setPriceError(err.message || 'Ошибка при сохранении')
      } else {
        setPriceError('Ошибка при сохранении')
      }
    } finally {
      setPriceSaving(false)
    }
  }

  const handleWholesaleBlur = async () => {
    setWholesaleError('')
    const trimmed = wholesaleValue.trim()
    if (!trimmed) {
      setWholesaleEdit(false)
      setWholesaleValue(formatPriceForInput(variant.wholesalePrice || 0))
      return
    }

    try {
      const kopecks = parsePrice(trimmed)
      if (kopecks < 0) {
        setWholesaleError('Цена не может быть отрицательной')
        return
      }

      if (kopecks === (variant.wholesalePrice || 0)) {
        setWholesaleEdit(false)
        return
      }

      setWholesaleSaving(true)
      await adminUpdateVariant(variant.id, { wholesalePrice: kopecks })
      setWholesaleFlash(true)
      setTimeout(() => setWholesaleFlash(false), 600)
      setWholesaleEdit(false)
      onUpdate()
    } catch (err) {
      if (err instanceof ApiError) {
        setWholesaleError(err.message || 'Ошибка при сохранении')
      } else {
        setWholesaleError('Ошибка при сохранении')
      }
    } finally {
      setWholesaleSaving(false)
    }
  }

  const handleStockBlur = async () => {
    setStockError('')
    const trimmed = stockValue.trim()
    if (!trimmed) {
      setStockEdit(false)
      setStockValue(String(variant.stock))
      return
    }

    try {
      const num = parseInt(trimmed, 10)
      if (isNaN(num) || num < 0) {
        setStockError('Остаток должен быть числом ≥ 0')
        return
      }

      if (num === variant.stock) {
        setStockEdit(false)
        return
      }

      setStockSaving(true)
      await adminUpdateVariant(variant.id, { stock: num })
      setStockFlash(true)
      setTimeout(() => setStockFlash(false), 600)
      setStockEdit(false)
      onUpdate()
    } catch (err) {
      if (err instanceof ApiError) {
        setStockError(err.message || 'Ошибка при сохранении')
      } else {
        setStockError('Ошибка при сохранении')
      }
    } finally {
      setStockSaving(false)
    }
  }

  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePriceBlur()
    }
  }

  const handleWholesaleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleWholesaleBlur()
    }
  }

  const handleStockKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStockBlur()
    }
  }

  const handleToggleActive = async () => {
    try {
      setIsActiveSaving(true)
      await adminUpdateVariant(variant.id, { isActive: !variant.isActive })
      setIsActiveFlash(true)
      setTimeout(() => setIsActiveFlash(false), 600)
      onUpdate()
    } catch (err) {
      // Error shown at page level
    } finally {
      setIsActiveSaving(false)
    }
  }

  const lowStockClass = variant.stock <= 3 ? 'bg-destructive/10' : ''
  const priceFlashClass = priceFlash ? 'animate-pulse bg-success/20' : ''
  const stockFlashClass = stockFlash ? 'animate-pulse bg-success/20' : ''
  const isActiveFlashClass = isActiveFlash ? 'animate-pulse bg-success/20' : ''

  return (
    <tr key={variant.id} className="border-b border-border hover:bg-muted/30">
      {/* Product */}
      <td className="px-6 py-4 text-foreground">
        <div className="font-semibold">{variant.product.name}</div>
        {variant.product.brand && (
          <div className="text-xs text-muted-foreground">{variant.product.brand.name}</div>
        )}
        {variant.sku && (
          <div className="text-xs text-muted-foreground">SKU: {variant.sku}</div>
        )}
      </td>

      {/* Volume */}
      <td className="px-6 py-4 text-foreground text-sm">
        {variant.volumeLabel}
      </td>

      {/* Price */}
      <td className={`px-6 py-4 text-foreground font-semibold tabular-nums transition-colors ${priceFlashClass}`}>
        {priceEdit ? (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={priceValue}
              onChange={(e) => {
                setPriceValue(e.target.value)
                setPriceError('')
              }}
              onBlur={handlePriceBlur}
              onKeyDown={handlePriceKeyDown}
              placeholder="0,00"
              disabled={priceSaving}
              autoFocus
              className="px-2 py-1 border border-border rounded text-sm bg-background text-foreground focus:outline-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            {priceError && (
              <div className="text-xs text-destructive">{priceError}</div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setPriceEdit(true)
              setPriceValue(formatPriceForInput(variant.retailPrice))
              setPriceError('')
            }}
            className="text-primary hover:underline focus-visible:outline-ring text-left"
          >
            {formatPrice(variant.retailPrice)}
          </button>
        )}
      </td>

      {/* Wholesale Price */}
      <td className={`px-6 py-4 text-foreground tabular-nums transition-colors ${wholesaleFlash ? 'bg-success/20' : ''}`}>
        {wholesaleEdit ? (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={wholesaleValue}
              onChange={(e) => {
                setWholesaleValue(e.target.value)
                setWholesaleError('')
              }}
              onBlur={handleWholesaleBlur}
              onKeyDown={handleWholesaleKeyDown}
              placeholder="0,00"
              disabled={wholesaleSaving}
              autoFocus
              className="px-2 py-1 border border-border rounded text-sm bg-background text-foreground focus:outline-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            {wholesaleError && (
              <div className="text-xs text-destructive">{wholesaleError}</div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setWholesaleEdit(true)
              setWholesaleValue(formatPriceForInput(variant.wholesalePrice || 0))
              setWholesaleError('')
            }}
            className="text-primary hover:underline focus-visible:outline-ring text-left"
          >
            {variant.wholesalePrice ? formatPrice(variant.wholesalePrice) : '—'}
          </button>
        )}
      </td>

      {/* Stock */}
      <td className={`px-6 py-4 text-foreground tabular-nums transition-colors ${lowStockClass} ${stockFlashClass}`}>
        {stockEdit ? (
          <div className="flex flex-col gap-1">
            <input
              type="number"
              value={stockValue}
              onChange={(e) => {
                setStockValue(e.target.value)
                setStockError('')
              }}
              onBlur={handleStockBlur}
              onKeyDown={handleStockKeyDown}
              disabled={stockSaving}
              autoFocus
              className="px-2 py-1 border border-border rounded text-sm bg-background text-foreground focus:outline-ring focus:ring-1 focus:ring-ring disabled:opacity-50 w-20"
            />
            {stockError && (
              <div className="text-xs text-destructive">{stockError}</div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setStockEdit(true)
              setStockValue(String(variant.stock))
              setStockError('')
            }}
            className="text-primary hover:underline focus-visible:outline-ring"
          >
            {variant.stock}
          </button>
        )}
      </td>

      {/* Is Active */}
      <td className={`px-6 py-4 transition-colors ${isActiveFlashClass}`}>
        <div className="flex items-center min-h-11">
          <button
            onClick={handleToggleActive}
            disabled={isActiveSaving}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
              variant.isActive
                ? 'bg-success'
                : 'bg-muted'
            } ${isActiveSaving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
            aria-label={variant.isActive ? 'Деактивировать' : 'Активировать'}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                variant.isActive ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </td>

      {/* Is Professional (product-level, shown only on first variant) */}
      <td className={`px-6 py-4 transition-colors ${isProfessionalFlash ? 'animate-pulse bg-success/20' : ''}`}>
        {isFirstVariant && (
          <div className="flex items-center min-h-11">
            <button
              onClick={handleToggleProfessional}
              disabled={isProfessionalSaving}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                isProfessional
                  ? 'bg-success'
                  : 'bg-muted'
              } ${isProfessionalSaving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              aria-label={isProfessional ? 'Убрать из профессиональных' : 'Добавить в профессиональные'}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  isProfessional ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ──────────────────────────────── Утилиты ────────────────────────────────

/**
 * Преобразует копейки (число) в строку формата "1990,50"
 */
function formatPriceForInput(kopecks: number): string {
  const rubles = kopecks / 100
  const parts = rubles.toString().split('.')
  const wholePart = parts[0]
  const fractionalPart = (parts[1] || '').padEnd(2, '0').slice(0, 2)
  return `${wholePart},${fractionalPart}`
}

/**
 * Преобразует строку "1990,50" в копейки (число)
 */
function parsePrice(input: string): number {
  // Заменяем запятую на точку для парсинга
  const normalized = input.replace(',', '.')
  const rubles = parseFloat(normalized)
  if (isNaN(rubles)) {
    throw new Error('Неверный формат цены')
  }
  return Math.round(rubles * 100)
}
