import "server-only";
import { q } from "./db";

const ORG = `(SELECT id FROM organizations WHERE slug = 'german')`;

export type TiltState = {
  tradesToday: number; netToday: number; lossStreak: number; minSinceLoss: number | null;
  reasons: string[]; verdict: "go" | "pause";
};

export const RULE_SHORT: Record<string, string> = {
  stop_set: "нет стопа", stop_not_liq: "ликвидация", no_reentry_5m: "перезаход", no_size_up_after_loss: "объём↑",
  no_averaging: "усреднение", max_trades_day: ">5 сд./день", setup_only: "вне сетапа", risk_limit: "риск>2%",
};

/** Сколько стоило каждое нарушенное правило (авто от tilt.py + ручные отметки). Формат как у groupBy. */
export async function byRule() {
  const rows = await q<{ k: string; n: number; net: string; wins: number; liq: number; sw: string; sl: string }>(`
    SELECT r.code AS k, count(*)::int AS n, sum(t.net_pnl) AS net, count(*) FILTER (WHERE t.net_pnl > 0)::int AS wins,
           count(*) FILTER (WHERE t.stop_is_liquidation)::int AS liq,
           coalesce(sum(t.net_pnl) FILTER (WHERE t.net_pnl > 0), 0) AS sw, coalesce(sum(t.net_pnl) FILTER (WHERE t.net_pnl <= 0), 0) AS sl
    FROM trade_rule_violations v JOIN rules r ON r.id = v.rule_id JOIN trades t ON t.id = v.trade_id
    WHERE t.deleted_at IS NULL AND t.status = 'CLOSED' GROUP BY r.code ORDER BY 3`);
  return rows.map((r) => ({ ...r, pf: Number(r.sl) ? Number(r.sw) / -Number(r.sl) : null }));
}

/** Состояние «прямо сейчас» (день по МСК) — те же пороги, что в journal/core/tilt.py. */
export async function tiltState(): Promise<TiltState> {
  const rows = await q<{ net: string | null; closed_at: Date | null; opened_at: Date }>(`
    SELECT t.net_pnl AS net, t.closed_at, t.opened_at FROM trades t
    WHERE t.organization_id = ${ORG} AND t.deleted_at IS NULL
      AND t.opened_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow'
    ORDER BY coalesce(t.closed_at, t.opened_at) DESC`);
  const closed = rows.filter((r) => r.closed_at);
  let lossStreak = 0;
  for (const r of closed) { if (Number(r.net) < 0) lossStreak++; else break; }
  const [last] = await q<{ m: string | null }>(`
    SELECT extract(epoch FROM now() - max(closed_at)) / 60 AS m FROM trades
    WHERE organization_id = ${ORG} AND deleted_at IS NULL AND net_pnl < 0 AND closed_at IS NOT NULL`);
  const minSinceLoss = last?.m == null ? null : Number(last.m);
  const netToday = closed.reduce((a, r) => a + Number(r.net ?? 0), 0);
  const reasons: string[] = [];
  if (minSinceLoss !== null && minSinceLoss < 30) reasons.push(`после убытка прошло ${Math.round(minSinceLoss)} мин (<30)`);
  if (lossStreak >= 3) reasons.push(`${lossStreak} убытка подряд сегодня`);
  if (rows.length >= 5) reasons.push(`уже ${rows.length} сделок сегодня (лимит 5)`);
  return { tradesToday: rows.length, netToday, lossStreak, minSinceLoss, reasons, verdict: reasons.length ? "pause" : "go" };
}
