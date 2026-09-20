interface QuizProgressProps {
  current: number
  total: number
}

export default function QuizProgress({ current, total }: QuizProgressProps) {
  const percentage = (current / total) * 100

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-line">
      <div className="max-w-4xl mx-auto px-4 py-4 md:py-6">
        {/* Progress text */}
        <p className="text-sm font-medium text-navy-600 mb-3">
          Вопрос {current} из {total}
        </p>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Вопрос ${current} из ${total}`}
          className="w-full h-2 bg-navy-100 rounded-full overflow-hidden"
        >
          <div
            className="h-full w-full bg-ink transition-transform duration-300 ease-out origin-left"
            style={{ transform: `scaleX(${percentage / 100})` }}
          />
        </div>
      </div>
    </div>
  )
}
