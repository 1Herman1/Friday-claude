import { useRef, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { IconUser, IconArrowRight } from '@/components/icons'

type Step = 'input' | 'code'

const CODE_LENGTH = 6
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Zа-яА-Я]{2,}$/

export function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { sendOtp, verifyOtp } = useAuth()

  const [step, setStep] = useState<Step>('input')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [stepIn, setStepIn] = useState(false)

  // Анимация появления шага
  useEffect(() => {
    setStepIn(true)
  }, [step])

  const isEmailValid = EMAIL_REGEX.test(email)

  // Интервал в ref: при уходе со страницы до конца отсчёта его надо
  // остановить, иначе setState стреляет по размонтированному компоненту.
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current)
    }
  }, [])

  const startResendTimer = (seconds: number) => {
    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current)
    setResendTimer(seconds)
    resendIntervalRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          if (resendIntervalRef.current) clearInterval(resendIntervalRef.current)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Введите email')
      return
    }

    if (!isEmailValid) {
      setError('Проверьте адрес — похоже, есть опечатка')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await sendOtp(email.trim().toLowerCase())
      setStep('code')
      setStepIn(false)
      setTimeout(() => setStepIn(true), 10)
      startResendTimer(response.resendAfter)
    } catch (err) {
      if (err instanceof ApiError) {
        const message = getErrorMessage(err.code)
        setError(message)
      } else {
        setError('Ошибка отправки кода')
      }
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

    try {
      await verifyOtp(email.trim().toLowerCase(), code)

      // Если корзина была объединена, обновить её на странице-назначении
      const nextUrl = searchParams.get('next') || '/orders'
      navigate(nextUrl)
    } catch (err) {
      if (err instanceof ApiError) {
        const message = getErrorMessage(err.code)
        setError(message)
      } else {
        setError('Ошибка проверки кода')
      }
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setCode('')
    setError('')
    setLoading(true)
    try {
      const response = await sendOtp(email.trim().toLowerCase())
      startResendTimer(response.resendAfter)
    } catch (err) {
      if (err instanceof ApiError) {
        const message = getErrorMessage(err.code)
        setError(message)
      } else {
        setError('Ошибка отправки кода')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChangeEmail = () => {
    setStep('input')
    setStepIn(false)
    setCode('')
    setError('')
    setTimeout(() => setStepIn(true), 10)
  }

  const isDemoMode = import.meta.env.VITE_API_MODE === 'snapshot'

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Логотип */}
        <div className="flex justify-center mb-10">
          <img
            src="/logo/logo-wordmark.webp"
            alt="Perfect Skin"
            width={120}
            height={20}
            className="h-6 w-auto"
          />
        </div>

        {/* Карточка входа */}
        <div className="bg-card rounded-block shadow-sm p-8 border border-border">
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
            <>
              {/* Шаг: ввод email */}
              <div className="relative">
                <div
                  className={`transition-[opacity,transform] duration-200 ${
                    stepIn && step === 'input'
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-2 absolute inset-0'
                  }`}
                >
                  <h1 className="text-lg font-heading font-semibold text-foreground mb-1">
                    Введите email
                  </h1>
                  <p className="text-body-sm text-muted-foreground mb-6">
                    Пришлём код для входа
                  </p>

                  <div className="mb-4">
                    <label
                      htmlFor="auth-email"
                      className="block text-sm font-semibold text-foreground mb-2"
                    >
                      Email
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      spellCheck={false}
                      aria-invalid={!!error && step === 'input'}
                      aria-describedby={
                        error && step === 'input'
                          ? 'auth-email-error'
                          : 'auth-email-hint'
                      }
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder="name@example.ru"
                      className="w-full px-4 py-3 text-base rounded-pill border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/20 min-h-11"
                    />
                    <p
                      id={
                        error && step === 'input'
                          ? 'auth-email-error'
                          : 'auth-email-hint'
                      }
                      role={error && step === 'input' ? 'alert' : undefined}
                      className={`text-xs mt-2 min-h-[1.25rem] transition-colors duration-150 ${
                        error && step === 'input'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {error && step === 'input'
                        ? error
                        : 'Пришлём код для входа — пароль не нужен'}
                    </p>
                  </div>

                  <button
                    onClick={handleSendCode}
                    disabled={loading || !email.trim() || !isEmailValid}
                    className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors min-h-11 flex items-center justify-center"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                          />
                        </svg>
                        Отправляем...
                      </span>
                    ) : (
                      'Получить код'
                    )}
                  </button>
                </div>
              </div>

              {/* Шаг: ввод кода */}
              <div className="relative">
                <div
                  className={`transition-[opacity,transform] duration-200 ${
                    stepIn && step === 'code'
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-2 absolute inset-0'
                  }`}
                >
                  <button
                    onClick={handleChangeEmail}
                    aria-label="Изменить email"
                    className="flex items-center gap-2 text-foreground hover:text-primary transition-colors text-sm mb-4 py-2 -my-2 font-semibold min-h-11"
                  >
                    <IconArrowRight className="w-4 h-4 transform rotate-180" />
                    Изменить
                  </button>

                  <h1 className="text-lg font-heading font-semibold text-foreground mb-1">
                    Введите код
                  </h1>
                  <p className="text-body-sm text-muted-foreground mb-6">
                    Код отправлен на{' '}
                    <span className="font-semibold text-foreground">{email}</span>
                  </p>

                  <div className="mb-4">
                    <label htmlFor="auth-code" className="block text-sm font-semibold text-foreground mb-2">
                      Код из письма
                    </label>
                    <input
                      id="auth-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={CODE_LENGTH}
                      aria-invalid={!!error && step === 'code'}
                      aria-describedby={
                        error && step === 'code' ? 'auth-code-error' : undefined
                      }
                      value={code}
                      onChange={(e) => {
                        setCode(
                          e.target.value
                            .replace(/\D/g, '')
                            .slice(0, CODE_LENGTH)
                        )
                        if (error) setError('')
                      }}
                      className="w-full px-4 py-4 rounded-pill border text-center text-2xl font-bold tracking-[0.4em] text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border focus:border-primary focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/20 min-h-11"
                    />
                    <p
                      id={
                        error && step === 'code'
                          ? 'auth-code-error'
                          : undefined
                      }
                      role={error && step === 'code' ? 'alert' : undefined}
                      className={`text-xs mt-2 min-h-[1.25rem] transition-colors duration-150 text-center ${
                        error && step === 'code'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {error && step === 'code' ? error : ''}
                    </p>
                  </div>

                  <button
                    onClick={handleVerifyCode}
                    disabled={loading || code.length < CODE_LENGTH}
                    className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors min-h-11 flex items-center justify-center mb-4"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                          />
                        </svg>
                        Проверяем...
                      </span>
                    ) : (
                      'Войти'
                    )}
                  </button>

                  {/* Повторная отправка */}
                  <div className="text-center">
                    {resendTimer > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Отправить повторно через{' '}
                        <span className="font-semibold text-foreground">
                          {resendTimer} с
                        </span>
                      </p>
                    ) : (
                      <button
                        onClick={handleResend}
                        disabled={loading}
                        className="text-sm text-primary hover:text-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                      >
                        Отправить код повторно
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    OTP_RATE_LIMITED: 'Слишком много попыток. Попробуйте позже',
    OTP_BLOCKED: 'Номер заблокирован на время. Попробуйте позже',
    OTP_INVALID: 'Неверный код. Проверьте и попробуйте ещё раз',
    NETWORK_ERROR: 'Нет соединения с сервером',
    UNKNOWN_ERROR: 'Ошибка сервера',
  }
  return messages[code] || 'Что-то пошло не так. Попробуйте ещё раз'
}
