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

type BotKind = 'pro' | 'orders'

interface BotState {
  isLinked: boolean
  linkedAt: string | null
  linkCode: string | null
  deepLink: string | null
  isLoading: boolean
  error: string | null
  showCode: boolean
}

export function TelegramNotificationSettings() {
  const [proBot, setProBot] = useState<BotState>({
    isLinked: false,
    linkedAt: null,
    linkCode: null,
    deepLink: null,
    isLoading: false,
    error: null,
    showCode: false,
  })

  const [ordersBot, setOrdersBot] = useState<BotState>({
    isLinked: false,
    linkedAt: null,
    linkCode: null,
    deepLink: null,
    isLoading: false,
    error: null,
    showCode: false,
  })

  // Загрузить статус привязки для обоих ботов
  const loadLinkStatus = async () => {
    try {
      const proResponse = await fetchApi<LinkStatusResponse>('/api/v1/admin/telegram/link/pro')
      setProBot(prev => ({
        ...prev,
        isLinked: proResponse.linked,
        linkedAt: proResponse.linkedAt,
        error: null,
      }))
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401 && err.status !== 403) {
        setProBot(prev => ({
          ...prev,
          error: err.message,
        }))
      }
    }

    try {
      const ordersResponse = await fetchApi<LinkStatusResponse>('/api/v1/admin/telegram/link/orders')
      setOrdersBot(prev => ({
        ...prev,
        isLinked: ordersResponse.linked,
        linkedAt: ordersResponse.linkedAt,
        error: null,
      }))
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401 && err.status !== 403) {
        setOrdersBot(prev => ({
          ...prev,
          error: err.message,
        }))
      }
    }
  }

  // Генерировать новый код привязки для конкретного бота
  const handleGenerateCode = async (botKind: BotKind) => {
    const setState = botKind === 'pro' ? setProBot : setOrdersBot

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await fetchApi<LinkCodeResponse>('/api/v1/admin/telegram/link-code', {
        method: 'POST',
        body: JSON.stringify({ botKind }),
      })
      setState(prev => ({
        ...prev,
        linkCode: response.code,
        deepLink: response.deepLink,
        showCode: true,
        isLoading: false,
      }))
    } catch (err) {
      if (err instanceof ApiError) {
        setState(prev => ({ ...prev, error: err.message, isLoading: false }))
      } else {
        setState(prev => ({ ...prev, error: 'Ошибка при генерировании кода', isLoading: false }))
      }
    }
  }

  // Отвязать Telegram для конкретного бота
  const handleUnlink = async (botKind: BotKind) => {
    const setState = botKind === 'pro' ? setProBot : setOrdersBot

    if (!confirm('Вы уверены? Уведомления в Telegram будут отключены.')) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      await fetchApi(`/api/v1/admin/telegram/link/${botKind}`, { method: 'DELETE' })
      setState(prev => ({
        ...prev,
        isLinked: false,
        linkedAt: null,
        showCode: false,
        isLoading: false,
      }))
    } catch (err) {
      if (err instanceof ApiError) {
        setState(prev => ({ ...prev, error: err.message, isLoading: false }))
      } else {
        setState(prev => ({ ...prev, error: 'Ошибка при отвязке', isLoading: false }))
      }
    }
  }

  useEffect(() => {
    loadLinkStatus()
  }, [])

  const renderBotCard = (title: string, description: string, botKind: BotKind, state: BotState) => (
    <div className="bg-card rounded-block border border-border p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      {state.error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-block p-3 mb-4 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.isLinked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm text-muted-foreground">
              Бот подключён {state.linkedAt ? new Date(state.linkedAt).toLocaleDateString('ru-RU') : ''}
            </span>
          </div>
          <button
            onClick={() => handleUnlink(botKind)}
            disabled={state.isLoading}
            className="text-sm px-4 py-2 rounded-pill border border-border hover:bg-muted transition-colors disabled:opacity-50"
            aria-label={`Отключить бот ${botKind}`}
          >
            Отключить
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{description}</p>

          {state.showCode && state.linkCode ? (
            <div className="bg-muted rounded-block p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Код привязки (действителен 10 минут):</p>
                <div className="bg-card rounded-block p-3 font-mono text-center text-lg font-semibold tracking-widest">
                  {state.linkCode}
                </div>
              </div>

              {state.deepLink && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Или перейдите по ссылке:</p>
                  <a
                    href={state.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-pill text-sm font-medium transition-colors"
                    aria-label={`Открыть бот ${botKind}`}
                  >
                    Открыть в Telegram
                  </a>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Затем отправьте боту команду: <code>/start {state.linkCode}</code>
              </p>
            </div>
          ) : (
            <button
              onClick={() => handleGenerateCode(botKind)}
              disabled={state.isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-pill font-medium transition-colors disabled:opacity-50"
              aria-label={`Подключить бот ${botKind}`}
            >
              {state.isLoading ? 'Генерирую код...' : 'Подключить'}
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div>
      {renderBotCard(
        'Бот заявок специалистов',
        'Подключите Telegram для получения уведомлений о новых заявках и консультациях',
        'pro',
        proBot
      )}

      {renderBotCard(
        'Бот заказов',
        'Подключите Telegram для получения уведомлений о новых заказах',
        'orders',
        ordersBot
      )}
    </div>
  )
}
