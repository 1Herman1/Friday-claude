import SideDrawer from '@/components/cart/SideDrawer'
import { QuizFlow } from './QuizFlow'

interface QuizModalProps {
  open: boolean
  onClose: () => void
}

export function QuizModal({ open, onClose }: QuizModalProps) {
  return (
    <SideDrawer open={open} onClose={onClose} title="Подбор ухода">
      <div className="px-4 py-6">
        <QuizFlow onClose={onClose} />
      </div>
    </SideDrawer>
  )
}
