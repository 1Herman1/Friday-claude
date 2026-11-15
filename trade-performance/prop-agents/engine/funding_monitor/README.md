# Funding monitor — публичный discovery, без исполнения

Изолированный stdlib Python collector. Только публичные GET, без ключей, чтения `.env`, ордеров и платных API. Переменные окружения с ключами не читаются; proxy из окружения отключён. Не меняет scanner/arbitrage_probe. Сканирует весь возвращённый активный USDT perpetual universe, а не BTC/ETH whitelist. Ликвидность **UNKNOWN**: альткоин не означает низкую ликвидность.

## Запуск

Из `prop-agents/`:

```sh
env -u PYTHONPATH .venv/bin/python engine/funding_monitor/monitor.py --once
env -u PYTHONPATH .venv/bin/python engine/funding_monitor/monitor.py --interval 60
```

Второй вариант — непрерывный foreground polling. При сдаче daemon **не запущен**. `--interval` — пауза после завершения цикла, минимум 15 секунд; каждый GET имеет timeout 12 секунд, между GET пауза 0.25 секунды, всего 10 bulk GET за цикл, без сотен per-symbol запросов. Не запускать несколько writer-процессов в одном `--out`.

## Наблюдать настоящий процесс во время запросов

- `out/progress.json` атомарно публикуется **до каждого запроса**, после получения/ошибки, после каждого источника и в конце.
- Поля: `running`, `run_id`, `started_at`, `updated_at`, `current_venue`, `sources`, `events`, `previous_snapshot_at`, в конце `completed_at/status`.
- `sources[].status` во время работы = `running`, затем `ok|partial|error`; события содержат реальные URL, получение данных, ошибки.
- `out/events.jsonl` — append-only история реальных событий. Те же события идут в stdout.
- `out/latest.json` остаётся последним **полным** snapshot во время следующего опроса; в sidecar явно указан его `previous_snapshot_at`. UI должен читать ОБА файла, иначе не покажет реальную текущую работу. Если процесс принудительно убит, `running` может остаться true: UI должен проверять давность `updated_at`/процесс, не выдавать вечный RUNNING за доказанный живой процесс.
- После завершения атомарно заменяется `latest.json`, затем `progress.running=false`. Исходный контракт latest v1 сохранён; текущий процесс вынесен в разрешённый sidecar, не добавлен новый статус в latest.

## Данные и ограничения

`funding_rate` — строка Decimal **доля**, например `0.01` = 1%, не 0.01%. Нулевой funding сохраняется только при явном нуле API; отсутствующее/нечисловое значение = null. Неизвестный интервал = null (UNKNOWN), **нет fallback 8h**. `rate_per_hour` вычисляется только при известном положительном интервале. Observations упорядочены по абсолютной ставке за settlement. Отдельная сортировка по абсолютной ставке/час приведена в verification.json; UI может сортировать `rate_per_hour`, исключив null.

Universe фильтруется по metadata: BingX status=1/open API/USDT, Bitget normal+perpetual+USDT margin, Gate direct+trading+не delisting/pre-market, Binance TRADING+PERPETUAL+USDT quote/margin, OKX live+linear+USDT settle+SWAP. Некоторые площадки включают RWA/индексы: это не утверждение, что все инструменты — криптоальткоины. Объём и account-specific доступность не проверены.

`asset_id` — точная строка base из metadata/структуры native symbol. **1000PEPE не превращается в PEPE**, алиасы, переименования и коллизии не склеиваются. Cross-venue пары — кандидаты по точному ticker, не сертификация идентичности токена: `identity_status=EXACT_TICKER_ONLY_UNVERIFIED`, у всех пар `TOKEN_IDENTITY_AND_UNITS_UNVERIFIED`. Gate `quanto_multiplier` и OKX `ctVal` сохранены; у прочих неизвестно. Никакой нормализации размера позиций/хеджа без сертифицированного mapping. Даже одинаковый ticker может скрывать коллизию — ручная идентификация обязательна.

Пары при известных интервалах выбирают short с более высокой **ставкой в час**, long с более низкой. Сначала приводим обе ставки к одному временному горизонту, а не сравниваем 1h с 8h напрямую. При неизвестном интервале направление по сырой ставке — только невалидированный кандидат с `INTERVAL_UNKNOWN`, без нормализованного результата. `indicative_diff_per_hour = short_rate/short_interval - long_rate/long_interval`, это арифметическая индикация, не прогноз cashflow/доходности. Неравные интервалы и времена выплат отмечаются отдельными reasons, неизвестные времена/интервалы тоже. **Все пары HOLD**: ликвидность, идентичность, account fees, выход и slippage не проверены; нет net profit/APY/«зафиксированного дохода».

## Первичные источники и единицы

- BingX официальный API reference: https://github.com/BingX-API/api-ai-skills/blob/main/skills/swap-market/api-reference.md — bulk contracts и premiumIndex без symbol; lastFundingRate decimal, fundingIntervalHours часы, nextFundingTime ms. Сохранён `research/docs-bingx.txt`.
- Bitget: https://www.bitget.com/api-doc/contract/market/Get-Current-Funding-Rate и актуальный каталог https://bitget.com/docs/catalog/market/derivatives — fundingRate доля, fundingRateInterval часы, nextUpdate ms. В коде публичный v2 bulk, реально проверен; fundInterval metadata допускается только если API явно вернул его.
- Gate: https://www.gate.com/docs/developers/apiv4/en/futures/ — `/futures/usdt/contracts` одновременно universe/funding; funding_rate доля; funding_interval **секунды**, funding_next_apply Unix seconds → ms; quanto_multiplier единиц base на контракт.
- Binance: https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Mark-Price — premiumIndex bulk; https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-Info — fundingInfo содержит только инструменты с изменёнными funding параметрами. Если символ отсутствует, интервал неизвестен, НЕ 8h. На данном запуске все отфильтрованные активные символы имели явный interval.
- OKX: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate — `instId=ANY` bulk; fundingRate прогноз текущего upcoming settlement, `fundingTime` — ближайшая выплата, `nextFundingTime` — следующая за ней. Интервал = (nextFundingTime−fundingTime)/3600000, не фиксированные 8h.
- CoinGlass не интегрирован: официальный `/api/futures/funding-rate/exchange-list` требует платный API key. Его процентные поля нельзя смешивать с долями биржевых API. Нет выдуманного бесплатного источника.

Поиск первичной документации сохранён в `research/primary-doc-search.json`. Web extract backend оказался search-only; для BingX получен raw официальный reference напрямую. Нативные ответы/ошибки API — `out/raw/<run_id>/`, provenance manifest: URL, request/receive UTC, SHA256, размер, filename/error. Начальные исследовательские GET лежат отдельно в `research/`, не подменяют рабочий snapshot.

## Реальный запуск и replay

Проверено 15.11.2026, **15:19:59.498887–15:20:21.884098 UTC**, run `20261115T151959.499017Z`:

- BingX: 828 активных observations, Bitget: 885, Gate: 1036, Binance: 522, OKX: 528.
- Всего **3799 observations**, **4530 indicative exact-ticker pair candidates**, все HOLD. Все 5 источников status=ok; funding matched у всех observations; неизвестных интервалов в этом конкретном snapshot 0.
- Ставок с абсолютным значением ≥1% в этом snapshot **0**. Максимум: BingX SOPH-USDT `-0.00903700` (−0.9037%) за 1h. Наличие 1–2% не выдумывается; последующие циклы могут отличаться.
- `out/verification.json` / `verification.log`: точные счётчики, top settlement/hourly, replay_exact=true. Raw SHA256 проверены; replay даёт **побайтово эквивалентные после JSON parse observations/pairs**.

Из этой директории:

```sh
env -u PYTHONPATH ../../.venv/bin/python -m unittest -v
env -u PYTHONPATH ../../.venv/bin/python monitor.py --replay out/raw/20261115T151959.499017Z
env -u PYTHONPATH ../../.venv/bin/python verify_run.py
```

5 тестов (после родительской доработки): знаки/явный ноль/пустые поля/NaN/неизвестные интервалы; unequal intervals/timing и 1000PEPE != PEPE; нормализация сохранённых настоящих bulk ответов; настоящий pipeline с инъекцией outage (только тест) и наблюдением progress во время вызова, сохранением предыдущего snapshot и точным replay; отдельная регрессия выбора LONG/SHORT на одинаковом часовом горизонте. Первичный `test-results.txt` содержит исходные 4 теста. Актуальная родительская проверка и запущенная витрина — `INTEGRATION.md` и `evidence/`.
