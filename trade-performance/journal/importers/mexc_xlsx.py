"""Сборка сделок (round-trip) из выгрузки MEXC «Futures Trade History» (.xlsx).

Сделка = позиция по (инструмент, сторона) от открытия (объём 0 → >0) до закрытия (→ 0).
Прототип для J1: позже то же самое пишет в PostgreSQL через tp_core.

Запуск:
  python mexc_xlsx.py <input.xlsx> <out_dir>
"""
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd


def load_fills(path):
    df = pd.read_excel(path)
    df = df.rename(columns={
        "Time(UTC+03:00)": "time", "Futures Trading Pair": "symbol", "Direction": "direction",
        "Order Type": "order_type", "Filled Qty (Cont.)": "qty_cont", "Filled Qty (Crypto)": "qty",
        "Filled Qty (Amount)": "notional", "Filled Price": "price", "Trading Fee": "fee",
        "Fee-payment Crypto": "fee_ccy", "Role": "role", "Closing PNL": "closing_pnl",
    })
    df["time"] = pd.to_datetime(df["time"])
    df["action"] = df["direction"].str.split().str[0]   # buy / sell
    df["side"] = df["direction"].str.split().str[1]     # long / short
    # В выгрузке MEXC «buy» = открытие, «sell» = закрытие для обеих сторон
    # (проверено: Closing PNL ≠ 0 только у sell long / sell short).
    df["is_open"] = df["action"] == "buy"
    # стабильный порядок: время, затем открытия раньше закрытий в одну секунду
    df = df.sort_values(["time", "is_open"], ascending=[True, False], kind="stable").reset_index(drop=True)
    return df


def build_trades(df):
    pos = defaultdict(float)
    cur = {}
    trades = []
    for _, f in df.iterrows():
        key = (f.symbol, f.side)
        q = float(f.qty_cont)
        if f.is_open:
            if pos[key] <= 1e-12:
                cur[key] = dict(symbol=f.symbol, side=f.side, open_time=f.time, open_qty=0.0, open_notional=0.0,
                                close_qty=0.0, close_notional=0.0, gross_pnl=0.0, fee_usdt=0.0, fee_other=0.0,
                                fills=0, max_qty=0.0, open_fills=0, close_fills=0, liquidated=False)
            t = cur[key]
            pos[key] += q
            t["open_qty"] += float(f.qty); t["open_notional"] += float(f.notional); t["open_fills"] += 1
            t["max_qty"] = max(t["max_qty"], pos[key])
        else:
            t = cur.get(key)
            if t is None:  # закрытие позиции, открытой до начала выгрузки
                t = cur[key] = dict(symbol=f.symbol, side=f.side, open_time=None, open_qty=0.0, open_notional=0.0,
                                    close_qty=0.0, close_notional=0.0, gross_pnl=0.0, fee_usdt=0.0, fee_other=0.0,
                                    fills=0, max_qty=0.0, open_fills=0, close_fills=0, liquidated=False, partial_start=True)
            pos[key] -= q
            t["close_qty"] += float(f.qty); t["close_notional"] += float(f.notional); t["close_fills"] += 1
            t["gross_pnl"] += float(f.closing_pnl)
            if f.order_type == "Liquidation_Order":
                t["liquidated"] = True
        if f.fee_ccy == "USDT":
            t["fee_usdt"] += float(f.fee)
        else:
            t["fee_other"] += float(f.fee)
        t["fills"] += 1
        if not f.is_open and pos[key] <= 1e-9:
            pos[key] = 0.0
            t["close_time"] = f.time
            trades.append(cur.pop(key))
    for key, t in cur.items():  # ещё открытые на конец выгрузки
        t["close_time"] = None
        t["still_open"] = True
        trades.append(t)

    out = pd.DataFrame(trades)
    out["entry_avg"] = out["open_notional"] / out["open_qty"].where(out["open_qty"] > 0)
    out["exit_avg"] = out["close_notional"] / out["close_qty"].where(out["close_qty"] > 0)
    out["net_pnl_usdt"] = out["gross_pnl"] - out["fee_usdt"]
    out["duration_min"] = (out["close_time"] - out["open_time"]).dt.total_seconds() / 60
    out["status"] = "closed"
    if "still_open" in out:
        out.loc[out["still_open"] == True, "status"] = "open"  # noqa: E712
    if "partial_start" in out:
        out.loc[out["partial_start"] == True, "status"] = "opened_before_export"  # noqa: E712
    out = out.sort_values("open_time", kind="stable", na_position="first").reset_index(drop=True)
    out.insert(0, "n", range(1, len(out) + 1))
    cols = ["n", "status", "symbol", "side", "open_time", "close_time", "duration_min", "entry_avg", "exit_avg",
            "open_qty", "open_notional", "gross_pnl", "fee_usdt", "fee_other", "net_pnl_usdt",
            "liquidated", "open_fills", "close_fills"]
    return out[cols]


if __name__ == "__main__":
    src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    fills = load_fills(src)
    trades = build_trades(fills)
    trades.to_csv(out_dir / "mexc_trades.csv", index=False)
    trades.to_excel(out_dir / "mexc_trades.xlsx", index=False)
    print(f"fills={len(fills)} trades={len(trades)}")
