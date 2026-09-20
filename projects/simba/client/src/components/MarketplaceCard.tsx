import { StarSolidIcon, ExternalLinkIcon } from './icons'

type Props = {
  name: string
  rating: string
  stats: string
  url?: string
  /** Ссылку на площадку показываем не везде — это решение владельца, не оформление. */
  showLink?: boolean
  linkLabel?: string
}

/**
 * Одна карточка площадки на весь сайт. До этого она была нарисована тремя
 * разными способами — на странице доверия, на отзывах и в подвале, — а рейтинг
 * двумя: SVG-звездой и текстовым символом другого размера.
 */
export default function MarketplaceCard({
  name,
  rating,
  stats,
  url,
  showLink = false,
  linkLabel = 'Читать отзывы',
}: Props) {
  return (
    <div className="flex flex-col bg-white border border-line rounded-card p-4 transition-[transform,box-shadow,border-color] duration-150 ease-smooth hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-card active:translate-y-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-navy-900">{name}</span>
        <span className="flex items-baseline gap-1 text-amber-600 font-bold">
          {rating}
          <StarSolidIcon className="w-4 h-4" />
        </span>
      </div>

      <p className="mt-1 grow text-sm text-navy-500">{stats}</p>

      {showLink && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${linkLabel} о магазине на площадке ${name}, рейтинг ${rating} из 5, откроется в новой вкладке`}
          className="mt-1 self-start inline-flex items-center gap-1 min-h-11 text-sm font-medium text-navy-700 hover:text-navy-900 transition-colors duration-100 ease"
        >
          {linkLabel}
          <span className="ico-nudge ico-nudge--diag">
            <ExternalLinkIcon className="w-4 h-4" />
          </span>
        </a>
      )}
    </div>
  )
}
