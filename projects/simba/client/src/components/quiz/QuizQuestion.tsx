import { useState, useRef, useEffect } from 'react'
import type { QuizQuestion, QuizAnswers } from '../../lib/quiz-config'
import { DogSilhouette, CatSilhouette } from './PetIcons'
import { CheckIcon, ArrowLeftIcon, ArrowRightIcon } from '../icons'

interface QuizQuestionProps {
  question: QuizQuestion
  currentAnswers: Partial<QuizAnswers>
  onAnswer: (value: string | string[], fieldId: string) => void
  onNext?: () => void
  onPrev?: () => void
  showPrevButton: boolean
  isLastQuestion: boolean
  inModal?: boolean
}

export default function QuizQuestionComponent({
  question,
  currentAnswers,
  onAnswer,
  onNext,
  onPrev,
  showPrevButton,
  isLastQuestion,
  inModal,
}: QuizQuestionProps) {
  const fieldValue = currentAnswers[question.id as keyof QuizAnswers]
  const isMultiple = question.multiple ?? false
  const selectedValues = isMultiple ? (fieldValue as string[] | undefined) || [] : []
  const selectedSingle = !isMultiple ? (fieldValue as string | undefined) : null
  const titleRef = useRef<HTMLHeadingElement>(null)

  const [showReduceMotion] = useState(() => {
    return typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  })

  useEffect(() => {
    titleRef.current?.focus()
  }, [question.id])

  const handleOptionClick = (value: string) => {
    if (isMultiple) {
      let newValues = [...selectedValues]

      if (value === 'none') {
        newValues = ['none']
      } else if (selectedValues.includes('none')) {
        newValues = [value]
      } else if (newValues.includes(value)) {
        newValues = newValues.filter((v) => v !== value)
      } else {
        newValues.push(value)
      }

      onAnswer(newValues, question.id)
    } else {
      onAnswer(value, question.id)

      // Auto-transition after 350ms (подтверждение выбора, не анимация)
      // Остаётся 300мс даже при prefers-reduced-motion
      if (onNext) {
        const delay = showReduceMotion ? 300 : 350
        setTimeout(() => onNext(), delay)
      }
    }
  }

  const isAnswered = isMultiple
    ? selectedValues.length > 0
    : selectedSingle !== null && selectedSingle !== undefined

  return (
    <div className={`flex flex-col bg-blue-50 ${
      inModal ? 'min-h-0' : 'min-h-[100dvh]'
    }`}>
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 md:py-12">
        {/* Question title */}
        <h2
          ref={titleRef}
          id="quiz-q"
          tabIndex={-1}
          className="text-2xl md:text-3xl font-bold text-navy-900 mb-8 md:mb-12 focus:outline-none"
        >
          {question.question}
        </h2>

        {/* Options grid */}
        <div
          role={isMultiple ? 'group' : 'radiogroup'}
          aria-labelledby="quiz-q"
          className="space-y-3 mb-12"
          aria-live="polite"
        >
          {question.options.map((option) => {
            const isSelected = isMultiple
              ? selectedValues.includes(option.value)
              : selectedSingle === option.value

            return (
              <button
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                role={isMultiple ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                className={`w-full p-4 rounded-xl border-2 text-left transition-[transform,border-color,background-color] duration-100 ease active:scale-[0.98] ${
                  isSelected
                    ? 'bg-ink border-ink text-white'
                    : 'bg-white border-line text-navy-700 hover:border-ink'
                } ${
                  'min-h-[44px] flex items-center'
                }`}
              >
                {option.pet === 'dog' && (
                  <DogSilhouette className={`w-12 h-12 mr-4 flex-shrink-0 transition-colors duration-100 ease ${isSelected ? 'text-white' : 'text-navy-300'}`} />
                )}
                {option.pet === 'cat' && (
                  <CatSilhouette className={`w-12 h-12 mr-4 flex-shrink-0 transition-colors duration-100 ease ${isSelected ? 'text-white' : 'text-navy-300'}`} />
                )}
                <div className="flex-1">
                  <div className="font-medium text-base">{option.label}</div>
                  {option.description && (
                    <div className="text-sm text-navy-500 mt-1">{option.description}</div>
                  )}
                </div>
                {isMultiple && (
                  <div
                    className={`ml-4 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-white bg-white' : 'border-navy-300'
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <CheckIcon className="w-3 h-3 text-ink ico-draw" />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-4 justify-between">
          {showPrevButton && (
            <button
              onClick={onPrev}
              className="px-6 py-3 rounded-xl border border-line text-navy-700 font-medium hover:bg-white flex items-center gap-2"
            >
              <ArrowLeftIcon className="ico-nudge ico-nudge--back w-4 h-4" />
              Назад
            </button>
          )}

          <div className="flex-1" />

          {(isMultiple || isLastQuestion) && (
            <button
              onClick={onNext}
              disabled={!isAnswered}
              className="px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed btn-primary flex items-center gap-2"
            >
              {isLastQuestion ? (
                <>
                  Готово
                  <CheckIcon className="ico-draw w-4 h-4" />
                </>
              ) : (
                <>
                  Далее
                  <ArrowRightIcon className="ico-nudge w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
