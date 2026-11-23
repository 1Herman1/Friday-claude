import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CatalogEditorial } from './CatalogEditorial'
import { CatalogCrossfadeTile } from './CatalogCovers'
import { SerumVideo, SerumVideoScope } from './SerumVideo'
import { CATALOG_SEQUENCES, REVIEW_COVERS } from './catalog-scenes'
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
  // Retain the owner's two empty editorial slots; these are not claimed API assortment.
  const missingSlots: CategoriesTreeResponse[] = [
    { id: 'editorial-empty-body', slug: 'uhod-za-telom', name: 'Уход за телом', productCount: 0, children: [], image: null },
    { id: 'editorial-empty-spf', slug: 'spf', name: 'SPF', productCount: 0, children: [], image: null },
  ].filter(slot => !categories.some(category => category.slug === slot.slug))
  const displayed = [...categories, ...missingSlots]
  return <SerumVideoScope>{desktop ? <CatalogEditorial categories={displayed} /> : <MobileCatalogGrid categories={displayed} />}</SerumVideoScope>
}

function MobileCatalogGrid({ categories }: CatalogGridProps) {
  const allScenes = categories.some(category => category.slug === 'kremy-dlya-litsa-i-shei') ? CATALOG_SEQUENCES.all : undefined

  return (
    <div className="space-y-8">
      {/* Preserve mobile geometry; All is not a real API category. */}
      {categories.length > 0 && (allScenes ? <CatalogCrossfadeTile to="/catalog/all" title="Все средства" className="catalog-all-mobile text-foreground" scenes={allScenes.map(scene => scene.src)} /> : (
        <Link
          to={`/catalog/all`}
          className="block bg-card rounded-block overflow-hidden catalog-card"
        >
          <div className="min-h-[220px] py-12 bg-white flex items-center justify-center group">
            <div className="text-center">
              <h2 className="text-heading font-heading font-bold text-foreground text-4xl mb-2">
                Все средства
              </h2>

            </div>
          </div>
        </Link>
      ))}

      {/* Rest categories - grid 2x3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-start gap-6">
        {categories.map(category => category.slug === 'kremy-dlya-litsa-i-shei' && CATALOG_SEQUENCES[category.slug] ? (
          <CatalogCrossfadeTile key={category.slug} to={`/catalog/${category.slug}`} title={category.name}
            count={`${category.productCount} ${pluralize(category.productCount, ['товар', 'товара', 'товаров'])}`}
            scenes={CATALOG_SEQUENCES[category.slug]!.map(scene => scene.src)} />
        ) : (
          <Link
            key={category.slug}
            to={`/catalog/${category.slug}`}
            className={category.slug === 'syvorotki' ? 'group catalog-tile catalog-serum catalog-illustrated text-foreground rounded-block overflow-hidden' : REVIEW_COVERS[category.slug] ? 'group catalog-tile catalog-generated catalog-generated-mobile catalog-illustrated text-foreground' : 'group catalog-tile bg-white text-foreground'}
          >
            {category.slug === 'syvorotki' ? (
              <>
                <div className="catalog-tile-copy"><h2>{category.name}</h2><p className="catalog-count">{category.productCount} {pluralize(category.productCount, ['товар', 'товара', 'товаров'])}</p></div>
                <SerumVideo />
              </>
            ) : REVIEW_COVERS[category.slug] ? (
              <>
                <div className="catalog-tile-copy"><h2>{category.name}</h2><p className="catalog-count">{category.productCount} {pluralize(category.productCount, ['товар', 'товара', 'товаров'])}</p></div>
                <img className="catalog-cover" src={REVIEW_COVERS[category.slug]} alt="" loading="lazy" />
                <span className="catalog-arrow" aria-hidden="true">↗</span>
              </>
            ) : (
              <>
                <div className="catalog-tile-copy"><h2>{category.name}</h2><p className="catalog-count">{category.productCount} {pluralize(category.productCount, ['товар', 'товара', 'товаров'])}</p></div>
                {category.image && <img className="catalog-cover" src={category.image} alt="" loading="lazy" />}
                <span className="catalog-arrow" aria-hidden="true">↗</span>
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
