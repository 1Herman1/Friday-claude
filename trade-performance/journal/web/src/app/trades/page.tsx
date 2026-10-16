import { trades, symbols, type Filters } from "@/server/stats";
import { usd, px, dt, pnlClass } from "@/lib/fmt";
import FilterBar from "@/components/FilterBar";

export const dynamic = "force-dynamic";

export default async function Trades({ searchParams }: { searchParams: Promise<Filters> }) {
  const f = await searchParams;
  const [list, syms] = await Promise.all([trades(f), symbols()]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">Сделки <span className="text-zinc-500">({list.length})</span></h1>
        <FilterBar f={f} symbols={syms.map((x) => x.s)} action="/trades" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-xs text-zinc-400">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
              <th>№</th><th>Открытие</th><th>Закрытие</th><th>Монета</th><th>Сторона</th><th>Вход</th><th>Выход</th>
              <th>Объём</th><th>Net PnL</th><th>Комиссия</th><th>Длит., ч</th><th>Филлов</th><th>Итог</th><th></th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {list.map((t) => (
              <tr key={t.id} className={`border-t border-zinc-800/70 [&>td]:px-3 [&>td]:py-1.5 ${t.liq ? "bg-rose-950/30" : ""}`}>
                <td className="text-zinc-500">{t.n}</td>
                <td>{dt(t.opened_at)}</td>
                <td className="text-zinc-400">{dt(t.closed_at)}</td>
                <td className="font-medium">{t.symbol}</td>
                <td className={t.side === "LONG" ? "text-emerald-400" : "text-rose-400"}>{t.side === "LONG" ? "Лонг" : "Шорт"}</td>
                <td>{px(t.entry_avg)}</td>
                <td>{px(t.exit_avg)}</td>
                <td>{usd(t.notional, 0).replace("+", "")}</td>
                <td className={`font-medium ${pnlClass(t.net_pnl)}`}>{usd(t.net_pnl)}</td>
                <td className="text-zinc-500">{usd(-Number(t.fees))}</td>
                <td>{t.dur_h}</td>
                <td className="text-zinc-500">{t.fills}</td>
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
