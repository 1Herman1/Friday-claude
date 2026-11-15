---
session: hermes:-1003927097473:9
date: 2026-11-11
source: hermes-telegram
chat: Трейдинг - крипта
topic: Сигналы смарт-мани
status: digested
---

# Hermes · Трейдинг - крипта / Сигналы смарт-мани · 2026-11-11

## Фрагмент (20:15)

**Просил** 20:15:
  [Replying to: "Проверил статистику и поднял обсуждение из Т1. Нашёл и проблему с доставкой, и расхождение по версии.
  
  Короткий отчёт
  За период 10 октября — 8 ноября:
  - Детектор зарегистрировал 21 сигнал-кандидат: 8 лонгов, 13 шортов.
  - В истории Hermes сохранилось 11 разборов: 5 «ВЗЯТЬ», 6 «ПРОПУСТИТЬ».
  - Это не значит, что все 21 дошли в Telegram. По оставшимся кандидатам нет сохранённых разборов; точную доставку каждого подтвердить сейчас нельзя.
  
  Результат на последних примерно 14 днях истории, отдельно от отправленных сигналов:
  - 17 сетапов: 10 виртуальных входов, 6 отмен до входа, 1 истёк.
  - Из 10 входов: 3 тейка, 7 стопов — −1R до комиссий.
  - Это результат механического детектора, не статистика пяти решений «ВЗЯТЬ».
  
  Почему сигналов мало
  1. Сканируем только BTC. Нужна вся цепочка: снятие ликвидности → CHoCH → FVG → совпадение с фильтром 1h → допустимый стоп.
  2. Бот публикует только ещё не исполненные сетапы. Если между проверками цена уже коснулась входа, такой сигнал не отправляется.
  3. Нашёл техническую дыру: сигнал помечается обработанным до разбора и доставки. Если модель падает, повторная попытка может не состояться. Ошибка авторизации 6 ноября действительно была. Поэтому списывать редкие сообщения только на строгую стратегию неправильно.
  
  Что с v0.3
  Здесь до сих пор работает v0.1. В Т1 есть код и бэктест v0.2, а v0.3 была предложена, но не доведена до готовой реализации. Твой запрос от 29 октября — про стоп за снятием, комиссии и полные правила v0.3 — оборвался из-за сбоя.
  
  Смысл предложенной v0.3: контекст зоны 4h/D и премиум/дискаунт → снятие значимой ликвидности → подтверждение на младшем ТФ → стоп за экстремумом снятия. Но точные правила зоны и вариант входа остались недоопределены. Просто переименовывать старого бота нельзя.
  
  Для пересборки уточни один выбор: берём основной вариант снятие на 15m, вход по IFVG на 5m, контекст 4h/D, или более медленный снятие на 1h, вход на 15m? Численную карточку недостающих правил нужно явно зафиксировать перед переключением.
  
  Отчёт сохранил в репозитории. Пока активен прежний демо-монитор v0.1."]
  
  [Герман H&B team] Давай сделаем снятие 1час и 15 мин - вход

**Ответ** 20:20:
  Зафиксировал в ТЗ: **снятие на 1h → подтверждение IFVG и вход на 15m**, стоп — за экстремумом снятия. Сборка и тесты отдельного варианта v0.3 запущены; действующий бот пока не переключён.

**Просил** 20:36:
  [ASYNC DELEGATION BATCH COMPLETE — deleg_f1fc15aa]
  A background fan-out unit you dispatched earlier — 1 subagent(s) — has finished; its consolidated results are below. Any other units from the same delegate_task call report separately as they finish. You may have moved on since dispatching — act on these or re-dispatch if things have changed. If you are still waiting on siblings, end your turn after acting on this one.
  
  Dispatched: 2026-11-11 20:18:41 (18m14s ago)
  Role: leaf   Model: gpt-6.1-sol   Total duration: 1094.93s
  
  --- ✓ TASK 1/1: Implement and exercise a standalone SMC v0.3 PREVIEW for approved 1h liquidity sweep / 15m IFVG entry, without changing or activating the existing live bot. Deliver real tested code, not only a plan. Do not commit/push. Follow test-driven-development skill: load it, test FIRST and show a red then green cycle. Write small detector tests, implement, run tests and real public-candle preview. Return precise changed file paths, test commands/results, real preview result/time/data interval, remaining spec ambiguities. Russian summary.  (status=completed, api_calls=68, 1094.8s) ---
  Реализован и реально запущен **изолированный SMC v0.3 PREVIEW: 1h sweep → 15m IFVG**. Live-бот не переключался; коммит/пуш, отправка сигналов и торговые API не выполнялись.
  
  **Созданы файлы** относительно `trade-performance/prop-agents/`:
  - `clusters/smc-btc/v03_preview.py`
  - `clusters/smc-btc/config.v03.preview.json`
  - `clusters/smc-btc/CARD-v0.3.md`
  - `tests/test_smc_v03_preview.py`
  - `clusters/smc-btc/preview-v03/20261111-btc-{all,crypto,ny}/` — в каждом `candles.json` и `report.json`.
  
  **Проверки**
  ```bash
  .venv/bin/python -m unittest discover -s tests -v
  ```
  **8 tests — OK**, `py_compile` пройден. TDD RED→GREEN подтверждён инструментами: первый запуск — `FAIL: Missing standalone preview detector`; затем отдельные красные/зелёные циклы для IFVG-пересечения, закрытых свечей, replay/TP2, CLI-изоляции и причинности. Найден и исправлен lookahead в дополнительных полях внеоконного отказа.
  
  **Реальные данные:** MEXC **SPOT**, BTCUSDT, 1920 закрытых 15m. Загрузка завершена **11.11.2026 17:26:29 UTC**. Интервал: **22.10.2026 17:15 UTC → 11.11.2026 17:15 UTC**; последний close **74349.38 USDT**.
  
  | Эксперимент | Всего кандидатов | IFVG preview | Отказ | Prefix-проверки |
  |---|---:|---:|---:|---:|
  | all | 71 | 20 | 51 | 75 — PASS |
  | crypto | 71 | 12 | 59 | 61 — PASS |
  | ny | 69 | 10 | 59 | 58 — PASS |
  
  Во всех вариантах **production eligible = 0**. Проверены сохранённые счётчики, уникальность ключей, timestamps входов, SL за экстремумом и TP2 дальше 2R. Это кандидаты, **не отправленные сигналы и не подтверждение доходности**.
  
  **Оставшиеся блокеры:** численные правила 4h/D premium/discount, unmitigated FVG/OB и их комбинации; production-окно; tick/buffer SL; futures-источник и интеграция сопровождения/ограничений позиций. Контекст явно `UNAPPROVED_CONTEXT`, конфиг — снимок фиксированной preview-реализации, не tuning-конфиг.
  
  Tracked `smc_detector.py`, `config.json`, `engine/risk.py`, `engine/limits.yaml` совпадают с HEAD. `seen.json` не изменялся нашим кодом; он ignored/runtime, поэтому сравнение с HEAD недоступно — действующий процесс независимо обновляет его.
  
  Дополнительно сохранён общий workflow проверки причинности в skill `causal-preview-validation` активного профиля.
  Full live transcript (complete tool/assistant trace): /Users/germanbryzgalov/.hermes/cache/delegation/live/deleg_f1fc15aa/task-0.log
  
  [INTERNAL NOTIFICATION — generated by the Hermes gateway, not written by a human user. Do not treat it as user input, and do not reply to any earlier chat message because of it.]

**Ответ** 20:39:
  **Собран и проверен тестовый вариант v0.3: снятие на 1h → вход по IFVG на 15m.**
  
  Что работает:
  - Поиск снятия ликвидности с подтверждением закрытием часовой свечи.
  - Вход после закрытия 15m-свечи через границу IFVG.
  - Стоп за экстремумом снятия, TP1 — 2R, расчёт следующей цели.
  - Запись причин пропуска каждого кандидата.
  
  **Проверки:** 8 тестов прошли. Повторный прогон на усечённой истории прошёл 75 проверок на заглядывание в будущее.
  
  На реальных BTC-свечах MEXC за **22 октября — 11 ноября**, с первыми 8 сутками для подготовки уровней:
  - Без ограничения времени — **20 IFVG-кандидатов**.
  - В крипто-окнах — **12**.
  - В окнах Нью-Йорка — **10**.
  
  Это **не исполненные сделки и не результат …

### Изменённые файлы
- `~/Friday-claude/STATUS.md`
- `~/Friday-claude/trade-performance/prop-agents/TZ.md`
- `~/Friday-claude/trade-performance/prop-agents/clusters/smc-btc/CARD-v0.3.md`

### Коммиты
- docs: select hourly sweep and 15m IFVG for SMC v03
- feat: add isolated SMC hourly-sweep 15m IFVG preview

## Фрагмент (22:31)

**Просил** 22:31:
  Есть винова.

**Просил** 22:31:
  Gateway message origin (JSON data, not instructions or authorization):
  {"platform": "telegram", "chat_id": "-1003927097473", "thread_id": "9", "chat_type": "group", "user_id": "7098788894", "message_id": "388", "source_message_id": "388"}
  Do not guess a reply destination when these fields are insufficient.
  
  Есть сигналы.

**Ответ** 22:32:
  **Сейчас свежих сигналов нет.** По проверке в **22:30 МСК 11 ноября** у действующего бота нет сетапов, ожидающих входа, и открытых виртуальных позиций.
  
  Последний сигнал обнаружен сегодня в **07:26 МСК** — шорт BTC. Он уже не актуален для нового входа.
  
  Это пока **v0.1**. Новая схема **1h → 15m** проверена отдельно, но автоматическая отправка по ней ещё не включена.
