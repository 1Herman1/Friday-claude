#!/usr/bin/env python3
"""Ф2: сканер пампов MEXC Futures → signals (source SCANNER 'pump-mexc'), без LLM. Стиль 2 Германа — шорт пампа.

Сигнал = фьючерс вырос ≥ PUMP (50%) за 24 ч и оборот ≥ MIN_TURNOVER. Один сигнал на монету за 48 ч.
Виртуальная сделка (как торгует Герман): шорт по цене обнаружения, плечо 10x → стоп ≈ ликвидация +10%,
тейк −20% (R = 2). Исход по часовым свечам MEXC в течение 72 ч: WIN — тейк раньше стопа, LOSS — стоп раньше,
иначе EXPIRED. В payload: max_drop / max_up за 72 ч — насколько обычно откатывают пампы.

  pump_scan.py [--dry-run]          живой скан (вызывается из run_mexc_sync.sh, ежечасно) + пересчёт исходов
  pump_scan.py --backfill 330 [--all]  история по дневным свечам за N дней (mode=BACKTEST, вход = close дня пампа);
                                       по умолчанию только монеты из сделок Германа, --all — весь рынок (долго)

Привязка сделок: шорт той же монеты, открыт в [detected −24 ч; +48 ч] → trades.signal_id.
Только публичные данные MEXC, ключи не нужны. В чат ничего не пишет.
"""
import argparse
import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
ORG = "(SELECT id FROM organizations WHERE slug = 'german')"
API = "https://contract.mexc.com/api/v1/contract"
PUMP, MIN_TURNOVER = 0.50, 300_000      # +50% за 24 ч, оборот ≥ $300k
STOP, TAKE, HORIZON_H = 0.10, 0.20, 72  # 10x → ликвидация ≈ +10%; тейк −20%; окно 72 ч
UA = {"User-Agent": "trade-journal/1.0"}


def env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                d = json.load(r)
            if d.get("success", True):
                return d.get("data")
        except Exception:
            pass
        time.sleep(1 + i)
    return None


def klines(sym, interval, start, end):
    d = get(f"{API}/kline/{sym}?interval={interval}&start={int(start.timestamp())}&end={int(end.timestamp())}")
    if not d or not d.get("time"):
        return []
    return [(datetime.fromtimestamp(t, timezone.utc), o, h, l, c)
            for t, o, h, l, c in zip(d["time"], d["open"], d["high"], d["low"], d["close"])]


def outcome(sym, entry, t0):
    """Исход виртуального шорта по часовым свечам после t0."""
    end = min(t0 + timedelta(hours=HORIZON_H), datetime.now(timezone.utc))
    bars = [b for b in klines(sym, "Min60", t0, end) if b[0] >= t0]
    if not bars:
        return "PENDING", None, {}
    hi = lo = entry
    status, exit_at = None, None
    for t, o, h, l, c in bars:
        hi, lo = max(hi, h), min(lo, l)
        if status is None and h >= entry * (1 + STOP):          # консервативно: в одной свече сперва стоп
            status, exit_at = "LOSS", t
        elif status is None and l <= entry * (1 - TAKE):
            status, exit_at = "WIN", t
    done = end >= t0 + timedelta(hours=HORIZON_H)
    status = status or ("EXPIRED" if done else "OPEN")
    return status, exit_at, {"max_drop": round(1 - lo / entry, 4), "max_up": round(hi / entry - 1, 4),
                             "bars": len(bars), "final": done}


def source(cur):
    cur.execute(f"""INSERT INTO signal_sources (id, organization_id, kind, name, handle, notes, updated_at)
        VALUES (gen_random_uuid(), {ORG}, 'SCANNER', 'pump-mexc', 'pump-mexc',
                'Сканер пампов MEXC: +50%/24ч → виртуальный шорт, стоп +10% (10x), тейк −20%', now())
        ON CONFLICT (organization_id, kind, name) DO UPDATE SET updated_at = now() RETURNING id""")
    return cur.fetchone()[0]


def instrument(cur, sym):
    base = sym.split("_")[0]
    cur.execute("""INSERT INTO instruments (id, venue_id, symbol, kind, base_asset, quote_asset, settle_asset, updated_at)
                   SELECT gen_random_uuid(), v.id, %s, 'PERPETUAL', %s, 'USDT', 'USDT', now() FROM venues v WHERE v.slug = 'mexc'
                   ON CONFLICT (venue_id, symbol, kind) DO UPDATE SET updated_at = instruments.updated_at RETURNING id""",
                (base + "USDT", base))
    return cur.fetchone()[0]


def upsert(cur, src, sym, t0, entry, mode, payload):
    base = sym.split("_")[0]
    cur.execute("""SELECT 1 FROM signals s JOIN instruments i ON i.id = s.instrument_id
                   WHERE s.source_id = %s AND i.base_asset = %s AND s.setup_time BETWEEN %s - interval '48 hours' AND %s + interval '48 hours'
                     AND s.external_message_id <> %s""", (src, base, t0, t0, f"{sym}|{t0:%Y-%m-%dT%H}"))
    if cur.fetchone():
        return 0
    cur.execute(f"""INSERT INTO signals (id, organization_id, source_id, external_message_id, instrument_id, timeframe, mode, side,
            setup_time, detected_at, entry, stop_loss, take_profits, stop_pct, status, status_changed_at, price_at_detect, payload)
        VALUES (gen_random_uuid(), {ORG}, %s, %s, %s, '24h', %s::"SignalMode", 'SHORT', %s, %s, %s, %s, %s, %s, 'PENDING', now(), %s, %s)
        ON CONFLICT (source_id, external_message_id) DO NOTHING RETURNING id""",
                (src, f"{sym}|{t0:%Y-%m-%dT%H}", instrument(cur, sym), mode, t0, t0, entry, entry * (1 + STOP),
                 [entry * (1 - TAKE)], STOP * 100, entry, json.dumps(payload)))
    return 1 if cur.fetchone() else 0


def scan_live(cur, src):
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    new = 0
    for x in get(f"{API}/ticker") or []:
        if x.get("riseFallRate", 0) >= PUMP and x.get("amount24", 0) >= MIN_TURNOVER and x["symbol"].endswith("_USDT"):
            new += upsert(cur, src, x["symbol"], now, float(x["lastPrice"]), "LIVE",
                          {"rise_24h": x["riseFallRate"], "turnover_24h": x["amount24"], "high_24h": x["high24Price"],
                           "low_24h": x["lower24Price"], "funding": x.get("fundingRate")})
    return new


def backfill(cur, src, days, all_market=False):
    """По умолчанию — только монеты, которыми Герман торговал (весь рынок медленный: публичный API режет частоту)."""
    end = datetime.now(timezone.utc)
    if all_market:
        syms = [x["symbol"] for x in get(f"{API}/ticker") or [] if x["symbol"].endswith("_USDT")]
    else:
        cur.execute("""SELECT DISTINCT i.base_asset FROM trades t JOIN instruments i ON i.id = t.instrument_id
                       WHERE t.deleted_at IS NULL AND i.base_asset NOT IN ('BTC','ETH')""")
        syms = [r[0] + "_USDT" for r in cur.fetchall()]
    new = 0
    with ThreadPoolExecutor(8) as ex:   # ~0.8 с на запрос → параллельно, в пределах лимитов публичного API
        all_bars = list(ex.map(lambda s: klines(s, "Day1", end - timedelta(days=days + 1), end), syms))
    for sym, bars in zip(syms, all_bars):
        for (t_prev, *_, c_prev), (t, o, h, l, c) in zip(bars, bars[1:]):
            if c_prev and c / c_prev - 1 >= PUMP and t + timedelta(days=1) < end:
                new += upsert(cur, src, sym, t + timedelta(days=1), float(c), "BACKTEST",
                              {"rise_24h": round(c / c_prev - 1, 4), "high_day": h, "backfill": "Day1 close"})
    return new, len(syms)


def resolve(cur, src):
    cur.execute("""SELECT s.id, i.base_asset, s.entry, s.setup_time FROM signals s JOIN instruments i ON i.id = s.instrument_id
                   WHERE s.source_id = %s AND (s.status IN ('PENDING','OPEN') OR NOT coalesce((s.payload->>'final')::boolean, false))""", (src,))
    rows = cur.fetchall()
    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda r: outcome(f"{r[1]}_USDT", float(r[2]), r[3]), rows))
    n = 0
    for (sid, base, entry, t0), (st, exit_at, info) in zip(rows, res):
        sim = TAKE / STOP if st == "WIN" else (-1.0 if st == "LOSS" else None)
        cur.execute("""UPDATE signals SET status_changed_at = CASE WHEN status <> %s::"SignalStatus" THEN now() ELSE status_changed_at END,
                         status = %s::"SignalStatus", exit_at = %s, simulated_r = %s, payload = payload || %s::jsonb WHERE id = %s""",
                    (st, st, exit_at, sim, json.dumps(info), sid))
        n += 1
    return n


def link_and_rate(cur, src):
    cur.execute("""UPDATE trades t SET signal_id = m.sid FROM (
          SELECT DISTINCT ON (t.id) t.id AS tid, s.id AS sid
          FROM trades t JOIN instruments ti ON ti.id = t.instrument_id
          JOIN signals s ON s.source_id = %s AND s.side = t.side
          JOIN instruments si ON si.id = s.instrument_id AND si.base_asset = ti.base_asset
          WHERE t.deleted_at IS NULL AND t.signal_id IS NULL
            AND t.opened_at BETWEEN s.setup_time - interval '24 hours' AND s.setup_time + interval '48 hours'
          ORDER BY t.id, abs(extract(epoch FROM t.opened_at - s.setup_time))) m WHERE t.id = m.tid""", (src,))
    linked = cur.rowcount
    cur.execute("""SELECT count(*), count(*) FILTER (WHERE status IN ('WIN','LOSS')),
                          avg((status='WIN')::int) FILTER (WHERE status IN ('WIN','LOSS')), avg(simulated_r)
                   FROM signals WHERE source_id = %s""", (src,))
    n, res, wr, r = cur.fetchone()
    cur.execute("""UPDATE signal_sources SET signals_total=%s, signals_resolved=%s, win_rate=%s, avg_r=%s, expectancy_r=%s, rated_at=now()
                   WHERE id=%s""", (n, res, wr, r, r, src))
    return linked, n, res, wr, r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--backfill", type=int, metavar="DAYS")
    ap.add_argument("--all", action="store_true", help="backfill по всему рынку (долго)")
    a = ap.parse_args()
    env()
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        src = source(cur)
        out = {}
        if a.backfill:
            out["backfill_new"], out["symbols"] = backfill(cur, src, a.backfill, a.all)
        else:
            out["live_new"] = scan_live(cur, src)
        out["resolved"] = resolve(cur, src)
        out["linked_now"], out["signals"], out["closed"], wr, r = link_and_rate(cur, src)
        out["wr"] = round(float(wr), 3) if wr is not None else None
        out["avg_r"] = round(float(r), 3) if r is not None else None
        conn.rollback() if a.dry_run else conn.commit()
    print(json.dumps({"source": "pump-mexc", "dry_run": a.dry_run, **out}, ensure_ascii=False))


if __name__ == "__main__":
    main()
