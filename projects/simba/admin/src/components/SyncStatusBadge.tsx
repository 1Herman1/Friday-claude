import { Link } from 'react-router-dom'
import type { SyncRun } from '../lib/api'

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

interface SyncStatusBadgeProps {
  lastSuccess?: SyncRun
  lastFailed?: SyncRun
  compact?: boolean
}

export default function SyncStatusBadge({
  lastSuccess,
  lastFailed,
  compact = false,
}: SyncStatusBadgeProps) {
  const now = new Date()

  if (!lastSuccess) {
    const content = (
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-gray-600">Синхронизация ещё ни разу не выполнялась</span>
      </div>
    )

    if (compact) {
      return (
        <Link to="/sync" className="inline-flex hover:underline">
          {content}
        </Link>
      )
    }

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        {content}
      </div>
    )
  }

  const finishedTime = new Date(lastSuccess.finishedAt || lastSuccess.startedAt)
  const hoursAgo = (now.getTime() - finishedTime.getTime()) / (1000 * 60 * 60)
  const isOutdated = hoursAgo >= 3

  const content = (
    <div className={`flex items-center gap-2 text-sm ${
      isOutdated ? 'text-red-700' : 'text-gray-600'
    }`}>
      <div className={`w-2 h-2 rounded-full ${isOutdated ? 'bg-red-500' : 'bg-green-500'}`} />
      {isOutdated ? (
        <span>
          Цены не обновлялись {formatTimeAgo(lastSuccess.finishedAt || lastSuccess.startedAt)}
          {lastFailed && lastFailed.status === 'failed' && (
            <span className="block text-xs text-red-600 mt-1">{lastFailed.error || 'Ошибка синхронизации'}</span>
          )}
        </span>
      ) : (
        <span>
          Цены обновлены {formatTimeAgo(lastSuccess.finishedAt || lastSuccess.startedAt)}
        </span>
      )}
    </div>
  )

  if (compact) {
    return (
      <Link
        to="/sync"
        className={`inline-flex hover:underline ${isOutdated ? 'text-red-600 hover:text-red-700' : 'text-gray-600 hover:text-gray-900'}`}
      >
        {content}
      </Link>
    )
  }

  return (
    <div className={`border rounded-lg p-4 ${
      isOutdated
        ? 'bg-red-50 border-red-200'
        : 'bg-green-50 border-green-200'
    }`}>
      {content}
    </div>
  )
}
