import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchApi, ApiError } from '@/lib/api'

const inputClass =
  'w-full min-h-11 px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground'

export default function StaffLoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await fetchApi('/api/v1/auth/staff-login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      })
      // Полная перезагрузка: контекст авторизации перечитает /auth/me с новой кукой.
      window.location.assign('/admin')
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Слишком много попыток. Попробуйте через 15 минут.')
      } else {
        setError('Неверный логин или пароль')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="container-app py-12 md:py-20">
      <div className="max-w-sm mx-auto">
        <h1 className="text-h2 font-heading font-bold mb-6">Вход для сотрудников</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="staff-login" className="block text-sm font-semibold text-foreground mb-2">
              Логин
            </label>
            <input
              id="staff-login"
              name="username"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="staff-password" className="block text-sm font-semibold text-foreground mb-2">
              Пароль
            </label>
            <input
              id="staff-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !login || !password}
            className="min-h-11 px-6 py-3 bg-primary text-primary-foreground font-heading font-bold rounded-pill hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Входим…' : 'Войти'}
          </button>
        </form>
        <p className="mt-6 text-body-sm text-muted-foreground">
          Нет логина? <Link to="/auth?next=/admin" className="text-primary underline-offset-4 hover:underline">Войти по коду на email</Link>
        </p>
      </div>
    </div>
  )
}
