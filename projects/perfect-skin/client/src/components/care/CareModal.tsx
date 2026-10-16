import { useState } from 'react'
import SideDrawer from '@/components/cart/SideDrawer'
import { CareRequestForm } from './CareRequestForm'

interface CareModalProps {
  open: boolean
  onClose: () => void
}

const noop = () => {}

export function CareModal({ open, onClose }: CareModalProps) {
  const [sending, setSending] = useState(false)

  return (
    <SideDrawer
      open={open}
      onClose={sending ? noop : onClose}
      title="Стать подопечным Отдела заботы"
      closeLabel="Закрыть форму Отдела заботы"
    >
      <CareRequestForm onDone={onClose} onSendingChange={setSending} />
    </SideDrawer>
  )
}
