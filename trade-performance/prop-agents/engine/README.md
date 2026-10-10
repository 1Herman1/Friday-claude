# engine — риск-слой (Risk Gate)

`risk.py` — чистый модуль без сети и БД. Получает сигнал, состояние счёта, профиль пропа и лимиты стратегии. Возвращает решение `APPROVE` / `REDUCE` / `REJECT`, размер позиции (`qty`), плечо, риск в $ и причины.

Проверки по порядку: kill-switch (флаг в `limits.yaml` или файл `engine/KILL_SWITCH`), есть ли лимиты стратегии, совпадает ли площадка, разрешена ли автоматизация на пропе, whitelist, стоп (обязателен и стоит с правильной стороны), тейк, R:R ≥ `min_rr` (по первому тейку), макс. позиций и макс. в одну сторону, макс. сделок в день, пауза после серии убытков. Дальше считается размер: `риск% × equity / расстояние до стопа`, вниз до шага лота, не меньше мин. объёма. Потом идут ограничения: макс. плечо, дневной лимит потерь и общая просадка с учётом риска открытых позиций и новой сделки. Если сделка влезает только урезанной — `REDUCE`. Если не влезает даже минимальный объём — `REJECT`.

- Из пары «профиль пропа / стратегия» берётся более строгий лимит.
- `null` в профиле означает «нет данных». Тогда берётся строгий вариант: метод дневного лимита `max(баланс, equity на начало дня)`, тип просадки `trailing`, `automation_allowed: null` → отказ.
- Дневной пол: `база − база × daily_loss_pct`.
- Просадка: `static` — `начальный баланс × (1 − pct)`; `trailing` — `пик equity − начальный баланс × pct`.

## Лимиты и профили

- `limits.yaml` — лимиты стратегий, kill-switch, спецификации инструментов. **Меняет только Герман.**
- `profiles/*.yaml` — профили площадок: `demo` (мягкий, наш) и пропы (`propr`, `hyrotrader`, `sizeprop`, `breakout`, `hashhedge`). Значения взяты только из `../research/props-and-testbeds.md`. Где данных нет — `null  # проверить по T&C`.
- Загрузка возвращает read-only `MappingProxyType`. API для изменения лимитов нет.

## Вызов

```python
from risk import Signal, Account, Position, evaluate, load_profile, load_limits

sig = Signal(side="long", entry=60000, sl=59700, tp=60600, symbol="BTCUSDT", venue="demo", strategy="smc-btc")
acc = Account(equity=10000, initial_balance=10000, day_start_balance=10000, day_start_equity=10000,
              open_positions=[], trades_today=0, loss_streak=0, last_loss_time=None)
d = evaluate(sig, acc, load_profile("demo"), load_limits())
print(d.action, d.qty, d.leverage, d.reasons)
```

`tp` — число (как в `smc_detector.py`) или список. `Position.risk` — сколько $ потеряет открытая позиция по стопу. Время передаётся в UTC (`now=`, по умолчанию `utcnow`).

## Тесты

```bash
cd trade-performance/prop-agents
.venv/bin/pip install pytest pyyaml   # один раз
.venv/bin/python -m pytest engine/tests -q
```
