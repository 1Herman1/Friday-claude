"""SMC v0.2 — модель «снятие сессионной ликвидности + IFVG» (курс Samurai Trade, решения Германа 27.10).

Лесенка таймфреймов:
  система 15m: контекст/цели 1h, снятие ликвидности 15m, вход 5m (IFVG)   — BTC (5m есть только у BTC)
  система 1h : контекст/цели 4h, снятие ликвидности 1h,  вход 15m (IFVG)  — BTC, ETH
Правила (без подгонки):
  * ликвидность: хай/лой сессий (Азия, Лондон), PDH/PDL, (PWH/PWL в крипто-варианте), неснятые свинги старшего ТФ;
  * снятие — по фитилю: свеча сигнального ТФ впервые заходит за уровень и закрывается обратно;
  * сетап только если снятие в торговом окне (варианты окон ниже);
  * вход: после снятия на младшем ТФ свеча закрывается за FVG, образованным на движении к снятию (IFVG) → вход по рынку;
    если до этого младшая свеча закрылась обратно за уровнем — сетап отменён;
  * стоп за экстремум снятия; ТЕЙК 1 = 2R (50%), стоп → безубыток; ТЕЙК 2 = ближайшая ликвидность / неперекрытый
    имбаланс старшего ТФ за 2R; если такой нет — всё закрывается на 2R. Тайм-стоп: 24ч (15m) / 5 дней (1h);
  * одна сделка на окно, одна позиция одновременно, риск 0,5%;
  * издержки: вход и стоп — taker 0,05% + проскальзывание 0,02%; тейки — лимит maker 0,02%;
  * если в одной свече и стоп и тейк — считаем стоп.
Варианты окон:
  ny     — Азия 20:00–00:00 NY, окна Лондон 02:00–05:00 и Нью-Йорк 08:00–11:00 NY, PD-день по NY;
  crypto — сутки UTC: Азия 00:00–07:00, Лондон 07:00–12:00 UTC; окна 07:00–10:00 и 13:00–16:00 UTC; + PWH/PWL;
  all    — уровни как в crypto, без фильтра по времени (одна сделка в сутки UTC) — контроль: даёт ли время что-то.
"""
from __future__ import annotations
import sys, json
import numpy as np, pandas as pd

C = 'cache'
NS_H = 3600 * 10**9
COST_TAKER, COST_MAKER = 0.0007, 0.0002
SYS = {
    '15m': dict(ltf='5m', sig='15min', htf='1h', swing_age=5, fvg_lb=3, deadline=2, tstop=24),
    '1h':  dict(ltf='15m', sig='1h', htf='4h', swing_age=20, fvg_lb=12, deadline=8, tstop=120),
}


def load(sym, tf):
    d = pd.read_pickle(f'{C}/{sym}_{tf}_202101_202609.pkl').set_index('t')[['o', 'h', 'l', 'c']]
    return d[~d.index.duplicated()].sort_index()


def rs(d, rule):
    return d.resample(rule, label='left', closed='left').agg({'o': 'first', 'h': 'max', 'l': 'min', 'c': 'last'}).dropna()


def session_levels(ltf: pd.DataFrame, variant: str):
    """[(price, kind, side, known_ns, expire_ns)] — side 'hi' / 'lo'."""
    out = []
    if variant == 'ny':
        x = ltf.copy(); x.index = x.index.tz_convert('America/New_York')
        hr = x.index.hour
        day = x.index.normalize()
        # Азия 20:00–00:00 NY предыдущего вечера → относится к следующему дню
        a = x[hr >= 20]; ad = a.index.normalize() + pd.Timedelta(days=1)
        for dname, g in [('asia', a.groupby(ad)), ('london', x[(hr >= 2) & (hr < 5)].groupby(day[(hr >= 2) & (hr < 5)])),
                         ('pd', x.groupby(day))]:
            agg = g.agg({'h': 'max', 'l': 'min'})
            for d0, r in agg.iterrows():
                if dname == 'asia': known = d0
                elif dname == 'london': known = d0 + pd.Timedelta(hours=5)
                else: known = d0 + pd.Timedelta(days=1)
                k = known.tz_convert('UTC').value
                for side, p in (('hi', r.h), ('lo', r.l)):
                    out.append((p, dname, side, k, k + 24 * NS_H))
    else:
        x = ltf; hr = x.index.hour; day = x.index.normalize()
        for dname, mask, kh in [('asia', hr < 7, 7), ('london', (hr >= 7) & (hr < 12), 12)]:
            agg = x[mask].groupby(day[mask]).agg({'h': 'max', 'l': 'min'})
            for d0, r in agg.iterrows():
                k = (d0 + pd.Timedelta(hours=kh)).value
                for side, p in (('hi', r.h), ('lo', r.l)):
                    out.append((p, dname, side, k, k + 24 * NS_H))
        for dname, rule, life in [('pd', '1D', 24), ('pw', 'W-SUN', 24 * 7)]:
            agg = rs(x, rule)
            for d0, r in agg.iterrows():
                k = (d0 + (pd.Timedelta(days=1) if rule == '1D' else pd.Timedelta(days=7))).value
                for side, p in (('hi', r.h), ('lo', r.l)):
                    out.append((p, dname, side, k, k + life * NS_H))
    return out


def swing_levels(htf: pd.DataFrame, age_days: int, step_ns: int):
    h, l, t = htf.h.values, htf.l.values, htf.index.asi8
    out = []
    for i in range(1, len(h) - 1):
        k = t[i + 1] + step_ns  # подтверждён закрытием следующей свечи
        if h[i] > h[i - 1] and h[i] > h[i + 1]:
            out.append((h[i], 'swing', 'hi', k, k + age_days * 24 * NS_H))
        if l[i] < l[i - 1] and l[i] < l[i + 1]:
            out.append((l[i], 'swing', 'lo', k, k + age_days * 24 * NS_H))
    return out


def htf_fvgs(htf: pd.DataFrame, step_ns: int):
    """Бычьи FVG (зона ниже цены — цель для шорта): (top=l3, known). Медвежьи — (bottom=h3, known)."""
    h, l, t = htf.h.values, htf.l.values, htf.index.asi8
    bull, bear = [], []
    for i in range(2, len(h)):
        k = t[i] + step_ns
        if l[i] > h[i - 2]: bull.append((l[i], 'fvg', 'lo', k, k + 30 * 24 * NS_H))
        if h[i] < l[i - 2]: bear.append((h[i], 'fvg', 'hi', k, k + 30 * 24 * NS_H))
    return bull + bear


def window_id(ts_ns: np.ndarray, variant: str):
    idx = pd.DatetimeIndex(ts_ns, tz='UTC')
    if variant == 'ny':
        x = idx.tz_convert('America/New_York'); hr = x.hour + x.minute / 60
        d = x.normalize().asi8 // (86400 * 10**9)
        w = np.where((hr >= 2) & (hr < 5), d * 10 + 1, np.where((hr >= 8) & (hr < 11), d * 10 + 2, -1))
    elif variant == 'crypto':
        hr = idx.hour; d = idx.normalize().asi8 // (86400 * 10**9)
        w = np.where((hr >= 7) & (hr < 10), d * 10 + 1, np.where((hr >= 13) & (hr < 16), d * 10 + 2, -1))
    else:
        w = idx.normalize().asi8 // (86400 * 10**9) * 10
    return w


def first_cross(t, x, price, known, expire, above=True):
    i0 = np.searchsorted(t, known); i1 = np.searchsorted(t, expire)
    if i0 >= i1: return -1
    seg = x[i0:i1]
    m = seg > price if above else seg < price
    j = np.argmax(m)
    return i0 + j if m[j] else -1


def run(sym: str, system: str, variant: str, costs: bool = True):
    global COST_TAKER, COST_MAKER
    COST_TAKER, COST_MAKER = (0.0007, 0.0002) if costs else (0.0, 0.0)
    P = SYS[system]
    ltf = load(sym, P['ltf'])
    sig = rs(ltf, P['sig']); htf = rs(ltf, P['htf'])
    sig_ns = pd.Timedelta(P['sig']).value; htf_ns = pd.Timedelta(P['htf']).value; ltf_ns = pd.Timedelta(P['ltf'].replace('m', 'min')).value
    levels = session_levels(ltf, variant) + swing_levels(htf, P['swing_age'], htf_ns)
    fvgs = htf_fvgs(htf, htf_ns)
    st, sh, sl, sc = sig.index.asi8, sig.h.values, sig.l.values, sig.c.values
    lt, lo_, lh, ll, lc = ltf.index.asi8, ltf.o.values, ltf.h.values, ltf.l.values, ltf.c.values
    wid = window_id(st, variant)

    # «снятие»: первое касание уровня сигнальной свечой после того, как уровень стал известен
    setups = []
    tgt = {'hi': [], 'lo': []}  # для целей: (price, known, taken_ns)
    for p, kind, side, k, e in levels + fvgs:
        above = side == 'hi'
        j = first_cross(st, sh if above else sl, p, k, e, above)
        taken = st[j] if j >= 0 else e
        tgt[side].append((p, k, taken))
        if kind == 'fvg' or j < 0 or wid[j] < 0: continue
        if (above and sc[j] < p) or ((not above) and sc[j] > p):
            setups.append((st[j], 'short' if above else 'long', p, kind, j))
    for s in tgt: tgt[s] = np.array(tgt[s]) if tgt[s] else np.zeros((0, 3))
    setups.sort()

    trades, busy_until, used_w = [], 0, set()
    for t0, dirn, L, kind, j in setups:
        w = wid[j]
        if w in used_w or t0 < busy_until: continue
        sgn = 1 if dirn == 'short' else -1        # работаем в «шортовой» системе координат: цена*sgn
        H = lh if sgn == 1 else -ll; Lo = ll if sgn == 1 else -lh; Cc = lc * sgn
        lev = L * sgn
        a = np.searchsorted(lt, t0 + sig_ns)      # первая младшая свеча после закрытия сигнальной
        b = np.searchsorted(lt, t0 + sig_ns + P['deadline'] * NS_H)
        f0 = np.searchsorted(lt, t0 - P['fvg_lb'] * NS_H)
        ext = H[np.searchsorted(lt, t0):a].max()
        # FVG «на движении к снятию»: Lo[i] > H[i-2], сформирован до снятия
        fv = [(H[i - 2], i) for i in range(max(f0, 2), a) if Lo[i] > H[i - 2]]
        entry = None
        for i in range(a, min(b, len(lt))):
            if Cc[i] > lev: break                         # закрепились за уровнем — отмена
            ext = max(ext, H[i])
            fv += [(H[i - 2], i)] if Lo[i] > H[i - 2] else []
            live = [fb for fb, fi in fv if fi < i]
            if live and Cc[i] < live[-1]:              # закрытие под низом последнего бычьего FVG = IFVG
                entry, ei = Cc[i], i; break
        if entry is None: continue
        R = ext - entry
        if R <= 0: continue
        tp1 = entry - 2 * R
        # тейк 2: ближайшая неснятая ликвидность / неперекрытый имбаланс старшего ТФ за пределами 2R
        te = lt[ei] + ltf_ns
        side = 'lo' if sgn == 1 else 'hi'
        T = tgt[side]
        ok = (T[:, 1] <= te) & (T[:, 2] > te) if len(T) else np.array([], bool)
        cand = T[ok, 0] * sgn if len(T) else np.array([])
        cand = cand[cand < tp1]
        tp2 = cand.max() if len(cand) else None
        # симуляция на младшем ТФ
        stop, half, res, exit_i = ext, False, 0.0, None
        tend = np.searchsorted(lt, lt[ei] + P['tstop'] * NS_H)
        k = ei + 1
        r_simple = None
        while k < min(tend, len(lt)):
            if H[k] >= stop:
                px = stop
                res += (0.5 if half else 1.0) * (entry - px) - (0.5 if half else 1.0) * COST_TAKER * abs(px)
                if r_simple is None: r_simple = (entry - px - COST_TAKER * abs(px))
                exit_i = k; break
            if not half and Lo[k] <= tp1:
                if r_simple is None: r_simple = (entry - tp1 - COST_MAKER * abs(tp1))
                if tp2 is None:
                    res += entry - tp1 - COST_MAKER * abs(tp1); exit_i = k; break
                res += 0.5 * (entry - tp1) - 0.5 * COST_MAKER * abs(tp1); half = True; stop = entry
                if Lo[k] <= tp2:
                    res += 0.5 * (entry - tp2) - 0.5 * COST_MAKER * abs(tp2); exit_i = k; break
            elif half and Lo[k] <= tp2:
                res += 0.5 * (entry - tp2) - 0.5 * COST_MAKER * abs(tp2); exit_i = k; break
            k += 1
        if exit_i is None:  # тайм-стоп
            exit_i = min(tend, len(lt)) - 1; px = Cc[exit_i]
            q = 0.5 if half else 1.0
            res += q * (entry - px) - q * COST_TAKER * abs(px)
            if r_simple is None: r_simple = entry - px - COST_TAKER * abs(px)
        cost_in = COST_TAKER * abs(entry)
        gross_cost = COST_TAKER * abs(entry)
        trades.append(dict(t=pd.Timestamp(lt[ei], tz='UTC'), dir=dirn, level=kind, entry=entry * sgn, stop=ext * sgn,
                           stop_pct=R / abs(entry) * 100, tp2=(tp2 * sgn if tp2 is not None else None),
                           r_net=(res - cost_in) / R, r_2r_only=(r_simple - cost_in) / R,
                           cost_r=(cost_in + COST_TAKER * abs(entry)) / R))
        used_w.add(w); busy_until = lt[exit_i] + ltf_ns
    return pd.DataFrame(trades)


def summary(tr: pd.DataFrame, risk=0.005):
    if not len(tr): return {'Сделок': 0}
    out = {}
    for name, m in [('всё', slice(None)), ('2021–23', tr.t.dt.year <= 2023), ('2024–26', tr.t.dt.year >= 2024)]:
        x = tr[m] if not isinstance(m, slice) else tr
        r = x.r_net
        eq = (1 + risk * r).cumprod(); dd = (eq / eq.cummax() - 1).min()
        yrs = max((x.t.max() - x.t.min()).days / 365, 0.1)
        out[name] = dict(n=len(r), wr=round((r > 0).mean() * 100, 1), avgR=round(r.mean(), 3),
                         avgR_2R=round(x.r_2r_only.mean(), 3), avgR_gross=round(x.r_gross.mean(), 3) if 'r_gross' in x else None, sumR=round(r.sum(), 1),
                         pf=round(r[r > 0].sum() / -r[r < 0].sum(), 2) if (r < 0).any() else None,
                         cagr=round((eq.iloc[-1] ** (1 / yrs) - 1) * 100, 1), maxdd=round(dd * 100, 1),
                         stop_pct=round(x.stop_pct.median(), 3), cost_R=round(x.cost_r.median(), 2),
                         tp2_share=round(x.tp2.notna().mean() * 100))
    return out


if __name__ == '__main__':
    combos = [('BTCUSDT', '15m'), ('BTCUSDT', '1h'), ('ETHUSDT', '1h')]
    res = {}
    for sym, s in combos:
        for v in ['ny', 'crypto', 'all']:
            tr = run(sym, s, v)
            g = run(sym, s, v, costs=False)
            tr['r_gross'] = g.r_net.values if len(g) == len(tr) else float('nan')
            tr.to_csv(f'cache/smc02_{sym}_{s}_{v}.csv', index=False)
            res[f'{sym} {s} {v}'] = summary(tr)
            print(sym, s, v, json.dumps(res[f'{sym} {s} {v}'], ensure_ascii=False), flush=True)
    json.dump(res, open('cache/smc02_summary.json', 'w'), ensure_ascii=False, indent=1)
