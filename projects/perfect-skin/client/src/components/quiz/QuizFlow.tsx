import { useState, useEffect } from 'react'
import { getVisibleQuestions } from '@/lib/quiz-config'
import { matchProducts } from '@/lib/quiz-match'
import type { QuizAnswers } from '@/lib/quiz-config'
import type { QuizResult as QuizResultType } from '@/lib/quiz-match'
import { QuizProgress } from './QuizProgress'
import { QuizQuestion } from './QuizQuestion'
import { QuizResult } from './QuizResult'
import { IconArrowRight } from '../icons'

type Phase = 'intro' | 'quiz' | 'loading' | 'result'

interface QuizFlowProps {
  onClose: () => void
}

const LOADER_DELAY_MS = 250
const LOADER_MIN_MS = 700

export function QuizFlow({ onClose }: QuizFlowProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({})
  const [result, setResult] = useState<QuizResultType | null>(null)
  const [loaderStartTime, setLoaderStartTime] = useState(0)

  // Явный индекс шага: «первый вопрос без ответа» ломается на
  // мульти-выборе — ответ появляется с первого клика и вопрос
  // проскакивает, не дав выбрать второй вариант.
  const [stepIndex, setStepIndex] = useState(0)
  const visibleQuestions = getVisibleQuestions(answers)
  const currentQuestionIndex = Math.min(stepIndex, visibleQuestions.length - 1)
  const isLastQuestion = currentQuestionIndex === visibleQuestions.length - 1

  const advance = () => {
    if (isLastQuestion) {
      setPhase('loading')
      setLoaderStartTime(Date.now())
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  const handleAnswer = (value: string) => {
    if (currentQuestionIndex === -1) return

    const question = visibleQuestions[currentQuestionIndex]
    const newAnswers = { ...answers, [question.id]: value }
    setAnswers(newAnswers)
    advance()
  }

  const handleMultiAnswer = (value: string) => {
    if (currentQuestionIndex === -1) return

    const question = visibleQuestions[currentQuestionIndex]
    const current = (answers[question.id as keyof QuizAnswers] as string[]) || []

    // Если 'none' выбран, очищаем всё
    if (value === 'none') {
      const newAnswers = { ...answers, [question.id]: [] }
      setAnswers(newAnswers)
    } else {
      // Убираем 'none' если был выбран
      let updated = current.filter((v) => v !== 'none')

      if (updated.includes(value)) {
        updated = updated.filter((v) => v !== value)
      } else {
        updated.push(value)
      }

      const newAnswers = { ...answers, [question.id]: updated }
      setAnswers(newAnswers)
    }
  }

  // Эффект: загружаем результаты с задержкой
  useEffect(() => {
    if (phase !== 'loading') return

    const loadResults = async () => {
      const now = Date.now()
      const elapsed = now - loaderStartTime
      const remaining = Math.max(0, LOADER_MIN_MS - elapsed)

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining))
      }

      try {
        const res = await matchProducts(answers as QuizAnswers)
        setResult(res)
        setPhase('result')
      } catch {
        // error handling
        setPhase('intro')
        setAnswers({})
      }
    }

    // Задержка перед загрузкой
    const timer = setTimeout(loadResults, LOADER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [phase, answers, loaderStartTime])

  const handleRetry = () => {
    setAnswers({})
    setResult(null)
    setPhase('intro')
    setStepIndex(0)
  }

  // Intro
  if (phase === 'intro') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-h2 font-heading font-bold text-foreground mb-3">
            Подбор ухода
          </h2>
          <p className="text-body leading-body text-muted-foreground mb-6">
            Ответьте на пять вопросов о типе кожи и задаче — мы соберём программу
            ухода из средств ISSEIMI и GLACÉE.
          </p>
        </div>

        <button
          onClick={() => setPhase('quiz')}
          className="inline-flex items-center justify-center bg-primary text-primary-foreground font-heading font-bold px-6 py-3 rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11 gap-2 self-start"
        >
          Начать подбор
          <IconArrowRight className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // Loading
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Подбираем вам программу...</p>
      </div>
    )
  }

  // Result
  if (phase === 'result' && result) {
    return <QuizResult result={result} onRetry={handleRetry} onClose={onClose} />
  }

  // Quiz
  if (currentQuestionIndex === -1) {
    return null // Все вопросы ответили, переходим к loading
  }

  const question = visibleQuestions[currentQuestionIndex]

  return (
    <div className="flex flex-col gap-6">
      <QuizProgress
        current={currentQuestionIndex + 1}
        total={visibleQuestions.length}
      />

      <QuizQuestion
        question={question}
        answers={answers}
        onAnswer={handleAnswer}
        onMultiAnswer={handleMultiAnswer}
      />

      {/* Multi-select: кнопка "Далее" */}
      {question.multiple && (
        <button
          onClick={() => {
            const current = (answers[question.id as keyof QuizAnswers] as string[]) || []
            setAnswers({ ...answers, [question.id]: current })
            advance()
          }}
          className="w-full bg-primary text-primary-foreground font-heading font-bold py-3 px-6 rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11"
        >
          Далее
        </button>
      )}
    </div>
  )
}
