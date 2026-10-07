### USER [REQUEST]
Теперь сделай мне в виде файла .md , наше тз

### ASSISTANT [RESPONSE]
# Техническое задание: Автономная система AI-агентов для Hash Hedge + Дневник трейдера

**Версия:** 1.0  
**Дата:** 2026-10-03  
**Платформа:** macOS (разработка и эксплуатация)  
**Оркестратор:** Hermes Agent (Nous Research) + HIVE  
**Подкапотный движок:** Claude Code  
**Торговый терминал:** MetaTrader 5 (через `mt5_mac` / `silicon-metatrader5`)  
**Проп-фирма:** Hash Hedge  

---

## 1. Цели и назначение

Создать автономную систему AI-агентов, которая:

1. Торгует на проп-аккаунте Hash Hedge, соблюдая жёсткие правила риск-менеджмента.
2. Самообучается на основе накопленного опыта (навыки Hermes).
3. Ведёт автоматический дневник трейдера: статистика, разбор ошибок, рекомендации.
4. Управляется через Telegram-бота и визуальный дашборд на Mac.
5. Позволяет трейдеру наблюдать, вмешиваться и корректировать стратегию.

Система состоит из двух параллельных контуров:

- **Контур A** — торговые AI-агенты (Hermes + Claude Code + MT5).
- **Контур B** — аналитический (дневник, статистика, дашборд).

Оба контура связаны через единую базу данных **DuckDB**.

---

## 2. Общая архитектура

```
┌──────────────────────────────────────────────────────────────────────┐
│                     HERMES AGENT RUNTIME (macOS)                     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                   HIVE ORCHESTRATOR                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │ Data     │─▶│ Feature  │─▶│ Strategy │─▶│ Risk Manager │   │  │
│  │  │ Agent    │  │ Agent    │  │ Agent    │  │ Agent        │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────┬───────┘   │  │
│  │                                                     │          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          ▼          │  │
│  │  │ Journal  │◀─│Execution │◀─│ Telegram │◀── approved signal  │  │
│  │  │ Agent    │  │ Agent    │  │ Bot      │                     │  │
│  │  └────┬─────┘  └──────────┘  └──────────┘                     │  │
│  │       │                                                        │  │
│  │       ▼                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │                      DUCKDB                              │  │  │
│  │  │  trades | daily_snapshots | journal | rules | skills     │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Claude Code (подкапотный движок)                              │  │
│  │  Вызывается через MCP-инструмент: claude_code_executor         │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Контур A: AI-агенты на Hermes

### 3.1. Технологический стек

| Компонент | Технология |
|-----------|------------|
| Оркестратор | Hermes Agent + HIVE |
| Подкапотный движок | Claude Code (Anthropic) |
| Данные | `ccxt`, Binance Public API |
| Признаки | `pandas`, `pandas-ta` |
| База данных | DuckDB |
| Исполнение | MetaTrader 5 (`mt5_mac`) |
| Дашборд | Streamlit |
| Уведомления | Telegram Bot API (встроен в Hermes) |

### 3.2. Схема взаимодействия агентов

1. **Data Agent** → получает свежие данные → передаёт Feature Agent.
2. **Feature Agent** → считает признаки → передаёт Strategy Agent.
3. **Strategy Agent** → формирует сигнал → передаёт Risk Manager.
4. **Risk Manager** → одобряет/отклоняет → передаёт Execution Agent (если одобрено).
5. **Execution Agent** → отправляет ордер в MT5 → уведомляет Journal Agent и Telegram.
6. **Journal Agent** → пишет событие в DuckDB.
7. **Telegram Bot** → принимает команды пользователя, управляет Workflow.

### 3.3. Спецификация агентов

#### Data Agent
- **Навык Hermes:** `crypto_data_collector`
- **Триггер:** расписание (каждые 60 секунд)
- **Действие:** вызывает `claude_code_executor` с промптом:  
  «Обнови `/data/btc.parquet` минутными свечами BTCUSDT за последний час через ccxt. Если файла нет — скачай историю за 2 года.»
- **Результат:** обновлённый Parquet-файл.

#### Feature Agent
- **Навык:** `feature_engineer`
- **Вход:** данные от Data Agent
- **Действие:** вычисляет RSI(14), MACD(12,26,9), ATR(14), ADX(14), Bollinger Bands(20,2), SMA(20/50/200), лаги доходностей 1–5, корреляцию с BTC.
- **Результат:** таблица `features` в DuckDB.

#### Strategy Agent
- **Навык:** `prop_strategy_decision`
- **Вход:** последняя строка признаков + состояние счёта + история последних 20 сделок.
- **System prompt (встраивается в Hermes):**
  > Ты — трейдер проп-фирмы Hash Hedge. Правила: дневная просадка ≤5% от начального баланса, общая ≤10%, цель +8%. Верни JSON: `{"action": "BUY|SELL|HOLD", "volume": float, "sl": float, "tp": float, "confidence": 0-1}`. Если confidence < 0.6 — HOLD.
- **Эволюция:** Hermes анализирует успешность паттернов и корректирует веса.

#### Risk Manager Agent
- **Навык:** `prop_risk_gate`
- **Жёсткие правила (не эволюционируют):**
  1. Потенциальный убыток от SL не выводит дневную просадку за 4.5%.
  2. Общая просадка не выходит за 9.5%.
  3. Запрет хеджирования одного инструмента.
  4. Запрет мартингейла (увеличение лота после убытка).
  5. Максимальный риск на сделку: 1% баланса.
- **Результат:** `approved: true/false` + скорректированный объём.

#### Execution Agent
- **Навык:** `mt5_order_sender`
- **Действие:** отправляет ордер в MetaTrader 5 через `mt5_mac` или `silicon-metatrader5`.
- **Результат:** тикет ордера, событие для Journal Agent.

#### Journal Agent
- **Навык:** `trade_journal_writer`
- **Действие:** записывает в DuckDB все события: сигнал, решение риск-менеджера, факт исполнения, результат сделки, состояние счёта.

#### Telegram Bot Agent
- **Навык:** `telegram_control_panel`
- **Команды:**
  - `/start` — клавиатура: ▶️ Запустить, ⏹ Остановить, 📊 Статус, 🔄 Бэктест, 📓 Дневник
  - `/status` — баланс, открытые позиции, дневная и общая просадка
  - `/journal` — последняя запись дневника + AI-рекомендации
  - `/backtest <описание>` — запуск бэктеста через Claude Code

### 3.4. Интеграция Claude Code

Claude Code регистрируется в Hermes как MCP-инструмент:

```yaml
tools:
  claude_code_executor:
    type: shell
    command: 'claude --output-format json --prompt "{{prompt}}" --workdir /Users/you/prop_trader'
    description: "Генерирует и выполняет код через Claude Code"
```

Также используется HIVE-оркестратор:

```bash
pip install hermes-hive-v4
hive-daemon start
# Дашборд: http://127.0.0.1:8421/dashboard
```

### 3.5. Навыки Hermes

Все навыки хранятся в таблице `skills` базы DuckDB. Каждый навык имеет:

- `skill_id`
- `name`
- `created_at`
- `last_used`
- `success_count`
- `fail_count`
- `prompt_template`
- `active`

Вы можете отключать неэффективные навыки через дашборд.

---

## 4. Контур B: Дневник трейдера

### 4.1. Структура базы данных (DuckDB)

**Таблица `trades`** — все сделки:

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER | PK |
| timestamp_open | TIMESTAMP | Время открытия |
| timestamp_close | TIMESTAMP | Время закрытия |
| symbol | TEXT | Инструмент |
| direction | TEXT | BUY/SELL |
| volume | REAL | Объём |
| entry_price | REAL | Цена входа |
| exit_price | REAL | Цена выхода |
| sl | REAL | Стоп-лосс |
| tp | REAL | Тейк-профит |
| pnl | REAL | Прибыль/убыток в $ |
| pnl_pct | REAL | Прибыль/убыток в % |
| duration_min | INTEGER | Длительность в минутах |
| strategy_id | TEXT | ID стратегии |
| source | TEXT | 'agent' или 'manual' |
| tags | TEXT | Теги |
| notes | TEXT | Заметки |

**Таблица `daily_snapshots`** — ежедневная сводка:

| Поле | Тип |
|------|-----|
| date | DATE |
| starting_balance | REAL |
| ending_balance | REAL |
| daily_pnl | REAL |
| daily_pnl_pct | REAL |
| max_daily_drawdown | REAL |
| total_drawdown | REAL |
| trades_count | INTEGER |
| win_count | INTEGER |
| loss_count | INTEGER |
| challenge_day | INTEGER |

**Таблица `journal_entries`** — записи дневника:

| Поле | Тип |
|------|-----|
| date | DATE |
| mood | INTEGER (1-10) |
| market_notes | TEXT |
| mistakes | TEXT |
| lessons | TEXT |
| ai_recommendations | TEXT |
| discipline_score | INTEGER |

**Таблица `rules`** — правила торговли:

| Поле | Тип |
|------|-----|
| rule_id | INTEGER |
| text | TEXT |
| category | TEXT |
| active | BOOLEAN |
| violation_count | INTEGER |

**Таблица `skills`** — навыки Hermes:

| Поле | Тип |
|------|-----|
| skill_id | INTEGER |
| name | TEXT |
| created_at | TIMESTAMP |
| last_used | TIMESTAMP |
| success_count | INTEGER |
| fail_count | INTEGER |
| prompt_template | TEXT |
| active | BOOLEAN |

### 4.2. Автоматический разбор ошибок

Hermes запускает навык `error_pattern_detector` после каждых 10 закрытых сделок. Агент сканирует `trades` и выявляет паттерны:

| Паттерн | Условие |
|---------|---------|
| Контртренд | >30% сделок против EMA20/EMA60 на 4H |
| Отсутствие стопа | Убыток >1.5× запланированного SL |
| Преждевременный выход | Прибыль закрыта до TP, цена потом пошла дальше |
| Ревендж-трейдинг | Новая сделка <5 мин после убытка, лот увеличен |
| Overtrading | >5 сделок за день |

Результат записывается в `journal_entries` и отправляется в Telegram.

**Пример рекомендации:**

> За последние 30 сделок 40% были контртрендовыми. Рекомендую добавить правило: отклонять покупку, если EMA20(4H) < EMA60(4H) и цена ниже обеих.

### 4.3. Дашборд на Streamlit

Запуск: `streamlit run dashboard.py`  
Открывается: `http://localhost:8501`

**Экраны:**

1. **Статус челленджа** — баланс, цель, дневная/общая просадка с цветовой индикацией (зелёный/жёлтый/красный).
2. **Позиции** — открытые позиции в реальном времени (обновление каждые 5 секунд).
3. **Статистика** — equity curve, win rate, profit factor, распределение PnL.
4. **Дневник** — форма ручного ввода + кнопка «AI-разбор» (вызывает Claude Code через Hermes).
5. **Правила** — чекбоксы активных правил, счётчик нарушений.
6. **Навыки Hermes** — список дистиллированных навыков, их эффективность, возможность отключения.

---

## 5. Правила торговли

### 5.1. Блокирующие (Risk Manager не пропустит ордер)

1. Риск на сделку ≤1% баланса.
2. Дневная просадка ≤4.5% (буфер 0.5% от лимита Hash Hedge 5%).
3. Общая просадка ≤9.5% (буфер от 10%).
4. SL обязателен для каждой сделки.
5. Запрет хеджирования одного инструмента.
6. Запрет мартингейла.

### 5.2. Рекомендательные (учитываются в confidence)

7. Не входить против EMA20/EMA60(4H) без подтверждения разворота.
8. Пропускать первые 15 минут сессии.
9. Не торговать за 30 минут до/после FOMC, CPI.

### 5.3. Для дневника

10. После 2 убытков подряд — пауза 1 час.
11. Не увеличивать лот после убытков.
12. Записывать каждую сделку с обоснованием.

---

## 6. Пошаговый план внедрения на Mac

### Этап 1 — Установка (день 1)

```bash
# Hermes
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
hermes setup   # выбрать провайдера LLM, подключить Telegram

# Claude Code
npm install -g @anthropic-ai/claude-code
claude login

# Зависимости Python
pip install ccxt pandas pandas-ta duckdb streamlit mt5_mac python-telegram-bot
```

### Этап 2 — HIVE-оркестратор (день 1–2)

```bash
pip install hermes-hive-v4
hive-daemon start
# Открыть http://127.0.0.1:8421/dashboard
# Создать агентов через веб-интерфейс, назначить навыки
```

### Этап 3 — База и ядро (день 2–3)

Через Claude Code создайте структуру проекта, инициализируйте DuckDB с таблицами `trades`, `daily_snapshots`, `journal_entries`, `rules`, `skills`.

### Этап 4 — Агенты (день 3–5)

Создайте в HIVE-дашборде агентов: Data, Feature, Strategy, Risk Manager, Execution, Journal. Соедините в pipeline. Зарегистрируйте `claude_code_executor` как MCP-инструмент.

### Этап 5 — Дневник и дашборд (день 5–7)

Через Claude Code создайте Streamlit-дашборд. Настройте MCP-подключение Claude Code к DuckDB и файловой системе.

### Этап 6 — Бэктест (день 7–10)

Прогоните стратегии через симулятор проп-правил. Убедитесь, что в Монте-Карло вероятность прохождения >60%.

### Этап 7 — Демо (неделя 2)

Переключите Execution Agent на демо-счёт Hash Hedge. Наблюдайте через Telegram и дашборд.

### Этап 8 — Реальный челлендж (неделя 3+)

Когда демо стабильно — запускайте реальный. Система автономна, вы наблюдаете и корректируете.

---

## 7. Приложения

### 7.1. Полезные ссылки

- Hermes Agent: `https://hermes-agent.nousresearch.com`
- Claude Code: `https://claude.ai/code`
- Hash Hedge: `https://hashhedge.com`
- MetaTrader 5 для Mac: `mt5_mac` (pip)
- DuckDB: `https://duckdb.org`
- Streamlit: `https://streamlit.io`

### 7.2. Контакты

- Разработчик: [ваше имя]
- Дата: 2026-10-03

---

**Конец документа.**

### ASSISTANT [TIP]
This response is AI-generated, for reference only.
