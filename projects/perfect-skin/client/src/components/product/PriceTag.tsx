import { Link } from 'react-router-dom'
import { formatPrice } from '@/lib/format'

interface PriceTagProps {
  price: number | null
  oldPrice?: number | null
  hidden?: boolean
  size?: 'sm' | 'lg'
}

export function PriceTag({ price, oldPrice, hidden, size = 'lg' }: PriceTagProps) {
  if (hidden || price === null) {
    return (
      <div className="flex items-center gap-2">
        <span className={size === 'sm' ? 'text-sm text-muted-foreground' : 'text-body text-muted-foreground'}>
          Цена для специалистов
        </span>
        <Link to="/pro" className="text-primary hover:underline font-semibold text-sm">
          Получить доступ
        </Link>
      </div>
    )
  }

  const formattedPrice = formatPrice(price)
  const formattedOldPrice = oldPrice ? formatPrice(oldPrice) : null

  if (size === 'sm') {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground tabular-nums">{formattedPrice}</span>
        {formattedOldPrice && (
          <span className="text-xs text-muted-foreground line-through tabular-nums">
            {formattedOldPrice}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-semibold text-foreground tabular-nums">{formattedPrice}</span>
      {formattedOldPrice && (
        <span className="text-sm text-muted-foreground line-through tabular-nums">
          {formattedOldPrice}
        </span>
      )}
    </div>
  )
}
