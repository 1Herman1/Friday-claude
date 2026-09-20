import { useEffect, useState } from 'react'
import LottieScene from '../LottieScene'


const STAGES = ['Смотрим состав кормов', 'Сверяем с возрастом и весом', 'Подбираем оптимальный вариант']

interface QuizLoadingProps {
  inModal?: boolean
}

export default function QuizLoading({ inModal }: QuizLoadingProps) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const t1 = window.setTimeout(() => setStage(1), 900)
    const t2 = window.setTimeout(() => setStage(2), 1900)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  return (
    <div className={`flex items-center justify-center bg-blue-50 px-4 ${
      inModal ? 'min-h-0' : 'min-h-[100dvh]'
    }`}>
      <div className="text-center" role="status" aria-live="polite">
        <LottieScene
          load={() => import('../../lottie/quiz-loading.json')}
          className="w-28 aspect-[154/157] mx-auto mb-8"
        />
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Подбираем корм</h1>
        <p key={stage} className="quiz-stage text-navy-500 text-base">
          {STAGES[stage]}
        </p>
      </div>
    </div>
  )
}
