"""J1: импорт выгрузки MEXC «Futures Trade History» (.xlsx) в PostgreSQL.

Идемпотентно (DATA_ARCHITECTURE §5): повторный запуск того же или перекрывающегося файла
дублей не создаёт.
  raw_records  (account, stream, external_id)   ← каждая строка файла
  executions   (account, external_id)           ← нормализованное исполнение
  trades       (account, external_position_id)  ← сборка позиции 0 → ≠0 → 0, ключ "fifo:<первое исполнение>"

В выгрузке нет id исполнения, поэтому external_id синтетический: sha1 от полей строки
+ порядковый номер среди полностью одинаковых строк.

Поля человека в trades (эмоции, причина входа, плейбук) при перезапуске не трогаются.

Запуск:
  python mexc_xlsx_to_db.py <file.xlsx> [--account "MEXC Futures"]
"""
import argparse
import hashlib
import json
import os
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import pandas as pd
import psycopg

ROOT = Path(__file__).resolve().parents[2]  # trade-performance/
STREAM = "file:futures_trade_history"
EPS = Decimal("1e-9")


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("'\""))


def D(x):
    return Decimal(str(x))


def read_fills(path):
    df = pd.read_excel(path, dtype=str)
    df = df.rename(columns={
        "Time(UTC+03:00)": "time", "Futures Trading Pair": "symbol", "Direction": "direction",
        "Order Type": "order_type", "Filled Qty (Cont.)": "qty_cont", "Filled Qty (Crypto)": "qty",
        "Filled Qty (Amount)": "notional", "Filled Price": "price", "Trading Fee": "fee",
        "Fee-payment Crypto": "fee_ccy", "Role": "role", "Closing PNL": "closing_pnl",
    })
    # время в файле — МСК без зоны
    df["ts"] = pd.to_datetime(df["time"]).dt.tz_localize("Europe/Moscow").dt.tz_convert("UTC")
    seen = defaultdict(int)
    rows = []
    for _, r in df.iterrows():
        base = "|".join(str(r[c]) for c in ["time", "symbol", "direction", "order_type", "qty_cont", "price",
                                           "fee", "fee_ccy", "role", "closing_pnl"])
        seen[base] += 1
        ext = hashlib.sha1(f"{base}|{seen[base]}".encode()).hexdigest()
        action, side = r["direction"].split()[:2]
        rows.append(dict(
            external_id=ext, ts=r["ts"].to_pydatetime(), symbol=r["symbol"], action=action, side=side,
            # в выгрузке MEXC «buy» = открытие, «sell» = закрытие для обеих сторон
            is_open=(action == "buy"),
            order_type=r["order_type"], qty_cont=D(r["qty_cont"]), qty=D(r["qty"]), notional=D(r["notional"]),
            price=D(r["price"]), fee=D(r["fee"]), fee_ccy=r["fee_ccy"], is_maker=(r["role"] == "Maker"),
            pnl=D(r["closing_pnl"]),
            payload={k: str(r[k]) for k in ["time", "symbol", "direction", "order_type", "qty_cont", "qty", "notional",
                                            "price", "fee", "fee_ccy", "role", "closing_pnl"]},
        ))
    # открытия раньше закрытий в одну и ту же секунду
    rows.sort(key=lambda f: (f["ts"], not f["is_open"]))
    return rows


def build_trades(fills):
    pos = defaultdict(Decimal)
    cur, trades = {}, []
    for f in fills:
        key = (f["symbol"], f["side"])
        if f["is_open"]:
            if pos[key] <= EPS:
                cur[key] = dict(symbol=f["symbol"], side=f["side"], fills=[], max_qty=Decimal(0))
            t = cur[key]
            pos[key] += f["qty_cont"]
        else:
            t = cur.get(key)
            if t is None:  # закрытие позиции, открытой до начала файла
                t = cur[key] = dict(symbol=f["symbol"], side=f["side"], fills=[], max_qty=Decimal(0), partial=True)
            pos[key] -= f["qty_cont"]
        t["fills"].append(f)
        t["max_qty"] = max(t["max_qty"], pos[key])
        if not f["is_open"] and pos[key] <= EPS:
            pos[key] = Decimal(0)
            t["closed"] = True
            trades.append(cur.pop(key))
    trades.extend(cur.values())  # открытые на конец файла
    for t in trades:
        op = [f for f in t["fills"] if f["is_open"]]
        cl = [f for f in t["fills"] if not f["is_open"]]
        oq, cq = sum((f["qty"] for f in op), Decimal(0)), sum((f["qty"] for f in cl), Decimal(0))
        t["entry_avg"] = sum((f["notional"] for f in op), Decimal(0)) / oq if oq else None
        t["exit_avg"] = sum((f["notional"] for f in cl), Decimal(0)) / cq if cq else None
        t["max_qty_base"] = oq  # объём открытия в монете
        t["gross"] = sum((f["pnl"] for f in cl), Decimal(0))
        t["fees"] = sum((f["fee"] for f in t["fills"] if f["fee_ccy"] == "USDT"), Decimal(0))
        t["net"] = t["gross"] - t["fees"]
        t["opened_at"] = op[0]["ts"] if op else None
        t["closed_at"] = cl[-1]["ts"] if t.get("closed") else None
        t["liquidated"] = any(f["order_type"] == "Liquidation_Order" for f in cl)
        t["ext_pos"] = "fifo:" + t["fills"][0]["external_id"]
    return trades


SEED_SQL = """
INSERT INTO organizations (id, name, slug, updated_at) VALUES (gen_random_uuid(), 'Герман', 'german', now())
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO users (id, name, telegram_user_id, updated_at) VALUES (gen_random_uuid(), 'Герман', 7098788894, now())
  ON CONFLICT (telegram_user_id) DO NOTHING;
INSERT INTO memberships (id, organization_id, user_id, role)
  SELECT gen_random_uuid(), o.id, u.id, 'OWNER' FROM organizations o, users u
  WHERE o.slug='german' AND u.telegram_user_id=7098788894
  ON CONFLICT DO NOTHING;
INSERT INTO venues (id, slug, name, kind, has_api) VALUES (gen_random_uuid(), 'mexc', 'MEXC', 'EXCHANGE', true)
  ON CONFLICT (slug) DO NOTHING;
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--account", default="MEXC Futures")
    a = ap.parse_args()
    load_env()
    fills = read_fills(a.file)
    trades = build_trades(fills)

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute(SEED_SQL)
        cur.execute("SELECT id FROM organizations WHERE slug='german'")
        org = cur.fetchone()[0]
        cur.execute("SELECT id FROM users WHERE telegram_user_id=7098788894")
        user = cur.fetchone()[0]
        cur.execute("SELECT id FROM venues WHERE slug='mexc'")
        venue = cur.fetchone()[0]
        cur.execute("SELECT id FROM accounts WHERE organization_id=%s AND venue_id=%s AND name=%s", (org, venue, a.account))
        row = cur.fetchone()
        if row:
            acc = row[0]
        else:
            cur.execute("""INSERT INTO accounts (id, organization_id, venue_id, owner_type, user_id, name, kind,
                           credential_ref, updated_at)
                           VALUES (gen_random_uuid(), %s, %s, 'HUMAN', %s, %s, 'LIVE', 'env:MEXC_API_KEY', now())
                           RETURNING id""", (org, venue, user, a.account))
            acc = cur.fetchone()[0]

        cur.execute("""INSERT INTO import_jobs (id, organization_id, account_id, mode, status, streams, requested_by,
                       fetched, started_at) VALUES (gen_random_uuid(), %s, %s, 'file', 'RUNNING', %s, 'cli', %s, now())
                       RETURNING id""", (org, acc, [STREAM], len(fills)))
        job = cur.fetchone()[0]

        inst = {}
        for sym in sorted({f["symbol"] for f in fills}):
            base = sym[:-4] if sym.endswith("USDT") else sym
            cur.execute("""INSERT INTO instruments (id, venue_id, symbol, kind, base_asset, quote_asset, settle_asset,
                           updated_at) VALUES (gen_random_uuid(), %s, %s, 'PERPETUAL', %s, 'USDT', 'USDT', now())
                           ON CONFLICT (venue_id, symbol, kind) DO UPDATE SET symbol=EXCLUDED.symbol RETURNING id""",
                        (venue, sym, base))
            inst[sym] = cur.fetchone()[0]

        ins = dup = 0
        raw_id, exe_id = {}, {}
        for f in fills:
            payload = json.dumps(f["payload"], ensure_ascii=False, sort_keys=True)
            h = hashlib.sha256(payload.encode()).hexdigest()
            cur.execute("""INSERT INTO raw_records (id, organization_id, account_id, stream, external_id, payload,
                           payload_hash, first_job_id, last_job_id) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT (account_id, stream, external_id) DO UPDATE SET last_job_id=EXCLUDED.last_job_id,
                           last_seen_at=now() RETURNING id, (xmax = 0)""",
                        (org, acc, STREAM, f["external_id"], payload, h, job, job))
            rid, inserted = cur.fetchone()
            raw_id[f["external_id"]] = rid
            ins += inserted
            dup += not inserted
            # BUY/SELL — направление ордера на бирже (открытие шорта = SELL)
            oside = "BUY" if (f["action"] == "buy") == (f["side"] == "long") else "SELL"
            cur.execute("""INSERT INTO executions (id, organization_id, account_id, instrument_id, external_id, side,
                           position_side, price, qty, qty_contracts, quote_qty, fee, fee_asset, fee_quote, is_maker,
                           realized_pnl, executed_at, origin, raw_record_id)
                           VALUES (gen_random_uuid(), %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'IMPORT',%s)
                           ON CONFLICT (account_id, external_id) DO UPDATE SET raw_record_id=EXCLUDED.raw_record_id
                           RETURNING id""",
                        (org, acc, inst[f["symbol"]], f["external_id"], oside, f["side"], f["price"], f["qty"],
                         f["qty_cont"], f["notional"], f["fee"], f["fee_ccy"],
                         f["fee"] if f["fee_ccy"] == "USDT" else None, f["is_maker"],
                         f["pnl"] if not f["is_open"] else None, f["ts"], rid))
            exe_id[f["external_id"]] = cur.fetchone()[0]

        n_tr = 0
        for t in trades:
            status = "CLOSED" if t.get("closed") else "OPEN"
            cur.execute("""INSERT INTO trades (id, organization_id, account_id, instrument_id, executor, origin, status,
                           side, opened_at, closed_at, stop_is_liquidation, max_qty, entry_avg, exit_avg, pnl_asset,
                           gross_pnl, fees, net_pnl, net_pnl_usd, external_position_id, recomputed_at, updated_at)
                           VALUES (gen_random_uuid(), %s,%s,%s,'HUMAN','IMPORT',%s,%s,%s,%s,%s,%s,%s,%s,'USDT',%s,%s,%s,%s,%s,
                           now(), now())
                           ON CONFLICT (account_id, external_position_id) DO UPDATE SET
                             status=EXCLUDED.status, opened_at=EXCLUDED.opened_at, closed_at=EXCLUDED.closed_at,
                             stop_is_liquidation=EXCLUDED.stop_is_liquidation, max_qty=EXCLUDED.max_qty,
                             entry_avg=EXCLUDED.entry_avg, exit_avg=EXCLUDED.exit_avg, gross_pnl=EXCLUDED.gross_pnl,
                             fees=EXCLUDED.fees, net_pnl=EXCLUDED.net_pnl, net_pnl_usd=EXCLUDED.net_pnl_usd,
                             recomputed_at=now(), updated_at=now()
                           RETURNING id""",
                        (org, acc, inst[t["symbol"]], status, t["side"].upper(), t["opened_at"], t["closed_at"],
                         t["liquidated"], t["max_qty_base"], t["entry_avg"], t["exit_avg"], t["gross"], t["fees"],
                         t["net"], t["net"], t["ext_pos"]))
            tid = cur.fetchone()[0]
            n_tr += 1
            cur.execute("UPDATE executions SET trade_id=%s WHERE id = ANY(%s)",
                        (tid, [exe_id[f["external_id"]] for f in t["fills"]]))

        cur.execute("""UPDATE import_jobs SET status='SUCCEEDED', inserted=%s, duplicates=%s, finished_at=now()
                       WHERE id=%s""", (ins, dup, job))
        conn.commit()
    print(f"fills={len(fills)} inserted={ins} duplicates={dup} trades={n_tr}")


if __name__ == "__main__":
    main()
