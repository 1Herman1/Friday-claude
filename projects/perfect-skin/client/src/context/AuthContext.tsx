import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { fetchApi, ApiError } from '@/lib/api'

export interface User {
  id: string
  name: string
  phone: string
  email?: string
  role: string
}

interface SendOtpResponse {
  channel: string
  expiresIn: number
  resendAfter: number
}

interface VerifyOtpResponse {
  token: string
  user: User
  cartMerged?: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthed: boolean
  sendOtp: (email: string) => Promise<SendOtpResponse>
  verifyOtp: (email: string, code: string) => Promise<VerifyOtpResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // При монтировании спрашиваем сервер, кто мы. Проверить заранее нечего:
  // кука ps_auth недоступна скриптам, и это как раз то, чего мы добиваемся.
  // Гостю /me отвечает 401 — это не ошибка, а ответ «не вошёл».
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await fetchApi<User>('/api/v1/auth/me')
        setUser(userData)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setUser(null)
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const sendOtp = async (email: string): Promise<SendOtpResponse> => {
    const response = await fetchApi<SendOtpResponse>('/api/v1/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    return response
  }

  const verifyOtp = async (email: string, code: string): Promise<VerifyOtpResponse> => {
    const response = await fetchApi<VerifyOtpResponse>('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })

    // Токен из ответа намеренно не сохраняем: сервер уже поставил куку
    // ps_auth с httpOnly. Копия в localStorage свела бы эту защиту на нет.
    setUser(response.user)

    return response
  }

  const logout = async () => {
    try {
      await fetchApi<void>('/api/v1/auth/logout', {
        method: 'POST',
      })
    } finally {
      // Куку гасит сервер в /auth/logout; здесь очищаем только своё состояние.
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthed: !!user,
        sendOtp,
        verifyOtp,
        logout,
      }}
    >
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
