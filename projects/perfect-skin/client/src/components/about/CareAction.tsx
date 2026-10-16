import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'
import type { CareActionKind } from './care-data'
import { BTN_OUTLINE, BTN_PRIMARY } from './classes'

export function CareAction({ action }: { action: CareActionKind }) {
  const { openQuiz, openCare } = useDrawer()

  if (action === 'quiz') {
    return (
      <button type="button" onClick={openQuiz} className={BTN_PRIMARY}>
        Пройти тест
      </button>
    )
  }

  if (action === 'consultation') {
    return (
      <Link to="/consultation" className={BTN_OUTLINE}>
        Консультация косметолога
      </Link>
    )
  }

  return (
    <button type="button" onClick={openCare} className={BTN_OUTLINE}>
      Стать подопечным Отдела заботы
    </button>
  )
}
