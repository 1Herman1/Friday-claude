import "server-only";
import { q } from "./db";

export const EMOTIONS = ["спокойствие", "уверенность", "сомнение", "страх", "FOMO", "жадность", "месть/тильт", "скука", "усталость", "эйфория"];

// тикер в нашей БД → тикер MEXC API (обратные алиасы, см. importers/mexc_api_sync.py)
const API_ALIASES: Record<string, string> = { MONUSDT: "MONAD_USDT" };

export type TradeCard = {
  id: string; n: number; symbol: string; base: string; side: string; status: string;
  opened_at: Date; closed_at: Date | null; entry_avg: string; exit_avg: string | null; max_qty: string;
  gross_pnl: string; fees: string; funding: string; net_pnl: string; liq: boolean;
  entry_reason: string | null; emotion_before: string | null; emotion_after: string | null;
  confidence: number | null; followed_plan: boolean | null; planned_stop: string | null;
  playbook: string | null; prev_id: string | null; next_id: string | null;
};

export async function tradeCard(id: string) {
  const [t] = await q<TradeCard>(`
    WITH o AS (SELECT id, row_number() OVER (ORDER BY opened_at)::int AS n,
                      lag(id) OVER (ORDER BY opened_at) AS prev_id, lead(id) OVER (ORDER BY opened_at) AS next_id
               FROM trades WHERE deleted_at IS NULL)
    SELECT t.id, o.n, i.symbol, i.base_asset AS base, t.side, t.status, t.opened_at, t.closed_at, t.entry_avg, t.exit_avg,
           t.max_qty, t.gross_pnl, t.fees, coalesce(t.funding, 0) AS funding, t.net_pnl, t.stop_is_liquidation AS liq,
           t.entry_reason, t.emotion_before, t.emotion_after, t.confidence, t.followed_plan, t.planned_stop,
           p.name AS playbook, o.prev_id, o.next_id
    FROM trades t JOIN instruments i ON i.id = t.instrument_id JOIN o ON o.id = t.id
    LEFT JOIN playbooks p ON p.id = t.playbook_id
    WHERE t.id = $1`, [id]);
  if (!t) return null;
  const [fills, notes, tags, playbooks, rules, shots, reviews] = await Promise.all([
    q<{ executed_at: Date; side: string; position_side: string; price: string; qty: string; fee: string; pnl: string | null; liq: boolean }>(`
      SELECT executed_at, side, position_side, price, qty, coalesce(fee_quote, 0) AS fee, realized_pnl AS pnl, is_liquidation AS liq
      FROM executions WHERE trade_id = $1 ORDER BY executed_at`, [id]),
    q<{ id: string; text: string | null; transcript: string | null; kind: string; channel: string; created_at: Date }>(`
      SELECT id, text, transcript, kind, channel, created_at FROM notes WHERE trade_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [id]),
    q<{ name: string }>(`SELECT g.name FROM trade_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.trade_id = $1 AND g.deleted_at IS NULL ORDER BY 1`, [id]),
    q<{ name: string }>(`SELECT name FROM playbooks WHERE deleted_at IS NULL ORDER BY 1`),
    q<{ id: string; text: string; violated: boolean }>(`
      SELECT r.id, r.text, EXISTS (SELECT 1 FROM trade_rule_violations v WHERE v.rule_id = r.id AND v.trade_id = $1) AS violated
      FROM rules r WHERE r.kind = 'rule' AND r.active AND r.deleted_at IS NULL ORDER BY r.sort_order`, [id]),
    q<{ id: string; created_at: Date }>(`SELECT id, created_at FROM attachments WHERE trade_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [id]),
    q<{ id: string; created_at: Date; content_md: string; findings: { tags?: string[]; tilt_risk?: number } | null }>(
      `SELECT id, created_at, content_md, findings FROM ai_reviews WHERE trade_id = $1 AND status = 'done' ORDER BY created_at DESC`, [id]),
  ]);
  return { t, fills, notes, tags: tags.map((x) => x.name), playbooks: playbooks.map((x) => x.name), rules, shots, reviews };
}

export type Candle = { time: number; open: number; high: number; low: number; close: number };

// свечи с площадки исполнения (MEXC, публичный API), окно = сделка ± запас
export async function candles(symbol: string, from: Date, to: Date | null) {
  const start = Math.floor(from.getTime() / 1000);
  const end = Math.floor((to ?? new Date()).getTime() / 1000);
  const dur = Math.max(end - start, 60);
  const [interval, step] = dur < 6 * 3600 ? ["Min5", 300] : dur < 3 * 86400 ? ["Min15", 900] : dur < 15 * 86400 ? ["Min60", 3600] : ["Hour4", 14400];
  const pad = Math.max(dur * 0.6, step * 40);
  const apiSym = API_ALIASES[symbol] ?? symbol.replace(/USDT$/, "_USDT");
  const url = `https://contract.mexc.com/api/v1/contract/kline/${apiSym}?interval=${interval}&start=${Math.floor(start - pad)}&end=${Math.floor(end + pad / 2)}`;
  try {
    const r = await fetch(url, { next: { revalidate: to ? 86400 : 60 } });
    const j = await r.json();
    const d = j?.data;
    if (!d?.time?.length) return { interval, data: [] as Candle[] };
    const data: Candle[] = d.time.map((tm: number, k: number) => ({ time: tm, open: d.open[k], high: d.high[k], low: d.low[k], close: d.close[k] }));
    return { interval, data };
  } catch {
    return { interval, data: [] as Candle[] };
  }
}

// MFE/MAE по свечам внутри сделки, в % от средней цены входа
export function excursions(c: Candle[], side: string, entry: number, from: Date, to: Date | null) {
  const a = from.getTime() / 1000, b = (to ?? new Date()).getTime() / 1000;
  const inside = c.filter((x) => x.time + 1 >= a - 900 && x.time <= b);
  if (!inside.length || !entry) return null;
  const hi = Math.max(...inside.map((x) => x.high)), lo = Math.min(...inside.map((x) => x.low));
  const up = ((hi - entry) / entry) * 100, down = ((entry - lo) / entry) * 100;
  return side === "LONG" ? { mfe: up, mae: down } : { mfe: down, mae: up };
}
