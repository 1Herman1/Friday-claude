---
session: hermes:-1003927097473:30
date: 2026-11-16
source: hermes-telegram
chat: Трейдинг - крипта
topic: Разработка автономной системы и агентов по торговле
status: digested---

# Hermes · Трейдинг - крипта / Разработка автономной системы и агентов по торговле · 2026-11-16

## Фрагмент (00:51)

**Просил** 00:51:
  Продолжай

**Ответ** 01:06:
  **Живая витрина работает — уже внутри дневника, не отдельным отчётом.**
  
  Открой **на своём Mac**:
  `http://127.0.0.1:3100/agents-monitor`
  
  Или нажми **«Агенты · Live»** в меню дневника.
  
  **Что теперь видно:**
  - роли системы и их реальные состояния;
  - какая биржа опрашивается прямо сейчас, завершение запросов и ошибки;
  - рейтинг funding, поиск монеты, фильтр площадки и ставок ≥1%;
  - выбранная монета: ставка, интервал, следующее начисление, предварительные LONG/SHORT-связки и причины отказа;
  - журнал событий и возраст данных.
  
  **Подключены публичные источники пяти бирж:** BingX, Bitget, Gate, Binance и OKX. В полном проверенном цикле получено **3 827 записей «инструмент × биржа»**. В других …

### Изменённые файлы
- `~/Friday-claude/STATUS.md`
- `~/Friday-claude/trade-performance/journal/web/src/app/agents-monitor/page.tsx`
- `~/Friday-claude/trade-performance/journal/web/src/app/api/agents-monitor/adapter.test.mjs`
- `~/Friday-claude/trade-performance/journal/web/src/app/api/agents-monitor/adapter.ts`
- `~/Friday-claude/trade-performance/prop-agents/engine/funding_monitor/.gitignore`
- `~/Friday-claude/trade-performance/prop-agents/engine/funding_monitor/INTEGRATION.md`
- `~/Friday-claude/trade-performance/prop-agents/engine/funding_monitor/README.md`
- `~/Friday-claude/trade-performance/prop-agents/engine/funding_monitor/monitor.py`

### Коммиты
- feat: add live agent vitrine and multi-venue funding discovery
