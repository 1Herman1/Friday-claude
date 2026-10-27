import "server-only";
import { q } from "./db";

export type Filters = { from?: string; to?: string; side?: string; symbol?: string; liq?: string;
  seg?: string; rnd?: string; tag?: string; sort?: string };

// сегменты риска (ставит core/risk_audit.py тегом) и случайные сделки
export const SEGMENTS: Record<string, string> = {
  OK: "риск: по стратегии", ADD_POSITION: "риск: доливка/усреднение", ADD_MARGIN: "риск: добавлена маржа", OVER_RISK: "риск: больше входной маржи",
};
export const SEG_LABEL: Record<string, string> = {
  OK: "✅ по стратегии", ADD_POSITION: "➕ доливка/усреднение", ADD_MARGIN: "🛟 добавлена маржа", OVER_RISK: "⚠️ больше риска",
};
export const RANDOM_TAG = "случайная";
const hasTag = (k: number) => `EXISTS (SELECT 1 FROM trade_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.trade_id = t.id AND g.name = $${k})`;
export const SORTS: Record<string, [string, string]> = {
  date_desc: ["сначала новые", "t.opened_at DESC"], date_asc: ["сначала старые", "t.opened_at ASC"],
  pnl_desc: ["PnL: от большего", "t.net_pnl DESC"], pnl_asc: ["PnL: от меньшего", "t.net_pnl ASC"],
  dur_desc: ["длительность ↓", "(t.closed_at - t.opened_at) DESC"], dur_asc: ["длительность ↑", "(t.closed_at - t.opened_at) ASC"],
  size_desc: ["объём ↓", "(t.entry_avg * t.max_qty) DESC"], size_asc: ["объём ↑", "(t.entry_avg * t.max_qty) ASC"],
};

// Фильтры → WHERE. Время дня считаем по МСК (timezone пользователя).
function where(f: Filters) {
  const c: string[] = ["t.deleted_at IS NULL", "t.status = 'CLOSED'"];
  const p: unknown[] = [];
  if (f.from) { p.push(f.from); c.push(`t.opened_at >= $${p.length}::date`); }
  if (f.to) { p.push(f.to); c.push(`t.opened_at < ($${p.length}::date + 1)`); }
  if (f.side === "LONG" || f.side === "SHORT") { p.push(f.side); c.push(`t.side = $${p.length}::"TradeSide"`); }
  if (f.symbol) { p.push(f.symbol); c.push(`i.base_asset = $${p.length}`); }
  if (f.liq === "only") c.push("t.stop_is_liquidation");
  if (f.liq === "exclude") c.push("NOT t.stop_is_liquidation");
  if (f.seg === "OUT") { c.push(`NOT ${hasTag(p.push(SEGMENTS.OK))}`); }
  else if (f.seg && SEGMENTS[f.seg]) { p.push(SEGMENTS[f.seg]); c.push(hasTag(p.length)); }
  if (f.rnd === "only") { p.push(RANDOM_TAG); c.push(hasTag(p.length)); }
  if (f.rnd === "exclude") { p.push(RANDOM_TAG); c.push(`NOT ${hasTag(p.length)}`); }
  if (f.tag) { p.push(f.tag); c.push(hasTag(p.length)); }
  return { sql: "WHERE " + c.join(" AND "), p };
}

const FROM = "FROM trades t JOIN instruments i ON i.id = t.instrument_id";

export type TradeRow = {
  id: string; n: number; symbol: string; side: string; opened_at: Date; closed_at: Date;
  entry_avg: string; exit_avg: string; notional: string; gross_pnl: string; fees: string; net_pnl: string;
  liq: boolean; dur_h: string; fills: number; cum: string; tags: string[] | null; reviewed: boolean; diary: string | null;
};

export async function allTags() {
  return q<{ name: string; n: number }>(`SELECT g.name, count(*)::int AS n FROM tags g JOIN trade_tags tt ON tt.tag_id = g.id
    WHERE g.deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC, 1`);
}

export async function trades(f: Filters) {
  const w = where(f);
  return q<TradeRow>(`
    SELECT t.id, o.n, i.base_asset AS symbol, t.side,
           (SELECT array_agg(g.name ORDER BY g.name) FROM trade_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.trade_id = t.id AND g.deleted_at IS NULL) AS tags,
           EXISTS (SELECT 1 FROM ai_reviews a WHERE a.trade_id = t.id AND a.status = 'done') AS reviewed,
           (SELECT string_agg(nd.parsed->>'diary_entry', ',') FROM notes nd WHERE nd.trade_id = t.id AND nd.deleted_at IS NULL AND nd.parsed->>'source' = 'diary_docx') AS diary,
           t.opened_at, t.closed_at, t.entry_avg, t.exit_avg, (t.entry_avg * t.max_qty) AS notional,
           t.gross_pnl, t.fees, t.net_pnl, t.stop_is_liquidation AS liq,
           round(extract(epoch FROM t.closed_at - t.opened_at) / 3600, 1) AS dur_h,
           (SELECT count(*) FROM executions e WHERE e.trade_id = t.id)::int AS fills,
           sum(t.net_pnl) OVER (ORDER BY t.closed_at) AS cum
    ${FROM} JOIN (SELECT id, row_number() OVER (ORDER BY opened_at)::int AS n FROM trades WHERE deleted_at IS NULL) o ON o.id = t.id
    ${w.sql} ORDER BY ${(SORTS[f.sort ?? ""] ?? SORTS.date_desc)[1]}, t.opened_at DESC`, w.p);
}

export async function summary(f: Filters) {
  const w = where(f);
  const [s] = await q<Record<string, string>>(`
    SELECT count(*) AS n,
      coalesce(sum(net_pnl),0) AS net, coalesce(sum(gross_pnl),0) AS gross, coalesce(sum(fees),0) AS fees,
      count(*) FILTER (WHERE net_pnl > 0) AS wins,
      coalesce(avg(net_pnl) FILTER (WHERE net_pnl > 0),0) AS avg_win,
      coalesce(avg(net_pnl) FILTER (WHERE net_pnl <= 0),0) AS avg_loss,
      coalesce(sum(net_pnl) FILTER (WHERE net_pnl > 0),0) AS sum_win,
      coalesce(sum(net_pnl) FILTER (WHERE net_pnl <= 0),0) AS sum_loss,
      count(*) FILTER (WHERE stop_is_liquidation) AS liq_n,
      coalesce(sum(net_pnl) FILTER (WHERE stop_is_liquidation),0) AS liq_sum,
      coalesce(sum(net_pnl) FILTER (WHERE NOT stop_is_liquidation),0) AS noliq_sum,
      count(*) FILTER (WHERE NOT stop_is_liquidation) AS noliq_n,
      count(*) FILTER (WHERE NOT stop_is_liquidation AND net_pnl > 0) AS noliq_wins,
      min(opened_at) AS first, max(closed_at) AS last,
      coalesce(avg(net_pnl),0) AS expectancy,
      coalesce(avg(extract(epoch FROM closed_at - opened_at)/3600) FILTER (WHERE net_pnl > 0),0) AS dur_win_h,
      coalesce(avg(extract(epoch FROM closed_at - opened_at)/3600) FILTER (WHERE net_pnl <= 0),0) AS dur_loss_h,
      count(${R}) AS r_n, avg(${R}) AS r_avg, sum(${R}) AS r_sum
    ${FROM} ${w.sql}`, w.p);
  // серии подряд (по времени закрытия)
  const seq = await q<{ win: boolean }>(`SELECT t.net_pnl > 0 AS win ${FROM} ${w.sql} ORDER BY t.closed_at`, w.p);
  let cw = 0, cl = 0, mw = 0, ml = 0;
  for (const x of seq) { if (x.win) { cw++; cl = 0; } else { cl++; cw = 0; } mw = Math.max(mw, cw); ml = Math.max(ml, cl); }
  return { ...(s as Record<string, string>), max_win_streak: String(mw), max_loss_streak: String(ml) } as Record<string, string>;
}

// R-мультипликатор: net / риск. Риск = planned_risk_quote, иначе |вход − плановый стоп| × объём. Без стопа — null.
const R = `(t.net_pnl / nullif(coalesce(t.planned_risk_quote, abs(t.entry_avg - t.planned_stop) * t.max_qty), 0))`;

export type Slice = "symbol" | "month" | "hour" | "weekday" | "side" | "duration" | "executor" | "playbook" | "emotion" | "tilt" | "signal";
export async function groupBy(f: Filters, by: Slice) {
  const w = where(f);
  const key = {
    symbol: "i.base_asset",
    month: "to_char(t.opened_at AT TIME ZONE 'Europe/Moscow', 'YYYY-MM')",
    hour: "lpad(((extract(hour FROM t.opened_at AT TIME ZONE 'Europe/Moscow')::int / 3) * 3)::text, 2, '0') || ':00'",
    weekday: "extract(isodow FROM t.opened_at AT TIME ZONE 'Europe/Moscow')::int::text",
    side: "t.side::text",
    duration: `CASE WHEN t.closed_at - t.opened_at < interval '15 min' THEN '1|<15м' WHEN t.closed_at - t.opened_at < interval '1 hour' THEN '2|15м–1ч'
                    WHEN t.closed_at - t.opened_at < interval '4 hour' THEN '3|1–4ч' WHEN t.closed_at - t.opened_at < interval '1 day' THEN '4|4–24ч'
                    WHEN t.closed_at - t.opened_at < interval '3 day' THEN '5|1–3д' ELSE '6|>3д' END`,
    executor: "CASE WHEN t.executor = 'HUMAN' THEN 'Я (руками)' ELSE coalesce((SELECT a.name FROM agents a WHERE a.id = t.agent_id), 'агент') END",
    playbook: "coalesce((SELECT p.name FROM playbooks p WHERE p.id = t.playbook_id), 'без стратегии')",
    emotion: "coalesce(t.emotion_before, 'не указана')",
    // Ф2: флаги детектора тильта (journal/core/tilt.py) и источник сигнала
    tilt: `CASE WHEN EXISTS (SELECT 1 FROM trade_rule_violations v WHERE v.trade_id = t.id) THEN '2|нарушения' ELSE '1|чистые' END`,
    signal: "coalesce((SELECT ss.name FROM signals s JOIN signal_sources ss ON ss.id = s.source_id WHERE s.id = t.signal_id), 'без сигнала')",
  }[by];
  const rows = await q<{ k: string; n: number; net: string; wins: number; liq: number; sw: string; sl: string }>(`
    SELECT ${key} AS k, count(*)::int AS n, sum(t.net_pnl) AS net,
           count(*) FILTER (WHERE t.net_pnl > 0)::int AS wins, count(*) FILTER (WHERE t.stop_is_liquidation)::int AS liq,
           coalesce(sum(t.net_pnl) FILTER (WHERE t.net_pnl > 0), 0) AS sw, coalesce(sum(t.net_pnl) FILTER (WHERE t.net_pnl <= 0), 0) AS sl
    ${FROM} ${w.sql} GROUP BY 1 ORDER BY ${by === "symbol" ? "3" : "1"}`, w.p);
  return rows.map((r) => ({ ...r, k: r.k.replace(/^\d\|/, ""), pf: Number(r.sl) ? Number(r.sw) / -Number(r.sl) : null }));
}

export async function symbols() {
  return q<{ s: string }>(`SELECT DISTINCT i.base_asset AS s ${FROM} WHERE t.deleted_at IS NULL ORDER BY 1`);
}
