import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmailLoginForm } from '@/components/auth/EmailLoginForm'
import { IconUser } from '@/components/icons'

export function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Определяем, это вход специалиста или обычный
  const isPro = location.pathname === '/pro/register' || searchParams.get('pro') === '1'
  const nextUrl = isPro ? '/pro' : (searchParams.get('next') || '/orders')

  const isDemoMode = import.meta.env.VITE_API_MODE === 'snapshot'

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 py-12 lg:py-24">
      <div className="w-full max-w-sm">
        {/* Карточка входа */}
        <div className="bg-card rounded-block shadow-sm p-8 border border-border">
          {isPro ? (
            <div className="mb-6 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">
                Регистрация специалиста
              </p>
              <p className="text-xs text-muted-foreground">
                Введите email — пришлём код. После входа заполните короткую заявку на профессиональный доступ
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-6 text-center">
              Вход нужен, чтобы видеть историю заказов — оформить заказ можно и без него
            </p>
          )}
          {isDemoMode ? (
            <div className="text-center">
              <IconUser className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-lg font-heading font-semibold text-foreground mb-2">
                Вход в аккаунт
              </h1>
              <p className="text-body-sm text-muted-foreground mb-6">
                Вход по email заработает после запуска магазина
              </p>
              <a
                href="/catalog"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:bg-primary/90 transition-colors"
              >
                В каталог
              </a>
            </div>
          ) : (
            <EmailLoginForm onSuccess={() => navigate(nextUrl)} />
          )}
        </div>
      </div>
    </div>
  )
}
