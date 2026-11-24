"""Синхронизация BingX Perpetual Futures (USDT-M) по API → дневник. Только чтение.

Ключ: BINGX_API_KEY / BINGX_SECRET_KEY в trade-performance/.env (права: Read; вывод — выключен).
Тянет:
  • исполненные ордера  /openApi/swap/v2/trade/allOrders (окна по 7 дней) → raw_records(api:bingx_orders) + executions
  • фандинг              /openApi/swap/v2/user/income?incomeType=FUNDING_FEE → ledger_entries(FUNDING)
  • открытые позиции     /openApi/swap/v2/user/positions → raw_records(api:bingx_positions) (снимок)
и пересобирает сделки (core/rebuild.py) — открытая позиция появляется как сделка OPEN.

Идемпотентно. Запуск:  python bingx_api_sync.py [--days 89] [--dry-run]
"""
import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "journal"))

BASES = ["https://open-api.bingx.com", "https://open-api.bingx.pro"]
UA = "trade-performance-journal/1.0"
ACCOUNT = "BingX Futures"
D = lambda x: Decimal(str(x or 0))  # noqa: E731


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("'\""))


_CLOCK = {}


def exchange_timestamp(refresh=False):
    """Use exchange time anchored to monotonic time, not the Mac wall clock."""
    now = time.monotonic()
    if refresh or not _CLOCK or now - _CLOCK['at'] > 60:
        start = time.monotonic()
        req = urllib.request.Request(
            BASES[0] + '/openApi/swap/v2/server/time?timestamp=' + str(int(time.time() * 1000)),
            headers={'User-Agent': UA, 'Cache-Control': 'no-cache'})
        r = json.load(urllib.request.urlopen(req, timeout=30))
        if r.get('code') != 0:
            raise RuntimeError('BingX server time unavailable')
        end = time.monotonic()
        _CLOCK.update(ms=int(r['data']['serverTime']), at=(start + end) / 2)
    return int(_CLOCK['ms'] + (time.monotonic() - _CLOCK['at']) * 1000)


def private(path, params=None):
    key = os.environ["BINGX_API_KEY"]
    sec = os.environ.get("BINGX_SECRET_KEY") or os.environ["BINGX_API_SECRET"]
    for attempt in range(5):
        p = {**(params or {}), "timestamp": exchange_timestamp(refresh=attempt > 0), "recvWindow": 10000}
        qs = "&".join(f"{k}={p[k]}" for k in sorted(p))
        sig = hmac.new(sec.encode(), qs.encode(), hashlib.sha256).hexdigest()
        base = BASES[min(attempt, 1)]
        req = urllib.request.Request(f"{base}{path}?{qs}&signature={sig}",
                                     headers={"X-BX-APIKEY": key, "User-Agent": UA})
        try:
            r = json.loads(urllib.request.urlopen(req, timeout=30).read(), parse_float=Decimal)
            if r.get("code") == 0:
                return r.get("data")
            if r.get("code") not in (100410, 100500, 80012) or attempt == 4:  # лимиты/временные
                raise RuntimeError(f"BingX {path}: {r.get('code')} {r.get('msg')}")
        except (urllib.error.URLError, TimeoutError):
            if attempt == 4:
                raise
        time.sleep(2 * 2 ** attempt)


def fetch_orders(days):
    end = int(time.time() * 1000)
    start, out, seen = end - days * 86400_000, [], set()
    w = 7 * 86400_000 - 1000
    t = start
    while t < end:
        b = min(t + w, end)
        d = private("/openApi/swap/v2/trade/allOrders", {"startTime": t, "endTime": b, "limit": 1000}) or {}
        rows = (d.get("orders") if isinstance(d, dict) else d) or []
        if len(rows) >= 1000:
            raise ValueError('BingX order coverage: saturated response; narrow history window')
        for o in rows:
            if o["orderId"] not in seen:
                seen.add(o["orderId"])
                out.append(o)
        t = b + 1
        time.sleep(0.25)
    return out


def fetch_funding(days):
    end = int(time.time() * 1000)
    start = end - min(days, 89) * 86400_000
    out, t = [], start
    while t < end:
        b = min(t + 7 * 86400_000, end)
        d = private("/openApi/swap/v2/user/income",
                    {"incomeType": "FUNDING_FEE", "startTime": t, "endTime": b, "limit": 1000}) or []
        if len(d) >= 1000:
            raise ValueError('BingX funding coverage: saturated response; narrow history window')
        out += d
        t = b + 1
        time.sleep(0.25)
    return out


def ts(ms):
    return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)


def fills(orders):
    """Исполненные ордера → нормализованные исполнения. positionSide BOTH (one-way) → long/short по нетто-позиции."""
    rows = [o for o in orders if D(o.get("executedQty")) > 0]
    rows.sort(key=lambda o: (int(o.get("updateTime") or o.get("time")), str(o["orderId"])))
    net, out = defaultdict(Decimal), []
    for o in rows:
        sym, side, q = o["symbol"], o["side"], D(o["executedQty"])
        ps = (o.get("positionSide") or "BOTH").upper()
        if ps in ("LONG", "SHORT"):
            pside = ps.lower()
        else:
            n = net[sym]
            pside = "long" if (n > 0 or (n == 0 and side == "BUY")) else "short"
            net[sym] += q if side == "BUY" else -q
        is_open = (side == "BUY") == (pside == "long")
        price = D(o.get("avgPrice")) or D(o.get("price"))
        out.append(dict(o=o, sym=sym, side=side, pside=pside, qty=q, price=price,
                        fee=-D(o.get("commission")), pnl=None if is_open else D(o.get("profit")),
                        liq=(o.get("type") or "").upper() in ("LIQUIDATION",) or "liq" in str(o.get("clientOrderId", "")).lower(),
                        when=ts(o.get("updateTime") or o.get("time"))))
    return out


def fetch_fill_details(days):
    end = exchange_timestamp()
    start, out = end - days * 86400_000, []
    while start < end:
        stop = min(start + 7 * 86400_000 - 1000, end)
        data = private('/openApi/swap/v2/trade/allFillOrders',
                       {'tradingUnit': 'COIN', 'startTs': start, 'endTs': stop}) or {}
        rows = data.get('fill_orders', []) if isinstance(data, dict) else data
        if len(rows) >= 1000:
            raise ValueError('BingX fill coverage: saturated response; narrow the history window')
        out.extend(rows)
        start = stop + 1
        time.sleep(.25)
    return out


def detailed_fills(orders, details):
    """Preserve each actual execution; retain the first legacy order key for trade IDs."""
    groups = defaultdict(list)
    for row in details:
        groups[str(row['orderId'])].append(row)
    normalized = []
    expected = {str(o['orderId']) for o in orders if D(o.get('executedQty')) > 0}
    if set(groups) != expected:
        raise ValueError('BingX fill coverage: missing executions or matching orders')
    for base in fills(orders):
        o = base['o']
        oid = str(o['orderId'])
        rows = sorted(groups.get(oid, []), key=lambda r: (
            r['filledTm'], json.dumps(r, sort_keys=True, default=str)))
        if sum((D(r['volume']) for r in rows), Decimal(0)) != base['qty']:
            raise ValueError(f'BingX fill coverage mismatch for order {oid}')
        remaining = base['pnl']
        repeated = defaultdict(int)
        for index, row in enumerate(rows):
            fingerprint = hashlib.sha256(json.dumps(row, sort_keys=True, default=str).encode()).hexdigest()[:20]
            repeated[fingerprint] += 1
            ext = f'order:{oid}' if index == 0 else f'order:{oid}:fill:{fingerprint}:{repeated[fingerprint]}'
            qty, price = D(row['volume']), D(row['price'])
            pnl = None
            if base['pnl'] is not None:
                # Order PnL is authoritative; individual close-fill allocation is proportional.
                pnl = remaining if index == len(rows) - 1 else base['pnl'] * qty / base['qty']
                remaining -= pnl
            normalized.append({**base, 'o': {**o, '_fills': rows}, 'external_id': ext,
                               'qty': qty, 'price': price, 'fee': -D(row['commission']),
                               'pnl': pnl, 'when': datetime.fromisoformat(row['filledTm'].replace('Z', '+00:00'))})
    return sorted(normalized, key=lambda r: (r['when'], r['external_id']))


def side_at(fl, sym, when):
    """Сторона открытой позиции по инструменту в момент when (для фандинга)."""
    pos = defaultdict(Decimal)
    for f in fl:
        if f["when"] > when:
            break
        if f["sym"] == sym:
            is_open = (f["side"] == "BUY") == (f["pside"] == "long")
            pos[f["pside"]] += f["qty"] if is_open else -f["qty"]
    return max(pos, key=lambda k: pos[k]) if pos and max(pos.values()) > 0 else "long"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=89)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    load_env()
    if not os.environ.get("BINGX_API_KEY"):
        sys.exit("нет BINGX_API_KEY в trade-performance/.env")
    orders, funding = fetch_orders(a.days), fetch_funding(a.days)
    positions = private("/openApi/swap/v2/user/positions") or []
    pending = private("/openApi/swap/v2/trade/openOrders") or {}
    open_orders = pending.get('orders', []) if isinstance(pending, dict) else pending
    fl = detailed_fills(orders, fetch_fill_details(a.days))
    if a.dry_run:
        print(json.dumps({"orders": len(orders), "fills": len(fl), "funding": len(funding),
                          "open_positions": [{k: str(p.get(k)) for k in ("symbol", "positionSide", "positionAmt",
                                              "avgPrice", "leverage", "unrealizedProfit", "isolated")} for p in positions],
                          "last_fills": [f"{f['when']:%m-%d %H:%M} {f['sym']} {f['side']} {f['pside']} {f['qty']}@{f['price']}"
                                         for f in fl[-8:]]}, ensure_ascii=False, indent=1))
        return

    import psycopg
    from core.rebuild import rebuild
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM venues WHERE slug = 'bingx'")
        r = cur.fetchone()
        if r:
            venue = r[0]
        else:
            cur.execute("""INSERT INTO venues (id, slug, name, kind, has_api) VALUES (gen_random_uuid(), 'bingx', 'BingX',
                           'EXCHANGE', true) RETURNING id""")
            venue = cur.fetchone()[0]
        cur.execute("SELECT id, organization_id FROM accounts WHERE venue_id = %s AND name = %s", (venue, ACCOUNT))
        r = cur.fetchone()
        if r:
            acc, org = r
        else:  # тот же владелец, что у MEXC-счёта
            cur.execute("""INSERT INTO accounts (id, organization_id, venue_id, owner_type, user_id, name, kind, base_asset,
                           credential_ref, active, updated_at)
                           SELECT gen_random_uuid(), organization_id, %s, owner_type, user_id, %s, kind, 'USDT',
                                  'env:BINGX_API_KEY', true, now()
                           FROM accounts WHERE name = 'MEXC Futures' RETURNING id, organization_id""", (venue, ACCOUNT))
            acc, org = cur.fetchone()
        cur.execute("""INSERT INTO import_jobs (id, organization_id, account_id, mode, status, streams, requested_by,
                       fetched, started_at) VALUES (gen_random_uuid(), %s, %s, 'api', 'RUNNING', %s, 'cron', %s, now())
                       RETURNING id""", (org, acc, ["api:bingx_orders", "api:bingx_funding"], len(fl) + len(funding)))
        job = cur.fetchone()[0]
        inst_cache = {}

        def instrument(sym_api):  # BTC-USDT → BTCUSDT (как у MEXC: свечи/Binance/Bybit находят по этому тикеру)
            sym = sym_api.replace("-", "")
            if sym not in inst_cache:
                cur.execute("""INSERT INTO instruments (id, venue_id, symbol, kind, base_asset, quote_asset, settle_asset,
                               updated_at) VALUES (gen_random_uuid(), %s, %s, 'PERPETUAL', %s, 'USDT', 'USDT', now())
                               ON CONFLICT (venue_id, symbol, kind) DO UPDATE SET symbol = EXCLUDED.symbol RETURNING id""",
                            (venue, sym, sym_api.split("-")[0]))
                inst_cache[sym] = cur.fetchone()[0]
            return inst_cache[sym]

        def raw(stream, ext, payload):
            p = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
            cur.execute("""INSERT INTO raw_records (id, organization_id, account_id, stream, external_id, payload,
                           payload_hash, first_job_id, last_job_id) VALUES (gen_random_uuid(), %s,%s,%s,%s,%s,%s,%s,%s)
                           ON CONFLICT (account_id, stream, external_id) DO UPDATE SET last_job_id = EXCLUDED.last_job_id,
                           payload = EXCLUDED.payload, payload_hash = EXCLUDED.payload_hash, last_seen_at = now()
                           RETURNING id, (xmax = 0)""",
                        (org, acc, stream, ext, p, hashlib.sha256(p.encode()).hexdigest(), job, job))
            return cur.fetchone()

        st = dict(fills_new=0, fills_dup=0, funding_new=0, funding_dup=0)
        for f in fl:
            o = f["o"]
            rid, _ = raw("api:bingx_orders", str(o["orderId"]), o)
            cur.execute("""INSERT INTO executions (id, organization_id, account_id, instrument_id, external_id, side,
                           position_side, price, qty, qty_contracts, quote_qty, fee, fee_asset, fee_quote, is_maker,
                           realized_pnl, is_liquidation, executed_at, origin, raw_record_id)
                           VALUES (gen_random_uuid(), %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'USDT',%s,%s,%s,%s,%s,'IMPORT',%s)
                           ON CONFLICT (account_id, external_id) DO UPDATE SET
                             price=EXCLUDED.price, qty=EXCLUDED.qty, qty_contracts=EXCLUDED.qty_contracts,
                             quote_qty=EXCLUDED.quote_qty, fee=EXCLUDED.fee, fee_quote=EXCLUDED.fee_quote,
                             realized_pnl=EXCLUDED.realized_pnl, executed_at=EXCLUDED.executed_at,
                             is_maker=EXCLUDED.is_maker, raw_record_id=EXCLUDED.raw_record_id
                           WHERE (executions.price,executions.qty,executions.fee_quote,executions.realized_pnl,executions.executed_at)
                             IS DISTINCT FROM (EXCLUDED.price,EXCLUDED.qty,EXCLUDED.fee_quote,EXCLUDED.realized_pnl,EXCLUDED.executed_at)""",
                        (org, acc, instrument(f["sym"]), f["external_id"], f["side"], f["pside"], f["price"],
                         f["qty"], f["qty"], f["qty"] * f["price"], f["fee"], f["fee"],
                         None, f["pnl"], f["liq"], f["when"], rid))
            st["fills_new" if cur.rowcount else "fills_dup"] += 1

        for x in funding:
            ext = str(x.get("tranId") or f"{x['symbol']}:{x['time']}")
            when = ts(x["time"])
            rid, _ = raw("api:bingx_funding", ext, {**x, "side": side_at(fl, x["symbol"], when)})
            cur.execute("""INSERT INTO ledger_entries (id, organization_id, account_id, instrument_id, kind, external_id,
                           asset, amount, amount_quote, occurred_at, origin, raw_record_id)
                           VALUES (gen_random_uuid(), %s,%s,%s,'FUNDING',%s,'USDT',%s,%s,%s,'IMPORT',%s)
                           ON CONFLICT (account_id, kind, external_id) DO NOTHING""",
                        (org, acc, instrument(x["symbol"]), ext, D(x["income"]), D(x["income"]), when, rid))
            st["funding_new" if cur.rowcount else "funding_dup"] += 1

        raw("api:bingx_positions", "snapshot", {"at": int(time.time() * 1000), "positions": positions})
        raw("api:bingx_open_orders", "snapshot", {"at": int(time.time() * 1000), "orders": open_orders})

        cur.execute("""SELECT max(finished_at) FROM import_jobs WHERE account_id = %s AND mode = 'api'
                       AND status = 'SUCCEEDED'""", (acc,))
        prev = cur.fetchone()[0]
        rb = rebuild(cur, acc, soft_delete=True)
        # Historical leverage comes from the first actual order, never an assumed 10x.
        cur.execute("""UPDATE trades t SET leverage = x.leverage
                       FROM (SELECT DISTINCT ON (e.trade_id) e.trade_id,
                         nullif(regexp_replace(r.payload->>'leverage', '[^0-9.]', '', 'g'), '')::numeric AS leverage
                         FROM executions e JOIN raw_records r ON r.id=e.raw_record_id
                         WHERE e.account_id=%s ORDER BY e.trade_id,e.executed_at,e.external_id) x
                       WHERE t.id=x.trade_id AND t.leverage IS NULL""", (acc,))
        for p in positions:
            cur.execute("""UPDATE trades SET leverage=%s, margin_used=%s, margin_mode=%s,
                              liquidation_price=%s, updated_at=now()
                           WHERE account_id=%s AND instrument_id=%s AND side::text=%s
                             AND status='OPEN' AND deleted_at IS NULL""",
                        (D(p['leverage']), D(p.get('initialMargin')),
                         'ISOLATED' if p.get('isolated') else 'CROSSED',
                         D(p.get('liquidationPrice')) or None, acc,
                         instrument(p['symbol']), p['positionSide']))
        closed_new = ""
        if prev:
            cur.execute("""SELECT i.base_asset, t.side, t.net_pnl, t.stop_is_liquidation FROM trades t
                           JOIN instruments i ON i.id = t.instrument_id
                           WHERE t.account_id = %s AND t.deleted_at IS NULL AND t.status = 'CLOSED' AND t.closed_at > %s
                           ORDER BY t.closed_at""", (acc, prev))
            lines = [f"{'🟢' if n > 0 else '🔴'} {b} {'лонг' if s == 'LONG' else 'шорт'} {'+' if n > 0 else '−'}${abs(n):.2f}"
                     f"{' 💀 ликвидация' if lq else ''}" for b, s, n, lq in cur.fetchall()]
            if lines:
                closed_new = "📓 В дневник добавлены сделки BingX:\n" + "\n".join(lines) + \
                             "\nРазбор: напиши сюда причину входа и эмоции — привяжу к сделке."
        cur.execute("""UPDATE import_jobs SET status='SUCCEEDED', inserted=%s, duplicates=%s, finished_at=now()
                       WHERE id=%s""", (st["fills_new"] + st["funding_new"], st["fills_dup"] + st["funding_dup"], job))
        conn.commit()
    print(json.dumps({**st, **rb, "fetched_orders": len(orders), "open_positions": len(positions),
                      "closed_new": closed_new}, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
