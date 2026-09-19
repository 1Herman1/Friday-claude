import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { productsApi, categoriesApi, brandsApi, type CategoryNode, type Brand } from '../../lib/api'

interface FlatCategory {
  id: string
  name: string
  depth: number
}

const flattenCategories = (categories: CategoryNode[], depth = 0): FlatCategory[] => {
  let result: FlatCategory[] = []
  for (const cat of categories) {
    result.push({ id: cat.id, name: cat.name, depth })
    if (cat.children?.length > 0) {
      result = result.concat(flattenCategories(cat.children, depth + 1))
    }
  }
  return result
}

interface VariantDraft {
  id?: string
  weight: string
  price: string
  oldPrice: string
  stock: string
  sku: string
}

const emptyVariant = (): VariantDraft => ({ weight: '', price: '', oldPrice: '', stock: '0', sku: '' })

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id && id !== 'new'

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<FlatCategory[]>([])
  const [brands, setBrands] = useState<Brand[]>([])

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [brandId, setBrandId] = useState('')
  const [images, setImages] = useState('')
  const [isGrainFree, setIsGrainFree] = useState(false)
  const [isHypoallergenic, setIsHypoallergenic] = useState(false)
  const [isWeightControl, setIsWeightControl] = useState(false)
  const [isFeatured, setIsFeatured] = useState(false)
  const [species, setSpecies] = useState<'cat' | 'dog' | 'both' | 'unknown'>('unknown')
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [ash, setAsh] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()])
  const [error, setError] = useState('')
  const [showAboutTab, setShowAboutTab] = useState(true)
  const [showSpecsTab, setShowSpecsTab] = useState(true)
  const [showReviewsTab, setShowReviewsTab] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [hiddenManually, setHiddenManually] = useState(false)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [visibilityMessage, setVisibilityMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    Promise.all([categoriesApi.list(), brandsApi.list()])
      .then(([c, b]) => { setCategories(flattenCategories(c.data.items)); setBrands(b.data) })
  }, [])

  useEffect(() => {
    if (!isEdit) return
    productsApi.byId(id!)
      .then(({ data: p }) => {
        setName(p.name)
        setSlug(p.slug)
        setDescription(p.description)
        setBrandId(p.brandId ?? '')
        setImages(p.images.join('\n'))
        setIsGrainFree(p.isGrainFree)
        setIsHypoallergenic(p.isHypoallergenic)
        setIsWeightControl(p.isWeightControl)
        setIsFeatured(p.isFeatured || false)
        setSpecies(p.species ?? 'unknown')
        setProtein(p.protein != null ? String(p.protein) : '')
        setFat(p.fat != null ? String(p.fat) : '')
        setFiber(p.fiber != null ? String(p.fiber) : '')
        setAsh(p.ash != null ? String(p.ash) : '')
        setIngredients(p.ingredients ?? '')
        setSeoTitle(p.seoTitle ?? '')
        setSeoDescription(p.seoDescription ?? '')
        setShowAboutTab(p.showAboutTab !== false)
        setShowSpecsTab(p.showSpecsTab !== false)
        setShowReviewsTab(p.showReviewsTab !== false)
        setIsActive(p.isActive)
        setHiddenManually(p.hiddenManually)
        setSelectedCategories(p.categories.map(c => c.categoryId))
        setVariants(p.variants.map(v => ({
          id: v.id,
          weight: String(v.weight),
          price: String(v.price / 100),
          oldPrice: v.oldPrice != null ? String(v.oldPrice / 100) : '',
          stock: String(v.stock),
          sku: v.sku ?? '',
        })))
      })
      .catch(() => setLoadError('Не удалось загрузить товар'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const autoSlug = (n: string) =>
    n.toLowerCase().replace(/[а-яё]/g, c => ({
      а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
      к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
      х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
    }[c] ?? c)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleNameChange = (v: string) => {
    setName(v)
    if (!isEdit) setSlug(autoSlug(v))
  }

  const addVariant = () => setVariants(prev => [...prev, emptyVariant()])
  const removeVariant = (i: number) => setVariants(prev => prev.filter((_, idx) => idx !== i))
  const updateVariant = (i: number, field: keyof VariantDraft, value: string) =>
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v))

  const toggleCategory = (catId: string) =>
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    )

  const handleToggleVisibility = async (newIsActive: boolean) => {
    if (!isEdit) return
    setTogglingVisibility(true)
    setVisibilityMessage('')
    try {
      await productsApi.setVisibility(id!, newIsActive)
      setIsActive(newIsActive)
      setHiddenManually(!newIsActive)
      setVisibilityMessage(newIsActive ? 'Товар опубликован' : 'Товар скрыт')
      setTimeout(() => setVisibilityMessage(''), 2000)
    } catch (e) {
      setError('Ошибка при изменении видимости')
    } finally {
      setTogglingVisibility(false)
    }
  }

  const handleSave = async () => {
    setError('')
    if (!name.trim()) { setError('Введите название товара'); return }
    if (!slug.trim()) { setError('Введите slug'); return }
    if (variants.some(v => !v.weight || !v.price)) {
      setError('Заполните вес и цену для всех вариантов')
      return
    }

    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || name.trim(),
        brandId: brandId || undefined,
        images: images.split('\n').map(s => s.trim()).filter(Boolean),
        isGrainFree,
        isHypoallergenic,
        isWeightControl,
        isFeatured,
        species,
        protein: protein ? parseFloat(protein) : undefined,
        fat: fat ? parseFloat(fat) : undefined,
        fiber: fiber ? parseFloat(fiber) : undefined,
        ash: ash ? parseFloat(ash) : undefined,
        ingredients: ingredients || undefined,
        seoTitle: seoTitle || undefined,
        seoDescription: seoDescription || undefined,
        showAboutTab,
        showSpecsTab,
        showReviewsTab,
        categoryIds: selectedCategories,
        variants: variants.map(v => ({
          weight: parseFloat(v.weight),
          price: Math.round(parseFloat(v.price) * 100),
          oldPrice: v.oldPrice ? Math.round(parseFloat(v.oldPrice) * 100) : undefined,
          stock: parseInt(v.stock) || 0,
          sku: v.sku || undefined,
        })),
      }

      if (isEdit) {
        await productsApi.update(id!, data)
      } else {
        await productsApi.create(data)
      }

      navigate('/products')
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-3xl">
        <button onClick={() => navigate('/products')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm mb-5">
          Назад к товарам
        </button>
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/products')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm mb-5">
        Назад к товарам
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Редактировать товар' : 'Новый товар'}
        </h1>
        {isEdit && (
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {isActive ? 'Активен' : 'Скрыт'}
            </span>
            <button
              onClick={() => handleToggleVisibility(!isActive)}
              disabled={togglingVisibility}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {togglingVisibility ? '...' : isActive ? 'Скрыть с сайта' : 'Показать на сайте'}
            </button>
            {visibilityMessage && (
              <span className="text-xs text-green-600 font-medium">{visibilityMessage}</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Основное</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input value={name} onChange={e => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL) *</label>
              <input value={slug} onChange={e => setSlug(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Бренд</label>
              <select value={brandId} onChange={e => setBrandId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
                <option value="">— Без бренда —</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="species-select" className="block text-sm font-medium text-gray-700 mb-1">Вид животного</label>
              <select id="species-select" value={species} onChange={e => setSpecies(e.target.value as 'cat' | 'dog' | 'both' | 'unknown')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
                <option value="unknown">Не задан</option>
                <option value="cat">Кошки</option>
                <option value="dog">Собаки</option>
                <option value="both">Универсальный — уход, аксессуары</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Не задан — товар не попадёт в разделы «Для кошек» и «Для собак» и в меню сайта</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Изображения (URL, по одному на строку)</label>
              <textarea value={images} onChange={e => setImages(e.target.value)} rows={2} placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
            </div>
          </div>
        </div>

        {/* About tab */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Вкладка „О товаре"</h2>
          <p className="text-xs text-gray-500 mb-4">Показывается на странице товара во вкладке „О товаре": описание, белки/жиры/клетчатка/зола и состав</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Белок %', value: protein, set: setProtein },
                { label: 'Жир %', value: fat, set: setFat },
                { label: 'Клетчатка %', value: fiber, set: setFiber },
                { label: 'Зола %', value: ash, set: setAsh },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input type="number" step="0.1" value={f.value} onChange={e => f.set(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Состав</label>
              <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} rows={2}
                placeholder="Курица, рис, морковь..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>
          </div>
        </div>

        {/* Specs tab */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Вкладка „Характеристики"</h2>
          <p className="text-xs text-gray-500 mb-4">Вкладка „Характеристики" показывает бренд и те же четыре показателя; отдельных полей пока нет</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showAboutTab} onChange={e => setShowAboutTab(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm text-gray-700">Показывать вкладку „О товаре"</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showSpecsTab} onChange={e => setShowSpecsTab(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm text-gray-700">Показывать вкладку „Характеристики"</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showReviewsTab} onChange={e => setShowReviewsTab(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm text-gray-700">Показывать вкладку „Отзывы"</span>
            </label>
            <p className="text-xs text-gray-500 mt-2">Отзывы общие для всех товаров, управляются в разделе „Отзывы"</p>
          </div>
        </div>

        {/* Variants */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Варианты (фасовки)</h2>
            <button onClick={addVariant} className="text-sm text-blue-600 hover:underline font-medium">+ Добавить</button>
          </div>
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Вес (кг) *</label>
                  <input type="number" step="0.1" value={v.weight} onChange={e => updateVariant(i, 'weight', e.target.value)}
                    placeholder="1.5"
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Цена ₽ *</label>
                  <input type="number" value={v.price} onChange={e => updateVariant(i, 'price', e.target.value)}
                    placeholder="499"
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Старая цена ₽</label>
                  <input type="number" value={v.oldPrice} onChange={e => updateVariant(i, 'oldPrice', e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Остаток</label>
                  <input type="number" value={v.stock} onChange={e => updateVariant(i, 'stock', e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Артикул</label>
                    <input value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  {variants.length > 1 && (
                    <button onClick={() => removeVariant(i)} className="mt-5 text-red-400 hover:text-red-600 text-xs">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Tags */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Свойства</h2>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Без зерна', value: isGrainFree, set: setIsGrainFree },
              { label: 'Гипоаллергенный', value: isHypoallergenic, set: setIsHypoallergenic },
              { label: 'Контроль веса', value: isWeightControl, set: setIsWeightControl },
              { label: 'Рекомендуемый', value: isFeatured, set: setIsFeatured },
            ].map(f => (
              <label key={f.label} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={f.value} onChange={e => f.set(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600" />
                <span className="text-sm text-gray-700">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Категории</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    selectedCategories.includes(cat.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {'— '.repeat(cat.depth)}{cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SEO */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">SEO</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : isEdit ? 'Сохранить изменения' : 'Создать товар'}
          </button>
          <button
            onClick={() => navigate('/products')}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
