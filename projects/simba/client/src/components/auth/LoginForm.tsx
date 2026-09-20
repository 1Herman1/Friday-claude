import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../lib/api'
import { CONSENT_VERSION } from '@simba/shared'
import { ArrowLeftIcon, CoinsIcon } from '../icons'

type Step = 'input' | 'code'

interface LoginFormProps {
  /** Вызывается после успешного входа. Если bonusGranted > 0, нужно показать попап. */
  onSuccess?: (bonusGranted: number) => void
  /** Если true, скрывает плашку приветственного бонуса */
  hideWelcomeBonus?: boolean
}

const CODE_LENGTH = 6
const WELCOME_BONUS = 300

export default function LoginForm({ onSuccess, hideWelcomeBonus = false }: LoginFormProps) {
  const [step, setStep] = useState<Step>('input')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [stepIn, setStepIn] = useState(false)
  const [cartMergeError, setCartMergeError] = useState('')
  const [pdConsent, setPdConsent] = useState(false)
  const [consentError, setConsentError] = useState('')
  const consentCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setStepIn(true)
  }, [step])

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[a-zA-Zа-яА-Я]{2,}$/.test(email)

  const startResendTimer = () => {
    setResendTimer(60)
    const interval = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) {
          clearInterval(interval)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Введите email')
      setConsentError('')
      return
    }

    if (!isEmailValid) {
      setError('Проверьте адрес — похоже, есть опечатка')
      setConsentError('')
      return
    }

    if (!pdConsent) {
      setConsentError('Нужно согласие на обработку персональных данных')
      consentCheckboxRef.current?.focus()
      return
    }

    setLoading(true)
    setError('')
    setConsentError('')
    setCartMergeError('')

    try {
      await authApi.sendOtp(email.trim())
      setStep('code')
      setStepIn(false)
      setTimeout(() => setStepIn(true), 10)
      startResendTimer()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка отправки кода')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (code.length < CODE_LENGTH) {
      setError('Введите 6-значный код')
      return
    }

    setLoading(true)
    setError('')
    setCartMergeError('')

    try {
      const guestToken = localStorage.getItem('guestToken')
      const res = await authApi.verifyOtp(email.trim(), code, CONSENT_VERSION, guestToken || undefined)
      localStorage.setItem('token', res.data.token)

      // Проверить, было ли слияние корзины
      const payload = res.data as { cartMerged?: boolean; bonusGranted?: number }
      if (guestToken && !payload.cartMerged) {
        setCartMergeError('Ваша корзина не была перенесена. Пожалуйста, добавьте товары заново.')
      }

      localStorage.removeItem('guestToken')

      // Вызвать колбэк успеха с информацией о бонусах
      if (onSuccess) {
        const bonusGranted = payload.bonusGranted ?? 0
        onSuccess(bonusGranted)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Неверный код. Попробуйте ещё раз')
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setCode('')
    setError('')
    setCartMergeError('')
    setLoading(true)
    try {
      await authApi.sendOtp(email.trim())
      startResendTimer()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка отправки кода')
    } finally {
      setLoading(false)
    }
  }

  const handleChangeEmail = () => {
    setStep('input')
    setStepIn(false)
    setCode('')
    setError('')
    setConsentError('')
    setCartMergeError('')
    setTimeout(() => setStepIn(true), 10)
  }

  return (
    <div>
      {/* Шаг: ввод email */}
      <div className="relative">
        <div className={`auth-step ${stepIn && step === 'input' ? 'is-in' : ''}`}>
          <h2 className="text-xl font-bold text-navy-900 mb-1">Вход в аккаунт</h2>
          <p className="text-sm text-navy-500 mb-6">
            Введите email — пришлём код для входа
          </p>

          {/* Поле email */}
          <div className="mb-4">
            <label htmlFor="auth-email" className="block text-sm font-medium text-navy-700 mb-1.5">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              spellCheck={false}
              aria-invalid={!!error && step === 'input'}
              aria-describedby={error && step === 'input' ? 'auth-email-error' : 'auth-email-hint'}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError('')
              }}
              onBlur={() => {
                if (email && !isEmailValid && step === 'input') {
                  setError('Проверьте адрес — похоже, есть опечатка')
                }
              }}
              placeholder="name@example.ru"
              className="w-full px-4 py-3 text-base rounded-xl border bg-white text-navy-900 placeholder-navy-300 focus:outline-none transition-[border-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)] border-line focus:border-primary-soft focus:ring-2 focus:ring-primary-soft/25 aria-[invalid=true]:border-[#C0392B] aria-[invalid=true]:focus:ring-[#C0392B]/20"
            />
            <p
              id={error && step === 'input' ? 'auth-email-error' : 'auth-email-hint'}
              role={error && step === 'input' ? 'alert' : undefined}
              className={`text-xs mt-1.5 min-h-[1.25rem] transition-colors duration-150 ${error && step === 'input' ? 'text-[#C0392B]' : 'text-navy-500'}`}>
              {error && step === 'input' ? error : 'Пришлём код для входа — пароль не нужен'}
            </p>
          </div>

          {/* Чекбокс согласия на обработку ПД */}
          <label htmlFor="auth-pd-consent" className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              ref={consentCheckboxRef}
              id="auth-pd-consent"
              type="checkbox"
              checked={pdConsent}
              onChange={(e) => {
                setPdConsent(e.target.checked)
                if (consentError) setConsentError('')
              }}
              className="mt-0.5 w-4 h-4 shrink-0 accent-ink rounded border border-line focus:outline-none focus:ring-2 focus:ring-primary-soft/25"
              aria-invalid={!!consentError}
              aria-describedby={consentError ? 'auth-pd-consent-error' : undefined}
            />
            <span className="text-sm text-navy-700 leading-snug">
              Даю согласие на обработку персональных данных на условиях{' '}
              <Link to="/consent" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-hover underline underline-offset-2">
                согласия
              </Link>
              {' '}и{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-hover underline underline-offset-2">
                политики конфиденциальности
              </Link>
            </span>
          </label>
          {consentError && (
            <p id="auth-pd-consent-error" role="alert" className="text-xs text-[#C0392B] mb-4">
              {consentError}
            </p>
          )}

          {/* Кнопка отправки */}
          <button
            onClick={handleSendCode}
            disabled={loading || !email.trim() || !isEmailValid}
            className="w-full btn-primary press-wide py-3 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Отправляем...
              </span>
            ) : 'Получить код'}
          </button>

          {/* Плашка приветственного бонуса */}
          {!hideWelcomeBonus && (
            <div className="mt-4 flex items-start gap-2 rounded-card bg-amber-50 px-3 py-2.5">
              <CoinsIcon className="mt-0.5 shrink-0 w-4.5 h-4.5 text-amber-600" />
              <p className="text-xs leading-relaxed text-navy-700">
                <span className="font-bold text-amber-600">+{WELCOME_BONUS} бонусов</span> за регистрацию — это {WELCOME_BONUS} ₽ скидки на первый заказ
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Шаг: ввод кода */}
      <div className="relative">
        <div className={`auth-step ${stepIn && step === 'code' ? 'is-in' : ''}`}>
          <button
            onClick={handleChangeEmail}
            aria-label="Изменить email"
            className="flex items-center gap-1.5 text-navy-400 hover:text-navy-700 transition-colors text-sm mb-4 py-2 -my-2">
            <ArrowLeftIcon className="ico-nudge ico-nudge--back w-4 h-4" />
            Изменить
          </button>

          <h2 className="text-xl font-bold text-navy-900 mb-1">Введите код</h2>
          <p className="text-sm text-navy-400 mb-6">
            Код отправлен на <span className="font-semibold text-navy-700">{email}</span>
          </p>

          {/* Ошибка слияния корзины */}
          {cartMergeError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-800">{cartMergeError}</p>
            </div>
          )}

          {/* Поле кода */}
          <div className="mb-4">
            <label htmlFor="auth-code" className="sr-only">
              Код из письма
            </label>
            <input
              id="auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              aria-invalid={!!error && step === 'code'}
              aria-describedby={error && step === 'code' ? 'auth-code-error' : undefined}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
                if (error) setError('')
              }}
              placeholder="______"
              className="w-full px-4 py-4 rounded-xl border text-center text-2xl font-bold tracking-[0.4em] text-navy-900 placeholder-navy-200 focus:outline-none transition-[border-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)] border-line focus:border-primary-soft focus:ring-2 focus:ring-primary-soft/25 aria-[invalid=true]:border-[#C0392B] aria-[invalid=true]:focus:ring-[#C0392B]/20"
            />
            <p
              id={error && step === 'code' ? 'auth-code-error' : undefined}
              role={error && step === 'code' ? 'alert' : undefined}
              className={`text-xs mt-1.5 min-h-[1.25rem] transition-colors duration-150 text-center ${error && step === 'code' ? 'text-[#C0392B]' : 'text-navy-500'}`}>
              {error && step === 'code' ? error : ''}
            </p>
          </div>

          {/* Кнопка проверки */}
          <button
            onClick={handleVerifyCode}
            disabled={loading || code.length < CODE_LENGTH}
            className="w-full btn-primary press-wide py-3 disabled:opacity-50 disabled:cursor-not-allowed mb-4">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Проверяем...
              </span>
            ) : 'Войти'}
          </button>

          {/* Повторная отправка */}
          <div className="text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-navy-400">
                Отправить повторно через <span className="font-semibold text-navy-700">{resendTimer} с</span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={loading}
                className="text-sm text-navy-700 hover:text-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium">
                Отправить код повторно
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
