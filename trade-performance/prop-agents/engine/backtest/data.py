"""Исторические данные для бэктестов: Binance USDⓈ-M фьючерсы (data.binance.vision, без ключа).

Свечи и фандинг скачиваются помесячными zip-архивами и кэшируются в engine/backtest/cache/ (в .gitignore).
Время — UTC. Свеча помечается временем ОТКРЫТИЯ (t) и закрытия (tc).
"""
from __future__ import annotations

import io
import os
import time
import urllib.error
import urllib.request
import zipfile
from datetime import date

import pandas as pd

BASE = "https://data.binance.vision/data/futures/um/monthly"
CACHE = os.path.join(os.path.dirname(__file__), "cache")
UA = {"User-Agent": "Mozilla/5.0 tp-backtest"}

START = date(2021, 1, 1)
END = date(2026, 9, 1)  # последний полный месяц — сентябрь 2026


def _months(start=START, end=END):
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def _get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 * (k + 1))
        except Exception:
            time.sleep(2 * (k + 1))
    raise RuntimeError(f"не скачалось: {url}")


def _read_zip(blob, names):
    z = zipfile.ZipFile(io.BytesIO(blob))
    raw = z.read(z.namelist()[0]).decode()
    first = raw.split("\n", 1)[0]
    has_header = not first.split(",")[0].strip().lstrip("-").isdigit()
    return pd.read_csv(io.StringIO(raw), header=0 if has_header else None, names=None if has_header else names)


KCOLS = ["open_time", "open", "high", "low", "close", "volume", "close_time", "quote_volume",
         "count", "taker_buy_volume", "taker_buy_quote_volume", "ignore"]


def klines(symbol: str, tf: str, start=START, end=END) -> pd.DataFrame:
    """OHLCV: t, tc, o, h, l, c, v (v — объём в USDT)."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{symbol}_{tf}_{start:%Y%m}_{end:%Y%m}.pkl")
    if os.path.exists(path):
        return pd.read_pickle(path)
    parts = []
    for y, m in _months(start, end):
        blob = _get(f"{BASE}/klines/{symbol}/{tf}/{symbol}-{tf}-{y}-{m:02d}.zip")
        if blob is None:
            continue  # монеты ещё не было на бирже
        d = _read_zip(blob, KCOLS)
        d.columns = KCOLS[: len(d.columns)]
        parts.append(d)
    if not parts:
        raise RuntimeError(f"нет данных {symbol} {tf}")
    d = pd.concat(parts, ignore_index=True)
    out = pd.DataFrame({
        "t": pd.to_datetime(d["open_time"].astype("int64"), unit="ms", utc=True),
        "tc": pd.to_datetime(d["close_time"].astype("int64") + 1, unit="ms", utc=True),
        "o": d["open"].astype(float), "h": d["high"].astype(float),
        "l": d["low"].astype(float), "c": d["close"].astype(float),
        "v": d["quote_volume"].astype(float),
    }).drop_duplicates("t").sort_values("t").reset_index(drop=True)
    out.to_pickle(path)
    return out


def funding(symbol: str, start=START, end=END) -> pd.DataFrame:
    """Ставки фандинга: t (время начисления), rate."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{symbol}_funding_{start:%Y%m}_{end:%Y%m}.pkl")
    if os.path.exists(path):
        return pd.read_pickle(path)
    parts = []
    for y, m in _months(start, end):
        blob = _get(f"{BASE}/fundingRate/{symbol}/{symbol}-fundingRate-{y}-{m:02d}.zip")
        if blob is None:
            continue
        parts.append(_read_zip(blob, ["calc_time", "funding_interval_hours", "last_funding_rate"]))
    d = pd.concat(parts, ignore_index=True)
    out = pd.DataFrame({
        "t": pd.to_datetime(d["calc_time"].astype("int64"), unit="ms", utc=True).dt.floor("h"),
        "rate": d["last_funding_rate"].astype(float),
    }).drop_duplicates("t").sort_values("t").reset_index(drop=True)
    out.to_pickle(path)
    return out


# Корзина для S1/S5: ликвидные монеты, торговавшиеся на Binance Futures весь период 2021–2026.
# Внимание: список выбран сегодня → ошибка выжившего (монеты, выпавшие из топа, не учтены).
UNIVERSE = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "LINKUSDT",
            "LTCUSDT", "AVAXUSDT", "DOTUSDT", "BCHUSDT", "TRXUSDT", "ETCUSDT", "ATOMUSDT"]
