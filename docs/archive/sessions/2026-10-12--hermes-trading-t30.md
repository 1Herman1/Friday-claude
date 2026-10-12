---
session: hermes:-1003927097473:30
date: 2026-10-12
source: hermes-telegram
chat: Трейдинг - крипта
topic: Разработка автономной системы и агентов по торговле
status: digested
---

# Hermes · Трейдинг - крипта / Разработка автономной системы и агентов по торговле · 2026-10-12

## Фрагмент (01:36)

**Просил** 01:36:
  Т1

**Ответ** 01:36:
  Записал: этот топик теперь Т1 («Разработка автономной системы и агентов по торговле»), thread 30. Обновил `docs/hermes/topics.json` и запушил коммитом a41811a2.
  
  **Что уже готово** (по `STATUS.md` от 11.10):
  - **Риск-слой** `prop-agents/engine/risk.py`. Решает по каждой сделке: одобрить, уменьшить или отклонить. Считает размер позиции от риска, следит за дневным и общим лимитом и серией убытков, есть аварийная остановка. Лимиты лежат в YAML, менять их можешь только ты. 43 теста проходят.
  - **ТЗ v3** и **архитектура агентов**, плюс шаблон карточки стратегии.
  - **Детектор SMC-BTC 5m v0.1** и cron в Т5: только присылает сигналы, сам не торгует. На истории за 14 дней: 12 сделок, +6R без учёта …

**Просил** 01:38:
  Пропиши полное тз , какие будем использоваться репозитории для работы из гид хаба ? Полное ТЗ

### Коммиты
- hermes: Т1 = thread 30 в «Трейдинг - крипта»

## Фрагмент (01:42)

**Ответ** 01:42:
  Написал полное ТЗ v5 и запушил: `trade-performance/prop-agents/TZ.md`, коммит 0710df20. По репозиториям GitHub 12.10 через API проверил звёзды, лицензию и дату последнего коммита.
  
  **Что в ТЗ:**
  - границы: что входит и что нет (памп-шорт, арбитраж и веб в эту систему не входят);
  - 10 принципов, путь одного сигнала от свечи до сделки;
  - требования к каждому модулю: данные, детектор, мозг, риск, исполнение, ведение позиции, журнал, бэктест, арена, улучшатели, надзор, команды в Telegram;
  - форматы данных между модулями: сигнал, решение, ордер;
  - надёжность, безопасность, этапы P1–P6 с критериями готовности, риски, правовой контур.
  
  **Главное решение по стеку.** Движок пишем сами поверх …

### Изменённые файлы
- `~/Friday-claude/trade-performance/prop-agents/TZ.md`

### Коммиты
- prop-agents: полное ТЗ v5 — модули, контракты, стек и репозитории GitHub, критерии перехода

## Фрагмент (08:35)

**Просил** 08:35:
  Нет тут информации насчёт пропов с которыми мы будем работать и информации что это будет мультиагентная система .
  Задай мне ещё кластер технических вопросов , чтоб ты более глубоко понял идею и если я где-то не прав , был критичен и помог мне выйти на реализацию продукта

**Ответ** 08:51:
  Ты прав, этого в ТЗ не хватало. Добавил два раздела и запушил (коммит ce2e0541):
  - **§1a «Это мультиагентная система».** Агент — это стратегия, её версия, модель, площадка и свой счёт вместе. Агенты одной стратегии объединены в кластер, все сравниваются на арене. Плюс общие служебные агенты (риск, исполнение, Сторож, улучшатели) и общая память в репозитории и БД.
  - **§14 «Пропы, с которыми работаем».** Propr первый, HyroTrader второй, SizeProp для работы через терминал. Breakout и Hash Hedge — только после их письменного ответа. Отдельно — кого отсеяли и на каких демо тренируемся до пропа.
  
  Теперь вопросы. Где я с тобой не согласен — пишу сразу.
  
  **A. Цель продукта**
  1. Что в итоге продукт: …

### Изменённые файлы
- `~/Friday-claude/trade-performance/prop-agents/TZ.md`

## Фрагмент (20:09)

**Просил** 20:09:
  А. 1. Первая смотри этот проект сделан для того чтобы работать с агентами на пропах то есть сделать автономную систему которая будет работать на пропах то есть соответственно много разных кластеров агентов которые будут работать в разнородных истори чтобы они имели возможность работать над рынком сигналы и сигналы и SAS это уже будет второстепенной задачи которые мы будем выполнять в дальнейшем первостепенное задачей нужно нам создать автономную и и систему торговли на пропах. 2. И начало я не готов никакую сумму тратить в месяц первоначально на можно сказать на комиссию нет не на комиссию на взносы а на челленджи которые мы будем использовать для начала нужно протестировать это на демо счёте в любом организации проф структуре есть демо счета просто нужно подключить этих агентов которые поработают месяц 2 3 на проб на пробной версии то есть есть на демо когда на Демо они будут показывать хоть хоть какую-то движение небольшое мы будем пробовать уже уже соответственно работать на небольших челленджи kh которые стоит от 20 от 15 баксов небольшие челлендж там на 05:10 тыщ исходя из из моей информации которые я знаю по hash hadge . В. Во первых , ты не сможешь поставить одного агента на разные платформы и во вторых будем тестировать разные стратетегии и выявлять 3-4 рабочие и работать на дистанции с ними. 4. Агенты на старте работают изолировано. 5. 3-4 стратегии , а не агентов , соответственно агентов будет столько со скалькими платформами мы будем работать . За счёт понимания движения на графике , если вин Рейт на дистанции месяц будет зарабатывать около 50%. Что значит бумажная торговля ? Чья ошибка наша брибыль - что ты имел ввиду ?
  А. 1. Первая смотри этот проект сделан для того чтобы работать с агентами на пропах то есть сделать автономную систему которая будет работать на пропах то есть соответственно много разных кластеров агентов которые будут работать в разнородных истори чтобы они имели возможность работать над рынком сигналы и сигналы и SAS это уже будет второстепенной задачи которые мы будем выполнять в дальнейшем первостепенное задачей нужно нам создать автономную и и систему торговли на пропах. 2. И начало я не готов никакую сумму тратить в месяц первоначально на можно сказать на комиссию нет не на комиссию на взносы а на челленджи которые мы будем использовать для начала нужно протестировать это на демо счёте в любом организации проф структуре есть демо счета просто нужно подключить этих агентов которые поработают месяц 2 3 на проб на пробной версии то есть есть на демо когда на Демо они будут показывать хоть хоть какую-то движение небольшое мы будем пробовать уже уже соответственно работать на небольших челленджи kh которые стоит от 20 от 15 баксов небольшие челлендж там на 05:10 тыщ исходя из из моей информации которые я знаю по hash hadge . В. Во первых , ты не сможешь поставить одного агента на разные платформы и во вторых будем тестировать разные стратетегии и выявлять 3-4 рабочие и работать на дистанции с ними. 4. Агенты на старте работают изолировано. 5. 3-4 стратегии , а не агентов , соответственно агентов будет столько со скалькими платформами мы будем работать . 6. За счёт понимания движения на графике , если вин Рейт на дистанции месяц будет зарабатывать около 50%. Что значит бумажная торговля ? Чья ошибка наша брибыль - что ты имел ввиду ? 7. Ллм на основе сигнала в ситуации - пересечения многих факторов, учитывая риск менеджмент , сентимент ситуации будет принимать решение входить в сделку или нет . 8. Спарси все возможные стратегии , которые реально показали результат на дистанции - начиная от скалпинга и заканчивая торговли раз в месяц . Не ставь себе рамки в плане разнородности стратегии. D 9. Будем пробовать разные вариативности и торговлю на пропах и торговлю на хайпер ликвид / мекс . 10. Позже отвечу по этому вопросу 11. Готов 12. Сразу начинаем тестировать автономию , тут главное не получать результат сразу , а нужно достичь доходности уже в автономной системе

**Ответ** 21:15:
  Твои ответы внёс в ТЗ, раздел §1b «Решения Германа» (коммит 5610638a).
  
  **Что я имел в виду:**
  - **Бумажная торговля.** Агент принимает решения по живому рынку, но сделки виртуальные: программа сама считает вход, стоп, тейк и комиссию по реальным свечам. Ни биржа, ни ключи не нужны. От демо отличается тем, что на демо ордера реально уходят на биржу, только деньги ненастоящие. Бумагу можно запустить уже на этой неделе. Демо подключаем следом, когда будут готовы адаптеры к площадкам.
  - **«Чья ошибка — наша прибыль».** Деньги на рынке переходят от одних участников к другим. У рабочей стратегии есть ответ, у кого мы забираем. Пример для SMC: толпа ставит стопы за очевидным хаем, цена их …

### Изменённые файлы
- `~/Friday-claude/trade-performance/prop-agents/TZ.md`

## Фрагмент (22:52)

**Просил** 22:52:
  [ASYNC DELEGATION BATCH COMPLETE — deleg_77261e1a]
  A background fan-out unit you dispatched earlier — 1 subagent(s) — has finished; its consolidated results are below. Any other units from the same delegate_task call report separately as they finish. You may have moved on since dispatching — act on these or re-dispatch if things have changed. If you are still waiting on siblings, end your turn after acting on this one.
  
  Dispatched: 2026-10-12 20:57:48 (1h54m ago)
  Role: leaf   Model: ?   Total duration: 816.53s
  
  --- ✓ TASK 1/1: Составить каталог торговых стратегий для крипто-фьючерсов (BTC и ликвидные альты), у которых есть свидетельства результата на дистанции, и записать его в файл /Users/germanbryzgalov/Friday-claude/trade-performance/research/strategies-catalog.md. Покрыть весь диапазон частот: скальпинг (1–5m), интрадей (15m–1h), свинг (4h–1d), позиционные (неделя–месяц). Не ограничиваться одним стилем.  (status=completed, api_calls=20, 816.46s) ---
  The catalog is written and pushed to `claude/greeting-nnz368`. It has 25 strategies plus 6 rejected ideas, and the main finding is that none of the sources show a scalping strategy (1–5m) that stays profitable after taker fees.
  
  - **Commit:** `e70aa10a4db5c4aead99a72bed86f4eecff21012`, no new branches.
  - **File:** `~/Friday-claude/trade-performance/research/strategies-catalog.md`. Each strategy has the requested block, followed by the summary table and the top-6.
  - **Coverage:** scalping (1–5m), intraday (15m–1h), swing (4h–1d) and positional (week–month). Profit sources include trend, mean reversion, calendar effects, funding carry, positioning skew, order flow, and BTC-vs-alt relationships.
  - **No own backtests.** All figures come from the sources, with URL, period and whether fees were counted. Where a source gives no figures, the file says so.
  
  **What the sources show:**
  - **Trend has the strongest evidence.** A Donchian ensemble on the top-20 coins gives Sharpe above 1.5 after fees. Time-series momentum is confirmed even under realistic testing assumptions.
  - **Short-term scalping does not pay.** One study finds a real 15m reversal, but it earns about 1.3 bp per trade against 5 bp of costs. Our SMC 5m sits in the same fee zone: with a stop around 0.2%, the taker fee is about 0.5R, so it needs limit (maker) entries.
  - **Funding/basis carry is confirmed but doesn't fit props.** It needs a spot leg, so it only works on our own Hyperliquid/MEXC accounts.
  - **Rejected:** CME gap, day-of-week/weekend effects, the "overnight" pattern, buying after a crash on perps, and the hourly BTC→alt lead. For SMC itself I found no academic support.
  
  **Top-6 for the first demo test:**
  1. Donchian ensemble on 10–15 coins (daily, positional): strongest evidence, Sharpe above 1.5 after fees; needs a 10–15% volatility target to fit the 6–10% total drawdown.
  2. Intraday trend ensemble on BTC/ETH (15m–1h): Sharpe about 1.6 over 2018–2025, but only before fees; trades every day, which covers the minimum trading days.
  3. New 10–50-day high → follow the trend, new low → buy the bounce (daily, swing): the bounce side is mean reversion, which lowers correlation with the first two.
  4. BTC trend flips → alts follow within 24h (1h–4h): out-of-sample +15.1 points over a control; fees barely matter.
  5. Cointegrated pairs (1h–4h): market-neutral, mean-reverting, and uncorrelated with trend; needs a stop on each leg.
  6. Fading extreme funding (1h–4h): the only candidate built on crowded positioning. Confidence is low because no source shows a price result, so it's a cheap test to drop quickly if it fails.
  
  **Problems:**
  - **Fees kill hourly seasonality.** The 2-hour BTC hold at 22:00 UTC earns about 0.08% per trade, which a 0.10% taker round trip wipes out. It only works with maker fees, so it went to the reserve list instead of the top-6.
  - **Text extraction sometimes returned the previous page.** I checked every figure against the title inside the returned page, removed claims I couldn't confirm (CTREND method details, some author names), and added this pitfall to the `grounded-citations` skill.
  - **Several sources are 2026 preprints by single authors**, and their confidence ratings are lowered to match.
  Full live transcript (complete tool/assistant trace): /Users/germanbryzgalov/.hermes/cache/delegation/live/deleg_77261e1a/task-0.log
  
  [INTERNAL NOTIFICATION — generated by the Hermes gateway, not written by a human user. Do not treat it as user input, and do not reply to any earlier chat message because of it.]

**Ответ** 22:52:
  Каталог стратегий готов: `trade-performance/research/strategies-catalog.md`, коммит e70aa10a. Файл в ветке есть, я проверил. В нём 25 стратегий и 6 отброшенных идей, у каждой ссылки на источники с периодом и пометкой, учтены ли комиссии. Своих бэктестов пока нет, все цифры взяты из источников.
  
  **Главные выводы:**
  - **Сильнее всего подтверждены трендовые стратегии на дневках и неделях.** Лучший пример — набор пробойных систем Donchian на топ-монетах: Sharpe выше 1,5 после комиссий.
  - **Ни один источник не показывает скальпинг на 1–5m, который остаётся в плюсе после комиссий.** Это касается и нашего SMC 5m. Научного подтверждения у SMC тоже не нашлось. Это не значит, что он не работает, но у …
