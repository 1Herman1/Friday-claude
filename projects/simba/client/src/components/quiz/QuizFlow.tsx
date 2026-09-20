import { useEffect, useState, useRef } from 'react'
import { quizApi, type QuizMatchResponse } from '../../lib/api'
import { allQuestions, getVisibleQuestions, type QuizAnswers } from '../../lib/quiz-config'
import QuizIntro from './QuizIntro'
import QuizProgress from './QuizProgress'
import QuizQuestion from './QuizQuestion'
import QuizResult from './QuizResult'
import QuizLoading from './QuizLoading'

type Phase = 'intro' | 'quiz' | 'loading' | 'result' | 'error'

/** Вопросов в каждой ветке: вид + 7 профильных. Условный про аллерген сверх. */
const QUESTIONS_IN_BRANCH = 8

interface Props {
  startPhase?: 'intro' | 'quiz'
  /** В модалке высоту задаёт контейнер — фазы не должны тянуться на 100dvh. */
  inModal?: boolean
}

export default function QuizFlow({ startPhase = 'intro', inModal }: Props) {
  const [phase, setPhase] = useState<Phase>(startPhase)
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [result, setResult] = useState<QuizMatchResponse | null>(null)
  const [error, setError] = useState<string>('')
  const bonusClaimedRef = useRef(false)
  const answersRef = useRef<Partial<QuizAnswers>>({})
  const [showLoader, setShowLoader] = useState(false)
  const loaderShownAt = useRef(0)

  const visibleQuestions = getVisibleQuestions(answers)
  const currentQuestion = visibleQuestions[currentQuestionIndex]
  const isLastQuestion = !!answers.species && currentQuestionIndex === visibleQuestions.length - 1
  const showPrevButton = currentQuestionIndex > 0

  // Handle answer
  const handleAnswer = (value: string | string[], fieldId: string) => {
    answersRef.current = { ...answersRef.current, [fieldId]: value }
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: value,
    }))

    // Clear conditional fields if condition no longer applies
    if (fieldId === 'health' && Array.isArray(value) && !value.includes('allergy')) {
      answersRef.current = { ...answersRef.current, avoid: [] }
      setAnswers((prev) => ({
        ...prev,
        avoid: [],
      }))
    }
  }

  // Handle next question
  const handleNext = () => {
    const current = answersRef.current
    const isLast =
      !!current.species &&
      currentQuestionIndex === getVisibleQuestions(current).length - 1

    if (isLast) {
      submitQuiz()
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
    }
  }

  // Handle previous question
  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    }
  }

  // Submit quiz
  const submitQuiz = async () => {
    setPhase('loading')
    setError('')
    setShowLoader(false)

    const showTimer = window.setTimeout(() => {
      loaderShownAt.current = Date.now()
      setShowLoader(true)
    }, 250)

    const settle = async (next: () => void) => {
      window.clearTimeout(showTimer)
      if (loaderShownAt.current) {
        const left = 700 - (Date.now() - loaderShownAt.current)
        if (left > 0) await new Promise((r) => setTimeout(r, left))
      }
      loaderShownAt.current = 0
      next()
    }

    try {
      const answers = answersRef.current

      let cleanHealth = (answers.health || []).filter((v) =>
        v !== 'overweight' && v !== 'underweight' && v !== 'sterilized'
      )

      let weight = answers.weight || 'normal'
      if (answers.health?.includes('overweight')) {
        weight = 'overweight'
      } else if (answers.health?.includes('underweight')) {
        weight = 'underweight'
      }

      if (cleanHealth.length === 0) {
        cleanHealth = ['none']
      }

      const requestBody: any = {
        species: answers.species,
        age: answers.age,
        weight: weight,
        health: cleanHealth,
        avoid: answers.avoid || [],
        format: answers.format,
        flavor: answers.flavor,
        philosophy: answers.philosophy,
        brand: answers.brand,
      }

      if (answers.species === 'dog') {
        requestBody.size = answers.size
        requestBody.activity = answers.activity || 'normal'
      }

      if (answers.species === 'cat') {
        requestBody.sterilized = answers.health?.includes('sterilized') ?? false
        requestBody.lifestyle = answers.lifestyle
      }

      const res = await quizApi.match(requestBody)

      localStorage.setItem('quizSessionId', res.data.sessionId)

      await settle(() => {
        setResult(res.data)
        setPhase('result')
      })
    } catch (err: any) {
      console.error('Quiz submission error:', err)
      await settle(() => {
        setError(
          err?.response?.data?.error || 'Не получилось подобрать корм. Попробуйте ещё раз'
        )
        setPhase('error')
      })
    }
  }

  // Handle retry after error
  const handleRetry = async () => {
    await submitQuiz()
  }

  // Start quiz
  const handleStart = () => {
    setPhase('quiz')
    setAnswers({})
    answersRef.current = {}
    setCurrentQuestionIndex(0)
  }

  // Claim bonus after login
  useEffect(() => {
    const claimBonusIfNeeded = async () => {
      const token = localStorage.getItem('token')
      const sessionId = localStorage.getItem('quizSessionId')

      if (token && sessionId && result?.bonus?.status === 'guest') {
        if (bonusClaimedRef.current) return
        bonusClaimedRef.current = true

        try {
          await quizApi.claimBonus(sessionId)
          localStorage.removeItem('quizSessionId')
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  bonus: { ...prev.bonus, status: 'already_granted' },
                }
              : prev
          )
        } catch (err) {
          console.error('Failed to claim bonus:', err)
          bonusClaimedRef.current = false
        }
      }
    }

    if (phase === 'result') {
      claimBonusIfNeeded()
    }
  }, [phase, result?.sessionId, result?.bonus?.status])

  // Render based on phase
  if (phase === 'intro') {
    return <QuizIntro onStart={handleStart} inModal={inModal} />
  }

  if (phase === 'loading') {
    return showLoader ? <QuizLoading inModal={inModal} /> : <div className={`bg-blue-50 ${
      inModal ? 'min-h-0' : 'min-h-[100dvh]'
    }`} />
  }

  if (phase === 'error') {
    return (
      <div className={`flex items-center justify-center bg-blue-50 px-4 ${
 inModal ? 'min-h-0' : 'min-h-[100dvh]'
 }`}>
 <div className="max-w-md text-center">
 <h1 className="text-navy-900 mb-4">
 Что-то пошло не так
 </h1>
 <p className="text-navy-600 mb-6">{error}</p>
 <button
 onClick={handleRetry}
 className="btn-primary px-8 py-3"
 >
 Попробовать ещё раз
 </button>
 </div>
 </div>
 )
 }

 if (phase === 'result' && result) {
 return <QuizResult result={result} inModal={inModal} />
  }

  // Quiz phase
  if (!currentQuestion) {
    return (
      <div className={`flex items-center justify-center bg-blue-50 ${
        inModal ? 'min-h-0' : 'min-h-[100dvh]'
      }`}>
        <p className="text-navy-600">Загрузка вопроса...</p>
      </div>
    )
  }

  return (
    <div className={`bg-white ${
      inModal ? 'min-h-0' : 'min-h-[100dvh]'
    }`}>
      <QuizProgress
        current={Math.min(currentQuestionIndex + 1, QUESTIONS_IN_BRANCH)}
        total={QUESTIONS_IN_BRANCH}
      />

      <QuizQuestion
        question={currentQuestion}
        currentAnswers={answers}
        onAnswer={handleAnswer}
        onNext={handleNext}
        onPrev={handlePrev}
        showPrevButton={showPrevButton}
        isLastQuestion={isLastQuestion}
        inModal={inModal}
      />
    </div>
  )
}
