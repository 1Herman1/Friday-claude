import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { QuizResult as QuizResultType } from '@/lib/quiz-match'
import { formatPrice } from '@/lib/format'
import { useCart } from '@/context/CartContext'
import { IconCheck, IconArrowRight } from '../icons'

interface QuizResultProps {
  result: QuizResultType
  onRetry: () => void
  onClose: () => void
}

export function QuizResult({ result, onRetry, onClose }: QuizResultProps) {
  const { addItem } = useCart()
  const [addedSteps, setAddedSteps] = useState<Set<number>>(new Set())
  const [addingAll, setAddingAll] = useState(false)

  const handleAddToCart = async (stepIndex: number, variantId: string) => {
    try {
      await addItem(variantId, 1)
      setAddedSteps((prev) => new Set(prev).add(stepIndex))
      setTimeout(() => {
        setAddedSteps((prev) => {
          const next = new Set(prev)
          next.delete(stepIndex)
          return next
        })
      }, 1500)
    } catch {
      // error handling
    }
  }

  const handleAddAll = async () => {
    setAddingAll(true)
    try {
      for (const step of result.steps) {
        if (step.product.variants.length > 0) {
          await addItem(step.product.variants[0].id, 1)
        }
      }
    } catch {
      // error handling
    } finally {
      setAddingAll(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h2 className="text-h2 font-heading font-bold text-foreground mb-3">
          Ваша программа ухода
        </h2>
        {result.relaxed && (
          <p className="text-sm text-muted-foreground">
            Точных совпадений мало — показали ближайшие средства.
          </p>
        )}
      </div>

      {/* Steps */}
      <ol className="flex flex-col gap-4">
        {result.steps.map((step, index) => {
          const isAdded = addedSteps.has(index)
          const variant = step.product.variants[0]
          if (!variant) return null

          const imageUrl = step.product.image
            ? step.product.image
            : `/products-optimized/${step.product.slug}/card.webp`

          return (
            <li key={index} className="flex gap-4 pb-4 border-b border-border last:border-0">
              {/* Number badge */}
              <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-primary text-primary-foreground rounded-full font-semibold text-sm">
                {index + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Category title */}
                <h3 className="font-semibold text-foreground text-sm mb-3">
                  {step.title}
                </h3>

                {/* Product card */}
                <div className="flex gap-3 bg-card rounded-block p-3 mb-3">
                  {/* Image */}
                  <div className="w-20 h-20 flex-shrink-0 bg-muted rounded-media flex items-center justify-center overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={step.product.name}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E`
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm line-clamp-2">
                        {step.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {variant.volumeLabel}
                      </p>
                    </div>

                    <p className="text-sm font-bold text-foreground">
                      {formatPrice(step.product.minPrice)}
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <p className="text-xs text-muted-foreground mb-3">{step.reason}</p>

                {/* Add to cart button */}
                <button
                  onClick={() =>
                    handleAddToCart(index, variant.id)
                  }
                  disabled={isAdded || addingAll}
                  className={`w-full py-2 px-4 rounded-pill font-semibold text-sm transition-colors duration-200 min-h-11 flex items-center justify-center gap-2 ${
                    isAdded
                      ? 'bg-success/10 text-success'
                      : 'bg-primary text-primary-foreground hover:opacity-90'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <IconCheck className="w-4 h-4" />
                      Добавлено
                    </>
                  ) : (
                    'В корзину'
                  )}
                </button>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Footer buttons */}
      <div className="flex flex-col gap-3 pt-4">
        <button
          onClick={handleAddAll}
          disabled={addingAll}
          className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11"
        >
          Добавить всю программу
        </button>

        <Link
          to={`/catalog/all`}
          onClick={onClose}
          className="w-full py-3 px-6 border border-border text-foreground font-semibold rounded-pill hover:bg-muted transition-colors duration-200 min-h-11 flex items-center justify-center gap-2"
        >
          Показать похожие в каталоге
          <IconArrowRight className="w-4 h-4" />
        </Link>

        <button
          onClick={onRetry}
          className="w-full py-3 px-6 text-foreground hover:text-primary transition-colors duration-200 font-semibold"
        >
          Пройти заново
        </button>
      </div>
    </div>
  )
}
