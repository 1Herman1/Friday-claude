import { IconMinus, IconPlus, IconTrash } from '../icons'

interface QuantityStepperProps {
  quantity: number
  maxStock: number
  onQuantityChange: (newQuantity: number) => void
  disabled?: boolean
}

export function QuantityStepper({
  quantity,
  maxStock,
  onQuantityChange,
  disabled = false,
}: QuantityStepperProps) {
  const handleDecrease = () => {
    if (quantity > 1) {
      onQuantityChange(quantity - 1)
    }
  }

  const handleIncrease = () => {
    if (quantity < Math.min(99, maxStock)) {
      onQuantityChange(quantity + 1)
    }
  }

  const handleDelete = () => {
    onQuantityChange(0)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-pill border border-border">
        <button
          onClick={handleDecrease}
          disabled={disabled || quantity <= 1}
          aria-label="Уменьшить количество"
          className="w-11 h-11 min-h-11 flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <IconMinus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center text-sm font-semibold text-foreground tabular-nums">
          {quantity}
        </span>
        <button
          onClick={handleIncrease}
          disabled={disabled || quantity >= Math.min(99, maxStock)}
          aria-label="Увеличить количество"
          className="w-11 h-11 min-h-11 flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <IconPlus className="w-4 h-4" />
        </button>
      </div>
      <button
        onClick={handleDelete}
        disabled={disabled}
        aria-label="Удалить из корзины"
        className="w-11 h-11 flex items-center justify-center text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 rounded-pill"
        title="Удалить из корзины"
      >
        <IconTrash className="w-4 h-4" />
      </button>
    </div>
  )
}
