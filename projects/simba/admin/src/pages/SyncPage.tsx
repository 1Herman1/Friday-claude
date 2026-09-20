import { useEffect, useState, useRef } from 'react'
import { syncApi, type SyncRun, type SyncStatusResponse } from '../lib/api'
import { formatPrice } from '../lib/format'
import SyncStatusBadge from '../components/SyncStatusBadge'

function formatTimeAgo(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diff = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diff < 60) return 'только что'
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins} минут${mins % 10 === 1 && mins % 100 !== 11 ? '' : 'ы'} назад`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return `${hours} час${hours % 10 === 1 && hours % 100 !== 11 ? '' : 'ов'} назад`
  }
  const days = Math.floor(diff / 86400)
  return `${days} дн${days % 10 === 1 && days % 100 !== 11 ? 'ь' : 'ей'} назад`
}

function TriggerLabel({ trigger }: { trigger: string }) {
  const labels: Record<string, string> = {
    cron: 'по расписанию',
    admin: 'из админки',
    manual: 'вручную',
  }
  return <>{labels[trigger] || trigger}</>
}

interface ExpandableListProps {
  title: string
  items: Array<{ [key: string]: any }>
  count: number
  renderItem: (item: any) => React.ReactNode
}

function ExpandableList({ title, items, count, renderItem }: ExpandableListProps) {
  const [expanded, setExpanded] = useState(false)

  if (count === 0) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <p className="font-medium text-gray-900">
          {title} ({count})
        </p>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 text-sm">
          {items.map((item, i) => (
            <div key={i} className="text-gray-700">
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SyncPage() {
  const [data, setData] = useState<SyncStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const loadStatus = async () => {
    try {
      const res = await syncApi.status()
      setData(res.data)
      setError(null)

      if (res.data.last?.status === 'running') {
        setRunning(true)
      } else {
        setRunning(false)
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка загрузки статуса')
    } finally {
      if (!loading) setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    if (!running) return

    const pollRun = async () => {
      if (!data?.last) return

      try {
        const res = await syncApi.get(data.last.id)
        setData(prev => prev ? { ...prev, last: res.data } : null)

        if (res.data.status !== 'running') {
          setRunning(false)
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        }
      } catch (e) {
        // Ignore errors during polling
      }
    }

    pollRun()
    pollIntervalRef.current = setInterval(pollRun, 3000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [running, data?.last?.id])

  const handleRun = async (dryRun: boolean) => {
    try {
      setError(null)
      const res = await syncApi.run(dryRun)
      setRunning(true)
      setSelectedRunId(res.data.runId)
      await loadStatus()
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setError('Синхронизация уже выполняется. Пожалуйста, подождите завершения текущего прогона.')
      } else {
        setError(e?.response?.data?.error || 'Ошибка запуска синхронизации')
      }
    }
  }

  const displayRun = selectedRunId
    ? data?.history.find(r => r.id === selectedRunId) || data?.last
    : data?.last

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Синхронизация с МойСклад</h1>

      {/* Status badge */}
      <div className="mb-6">
        <SyncStatusBadge lastSuccess={data?.lastSuccess} lastFailed={data?.last} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => handleRun(true)}
          disabled={running}
          className="py-3 px-4 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm"
        >
          {running ? 'Выполняется…' : 'Проверить (без изменений)'}
        </button>
        <button
          onClick={() => handleRun(false)}
          disabled={running}
          className="py-3 px-4 bg-blue-200 text-navy-900 font-semibold rounded-lg hover:bg-blue-300 disabled:opacity-50 transition-colors text-sm"
        >
          {running ? 'Выполняется…' : 'Синхронизировать'}
        </button>
      </div>

      {/* Run result */}
      {displayRun && (
        <div className="space-y-4 mb-8">
          {/* Aborted warning */}
          {displayRun.status === 'aborted' && displayRun.report?.abortReason && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="font-semibold text-orange-800 mb-1">Синхронизация остановлена</p>
              <p className="text-sm text-orange-700">{displayRun.report.abortReason}</p>
              <p className="text-xs text-orange-600 mt-2">Изменения не применены.</p>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500 mb-1">Получено из МойСклада</p>
              <p className="text-xl font-bold text-gray-900">{displayRun.itemsFromMs}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500 mb-1">Сопоставлено</p>
              <p className="text-xl font-bold text-gray-900">{displayRun.matched}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500 mb-1">Обновлено цен</p>
              <p className="text-xl font-bold text-gray-900">{displayRun.priceUpdated}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500 mb-1">Обновлено остатков</p>
              <p className="text-xl font-bold text-gray-900">{displayRun.stockUpdated}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500 mb-1">Активировано товаров</p>
              <p className="text-xl font-bold text-gray-900">{displayRun.productsActivated}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500 mb-1">Пропущено</p>
              <p className="text-xl font-bold text-gray-900">{displayRun.skipped}</p>
            </div>
          </div>

          {/* Examples */}
          {displayRun.report && (
            <div className="space-y-3">
              <ExpandableList
                title="Пропущены по нулевой цене"
                count={displayRun.report.skippedZeroPriceCount}
                items={displayRun.report.examples.zeroCost}
                renderItem={(item) => (
                  <>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.variantId}</p>
                  </>
                )}
              />

              <ExpandableList
                title="Пропущены по падению цены"
                count={displayRun.report.skippedPriceDropCount}
                items={displayRun.report.examples.skippedPriceDrop}
                renderItem={(item) => (
                  <>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {(item.oldPrice / 100).toLocaleString('ru-RU')} ₽ → {(item.newPrice / 100).toLocaleString('ru-RU')} ₽
                    </p>
                  </>
                )}
              />

              <ExpandableList
                title="Не найдены в МойСкладе"
                count={displayRun.report.notFoundInMs}
                items={displayRun.report.examples.notFoundInMs}
                renderItem={(item) => (
                  <>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.variantId}</p>
                  </>
                )}
              />

              <ExpandableList
                title="Только в МойСкладе"
                count={displayRun.report.examples.onlyInMs.length}
                items={displayRun.report.examples.onlyInMs}
                renderItem={(item) => (
                  <>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.variantId}</p>
                  </>
                )}
              />

              <ExpandableList
                title="Неоднозначные артикулы"
                count={displayRun.report.examples.ambiguous.length}
                items={displayRun.report.examples.ambiguous}
                renderItem={(item) => (
                  <>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.matches.length} совпадений: {item.matches.join(', ')}
                    </p>
                  </>
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* History table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">История</h2>
        </div>

        {data?.history && data.history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Дата и время</th>
                  <th className="px-5 py-3 font-medium">Запущен</th>
                  <th className="px-5 py-3 font-medium">Режим</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium">Цен</th>
                  <th className="px-5 py-3 font-medium">Остатков</th>
                  <th className="px-5 py-3 font-medium">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span className="text-xs">
                        {new Date(run.startedAt).toLocaleString('ru-RU', {
                          year: '2-digit',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <TriggerLabel trigger={run.trigger} />
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs">{run.dryRun ? 'проверка' : 'синхр.'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          run.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : run.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : run.status === 'aborted'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {run.status === 'success'
                          ? 'Успех'
                          : run.status === 'failed'
                            ? 'Ошибка'
                            : run.status === 'aborted'
                              ? 'Остановлена'
                              : 'Выполняется'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-900 font-medium">{run.priceUpdated}</td>
                    <td className="px-5 py-3 text-gray-900 font-medium">{run.stockUpdated}</td>
                    <td className="px-5 py-3">
                      {run.error ? (
                        <span className="text-xs text-red-600 truncate max-w-xs" title={run.error}>
                          {run.error}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            История пока пуста
          </div>
        )}
      </div>
    </div>
  )
}
