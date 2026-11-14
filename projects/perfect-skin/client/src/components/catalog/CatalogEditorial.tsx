import { Link } from 'react-router-dom'
import { AllProductsCover, BestsellerCover } from './CatalogCovers'
import { pluralize } from '@/lib/format'
import type { CategoriesTreeResponse as Category } from '@/types/api'
import './catalog-composition.css'

const EDITORIAL: Record<string, { span: number; tone: string; image?: string }> = {
  'kremy-dlya-litsa-i-shei': { span: 5, tone: 'bg-muted text-foreground', image: '/photos/m16-1254.webp' },
  syvorotki: { span: 5, tone: 'bg-primary text-primary-foreground', image: '/photos/m4.webp' },
  ochishchenie: { span: 3, tone: 'bg-muted text-foreground' },
  maski: { span: 4, tone: 'bg-accent text-foreground' },
  flyuidy: { span: 2, tone: 'bg-primary text-primary-foreground' },
  toniki: { span: 2, tone: 'bg-muted text-foreground' },
  nabory: { span: 4, tone: 'bg-accent text-foreground', image: '/photos/m1.webp' },
  'kremy-dlya-vek': { span: 2, tone: 'bg-muted text-foreground' },
  masla: { span: 2, tone: 'bg-dark text-dark-foreground' },
}

function CategoryTile({ category }: { category: Category }) {
  const art = EDITORIAL[category.slug] || { span: 4, tone: 'bg-muted text-foreground' }
  const image = category.image || art.image
  return <Link to={`/catalog/${category.slug}`} className={`catalog-tile catalog-span-${art.span} ${art.tone} ${image ? 'catalog-illustrated' : ''}`}>
    <div className="catalog-tile-copy"><h2>{category.name}</h2><p className="catalog-count">{category.productCount} {pluralize(category.productCount, ['товар', 'товара', 'товаров'])}</p></div>
    {image && <img className="catalog-cover" src={image} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />}
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
    <AllProductsCover />
    {first && <CategoryTile category={first} />}
    <BestsellerCover />
    {ordered.slice(1).map(category => <CategoryTile key={category.slug} category={category} />)}
  </div>
}
