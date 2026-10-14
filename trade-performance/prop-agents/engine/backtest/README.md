# engine/backtest — бэктесты стратегий

```bash
cd trade-performance/prop-agents
env -u PYTHONPATH .venv/bin/python engine/backtest/download_all.py   # данные в engine/backtest/cache/ (один раз, ~5 мин)
env -u PYTHONPATH .venv/bin/python engine/backtest/run_all.py        # отчёт → reports/backtests/<дата>/REPORT.md + equity.png
```

- `data.py` — свечи и фандинг Binance USDⓈ-M с data.binance.vision (без ключа), 2021-01 — 2026-09, кэш в `cache/` (в .gitignore).
- `core.py` — издержки (taker 0,05% + проскальзывание 0,02% на сторону, maker 0,02%), весовой и сделочный симуляторы, метрики, разбивка 2021–2023 / 2024–2026.
- `strategies.py` — S1–S7 и бейзлайны; параметры из источников (`../../STRATEGIES.md`), без подгонки.
- `run_all.py` — прогон всех, вердикт, отчёт.

Правила честности: решение на закрытии свечи → позиция со следующей свечи; если в одной свече и стоп и тейк — считаем стоп; лимитка считается исполненной при касании (оптимистично — для S7 это завышает результат).

Грабли: `PYTHONPATH` из окружения Hermes подсовывает чужой PIL (python 3.14) → matplotlib падает; запускать через `env -u PYTHONPATH`.
