import { useEffect, useState } from 'react'
import { fetchMarketingConsent, updateMarketingConsent } from '@/lib/account-api'
import { AD_CONSENT_TEXT } from '@/lib/consent-texts'

type Failure = { kind: 'load' } | { kind: 'save'; wanted: boolean }

const RETRY_BUTTON = 'text-sm font-semibold text-primary underline underline-offset-2 hover:opacity-80 min-h-11'

export function MarketingConsentSection() {
  const [consent, setConsent] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let ignore = false

    fetchMarketingConsent()
      .then((value) => {
        if (!ignore) setConsent(value)
      })
      .catch(() => {
        if (!ignore) setFailure({ kind: 'load' })
      })

    return () => {
      ignore = true
    }
  }, [loadAttempt])

  const save = async (next: boolean) => {
    setSaving(true)
    setFailure(null)
    try {
      setConsent(await updateMarketingConsent(next))
    } catch {
      setFailure({ kind: 'save', wanted: next })
    } finally {
      setSaving(false)
    }
  }

  const retry = () => {
    if (failure?.kind === 'save') {
      save(failure.wanted)
      return
    }
    setFailure(null)
    setLoadAttempt((attempt) => attempt + 1)
  }

  return (
    <section aria-busy={saving} className="p-6 rounded-block border border-border bg-card">
      <h2 className="font-semibold text-foreground mb-4">Уведомления и предложения</h2>

      {failure?.kind === 'load' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="alert" className="text-sm text-destructive">
            Не удалось загрузить настройку
          </p>
          <button type="button" onClick={retry} className={RETRY_BUTTON}>
            Повторить
          </button>
        </div>
      ) : consent === null ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <label
          className={`flex items-start gap-3 cursor-pointer min-h-11 transition-opacity ${saving ? 'opacity-60' : ''}`}
        >
          <input
            type="checkbox"
            checked={consent}
            disabled={saving}
            onChange={(e) => save(e.target.checked)}
            className="w-5 h-5 mt-0.5 flex-shrink-0 rounded border border-border-strong checked:bg-primary checked:border-primary cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="text-sm text-foreground leading-snug">{AD_CONSENT_TEXT}</span>
        </label>
      )}

      {failure?.kind === 'save' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">
            Не удалось сохранить. Попробуйте ещё раз
          </p>
          <button type="button" onClick={retry} className={RETRY_BUTTON}>
            Повторить
          </button>
        </div>
      )}
    </section>
  )
}
