import Link from "next/link";
import { q } from "@/server/db";
import { tiltState } from "@/server/tilt";
import { usd, dt } from "@/lib/fmt";
import { saveChecklist } from "./actions";

export const dynamic = "force-dynamic";
const ORG = `(SELECT id FROM organizations WHERE slug = 'german')`;

export default async function Checklist({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run } = await searchParams;
  const [st, items, runs, stats] = await Promise.all([
    tiltState(),
    q<{ code: string; text: string }>(`SELECT code, text FROM rules WHERE organization_id = ${ORG} AND kind = 'checklist' AND active AND deleted_at IS NULL ORDER BY sort_order`),
    q<{ id: string; created_at: Date; base_asset: string | null; side: string | null; verdict: string; all_ok: boolean; trade_id: string | null; net: string | null;
      answers: Record<string, boolean>; tilt_state: { reasons?: string[] } | null }>(`
      SELECT c.id, c.created_at, c.base_asset, c.side, c.verdict, c.all_ok, c.trade_id, t.net_pnl AS net, c.answers, c.tilt_state
      FROM checklist_runs c LEFT JOIN trades t ON t.id = c.trade_id
      WHERE c.organization_id = ${ORG} AND coalesce(c.note, '') <> '[test]' ORDER BY c.created_at DESC LIMIT 15`),
    q<{ grp: string; n: number; net: string; wr: string | null }>(`
      SELECT CASE WHEN EXISTS (SELECT 1 FROM checklist_runs c WHERE c.trade_id = t.id AND c.all_ok) THEN 'с чек-листом' ELSE 'без чек-листа' END AS grp,
             count(*)::int AS n, sum(net_pnl) AS net, avg((net_pnl > 0)::int) AS wr
      FROM trades t WHERE t.deleted_at IS NULL AND t.status = 'CLOSED'
        AND t.opened_at >= coalesce((SELECT min(created_at) FROM checklist_runs), now()) GROUP BY 1`),
  ]);
  const cur = run ? (await q<(typeof runs)[number]>(
    `SELECT c.id, c.verdict, c.answers, c.tilt_state FROM checklist_runs c WHERE c.id = $1::uuid`, [run]))[0] : undefined;
  const inp = "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm";
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">✅ Чек-лист перед входом</h1>

      {cur && (
        <div className={`rounded-xl border p-4 text-lg font-medium ${cur.verdict === "go" ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : "border-rose-700 bg-rose-950/40 text-rose-200"}`}>
          {cur.verdict === "go" ? "Можно входить. Стоп — сразу вместе с ордером." : cur.verdict === "skip" ? "Записал: вход без чек-листа." : "Пауза. Вход сейчас — против твоих правил."}
          {cur.verdict === "pause" && (
            <div className="mt-1 text-sm font-normal">
              {items.filter((i) => !cur.answers[i.code]).map((i) => <div key={i.code}>• не выполнено: {i.text}</div>)}
              {(cur.tilt_state?.reasons ?? []).map((r) => <div key={r}>• {r}</div>)}
            </div>
          )}
        </div>
      )}

      <div className={`rounded-xl border p-4 text-sm ${st.verdict === "go" ? "border-zinc-800 bg-zinc-900/50" : "border-amber-700 bg-amber-950/30"}`}>
        <div className="mb-1 font-medium">{st.verdict === "go" ? "🟢 Тильт-фон спокойный" : "🧯 Тильт-фон: стоп-сигналы"}</div>
        <div className="text-zinc-400">Сегодня: {st.tradesToday} сд., {usd(st.netToday)} · убытков подряд: {st.lossStreak} ·
          с последнего убытка: {st.minSinceLoss == null ? "—" : st.minSinceLoss < 120 ? `${Math.round(st.minSinceLoss)} мин` : `${(st.minSinceLoss / 60).toFixed(1)} ч`}</div>
        {st.reasons.map((r) => <div key={r} className="text-amber-300">• {r}</div>)}
      </div>

      <form action={saveChecklist} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap gap-2">
          <input name="base" placeholder="монета (BTC)" className={inp} />
          <select name="side" className={inp}><option value="">сторона</option><option value="LONG">лонг</option><option value="SHORT">шорт</option></select>
        </div>
        {items.map((i) => (
          <label key={i.code} className="flex items-start gap-2 text-sm"><input type="checkbox" name="ck" value={i.code} className="mt-1 accent-emerald-500" />{i.text}</label>
        ))}
        <input name="note" placeholder="сетап одной фразой (необязательно)" className={`${inp} w-full`} />
        <div className="flex gap-2">
          <button className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900">Проверить вход</button>
          <button name="skip" value="1" className="rounded-md border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400">Вхожу без чек-листа</button>
        </div>
      </form>

      {stats.length > 0 && (
        <div className="rounded-xl border border-zinc-800 p-4 text-sm">
          <div className="mb-1 font-medium">С чек-листом vs без (с первого прохождения)</div>
          {stats.map((s) => <div key={s.grp}>{s.grp}: {s.n} сд., {usd(Number(s.net))}, WR {s.wr == null ? "—" : `${Math.round(Number(s.wr) * 100)}%`}</div>)}
        </div>
      )}

      {runs.length > 0 && (
        <div className="space-y-1 text-sm">
          <div className="text-zinc-500">Последние прохождения (сделка привязывается сама при синхронизации MEXC)</div>
          {runs.map((r) => (
            <div key={r.id} className="flex gap-3 text-zinc-300">
              <span className="text-zinc-500">{dt(r.created_at)}</span>
              <span>{r.base_asset ?? "—"} {r.side === "SHORT" ? "шорт" : r.side === "LONG" ? "лонг" : ""}</span>
              <span className={r.verdict === "go" ? "text-emerald-400" : r.verdict === "skip" ? "text-zinc-500" : "text-rose-400"}>{r.verdict === "go" ? "можно" : r.verdict === "skip" ? "без чек-листа" : "пауза"}</span>
              {r.trade_id && <Link href={`/trades/${r.trade_id}`} className="text-sky-400">сделка {r.net != null && usd(Number(r.net))}</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
