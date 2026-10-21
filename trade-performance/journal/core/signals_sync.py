#!/usr/bin/env python3
"""Ф2: сигнальные боты → signals, и привязка сделок к сигналам (trades.signal_id).

Источник 1 — детектор prop-agents/clusters/smc-btc (out/setups.json + seen.json):
  signal_sources(kind=DETECTOR, name='smc-btc'); сигналы из seen.json (реально ушли в Т1) — mode=LIVE,
  остальные — BACKTEST. simulated_r: win=+rr, loss=−1, иначе NULL.
Привязка: сделка того же инструмента и направления, открыта в окне [setup−15 мин; setup+entry_window],
  берём ближайшую по времени. Ручную привязку (signal_id уже стоит) не трогаем.

  signals_sync.py [--dry-run]   → JSON-сводка: сигналов, новых, привязано сделок, WR/R по источнику
"""
import argparse
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
SMC = ROOT / "prop-agents/clusters/smc-btc"
ORG = "(SELECT id FROM organizations WHERE slug = 'german')"
STATUS = {"win": "WIN", "loss": "LOSS", "pending": "PENDING", "open": "OPEN", "filled": "OPEN",
          "expired": "EXPIRED", "cancelled": "CANCELLED", "invalid": "CANCELLED"}


def env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def ts(s):
    return datetime.fromisoformat(str(s).replace(" ", "T"))


def sync_smc(cur):
    cfg = json.loads((SMC / "config.json").read_text())
    setups = {f"{s['side']}|{s['time']}": s for s in json.loads((SMC / "out/setups.json").read_text())}
    if (SMC / "out/setups_live.json").exists():  # пишет детектор в --live (статусы свежее)
        setups.update({f"{s['side']}|{s['time']}": s for s in json.loads((SMC / "out/setups_live.json").read_text())})
    setups = list(setups.values())
    seen = set(json.loads((SMC / "out/seen.json").read_text()))
    last = json.loads((SMC / "out/last_signal.json").read_text()) if (SMC / "out/last_signal.json").exists() else {}
    rr, tf = float(cfg.get("rr", 2)), cfg.get("timeframe", "5m")
    win_min = int(cfg.get("entry_window_bars", 24)) * int(tf.rstrip("m"))

    cur.execute(f"""INSERT INTO signal_sources (id, organization_id, kind, name, handle, notes, updated_at)
        VALUES (gen_random_uuid(), {ORG}, 'DETECTOR', 'smc-btc', 'smc-btc', 'SMC 5m детектор (prop-agents), без LLM', now())
        ON CONFLICT (organization_id, kind, name) DO UPDATE SET updated_at = now() RETURNING id""")
    src = cur.fetchone()[0]
    sym = cfg.get("symbol", "BTCUSDT").replace("USDT", "")
    cur.execute("""SELECT i.id FROM instruments i JOIN venues v ON v.id = i.venue_id
                   WHERE i.base_asset = %s AND i.kind = 'PERPETUAL' AND v.slug ILIKE 'mexc%%' LIMIT 1""", (sym,))
    inst = cur.fetchone()[0]

    new = 0
    for s in setups:
        key = f"{s['side']}|{s['time']}"
        setup = ts(s["time"])
        live = key in seen
        detected = ts(last["detected_at"]) if live and last.get("key") == key else setup
        st = STATUS.get(s.get("status", "pending"), "PENDING")
        sim = rr if st == "WIN" else (-1.0 if st == "LOSS" else None)
        cur.execute(f"""INSERT INTO signals (id, organization_id, source_id, external_message_id, instrument_id, timeframe, mode, side,
                setup_time, detected_at, entry, stop_loss, take_profits, stop_pct, status, status_changed_at, simulated_r, payload)
            VALUES (gen_random_uuid(), {ORG}, %s, %s, %s, %s, %s::"SignalMode", %s::"TradeSide", %s, %s, %s, %s, %s, %s,
                    %s::"SignalStatus", now(), %s, %s)
            ON CONFLICT (source_id, external_message_id) DO UPDATE SET
                status = EXCLUDED.status, simulated_r = EXCLUDED.simulated_r, payload = EXCLUDED.payload,
                mode = CASE WHEN EXCLUDED.mode = 'LIVE' THEN 'LIVE'::"SignalMode" ELSE signals.mode END,
                status_changed_at = CASE WHEN signals.status <> EXCLUDED.status THEN now() ELSE signals.status_changed_at END
            RETURNING (xmax = 0)""",
                    (src, key, inst, tf, "LIVE" if live else "BACKTEST", "LONG" if s["side"] == "long" else "SHORT",
                     setup, detected, s["entry"], s["sl"], [s["tp"]], s["stop_pct"], st, sim, json.dumps(s)))
        new += cur.fetchone()[0]

    # привязка сделок
    cur.execute("""UPDATE trades t SET signal_id = m.sid FROM (
          SELECT DISTINCT ON (t.id) t.id AS tid, s.id AS sid
          FROM trades t JOIN signals s ON s.instrument_id = t.instrument_id AND s.side = t.side AND s.source_id = %s
          WHERE t.deleted_at IS NULL AND t.signal_id IS NULL
            AND t.opened_at BETWEEN s.setup_time - interval '15 minutes' AND s.setup_time + make_interval(mins => %s)
          ORDER BY t.id, abs(extract(epoch FROM t.opened_at - s.setup_time))) m
        WHERE t.id = m.tid RETURNING t.id""", (src, win_min))
    linked = cur.rowcount

    cur.execute("""SELECT count(*), count(*) FILTER (WHERE status IN ('WIN','LOSS')), avg((status='WIN')::int) FILTER (WHERE status IN ('WIN','LOSS')),
                          avg(simulated_r), count(*) FILTER (WHERE mode='LIVE'),
                          (SELECT count(*) FROM trades WHERE signal_id IN (SELECT id FROM signals WHERE source_id=%s) AND deleted_at IS NULL)
                   FROM signals WHERE source_id = %s""", (src, src))
    n, res, wr, avg_r, n_live, n_tr = cur.fetchone()
    cur.execute("""UPDATE signal_sources SET signals_total=%s, signals_resolved=%s, win_rate=%s, avg_r=%s, expectancy_r=%s, rated_at=now()
                   WHERE id=%s""", (n, res, wr, avg_r, avg_r, src))
    return {"source": "smc-btc", "signals": n, "new": new, "live": n_live, "resolved": res,
            "wr": round(float(wr), 3) if wr is not None else None, "avg_r": round(float(avg_r), 3) if avg_r is not None else None,
            "linked_now": linked, "trades_linked_total": n_tr}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    env()
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        out = [sync_smc(cur)]
        conn.rollback() if a.dry_run else conn.commit()
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
