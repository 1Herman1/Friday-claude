"""SMC-детектор BTC (кластер smc-btc).

Логика (всё числами, без LLM):
  1. Swing high/low: экстремум выше/ниже N свечей слева и справа (подтверждается через N свечей — без заглядывания в будущее).
  2. Снятие ликвидности (sweep): тень прошла за последний подтверждённый swing, закрытие вернулось обратно.
  3. CHoCH: после sweep тело свечи закрылось за противоположный swing (в пределах sweep_lookback_bars).
  4. FVG в импульсе sweep→CHoCH: дыра между свечой 1 и 3, размер >= fvg_min_pct.
  5. Вход лимиткой на ближнюю границу FVG, стоп за экстремум sweep + буфер, тейк = RR.
  6. Фильтр старшего ТФ: лонг только если 1h close > EMA, шорт — если ниже.

Запуск:
  python smc_detector.py                 # история: все сетапы + картинка
  python smc_detector.py --live          # только новые сетапы (для расписания), печатает JSON или ничего
"""
import argparse
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.path.join(HERE, "config.json")
OUT_DIR = os.path.join(HERE, "out")
STATE_PATH = os.path.join(OUT_DIR, "seen.json")

MEXC_INTERVAL = {"1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "60m", "4h": "4h", "1d": "1d"}


def fetch(symbol, tf, limit):
    """MEXC отдаёт до 500 свечей за запрос — листаем вперёд от startTime."""
    step = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400}[tf] * 1000
    now_ms = int(time.time() * 1000)
    start = now_ms - (limit + 1) * step
    raw = []
    while start < now_ms:
        url = (f"https://api.mexc.com/api/v3/klines?symbol={symbol}&interval={MEXC_INTERVAL[tf]}"
               f"&limit=500&startTime={start}&endTime={min(start + 500 * step, now_ms)}")
        req = urllib.request.Request(url, headers={"User-Agent": "smc-detector/0.1"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    chunk = json.load(r)
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
        chunk = [x for x in chunk if not raw or x[0] > raw[-1][0]]
        raw += chunk
        start += 500 * step
    raw = raw[-limit:]
    df = pd.DataFrame(raw, columns=["t", "o", "h", "l", "c", "v", "tc", "qv"])
    for col in "ohlcv":
        df[col] = df[col].astype(float)
    df["t"] = pd.to_datetime(df["t"], unit="ms", utc=True)
    df["tc"] = pd.to_datetime(df["tc"], unit="ms", utc=True)
    # только закрытые свечи
    now = pd.Timestamp.now(tz="UTC")
    df = df[df["tc"] <= now].reset_index(drop=True)
    return df[["t", "tc", "o", "h", "l", "c", "v"]]


def swings(df, n):
    """Возвращает массивы: индекс последнего ПОДТВЕРЖДЁННОГО swing high/low на каждой свече."""
    h, l = df["h"].values, df["l"].values
    size = len(df)
    is_sh = np.zeros(size, bool)
    is_sl = np.zeros(size, bool)
    for i in range(n, size - n):
        win_h = np.r_[h[i - n:i], h[i + 1:i + n + 1]]
        win_l = np.r_[l[i - n:i], l[i + 1:i + n + 1]]
        is_sh[i] = h[i] > win_h.max()
        is_sl[i] = l[i] < win_l.min()
    last_sh = np.full(size, -1)
    last_sl = np.full(size, -1)
    cur_sh = cur_sl = -1
    for k in range(size):
        j = k - n  # на свече k подтверждается swing на свече k-n
        if j >= 0 and is_sh[j]:
            cur_sh = j
        if j >= 0 and is_sl[j]:
            cur_sl = j
        last_sh[k], last_sl[k] = cur_sh, cur_sl
    return is_sh, is_sl, last_sh, last_sl


def htf_bias(df, htf, ema_len):
    """Для каждой свечи младшего ТФ: +1 / -1 по последней ЗАКРЫТОЙ 1h свече относительно EMA."""
    htf = htf.copy()
    htf["ema"] = htf["c"].ewm(span=ema_len, adjust=False).mean()
    htf["bias"] = np.where(htf["c"] > htf["ema"], 1, -1)
    m = pd.merge_asof(df[["tc"]].sort_values("tc"), htf[["tc", "bias"]].sort_values("tc"),
                      on="tc", direction="backward")
    return m["bias"].fillna(0).values


def detect(df, cfg, bias):
    n = cfg["swing_n"]
    o, h, l, c = (df[x].values for x in "ohlc")
    _, _, last_sh, last_sl = swings(df, n)
    size = len(df)
    setups = []
    used = set()

    for i in range(size):
        for side in ("long", "short"):
            ref = last_sl[i] if side == "long" else last_sh[i]
            if ref < 0 or (side, ref) in used:
                continue
            lvl = l[ref] if side == "long" else h[ref]
            swept = (l[i] < lvl and c[i] > lvl) if side == "long" else (h[i] > lvl and c[i] < lvl)
            if not swept:
                continue
            used.add((side, ref))
            # экстремум sweep обновляется, пока ищем CHoCH
            ext = l[i] if side == "long" else h[i]
            for k in range(i + 1, min(i + 1 + cfg["sweep_lookback_bars"], size)):
                if side == "long":
                    ext = min(ext, l[k])
                    opp = last_sh[k]
                    if opp < 0:
                        continue
                    choch = c[k] > h[opp] and opp < i + 1 + n and h[opp] > lvl
                else:
                    ext = max(ext, h[k])
                    opp = last_sl[k]
                    if opp < 0:
                        continue
                    choch = c[k] < l[opp] and opp < i + 1 + n and l[opp] < lvl
                if not choch:
                    continue
                if cfg["htf_filter"] and bias[k] != (1 if side == "long" else -1):
                    break
                # FVG в импульсе от sweep до CHoCH (ближайший к цене = последний)
                fvg = None
                for m in range(i + 2, k + 1):
                    if side == "long" and l[m] > h[m - 2]:
                        top, bot = l[m], h[m - 2]
                    elif side == "short" and h[m] < l[m - 2]:
                        top, bot = l[m - 2], h[m]
                    else:
                        continue
                    if (top - bot) / c[k] * 100 >= cfg["fvg_min_pct"]:
                        fvg = (m, top, bot)
                if fvg is None:
                    break
                m, top, bot = fvg
                if (side, k, m) in used:
                    break
                used.add((side, k, m))
                buf = c[k] * cfg["sl_buffer_pct"] / 100
                if side == "long":
                    entry, sl = top, ext - buf
                    risk = entry - sl
                    tp = entry + cfg["rr"] * risk
                else:
                    entry, sl = bot, ext + buf
                    risk = sl - entry
                    tp = entry - cfg["rr"] * risk
                stop_pct = risk / entry * 100
                if not (cfg["min_stop_pct"] <= stop_pct <= cfg["max_stop_pct"]):
                    break
                s = dict(side=side, sweep_i=i, swept_level=float(lvl), ref_i=int(ref), choch_i=k,
                         choch_level=float(h[opp] if side == "long" else l[opp]), fvg_i=m,
                         fvg_top=float(top), fvg_bot=float(bot), entry=float(entry), sl=float(sl),
                         tp=float(tp), stop_pct=round(stop_pct, 3), time=str(df["tc"].iloc[k]))
                s.update(simulate(s, df, cfg))
                setups.append(s)
                break
    return setups


def simulate(s, df, cfg):
    """Статус на текущий момент: pending / expired / cancelled / open / win / loss."""
    h, l = df["h"].values, df["l"].values
    k, size = s["choch_i"], len(df)
    long_ = s["side"] == "long"
    fill = None
    for j in range(k + 1, size):
        if fill is None:
            if j - k > cfg["entry_window_bars"]:
                return dict(status="expired")
            # стоп/тейк до входа → сетап отменён
            if (long_ and h[j] >= s["tp"]) or (not long_ and l[j] <= s["tp"]):
                return dict(status="cancelled")
            if (long_ and l[j] <= s["entry"]) or (not long_ and h[j] >= s["entry"]):
                fill = j
                if (long_ and l[j] <= s["sl"]) or (not long_ and h[j] >= s["sl"]):
                    return dict(status="loss", fill_i=j, exit_i=j)
            continue
        hit_sl = l[j] <= s["sl"] if long_ else h[j] >= s["sl"]
        hit_tp = h[j] >= s["tp"] if long_ else l[j] <= s["tp"]
        if hit_sl:  # консервативно: если в одной свече и стоп и тейк — считаем стоп
            return dict(status="loss", fill_i=fill, exit_i=j)
        if hit_tp:
            return dict(status="win", fill_i=fill, exit_i=j)
    return dict(status="open", fill_i=fill) if fill is not None else dict(status="pending")


def _draw(ax, df, setups, cfg, start, stop, plt):
    d = df.iloc[start:stop].reset_index()
    up = (d["c"] >= d["o"]).values
    x = np.arange(len(d))
    cols = np.where(up, "#26a69a", "#ef5350")
    ax.vlines(x, d["l"], d["h"], color=cols, lw=0.8)
    ax.bar(x, (d["c"] - d["o"]).abs().clip(lower=d["c"] * 1e-5), bottom=np.minimum(d["o"], d["c"]),
           color=cols, width=0.7)
    colors = {"win": "#2e7d32", "loss": "#c62828", "open": "#1565c0", "pending": "#f9a825",
              "expired": "#9e9e9e", "cancelled": "#9e9e9e"}
    xi = lambda i: i - start
    for s in setups:
        if not (start <= s["choch_i"] < stop):
            continue
        col = colors[s["status"]]
        end = min(s.get("exit_i", s["choch_i"] + cfg["entry_window_bars"]), stop - 1)
        ax.add_patch(plt.Rectangle((xi(s["fvg_i"] - 2), s["fvg_bot"]), end - s["fvg_i"] + 2,
                                   s["fvg_top"] - s["fvg_bot"], color="#1565c0", alpha=0.15))
        ax.text(xi(s["fvg_i"] - 2), s["fvg_top"], "FVG", fontsize=7, color="#1565c0", va="bottom")
        if s["ref_i"] >= start:
            ax.hlines(s["swept_level"], xi(s["ref_i"]), xi(s["sweep_i"]), colors="#7b1fa2", linestyles=":", lw=1.2)
        y = d["l"].iloc[xi(s["sweep_i"])] if s["side"] == "long" else d["h"].iloc[xi(s["sweep_i"])]
        ax.scatter([xi(s["sweep_i"])], [y], marker="^" if s["side"] == "long" else "v", color="#7b1fa2", s=50, zorder=5)
        ax.text(xi(s["sweep_i"]), y, " sweep", fontsize=7, color="#7b1fa2",
                va="top" if s["side"] == "long" else "bottom")
        ax.hlines(s["choch_level"], xi(s["choch_i"]) - 8, xi(s["choch_i"]), colors="black", lw=1)
        ax.text(xi(s["choch_i"]) - 8, s["choch_level"], "CHoCH", fontsize=7, va="bottom")
        ax.hlines(s["entry"], xi(s["choch_i"]), xi(end), colors="#1565c0", lw=1, linestyles="--")
        ax.hlines(s["sl"], xi(s["choch_i"]), xi(end), colors="#c62828", lw=1.2)
        ax.hlines(s["tp"], xi(s["choch_i"]), xi(end), colors="#2e7d32", lw=1.2)
        if "fill_i" in s and start <= s["fill_i"] < stop:
            ax.scatter([xi(s["fill_i"])], [s["entry"]], marker="o", color="#1565c0", s=30, zorder=6)
        ax.set_title(f"{s['side'].upper()}  {s['time'][:16]} UTC  вход {s['entry']:.0f}  стоп {s['sl']:.0f} "
                     f"({s['stop_pct']}%)  тейк {s['tp']:.0f}  →  {s['status'].upper()}", fontsize=10, color=col)
    ticks = x[::max(1, len(x) // 6)]
    ax.set_xticks(ticks)
    ax.set_xticklabels([d["t"].iloc[i].strftime("%d.%m %H:%M") for i in ticks], fontsize=7)
    ax.grid(alpha=0.2)


def plot(df, setups, cfg, path, n=4):
    """Сетка из последних n сетапов, каждый крупно (~120 свечей вокруг)."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    shown = setups[-n:]
    if not shown:
        return
    rows = (len(shown) + 1) // 2
    fig, axes = plt.subplots(rows, 2 if len(shown) > 1 else 1, figsize=(18, 6 * rows), dpi=100, squeeze=False)
    for ax, s in zip(axes.flat, shown):
        start = max(0, min(s["ref_i"], s["sweep_i"]) - 25)
        stop = min(len(df), max(s.get("exit_i", s["choch_i"] + cfg["entry_window_bars"]), s["choch_i"]) + 20)
        _draw(ax, df, [s], cfg, start, stop, plt)
    for ax in list(axes.flat)[len(shown):]:
        ax.axis("off")
    fig.suptitle(f"{cfg['symbol']} {cfg['timeframe']} MEXC — SMC детектор v{cfg['version']}: "
                 f"sweep → CHoCH → вход от FVG, RR 1:{cfg['rr']}, фильтр {cfg['htf']} EMA{cfg['htf_ema']}",
                 fontsize=12)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    args = ap.parse_args()
    cfg = json.load(open(CFG_PATH))
    os.makedirs(OUT_DIR, exist_ok=True)

    df = fetch(cfg["symbol"], cfg["timeframe"], cfg["candles"])
    htf = fetch(cfg["symbol"], cfg["htf"], 500)
    bias = htf_bias(df, htf, cfg["htf_ema"])
    setups = detect(df, cfg, bias)

    if args.live:
        seen = set(json.load(open(STATE_PATH))) if os.path.exists(STATE_PATH) else set()
        fresh = [s for s in setups if s["status"] == "pending" and f"{s['side']}|{s['time']}" not in seen]
        for s in fresh:
            seen.add(f"{s['side']}|{s['time']}")
        json.dump(sorted(seen), open(STATE_PATH, "w"))
        if fresh:
            png = os.path.join(OUT_DIR, "live.png")
            plot(df, fresh[-1:], cfg, png, n=1)
            payload = {"key": f"{fresh[-1]['side']}|{fresh[-1]['time']}", "signals": fresh, "chart": png,
                       "price": float(df["c"].iloc[-1]), "htf_bias": int(bias[-1]),
                       "detected_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
            json.dump(payload, open(os.path.join(OUT_DIR, "last_signal.json"), "w"), ensure_ascii=False, indent=1)
            print(json.dumps(payload, ensure_ascii=False))
        return

    png = os.path.join(OUT_DIR, "history.png")
    plot(df, setups, cfg, png)
    json.dump(setups, open(os.path.join(OUT_DIR, "setups.json"), "w"), ensure_ascii=False, indent=1)
    closed = [s for s in setups if s["status"] in ("win", "loss")]
    wins = sum(s["status"] == "win" for s in closed)
    r = sum(cfg["rr"] if s["status"] == "win" else -1 for s in closed)
    print(f"Свечей: {len(df)} ({df['t'].iloc[0]:%d.%m %H:%M} – {df['tc'].iloc[-1]:%d.%m %H:%M} UTC)")
    print(f"Сетапов: {len(setups)} | статусы: " +
          ", ".join(f"{k}={sum(s['status'] == k for s in setups)}" for k in
                    ("win", "loss", "open", "pending", "expired", "cancelled")))
    if closed:
        print(f"Закрытых: {len(closed)}, винрейт {wins / len(closed) * 100:.0f}%, итог {r:+.1f}R (без комиссий)")
    for s in setups[-8:]:
        print(f"  {s['time'][:16]} {s['side']:5} вход {s['entry']:.1f} стоп {s['sl']:.1f} ({s['stop_pct']}%) "
              f"тейк {s['tp']:.1f} → {s['status']}")
    print("Картинка:", png)


if __name__ == "__main__":
    main()
