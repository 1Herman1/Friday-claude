# Deterministic quant gate — standalone, NOT wired

**Статус:** изолированный модуль `gate.py` и тесты. Не подключён к детектору,
LLM, исполнению, `risk.py`, БД или cron. Ничего не торгует и не ходит в сеть.
`engine/risk.py` остаётся единственным авторитетным кодовым риск-менеджером:
его APPROVE/REDUCE/REJECT, sizing, стопы, лимиты и kill-switch не изменены.
LLM — не риск-менеджер и не может переопределить результат quant gate.

## Контракт

```python
from engine.quant_gate.gate import evaluate

# evidence и policy передаёт доверенный код, не свободный ответ LLM.
decision = evaluate(evidence, policy, now=aware_datetime)
record = decision.to_dict()  # action + reasons[{code, field, message}]
```

- `APPROVE`: только пригодность предоставленных количественных доказательств;
  **не разрешение отправить ордер** и не доказательство будущей прибыльности.
- `HOLD`: нет метрик/политики, неверный тип, недостаточно сделок/покрытия,
  устаревшие или будущие котировки. Не торговать.
- `REJECT`: известное нарушение — неположительное матожидание после затрат,
  пересечение выборок, не та версия/тип исследования, недостаток глубины и т.д.
  Не торговать. При нескольких проверяемых нарушениях возвращаются все причины;
  REJECT приоритетнее HOLD. Ошибка схемы возвращает HOLD до итогового решения.
- Все финансовые числа — `Decimal`, decimal string или integer; float/bool,
  NaN/Infinity запрещены. До 38 значащих цифр и 18 дробных знаков.
  Арифметика изолирована от внешнего Decimal context. Время только timezone-aware,
  сравнивается в UTC; `now` обязателен, скрытых часов нет.

## Обязательная policy — без численных defaults

- `strategy_version`: непустой идентификатор версии; `mode`: `strategy` / `arbitrage`.
- `min_trades`: отдельные **явно утверждённые положительные integer**
  `backtest_oos` и `forward`. История не дополняет выборку форварда и наоборот.
  Это настраиваемый минимум, не статистическая гарантия и не универсальные «100».
- `min_net_expectancy_r`: неотрицательный порог; net должен быть **строго выше**.
- `required_sources`: непустой уникальный список обязательных источников.
- `min_source_coverage`: доля в `(0, 1]`, проверяется отдельно для каждого источника
  и каждого этапа, а не усредняется между ними.

## Обязательная evidence

- `training`: `start`, `end` периода подбора/обучения.
- `backtest_oos`, `forward`: каждый содержит `start`, `end`, `strategy_version`,
  `out_of_sample: true`, `trades`, `gross_expectancy_r`, `costs_r`, `sources`.
- `kind` строго `backtest` для `backtest_oos`, `forward` для `forward`.
  Исторический replay нельзя выдавать за forward. Периоды полуоткрытые `[start,end)`:
  `training.end <= backtest_oos.start`, `backtest_oos.end <= forward.start`;
  у каждого `start < end <= now`. Нужны **оба этапа**, нет объединённой метрики.
- `costs_r`: ровно `fees`, `slippage`, `funding`, `api`, каждый явно >= 0,
  включая явный ноль для неприменимого расхода. Все — средние затраты в R **на той
  же выборке и с тем же знаменателем**, что gross expectancy. Net = gross − сумма
  затрат. Кредиты не учитываются как отрицательные расходы (консервативно).
- `sources`: для каждого обязательного имени `expected` (integer > 0),
  `observed` (integer от 0 до expected). Это **уникальные валидные наблюдения**
  внутри соответствующего периода; дубли не повышают coverage.

## Дополнительно для arbitrage

Policy требует `max_quote_age_seconds` и `max_slippage_bps` (>= 0, cap **на ногу**),
`required_legs` (mapping минимум двух имён → `venue`, `symbol`, `side: buy/sell`,
`quantity > 0`). Количество — доверенное намерение, не заявка LLM.

Evidence требует `arbitrage` с `gross_edge_bps`, `costs_bps` (ровно `fees`,
`funding`, `transfer`, `api`, каждый явно >= 0) и `legs` с точным набором имён.
Каждая нога: совпадающие `venue`, `symbol`, `side`, `quote_at`, `slippage_bps`,
`available_depth_qty`, `depth_limit_bps`. Глубина должна быть реально доступной
на нужной стороне стакана **внутри** указанной полосы цены, не общим объёмом стакана.
Проверяются возраст каждой котировки, slippage <= cap, depth_limit <= cap,
slippage <= depth_limit и available_depth >= intended quantity.
Все edge/cost/slippage в bps должны быть приведены адаптером к общей базе notional.
Gross edge − все costs − сумма slippage всех ног должен быть > 0.
Арбитражный payload нельзя незаметно пропустить в режиме `strategy`.

## Интеграция: ещё НЕ сделана

В будущем доверенный adapter должен строить evidence из проверяемых прогонов,
форвардных fills и свежих стаканов, а policy брать из утверждённой read-only
конфигурации. Gate проверяет переданные метрики/периоды, но сам не удостоверяет
происхождение данных, отсутствие подгонки или достоверность агрегатов.

Вызов gate должен стать обязательным AND-условием в кодовом пути: только quant
APPROVE **и** успешная отдельная проверка `risk.py` (APPROVE/REDUCE с допустимым
объёмом) могут передаваться исполнителю. HOLD/REJECT любого gate блокируют вход;
LLM может лишь дополнительно отказаться, не разрешить обход. Нельзя кешировать
решение при смене версии, qty или стакана: после sizing проверять арбитраж для
окончательных количеств и обновлять quotes/depth непосредственно перед исполнением.
Риск одностороннего исполнения, остатки на площадках и атомарность здесь не решены.

Тестовые числа/площадки помечены SYNTHETIC: **это не реальные результаты стратегии**.
Реальный backtest/forward и допуск к live этим изменением не заявляются.

## Запуск проверок из prop-agents/

```sh
env -u PYTHONPATH .venv/bin/python -m pytest engine/quant_gate/test_gate.py engine/tests -q -p no:cacheprovider
```

TDD выполнен по срезам: отсутствие модуля → базовый fail-closed → expectancy/costs
→ разделение/sample/coverage → арбитражные ограничения → изоляция Decimal context.
Перед каждым срезом наблюдались реальные failing tests; затем запускались проверки.
