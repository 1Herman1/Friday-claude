# READ-ONLY: BingX ↔ Bitget, USDT perpetual

**Это индикативный снимок рынка, не исполнимый сигнал и не бот, который «зарабатывает». Всегда HOLD.**
Нет ключей, account endpoints, ордеров, переводов, cron, установки Hummingbot или зависимостей. Только стандартная библиотека Python 3.9+. Изменения ограничены этой папкой.

## Запуск

Из этой папки:

```sh
env -u PYTHONPATH ../../.venv/bin/python -m unittest -v test_probe
env -u PYTHONPATH ../../.venv/bin/python runner.py
```

Объёмы снимка по умолчанию — **0.01 BTC и 0.1 ETH**, одинаковое количество базовой монеты на обеих ногах. Это параметры измерения, не рекомендация размера позиции. Можно явно задать `--btc-qty` и `--eth-qty`.

Комиссии аккаунта **неизвестны**, пока пользователь явно не передал `--bingx-fee` и `--bitget-fee` (десятичная доля, не проценты). Не подставляйте примерные тарифы. Публичные `takerFeeRate` из спецификации сохраняются только как raw metadata: они **не считаются тарифом вашего аккаунта**. Если хотя бы одна комиссия неизвестна, `entry_after_fees_quote=null` и `FEES_UNKNOWN`.

Файлы:
- `probe.py` — Decimal, нормализация стакана, VWAP и fail-closed сравнение;
- `runner.py` — одноразовый сбор public GET, JSON и русская HTML-страница;
- `test_probe.py` — unit/replay tests;
- `fixture_public.json` — реально полученные ответы для автономного replay; общий список BingX сокращён до BTC/ETH без изменения значений;
- `report.json`, `report.html` — последний запуск, raw responses, URLs, timestamps, RTT, ошибки;
- `report.first-partial.json` — первый запуск: один SSL timeout при запросе BTC BingX, без выдуманного замещения;
- `oss_research.json` — проверка GitHub API и выводы по Hummingbot;
- `docs_verified.json` — проверенные первоисточники и оговорки по полям;
- `RUN_RESULTS.md` — проверенные результаты конкретных запусков.

Запуск перезаписывает только `report.json` и `report.html` в этой папке. Тесты не выходят в сеть и не требуют ключей; replay использует сохранённую реальную запись. Внешние изменения в общем репозитории не затрагиваются.

## Что сравниваем

Только BTC и ETH, линейные **USDT-settled perpetual**, не spot, не delivery и не COIN-M. Метаданные BingX проверяются по perpetual swap namespace, точному `symbol`, `asset`, `currency`, активному статусу. Bitget — дополнительно по `category=USDT-FUTURES`, `type=perpetual`, `baseCoin`, `quoteCoin`, `status=online`. При отсутствии/несовпадении спецификаций сравнения не строятся. Контракты площадок не юридически идентичны: index/mark, margin и liquidation rules могут отличаться.

Для каждого направления:
1. Покупка только по **ask**, продажа только по **bid**, никогда last/mid.
2. VWAP потребляет видимые уровни до одного и того же base quantity; нехватка глубины = HOLD, без экстраполяции.
3. `gross_entry_quote = quantity × (sell_vwap − buy_vwap)`; bps = `(sell_vwap / buy_vwap − 1) × 10000`.
4. При явных комиссиях вычитаются **только два входных taker fee**, по отдельным notionals каждой ноги. Это НЕ round-trip P&L; стоимость и basis закрытия неизвестны.
5. JSON-number цены/объёмы разбираются сразу как Decimal; денежные значения JSON сохраняются строками. Float не участвует в расчёте цены/объёма/комиссий.

BingX используются реально возвращённые `asksCoin/bidsCoin` (явные coin-массивы), без умножения на contract `size`. Эти дополнительные поля не перечислены в кратком официальном markdown-reference; это ограничение схемы зафиксировано в `docs_verified.json`. Если их нет, сбор завершается ошибкой конкретного стакана, без тихого перехода к неизвестной единице. Bitget USDT-FUTURES quantity трактуется как base coin в рамках его линейной спецификации. До исполнения единицы стаканов нужно отдельно подтвердить полным контрактным тестом площадки. Lot precision/min quantity проверяются, но max position/min notional/account margin/API eligibility и все торговые ограничения не сертифицированы.

## Время и funding

- Возраст стакана: локальный `evaluated_at_ms − exchange book timestamp`; book timestamp — `T` BingX / `ts` Bitget, не HTTP requestTime.
- HOLD при возрасте > **5000 ms**, межбиржевом skew > **1000 ms**, будущем timestamp более чем на **1000 ms**. Пороги — консервативная политика диагностики, не биржевой SLA. Отрицательный малый возраст возможен из-за рассинхронизации часов; offset не корректируется автоматически.
- Сохраняются начало/конец каждого HTTP GET, RTT, server HTTP Date. REST не обеспечивает атомарный снимок или будущую доступность уровня.
- BingX depth: соблюдается документированный лимит **1/s/IP**: площадки одного инструмента запрашиваются параллельно, инструменты последовательно с паузой. Метаданные/funding собираются до стаканов. Общий IP может использоваться другими приложениями, квоты не эксклюзивны. При timeout другого инструмента ранее полученные стаканы могут стать stale — это явно блокируется, не скрывается.
- Funding: `rate_per_hour = published_rate / explicitly_reported_interval_hours` **только когда интервал известен и >0**. Нет fallback «8 часов» и нет APY/обещания выплат.
- BingX: `lastFundingRate`, `fundingIntervalHours`, `nextFundingTime`, `updateTime`. Bitget: `fundingRate`, `fundingRateInterval`, `nextUpdate`. Последнее по документации — время следующего **обновления ставки**, а не гарантия settlement; семантика помечена отдельно.
- Funding timestamps, source age (если биржа отдаёт updateTime), HTTP receive time и интервалы сохраняются. Формальная разность «short rate/hour − long rate/hour» — только арифметика текущих опубликованных ставок, без подтверждённого cashflow. Разные моменты обновления/settlement, изменяющиеся ставки и eligibility означают `FUNDING_NOT_LOCKED_OR_TIME_ALIGNED`. Funding не складывается со спредом и не отменяет HOLD.

## Почему «быстро купить здесь / продать там» — не последовательный перевод

Для двух perpetual-ног нужна **заранее размещённая маржа на обеих биржах**; для spot/другого варианта — соответствующие заранее размещённые cash/coin inventories либо заранее проверенный borrow. Перевод после покупки не является быстрой второй ногой: за время сети/депозита цена уйдёт, останутся fees и риск блокировки.

Даже с запасами две API-операции не атомарны. Одна нога может исполниться, другая — нет; возможны partial fills, slippage, rate limits и разрыв соединения. Далее нужны hedge/unwind policy, reconciliation, position/account limits и отдельные kill-switches. Дельта-нейтральность не устраняет basis, mark/index divergence, liquidation, funding reversal, exchange/custody и USDT риск. Этот probe **ничего из этого не исполняет**.

## OSS: Hummingbot — только reference/reuse после проверки

Primary GitHub API: https://api.github.com/repos/hummingbot/hummingbot

На сохранённой проверке: **Apache-2.0**, `archived=false`, `disabled=false`, последний `pushed_at=2026-11-13T16:17:13Z`. Точное время проверки, stars и tree SHA находятся в `oss_research.json`; популярность не доказывает прибыльность.

Проверен полный, не усечённый tree commit `9af100d6822da7d2d0291a906c730ef172284ee2`:
- Есть Bitget perpetual connector: https://github.com/hummingbot/hummingbot/tree/9af100d6822da7d2d0291a906c730ef172284ee2/hummingbot/connector/derivative/bitget_perpetual
- `bing_x` — **spot**, что подтверждено его `/openApi/spot/...` REST paths: https://github.com/hummingbot/hummingbot/blob/9af100d6822da7d2d0291a906c730ef172284ee2/hummingbot/connector/exchange/bing_x/bing_x_constants.py
- BingX futures connector в проверенном tree не найден. Нельзя считать связку BingX perpetual ↔ Bitget perpetual готовой «из коробки».
- Funding sample: https://github.com/hummingbot/hummingbot/blob/9af100d6822da7d2d0291a906c730ef172284ee2/scripts/v2_funding_rate_arb.py

Полезно изучить funding-payment event tracking, paired position executors и lifecycle. **Не переносить вслепую:** в sample есть fallback интервала к 8 часам для неизвестного connector; `trade_profitability_condition_to_enter` по умолчанию false; default connectors — Hyperliquid/Binance, не BingX. Скрипт задаёт leverage/position mode и создаёт реальные executor actions: это не безопасный read-only пример. Ничего из Hummingbot не установлено и не запущено; прямого копирования его кода нет. Для reuse учитывать Apache-2.0 notices, лицензии отдельных файлов/зависимостей, покрытие adapter-тестами и официальные API terms.

## Проверенные docs

- BingX official organization reference, public swap endpoints + отсутствие auth, funding interval units и rate limits: https://github.com/BingX-API/api-ai-skills/blob/12d03531602f6b7d63b14e2cb73b11a737ce74c5/skills/swap-market/api-reference.md
- BingX official API portal: https://bingx-api.github.io/docs/#/en-us/swapV2/market-api.html
- Bitget v3 instruments/order book: https://www.bitget.com/docs/catalog/market/market-data
- Bitget v3 funding, interval in hours и nextUpdate semantics: https://www.bitget.com/docs/catalog/market/derivatives

Прямой HTML fetch Bitget возвращал 403. Актуальная документация успешно прочитана через браузер (включая embedded OpenAPI schema / document.body.textContent); это не пересказ стороннего блога. Некоторые GitHub/BingX GET давали SSL timeout; успешные повторные обращения и частичные неудачи различаются, выдуманных ответов нет.
