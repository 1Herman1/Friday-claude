import { Link } from 'react-router-dom'
import { SerumVideo } from './SerumVideo'
import { AllProductsCover, BestsellerCover, SERUM_COVER } from './CatalogCovers'
import { CatalogCrossfadeTile } from './CatalogCrossfadeTile'
import { CATALOG_SEQUENCES, REVIEW_COVERS } from './catalog-scenes'
import { pluralize } from '@/lib/format'
import type { CategoriesTreeResponse as Category } from '@/types/api'
import './catalog-composition.css'

const EDITORIAL: Record<string, { span: number; tone: string; image?: string }> = {
  'kremy-dlya-litsa-i-shei': { span: 4, tone: 'bg-white text-foreground', image: '/photos/m16-1254.webp' },
  syvorotki: { span: 5, tone: 'catalog-serum text-foreground', image: SERUM_COVER },
  ochishchenie: { span: 3, tone: 'bg-white text-foreground' },
  maski: { span: 4, tone: 'bg-white text-foreground' },
  flyuidy: { span: 2, tone: 'bg-white text-foreground' },
  toniki: { span: 2, tone: 'bg-white text-foreground' },
  nabory: { span: 4, tone: 'bg-white text-foreground', image: '/photos/m1.webp' },
  'kremy-dlya-vek': { span: 2, tone: 'bg-white text-foreground' },
  masla: { span: 2, tone: 'bg-white text-foreground' },
}

function CategoryTile({ category }: { category: Category }) {
  const art = EDITORIAL[category.slug] || { span: 4, tone: 'bg-white text-foreground' }
  if (category.slug === 'kremy-dlya-litsa-i-shei' && CATALOG_SEQUENCES[category.slug]) {
    return <CatalogCrossfadeTile to={`/catalog/${category.slug}`} title={category.name}
      count={`${category.productCount} ${pluralize(category.productCount, ['товар', 'товара', 'товаров'])}`}
      className={`catalog-span-${art.span} text-foreground`} scenes={CATALOG_SEQUENCES[category.slug]!.map(scene => scene.src)} />
  }
  const reviewCover = REVIEW_COVERS[category.slug]
  const image = category.slug === 'syvorotki' ? SERUM_COVER : reviewCover || category.image || art.image
  return <Link to={`/catalog/${category.slug}`} className={`catalog-tile catalog-span-${art.span} ${reviewCover ? 'catalog-generated text-foreground' : art.tone} ${image ? 'catalog-illustrated' : ''}`}>
    <div className="catalog-tile-copy"><h2>{category.name}</h2><p className="catalog-count">{category.productCount} {pluralize(category.productCount, ['товар', 'товара', 'товаров'])}</p></div>
    {category.slug === 'syvorotki' ? <SerumVideo /> : image && <img className="catalog-cover" src={image} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />}
    <span className="catalog-arrow" aria-hidden="true">↗</span>
  </Link>
}

export function CatalogEditorial({ categories }: { categories: Category[] }) {
  // Desktop-only editorial order. Unknown API categories remain accessible.
  const keys = Object.keys(EDITORIAL)
  const rank = (slug: string) => keys.includes(slug) ? keys.indexOf(slug) : keys.length
  const ordered = [...categories].sort((a, b) => rank(a.slug) - rank(b.slug))
  const first = ordered[0]
  return <div className="catalog-editorial">
    <AllProductsCover enableMotion={categories.some(category => category.slug === 'kremy-dlya-litsa-i-shei')} />
    <BestsellerCover />
    {first && <CategoryTile category={first} />}
    {ordered.slice(1).map(category => <CategoryTile key={category.slug} category={category} />)}
  </div>
}
