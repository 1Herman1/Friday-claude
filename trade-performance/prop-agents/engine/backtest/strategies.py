"""Стратегии S1–S7 и бейзлайны. Параметры — из источников (STRATEGIES.md), без подгонки под нашу историю.

Каждая функция возвращает dict: daily (дневная доходность счёта), trades (DataFrame или None), note.
"""
from __future__ import annotations

import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import core  # noqa: E402
import data  # noqa: E402


def _panel(syms, tf, field="c"):
    return pd.DataFrame({s: data.klines(s, tf).set_index("tc")[field] for s in syms})


def _fund(syms, index):
    return core.funding_matrix({s: data.funding(s) for s in syms}, index)


def _weights_result(w, closes, syms, note):
    res = core.run_weights(w, closes, _fund(syms, closes.index))
    daily = core.to_daily(res["ret"])
    extra = {"Оборот/год (x капитала)": round(res["turnover"].sum() / (len(daily) / 365), 1),
             "Комиссии % за период": round(res["fee"].sum() * 100, 1),
             "Фандинг % за период": round(res["fund"].sum() * 100, 1),
             "В рынке % времени": round((w.abs().sum(axis=1) > 0).mean() * 100, 1),
             "Sharpe до комиссий": core.metrics(core.to_daily(res["gross"] + res["fund"])).get("Sharpe")}
    return {"daily": daily, "trades": None, "note": note, "extra": extra}


# ---------------- S1: Donchian-ансамбль на корзине ----------------
def s1_donchian(lookbacks=(20, 40, 80, 160), target_vol=0.15, coin_vol_cap=1.0, gross_cap=2.0,
                rebalance_band=0.25):
    syms = data.UNIVERSE
    c, h, l = (_panel(syms, "1d", f) for f in "chl")
    sig = pd.DataFrame(0.0, index=c.index, columns=syms)
    for n in lookbacks:
        up = h.rolling(n).max().shift(1)
        dn = l.rolling(max(n // 2, 2)).min().shift(1)
        state = pd.DataFrame(np.nan, index=c.index, columns=syms)
        state[c > up] = 1.0
        state[c < dn] = 0.0
        sig += state.ffill().fillna(0.0)
    sig /= len(lookbacks)
    rets = c.pct_change()
    coin_vol = rets.rolling(60, min_periods=30).std() * np.sqrt(365)
    raw = sig * (target_vol / coin_vol).clip(upper=coin_vol_cap) / len(syms)
    # масштаб портфеля до целевой волатильности по прошлой волатильности портфеля
    port_r = (raw.shift(1) * rets).sum(axis=1)
    pv = port_r.rolling(60, min_periods=30).std() * np.sqrt(365)
    k = (target_vol / pv).clip(upper=4.0).fillna(1.0)
    w = raw.mul(k, axis=0)
    gross = w.abs().sum(axis=1)
    w = w.div((gross / gross_cap).clip(lower=1.0), axis=0)
    # полоса ребаланса: не перекладываем мелкие изменения (снижение издержек)
    out = w.copy()
    prev = pd.Series(0.0, index=syms)
    for i, t in enumerate(w.index):
        cur = w.loc[t].fillna(0.0)
        change = (cur - prev).abs() > rebalance_band * prev.abs().clip(lower=1e-9)
        change |= (cur == 0) | (prev == 0)
        prev = prev.where(~change, cur)
        out.iloc[i] = prev.values
    return _weights_result(out, c, syms, f"Каналы {lookbacks}, лонг/вне рынка, цель вол {target_vol:.0%}, "
                                           f"плечо ≤{gross_cap}, полоса ребаланса {rebalance_band:.0%}")


# ---------------- S2: интрадей тренд-ансамбль BTC/ETH 1h ----------------
def s2_intraday(lookbacks=(12, 24, 48), target_vol=0.20, cap=3.0, hold_size=False):
    syms = ["BTCUSDT", "ETHUSDT"]
    c, h, l = (_panel(syms, "1h", f) for f in "chl")
    sig = pd.DataFrame(0.0, index=c.index, columns=syms)
    for n in lookbacks:
        up, dn = h.rolling(n).max().shift(1), l.rolling(n).min().shift(1)
        st = pd.DataFrame(np.nan, index=c.index, columns=syms)
        st[c > up] = 1.0
        st[c < dn] = -1.0
        sig += st.ffill().fillna(0.0)
    sig /= len(lookbacks)
    rets = c.pct_change()
    w = core.vol_target(sig, rets, target_vol, 24 * 14, 24 * 365, cap) / len(syms)
    if hold_size:
        # размер фиксируется в момент смены сигнала и не пересчитывается каждый час → меньше оборот
        changed = sig.ne(sig.shift(1))
        w = w.where(changed).ffill().fillna(0.0)
    else:
        w = (w * 4).round() / 4  # шаг 0,25 — меньше мелких перекладок
    return _weights_result(w, c, syms, f"Пробой max/min за {lookbacks} ч, лонг и шорт, цель вол {target_vol:.0%}"
                                       + (", размер фиксируется при смене сигнала" if hold_size else ""))


# ---------------- S4: TSMOM BTC/ETH ----------------
def s4_tsmom(lookbacks=(7, 14, 28), target_vol=0.15, cap=2.0, long_only=False):
    syms = ["BTCUSDT", "ETHUSDT"]
    c = _panel(syms, "1d")
    sig = sum(np.sign(c.pct_change(n)) for n in lookbacks) / len(lookbacks)
    if long_only:
        sig = sig.clip(lower=0)
    w = core.vol_target(sig, c.pct_change(), target_vol, 60, 365, cap) / len(syms)
    w = (w * 10).round() / 10
    return _weights_result(w, c, syms, f"Знак доходности за {lookbacks} дн., {'только лонг' if long_only else 'лонг и шорт'}, "
                                       f"цель вол {target_vol:.0%}")


# ---------------- Бейзлайны ----------------
def base_buyhold_btc():
    c = _panel(["BTCUSDT"], "1d")
    w = pd.DataFrame(1.0, index=c.index, columns=c.columns)
    return _weights_result(w, c, ["BTCUSDT"], "Купить и держать BTC (перп, плечо 1)")


def base_macross_btc(fast=50, slow=200):
    c = _panel(["BTCUSDT"], "1d")
    w = (c.rolling(fast).mean() > c.rolling(slow).mean()).astype(float)
    return _weights_result(w, c, ["BTCUSDT"], f"SMA{fast} > SMA{slow} → лонг BTC, иначе вне рынка")


# ---------------- сделочный симулятор (вход по рынку на открытии следующей свечи) ----------------
def _simulate(df, i_sig, side, sl, tp, max_bars, entry_maker=False, entry_price=None):
    """Вход на open свечи i_sig+1 (или лимиткой по entry_price). Возвращает dict сделки или None."""
    o, h, l, c, tc = df["o"].values, df["h"].values, df["l"].values, df["c"].values, df["tc"].values
    j0 = i_sig + 1
    if j0 >= len(df):
        return None
    entry = o[j0] if entry_price is None else entry_price
    risk = (entry - sl) if side == 1 else (sl - entry)
    if risk <= 0:
        return None
    for j in range(j0, min(j0 + max_bars, len(df))):
        hit_sl = l[j] <= sl if side == 1 else h[j] >= sl
        hit_tp = tp is not None and (h[j] >= tp if side == 1 else l[j] <= tp)
        if hit_sl:  # консервативно: стоп раньше тейка в одной свече
            px, kind = sl, "sl"
        elif hit_tp:
            px, kind = tp, "tp"
        else:
            continue
        break
    else:
        j = min(j0 + max_bars, len(df)) - 1
        px, kind = c[j], "time"
    r_gross = ((px - entry) if side == 1 else (entry - px)) / risk
    r_net = r_gross - core.fees_in_r(entry, risk, entry_maker, kind)
    return dict(entry_time=pd.Timestamp(tc[i_sig]).tz_localize("UTC"), exit_time=pd.Timestamp(tc[j]).tz_localize("UTC"), side=side, entry=entry,
                sl=sl, exit=px, kind=kind, r_gross=r_gross, r_net=r_net, stop_pct=risk / entry * 100)


def _trade_result(trades, risk_pct, note, days=None):
    t = pd.DataFrame(trades)
    if days is None:
        days = pd.date_range("2021-01-02", "2026-10-01", freq="D", tz="UTC")
    daily = core.trades_to_daily(t, risk_pct, days)
    extra = {"Риск на сделку %": risk_pct * 100,
             "Ср. стоп %": round(t["stop_pct"].mean(), 2) if len(t) else None}
    return {"daily": daily, "trades": t, "note": note, "extra": extra}


# ---------------- S3: максимум → тренд, минимум → отскок (BTC 1d) ----------------
def s3_maxmin(n=20, atr_k=2.0, hold_max=1, hold_min=3, risk_pct=0.005):
    df = data.klines("BTCUSDT", "1d")
    c, h, l = df["c"], df["h"], df["l"]
    atr = (pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)).rolling(20).mean()
    is_max = c >= c.rolling(n).max()
    is_min = c <= c.rolling(n).min()
    trades = []
    busy_until = -1
    for i in range(n + 20, len(df) - 1):
        if i <= busy_until:
            continue
        if is_max.iloc[i] or is_min.iloc[i]:
            hold = hold_max if is_max.iloc[i] else hold_min
            entry = df["o"].iloc[i + 1]
            tr = _simulate(df, i, 1, entry - atr_k * atr.iloc[i], None, hold)
            if tr:
                tr["kind_sig"] = "max" if is_max.iloc[i] else "min"
                trades.append(tr)
                busy_until = i + hold
    return _trade_result(trades, risk_pct, f"N={n}, стоп {atr_k}×ATR20, удержание {hold_max} дн. (max) / {hold_min} дн. (min), только лонг")


# ---------------- S5: парная торговля (4h, формирование 90 дн., торговля следующий месяц) ----------------
def s5_pairs(top_pairs=5, form_days=90, z_win=30 * 6, z_in=2.0, z_out=0.5, z_stop=4.0, risk_pct=0.005):
    from itertools import combinations
    from statsmodels.tsa.stattools import coint

    syms = data.UNIVERSE
    px = _panel(syms, "1h").resample("4h", label="right", closed="right").last().dropna(how="all")
    lp = np.log(px)
    months = pd.date_range(lp.index[0].normalize() + pd.Timedelta(days=form_days), lp.index[-1], freq="MS")
    trades = []
    for m0 in months:
        m1 = m0 + pd.offsets.MonthBegin(1)
        form = lp.loc[m0 - pd.Timedelta(days=form_days):m0].dropna(axis=1)
        cand = []
        corr = form.diff().corr()
        pairs = sorted(combinations(form.columns, 2), key=lambda ab: -corr.loc[ab[0], ab[1]])[:25]
        for a, b in pairs:
            try:
                p = coint(form[a], form[b], maxlag=1, autolag=None)[1]
            except Exception:
                continue
            cand.append((p, a, b))
        cand.sort()
        for p, a, b in cand[:top_pairs]:
            if p > 0.05:
                break
            beta = np.polyfit(form[b], form[a], 1)[0]
            seg = lp.loc[m0 - pd.Timedelta(days=z_win / 6):m1, [a, b]].dropna()
            spread = seg[a] - beta * seg[b]
            mu, sd = spread.rolling(z_win).mean(), spread.rolling(z_win).std()
            z = ((spread - mu) / sd).loc[m0:m1]
            pa, pb = px[a].reindex(z.index), px[b].reindex(z.index)
            pos, e = 0, None
            for t, zt in z.items():
                if np.isnan(zt):
                    continue
                if pos == 0 and z_in < abs(zt) < z_stop - 1:
                    pos, e = (-1 if zt > 0 else 1), (t, zt, pa[t], pb[t])
                    continue
                last = t == z.index[-1]
                if pos != 0 and (abs(zt) < z_out or abs(zt) > z_stop or last):
                    # P&L спреда в долях ноги a; риск = расстояние до стопа по z
                    ra = pa[t] / e[2] - 1
                    rb = pb[t] / e[3] - 1
                    pnl = pos * (ra - beta * rb)  # на 1 у.е. ноги a и beta у.е. ноги b
                    risk_unit = (z_stop - abs(e[1])) * sd.loc[e[0]]
                    r_gross = pnl / risk_unit
                    cost = 4 * core.MARKET_SIDE * (1 + abs(beta)) / 2 / risk_unit
                    kind = "tp" if abs(zt) < z_out else ("sl" if abs(zt) > z_stop else "time")
                    trades.append(dict(entry_time=e[0], exit_time=t, side=pos, pair=f"{a}/{b}", kind=kind,
                                       r_gross=r_gross, r_net=r_gross - cost, stop_pct=risk_unit * 100))
                    pos = 0
    return _trade_result(trades, risk_pct, f"Топ-{top_pairs} пар по p-value коинтеграции за {form_days} дн., "
                                           f"z вход {z_in}, выход {z_out}, стоп {z_stop}, закрытие в конце месяца")


# ---------------- S6: против толпы на экстремальном фандинге (1h) ----------------
def s6_funding(z_thr=2.0, z_win=90, confirm_bars=24, rr=2.0, max_hold=48, risk_pct=0.005):
    trades = []
    for s in data.UNIVERSE:
        df = data.klines(s, "1h")
        f = data.funding(s).set_index("t")["rate"]
        z = (f - f.rolling(z_win).mean()) / f.rolling(z_win).std()
        events = z[(z.abs() > z_thr)].index
        tc = df["tc"]
        h4, l4 = df["h"].rolling(4).max().shift(1), df["l"].rolling(4).min().shift(1)
        l24, h24 = df["l"].rolling(24).min(), df["h"].rolling(24).max()
        busy = pd.Timestamp("2000-01-01", tz="UTC")
        for t in events:
            if t <= busy:
                continue
            side = 1 if z[t] < 0 else -1
            i0 = tc.searchsorted(t + pd.Timedelta(hours=1))
            for i in range(i0, min(i0 + confirm_bars, len(df) - 1)):
                ok = df["c"].iloc[i] > h4.iloc[i] if side == 1 else df["c"].iloc[i] < l4.iloc[i]
                if not ok:
                    continue
                entry = df["o"].iloc[i + 1]
                sl = l24.iloc[i] if side == 1 else h24.iloc[i]
                risk = (entry - sl) * side
                if risk <= 0 or risk / entry > 0.08:
                    break
                tr = _simulate(df, i, side, sl, entry + side * rr * risk, max_hold)
                if tr:
                    tr["symbol"] = s
                    trades.append(tr)
                    busy = tr["exit_time"]
                break
    trades.sort(key=lambda x: x["exit_time"])
    return _trade_result(trades, risk_pct, f"z фандинга (окно {z_win} начислений) за ±{z_thr} → против толпы после пробоя "
                                           f"4-часового экстремума; стоп за экстремум 24ч, тейк {rr}R, выход через {max_hold} ч")


# ---------------- S7: SMC-BTC 5m (детектор v0.1 без изменений) ----------------
def s7_smc(entry_maker=True, risk_pct=0.005, start="2021-01-01"):
    import importlib.util
    import json

    base = os.path.join(os.path.dirname(__file__), "..", "..", "clusters", "smc-btc")
    spec = importlib.util.spec_from_file_location("smc", os.path.join(base, "smc_detector.py"))
    smc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(smc)
    cfg = json.load(open(os.path.join(base, "config.json")))
    df = data.klines("BTCUSDT", "5m")
    df = df[df["t"] >= pd.Timestamp(start, tz="UTC")].reset_index(drop=True)
    htf = data.klines("BTCUSDT", "1h")
    bias = smc.htf_bias(df, htf, cfg["htf_ema"])
    setups = smc.detect(df, cfg, bias)
    trades = []
    for s in setups:
        if s["status"] not in ("win", "loss"):
            continue
        risk = abs(s["entry"] - s["sl"])
        kind = "tp" if s["status"] == "win" else "sl"
        r_gross = cfg["rr"] if kind == "tp" else -1.0
        r_net = r_gross - core.fees_in_r(s["entry"], risk, entry_maker, kind)
        trades.append(dict(entry_time=df["tc"].iloc[s["fill_i"]], exit_time=df["tc"].iloc[s["exit_i"]],
                           side=1 if s["side"] == "long" else -1, kind=kind, r_gross=r_gross, r_net=r_net,
                           stop_pct=s["stop_pct"]))
    note = (f"Детектор v0.1 как в бою (config.json), вход {'лимиткой (maker)' if entry_maker else 'по рынку (taker)'}, "
            f"тейк лимиткой, стоп по рынку; сетапов всего {len(setups)}")
    return _trade_result(trades, risk_pct, note)
