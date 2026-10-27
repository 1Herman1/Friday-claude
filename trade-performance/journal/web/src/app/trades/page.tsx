import Link from "next/link";
import { trades, symbols, allTags, summary, SEGMENTS, SEG_LABEL, RANDOM_TAG, type Filters } from "@/server/stats";
import { usd, px, dt, pnlClass } from "@/lib/fmt";
import FilterBar from "@/components/FilterBar";

export const dynamic = "force-dynamic";

export default async function Trades({ searchParams }: { searchParams: Promise<Filters> }) {
  const f = await searchParams;
  const [list, syms, tags, s] = await Promise.all([trades(f), symbols(), allTags(), summary(f)]);
  const segOf = (tg: string[] | null) => Object.keys(SEGMENTS).find((k) => tg?.includes(SEGMENTS[k]));
  const qs = (k: string, v: string) => "?" + new URLSearchParams({ ...(f as Record<string, string>), [k]: v }).toString();
  const wr = Number(s.n) ? Math.round((Number(s.wins) / Number(s.n)) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">Сделки <span className="text-zinc-500">({list.length})</span></h1>
        <Link href="/trades/new" className="rounded-md border border-zinc-700 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800">+ сделка вручную</Link>
        <FilterBar f={f} symbols={syms.map((x) => x.s)} action="/trades" tags={tags} sort />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
        <span>Net: <b className={pnlClass(s.net)}>{usd(s.net)}</b></span><span>WR: <b className="text-zinc-200">{wr}%</b></span>
        <span>PF: <b className="text-zinc-200">{Number(s.sum_loss) ? (Number(s.sum_win) / -Number(s.sum_loss)).toFixed(2) : "—"}</b></span>
        <span>Ликвидаций: <b className="text-zinc-200">{s.liq_n}</b> ({usd(s.liq_sum, 0)})</span>
        <span className="text-zinc-500">Клик по заголовку «Net PnL» / «Открытие» / «Длит.» — сортировка</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-xs text-zinc-400">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
              <th>№</th><th><Link href={qs("sort", f.sort === "date_asc" ? "date_desc" : "date_asc")}>Открытие ⇅</Link></th><th>Закрытие</th><th>Монета</th><th>Сторона</th><th>Вход</th><th>Выход</th>
              <th><Link href={qs("sort", f.sort === "size_desc" ? "size_asc" : "size_desc")}>Объём ⇅</Link></th><th><Link href={qs("sort", f.sort === "pnl_desc" ? "pnl_asc" : "pnl_desc")}>Net PnL ⇅</Link></th><th>Комиссия</th><th><Link href={qs("sort", f.sort === "dur_desc" ? "dur_asc" : "dur_desc")}>Длит., ч ⇅</Link></th><th>Филлов</th><th>Сегмент</th><th>Итог</th><th></th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {list.map((t) => (
              <tr key={t.id} className={`border-t border-zinc-800/70 [&>td]:px-3 [&>td]:py-1.5 ${t.liq ? "bg-rose-950/30" : ""}`}>
                <td className="text-zinc-500"><Link href={`/trades/${t.id}`}>{t.n}</Link></td>
                <td>{dt(t.opened_at)}</td>
                <td className="text-zinc-400">{dt(t.closed_at)}</td>
                <td className="font-medium"><Link href={`/trades/${t.id}`} className="underline decoration-zinc-600 underline-offset-2 hover:text-white">{t.symbol}</Link></td>
                <td className={t.side === "LONG" ? "text-emerald-400" : "text-rose-400"}>{t.side === "LONG" ? "Лонг" : "Шорт"}</td>
                <td>{px(t.entry_avg)}</td>
                <td>{px(t.exit_avg)}</td>
                <td>{usd(t.notional, 0).replace("+", "")}</td>
                <td className={`font-medium ${pnlClass(t.net_pnl)}`}>{usd(t.net_pnl)}</td>
                <td className="text-zinc-500">{usd(-Number(t.fees))}</td>
                <td>{t.dur_h}</td>
                <td className="text-zinc-500">{t.fills}</td>
                <td className="whitespace-nowrap text-xs">
                  {(() => { const sg = segOf(t.tags); return sg ? <Link href={qs("seg", sg)} className={sg === "OK" ? "text-emerald-400" : "text-amber-400"}>{SEG_LABEL[sg]}</Link> : null; })()}
                  {t.tags?.includes(RANDOM_TAG) && <Link href={qs("rnd", "only")} className="ml-1 rounded bg-zinc-800 px-1 text-zinc-300">🎲 случайная</Link>}
                  {t.reviewed && <span className="ml-1" title="есть ИИ-разбор">🧠</span>}
                </td>
                <td className={pnlClass(t.cum)}>{usd(t.cum, 0)}</td>
                <td title="закрыта ликвидацией">{t.liq ? "💀" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
