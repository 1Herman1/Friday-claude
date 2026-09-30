import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  adminGetProductDictionaries,
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProductFull,
  adminCreateVariant,
  adminUpdateVariantFull,
  adminDeleteVariant,
  adminUploadProductImage,
  adminDeleteProductImage,
  adminReorderProductImages,
  type ProductEditData,
  type ProductDictionaries,
  type ProductVariant,
} from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'

type Tab = 'basic' | 'description' | 'usage' | 'inci' | 'skins' | 'variants' | 'images' | 'seo'

export function AdminProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('basic')

  const [dictionaries, setDictionaries] = useState<ProductDictionaries | null>(null)
  const [formData, setFormData] = useState<Partial<ProductEditData>>({
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    brandId: null,
    lineId: null,
    categoryIds: [],
    skinTypes: [],
    concerns: [],
    images: [],
    usage: '',
    inciText: '',
    seoTitle: '',
    seoDescription: '',
    isActive: true,
    isFeatured: false,
    isProfessional: false,
    variants: [],
  })

  const [variantModal, setVariantModal] = useState<{ isOpen: boolean; data?: Partial<ProductVariant> }>({ isOpen: false })
  const [imageUpload, setImageUpload] = useState<{ loading: boolean; error: string }>({ loading: false, error: '' })

  const loadDictionaries = async () => {
    try {
      const dict = await adminGetProductDictionaries()
      setDictionaries(dict)
    } catch (err) {
      console.error('Failed to load dictionaries', err)
    }
  }

  const loadProduct = async () => {
    if (isNew) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const product = await adminGetProduct(id!)
      setFormData(product)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при загрузке товара')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([loadDictionaries(), loadProduct()])
  }, [])

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleArrayToggle = (field: 'skinTypes' | 'concerns' | 'categoryIds', value: string) => {
    setFormData((prev) => {
      const arr = prev[field] || []
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter((v) => v !== value) }
      } else {
        return { ...prev, [field]: [...arr, value] }
      }
    })
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      if (isNew) {
        const created = await adminCreateProduct({
          name: formData.name || '',
          slug: formData.slug || '',
          description: formData.description || '',
          shortDescription: formData.shortDescription || undefined,
          brandId: formData.brandId || null,
          lineId: formData.lineId || null,
          categoryIds: formData.categoryIds || [],
          skinTypes: formData.skinTypes || [],
          concerns: formData.concerns || [],
          usage: formData.usage || undefined,
          inciText: formData.inciText || undefined,
          seoTitle: formData.seoTitle || undefined,
          seoDescription: formData.seoDescription || undefined,
        })
        setSuccess('Товар создан')
        setTimeout(() => navigate(`/admin/products/${created.id}`), 1000)
      } else {
        await adminUpdateProductFull(id!, {
          name: formData.name,
          slug: formData.slug,
          shortDescription: formData.shortDescription,
          description: formData.description,
          brandId: formData.brandId,
          lineId: formData.lineId,
          categoryIds: formData.categoryIds,
          skinTypes: formData.skinTypes,
          concerns: formData.concerns,
          usage: formData.usage,
          inciText: formData.inciText,
          seoTitle: formData.seoTitle,
          seoDescription: formData.seoDescription,
          isActive: formData.isActive,
          isFeatured: formData.isFeatured,
          isProfessional: formData.isProfessional,
        })
        setSuccess('Товар сохранен')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при сохранении')
      } else {
        setError('Нет соединения с сервером')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleVariantSave = async () => {
    if (!id && isNew) {
      setError('Сначала создайте товар')
      return
    }

    try {
      const variant = variantModal.data
      if (!variant?.volumeValue || !variant?.volumeUnit || !variant?.retailPrice) {
        setError('Заполните обязательные поля фасовки')
        return
      }

      if (variant.id) {
        const updated = await adminUpdateVariantFull(variant.id, {
          volumeLabel: variant.volumeLabel || undefined,
          sku: variant.sku || undefined,
          retailPrice: variant.retailPrice,
          wholesalePrice: variant.wholesalePrice || null,
          stock: variant.stock,
          isActive: variant.isActive,
          isProfessional: variant.isProfessional,
        })
        setFormData((prev) => ({
          ...prev,
          variants: (prev.variants || []).map((v) => (v.id === variant.id ? updated : v)),
        }))
      } else {
        const created = await adminCreateVariant(id!, {
          volumeValue: variant.volumeValue,
          volumeUnit: variant.volumeUnit as any,
          volumeLabel: variant.volumeLabel || undefined,
          retailPrice: variant.retailPrice,
          wholesalePrice: variant.wholesalePrice || null,
          stock: variant.stock,
          sku: variant.sku || undefined,
          isActive: variant.isActive,
          isProfessional: variant.isProfessional,
        })
        setFormData((prev) => ({
          ...prev,
          variants: [...(prev.variants || []), created],
        }))
      }
      setVariantModal({ isOpen: false })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при сохранении фасовки')
      }
    }
  }

  const handleVariantDelete = async (variantId: string) => {
    if (!confirm('Удалить фасовку?')) return

    try {
      await adminDeleteVariant(variantId)
      setFormData((prev) => ({
        ...prev,
        variants: (prev.variants || []).filter((v) => v.id !== variantId),
      }))
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при удалении')
      }
    }
  }

  const handleImageUpload = async (file: File) => {
    if (!id && isNew) {
      setImageUpload({ loading: false, error: 'Сначала создайте товар' })
      return
    }

    setImageUpload({ loading: true, error: '' })
    try {
      const result = await adminUploadProductImage(id!, file)
      setFormData((prev) => ({
        ...prev,
        images: [...(prev.images || []), result.url],
      }))
      setImageUpload({ loading: false, error: '' })
    } catch (err: any) {
      setImageUpload({ loading: false, error: err.message || 'Ошибка при загрузке' })
    }
  }

  const handleImageDelete = async (url: string) => {
    if (!id && isNew) return

    try {
      await adminDeleteProductImage(id!, url)
      setFormData((prev) => ({
        ...prev,
        images: (prev.images || []).filter((img) => img !== url),
      }))
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при удалении фото')
      }
    }
  }

  const handleImageReorder = async (from: number, to: number) => {
    if (!id && isNew) return

    const images = [...(formData.images || [])]
    const [moved] = images.splice(from, 1)
    images.splice(to, 0, moved)

    setFormData((prev) => ({ ...prev, images }))

    try {
      await adminReorderProductImages(id!, images)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Ошибка при переставлении фото')
      }
    }
  }

  if (loading) {
    return <div className="container-app py-24 text-muted-foreground">Загрузка…</div>
  }

  const skinTypeOptions = [
    { value: 'normal', label: 'Нормальная' },
    { value: 'dry', label: 'Сухая' },
    { value: 'oily', label: 'Жирная' },
    { value: 'combination', label: 'Комбинированная' },
    { value: 'sensitive', label: 'Чувствительная' },
    { value: 'mature', label: 'Зрелая' },
    { value: 'all_types', label: 'Все типы' },
  ]

  const concernOptions = [
    { value: 'hydration', label: 'Увлажнение' },
    { value: 'anti_age', label: 'Антивозрастное' },
    { value: 'pigmentation', label: 'Пигментация' },
    { value: 'acne', label: 'Акне' },
    { value: 'sensitivity', label: 'Чувствительность' },
    { value: 'redness', label: 'Краснота' },
    { value: 'cleansing', label: 'Очищение' },
    { value: 'sun_protection', label: 'Защита от солнца' },
    { value: 'firming', label: 'Укрепление' },
    { value: 'eye_area', label: 'Область глаз' },
    { value: 'post_procedure', label: 'Постпроцедурный уход' },
    { value: 'regeneration', label: 'Регенерация' },
    { value: 'radiance', label: 'Сияние' },
    { value: 'sebum_control', label: 'Контроль кожного сала' },
    { value: 'hygiene', label: 'Гигиена' },
    { value: 'barrier', label: 'Барьерная функция' },
    { value: 'daily_care', label: 'Ежедневный уход' },
    { value: 'express_care', label: 'Экспресс-уход' },
    { value: 'intensive_care', label: 'Интенсивный уход' },
    { value: 'nourishing', label: 'Питание' },
  ]

  return (
    <div className="container-app py-12 md:py-16">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-h2 font-heading font-bold text-foreground uppercase">
          {isNew ? 'Новый товар' : 'Редактирование товара'}
        </h1>
        <button
          onClick={() => navigate('/admin/products')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Назад
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive rounded-block p-4 mb-8">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-700 rounded-block p-4 mb-8">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border overflow-x-auto">
        {[
          { id: 'basic', label: 'Основное' },
          { id: 'description', label: 'Описание' },
          { id: 'usage', label: 'Применение' },
          { id: 'inci', label: 'INCI' },
          { id: 'skins', label: 'Типы кожи' },
          { id: 'variants', label: 'Фасовки' },
          { id: 'images', label: 'Фото' },
          { id: 'seo', label: 'SEO' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`px-4 py-3 font-sans font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-8">
        {/* Basic */}
        {activeTab === 'basic' && (
          <div className="bg-card border border-border rounded-block p-6 space-y-6">
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Название
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                maxLength={200}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
              />
            </div>

            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Slug
              </label>
              <input
                type="text"
                value={formData.slug || ''}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                placeholder="latynish-slug"
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-label font-sans text-muted-foreground mb-2">
                  Бренд
                </label>
                <select
                  value={formData.brandId || ''}
                  onChange={(e) => handleInputChange('brandId', e.target.value || null)}
                  className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                >
                  <option value="">—</option>
                  {dictionaries?.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-label font-sans text-muted-foreground mb-2">
                  Линейка
                </label>
                <select
                  value={formData.lineId || ''}
                  onChange={(e) => handleInputChange('lineId', e.target.value || null)}
                  className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                >
                  <option value="">—</option>
                  {dictionaries?.lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Категории
              </label>
              <div className="space-y-2">
                {dictionaries?.categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData.categoryIds || []).includes(cat.id)}
                      onChange={() => handleArrayToggle('categoryIds', cat.id)}
                      className="w-4 h-4 rounded border-border-strong"
                    />
                    <span className="text-label font-sans text-foreground">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive || false}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="w-4 h-4 rounded border-border-strong"
                />
                <span className="text-label font-sans text-foreground">Активно</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFeatured || false}
                  onChange={(e) => handleInputChange('isFeatured', e.target.checked)}
                  className="w-4 h-4 rounded border-border-strong"
                />
                <span className="text-label font-sans text-foreground">Избранное</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isProfessional || false}
                  onChange={(e) => handleInputChange('isProfessional', e.target.checked)}
                  className="w-4 h-4 rounded border-border-strong"
                />
                <span className="text-label font-sans text-foreground">Профессиональное</span>
              </label>
            </div>
          </div>
        )}

        {/* Description */}
        {activeTab === 'description' && (
          <div className="bg-card border border-border rounded-block p-6 space-y-6">
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Краткое описание
              </label>
              <textarea
                value={formData.shortDescription || ''}
                onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                maxLength={500}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-24"
              />
            </div>

            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Полное описание
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                maxLength={20000}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-[200px]"
              />
            </div>
          </div>
        )}

        {/* Usage */}
        {activeTab === 'usage' && (
          <div className="bg-card border border-border rounded-block p-6">
            <label className="block text-label font-sans text-muted-foreground mb-2">
              Способ применения
            </label>
            <textarea
              value={formData.usage || ''}
              onChange={(e) => handleInputChange('usage', e.target.value)}
              maxLength={10000}
              className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-[150px]"
            />
          </div>
        )}

        {/* INCI */}
        {activeTab === 'inci' && (
          <div className="bg-card border border-border rounded-block p-6">
            <label className="block text-label font-sans text-muted-foreground mb-2">
              Состав INCI
            </label>
            <textarea
              value={formData.inciText || ''}
              onChange={(e) => handleInputChange('inciText', e.target.value)}
              maxLength={10000}
              className="w-full px-4 py-2 border border-border-strong rounded-block font-mono text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-[150px]"
            />
          </div>
        )}

        {/* Skin types */}
        {activeTab === 'skins' && (
          <div className="bg-card border border-border rounded-block p-6 space-y-6">
            <div>
              <h3 className="text-label font-sans font-semibold text-foreground mb-3">
                Тип кожи
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {skinTypeOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData.skinTypes || []).includes(opt.value)}
                      onChange={() => handleArrayToggle('skinTypes', opt.value)}
                      className="w-4 h-4 rounded border-border-strong"
                    />
                    <span className="text-label font-sans text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-label font-sans font-semibold text-foreground mb-3">
                Задачи
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {concernOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData.concerns || []).includes(opt.value)}
                      onChange={() => handleArrayToggle('concerns', opt.value)}
                      className="w-4 h-4 rounded border-border-strong"
                    />
                    <span className="text-label font-sans text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Variants */}
        {activeTab === 'variants' && !isNew && (
          <div className="bg-card border border-border rounded-block p-6 space-y-6">
            <button
              onClick={() => setVariantModal({ isOpen: true, data: {} })}
              className="px-6 py-2 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 transition-colors min-h-11"
            >
              + Добавить фасовку
            </button>

            {(formData.variants || []).length === 0 ? (
              <p className="text-muted-foreground">Нет фасовок</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 text-muted-foreground">Объём</th>
                      <th className="text-left px-4 py-2 text-muted-foreground">Цена розн.</th>
                      <th className="text-left px-4 py-2 text-muted-foreground">Цена опт.</th>
                      <th className="text-left px-4 py-2 text-muted-foreground">Остаток</th>
                      <th className="text-left px-4 py-2 text-muted-foreground">SKU</th>
                      <th className="text-left px-4 py-2 text-muted-foreground">Активна</th>
                      <th className="text-center px-4 py-2">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(formData.variants || []).map((v) => (
                      <tr
                        key={v.id}
                        className="hover:bg-muted cursor-pointer"
                        onClick={() => setVariantModal({ isOpen: true, data: v })}
                      >
                        <td className="px-4 py-2 text-foreground">
                          {v.volumeLabel || `${v.volumeValue} ${v.volumeUnit}`}
                        </td>
                        <td className="px-4 py-2 text-foreground">{formatPrice(v.retailPrice)}</td>
                        <td className="px-4 py-2 text-foreground">
                          {v.wholesalePrice ? formatPrice(v.wholesalePrice) : '—'}
                        </td>
                        <td className="px-4 py-2 text-foreground">{v.stock}</td>
                        <td className="px-4 py-2 text-foreground">{v.sku || '—'}</td>
                        <td className="px-4 py-2 text-foreground">
                          {v.isActive ? '✓' : ''}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleVariantDelete(v.id)
                            }}
                            className="text-destructive hover:text-destructive/80 transition-colors"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Variant Modal */}
            {variantModal.isOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-background rounded-block p-6 max-w-md w-full space-y-4">
                  <h2 className="text-h3 font-heading font-bold text-foreground">
                    {variantModal.data?.id ? 'Редактировать фасовку' : 'Новая фасовка'}
                  </h2>

                  <div>
                    <label className="block text-label font-sans text-muted-foreground mb-2">
                      Объём
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={variantModal.data?.volumeValue || ''}
                      onChange={(e) =>
                        setVariantModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, volumeValue: parseFloat(e.target.value) },
                        }))
                      }
                      className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                    />
                  </div>

                  <div>
                    <label className="block text-label font-sans text-muted-foreground mb-2">
                      Единица
                    </label>
                    <select
                      value={variantModal.data?.volumeUnit || 'ml'}
                      onChange={(e) =>
                        setVariantModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, volumeUnit: e.target.value as any },
                        }))
                      }
                      className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                    >
                      <option value="ml">мл</option>
                      <option value="g">г</option>
                      <option value="pcs">шт</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-label font-sans text-muted-foreground mb-2">
                      Метка объёма (опционально)
                    </label>
                    <input
                      type="text"
                      value={variantModal.data?.volumeLabel || ''}
                      onChange={(e) =>
                        setVariantModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, volumeLabel: e.target.value },
                        }))
                      }
                      className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                    />
                  </div>

                  <div>
                    <label className="block text-label font-sans text-muted-foreground mb-2">
                      Цена (руб)
                    </label>
                    <input
                      type="number"
                      value={variantModal.data?.retailPrice || ''}
                      onChange={(e) =>
                        setVariantModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, retailPrice: parseInt(e.target.value) },
                        }))
                      }
                      className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                    />
                  </div>

                  <div>
                    <label className="block text-label font-sans text-muted-foreground mb-2">
                      Оптовая цена (опционально)
                    </label>
                    <input
                      type="number"
                      value={variantModal.data?.wholesalePrice || ''}
                      onChange={(e) =>
                        setVariantModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, wholesalePrice: e.target.value ? parseInt(e.target.value) : null },
                        }))
                      }
                      className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                    />
                  </div>

                  <div>
                    <label className="block text-label font-sans text-muted-foreground mb-2">
                      Остаток
                    </label>
                    <input
                      type="number"
                      value={variantModal.data?.stock || ''}
                      onChange={(e) =>
                        setVariantModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, stock: parseInt(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                    />
                  </div>

                  <div>
                    <label className="block text-label font-sans text-muted-foreground mb-2">
                      SKU
                    </label>
                    <input
                      type="text"
                      value={variantModal.data?.sku || ''}
                      onChange={(e) =>
                        setVariantModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, sku: e.target.value },
                        }))
                      }
                      className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={variantModal.data?.isActive !== false}
                      onChange={(e) =>
                        setVariantModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, isActive: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-border-strong"
                    />
                    <span className="text-label font-sans text-foreground">Активна</span>
                  </label>

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => setVariantModal({ isOpen: false })}
                      className="flex-1 px-4 py-2 border border-border text-foreground rounded-block hover:bg-muted transition-colors min-h-11"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleVariantSave}
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-block hover:bg-primary/90 transition-colors min-h-11"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Images */}
        {activeTab === 'images' && !isNew && (
          <div className="bg-card border border-border rounded-block p-6 space-y-6">
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Загрузить фото
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageUpload(e.target.files[0])
                  }
                }}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
              {imageUpload.error && (
                <p className="text-destructive text-sm mt-2">{imageUpload.error}</p>
              )}
            </div>

            {(formData.images || []).length > 0 && (
              <div>
                <h3 className="text-label font-sans font-semibold text-foreground mb-4">
                  Фото
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(formData.images || []).map((img, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={img}
                        alt={`Product ${idx}`}
                        className="w-full max-w-32 h-32 object-cover rounded-block bg-muted"
                      />
                      <button
                        onClick={() => handleImageDelete(img)}
                        className="absolute top-1 right-1 bg-destructive text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                      >
                        ×
                      </button>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => idx > 0 && handleImageReorder(idx, idx - 1)}
                          disabled={idx === 0}
                          className="flex-1 text-xs py-1 border border-border rounded hover:bg-muted disabled:opacity-50"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => idx < (formData.images?.length ?? 0) - 1 && handleImageReorder(idx, idx + 1)}
                          disabled={idx === ((formData.images?.length ?? 0) - 1)}
                          className="flex-1 text-xs py-1 border border-border rounded hover:bg-muted disabled:opacity-50"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEO */}
        {activeTab === 'seo' && (
          <div className="bg-card border border-border rounded-block p-6 space-y-6">
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                SEO Title
              </label>
              <input
                type="text"
                value={formData.seoTitle || ''}
                onChange={(e) => handleInputChange('seoTitle', e.target.value)}
                maxLength={300}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11"
              />
            </div>

            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                SEO Description
              </label>
              <textarea
                value={formData.seoDescription || ''}
                onChange={(e) => handleInputChange('seoDescription', e.target.value)}
                maxLength={300}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-24"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-11"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button
          onClick={() => navigate('/admin/products')}
          className="px-6 py-2 border border-border text-foreground font-sans font-semibold rounded-block hover:bg-muted transition-colors min-h-11"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
