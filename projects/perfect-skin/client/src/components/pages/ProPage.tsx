import { Link } from 'react-router-dom'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { ProApplicationForm } from '@/components/pro/ProApplicationForm'

export function ProPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="container-app py-24 text-muted-foreground">
        Загрузка…
      </div>
    )
  }

  // Guestный режим
  if (!user) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-2xl">
          <h1 className="text-h2 font-heading font-bold mb-6">Специалистам</h1>

          <div className="space-y-6 mb-12">
            <p className="text-body text-foreground max-w-prose">
              ISSEIMI — это профессиональная испанская косметика, созданная для специалистов-косметологов. Мы предлагаем оптовые цены и профессиональные фасовки для вашего кабинета.
            </p>
            <p className="text-body text-foreground max-w-prose">
              Наша линия включает инновационные решения для ухода за кожей, разработанные с использованием активных компонентов высочайшей концентрации. Каждый продукт — результат фармацевтического производства и клинических испытаний.
            </p>
          </div>

          <div className="mb-12">
            <h2 className="text-h3 font-heading font-bold mb-6">Как получить доступ</h2>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-accent rounded-full font-bold text-accent-foreground">1</span>
                <div>
                  <p className="font-semibold text-foreground mb-1">Войдите или создайте аккаунт</p>
                  <p className="text-muted-foreground">Используйте свой номер телефона или email</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-accent rounded-full font-bold text-accent-foreground">2</span>
                <div>
                  <p className="font-semibold text-foreground mb-1">Заполните заявку</p>
                  <p className="text-muted-foreground">Укажите данные вашей организации и специализацию</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-accent rounded-full font-bold text-accent-foreground">3</span>
                <div>
                  <p className="font-semibold text-foreground mb-1">Ждите подтверждения</p>
                  <p className="text-muted-foreground">Наша команда проверит данные в течение 24 часов</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="bg-muted p-6 rounded-block mb-12">
            <h3 className="text-body font-semibold text-foreground mb-3">Условия сотрудничества</h3>
            <p className="text-body-sm text-muted-foreground">
              Условия сотрудничества и особые предложения для профессионалов уточняются индивидуально с нашей командой. Свяжитесь с менеджером после одобрения вашей заявки.
            </p>
          </div>

          <Link
            to="/pro/register"
            className="inline-block px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 transition-opacity min-h-11 focus-visible:outline-ring"
          >
            Войти и подать заявку
          </Link>
        </div>
      </div>
    )
  }

  // Одобренный профи
  if (isApprovedPro(user)) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-2xl bg-success/10 border border-success/30 rounded-block p-8 mb-8">
          <h2 className="text-h3 font-heading font-bold text-success mb-3">✓ Статус подтверждён</h2>
          <p className="text-body text-foreground mb-4">
            Ваша заявка одобрена. В каталоге вам доступны профессиональные цены на всю продукцию ISSEIMI.
          </p>
          <Link to="/catalog" className="text-primary font-semibold hover:underline">
            Перейти в каталог →
          </Link>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Компания</p>
            <p className="text-body font-semibold text-foreground">{user.companyName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">ИНН</p>
            <p className="text-body font-semibold text-foreground">{user.inn}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Специализация</p>
            <p className="text-body font-semibold text-foreground">{user.specialization}</p>
          </div>
        </div>
      </div>
    )
  }

  // Отклонённая или ожидающая заявка
  const isPending = user.proStatus === 'pending'

  if (isPending) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-2xl">
          <div className="bg-accent/10 border border-accent/30 rounded-block p-8 mb-8">
            <h2 className="text-h3 font-heading font-bold text-foreground mb-3">Заявка на проверке</h2>
            <p className="text-body text-muted-foreground">
              Спасибо за подачу заявки! Наша команда проверит данные в течение 24 часов.
            </p>
            {user.proStatus && (
              <p className="text-sm text-muted-foreground mt-4">
                Дата подачи: {new Date().toLocaleDateString('ru-RU')}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Компания</p>
              <p className="text-body font-semibold text-foreground">{user.companyName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ИНН</p>
              <p className="text-body font-semibold text-foreground">{user.inn}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Специализация</p>
              <p className="text-body font-semibold text-foreground">{user.specialization}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-app py-12 md:py-20">
      <div className="max-w-2xl">
        <h1 className="text-h2 font-heading font-bold mb-8">Стать специалистом ISSEIMI</h1>
        <ProApplicationForm onSuccess={() => window.location.reload()} />
      </div>
    </div>
  )
}
