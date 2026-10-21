import Link from "next/link";
import { sources, signalList } from "@/server/signals";
import { usd, px, dt, pnlClass } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const TITLE: Record<string, string> = { "smc-btc": "🧠 Smart Money (SMC BTC 5m)", "pump-mexc": "🚀 Памп-дамп (MEXC, шорт пампа)" };
const ST: Record<string, [string, string]> = {
  WIN: ["тейк", "text-emerald-400"], LOSS: ["стоп", "text-rose-400"], OPEN: ["в работе", "text-sky-400"],
  PENDING: ["ждёт", "text-zinc-400"], EXPIRED: ["истёк", "text-zinc-500"], CANCELLED: ["отменён", "text-zinc-500"],
};
const pct = (v: unknown) => (v == null ? "—" : `${Math.round(Number(v) * 100)}%`);

export default async function Signals({ searchParams }: { searchParams: Promise<{ src?: string; taken?: string }> }) {
  const { src, taken } = await searchParams;
  const [srcs, rows] = await Promise.all([sources(), signalList(src, taken === "1")]);
  const chip = (on: boolean) => `rounded-md border px-2 py-1 ${on ? "border-zinc-300 text-white" : "border-zinc-700 text-zinc-400"}`;
  const href = (s?: string, t?: boolean) => `/signals?${new URLSearchParams({ ...(s ? { src: s } : {}), ...(t ? { taken: "1" } : {}) })}`;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">📡 Сигналы</h1>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {srcs.map((s) => (
          <Link key={s.id} href={href(s.name)} className={`rounded-xl border p-4 text-sm ${src === s.name ? "border-zinc-400" : "border-zinc-800"} bg-zinc-900/50 hover:border-zinc-600`}>
            <div className="mb-1 font-medium">{TITLE[s.name] ?? `📣 ${s.name}`}</div>
            <div className="mb-2 text-xs text-zinc-500">{s.notes}</div>
            <div>Сигналов: <b>{s.total}</b> (живых {s.live}) · закрыто {s.closed}</div>
            <div>Винрейт: <b>{s.closed ? pct(s.wins / s.closed) : "—"}</b> · среднее R: <b className={pnlClass(s.avg_r)}>{s.avg_r == null ? "—" : Number(s.avg_r).toFixed(2)}</b></div>
            {s.med_drop != null && <div>Медианный откат за 72 ч: <b>{pct(s.med_drop)}</b> · откатили ≥50%: {s.hit50}</div>}
            <div className="mt-1 text-zinc-400">Ты взял: {s.taken} сд. {s.taken > 0 && <>· <span className={pnlClass(s.taken_net)}>{usd(s.taken_net)}</span> · WR {pct(s.taken_wins / s.taken)}</>}</div>
          </Link>
        ))}
        <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
          <div className="mb-1 font-medium text-zinc-400">📣 Чужие каналы</div>
          Появятся здесь после подключения парсера: посты читаем (не перепубликуем), Opus разбирает сигнал, исход проверяется по ценам MEXC.
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={href(undefined, taken === "1")} className={chip(!src)}>все</Link>
        {srcs.map((s) => <Link key={s.id} href={href(s.name, taken === "1")} className={chip(src === s.name)}>{s.name}</Link>)}
        <Link href={href(src, taken !== "1")} className={chip(taken === "1")}>только взятые мной</Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>{["Время (МСК)", "Источник", "Монета", "", "Рост 24ч", "Вход", "Стоп", "Тейк", "Исход", "R", "Откат / вынос", "Моя сделка"].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [st, cls] = ST[r.status] ?? [r.status, ""];
              return (
                <tr key={r.id} className="border-t border-zinc-800/70">
                  <td className="px-3 py-1.5 text-zinc-400">{dt(r.setup_time)}</td>
                  <td className="px-3 py-1.5 text-zinc-400">{r.source}{r.mode === "BACKTEST" && <span className="ml-1 text-xs text-zinc-600">ист.</span>}</td>
                  <td className="px-3 py-1.5 font-medium">{r.base}</td>
                  <td className={`px-3 py-1.5 ${r.side === "SHORT" ? "text-rose-300" : "text-emerald-300"}`}>{r.side === "SHORT" ? "шорт" : "лонг"}</td>
                  <td className="px-3 py-1.5">{r.rise == null ? "" : `+${pct(r.rise)}`}</td>
                  <td className="px-3 py-1.5">{px(r.entry)}</td>
                  <td className="px-3 py-1.5 text-zinc-400">{px(r.stop_loss)}</td>
                  <td className="px-3 py-1.5 text-zinc-400">{r.tp == null ? "—" : px(r.tp)}</td>
                  <td className={`px-3 py-1.5 ${cls}`}>{st}</td>
                  <td className={`px-3 py-1.5 ${pnlClass(r.simulated_r)}`}>{r.simulated_r == null ? "" : Number(r.simulated_r).toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-zinc-400">{r.max_drop == null ? "" : `−${pct(r.max_drop)} / +${pct(r.max_up)}`}</td>
                  <td className="px-3 py-1.5">{r.trade_id ? <Link href={`/trades/${r.trade_id}`} className={pnlClass(r.trade_net)}>#{r.trade_n} {usd(r.trade_net)}</Link> : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-4 text-sm text-zinc-500">Пока пусто.</div>}
      </div>
    </div>
  );
}
