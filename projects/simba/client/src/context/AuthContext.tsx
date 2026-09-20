import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, type User, registerUnauthorizedHandler } from '../lib/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isLoggedIn: boolean // true если вошёл по-настоящему (не гость)
  login: (token: string, user: User) => void
  logout: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Загружаем текущего пользователя при старте приложения
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const res = await authApi.me()
        setUser(res.data)
      } catch {
        // Токен недействителен — удаляем его
        localStorage.removeItem('token')
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem('token', token)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  const updateUser = useCallback((userData: User) => {
    setUser(userData)
  }, [])

  // Обработчик просроченной сессии живёт ЗДЕСЬ, а не на отдельных страницах.
  // Регистрация из одной страницы оставляла бы остальные (в том числе чекаут)
  // на запасном пути с window.location.href — то есть с перезагрузкой, которая
  // стирает заполненную форму. Ровно от неё мы и уходим.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null)
      navigate('/auth')
    })
  }, [navigate])

  const isLoggedIn = !!user && !user.isGuest

  return (
    <AuthContext.Provider value={{ user, isLoading, isLoggedIn, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
