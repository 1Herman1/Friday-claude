import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api'
import { submitCareRequest, type CareChannel } from '@/lib/care-api'
import { BTN_OUTLINE, BTN_PRIMARY } from '@/components/about/classes'

type FieldKey = 'name' | 'phone' | 'consentPd'
type FieldErrors = Partial<Record<FieldKey, string>>

const FIELD_KEYS: FieldKey[] = ['name', 'phone', 'consentPd']

const CHANNELS: { value: CareChannel; label: string }[] = [
  { value: 'phone', label: 'Телефон' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const CONSENT_ERROR = 'Отметьте согласие — без него мы не сможем связаться'
const INPUT =
  'w-full min-h-11 px-4 py-3 border rounded-block bg-card text-foreground focus:outline-ring focus:ring-2 focus:ring-ring'
const FIELD_LABEL = 'block text-body-sm font-semibold text-foreground mb-2'
const CHECKBOX = 'mt-0.5 size-5 shrink-0 accent-primary'
const CHECK_LABEL = 'text-body-sm text-foreground cursor-pointer'

function isFieldKey(value: unknown): value is FieldKey {
  return FIELD_KEYS.includes(value as FieldKey)
}

export function CareRequestForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState<CareChannel>('phone')
  const [consentPd, setConsentPd] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')

  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const consentRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const fieldRefs = { name: nameRef, phone: phoneRef, consentPd: consentRef }
  const busy = status === 'sending'

  useEffect(() => {
    if (status === 'done') doneRef.current?.focus()
  }, [status])

  const focusFirstError = (found: FieldErrors) => {
    const key = FIELD_KEYS.find((k) => found[k])
    if (key) fieldRefs[key].current?.focus()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found: FieldErrors = {}
    if (!name.trim()) found.name = 'Укажите имя'
    if (!phone.trim()) found.phone = 'Укажите номер телефона'
    if (!consentPd) found.consentPd = CONSENT_ERROR
    setErrors(found)
    setFormError('')

    if (Object.keys(found).length > 0) {
      focusFirstError(found)
      return
    }

    setStatus('sending')
    try {
      await submitCareRequest({
        name: name.trim(),
        phone: phone.trim(),
        channel,
        consentPd: 'true',
        consentMarketing: consentMarketing ? 'true' : 'false',
      })
      setStatus('done')
    } catch (err) {
      setStatus('idle')
      if (!(err instanceof ApiError)) {
        setFormError('Ошибка при отправке заявки')
        return
      }
      const field = err.details?.field
      if (err.code === 'VALIDATION_ERROR' && isFieldKey(field)) {
        const serverErrors: FieldErrors = {}
        serverErrors[field] = err.message
        setErrors(serverErrors)
        focusFirstError(serverErrors)
      } else if (err.status === 429 || err.code === 'RATE_LIMITED') {
        setFormError('Слишком много запросов. Попробуйте позже')
      } else {
        setFormError(err.message || 'Ошибка при отправке заявки')
      }
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="text-body-sm text-muted-foreground mb-6">
        Оставьте контакты — специалист Отдела заботы свяжется с вами и расскажет о персональном сопровождении.
      </p>

      {status === 'done' ? (
        <div ref={doneRef} tabIndex={-1} role="status" className="space-y-6 outline-none">
          <p className="font-heading font-semibold text-xl text-foreground">
            Спасибо! Отдел заботы свяжется с вами.
          </p>
          <button type="button" onClick={onDone} className={`${BTN_OUTLINE} sm:w-full`}>
            Готово
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} aria-busy={busy} className="space-y-6">
          <div>
            <label htmlFor="care-name" className={FIELD_LABEL}>
              Имя
            </label>
            <input
              id="care-name"
              ref={nameRef}
              name="name"
              type="text"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={busy}
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={errors.name ? 'care-name-error' : undefined}
              className={`${INPUT} ${errors.name ? 'border-destructive' : 'border-border-strong'}`}
            />
            {errors.name && (
              <p id="care-name-error" className="mt-2 text-body-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="care-phone" className={FIELD_LABEL}>
              Телефон
            </label>
            <input
              id="care-phone"
              ref={phoneRef}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              readOnly={busy}
              aria-invalid={errors.phone ? 'true' : undefined}
              aria-describedby={errors.phone ? 'care-phone-error' : undefined}
              className={`${INPUT} tabular-nums ${errors.phone ? 'border-destructive' : 'border-border-strong'}`}
            />
            {errors.phone && (
              <p id="care-phone-error" className="mt-2 text-body-sm text-destructive">
                {errors.phone}
              </p>
            )}
          </div>

          <fieldset>
            <legend className={FIELD_LABEL}>Как связаться</legend>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((item) => (
                <label key={item.value}>
                  <input
                    type="radio"
                    name="channel"
                    value={item.value}
                    checked={channel === item.value}
                    onChange={() => setChannel(item.value)}
                    disabled={busy}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-pill border border-border-strong px-3 text-body-sm font-semibold text-foreground cursor-pointer peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-start gap-3 py-2">
              <input
                id="care-consent-pd"
                ref={consentRef}
                type="checkbox"
                checked={consentPd}
                onChange={(e) => setConsentPd(e.target.checked)}
                disabled={busy}
                aria-invalid={errors.consentPd ? 'true' : undefined}
                aria-describedby={errors.consentPd ? 'care-consent-error' : undefined}
                className={CHECKBOX}
              />
              <label htmlFor="care-consent-pd" className={CHECK_LABEL}>
                Согласен(на) на обработку персональных данных, чтобы со мной связались по заявке и рассказали о
                персональном сопровождении.{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener"
                  className="text-primary underline underline-offset-2"
                >
                  Политика конфиденциальности
                </a>
              </label>
            </div>
            {errors.consentPd && (
              <p id="care-consent-error" className="text-body-sm text-destructive">
                {errors.consentPd}
              </p>
            )}

            <div className="flex items-start gap-3 py-2">
              <input
                id="care-consent-marketing"
                type="checkbox"
                checked={consentMarketing}
                onChange={(e) => setConsentMarketing(e.target.checked)}
                disabled={busy}
                className={CHECKBOX}
              />
              <label htmlFor="care-consent-marketing" className={CHECK_LABEL}>
                Согласен(на) получать от ИП Рыбко А. А. напоминания о пополнении средств, закрытые предложения и
                информацию о бонусах — звонком, SMS, в Telegram или WhatsApp.
              </label>
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-body-sm text-destructive">
              {formError}
            </p>
          )}

          <button type="submit" disabled={busy} className={`${BTN_PRIMARY} sm:w-full`}>
            {busy ? 'Отправляем…' : 'Отправить'}
          </button>
        </form>
      )}
    </div>
  )
}
