import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { IconPackage } from '@/components/icons'

interface RequireRoleProps {
  roles: string[]
  children: React.ReactNode
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const { user, isLoading } = useAuth()
  const isDemoMode = import.meta.env.VITE_API_MODE === 'snapshot'

  // Демо-режим: показываем плашку
  if (isDemoMode) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-accent border border-accent rounded-block p-6">
            <div className="flex items-start gap-4">
              <IconPackage className="w-6 h-6 text-foreground flex-shrink-0 mt-1" />
              <div className="flex-1 text-left">
                <h3 className="font-heading font-semibold text-foreground mb-1">
                  Админка недоступна в демо-режиме
                </h3>
                <p className="text-sm text-foreground">
                  Включите полный режим магазина для доступа
                </p>
              </div>
            </div>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
            >
              На главную
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Загрузка
  if (isLoading) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="text-center text-muted-foreground">
          Загрузка…
        </div>
      </div>
    )
  }

  // Не залогинен
  if (!user) {
    return <Navigate to="/auth?next=/admin" replace />
  }

  // Роль не имеет доступ
  if (!roles.includes(user.role)) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-destructive/10 border border-destructive rounded-block p-6">
            <h3 className="font-heading font-semibold text-destructive mb-2">
              Нет доступа
            </h3>
            <p className="text-body-sm text-foreground mb-6">
              Ваша роль не позволяет посещать эту страницу
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors min-h-11"
            >
              На главную
            </a>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
