"""Скачать все данные для бэктестов в кэш (один раз)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from concurrent.futures import ThreadPoolExecutor
import data

jobs = [(s, "1d") for s in data.UNIVERSE] + [(s, "1h") for s in data.UNIVERSE] + \
       [("BTCUSDT", "15m"), ("ETHUSDT", "15m"), ("BTCUSDT", "5m")]

def k(j):
    d = data.klines(*j); return f"{j} {len(d)} {d.t.min()} {d.t.max()}"

def f(s):
    d = data.funding(s); return f"{s} funding {len(d)}"

with ThreadPoolExecutor(6) as ex:
    for r in ex.map(k, jobs): print(r, flush=True)
    for r in ex.map(f, data.UNIVERSE): print(r, flush=True)
print("DONE")
