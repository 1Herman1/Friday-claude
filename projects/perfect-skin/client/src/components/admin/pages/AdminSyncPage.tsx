import { useEffect, useState } from 'react'
import { getSyncLog } from '@/lib/admin-api'

interface SyncLogItem {
  id: string
  direction: 'import' | 'export' | 'auth'
  status: 'success' | 'failed' | 'pending'
  itemsCount: number
  errorText?: string | null
  createdAt: string
}

export function AdminSyncPage() {
  const [logs, setLogs] = useState<SyncLogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const exchangeUrl = `${baseUrl}/exchange/1c`

  const formatDateTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
    } catch {
      return dateStr
    }
  }

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setIsLoading(true)
        const data = await getSyncLog()
        setLogs(data.items || [])
        setError(null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка загрузки журнала'
        setError(msg)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogs()
  }, [])

  const directionLabel: Record<string, string> = {
    import: 'Импорт товаров',
    export: 'Экспорт заказов',
    auth: 'Проверка доступа',
  }

  const statusLabel: Record<string, string> = {
    success: 'Успешно',
    failed: 'Ошибка',
    pending: 'В процессе',
  }

  const statusColor: Record<string, string> = {
    success: 'text-green-600 bg-green-50',
    failed: 'text-red-600 bg-red-50',
    pending: 'text-yellow-600 bg-yellow-50',
  }

  return (
    <div className="container-app py-8">
      <h1 className="text-3xl font-heading font-bold mb-8">Обмен 1С</h1>

      {/* Instructions section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-blue-900">Подключение 1С</h2>
        <p className="text-sm text-blue-800 mb-4">
          Следуйте этим шагам для подключения обмена с 1С в конфигурации «Обмен с сайтом»:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>
            В 1С откройте раздел <strong>«Сервис → Параметры сеанса → Веб-сервис обмена»</strong>
          </li>
          <li>
            Установите <strong>URL обмена</strong>: <code className="bg-white px-2 py-1 rounded font-mono text-xs">{exchangeUrl}</code>
          </li>
          <li>
            Укажите <strong>Логин</strong> и <strong>Пароль</strong> (см. переменные окружения сервера: <code className="bg-white px-2 py-1 rounded font-mono text-xs">PS_1C_LOGIN</code>, <code className="bg-white px-2 py-1 rounded font-mono text-xs">PS_1C_PASSWORD</code>)
          </li>
          <li>
            Настройте <strong>расписание синхронизации</strong> товаров и заказов
          </li>
        </ol>
      </div>

      {/* Sync log section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">История обменов</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка…</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Нет записей об обменах</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border px-4 py-2 text-left font-semibold">Дата и время</th>
                  <th className="border border-border px-4 py-2 text-left font-semibold">Направление</th>
                  <th className="border border-border px-4 py-2 text-left font-semibold">Статус</th>
                  <th className="border border-border px-4 py-2 text-center font-semibold">Записей</th>
                  <th className="border border-border px-4 py-2 text-left font-semibold">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50">
                    <td className="border border-border px-4 py-2 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="border border-border px-4 py-2">
                      {directionLabel[log.direction] || log.direction}
                    </td>
                    <td className="border border-border px-4 py-2">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColor[log.status]}`}>
                        {statusLabel[log.status] || log.status}
                      </span>
                    </td>
                    <td className="border border-border px-4 py-2 text-center font-mono">
                      {log.itemsCount}
                    </td>
                    <td className="border border-border px-4 py-2 text-muted-foreground text-xs max-w-xs truncate" title={log.errorText || ''}>
                      {log.errorText || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
