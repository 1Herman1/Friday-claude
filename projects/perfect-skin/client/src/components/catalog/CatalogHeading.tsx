import './catalog-composition.css'

/** Keep the existing mobile heading while refining the desktop catalogue. */
export function CatalogHeading({ mobileTitle, title }: { mobileTitle: string; title?: string }) {
  return (
    <h1 className="text-display font-heading font-bold mb-2 md:mb-3 catalog-heading">
      <span className="catalog-heading-mobile">{mobileTitle}</span>
      <span className="catalog-heading-desktop">
        {title || <><span data-catalog-word>Каталог</span>{' '}<strong>Perfect Skin</strong></>}
      </span>
    </h1>
  )
}
