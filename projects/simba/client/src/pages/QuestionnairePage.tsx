import { useMetaTags } from '../hooks/useMetaTags'
import QuizFlow from '../components/quiz/QuizFlow'

export default function QuestionnairePage() {
  useMetaTags({
    title: 'Подбор корма для кошки и собаки — Симба',
    description:
      'Ответьте на несколько вопросов о питомце и получите рекомендацию: линейку и вкус корма, а не просто бренд.',
  })

  return (
    <>
      <QuizFlow startPhase="intro" />
    </>
  )
}
