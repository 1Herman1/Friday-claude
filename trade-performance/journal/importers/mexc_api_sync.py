"""J1: инкрементальная синхронизация MEXC Futures по API (read-only ключ из trade-performance/.env).

Тянет за последние ~90 дней (столько хранит API):
  • исполнения  /private/order/list/order_deals   → raw_records(api:order_deals) + executions("deal:<id>")
  • фандинг     /private/position/funding_records → raw_records(api:funding) + ledger_entries(FUNDING)
и пересобирает сделки (journal/core/rebuild.py).

Идемпотентно: повторный запуск ничего не дублирует. Исполнения, которые уже пришли из xlsx-выгрузки
(там нет id), узнаются по (инструмент, время ±1с, цена, объём в контрактах) и второй раз не создаются.

Запуск:  python mexc_api_sync.py [--account "MEXC Futures"] [--days 89]
"""
import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "journal"))
from core.rebuild import rebuild  # noqa: E402

BASE = "https://contract.mexc.com"
UA = {"User-Agent": "trade-performance-journal/1.0"}
# тикер в API ≠ тикеру в xlsx-выгрузке → сводим к одному инструменту (иначе фандинг не найдёт сделку)
SYMBOL_ALIASES = {"MONAD_USDT": "MONUSDT"}


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("'\""))


def private(path, params):
    key, sec = os.environ["MEXC_API_KEY"], os.environ["MEXC_API_SECRET"]
    ts = str(int(time.time() * 1000))
    qs = "&".join(f"{k}={params[k]}" for k in sorted(params))
    sig = hmac.new(sec.encode(), (key + ts + qs).encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(f"{BASE}{path}?{qs}", headers={**UA, "ApiKey": key, "Request-Time": ts, "Signature": sig})
    for attempt in range(5):
        # подпись зависит от времени → пересобираем запрос на каждой попытке
        ts = str(int(time.time() * 1000))
        sig = hmac.new(sec.encode(), (key + ts + qs).encode(), hashlib.sha256).hexdigest()
        req = urllib.request.Request(f"{BASE}{path}?{qs}", headers={**UA, "ApiKey": key, "Request-Time": ts, "Signature": sig})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=30))
            if r.get("success"):
                return r["data"]
            # 513 «Invalid request, please try again later» — временный отказ MEXC, повторяем
            if r.get("code") != 513 or attempt == 4:
                raise RuntimeError(f"MEXC {path}: {r.get('code')} {r.get('message')}")
        except (urllib.error.URLError, TimeoutError):
            if attempt == 4:
                raise
        time.sleep(3 * 2 ** attempt)


def contract_sizes():
    req = urllib.request.Request(f"{BASE}/api/v1/contract/detail", headers=UA)
    data = json.load(urllib.request.urlopen(req, timeout=30))["data"]
    return {d["symbol"]: Decimal(str(d["contractSize"])) for d in data}


def fetch_deals(days):
    end = int(time.time() * 1000)
    start = end - days * 86400_000
    out, page = [], 1
    while True:
        d = private("/api/v1/private/order/list/order_deals",
                    {"start_time": start, "end_time": end, "page_num": page, "page_size": 100})
        out += d
        if len(d) < 100:
            return out
        page += 1
        time.sleep(0.2)


def fetch_funding():
    out, page = [], 1
    while True:
        d = private("/api/v1/private/position/funding_records", {"page_num": page, "page_size": 100})
        out += d["resultList"]
        if page >= d["totalPage"]:
            return out
        page += 1
        time.sleep(0.2)


def ts(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--account", default="MEXC Futures")
    ap.add_argument("--days", type=int, default=89)
    a = ap.parse_args()
    load_env()
    deals, funding, csize = fetch_deals(a.days), fetch_funding(), contract_sizes()

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute("""SELECT a.id, a.organization_id, v.id FROM accounts a JOIN venues v ON v.id = a.venue_id
                       WHERE v.slug = 'mexc' AND a.name = %s""", (a.account,))
        acc, org, venue = cur.fetchone()
        cur.execute("""INSERT INTO import_jobs (id, organization_id, account_id, mode, status, streams, requested_by,
                       fetched, started_at) VALUES (gen_random_uuid(), %s, %s, 'api', 'RUNNING', %s, 'cron', %s, now())
                       RETURNING id""", (org, acc, ["api:order_deals", "api:funding"], len(deals) + len(funding)))
        job = cur.fetchone()[0]

        inst_cache = {}

        def instrument(sym_api):  # BTC_USDT → BTCUSDT (как в выгрузке)
            sym = SYMBOL_ALIASES.get(sym_api) or sym_api.replace("_", "")
            if sym not in inst_cache:
                base = sym_api.split("_")[0]
                cur.execute("""INSERT INTO instruments (id, venue_id, symbol, kind, base_asset, quote_asset, settle_asset,
                               updated_at) VALUES (gen_random_uuid(), %s, %s, 'PERPETUAL', %s, 'USDT', 'USDT', now())
                               ON CONFLICT (venue_id, symbol, kind) DO UPDATE SET symbol = EXCLUDED.symbol RETURNING id""",
                            (venue, sym, base))
                inst_cache[sym] = cur.fetchone()[0]
            return inst_cache[sym]

        def raw(stream, ext, payload):
            p = json.dumps(payload, ensure_ascii=False, sort_keys=True)
            cur.execute("""INSERT INTO raw_records (id, organization_id, account_id, stream, external_id, payload,
                           payload_hash, first_job_id, last_job_id) VALUES (gen_random_uuid(), %s,%s,%s,%s,%s,%s,%s,%s)
                           ON CONFLICT (account_id, stream, external_id) DO UPDATE SET last_job_id = EXCLUDED.last_job_id,
                           last_seen_at = now() RETURNING id, (xmax = 0)""",
                        (org, acc, stream, ext, p, hashlib.sha256(p.encode()).hexdigest(), job, job))
            return cur.fetchone()

        st = dict(deals_new=0, deals_dup=0, deals_matched_file=0, funding_new=0, funding_dup=0)
        for d in sorted(deals, key=lambda x: x["timestamp"]):
            rid, new = raw("api:order_deals", str(d["id"]), d)
            if not new:
                st["deals_dup"] += 1
                continue
            inst = instrument(d["symbol"])
            vol, price = Decimal(str(d["vol"])), Decimal(str(d["price"]))
            when = ts(d["timestamp"])
            # уже есть из xlsx-выгрузки? Тикер не сравниваем: в файле и API он бывает разный (MONUSDT ↔ MONAD_USDT)
            cur.execute("""SELECT e.id FROM executions e JOIN raw_records r ON r.id = e.raw_record_id
                           WHERE e.account_id = %s AND r.stream LIKE 'file:%%'
                             AND e.executed_at BETWEEN %s AND %s AND e.price = %s AND e.qty_contracts = %s
                           LIMIT 1""", (acc, when - timedelta(seconds=1), when + timedelta(seconds=1), price, vol))
            if cur.fetchone():
                st["deals_matched_file"] += 1
                continue
            qty = vol * csize.get(d["symbol"], Decimal(1))
            fee = Decimal(str(d["fee"]))
            side_code = d["side"]  # 1 открыть лонг, 2 закрыть шорт, 3 открыть шорт, 4 закрыть лонг
            cur.execute("""INSERT INTO executions (id, organization_id, account_id, instrument_id, external_id, side,
                           position_side, price, qty, qty_contracts, quote_qty, fee, fee_asset, fee_quote, is_maker,
                           realized_pnl, is_liquidation, executed_at, origin, raw_record_id)
                           VALUES (gen_random_uuid(), %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'IMPORT',%s)
                           ON CONFLICT (account_id, external_id) DO NOTHING""",
                        (org, acc, inst, f"deal:{d['id']}", "BUY" if side_code in (1, 2) else "SELL",
                         "long" if side_code in (1, 4) else "short", price, qty, vol, qty * price, fee,
                         d.get("feeCurrency"), fee if d.get("feeCurrency") == "USDT" else None, not d.get("taker"),
                         Decimal(str(d["profit"])) if side_code in (2, 4) else None,
                         d.get("category") == 2,  # 2 = системный перехват (ликвидация)
                         when, rid))
            st["deals_new"] += 1

        for f in funding:
            payload = {**f, "side": "long" if f["positionType"] == 1 else "short"}
            rid, new = raw("api:funding", str(f["id"]), payload)
            cur.execute("""INSERT INTO ledger_entries (id, organization_id, account_id, instrument_id, kind, external_id,
                           asset, amount, amount_quote, occurred_at, origin, raw_record_id)
                           VALUES (gen_random_uuid(), %s,%s,%s,'FUNDING',%s,'USDT',%s,%s,%s,'IMPORT',%s)
                           ON CONFLICT (account_id, kind, external_id) DO NOTHING""",
                        (org, acc, instrument(f["symbol"]), str(f["id"]), Decimal(str(f["funding"])),
                         Decimal(str(f["funding"])), ts(f["settleTime"]), rid))
            st["funding_new" if cur.rowcount else "funding_dup"] += 1

        cur.execute("""SELECT max(finished_at) FROM import_jobs WHERE account_id = %s AND mode = 'api'
                       AND status = 'SUCCEEDED'""", (acc,))
        prev = cur.fetchone()[0]
        rb = rebuild(cur, acc)
        closed_new = ""
        if prev:
            cur.execute("""SELECT i.base_asset, t.side, t.net_pnl, t.stop_is_liquidation, t.id FROM trades t
                           JOIN instruments i ON i.id = t.instrument_id
                           WHERE t.account_id = %s AND t.deleted_at IS NULL AND t.status = 'CLOSED' AND t.closed_at > %s
                           ORDER BY t.closed_at""", (acc, prev))
            lines = [f"{'🟢' if n > 0 else '🔴'} {b} {'лонг' if s == 'LONG' else 'шорт'} {'+' if n > 0 else '−'}${abs(n):.2f}"
                     f"{' 💀 ликвидация' if lq else ''}" for b, s, n, lq, _ in cur.fetchall()]
            if lines:
                closed_new = "📓 В дневник добавлены сделки MEXC:\n" + "\n".join(lines) + \
                             "\nРазбор: напиши сюда причину входа и эмоции — привяжу к сделке."
        cur.execute("""UPDATE import_jobs SET status='SUCCEEDED', inserted=%s, duplicates=%s, finished_at=now()
                       WHERE id=%s""", (st["deals_new"] + st["funding_new"],
                                        st["deals_dup"] + st["deals_matched_file"] + st["funding_dup"], job))
        conn.commit()
    print(json.dumps({**st, **rb, "fetched_deals": len(deals), "fetched_funding": len(funding),
                      "closed_new": closed_new}, ensure_ascii=False))


if __name__ == "__main__":
    main()
