import SideDrawer from '@/components/cart/SideDrawer'
import { CareRequestForm } from './CareRequestForm'

interface CareModalProps {
  open: boolean
  onClose: () => void
}

export function CareModal({ open, onClose }: CareModalProps) {
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Стать подопечным Отдела заботы"
      closeLabel="Закрыть форму Отдела заботы"
    >
      <CareRequestForm onDone={onClose} />
    </SideDrawer>
  )
}
