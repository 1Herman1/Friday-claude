import { usd, pnlClass } from "@/lib/fmt";

export default function Bars({ title, rows, label }: { title: string; rows: { k: string; n: number; net: string; wins: number; liq: number }[]; label?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(Number(r.net))));
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-300">{title}</h3>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const v = Number(r.net);
          return (
            <div key={r.k} className="grid grid-cols-[72px_1fr_88px_64px] items-center gap-2 text-xs">
              <span className="truncate text-zinc-400">{label ? label(r.k) : r.k}</span>
              <div className="relative h-3">
                <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-700" />
                <div className={`absolute inset-y-0 rounded-sm ${v >= 0 ? "left-1/2 bg-emerald-500/70" : "right-1/2 bg-rose-500/70"}`} style={{ width: `${(Math.abs(v) / max) * 50}%` }} />
              </div>
              <span className={`text-right tabular-nums ${pnlClass(v)}`}>{usd(v, 0)}</span>
              <span className="text-right tabular-nums text-zinc-500" title="сделок / ликвидаций">{r.n}{r.liq ? ` · ${r.liq}💀` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
