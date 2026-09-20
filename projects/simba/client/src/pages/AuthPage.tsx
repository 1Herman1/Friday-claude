import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../lib/api'
import { BagIcon } from '../components/icons'
import LoginForm from '../components/auth/LoginForm'
import WelcomeBonusPopup from '../components/WelcomeBonusPopup'

const WELCOME_BONUS = 300

export default function AuthPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [welcomeBonus, setWelcomeBonus] = useState(0)
  const [logoIn, setLogoIn] = useState(false)

  // Анимация появления логотипа — один раз при заходе на страницу
  useEffect(() => {
    setLogoIn(true)
  }, [])

  const handleLoginSuccess = async (bonusGranted: number) => {
    // После успешного входа загружаем данные пользователя
    try {
      const res = await authApi.me()
      login(localStorage.getItem('token')!, res.data)

      if (bonusGranted > 0) {
        setWelcomeBonus(bonusGranted)
        return
      }

      navigate('/profile')
    } catch (err) {
      console.error('Failed to load user after login:', err)
      navigate('/profile')
    }
  }

  return (
    <div className="min-h-[100dvh] bg-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Логотип */}
        <div className={`flex justify-center mt-4 mb-10 auth-logo-wrap ${logoIn ? 'is-in' : ''}`}>
          <Link to="/" aria-label="На главную" className="inline-flex rounded-xl auth-logo-link">
            <img src="/logo.png" alt="Симба — зоомагазин" width={227} height={80} className="h-20 w-auto" />
          </Link>
        </div>

        {/* Белая карточка входа */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <LoginForm onSuccess={handleLoginSuccess} />
        </div>

        {/* Разделитель */}
        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium uppercase tracking-wide text-navy-400">или</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Гостевой сценарий */}
        <Link
          to="/checkout"
          className="btn-outline w-full rounded-xl py-3 text-sm font-bold gap-2 flex items-center justify-center">
          <BagIcon className="w-4.5 h-4.5" />
          Оформить заказ без регистрации
        </Link>
        <p className="mt-2 text-center text-xs text-navy-500">
          Понадобятся только имя, телефон и адрес доставки
        </p>

        {/* Юридическая строка */}
        <p className="text-center text-xs text-navy-500 mt-6">
          Покупка — на условиях{' '}
          <Link to="/offer" className="text-primary-hover font-medium underline underline-offset-2">
            публичной оферты
          </Link>
          . Как мы обращаемся с данными — в{' '}
          <Link to="/privacy" className="text-primary-hover font-medium underline underline-offset-2">
            политике конфиденциальности
          </Link>
          .
        </p>
      </div>

      {/* Попап приветственного бонуса */}
      <WelcomeBonusPopup
        open={welcomeBonus > 0}
        amount={welcomeBonus}
        onClose={() => {
          setWelcomeBonus(0)
          navigate('/profile')
        }}
      />

      {/* CSS для анимации логотипа */}
      <style>{`
        @layer components {
          .auth-logo-wrap {
            opacity: 0;
            transform: translateY(-12px);
            transition: opacity 320ms var(--ease-out), transform 320ms var(--ease-out);
          }
          .auth-logo-wrap.is-in {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-logo-wrap {
            transition: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  )
}
