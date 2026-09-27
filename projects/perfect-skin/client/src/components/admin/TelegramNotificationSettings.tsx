import { useEffect, useState } from 'react'
import { fetchApi, ApiError } from '@/lib/api'

interface LinkCodeResponse {
  code: string
  deepLink: string | null
  expiresAt: string
}

interface LinkStatusResponse {
  linked: boolean
  linkedAt: string | null
}

export function TelegramNotificationSettings() {
  const [isLinked, setIsLinked] = useState(false)
  const [linkedAt, setLinkedAt] = useState<string | null>(null)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)

  // Загрузить статус привязки
  const loadLinkStatus = async () => {
    try {
      const response = await fetchApi<LinkStatusResponse>('/api/v1/admin/telegram/link')
      setIsLinked(response.linked)
      setLinkedAt(response.linkedAt)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          // Пользователь не имеет прав
          return
        }
        setError(err.code === 'NOT_AUTHENTICATED' ? null : err.message)
      }
    }
  }

  // Генерировать новый код привязки
  const handleGenerateCode = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchApi<LinkCodeResponse>('/api/v1/admin/telegram/link-code', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setLinkCode(response.code)
      setDeepLink(response.deepLink)
      setShowCode(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Ошибка при генерировании кода')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Отвязать Telegram
  const handleUnlink = async () => {
    if (!confirm('Вы уверены? Уведомления в Telegram будут отключены.')) return

    setIsLoading(true)
    setError(null)
    try {
      await fetchApi('/api/v1/admin/telegram/link', { method: 'DELETE' })
      setIsLinked(false)
      setLinkedAt(null)
      setShowCode(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Ошибка при отвязке')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLinkStatus()
  }, [])

  return (
    <div className="bg-card rounded-block border border-border p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Уведомления в Telegram</h2>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-block p-3 mb-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLinked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm text-muted-foreground">
              Telegram подключён {linkedAt ? new Date(linkedAt).toLocaleDateString('ru-RU') : ''}
            </span>
          </div>
          <button
            onClick={handleUnlink}
            disabled={isLoading}
            className="text-sm px-4 py-2 rounded-pill border border-border hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Отключить Telegram"
          >
            Отключить
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Подключите Telegram для получения уведомлений о новых заявках специалистов
          </p>

          {showCode && linkCode ? (
            <div className="bg-muted rounded-block p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Код привязки (действителен 10 минут):</p>
                <div className="bg-card rounded-block p-3 font-mono text-center text-lg font-semibold tracking-widest">
                  {linkCode}
                </div>
              </div>

              {deepLink && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Или перейдите по ссылке:</p>
                  <a
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-pill text-sm font-medium transition-colors"
                    aria-label="Открыть Telegram бота"
                  >
                    Открыть в Telegram
                  </a>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Затем отправьте боту команду: <code>/start {linkCode}</code>
              </p>
            </div>
          ) : (
            <button
              onClick={handleGenerateCode}
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-pill font-medium transition-colors disabled:opacity-50"
              aria-label="Подключить Telegram"
            >
              {isLoading ? 'Генерирую код...' : 'Подключить Telegram'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
