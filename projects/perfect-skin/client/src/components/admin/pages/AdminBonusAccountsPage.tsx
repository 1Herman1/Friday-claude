import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { adminListBonusAccounts, type AdminBonusAccountList } from '@/lib/admin-api'
import { bonusWord, formatBonusDate } from '@/lib/bonus-labels'

const PAGE_SIZE = 20
const INPUT = 'w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11'

export function AdminBonusAccountsPage() {
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<AdminBonusAccountList | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    adminListBonusAccounts(search, PAGE_SIZE, offset)
      .then((result) => {
        if (!ignore) {
          setData(result)
          setError(null)
        }
      })
      .catch(() => {
        if (!ignore) setError('Не удалось загрузить участников')
      })
    return () => {
      ignore = true
    }
  }, [search, offset])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (value.length > 0 && value.length < 3) {
      setError('Для поиска введите не меньше 3 символов')
      return
    }
    setError(null)
    setOffset(0)
    setSearch(value)
  }

  const total = data?.total ?? 0

  return (
    <div className="container-app py-12 md:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-h2 font-heading font-bold text-foreground uppercase">Бонусы: участники</h1>
        <Link to="/admin/bonus/settings" className="text-sm font-semibold text-primary underline underline-offset-2 min-h-11 inline-flex items-center">
          Настройки программы
        </Link>
      </div>

      <form onSubmit={submit} role="search" className="flex flex-wrap gap-3 mb-6 max-w-xl">
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="bonus-search" className="block text-sm font-sans text-muted-foreground mb-2">Email или телефон</label>
          <input id="bonus-search" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="от 3 символов" className={INPUT} />
        </div>
        <button type="submit" className="self-end px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill min-h-11">
          Найти
        </button>
      </form>

      {error && <p role="alert" className="text-sm text-destructive mb-4">{error}</p>}

      {!data ? (
        <p className="text-muted-foreground">Загрузка…</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Участников не найдено</p>
      ) : (
        <div className="relative overflow-x-auto border border-border rounded-block bg-card">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th scope="col" className="px-4 py-3 text-left text-muted-foreground font-semibold">Участник</th>
                <th scope="col" className="px-4 py-3 text-right text-muted-foreground font-semibold">Баланс</th>
                <th scope="col" className="px-4 py-3 text-left text-muted-foreground font-semibold">Статус</th>
                <th scope="col" className="hidden md:table-cell px-4 py-3 text-left text-muted-foreground font-semibold">Вступил</th>
                <th scope="col" className="hidden md:table-cell px-4 py-3"><span className="sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.userId} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <Link to={`/admin/bonus/${row.userId}`} className="font-semibold text-foreground underline-offset-2 hover:underline">{row.name || 'Без имени'}</Link>
                    <p className="text-muted-foreground break-all">{row.email ?? row.phone ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-foreground">
                    {row.balance} {bonusWord(row.balance)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground">{row.member ? 'В клубе' : 'Вышел'}</td>
                  <td className="hidden md:table-cell px-4 py-3 tabular-nums text-muted-foreground">{formatBonusDate(row.joinedAt)}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-right">
                    <Link to={`/admin/bonus/${row.userId}`} className="inline-flex items-center min-h-11 text-primary font-semibold underline underline-offset-2">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-6 flex items-center gap-4">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="px-5 py-2 border border-border-strong rounded-pill disabled:opacity-50 min-h-11">
            Назад
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} из {total}
          </span>
          <button type="button" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)} className="px-5 py-2 border border-border-strong rounded-pill disabled:opacity-50 min-h-11">
            Дальше
          </button>
        </div>
      )}
    </div>
  )
}
