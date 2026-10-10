---
session: hermes-telegram-trading
date: 2026-10-10
branch: claude/greeting-nnz368
status: digested
source: Hermes (Telegram «Friday - AI Agents sytem»), записано вручную — хуки Claude Code эти сессии не пишут
---

# Сессия 2026-10-09/10 (Hermes, трейдинг)

## Решения
- LLM для prop-agents: Claude Opus 5.5 (решение, исследователь) и Sonnet 5.5 (массовые роли).
- На старте оркестратор — Hermes на подписке Claude Max, без отдельного API. LLM будится только при сигнале детектора. Переход на API/сервер — при упоре в лимиты или нужде в 24/7.
- Принцип: код ищет сетап и считает уровни, LLM только ВЗЯТЬ/ПРОПУСТИТЬ с обоснованием, риск — код.
- Детектор работает на 5m (выбор Германа); фильтр 1h.
- Топик на каждый кластер; контекст агента живёт в репо, чат — только вход (`/context`, `/rule`, `/why`, `/pause`, `/resume`).
- Трейдинг вынесен в отдельную Telegram-группу с топиками; карта топиков — черновик в `trade-performance/README.md`.

## Сделано
- `prop-agents/TZ.md` → v3; `ARCHITECTURE.md` (+ раздел топиков); `STRATEGY_CARD_TEMPLATE.md` (чек-лист карточки).
- `prop-agents/clusters/smc-btc/smc_detector.py` + `config.json`: sweep → CHoCH → FVG, RR 1:2. История 14 дней: 19 сетапов, 12 закрыто, 50% винрейт, +6R (≈ +3,8R с комиссией).
- Cron Hermes `2632e3d7c432` «SMC-BTC 5m сигналы» каждые 5 мин, монитор `~/.hermes/scripts/smc_btc_monitor.sh`.

## Грабли
- MEXC klines: максимум 500 за запрос, листать через startTime+endTime; бывают таймауты чтения — нужны ретраи.
- Обзорный 5m-график за 2 недели нечитаем — рисовать каждый сетап отдельной панелью.

## Дальше
- Названия топиков от Германа → перенос доставки cron в топик SMC-BTC.
- Карточка стратегии SMC-BTC → правка чисел детектора.
