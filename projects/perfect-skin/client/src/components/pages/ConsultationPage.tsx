import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { NEEDS_LABELS } from '@/lib/quiz-match'
import { fetchApi, ApiError } from '@/lib/api'

export function ConsultationPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    channel: 'phone' as 'phone' | 'telegram' | 'whatsapp',
    message: '',
    skinType: searchParams.get('skin') || '',
    concern: (() => { const c = searchParams.get('concern') || ''; return NEEDS_LABELS[c] ?? (/^[a-z_]+$/.test(c) ? '' : c) })(),
    source: searchParams.get('source') || '',
    consentPd: false,
    consentHealth: false,
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
    // Очищаем ошибку для этого поля
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      channel: formData.channel,
      message: formData.message.trim() || undefined,
      skinType: formData.skinType || undefined,
      concern: formData.concern.trim() || undefined,
      source: formData.source || undefined,
      consentPd: 'true',
      consentHealth: 'true',
    }

    // Базовая валидация
    if (!payload.name) {
      setFieldErrors((prev) => ({ ...prev, name: 'Укажите ваше имя' }))
      return
    }
    if (!payload.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: 'Укажите номер телефона' }))
      return
    }
    if (!formData.consentPd) {
      setError('Согласие на обработку ПДн обязательно')
      return
    }
    if (!formData.consentHealth) {
      setError('Согласие на обработку данных о состоянии кожи обязательно')
      return
    }

    setSubmitting(true)
    try {
      await fetchApi<{ ok: boolean }>('/api/v1/consultations', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'VALIDATION_ERROR') {
          const field = err.details?.field as string | undefined
          if (field) {
            setFieldErrors((prev) => ({ ...prev, [field]: err.message }))
          } else {
            setError(err.message || 'Проверьте введённые данные')
          }
        } else if (err.code === 'RATE_LIMITED') {
          setError('Слишком много запросов. Попробуйте позже')
        } else {
          setError(err.message || 'Ошибка при отправке заявки')
        }
      } else if (import.meta.env.VITE_API_MODE === 'snapshot') {
        // В режиме снимка покажем заглушку
        setError('В режиме просмотра отправка недоступна')
      } else {
        setError('Ошибка при отправке заявки')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="container-app py-12 md:py-20">
        <div className="max-w-2xl">
          <div className="bg-success/10 border border-success/30 rounded-block p-8">
            <h2 className="text-h3 font-heading font-bold text-success mb-3">✓ Заявка принята</h2>
            <p className="text-body text-foreground mb-4">
              Спасибо! Специалист свяжется с вами в рабочее время через выбранный канал.
            </p>
            <p className="text-body-sm text-muted-foreground mb-6">
              Если вы указали, что нужна фото консультация, специалист пришлёт ссылку на видеозвонок или попросит фото проблемной зоны.
            </p>
            <Link to="/" className="text-primary font-semibold hover:underline">
              Вернуться на главную →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-app py-12 md:py-20">
      <div className="max-w-2xl">
        <h1 className="text-h2 font-heading font-bold mb-2">Запишитесь на консультацию</h1>
        <p className="text-body text-muted-foreground mb-8">
          Опишите вашу задачу или кожный вопрос — косметолог перезвонит или напишет в удобном мессенджере.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-block p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-foreground mb-2">
              Ваше имя <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full min-h-11 px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground"
              placeholder="Как вас зовут?"
              required
            />
            {fieldErrors.name && <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-foreground mb-2">
              Номер телефона <span className="text-destructive">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full min-h-11 px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground font-mono"
              placeholder="+7 (___) ___-__-__"
              required
            />
            {fieldErrors.phone && <p className="text-xs text-destructive mt-1">{fieldErrors.phone}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">
              Email (опционально)
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full min-h-11 px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground"
              placeholder="ваш@email.com"
            />
          </div>

          <div>
            <label htmlFor="channel" className="block text-sm font-semibold text-foreground mb-2">
              Как вам удобнее общаться? <span className="text-destructive">*</span>
            </label>
            <select
              id="channel"
              name="channel"
              value={formData.channel}
              onChange={handleChange}
              className="w-full min-h-11 px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground"
              required
            >
              <option value="phone">По телефону</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>

          <div>
            <label htmlFor="skinType" className="block text-sm font-semibold text-foreground mb-2">
              Ваш тип кожи (опционально)
            </label>
            <select
              id="skinType"
              name="skinType"
              value={formData.skinType}
              onChange={handleChange}
              className="w-full min-h-11 px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground"
            >
              <option value="">— Не указан —</option>
              <option value="normal">Нормальная</option>
              <option value="dry">Сухая</option>
              <option value="oily">Жирная</option>
              <option value="combination">Комбинированная</option>
              <option value="sensitive">Чувствительная</option>
              <option value="mature">Зрелая</option>
            </select>
          </div>

          <div>
            <label htmlFor="concern" className="block text-sm font-semibold text-foreground mb-2">
              Главная задача (опционально)
            </label>
            <input
              type="text"
              id="concern"
              name="concern"
              value={formData.concern}
              onChange={handleChange}
              className="w-full min-h-11 px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground"
              placeholder="Напр., улучшить текстуру, избавиться от акне…"
              maxLength={80}
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-semibold text-foreground mb-2">
              Подробности (опционально)
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={5}
              className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground"
              placeholder="Расскажите про вашу кожу, что пробовали, что беспокоит…"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Фото пришлёт специалист в мессенджере, если понадобится — сюда не прикладывайте.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="consentPd"
                name="consentPd"
                checked={formData.consentPd}
                onChange={handleChange}
                className="w-5 h-5 rounded border-border-strong bg-card text-primary focus:ring-2 focus:ring-ring mt-1 flex-shrink-0"
                required
              />
              <label htmlFor="consentPd" className="text-sm text-foreground">
                Я согласен на обработку персональных данных. Подробнее в{' '}
                <Link to="/privacy" className="text-primary hover:underline">
                  политике конфиденциальности
                </Link>
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="consentHealth"
                name="consentHealth"
                checked={formData.consentHealth}
                onChange={handleChange}
                className="w-5 h-5 rounded border-border-strong bg-card text-primary focus:ring-2 focus:ring-ring mt-1 flex-shrink-0"
                required
              />
              <label htmlFor="consentHealth" className="text-sm text-foreground">
                Понимаю, что сообщение может содержать сведения о состоянии кожи, и согласен на их обработку для консультации.
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 transition-opacity disabled:opacity-50 min-h-11 focus-visible:outline-ring"
          >
            {submitting ? 'Отправляю…' : 'Отправить'}
          </button>
        </form>
      </div>
    </div>
  )
}
