import "server-only";
import { q } from "./db";

export type Filters = { from?: string; to?: string; side?: string; symbol?: string; liq?: string };

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
  return { sql: "WHERE " + c.join(" AND "), p };
}

const FROM = "FROM trades t JOIN instruments i ON i.id = t.instrument_id";

export type TradeRow = {
  id: string; n: number; symbol: string; side: string; opened_at: Date; closed_at: Date;
  entry_avg: string; exit_avg: string; notional: string; gross_pnl: string; fees: string; net_pnl: string;
  liq: boolean; dur_h: string; fills: number; cum: string;
};

export async function trades(f: Filters) {
  const w = where(f);
  return q<TradeRow>(`
    SELECT t.id, row_number() OVER (ORDER BY t.opened_at)::int AS n, i.base_asset AS symbol, t.side,
           t.opened_at, t.closed_at, t.entry_avg, t.exit_avg, (t.entry_avg * t.max_qty) AS notional,
           t.gross_pnl, t.fees, t.net_pnl, t.stop_is_liquidation AS liq,
           round(extract(epoch FROM t.closed_at - t.opened_at) / 3600, 1) AS dur_h,
           (SELECT count(*) FROM executions e WHERE e.trade_id = t.id)::int AS fills,
           sum(t.net_pnl) OVER (ORDER BY t.closed_at) AS cum
    ${FROM} ${w.sql} ORDER BY t.opened_at`, w.p);
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
      min(opened_at) AS first, max(closed_at) AS last
    ${FROM} ${w.sql}`, w.p);
  return s;
}

export async function groupBy(f: Filters, by: "symbol" | "month" | "hour" | "weekday" | "side") {
  const w = where(f);
  const key = {
    symbol: "i.base_asset",
    month: "to_char(t.opened_at AT TIME ZONE 'Europe/Moscow', 'YYYY-MM')",
    hour: "lpad(((extract(hour FROM t.opened_at AT TIME ZONE 'Europe/Moscow')::int / 3) * 3)::text, 2, '0') || ':00'",
    weekday: "extract(isodow FROM t.opened_at AT TIME ZONE 'Europe/Moscow')::int::text",
    side: "t.side::text",
  }[by];
  return q<{ k: string; n: number; net: string; wins: number; liq: number }>(`
    SELECT ${key} AS k, count(*)::int AS n, sum(t.net_pnl) AS net,
           count(*) FILTER (WHERE t.net_pnl > 0)::int AS wins, count(*) FILTER (WHERE t.stop_is_liquidation)::int AS liq
    ${FROM} ${w.sql} GROUP BY 1 ORDER BY ${by === "symbol" ? "3" : "1"}`, w.p);
}

export async function symbols() {
  return q<{ s: string }>(`SELECT DISTINCT i.base_asset AS s ${FROM} WHERE t.deleted_at IS NULL ORDER BY 1`);
}
