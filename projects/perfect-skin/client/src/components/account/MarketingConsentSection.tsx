import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/api'

interface MarketingConsentResponse {
  consent: boolean
}

export function MarketingConsentSection() {
  const [consent, setConsent] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    const loadConsent = async () => {
      try {
        const result = await fetchApi<MarketingConsentResponse>('/api/v1/auth/me/marketing')
        if (!ignore) setConsent(result.consent)
      } catch {
        if (!ignore) setError('Не удалось загрузить настройку')
      }
    }

    loadConsent()
    return () => {
      ignore = true
    }
  }, [])

  const handleToggle = async (next: boolean) => {
    setSaving(true)
    setError('')
    try {
      const result = await fetchApi<MarketingConsentResponse>('/api/v1/auth/me/marketing', {
        method: 'PATCH',
        body: JSON.stringify({ consent: next }),
      })
      setConsent(result.consent)
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="p-6 rounded-block border border-border bg-card">
      <h2 className="font-semibold text-foreground mb-4">Уведомления и предложения</h2>
      <label className="flex items-start gap-3 cursor-pointer min-h-11">
        <input
          type="checkbox"
          checked={consent === true}
          disabled={consent === null || saving}
          onChange={(e) => handleToggle(e.target.checked)}
          className="w-5 h-5 mt-0.5 flex-shrink-0 rounded border border-border-strong checked:bg-primary checked:border-primary cursor-pointer disabled:cursor-not-allowed"
        />
        <span className="text-sm text-foreground leading-snug">
          Получать напоминания о пополнении средств, закрытые предложения и бонусы (звонок, SMS, Telegram, WhatsApp)
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
