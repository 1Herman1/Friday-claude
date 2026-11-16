# Strategy Observatory — read-only адаптеры

## Граница ответственности

`GET /api/strategy-observatory` возвращает контракт `schema_version: 1`, `read_only: true`, `execution_enabled: false` и **ровно пять** панелей: `funding`, `smc`, `pump`, `donchian`, `tsmom`. Торговля, изменение риска, настройка LLM, запуск коллекторов и запись в БД отсутствуют. Наличие Python-кода, сохранённого результата или DB mode `LIVE` не доказывает работающий процесс либо реальные заявки.

Все относительные файловые источники ниже отсчитываются от `trade-performance/prop-agents`. Root в HTTP route фиксирован относительно рабочего каталога существующего Next-приложения; URL-параметры не используются как пути. `buildObservatory(root, now, stored)` допускает isolated fixture root только для программных тестов, не для HTTP пользователя.

## Источники и доказанные количества

Проверка 16.11.2026: `node src/app/api/strategy-observatory/verify-real.mjs 131` завершилась успешно; полный цикл HTTP + независимое чтение файлов занял **101 ms**. Отдельные warm HTTP запросы: **60–62 ms**. Funding меняется между poll, поэтому числа ниже — наблюдённый snapshot, не константы продукта.

- **Funding**: `engine/funding_monitor/out/latest.json`: **4100 observations**, **4534 ticker-only pairs** в проверенном завершённом snapshot. `progress.json` читается отдельно: текущий run, running, updated_at и биржа не заменяют completed_at/статус завершённого run. Текущие и завершённые события сохранены отдельно по их stage/time в общей ленте. Первые 100 пар доступны как строки и drilldown; `total_rows` — весь массив pairs. Не рассчитываем net PnL, APR или неизвестный funding interval; ставки и indicative diff сохраняются строками. HOLD: не сертифицированы liquidity, token units/identity, fees, exit risk. Статус collection error/partial сохраняется. Порог fresh — 180 секунд.
- **SMC preview**: `clusters/smc-btc/preview-v03/20261111-btc-all/report.json`: **71** кандидат, **20** preview eligible, **0 production eligible**, **1920** свечей. MEXC_SPOT saved, не BingX futures. История свечей 22.10–11.11.2026; preview audit фиксирует evaluation_from 30.10.2026 после warmup. Здесь не придумываются PnL/curve/fills. Context, window, stop tick rounding и position-engine остаются блокерами.
- **SMC legacy**: `clusters/smc-btc/out/setups_live.json`: **19** сохранённых v0.1 сетапов; `last_signal.json` отдельно показывает дату обнаружения и может быть старее последнего setups_live. `win/loss/cancelled` — статусы симуляции/детектора, не verified fills. Панель содержит **90** source rows (71 preview + 19 legacy).
- **SMC audit**: `engine/smc_audit/results/legacy_summary.json`: **9** конфигураций, каждая отдельный audit candidate (итого candidates **99** вместе с preview/legacy). `preview_summary.json`: **9** конфигураций. Legacy flags раскрывают отсутствие fresh IFVG crossing, previously inverted gaps, causal target/lookahead и TP1→BE OHLC ambiguity. Полные candidate JSONL, включая ~156 MB, **вообще не открываются**. Audit — воспроизведение старого кода, не доказательство отрицательного edge новой карточки. Агрегаты summary не суммируются как независимые сделки.
- **Pump primary**: существующий `journal/web/src/server/signals.ts::signalList('pump-mexc', false)`, SELECT-only, LIMIT 200. Получено **131** сохранённое событие; независимое **131** передано координатором после его read-only SQL count. Верификатор требует этот отдельный count аргументом, не выдаёт совпадение rows.length за независимую DB проверку. `MEXC`, `SAVED_SIGNALS`, stale по последнему setup_time; не BingX live. Whitelist entry/stop_loss/tp/simulated_r/rise/max_drop/max_up/mode/status; private trade_id/trade_n/trade_net не возвращаются. `simulated_r` не личная прибыль. При ровно 200 строках полнота явно неизвестна.
- **Pump fallback/proxy**: `engine/scanner/artifacts/live/snapshot.json`: **24** строк ±20% rolling-24h, в том числе **3 pump**, **21 dump** в этом конкретном `live` snapshot. Это не числа старого evidence (там было 22 dump). Фильтр читает реальные saved flags, не переименовывает его в стратегию шорта ≥50%. DB timeout/error/empty → PREVIEW proxy + `REAL_PUMP_FEED_MISSING`; ошибка DB видна. Порог stale proxy — 300 секунд. При DB primary proxy используется лишь как справочная инвентаризация в facts.
- **Donchian S1**: `reports/backtests/2026-10-14/results.json`, `REPORT.md`, код `engine/backtest/strategies.py::s1_donchian`: **3** строки/split, 2021–2023, 2024–2026.09, весь 2021.01–2026.09. Sharpe всего **0.81**, MaxDD **-25.9%**. Дневной long/flat ансамбль 20/40/80/160, 15 монет; survivorship bias корзины. Нет live executor/forward.
- **TSMOM**: тот же results.json, `s4_tsmom`, привязка вариантов в `run_all.py`: **6** строк (3 split × S4/S4L), **2** действительных saved варианта. S4 long-short Sharpe всего **0.61**, MaxDD **-14.1%**; S4L long-only **0.95**, **-8.8%**. Не усредняем варианты и не смешиваем их цифры.

Для S1/S4/S4L источник — сохранённый Binance USDⓈ-M futures backtest, data.binance.vision, январь 2021–сентябрь 2026. Costs из REPORT: taker 0.05% + slippage 0.02% на сторону, maker 0.02%, funding включён у весовых стратегий. Точные per-bar evaluation/warmup даты в results.json отсутствуют: не выдумываем их. Исторический «проходит» не live approval. Yearly 2026 — только январь–сентябрь. Доход/год при DD4% — исторический масштабированный сценарий, не прогноз.

## Защиты / пропуски

- Whitelist из 9 фиксированных путей; лимиты bytes: latest funding 8 MB, progress 150 KB, SMC preview/legacy по 300 KB, last_signal 50 KB, audit summaries по 100 KB, scanner 2 MB, backtest results 150 KB.
- lstat каждого сегмента ниже root + `O_NOFOLLOW` final open; regular-file check, bounded read max+1, отсутствующие/нечитаемые/schema-invalid/invalid JSON/oversize/symlink — явные source blockers. Не защищает от злоумышленника, который одновременно переименовывает доверенные ancestor directories; такой concurrent filesystem adversary вне модели локальной витрины.
- JSON numeric lexemes преобразуются в строки до JSON.parse, без float roundtrip денег. Выдаётся whitelist полей, строки до 500 символов, без control chars и angle brackets. Raw DB errors, URL подключения, env и приватные суммы не возвращаются.
- DB reader подключается только в route через dynamic import: таймаут ответа 900 ms, не более одного in-flight reader на экземпляр модуля. Таймаут не отменяет чужой pool query; пока он не закончен, новые дубли не создаются. Не изменяем shared DB pool/config.
- Source freshness ≠ liveness ОС-процесса; timestamps будущего более минуты также считаются stale. Historical BACKTEST_ONLY сохраняется saved, а не выдаётся за текущий feed.
- S2/S3/S5/S6 и baselines есть в historical catalog, но не входят в согласованный registry пяти семей, не объявлены работающими агентами. S6 funding-contrarian не подменяет funding-discovery; его исторические отрицательные результаты не используются как данные discovery.
- SMC DB source с 66 сигналами (наблюдение координатора) здесь не подключён: есть отдельные файловые legacy источники и аудит. Поэтому **19 файловых сетапов ≠ 66 DB signals**, не заявляется полнота всех доставок. Нет запросов к private trades, кроме неизменённого существующего SELECT reader, который возвращает дополнительные поля; эти поля whitelist отбрасывает.

## Родительская финальная revision 17.11.2026

После исходного исполнения добавлены RED→GREEN регрессии: точный split-период/направление в historical inspector и явная область whole-period расходов; текущий свежий progress отражается RUNNING на стадии данных, не изменяя возраст завершённого dataset. Актуальные проверки: **7 backend + 4 UI helper = 11 PASS**, tsc/scoped ESLint PASS. Витрина теперь всегда показывает #03 с честным empty state, если curve отсутствует. Независимое ревью и родительский повтор всех пяти экранов: `prop-agents/reports/strategy-vitrine-acceptance/ACCEPTANCE.md`.

## Проверки

Из `trade-performance/journal/web`:

```sh
node --experimental-strip-types --test src/app/api/strategy-observatory/adapters.test.mjs
node src/app/api/strategy-observatory/verify-real.mjs 131
```

Первый тестовый запуск был RED из-за отсутствующего adapters.ts; следующий цикл RED доказал missing stored-signal injection, ещё один — missing source-count mismatch. Итог: **6/6** fixture tests. Проверяются отсутствующие данные, invalid JSON/schema, oversize, symlink, точные decimal lexemes, stale completed snapshot при свежем progress, DB primary и приватные поля, DB error/fallback, санитарная очистка, SMC count mismatch, независимые S4/S4L и отсутствие синтетической curve.

TypeScript через существующий compiler API (`createProgram`, noEmit, incremental:false): PASS всего проекта. Scoped ESLint через существующий `ESLint().lintFiles(['src/app/api/strategy-observatory/*.{ts,mjs}'])`: PASS. CLI tsc wrapper был заблокирован lifecycle scanner из-за >1 MB compiler file; compiler API дал реальную проверку без установки/изменения конфигурации. Node предупреждает о MODULE_TYPELESS_PACKAGE_JSON для direct TS fixture run: настройки проекта намеренно не менялись.

Независимое code/security review выполняет координатор. Никаких коммитов и изменений вне каталога API этим исполнителем.
