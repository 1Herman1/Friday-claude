import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CatalogEditorial } from './CatalogEditorial'
import { SERUM_COVER } from './CatalogCovers'
import { pluralize } from '@/lib/format'
import type { CategoriesTreeResponse } from '@/types/api'

interface CatalogGridProps {
  categories: CategoriesTreeResponse[]
}

export function CatalogGrid({ categories }: CatalogGridProps) {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const change = () => setDesktop(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return desktop ? <CatalogEditorial categories={categories} /> : <MobileCatalogGrid categories={categories} />
}

function MobileCatalogGrid({ categories }: CatalogGridProps) {

  return (
    <div className="space-y-8">
      {/* Preserve mobile geometry; All is not a real API category. */}
      {categories.length > 0 && (
        <Link
          to={`/catalog/all`}
          className="block bg-card rounded-block overflow-hidden transition-transform duration-200 hover:-translate-y-1"
        >
          <div className="min-h-[220px] py-12 bg-accent flex items-center justify-center group">
            <div className="text-center">
              <h2 className="text-heading font-heading font-bold text-foreground text-4xl mb-2 group-hover:-translate-y-1 transition-transform duration-200">
                Все средства
              </h2>

            </div>
          </div>
        </Link>
      )}

      {/* Rest categories - grid 2x3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-start gap-6">
        {categories.map(category => (
          <Link
            key={category.slug}
            to={`/catalog/${category.slug}`}
            className={category.slug === 'syvorotki' ? 'group catalog-tile catalog-serum catalog-illustrated text-foreground rounded-block overflow-hidden' : 'group bg-card rounded-block overflow-hidden transition-transform duration-200 hover:-translate-y-1'}
          >
            {category.slug === 'syvorotki' ? (
              <>
                <div className="catalog-tile-copy"><h2>{category.name}</h2><p className="catalog-count">{category.productCount} {pluralize(category.productCount, ['товар', 'товара', 'товаров'])}</p></div>
                <img className="catalog-cover" src={SERUM_COVER} alt="" loading="lazy" width="1254" height="1254" />
              </>
            ) : category.image ? (
              <>
                <div className="aspect-square bg-card flex items-center justify-center relative overflow-hidden">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <h3 className="font-sans font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{category.productCount} {pluralize(category.productCount, ['товар', 'товара', 'товаров'])}</p>
                </div>
              </>
            ) : (
              <div className="bg-muted rounded-block p-6 min-h-[140px] flex flex-col">
                <h3 className="text-h3 font-heading font-bold text-foreground">
                  {category.name}
                </h3>
                <p className="text-sm text-foreground/70 mt-auto">
                  {category.productCount} {pluralize(category.productCount, ['товар', 'товара', 'товаров'])}
                </p>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
