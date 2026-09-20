import type { QuizQuestion as QuizQuestionType } from '@/lib/quiz-config'
import type { QuizAnswers } from '@/lib/quiz-config'

interface QuizQuestionProps {
  question: QuizQuestionType
  answers: Partial<QuizAnswers>
  onAnswer: (value: string) => void
  onMultiAnswer: (value: string) => void
}

export function QuizQuestion({
  question,
  answers,
  onAnswer,
  onMultiAnswer,
}: QuizQuestionProps) {
  if (question.multiple) {
    const selected = (answers[question.id as keyof QuizAnswers] as string[]) || []

    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-h3 font-heading font-bold text-foreground">
          {question.question}
        </h2>

        <div className="flex flex-col gap-3">
          {question.options.map((option) => {
            const isSelected = selected.includes(option.value)

            return (
              <button
                key={option.value}
                onClick={() => onMultiAnswer(option.value)}
                className={`flex items-start gap-3 p-4 rounded-block border-2 transition-colors duration-200 text-left ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors duration-200 ${
                    isSelected ? 'bg-primary border-primary' : 'border-border'
                  }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 bg-primary-foreground rounded-sm" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="font-semibold text-foreground">{option.label}</p>
                  {option.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Single choice
  const selected = answers[question.id as keyof QuizAnswers] as string | undefined

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h3 font-heading font-bold text-foreground">
        {question.question}
      </h2>

      <div className="flex flex-col gap-3">
        {question.options.map((option) => {
          const isSelected = selected === option.value

          return (
            <button
              key={option.value}
              onClick={() => onAnswer(option.value)}
              className={`flex items-start gap-3 p-4 rounded-block border-2 transition-colors duration-200 text-left ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-border'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors duration-200 ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}
              >
                {isSelected && (
                  <div className="w-2.5 h-2.5 bg-primary-foreground rounded-full" />
                )}
              </div>

              <div className="flex-1">
                <p className="font-semibold text-foreground">{option.label}</p>
                {option.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
