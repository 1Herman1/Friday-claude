import { ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import SideDrawer from '@/components/cart/SideDrawer'
import { EmailLoginForm } from '@/components/auth/EmailLoginForm'
import { ProApplicationForm } from '@/components/pro/ProApplicationForm'
import { useAuth, isApprovedPro } from '@/context/AuthContext'

interface ProRegisterModalProps {
  open: boolean
  onClose: () => void
}

interface ProRegisterContentProps {
  onClose: () => void
}

export function ProRegisterModal({ open, onClose }: ProRegisterModalProps) {
  return (
    <SideDrawer open={open} onClose={onClose} title="Доступ специалиста">
      <ProRegisterContent onClose={onClose} />
    </SideDrawer>
  )
}

// Флаг «заявка отправлена» живёт в этом компоненте: SideDrawer размонтирует его при закрытии,
// поэтому при следующем открытии он сбрасывается.
function ProRegisterContent({ onClose }: ProRegisterContentProps) {
  const { user, isLoading } = useAuth()
  const [submitted, setSubmitted] = useState(false)

  let body: ReactNode
  if (isLoading) {
    body = <p className="text-body-sm text-muted-foreground">Загрузка…</p>
  } else if (!user) {
    // После входа AuthContext обновляет user, и попап сам показывает анкету
    body = <EmailLoginForm />
  } else if (isApprovedPro(user)) {
    body = (
      <div className="space-y-6">
        <p className="text-body text-foreground bg-success/10 border border-success/30 rounded-block p-4">
          Доступ открыт — оптовые цены уже в каталоге
        </p>
        <Link
          to="/catalog?pro=1"
          onClick={onClose}
          className="inline-flex items-center min-h-11 text-primary font-semibold hover:underline"
        >
          Товары для кабинета →
        </Link>
      </div>
    )
  } else if (submitted || user.proStatus === 'pending') {
    body = (
      <div className="space-y-6">
        <p className="text-body text-foreground">Заявка отправлена — проверим и пришлём письмо</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
        >
          Готово
        </button>
      </div>
    )
  } else {
    body = <ProApplicationForm onSuccess={() => setSubmitted(true)} />
  }

  return (
    <div className="px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="text-body-sm text-muted-foreground mb-6">Профессиональный уход — в ваших руках</p>
      {body}
    </div>
  )
}
