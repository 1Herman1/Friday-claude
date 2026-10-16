import { summary, groupBy, trades, symbols, type Filters } from "@/server/stats";
import { usd, num, pnlClass, dt } from "@/lib/fmt";
import EquityChart from "@/components/EquityChart";
import Bars from "@/components/Bars";
import FilterBar from "@/components/FilterBar";

export const dynamic = "force-dynamic";
const WD = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Filters> }) {
  const f = await searchParams;
  const [s, bySym, byMonth, byHour, byWd, list, syms] = await Promise.all([
    summary(f), groupBy(f, "symbol"), groupBy(f, "month"), groupBy(f, "hour"), groupBy(f, "weekday"), trades(f), symbols(),
  ]);
  const n = Number(s.n);
  const wr = n ? (Number(s.wins) / n) * 100 : 0;
  const pf = Number(s.sum_loss) ? Number(s.sum_win) / -Number(s.sum_loss) : 0;
  const nl = Number(s.noliq_n);
  const nlwr = nl ? (Number(s.noliq_wins) / nl) * 100 : 0;
  const points = list.map((t) => ({ t: Math.floor(new Date(t.closed_at).getTime() / 1000), v: Number(t.cum) }))
    .sort((a, b) => a.t - b.t);
  // просадка от пика кривой капитала (старт = 0)
  let peak = 0, maxDd = 0;
  for (const p of points) { peak = Math.max(peak, p.v); maxDd = Math.min(maxDd, p.v - peak); }
  const symRows = bySym.length > 14 ? [...bySym.slice(0, 7), ...bySym.slice(-7)] : bySym;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Дашборд</h1>
          <p className="text-sm text-zinc-400">{dt(s.first)} — {dt(s.last)} · {n} закрытых сделок</p>
        </div>
        <FilterBar f={f} symbols={syms.map((x) => x.s)} action="/" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Card label="Net PnL" value={usd(s.net)} tone={pnlClass(s.net)} sub={`gross ${usd(s.gross)} · комиссии ${usd(-Number(s.fees))}`} />
        <Card label="Win rate" value={`${num(wr, 1)}%`} sub={`${s.wins} из ${n}`} />
        <Card label="Profit factor" value={num(pf, 2)} tone={pf >= 1 ? "text-emerald-400" : "text-rose-400"} />
        <Card label="Средняя прибыль / убыток" value={`${usd(s.avg_win, 0)} / ${usd(s.avg_loss, 0)}`} />
        <Card label="Макс. просадка" value={usd(maxDd, 0)} tone="text-rose-400" sub={`пик ${usd(peak, 0)}`} />
        <Card label="Ликвидации 💀" value={`${s.liq_n} · ${usd(s.liq_sum, 0)}`} tone="text-rose-400"
          sub={`без них: ${usd(s.noliq_sum, 0)}, WR ${num(nlwr, 0)}%`} />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-300">Кривая капитала (net, по закрытию)</h3>
        <EquityChart points={points} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Bars title="По монетам (худшие и лучшие)" rows={symRows} />
        <Bars title="По месяцам" rows={byMonth} />
        <Bars title="По времени входа (МСК, окна 3 ч)" rows={byHour} />
        <Bars title="По дням недели" rows={byWd} label={(k) => WD[Number(k)]} />
      </div>
    </div>
  );
}
