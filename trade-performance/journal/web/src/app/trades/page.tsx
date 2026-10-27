import Link from "next/link";
import { trades, symbols, allTags, summary, SEGMENTS, SEG_LABEL, RANDOM_TAG, type Filters } from "@/server/stats";
import { usd, px, dt, pnlClass } from "@/lib/fmt";
import FilterBar from "@/components/FilterBar";
import RowLink from "@/components/RowLink";

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Net PnL", <span key="n" className={pnlClass(s.net)}>{usd(s.net)}</span>],
          ["Win rate", `${wr}%`],
          ["Profit factor", Number(s.sum_loss) ? (Number(s.sum_win) / -Number(s.sum_loss)).toFixed(2) : "—"],
          ["Ликвидации", <span key="l">{s.liq_n} <span className="text-base text-rose-400">{usd(s.liq_sum, 0)}</span></span>],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">{k}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-zinc-500">Клик по строке — карточка сделки. Заголовки с ⇅ — сортировка, метки — быстрый фильтр. 📓 — есть запись из рукописного дневника.</div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-800/80">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900/95 text-[11px] uppercase tracking-wider text-zinc-500 backdrop-blur">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
              <th>№</th><th><Link href={qs("sort", f.sort === "date_asc" ? "date_desc" : "date_asc")}>Открытие ⇅</Link></th><th>Закрытие</th><th>Монета</th><th>Сторона</th><th>Вход</th><th>Выход</th>
              <th><Link href={qs("sort", f.sort === "size_desc" ? "size_asc" : "size_desc")}>Объём ⇅</Link></th><th><Link href={qs("sort", f.sort === "pnl_desc" ? "pnl_asc" : "pnl_desc")}>Net PnL ⇅</Link></th><th>Комиссия</th><th><Link href={qs("sort", f.sort === "dur_desc" ? "dur_asc" : "dur_desc")}>Длит., ч ⇅</Link></th><th>Филлов</th><th>Сегмент</th><th>Итог</th><th></th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {list.map((t) => (
              <RowLink key={t.id} href={`/trades/${t.id}`} className={`group cursor-pointer border-t border-zinc-800/60 outline-none transition-colors hover:bg-zinc-800/50 focus:bg-zinc-800/50 [&>td]:px-3 [&>td]:py-2 ${t.liq ? "bg-rose-950/25" : ""}`}>
                <td className="border-l-2 border-transparent text-zinc-500 group-hover:border-sky-400">{t.n}</td>
                <td className="whitespace-nowrap">{dt(t.opened_at)}</td>
                <td className="whitespace-nowrap text-zinc-400">{dt(t.closed_at)}</td>
                <td className="whitespace-nowrap font-medium text-zinc-100">{t.symbol.replace(/USDT$/, "")}{t.diary && <span className="ml-1.5" title={`дневник №${t.diary}`}>📓</span>}</td>
                <td><span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${t.side === "LONG" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{t.side === "LONG" ? "LONG" : "SHORT"}</span></td>
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
              </RowLink>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
