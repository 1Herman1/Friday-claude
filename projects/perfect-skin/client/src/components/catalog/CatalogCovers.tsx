import { Link } from 'react-router-dom'
import { CatalogCrossfadeTile } from './CatalogCrossfadeTile'
import { CATALOG_SEQUENCES, REVIEW_COVERS, REVIEW_BESTSELLER_PRODUCT_ID } from './catalog-scenes'
export { CatalogCrossfadeTile } from './CatalogCrossfadeTile'

export const SERUM_COVER = '/photos/catalog/syvorotki-pilot-05-native.png'

export function AllProductsCover({ enableMotion = true }: { enableMotion?: boolean }) {
  const scenes = enableMotion ? CATALOG_SEQUENCES.all : undefined
  if (scenes) return <CatalogCrossfadeTile to="/catalog/all" title="Все средства" className="catalog-all catalog-span-3 text-foreground" scenes={scenes.map(scene => scene.src)} />
  // No approved all-category scene pair yet. Do not substitute product packshots.
  return <div className="catalog-tile catalog-all catalog-span-3 bg-accent text-foreground">
    <Link to="/catalog/all" className="catalog-cover-link">
      <div className="catalog-tile-copy"><h2>Все средства</h2></div>
      <span className="catalog-arrow" aria-hidden="true">↗</span>
    </Link>
  </div>
}

export function BestsellerCover() {
  // Static legacy poster: the only planned autoplay targets are all + creams.
  return <div className={`catalog-tile catalog-bestsellers catalog-span-5 ${REVIEW_COVERS.bestseller ? 'catalog-generated' : ''} bg-primary text-primary-foreground`}>
    <Link to="/catalog/all?sort=popular" className="catalog-cover-link">
      <div className="catalog-tile-copy"><h2>Бестселлеры</h2><p className="catalog-count">По популярности</p></div>
      <img className={REVIEW_COVERS.bestseller ? "catalog-cover" : "catalog-film"} data-product-id={REVIEW_BESTSELLER_PRODUCT_ID} src={true ? "/photos/catalog/bestseller-tts-v2.png" : "/video/bestsellers/desktop/k0.jpg"} alt="" />
      <span className="catalog-arrow" aria-hidden="true">↗</span>
    </Link>
  </div>
}
