import "server-only";
import { q } from "./db";

const ORG = `(SELECT id FROM organizations WHERE slug = 'german')`;

export type SourceStat = {
  id: string; kind: string; name: string; notes: string | null; total: number; live: number; closed: number;
  wins: number; avg_r: string | null; taken: number; taken_net: string | null; taken_wins: number;
  med_drop: string | null; hit50: number; last_at: Date | null;
};

/** Рейтинг источников: свои боты (SMC, памп) и чужие каналы — одна таблица signals. */
export async function sources(): Promise<SourceStat[]> {
  return q<SourceStat>(`
    SELECT ss.id, ss.kind, ss.name, ss.notes,
      count(s.id)::int AS total, count(s.id) FILTER (WHERE s.mode = 'LIVE')::int AS live,
      count(s.id) FILTER (WHERE s.status IN ('WIN','LOSS'))::int AS closed,
      count(s.id) FILTER (WHERE s.status = 'WIN')::int AS wins,
      avg(s.simulated_r) FILTER (WHERE s.status IN ('WIN','LOSS')) AS avg_r,
      (SELECT count(*)::int FROM trades t JOIN signals x ON x.id = t.signal_id WHERE x.source_id = ss.id AND t.deleted_at IS NULL) AS taken,
      (SELECT sum(t.net_pnl) FROM trades t JOIN signals x ON x.id = t.signal_id WHERE x.source_id = ss.id AND t.deleted_at IS NULL) AS taken_net,
      (SELECT count(*)::int FROM trades t JOIN signals x ON x.id = t.signal_id WHERE x.source_id = ss.id AND t.deleted_at IS NULL AND t.net_pnl > 0) AS taken_wins,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY (s.payload->>'max_drop')::numeric) AS med_drop,
      count(s.id) FILTER (WHERE (s.payload->>'max_drop')::numeric >= 0.5)::int AS hit50,
      max(s.setup_time) AS last_at
    FROM signal_sources ss LEFT JOIN signals s ON s.source_id = ss.id
    WHERE ss.organization_id = ${ORG} AND ss.active GROUP BY ss.id ORDER BY ss.kind, ss.name`);
}

export type SignalRow = {
  id: string; source: string; base: string; side: string; mode: string; status: string; setup_time: Date;
  entry: string; stop_loss: string; tp: string | null; simulated_r: string | null; rise: string | null;
  max_drop: string | null; max_up: string | null; trade_id: string | null; trade_n: number | null; trade_net: string | null;
};

export async function signalList(source: string | undefined, onlyTaken: boolean): Promise<SignalRow[]> {
  return q<SignalRow>(`
    SELECT s.id, ss.name AS source, i.base_asset AS base, s.side, s.mode, s.status, s.setup_time, s.entry, s.stop_loss,
      s.take_profits[1] AS tp, s.simulated_r, s.payload->>'rise_24h' AS rise, s.payload->>'max_drop' AS max_drop,
      s.payload->>'max_up' AS max_up, t.id AS trade_id, t.seq_no AS trade_n, t.net_pnl AS trade_net
    FROM signals s JOIN signal_sources ss ON ss.id = s.source_id JOIN instruments i ON i.id = s.instrument_id
    LEFT JOIN LATERAL (SELECT o.id, o.n AS seq_no, o.net_pnl FROM (SELECT id, signal_id, net_pnl, opened_at,
        row_number() OVER (ORDER BY opened_at)::int AS n FROM trades WHERE deleted_at IS NULL) o
      WHERE o.signal_id = s.id ORDER BY o.opened_at LIMIT 1) t ON true
    WHERE s.organization_id = ${ORG} AND ($1::text IS NULL OR ss.name = $1) AND (NOT $2 OR t.id IS NOT NULL)
    ORDER BY s.setup_time DESC LIMIT 200`, [source ?? null, onlyTaken]);
}
