"""Ядро бэктеста: издержки, два типа стратегий, метрики.

Два типа:
- «весовые» (S1, S2, S4, бейзлайны): стратегия выдаёт целевую долю капитала по каждой монете на каждой
  закрытой свече; позиция вступает со СЛЕДУЮЩЕЙ свечи (без заглядывания вперёд). Комиссия — с оборота.
- «сделочные» (S3, S5, S6, S7): список сделок с входом, стопом, выходом; размер — от риска на сделку.

Издержки по умолчанию (Binance USDⓈ-M, базовый уровень): taker 0,05%, maker 0,02%, проскальзывание 0,02%
на сторону для рыночных исполнений. Итого рыночный круг ≈ 0,14%. Фандинг учитывается у весовых стратегий.
Числа здесь float — это исследование, не учёт денег (Decimal обязателен только в боевом контуре).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

TAKER = 0.0005
MAKER = 0.0002
SLIP = 0.0002
MARKET_SIDE = TAKER + SLIP  # 0,07% за сторону

SPLITS = {"2021–2023": ("2021-01-01", "2023-12-31"), "2024–2026.09": ("2024-01-01", "2026-09-30"),
          "Весь период": ("2021-01-01", "2026-09-30")}


# ---------- весовые стратегии ----------
def run_weights(weights: pd.DataFrame, closes: pd.DataFrame, funding: pd.DataFrame | None = None,
                side_cost: float = MARKET_SIDE) -> pd.DataFrame:
    """weights/closes: индекс = время закрытия свечи, колонки = монеты.
    Возвращает по свечам: ret (доходность счёта), gross, fee, fund, turnover."""
    w = weights.reindex(closes.index).fillna(0.0)
    held = w.shift(1).fillna(0.0)                      # решение на закрытии t → держим в (t, t+1]
    asset_ret = closes.pct_change(fill_method=None).fillna(0.0)
    gross = (held * asset_ret).sum(axis=1)
    turnover = (w - w.shift(1).fillna(0.0)).abs().sum(axis=1).shift(1).fillna(0.0)
    fee = turnover * side_cost
    fund = pd.Series(0.0, index=closes.index)
    if funding is not None:
        f = funding.reindex(closes.index).fillna(0.0)  # ставка, начисленная в интервале свечи
        fund = -(held * f).sum(axis=1)                 # лонг платит положительный фандинг
    ret = gross - fee + fund
    return pd.DataFrame({"ret": ret, "gross": gross, "fee": fee, "fund": fund, "turnover": turnover})


def funding_matrix(fund_by_sym: dict, index: pd.DatetimeIndex) -> pd.DataFrame:
    """Сумма ставок фандинга, попавших в каждый интервал свечи (свеча помечена временем закрытия)."""
    out = {}
    for s, f in fund_by_sym.items():
        ser = f.set_index("t")["rate"]
        b = pd.Series(index.searchsorted(ser.index, side="left"), index=ser.index)
        b = b[b < len(index)]
        agg = ser.loc[b.index].groupby(b.values).sum()
        col = np.zeros(len(index))
        col[agg.index.values] = agg.values
        out[s] = col
    return pd.DataFrame(out, index=index)


def vol_target(raw: pd.Series | pd.DataFrame, rets: pd.Series | pd.DataFrame, target: float,
               lookback: int, periods_per_year: int, cap: float):
    vol = rets.rolling(lookback, min_periods=lookback // 2).std() * np.sqrt(periods_per_year)
    scale = (target / vol).clip(upper=cap)
    return (raw * scale).fillna(0.0)


# ---------- сделочные стратегии ----------
def trades_to_daily(trades: pd.DataFrame, risk_pct: float, days: pd.DatetimeIndex) -> pd.Series:
    """Сделки с колонкой r_net (результат в R после издержек) и exit_time → дневная доходность счёта.
    Риск на сделку = risk_pct от equity (без сложного процента внутри дня)."""
    if trades.empty:
        return pd.Series(0.0, index=days)
    d = trades.assign(day=pd.to_datetime(trades["exit_time"]).dt.floor("D"))
    by_day = d.groupby("day")["r_net"].sum() * risk_pct
    return by_day.reindex(days).fillna(0.0)


def fees_in_r(entry: float, risk_abs: float, entry_maker: bool, exit_kind: str) -> float:
    """Издержки круга в R. exit_kind: 'tp' (лимитка, maker), 'sl' / 'time' (рынок)."""
    c_in = MAKER if entry_maker else MARKET_SIDE
    c_out = MAKER if exit_kind == "tp" else MARKET_SIDE
    return (c_in + c_out) * entry / risk_abs


# ---------- метрики ----------
def to_daily(ret: pd.Series) -> pd.Series:
    return (1 + ret).groupby(ret.index.floor("D")).prod() - 1


def metrics(daily: pd.Series, trades: pd.DataFrame | None = None) -> dict:
    daily = daily.dropna()
    if len(daily) < 30:
        return {}
    eq = (1 + daily).cumprod()
    years = len(daily) / 365.0
    cagr = eq.iloc[-1] ** (1 / years) - 1
    vol = daily.std() * np.sqrt(365)
    sharpe = daily.mean() / daily.std() * np.sqrt(365) if daily.std() > 0 else 0.0
    dd = (eq / eq.cummax() - 1).min()
    pos, neg = daily[daily > 0].sum(), -daily[daily < 0].sum()
    m = {
        "CAGR %": round(cagr * 100, 1), "Vol %": round(vol * 100, 1), "Sharpe": round(sharpe, 2),
        "MaxDD %": round(dd * 100, 1), "Худший день %": round(daily.min() * 100, 2),
        "PF (дни)": round(pos / neg, 2) if neg > 0 else None,
        "Calmar": round(cagr / -dd, 2) if dd < 0 else None,
    }
    # «при масштабе под проп»: какую годовую доходность даёт стратегия, если её урезать так,
    # чтобы историческая просадка была 4% (половина лимита 8%) и худший день ≤ 2,5% (половина 5%)
    if dd < 0:
        k = min(0.04 / -dd, 0.025 / max(-daily.min(), 1e-9))
        m["Доход/год при DD 4% %"] = round(daily.mean() * k * 365 * 100, 1)
    if trades is not None and len(trades):
        r = trades["r_net"]
        m.update({"Сделок": int(len(r)), "Winrate %": round((r > 0).mean() * 100, 1),
                  "Ср. R до изд.": round(trades["r_gross"].mean(), 3), "Ср. R после изд.": round(r.mean(), 3),
                  "PF (сделки)": round(r[r > 0].sum() / -r[r < 0].sum(), 2) if (r < 0).any() else None})
    return m


def split_metrics(daily: pd.Series, trades: pd.DataFrame | None = None) -> dict:
    out = {}
    for name, (a, b) in SPLITS.items():
        dsub = daily.loc[a:b]
        tsub = None
        if trades is not None:
            et = pd.to_datetime(trades["exit_time"])
            tsub = trades[(et >= pd.Timestamp(a, tz="UTC")) & (et <= pd.Timestamp(b, tz="UTC") + pd.Timedelta(days=1))]
        out[name] = metrics(dsub, tsub)
    return out
