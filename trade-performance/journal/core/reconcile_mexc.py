"""J1: сверка сделок дневника с историей позиций MEXC (то же, что показывает кабинет → «История позиций»).

Наши сделки собраны из исполнений + фандинга; MEXC отдаёт позиции агрегатом — это независимая проверка.
Сравниваем по каждой позиции за ~90 дней: время открытия/закрытия, средние цены, gross PnL, net PnL.

  python reconcile_mexc.py [--limit 0]   → таблица + итог, отчёт в journal/data/reconcile_mexc.json
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "journal" / "importers"))
from mexc_api_sync import SYMBOL_ALIASES, load_env, private  # noqa: E402

TOL_PNL = Decimal("0.05")   # $ — округления MEXC
TOL_PX = Decimal("0.001")   # 0.1% по средней цене


def positions():
    out, page = [], 1
    while True:
        d = private("/api/v1/private/position/list/history_positions", {"page_num": page, "page_size": 100})
        out += d
        if len(d) < 100:
            return out
        page += 1


def rel(a, b):
    return abs(a - b) / b if b else Decimal(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    load_env()
    pos = positions()
    if a.limit:
        pos = pos[: a.limit]
    rows, bad = [], 0
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        for p in pos:
            sym = SYMBOL_ALIASES.get(p["symbol"]) or p["symbol"].replace("_", "")
            side = "LONG" if p["positionType"] == 1 else "SHORT"
            close = datetime.fromtimestamp(p["updateTime"] / 1000, timezone.utc)
            cur.execute("""SELECT row_number, t.entry_avg, t.exit_avg, t.gross_pnl, t.fees, coalesce(t.funding,0), t.net_pnl,
                                  t.opened_at, t.closed_at
                           FROM (SELECT id, row_number() OVER (ORDER BY opened_at) FROM trades WHERE deleted_at IS NULL) o
                           JOIN trades t ON t.id = o.id JOIN instruments i ON i.id = t.instrument_id
                           WHERE i.symbol = %s AND t.side = %s AND t.status = 'CLOSED'
                           ORDER BY abs(extract(epoch FROM t.closed_at - %s)) LIMIT 1""", (sym, side, close))
            t = cur.fetchone()
            r = dict(symbol=sym, side=side, closed=close.astimezone().strftime("%d.%m %H:%M"),
                     mexc_gross=float(p["closeProfitLoss"]), mexc_net=float(p["realised"]))
            if not t or abs((t[8] - close).total_seconds()) > 120:
                r.update(status="НЕТ В ДНЕВНИКЕ")
                bad += 1
                rows.append(r)
                continue
            n, entry, exit_, gross, fees, fund, net, *_ = t
            # realised у MEXC = gross − комиссии (+ фандинг входит в позицию)
            checks = {
                "вход": rel(entry, Decimal(str(p["openAvgPrice"]))) <= TOL_PX,
                "выход": rel(exit_ or 0, Decimal(str(p["closeAvgPrice"]))) <= TOL_PX,
                "gross": abs(gross - Decimal(str(p["closeProfitLoss"]))) <= TOL_PNL,
                "net": abs(net - Decimal(str(p["realised"]))) <= TOL_PNL + abs(fund),
            }
            ok = all(checks.values())
            bad += not ok
            r.update(n=n, our_gross=float(gross), our_net=float(net), our_fund=float(fund),
                     status="OK" if ok else "РАСХОЖДЕНИЕ: " + ", ".join(k for k, v in checks.items() if not v))
            rows.append(r)
    out = ROOT / "journal" / "data" / "reconcile_mexc.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    for r in rows:
        print(f"{'#'+str(r.get('n','—')):>5} {r['symbol']:<12} {r['side']:<5} {r['closed']}  MEXC gross {r['mexc_gross']:>9.2f} net {r['mexc_net']:>9.2f}"
              f"  наш gross {r.get('our_gross', 0):>9.2f} net {r.get('our_net', 0):>9.2f}  {r['status']}")
    print(json.dumps({"positions": len(rows), "ok": len(rows) - bad, "bad": bad}, ensure_ascii=False))


if __name__ == "__main__":
    main()
