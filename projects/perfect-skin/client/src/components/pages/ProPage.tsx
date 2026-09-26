import { useState } from 'react'
import { Link } from 'react-router-dom'
import { validateTaxId } from '@ps/shared'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { fetchApi, ApiError } from '@/lib/api'

export function ProPage() {
  const { user, isLoading } = useAuth()
  const [formData, setFormData] = useState({
    companyName: user?.companyName || '',
    inn: user?.inn || '',
    specialization: user?.specialization || '',
    comment: '',
    consentPd: false,
    consentMarketing: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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
  const isRejected = user.proStatus === 'rejected'

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

  // Форма подачи заявки (нет статуса, отклонено, или пусто)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!formData.companyName.trim()) {
      setError('Укажите название компании')
      return
    }

    const taxIdValidation = validateTaxId(formData.inn)
    if (!taxIdValidation.ok) {
      setError(taxIdValidation.reason || 'ИНН, ОГРН или ОГРНИП с ошибкой в цифрах — проверьте реквизит')
      return
    }

    if (!formData.specialization.trim()) {
      setError('Укажите специализацию')
      return
    }

    if (!formData.consentPd) {
      setError('Примите условия обработки персональных данных')
      return
    }

    setSubmitting(true)
    try {
      await fetchApi<void>('/api/v1/pro/apply', {
        method: 'POST',
        body: JSON.stringify({
          companyName: formData.companyName,
          inn: formData.inn.replace(/\D/g, ''),
          specialization: formData.specialization,
          comment: formData.comment || undefined,
          consentPd: true,
          consentMarketing: formData.consentMarketing,
        }),
      })

      setSuccessMessage('Заявка отправлена! Статус обновится в течение 24 часов.')
      // Reload user data
      window.location.reload()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'PRO_ALREADY_REQUESTED') {
          setError('Вы уже подали заявку на рассмотрение')
        } else if (err.code === 'PRO_ALREADY_APPROVED') {
          setError('Ваш статус уже одобрен')
        } else {
          setError(err.message || 'Ошибка при отправке заявки')
        }
      } else {
        setError('Ошибка при отправке заявки')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container-app py-12 md:py-20">
      <div className="max-w-2xl">
        <h1 className="text-h2 font-heading font-bold mb-8">Стать специалистом ISSEIMI</h1>

        {isRejected && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-block p-6 mb-8">
            <h3 className="text-body font-semibold text-destructive mb-2">Заявка отклонена</h3>
            <p className="text-body-sm text-foreground mb-4">
              {user.proRejectReason || 'Заявка не соответствует критериям'}
            </p>
            <p className="text-body-sm text-muted-foreground">
              Вы можете подать новую заявку, исправив указанные замечания.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-block p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-success/10 border border-success/30 rounded-block p-4">
              <p className="text-sm text-success">{successMessage}</p>
            </div>
          )}

          <div>
            <label htmlFor="companyName" className="block text-sm font-semibold text-foreground mb-2">
              Салон / ИП / организация <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground"
              placeholder="Название вашего учреждения"
              required
            />
          </div>

          <div>
            <label htmlFor="inn" className="block text-sm font-semibold text-foreground mb-2">
              ИНН, ОГРН или ОГРНИП <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="inn"
              name="inn"
              value={formData.inn}
              onChange={handleChange}
              inputMode="numeric"
              maxLength={15}
              className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground font-mono"
              placeholder="ИНН (10–12 цифр), ОГРН (13 цифр) или ОГРНИП (15 цифр)"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Используется для верификации. Данные не передаются третьим лицам.
            </p>
          </div>

          <div>
            <label htmlFor="specialization" className="block text-sm font-semibold text-foreground mb-2">
              Специализация <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="specialization"
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground"
              placeholder="Косметолог, дерматолог, эстетолог и т.п."
              required
            />
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-semibold text-foreground mb-2">
              Комментарий (необязательно)
            </label>
            <textarea
              id="comment"
              name="comment"
              value={formData.comment}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground min-h-[100px] resize-none"
              placeholder="Расскажите о вашем салоне или кабинете"
            />
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer min-h-11">
              <input
                type="checkbox"
                name="consentPd"
                checked={formData.consentPd}
                onChange={handleChange}
                className="mt-1 w-5 h-5 rounded border-border-strong focus:ring-2 focus:ring-ring cursor-pointer flex-shrink-0"
                required
              />
              <span className="text-sm text-muted-foreground">
                Согласен на обработку персональных данных для проверки статуса специалиста{' '}
                <Link to="/privacy" className="text-primary font-semibold hover:underline">
                  Политика обработки данных
                </Link>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer min-h-11">
              <input
                type="checkbox"
                name="consentMarketing"
                checked={formData.consentMarketing}
                onChange={handleChange}
                className="mt-1 w-5 h-5 rounded border-border-strong focus:ring-2 focus:ring-ring cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-muted-foreground">
                Хочу получать новости и предложения для специалистов
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-6 py-4 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity min-h-11"
          >
            {submitting ? 'Отправляю...' : 'Отправить заявку'}
          </button>
        </form>
      </div>
    </div>
  )
}
