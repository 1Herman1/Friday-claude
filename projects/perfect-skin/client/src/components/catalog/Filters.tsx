import { useState } from 'react'
import type { Facets, FacetGroup } from '@/types/api'
import { formatPrice } from '@/lib/format'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface FiltersProps {
  facets: Facets | null
  selectedFilters: {
    category?: string
    brand?: string[]
    line?: string[]
    need?: string[]
    skin?: string[]
    minPrice?: number
    maxPrice?: number
  }
  onFilterChange: (filters: any) => void
  showCategories?: boolean
}

function FacetCheckboxGroup({
  label,
  facets,
  selectedValues,
  onSelect,
  disabled,
}: {
  label: string
  facets: FacetGroup[]
  selectedValues: string[]
  onSelect: (values: string[]) => void
  disabled?: boolean
}) {
  return (
    <div className="border-b border-border py-1 last:border-b-0">
      <h3 className="font-sans font-bold text-foreground text-sm mb-3">{label}</h3>
      <div className="space-y-2">
        {facets.map(facet => (
          <label
            key={facet.value}
            className="flex items-center gap-3 cursor-pointer min-h-10"
          >
            <input
              type="checkbox"
              checked={selectedValues.includes(facet.value)}
              onChange={e => {
                const newValues = e.target.checked
                  ? [...selectedValues, facet.value]
                  : selectedValues.filter(v => v !== facet.value)
                onSelect(newValues)
              }}
              disabled={facet.count === 0 || disabled}
              className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className={`text-sm ${facet.count === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
              {facet.label}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">({facet.count})</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function Filters({
  facets,
  selectedFilters,
  onFilterChange,
  showCategories = false,
}: FiltersProps) {
  const [minPrice, setMinPrice] = useState(selectedFilters.minPrice || '')
  const [maxPrice, setMaxPrice] = useState(selectedFilters.maxPrice || '')
  const [isOpen, setIsOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const activeFilterCount = [
    selectedFilters.category ? 1 : 0,
    selectedFilters.brand?.length || 0,
    selectedFilters.line?.length || 0,
    selectedFilters.need?.length || 0,
    selectedFilters.skin?.length || 0,
    minPrice ? 1 : 0,
    maxPrice ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const handlePriceChange = () => {
    onFilterChange({
      ...selectedFilters,
      minPrice: minPrice ? parseInt(String(minPrice)) * 100 : undefined,
      maxPrice: maxPrice ? parseInt(String(maxPrice)) * 100 : undefined,
    })
  }

  const content = (
    <div className="space-y-4">
      {showCategories && facets?.categories && (
        <FacetCheckboxGroup
          label="Категория"
          facets={facets.categories}
          selectedValues={selectedFilters.category ? [selectedFilters.category] : []}
          onSelect={values => {
            onFilterChange({
              ...selectedFilters,
              category: values[0] || undefined,
              offset: 0,
            })
          }}
        />
      )}

      {facets?.brands && (
        <FacetCheckboxGroup
          label="Бренд"
          facets={facets.brands}
          selectedValues={selectedFilters.brand || []}
          onSelect={values => {
            onFilterChange({
              ...selectedFilters,
              brand: values.length ? values : undefined,
              offset: 0,
            })
          }}
        />
      )}

      {facets?.lines && (
        <FacetCheckboxGroup
          label="Линейка"
          facets={facets.lines}
          selectedValues={selectedFilters.line || []}
          onSelect={values => {
            onFilterChange({
              ...selectedFilters,
              line: values.length ? values : undefined,
              offset: 0,
            })
          }}
        />
      )}

      {facets?.needs && (
        <FacetCheckboxGroup
          label="Потребности"
          facets={facets.needs}
          selectedValues={selectedFilters.need || []}
          onSelect={values => {
            onFilterChange({
              ...selectedFilters,
              need: values.length ? values : undefined,
              offset: 0,
            })
          }}
        />
      )}

      {facets?.skinTypes && (
        <FacetCheckboxGroup
          label="Тип кожи"
          facets={facets.skinTypes}
          selectedValues={selectedFilters.skin || []}
          onSelect={values => {
            onFilterChange({
              ...selectedFilters,
              skin: values.length ? values : undefined,
              offset: 0,
            })
          }}
        />
      )}

      {facets?.price && (
        <div className="border-b border-border py-1 last:border-b-0">
          <h3 className="font-sans font-bold text-foreground text-sm mb-3">Цена, ₽</h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="От" id="price-min" aria-label="Цена от, рублей"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                onBlur={handlePriceChange}
                className="flex-1 px-3 py-0.5 border border-border rounded text-sm min-h-10"
              />
              <input
                type="number"
                placeholder="До" id="price-max" aria-label="Цена до, рублей"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                onBlur={handlePriceChange}
                className="flex-1 px-3 py-0.5 border border-border rounded text-sm min-h-10"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {facets.price.min && facets.price.max && (
                <>
                  {formatPrice(facets.price.min)} – {formatPrice(facets.price.max)}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <button
          onClick={() => {
            setMinPrice('')
            setMaxPrice('')
            onFilterChange({
              category: undefined,
              brand: undefined,
              line: undefined,
              need: undefined,
              skin: undefined,
              minPrice: undefined,
              maxPrice: undefined,
              offset: 0,
            })
          }}
          className="w-full py-0.5 text-sm text-accent-ink hover:text-accent-ink/80 transition-colors font-semibold"
        >
          Очистить фильтры ({activeFilterCount})
        </button>
      )}
    </div>
  )

  if (!isDesktop) {
    return (
      <>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-1 py-3 bg-white border border-border rounded-lg font-semibold text-foreground min-h-11 mb-4"
        >
          <span>Фильтры</span>
          {activeFilterCount > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setIsOpen(false)}>
            <div
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto z-50"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Фильтры каталога"
            >
              <div className="sticky top-0 flex items-center justify-between px-1 py-1 border-b border-border bg-white">
                <h2 className="font-heading font-bold text-foreground">Фильтры</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Закрыть фильтры"
                  className="min-w-11 min-h-11 flex items-center justify-center text-2xl text-foreground"
                >
                  ×
                </button>
              </div>
              <div className="p-4">{content}</div>
            </div>
          </div>
        )}
      </>
    )
  }

  return <div className="bg-white rounded-lg p-6 space-y-0">{content}</div>
}
