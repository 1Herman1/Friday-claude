"""Прогон всех стратегий → отчёт в prop-agents/reports/backtests/<дата>/.

Запуск: cd trade-performance/prop-agents && .venv/bin/python engine/backtest/run_all.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import warnings
from datetime import date

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(__file__))

import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

import core  # noqa: E402
import strategies as S  # noqa: E402

RUNS = [
    ("S1", "Donchian-ансамбль, 15 монет, 1d", S.s1_donchian, {}),
    ("S2", "Интрадей тренд BTC/ETH, 1h", S.s2_intraday, {}),
    ("S3", "Максимум → тренд / минимум → отскок, BTC 1d", S.s3_maxmin, {}),
    ("S4", "TSMOM BTC/ETH, 1d", S.s4_tsmom, {}),
    ("S4L", "TSMOM BTC/ETH, только лонг", S.s4_tsmom, {"long_only": True}),
    ("S5", "Парная торговля, 15 монет, 4h", S.s5_pairs, {}),
    ("S6", "Против толпы на экстремальном фандинге, 1h", S.s6_funding, {}),
    ("S7", "SMC-BTC 5m v0.1, вход лимиткой", S.s7_smc, {"entry_maker": True}),
    ("S7T", "SMC-BTC 5m v0.1, вход по рынку", S.s7_smc, {"entry_maker": False}),
    ("B1", "Бейзлайн: купить и держать BTC", S.base_buyhold_btc, {}),
    ("B2", "Бейзлайн: SMA50/200 BTC", S.base_macross_btc, {}),
]

IS, OOS = "2021–2023", "2024–2026.09"


def verdict(sp, trades):
    a, b = sp.get(IS, {}), sp.get(OOS, {})
    sa, sb = a.get("Sharpe", -9), b.get("Sharpe", -9)
    ok_trades = True
    if trades is not None and len(trades):
        ok_trades = b.get("Ср. R после изд.", -1) > 0 and (b.get("PF (сделки)") or 0) >= 1.2
    if sa >= 0.5 and sb >= 0.5 and ok_trades:
        return "✅ проходит"
    if sa > 0 and sb > 0:
        return "🟡 на грани"
    return "❌ не проходит"


def fmt(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return "—"
    return f"{v:g}" if isinstance(v, (int, float, np.floating, np.integer)) else str(v)


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "..", "reports", "backtests", date.today().isoformat())
    os.makedirs(out, exist_ok=True)
    results, curves = {}, {}
    for code, name, fn, kw in RUNS:
        t0 = time.time()
        r = fn(**kw)
        sp = core.split_metrics(r["daily"], r["trades"])
        extra = {k: (float(v) if isinstance(v, (np.floating, np.integer)) else v) for k, v in r["extra"].items()}
        if r["trades"] is not None and len(r["trades"]):
            extra["Худшая сделка R"] = round(float(r["trades"]["r_net"].min()), 2)
            r["trades"].to_csv(os.path.join(out, f"{code}_trades.csv"), index=False)
        yearly = ((1 + r["daily"]).groupby(r["daily"].index.year).prod() - 1).mul(100).round(1)
        results[code] = {"name": name, "note": r["note"], "splits": sp, "extra": extra,
                         "yearly %": {int(k): float(v) for k, v in yearly.items()},
                         "verdict": verdict(sp, r["trades"]), "seconds": round(time.time() - t0, 1)}
        curves[code] = (1 + r["daily"]).cumprod()
        print(code, results[code]["verdict"], sp[OOS].get("Sharpe"), f"{results[code]['seconds']}s", flush=True)

    def clean(o):
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items()}
        if isinstance(o, (np.floating, np.integer)):
            return float(o)
        return o

    json.dump(clean(results), open(os.path.join(out, "results.json"), "w"), ensure_ascii=False, indent=1)

    # графики: кривые капитала
    fig, axes = plt.subplots(2, 1, figsize=(12, 9))
    for code in ["S1", "S4", "S4L", "S2", "B1", "B2"]:
        axes[0].plot(curves[code].index, curves[code].values, label=f"{code} {results[code]['name']}", lw=1)
    axes[0].set_yscale("log"); axes[0].set_title("Весовые стратегии (после комиссий и фандинга), лог-шкала")
    axes[0].legend(fontsize=7); axes[0].grid(alpha=.3)
    for code in ["S3", "S5", "S6", "S7", "S7T"]:
        axes[1].plot(curves[code].index, curves[code].values, label=f"{code} {results[code]['name']}", lw=1)
    axes[1].set_title("Сделочные стратегии, риск 0,5% на сделку (после издержек)")
    axes[1].legend(fontsize=7); axes[1].grid(alpha=.3)
    for ax in axes:
        ax.axvline(pd.Timestamp("2024-01-01", tz="UTC"), color="k", ls="--", lw=.8)
    plt.tight_layout(); plt.savefig(os.path.join(out, "equity.png"), dpi=110); plt.close()

    # markdown
    keys = ["Sharpe", "CAGR %", "MaxDD %", "Худший день %", "Доход/год при DD 4% %", "Сделок", "Winrate %",
            "Ср. R до изд.", "Ср. R после изд.", "PF (сделки)"]
    L = [f"# Бэктесты prop-agents — {date.today().isoformat()}", "",
         "Данные: Binance USDⓈ-M фьючерсы, 2021-01 — 2026-09 (data.binance.vision). Издержки: taker 0,05% + "
         "проскальзывание 0,02% на сторону (рыночный круг 0,14%), maker 0,02%; фандинг у весовых стратегий. "
         "Параметры взяты из источников (STRATEGIES.md), под нашу историю НЕ подгонялись. "
         f"Проверка устойчивости: отдельно {IS} и {OOS}.", "",
         "Критерий «проходит»: Sharpe после издержек ≥ 0,5 в обоих периодах; для сделочных ещё средний R после "
         f"издержек > 0 и PF ≥ 1,2 в {OOS}. «Доход/год при DD 4%» — годовая доходность, если урезать размер так, "
         "чтобы историческая просадка была 4% и худший день ≤ 2,5% (половина типичных лимитов пропа).", "",
         "![equity](equity.png)", "", "## Итог", "",
         "| Код | Стратегия | Вердикт | Sharpe 21–23 | Sharpe 24–26 | Sharpe весь | MaxDD % | Доход/год при DD 4% |",
         "|---|---|---|---|---|---|---|---|"]
    for code, r in results.items():
        sp = r["splits"]
        L.append(f"| {code} | {r['name']} | {r['verdict']} | {fmt(sp[IS].get('Sharpe'))} | {fmt(sp[OOS].get('Sharpe'))} | "
                 f"{fmt(sp['Весь период'].get('Sharpe'))} | {fmt(sp['Весь период'].get('MaxDD %'))} | "
                 f"{fmt(sp['Весь период'].get('Доход/год при DD 4% %'))} |")
    L += ["", "## По стратегиям", ""]
    for code, r in results.items():
        L += [f"### {code}. {r['name']} — {r['verdict']}", "", f"Правила: {r['note']}.", "",
              "| Метрика | " + " | ".join(r["splits"].keys()) + " |", "|---|" + "---|" * len(r["splits"])]
        for k in keys:
            if any(k in m for m in r["splits"].values()):
                L.append(f"| {k} | " + " | ".join(fmt(m.get(k)) for m in r["splits"].values()) + " |")
        L += ["", "Дополнительно: " + "; ".join(f"{k}: {fmt(v)}" for k, v in r["extra"].items()), "",
              "По годам, %: " + ", ".join(f"{y}: {v:g}" for y, v in r["yearly %"].items()), ""]
    open(os.path.join(out, "REPORT.md"), "w").write("\n".join(L))
    print("REPORT", os.path.abspath(out))


if __name__ == "__main__":
    main()
