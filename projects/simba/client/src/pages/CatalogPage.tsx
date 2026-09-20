import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { brandsApi, categoriesApi, type SortValue } from '../lib/api'
import { useScrollDirection } from '../hooks/useScrollDirection'
import { useCategoryTree, findNode, findPath } from '../hooks/useCategoryTree'
import CatalogSearch from '../components/catalog/CatalogSearch'
import CatalogTags, { CATALOG_TAGS, catalogTagLabel, tagFitsSpecies } from '../components/catalog/CatalogTags'
import CatalogGrid from '../components/catalog/CatalogGrid'
import QuestionnaireTeaser from '../components/home/QuestionnaireTeaser'

const VALID_SORTS: SortValue[] = ['popular', 'price_asc', 'price_desc', 'newest', 'in_stock']
function isSortValue(value: unknown): value is SortValue {
  return typeof value === 'string' && VALID_SORTS.includes(value as SortValue)
}

export default function CatalogPage() {
  const { hidden } = useScrollDirection()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [activeTag, setActiveTag] = useState(searchParams.get('tag') || '')
  // Категорию и бренд читаем из URL напрямую, а не через useState: состояние
  // инициализируется один раз, поэтому клик по другому бренду с уже открытого
  // каталога менял адрес, но не выдачу.
  const category = searchParams.get('category') || ''
  const brand = searchParams.get('brand') || ''
  const format = searchParams.get('format') || ''
  const purpose = searchParams.get('purpose') || ''
  const species = searchParams.get('species') || ''
  // Сортировка живёт в URL, как остальные фильтры: раньше она сидела в локальном
  // useState внутри SortSelect и никуда оттуда не попадала — контрол переключался,
  // а выдача не менялась.
  const sortParam = searchParams.get('sort') || 'popular'
  const sort: SortValue = isSortValue(sortParam) ? sortParam : 'popular'

  // Чип другого вида в URL (например, «Для щенков» в кошачьем каталоге) даёт
  // пустую выдачу — сбрасываем его, а не показываем «ничего не найдено».
  useEffect(() => {
    const tag = CATALOG_TAGS.find(t => t.id === activeTag)
    if (tag && !tagFitsSpecies(tag, species)) setActiveTag('')
  }, [activeTag, species])

  useEffect(() => {
    const params: Record<string, string> = {}
    if (search) params.q = search
    if (activeTag) params.tag = activeTag
    if (category) params.category = category
    if (brand) params.brand = brand
    if (format) params.format = format
    if (purpose) params.purpose = purpose
    if (species) params.species = species
    if (sort && sort !== 'popular') params.sort = sort
    setSearchParams(params, { replace: true })
  }, [search, activeTag, category, brand, format, purpose, species, sort])

  const handleSortChange = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'popular') params.delete('sort')
    else params.set('sort', next)
    setSearchParams(params, { replace: true })
  }

  const handleTagClick = (tag: string) => {
    setActiveTag(prev => prev === tag ? '' : tag)
    setSearch('')
  }

  return (
    <div className="min-h-[100dvh] bg-blue-50">
      {/* Вторая строка — такая же пилюля, как шапка, только светлая: полосы на
          всю ширину с фоном по бокам больше нет, ширина и высота совпадают с
          шапкой. */}
      {/* Поиск плавает пилюлей ровно как шапка: та же ширина и высота, светлый
          фон, полосы во всю ширину с фоном по бокам больше нет. Чипы уезжают
          со страницей — иначе карточки просвечивали бы в зазоре между
          пилюлей и рядом фильтров. */}
      {/* Пилюля скрывается при скролле вниз и появляется при скролле вверх. */}
      <div className={`sticky top-[84px] z-30 px-4 pt-3 transition-[transform,opacity] duration-[220ms] ease-out ${hidden ? '-translate-y-[130%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <div className="max-w-7xl mx-auto rounded-full bg-white/85 supports-[backdrop-filter]:backdrop-blur-[8px] shadow-md h-16 flex items-center px-6 md:px-8 focus-within:ring-2 focus-within:ring-ink">
          <CatalogSearch value={search} onChange={setSearch} onClear={() => setSearch('')} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 pt-3">
        <CatalogTags activeTag={activeTag} onTagClick={handleTagClick} species={species} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <CatalogHeader
          search={search}
          activeTag={activeTag}
          category={category}
          brand={brand}
          species={species}
          sort={sort}
          onSortChange={handleSortChange}
        />
        <CatalogGrid search={search} activeTag={activeTag} category={category} brand={brand} format={format} purpose={purpose} species={species} sort={sort} />
      </div>

      <QuestionnaireTeaser />
    </div>
  )
}

function CatalogHeader({
  search, activeTag, category, brand, species, sort, onSortChange,
}: {
  search: string
  activeTag: string
  category: string
  brand: string
  species: string
  sort: string
  onSortChange: (value: string) => void
}) {
  const [brandName, setBrandName] = useState('')
  const tree = useCategoryTree()
  const path = category ? findPath(tree, category) : []
  const categoryName = category ? findNode(tree, category)?.name : ''

  useEffect(() => {
    if (!brand) {
      setBrandName('')
      return
    }
    // Без названия бренда заголовок остался бы «Все товары», и покупатель не
    // понимал бы, что выдача уже отфильтрована.
    brandsApi
      .list()
      .then((res) => setBrandName(res.data.find((b) => b.slug === brand)?.name || ''))
      .catch(() => setBrandName(''))
  }, [brand])

  const title = search
    ? `Результаты поиска: "${search}"`
    : activeTag
    ? catalogTagLabel(activeTag)
    : brand
    ? brandName || 'Товары бренда'
    : category
    ? categoryName || 'Каталог'
    : species === 'cat'
    ? 'Всё для кошек'
    : species === 'dog'
    ? 'Всё для собак'
    : 'Все товары'

  return (
    <div>
      {path.length > 0 && (
        <nav aria-label="Хлебные крошки" className="mb-2 text-sm text-navy-500 flex flex-wrap items-center gap-1.5">
          <Link to="/catalog" className="hover:text-navy-900">Каталог</Link>
          {path.map((n, i) => (
            <span key={n.id} className="flex items-center gap-1.5">
              <span aria-hidden="true">›</span>
              {i === path.length - 1 ? <span className="text-navy-900">{n.name}</span> : <Link to={`/catalog?category=${n.slug}`} className="hover:text-navy-900">{n.name}</Link>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy-900">{title}</h1>
        <SortSelect value={sort} onChange={onSortChange} />
      </div>
    </div>
  )
}

/** Без focus:outline-none/focus:border-line: они гасили кольцо фокуса и
    подменяли его цветом рамки покоя — с клавиатуры было не видно, где ты.
    Глобальное *:focus-visible в index.css справляется само. */
function SortSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="Сортировка товаров"
      className="text-sm border border-line rounded-xl px-3 py-2 bg-white text-navy-700 cursor-pointer">
      <option value="popular">По популярности</option>
      <option value="price_asc">Сначала дешевле</option>
      <option value="price_desc">Сначала дороже</option>
      <option value="newest">Новинки</option>
      <option value="in_stock">Сначала в наличии</option>
    </select>
  )
}
