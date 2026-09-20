import { useState, useEffect, useCallback } from 'react'
import { productsApi, type Product, type SortValue } from '../../lib/api'
import ProductCard from './ProductCard'
import { pluralize } from '../../lib/format'
import EmptyCatalog from './EmptyCatalog'

type ListParams = NonNullable<Parameters<typeof productsApi.list>[0]>

const VALID_SORTS: SortValue[] = ['popular', 'price_asc', 'price_desc', 'newest', 'in_stock']
function isSortValue(value: unknown): value is SortValue {
  return typeof value === 'string' && VALID_SORTS.includes(value as SortValue)
}

interface Props {
  search: string
  activeTag: string
  category: string
  brand?: string
  format?: string
  purpose?: string
  species?: string
  sort?: string
}

const PAGE_SIZE = 24

export default function CatalogGrid({ search, activeTag, category, brand, format, purpose, species, sort }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)

  const buildParams = useCallback(
    (targetPage: number): ListParams => {
      const params: ListParams = { page: targetPage, limit: PAGE_SIZE }
      if (search) params.search = search
      if (activeTag) params.tags = [activeTag]
      if (category) params.category = category
      if (brand) params.brand = brand
      if (format === 'dry' || format === 'wet') params.format = format
      if (purpose === 'medical') params.purpose = purpose
      if (species === 'cat' || species === 'dog') params.species = species
      if (sort && sort !== 'popular' && isSortValue(sort)) params.sort = sort
      return params
    },
    [search, activeTag, category, brand, format, purpose, species, sort],
  )

  // Смена любого фильтра — это новая выдача: страницу сбрасываем и грузим заново.
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      setPage(1)
      try {
        const res = await productsApi.list(buildParams(1))
        setProducts(res.data.items)
        setTotal(res.data.total)
      } catch {
        setProducts([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [buildParams])

  // Догрузка ДОПИСЫВАЕТ товары к уже показанным: подменять всю сетку скелетоном
  // на «Показать ещё» нельзя — покупатель потеряет то, что уже просматривал.
  const loadMore = async () => {
    const next = page + 1
    setLoadingMore(true)
    try {
      const res = await productsApi.list(buildParams(next))
      setProducts(prev => [...prev, ...res.data.items])
      setTotal(res.data.total)
      setPage(next)
    } catch {
      /* оставляем показанное как есть — молча теряют только неудачную догрузку */
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-72 animate-pulse" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    // Пустой раздел и пустая выдача по фильтрам — разные истории, и текст должен
    // их различать: в первом случае покупатель ничего не делал не так.
    const sectionEmpty = !search && !activeTag && !format && !purpose && Boolean(category || brand || species)
    return <EmptyCatalog sectionEmpty={sectionEmpty} />
  }

  const hasMore = products.length < total

  return (
    <>
      <p className="text-sm text-navy-500 mb-4">{pluralize(total, 'товар', 'товара', 'товаров')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-outline px-8 py-3 rounded-xl font-semibold disabled:opacity-60"
          >
            {loadingMore ? 'Загружаем…' : 'Показать ещё'}
          </button>
          <p className="text-sm text-navy-500">
            Показано {products.length} из {total}
          </p>
        </div>
      )}
    </>
  )
}
