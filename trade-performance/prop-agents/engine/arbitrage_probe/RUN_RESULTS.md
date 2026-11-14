# Проверка запуска

## Итог

**HOLD по всем четырём направлениям. Прибыльность не доказана; ордера не отправлялись.**

Последний фактический public API run: **2026-11-14 21:58:03.875 UTC** (на Mac/в MSK это уже 15 ноября). Дата не взята из старта разговора; timestamps сохранены по системным часам и ответам бирж.

- 11 HTTP-запросов, 2 проверенных USDT perpetual инструмента, 4 сравнения двух направлений.
- 10 успешных запросов, **1 частичный сбой**: `ETH_bitget_funding` — SSL handshake timeout. Данные не подменены ни фикстурой, ни предыдущим успешным funding.
- Оба стакана BTC получены, но их exchange timestamps расходятся на **9832 ms**. Возраст на момент отчёта: BingX **1818 ms**, Bitget **11650 ms**. Значит BTC дополнительно блокирован `STALE_BOOK` и `BOOK_SKEW`; положительный «спред» здесь может отражать рассинхрон, а не доступную сделку.
- Для ETH возраст стаканов **131/55 ms**, skew **76 ms**. Эти пороги прошли, но fees, exit costs, funding и исполнение не подтверждены.

## Значения последнего снимка

Денежные величины ниже — USDT, **только вход, до комиссий и закрытия**, одинаковое base quantity:

| Инструмент / количество | Купить → продать | Buy ask VWAP | Sell bid VWAP | Gross entry USDT | Depth spread bps |
|---|---|---:|---:|---:|---:|
| BTC 0.01 | BingX → Bitget | 64449.6 | 64418.1 | -0.315 | -4.887540031280256200193640000 |
| BTC 0.01 | Bitget → BingX | 64418.2 | 64449.3 | +0.311 | +4.827828160364617452831650000 |
| ETH 0.1 | BingX → Bitget | 1773.964 | 1773.84 | -0.0124 | -0.6989995287390273985266890000 |
| ETH 0.1 | Bitget → BingX | 1773.85 | 1773.92 | +0.007 | +0.394621867688925219156070000 |

**Не считать строки с плюсом прибылью или командой торговать.** BTC stale/skew; у ETH знак net неизвестен, потому что account fees и стоимость выхода не заданы. Никакого тарифа аккаунта не предположено: `entry_fee_quote=null`, `entry_after_fees_quote=null`, `FEES_UNKNOWN`.

Funding нормализован лишь для реально полученных ставок с явным интервалом. Для недоступного ETH Bitget нет нормализованной межбиржевой разности. Никаких APY/гарантий дохода нет.

## Предыдущие обращения

- `report.first-partial.json`: **21:47:57.025 UTC**, BTC BingX depth SSL timeout; только 2 ETH comparison rows, без синтетического BTC.
- Успешный сбор **21:52:53.690 UTC**, все 11 запросов без HTTP/API errors, сохранён для автономного replay в `fixture_public.json` (только выбранные контракты). BTC и тогда был stale/skew: успешный HTTP не равен пригодному snapshot.
- Исследование Hummingbot через GitHub API: проверка **21:54:10 UTC**; Apache-2.0, не archived/disabled, pushed **2026-11-13T16:17:13Z**. Детали/первичные URLs в `oss_research.json` и README.

## Тесты и независимая проверка

`env -u PYTHONPATH ../../.venv/bin/python -m unittest -v test_probe`

**9 tests, OK**. Проверены Decimal VWAP с несколькими уровнями/недостатком глубины, ask-buy/bid-sell, fees unknown и явные fees, stale/skew/future clock, интервал funding без fallback, JSON Decimal, API rejection, partial failures без синтетических данных, rate-limit spacing BingX, replay реальной записи с семантикой funding update/settlement, nonfinite/negative depth.

После фактического запуска отдельные assert-проверки повторно прочитали `report.json` и `report.html`: 11 сохранённых request records, 4 comparison rows, exact Decimal-равенство `quantity × (sell_vwap − buy_vwap)`, везде HOLD/FEES_UNKNOWN/null net, `execution_enabled=false`, язык HTML ru и совпадающий timestamp. GitHub metadata также перечитана: Apache-2.0 и `tree_truncated=false`.

## Осталось за пределами probe

Account tariffs/permissions, документы по полной единице глубины, все min-notional/max-position checks, clock synchronization, потоковый causal order book, совместный latency budget, pre-funded margin/inventories, hedge/unwind на partial fills, reconciler и реальный round-trip/carry P&L. Никакая из этих неизвестностей не заменена обещанием «бот будет зарабатывать». Запуск автоматической торговли не разрешён и не включён.
