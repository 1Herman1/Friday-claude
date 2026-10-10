# Архитектура данных trade-performance (journal + prop-agents)

Статус: проект v1, на согласование с Германом. Автор: агент `architect`. Дата: 2026-10-11.
Связанные документы: [`../README.md`](../README.md), [`../journal/TZ.md`](../journal/TZ.md),
[`../prop-agents/TZ.md`](../prop-agents/TZ.md), [`../prop-agents/ARCHITECTURE.md`](../prop-agents/ARCHITECTURE.md),
[`../../docs/core/rkn-compliance.md`](../../docs/core/rkn-compliance.md) (раздел A).

Проверка: Prisma-схема из раздела 4 прошла `prisma validate` (Prisma 7.10.0), а `prisma migrate diff --from-empty`
собрал из неё DDL на 43 таблицы. На живой PostgreSQL не накатывалась: локально PostgreSQL нет.

---

## 0. Коротко и простыми словами

**Одна база на два продукта.** Дневник и агенты пишут в одну PostgreSQL. Сделка Германа с MEXC и сделка
агента на Hyperliquid testnet лежат в одной таблице `trades` и считаются одной формулой. Поэтому дневник
бесплатно показывает агентов, а риск-слой видит и людей, и агентов.

**Сделку собираем из исполнений.** Биржа отдаёт отдельные исполнения (fills). Сделка — это позиция от
открытия до закрытия, собранная из них. Атом истины — `executions`, сделка — производная. Ручную сделку тоже
пишем через «синтетические» исполнения, чтобы статистика считалась одним путём.

**Кто торговал и откуда пришли данные — разные вопросы.** `executor` отвечает «кто торговал: человек или
агент». `origin` — «откуда запись: импорт, ручной ввод, голос или движок». `signal_id` — «по чьему сигналу».
Пример: Герман вошёл руками по сигналу SMC-агента, сделку потом подтянул импорт MEXC. Тогда
executor = HUMAN, origin = IMPORT, signal_id = сигнал.

**Деньги — не в центах, а в Decimal(38,18).** Правило студии «деньги в целых центах» для крипты не работает:
цены монет бывают 0.00000012, объёмы — дробные до 1e-8, комиссии списываются в BNB/USDT/монете. Подробно — раздел 2.

**Владелец схемы — Prisma, Python ходит в ту же БД через SQL.** Миграции делает только Prisma. Python-движок
(детекторы, риск, исполнение) работает через SQLAlchemy Core на таблицах, сгенерированных из живой БД. CI
ловит расхождение. Подробно — раздел 3.

**Повторный импорт ничего не задваивает.** У каждой записи с биржи есть внешний id, а в БД стоит уникальный
ключ `(счёт, внешний id)`. Повторная вставка — «ничего не делать». Подробно — раздел 5.

**Риск-лимиты агентам недоступны физически.** Лимиты лежат в `risk_policies`. У пользователя БД, под которым
работает движок, на эту таблицу есть только SELECT. Каждую правку пишет `audit_logs`.

**SaaS заложен, но не построен.** `organization_id` стоит на каждой бизнес-таблице, роли — в `memberships`,
биллинг — только поле `organizations.plan` (Ф3). Сейчас одна организация, «Герман».

**Очередь — в самой PostgreSQL.** При 1 пользователе и сотнях сигналов в день Redis не нужен. Таблица `jobs`
с `FOR UPDATE SKIP LOCKED` — на один сервис меньше.

---

## 1. Сущности и связи

### 1.1. Карта по группам

| Группа | Таблицы | Зачем |
|--------|---------|-------|
| Тенанты и доступ | `organizations`, `users`, `memberships`, `auth_identities`, `api_tokens`, `audit_logs` | Мультитенантность, RBAC (роль в организации), вход отдельно от прав, сервисные токены Hermes и движка, аудит правок лимитов |
| Справочники | `venues`, `instruments`, `prop_profiles` | Площадки (биржа / проп / тестнет), инструменты с шагом цены и размером контракта, правила пропов как данные, а не текст в промпте |
| Счета | `accounts`, `exchange_credentials` (Ф3), `account_snapshots` | Счёт биржевой / демо / проп / агентский. Снимки баланса и equity для кривой капитала и лимитов пропа |
| Торговля | `orders`, `executions`, `trades`, `ledger_entries` | Ордера, исполнения (атом), сделки (round-trip), фандинг, депозиты, переводы и комиссии вне филлов |
| Разметка человека | `playbooks`, `rules`, `trade_rule_violations`, `tags`, `trade_tags`, `notes`, `attachments`, `daily_journals` | Стиль/сетап, правила и чек-лист, нарушения, теги, заметки текстом и голосом, скриншоты, дневник дня |
| Итоги и ИИ | `daily_summaries`, `ai_reviews` | Дневные итоги счёта (пересчитываются), еженедельные ИИ-разборы и разборы сделок |
| Агенты | `clusters`, `strategy_versions`, `agents`, `experiments`, `shadow_evaluations` | Кластер, неизменяемые версии (тень → бой), агент = кластер + версия + модель + счёт, арена, сравнение тени со старой версией |
| Сигналы и LLM | `detector_runs`, `signals`, `signal_events`, `agent_decisions`, `llm_calls` | Прогоны детектора, сигналы (вместо `out/*.json`), история статусов, решение ВЗЯТЬ/ПРОПУСТИТЬ с обоснованием, каждый вызов LLM с моделью, токенами и стоимостью |
| Риск | `risk_policies`, `risk_evaluations`, `risk_events` | Жёсткие лимиты (только человек), проверка каждого входа (одобрено / урезано / отклонено), события: kill-switch, пауза, лимит дня, тильт |
| Импорт и задачи | `import_jobs`, `import_cursors`, `raw_records`, `jobs` | Запуски импорта со счётчиками дублей, курсоры по потокам, сырые записи бирж, очередь фоновых задач |

### 1.2. Схема связей

```
organizations ─┬─< memberships >── users ──< auth_identities
               │
               ├─< accounts >── venues ──< instruments
               │     │  └── prop_profiles (правила пропа, версия по valid_from/valid_to)
               │     ├─< account_snapshots
               │     ├─< orders ──< executions >── raw_records (сырой ответ биржи)
               │     ├─< executions ─┐
               │     ├─< ledger_entries (фандинг, депозиты) ─┐
               │     └─< trades <────┴──────────────────────┘   trade = Σ executions + Σ ledger
               │           ├── playbook (стиль человека)        ├─< notes ── attachments (голос)
               │           ├── agent / strategy_version         ├─< attachments (скриншоты)
               │           ├── signal / agent_decision          ├─< trade_tags >── tags
               │           └─< trade_rule_violations >── rules  └─< risk_events (тильт)
               │
               ├─< clusters ─< strategy_versions (parent → child: линия версий)
               │       │             ├─< agents ── account (1:1, свой счёт) ── experiment (арена)
               │       │             └─< shadow_evaluations (кандидат vs база)
               │       └─< signals ─< signal_events
               │               └─< agent_decisions ─< llm_calls
               │                        └─< risk_evaluations ─< orders
               │
               ├─< risk_policies (account | agent | cluster | org)   ← пишет только человек
               ├─< risk_events
               ├─< daily_journals (человек × дата) / daily_summaries (счёт × дата)
               └─< import_jobs ── import_cursors (счёт × поток)
```

### 1.3. Ключевые решения по сущностям

1. **Агент = своя строка `agents` + свой `accounts` (owner_type = AGENT).** Связь 1:1 (`agents.account_id`
   уникален), как требует ARCHITECTURE.md: «у каждого экземпляра свой счёт». Стата по агенту — это стата по счёту.
2. **Версии стратегий неизменяемы.** `strategy_versions.config` — снимок `config.json`/`rules.yaml`,
   `config_hash` — sha256 канонического JSON. Правка = новая строка со `status = SHADOW`. `ACTIVE` ставится
   только при заполненном `approved_by_id` (человек), запись идёт в `audit_logs`. Источник истины для карточки
   по-прежнему репозиторий: в БД — снимок, чтобы любую сделку и сигнал можно было привязать к точной версии.
3. **Профиль пропа и риск-политика неизменяемы.** Правила фирмы поменялись — новая строка, у старой
   проставляется `valid_to`. Старые `risk_evaluations` ссылаются на ту редакцию, которая действовала в момент проверки.
4. **Справочники глобальные.** `venues` и `instruments` — без `organization_id`: MEXC один для всех. У
   `prop_profiles.organization_id` null означает системный шаблон студии, заполненный — профиль пользователя.
5. **Психология — колонками на сделке, а не отдельной таблицей.** Поля: `emotion_before/after` (код из
   настраиваемого списка), `confidence` 1–10, `followed_plan`, `entry_reason`. Нарушенные правила — связь с
   `rules`, потому что их нужно считать («сколько стоило нарушение правила X»).
6. **Тильт (Ф2) пишем в `risk_events` с `scope = USER` и `kind = tilt_*`.** Один механизм уведомлений для
   человека и агента. Триггеры из TZ дневника: вход < 5 мин после убытка, рост лота после убытка, > N сделок
   за день, серия убытков, ночь, стоп = ликвидация (есть флаг `trades.stop_is_liquidation`).
7. **LLM-вызовы — одна таблица на всю систему.** Сюда идут роли мозга кластера, улучшатели, разбор голоса и
   еженедельный разбор дневника. `billing = SUBSCRIPTION`, пока решает Hermes на подписке: токены и стоимость
   могут быть неизвестны (`cost_usd = null`), это честнее нуля.
8. **Файлы — не в БД.** Скриншоты, картинки детектора и голосовые лежат в S3-совместимом хранилище, в БД только
   `storage_key`, `sha256` и размер. Где стоит хранилище — вопрос раздела A (A2/A4).
9. **Ключи бирж в MVP — только в `.env` на сервере.** `accounts.credential_ref = "env:MEXC_RO"` — ссылка, не
   секрет. Таблица `exchange_credentials` (шифр + id ключа KMS) заложена под SaaS и в MVP пустая.
10. **Мягкое удаление** (`deleted_at`) — только там, что правит человек: сделки, заметки, вложения, теги,
    стили, правила, счета. Журналы (`executions`, `llm_calls`, `risk_*`, `signals`) только дописываются.
    Физическое удаление по запросу субъекта ПД (152-ФЗ) — отдельная задача purge по `organization_id`
    (каскады в схеме это позволяют).

---

## 2. Числа: почему Decimal(38,18), а не целые центы

**Правило студии** — «все деньги в целых числах (копейки/центы)». Для магазинов оно верное: одна валюта, два
знака после запятой. В крипте оно ломается в трёх местах:

- **Цена.** Мемкоины стоят 0.00000012 USDT, шаг цены — 1e-8 и мельче. В центах это 0.
- **Объём.** BTC торгуется шагом 0.0001 и мельче, мемкоины — миллиардами штук. Единого «цента» для объёма нет.
- **Комиссии и фандинг** приходят в разных активах (USDT, монета, BNB/MX) с точностью до 1e-8 и мельче.

**Варианты:**

| Вариант | Плюсы | Минусы | Решение |
|---------|-------|--------|---------|
| float / double | Быстро | Ошибки округления в PnL: 0.1 + 0.2 ≠ 0.3. Для денег запрещено | Нет |
| Целые «атомарные единицы» (как сатоши) со своим масштабом на инструмент | Точно, быстро | Масштаб свой у каждого инструмента и актива. Любое умножение цены на объём требует ручного масштабирования. Легко ошибиться на порядок, сырой SQL читать тяжело | Нет |
| **NUMERIC(38,18)** | Точно, без масштабов: 20 знаков до запятой и 18 после. Покрывает цену 1e-18…1e20 и любые объёмы. Postgres считает точно, Prisma отдаёт `Decimal`, Python — `decimal.Decimal` | Медленнее float. На наших объёмах (до ~1e6 сделок) незаметно | **Да** |

**Правила:**
- `Decimal(38,18)` («Px») — цены, объёмы, суммы, комиссии, PnL, балансы.
- `Decimal(20,8)` («Ratio») — проценты, плечо, R-множитель, R:R.
- `Decimal(20,10)` — стоимость LLM в USD: доли цента за вызов.
- `Decimal(5,4)` — confidence LLM 0..1.
- **В API числа уходят строками** (`"83332.29"`), не JSON-number: иначе JS превратит их во float. Во float
  переводим только на краю — для отрисовки графика.
- **Python:** `float()` на деньгах запрещён. Детектор сейчас считает во float (`sl = 83543.89649799999` в
  `setups.json`), поэтому на границе с БД уровни квантуются по `instruments.tick_size` (`tp_core.money.quantize`).
- **Правило «в центах» остаётся для биллинга Ф3:** подписка в рублях хранится в копейках (Int). Это фиат,
  там правило правильное.

---

## 3. Prisma + Python в одной БД: варианты и выбор

| Вариант | Как | Плюсы | Минусы |
|---------|-----|-------|--------|
| **A. Prisma владеет миграциями, Python — SQLAlchemy Core** | `shared/db/prisma` — единственная схема. Python берёт таблицы из `sqlacodegen` по живой БД, файл коммитится, CI проверяет дрейф | Одна схема. Дневник (TS) получает типы Prisma. Python пишет сырой SQL с `ON CONFLICT`, что нужно импорту и движку | Python-модели генерируются, а не пишутся руками. Нужна дисциплина «только через миграцию» |
| B. Alembic (Python) владеет, Prisma делает `db pull` | Миграции в Python | Удобно движку | Дневник — основной потребитель схемы. `db pull` теряет имена связей и комментарии, и их приходится чинить руками после каждой миграции |
| C. Prisma Client Python | Один ORM на оба языка | Одни модели | Проект сообщества, не Prisma Inc.; поддержка под вопросом (**проверить статус**). Опираться рискованно |
| D. Движок пишет только через HTTP API дневника | Одна точка записи | Строгая инкапсуляция | В горячем пути торговли появляется зависимость от веб-сервера: упал Next.js — агент не может записать ордер. Лишняя задержка |
| E. Две БД с синхронизацией | Независимость | — | Две правды о сделках, противоречит README («общая схема») |

**Выбор: A.** Дополнительно:
- **Роли PostgreSQL** (сырой SQL в миграции):
  - `tp_web` — всё по своим таблицам;
  - `tp_engine` — INSERT/UPDATE на `signals`, `signal_events`, `detector_runs`, `agent_decisions`,
    `llm_calls`, `risk_evaluations`, `risk_events`, `orders`, `executions`, `ledger_entries`, `trades`,
    `account_snapshots`, `jobs`. На `risk_policies` и `prop_profiles` — **только SELECT**. DELETE на журналах нет;
  - `tp_readonly` — аналитика.
- **Контракты между языками** — JSON Schema в `shared/contracts/` (сигнал, решение LLM, разбор голоса).
  Из них генерируются zod (TS) и pydantic (Python). Невалидный ответ LLM = HOLD, как в ТЗ.
- **Формулы — в SQL-функции.** Итоги сделки (VWAP входа и выхода, gross/fees/funding/net, R) считает функция
  `tp_recompute_trade(trade_id)` в миграции. Её вызывают и TS (`$executeRaw`), и Python — одна реализация на
  два языка. Сборку исполнений в сделки (кто к какой позиции) делает Python-импортёр (раздел 5).
- **Что Prisma-схема не выражает, докладываем сырым SQL** в той же миграции (`prisma migrate dev --create-only`):
  - CHECK-ограничения: `confidence BETWEEN 1 AND 10`, `qty > 0`, `price > 0`;
  - функции пересчёта;
  - роли и GRANT;
  - частичный индекс «один RUNNING-импорт на счёт»;
  - при SaaS — RLS-политики по `organization_id`.

---

## 4. Prisma-схема

Файл живёт в `shared/db/prisma/schema.prisma` (раздел 6). Ниже — полный текст, прошедший `prisma validate`.
Подключение к БД — в `prisma.config.ts` (Prisma 7 убрал `url` из `datasource`).

```prisma
// =====================================================================
// trade-performance — общая схема БД (journal + prop-agents)
// Владелец миграций: Prisma (shared/db). Python-движок читает/пишет через SQL.
// Соглашения:
//   * таблицы и колонки в snake_case (@@map/@map) — удобно для сырого SQL и Python;
//   * id — UUID (генерирует БД, Python тоже может прислать свой uuid);
//   * время — timestamptz(6), всегда UTC;
//   * цены/объёмы/суммы — Decimal(38,18) («Px»), проценты/R — Decimal(20,8) («Ratio»);
//   * organization_id — на каждой бизнес-таблице; справочники (venue, instrument) — глобальные;
//   * deleted_at — только на таблицах, которые правит человек; журналы (fills, llm_calls,
//     risk) — append-only, не удаляются мягко.
// =====================================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

// ---------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------

enum OrgRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

enum VenueKind {
  EXCHANGE // MEXC, Bybit
  PROP_FIRM // Propr, HyroTrader, SizeProp
  TESTNET // Hyperliquid testnet, OKX Demo, BloFin demo
  BROKER // MT5-брокер (Ф3)
  PAPER // внутренняя бумажная торговля / бэктест
}

enum AccountKind {
  LIVE
  DEMO
  PROP_CHALLENGE
  PROP_FUNDED
  PAPER
  BACKTEST
}

enum OwnerType {
  HUMAN
  AGENT
}

enum InstrumentKind {
  SPOT
  PERPETUAL
  FUTURE
  CFD
}

enum TradeSide {
  LONG
  SHORT
}

enum OrderSide {
  BUY
  SELL
}

enum Executor {
  HUMAN // руками (Герман / пользователь SaaS)
  AGENT // агент prop-agents
}

enum DataOrigin {
  MANUAL // веб-форма
  VOICE // голос из Telegram → разбор
  IMPORT // импорт с биржи/пропа
  ENGINE // записал движок prop-agents
}

enum TradeStatus {
  PLANNED
  OPEN
  CLOSED
  CANCELLED
}

enum OrderType {
  MARKET
  LIMIT
  STOP_MARKET
  STOP_LIMIT
  TAKE_PROFIT
  TRAILING_STOP
  OTHER
}

enum OrderStatus {
  NEW
  PARTIALLY_FILLED
  FILLED
  CANCELED
  REJECTED
  EXPIRED
}

enum LedgerKind {
  FUNDING
  FEE // комиссия, не привязанная к филлу
  REBATE
  DEPOSIT
  WITHDRAWAL
  TRANSFER_IN
  TRANSFER_OUT
  LIQUIDATION_FEE
  INSURANCE
  ADJUSTMENT
  OTHER
}

enum SignalMode {
  LIVE
  BACKTEST
  SHADOW
}

enum SignalStatus {
  PENDING
  OPEN
  WIN
  LOSS
  EXPIRED
  CANCELLED
}

enum DecisionAction {
  TAKE
  SKIP
  HOLD // невалидный ответ LLM → HOLD (правило ТЗ)
}

enum RiskVerdict {
  APPROVED
  REDUCED
  REJECTED
}

enum RiskScope {
  GLOBAL
  ORGANIZATION
  USER
  ACCOUNT
  AGENT
  CLUSTER
}

enum Severity {
  INFO
  WARN
  CRITICAL
}

enum VersionStatus {
  DRAFT
  SHADOW
  ACTIVE
  RETIRED
  REJECTED
}

enum AgentMode {
  LIVE
  SHADOW
  BASELINE
  PAPER
}

enum RunState {
  RUNNING
  PAUSED
  STOPPED
}

enum LlmBilling {
  API
  SUBSCRIPTION // Hermes на подписке: токены/стоимость могут быть неизвестны
  FREE
}

enum NoteKind {
  TEXT
  VOICE
}

enum Channel {
  WEB
  TELEGRAM
  API
  SYSTEM
}

enum AttachmentKind {
  SCREENSHOT
  CHART
  VOICE
  EXPORT
  OTHER
}

enum ImportStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  PARTIAL
  FAILED
  CANCELLED
}

enum JobStatus {
  QUEUED
  RUNNING
  DONE
  FAILED
  DEAD
}

enum ActorType {
  USER
  AGENT
  SYSTEM
}

// ---------------------------------------------------------------------
// 1. ТЕНАНТЫ И ДОСТУП
// ---------------------------------------------------------------------

/// Организация = тенант. Сейчас одна (Герман). Все бизнес-данные висят на ней.
/// plan — заготовка под биллинг Ф3 (таблиц биллинга пока нет).
model Organization {
  id        String    @id @default(uuid()) @db.Uuid
  name      String
  slug      String    @unique
  plan      String    @default("personal") // Ф3: free/pro/team; деньги биллинга — в целых копейках
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

  memberships   Membership[]
  apiTokens     ApiToken[]
  accounts      Account[]
  propProfiles  PropProfile[]
  riskPolicies  RiskPolicy[]
  trades        Trade[]
  executions    Execution[]
  orders        Order[]
  ledger        LedgerEntry[]
  snapshots     AccountSnapshot[]
  playbooks     Playbook[]
  rules         Rule[]
  tags          Tag[]
  notes         Note[]
  attachments   Attachment[]
  dailyJournals DailyJournal[]
  dailySummary  DailySummary[]
  aiReviews     AiReview[]
  clusters      Cluster[]
  versions      StrategyVersion[]
  agents        Agent[]
  experiments   Experiment[]
  evaluations   ShadowEvaluation[]
  detectorRuns  DetectorRun[]
  signals       Signal[]
  decisions     AgentDecision[]
  llmCalls      LlmCall[]
  riskEvals     RiskEvaluation[]
  riskEvents    RiskEvent[]
  importJobs    ImportJob[]
  rawRecords    RawRecord[]
  credentials   ExchangeCredential[]
  auditLogs     AuditLog[]

  @@map("organizations")
}

/// Человек. Аутентификация (как вошёл) — AuthIdentity; авторизация (что можно) — Membership.role.
model User {
  id             String    @id @default(uuid()) @db.Uuid
  name           String?
  email          String?   @unique
  phone          String?   @unique // E.164; кандидат в основной способ входа (РКН A3)
  telegramUserId BigInt?   @unique @map("telegram_user_id")
  timezone       String    @default("Europe/Moscow") // граница «торгового дня» человека
  locale         String    @default("ru")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)

  memberships   Membership[]
  identities    AuthIdentity[]
  apiTokens     ApiToken[]
  accounts      Account[]
  notes         Note[]
  dailyJournals DailyJournal[]
  playbooks     Playbook[]
  rules         Rule[]
  aiReviews     AiReview[]
  uploads       Attachment[]   @relation("AttachmentUploader")

  @@map("users")
}

/// Членство пользователя в организации + роль (RBAC).
model Membership {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  userId         String   @map("user_id") @db.Uuid
  role           OrgRole  @default(OWNER)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([userId])
  @@map("memberships")
}

/// Способ входа: phone / telegram / email / esia ... Секреты (пароли) здесь не храним.
model AuthIdentity {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String   @map("user_id") @db.Uuid
  provider       String // "phone" | "telegram" | "email" | "esia" — см. РКН A3
  providerUserId String   @map("provider_user_id")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@index([userId])
  @@map("auth_identities")
}

/// Сервисные токены: Hermes (голос/команды из Telegram), движок prop-agents, скрипты.
/// Храним только хэш токена.
model ApiToken {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  userId         String?   @map("user_id") @db.Uuid
  name           String
  tokenHash      String    @unique @map("token_hash")
  scopes         String[] // напр. ["notes:write","trades:write","signals:read"]
  lastUsedAt     DateTime? @map("last_used_at") @db.Timestamptz(6)
  expiresAt      DateTime? @map("expires_at") @db.Timestamptz(6)
  revokedAt      DateTime? @map("revoked_at") @db.Timestamptz(6)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User?        @relation(fields: [userId], references: [id])

  @@index([organizationId])
  @@map("api_tokens")
}

/// Журнал значимых действий: кто менял риск-лимиты, профили пропов, повышал версии.
/// Обязателен, т.к. «жёсткие лимиты меняет только Герман» должно быть проверяемо.
model AuditLog {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  actorType      ActorType @map("actor_type")
  actorId        String?   @map("actor_id") // user.id / agent.id / имя сервиса
  action         String // "risk_policy.update", "version.promote", "trade.merge" ...
  entity         String
  entityId       String?   @map("entity_id")
  before         Json?
  after          Json?
  at             DateTime  @default(now()) @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, at])
  @@index([entity, entityId])
  @@map("audit_logs")
}

// ---------------------------------------------------------------------
// 2. СПРАВОЧНИКИ: ПЛОЩАДКИ, ИНСТРУМЕНТЫ, ПРОФИЛИ ПРОПОВ
// ---------------------------------------------------------------------

/// Площадка: биржа, проп, тестнет. Глобальный справочник (без organization_id).
model Venue {
  id          String    @id @default(uuid()) @db.Uuid
  slug        String    @unique // "mexc", "bybit", "hyperliquid-testnet", "propr", "hyrotrader", "manual"
  name        String
  kind        VenueKind
  hasApi      Boolean   @default(false) @map("has_api")
  meta        Json? // лимиты API, заметки; ничего секретного
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  instruments  Instrument[]
  accounts     Account[]
  propProfiles PropProfile[]

  @@map("venues")
}

/// Инструмент площадки. symbol — в нативном виде площадки (у MEXC spot "BTCUSDT",
/// у MEXC futures "BTC_USDT" — проверить). contract_size нужен там, где объём в контрактах.
model Instrument {
  id           String         @id @default(uuid()) @db.Uuid
  venueId      String         @map("venue_id") @db.Uuid
  symbol       String
  kind         InstrumentKind
  baseAsset    String         @map("base_asset")
  quoteAsset   String         @map("quote_asset")
  settleAsset  String?        @map("settle_asset") // в чём считается PnL (USDT)
  isInverse    Boolean        @default(false) @map("is_inverse") // coin-margined: MVP не поддерживает расчёт
  contractSize Decimal?       @map("contract_size") @db.Decimal(38, 18)
  tickSize     Decimal?       @map("tick_size") @db.Decimal(38, 18)
  stepSize     Decimal?       @map("step_size") @db.Decimal(38, 18)
  active       Boolean        @default(true)
  meta         Json?
  createdAt    DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime       @updatedAt @map("updated_at") @db.Timestamptz(6)

  venue      Venue         @relation(fields: [venueId], references: [id])
  trades     Trade[]
  executions Execution[]
  orders     Order[]
  ledger     LedgerEntry[]
  signals    Signal[]
  runs       DetectorRun[]

  @@unique([venueId, symbol, kind])
  @@index([baseAsset])
  @@map("instruments")
}

/// Правила пропа (программа + фаза). Неизменяемая запись: изменились правила → новая строка,
/// старая получает valid_to. organization_id = null → системный шаблон студии.
/// Не в промптах: читает риск-слой (код).
model PropProfile {
  id                  String    @id @default(uuid()) @db.Uuid
  organizationId      String?   @map("organization_id") @db.Uuid
  venueId             String    @map("venue_id") @db.Uuid
  program             String // "1-step 10k", "2-step phase 1" ...
  phase               String? // challenge / verification / funded
  accountSize         Decimal   @map("account_size") @db.Decimal(38, 18)
  profitTargetPct     Decimal?  @map("profit_target_pct") @db.Decimal(20, 8)
  dailyLossPct        Decimal?  @map("daily_loss_pct") @db.Decimal(20, 8)
  dailyLossMethod     String?   @map("daily_loss_method") // "start_of_day_balance" | "equity_high" | "static" — по правилам фирмы
  dailyResetTz        String?   @map("daily_reset_tz") // таймзона сброса дня у фирмы
  dailyResetTime      String?   @map("daily_reset_time") // "00:00"
  maxDrawdownPct      Decimal?  @map("max_drawdown_pct") @db.Decimal(20, 8)
  drawdownType        String?   @map("drawdown_type") // "static" | "trailing" | "trailing_eod"
  maxLeverage         Decimal?  @map("max_leverage") @db.Decimal(20, 8)
  stopLossRequired    Boolean   @default(false) @map("stop_loss_required")
  minTradingDays      Int?      @map("min_trading_days")
  consistencyRulePct  Decimal?  @map("consistency_rule_pct") @db.Decimal(20, 8)
  newsTradingAllowed  Boolean?  @map("news_trading_allowed")
  weekendHoldAllowed  Boolean?  @map("weekend_hold_allowed")
  botPolicy           String    @default("unknown") @map("bot_policy") // allowed | with_permission | forbidden | unknown
  botPermissionRef    String?   @map("bot_permission_ref") // ссылка на письменное разрешение фирмы
  forbiddenPractices  String[]  @map("forbidden_practices")
  extra               Json?
  sourceUrl           String?   @map("source_url") // где опубликованы правила
  verifiedAt          DateTime? @map("verified_at") @db.Timestamptz(6) // когда человек сверил с сайтом фирмы
  validFrom           DateTime  @default(now()) @map("valid_from") @db.Timestamptz(6)
  validTo             DateTime? @map("valid_to") @db.Timestamptz(6)
  createdAt           DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  venue        Venue         @relation(fields: [venueId], references: [id])
  accounts     Account[]
  riskEvals    RiskEvaluation[]

  @@index([venueId])
  @@index([organizationId])
  @@map("prop_profiles")
}

// ---------------------------------------------------------------------
// 3. СЧЕТА, КЛЮЧИ, СНИМКИ БАЛАНСА
// ---------------------------------------------------------------------

/// Торговый счёт: биржевой, демо, проп, агентский. Агентский = owner_type AGENT
/// (агент ссылается на счёт через agents.account_id — у каждого агента свой счёт).
model Account {
  id                String      @id @default(uuid()) @db.Uuid
  organizationId    String      @map("organization_id") @db.Uuid
  venueId           String      @map("venue_id") @db.Uuid
  propProfileId     String?     @map("prop_profile_id") @db.Uuid
  ownerType         OwnerType   @default(HUMAN) @map("owner_type")
  userId            String?     @map("user_id") @db.Uuid // для HUMAN
  name              String
  kind              AccountKind
  baseAsset         String      @default("USDT") @map("base_asset")
  externalAccountId String?     @map("external_account_id") // id/uid на площадке, если есть
  credentialRef     String?     @map("credential_ref") // MVP: имя переменной окружения ("env:MEXC_RO"), не секрет
  startingBalance   Decimal?    @map("starting_balance") @db.Decimal(38, 18)
  dayBoundaryTz     String?     @map("day_boundary_tz") // null → tz пользователя / prop_profile.daily_reset_tz
  active            Boolean     @default(true)
  openedAt          DateTime?   @map("opened_at") @db.Timestamptz(6)
  closedAt          DateTime?   @map("closed_at") @db.Timestamptz(6)
  createdAt         DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime    @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt         DateTime?   @map("deleted_at") @db.Timestamptz(6)

  organization Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  venue        Venue               @relation(fields: [venueId], references: [id])
  propProfile  PropProfile?        @relation(fields: [propProfileId], references: [id])
  user         User?               @relation(fields: [userId], references: [id])
  credential   ExchangeCredential?
  agent        Agent?
  trades       Trade[]
  executions   Execution[]
  orders       Order[]
  ledger       LedgerEntry[]
  snapshots    AccountSnapshot[]
  dailySummary DailySummary[]
  riskPolicies RiskPolicy[]
  riskEvals    RiskEvaluation[]
  riskEvents   RiskEvent[]
  importJobs   ImportJob[]
  cursors      ImportCursor[]
  rawRecords   RawRecord[]

  @@unique([venueId, externalAccountId])
  @@index([organizationId])
  @@index([userId])
  @@map("accounts")
}

/// Ф3 (SaaS): ключи пользователей, зашифрованные конвертным шифрованием (KMS).
/// В MVP НЕ используется: ключ MEXC (только чтение) лежит в .env на сервере.
model ExchangeCredential {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  accountId      String    @unique @map("account_id") @db.Uuid
  keyHint        String    @map("key_hint") // последние 4 символа, для UI
  ciphertext     Bytes
  encKeyId       String    @map("enc_key_id") // id ключа KMS
  readOnly       Boolean   @default(true) @map("read_only")
  scopes         String[]
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  rotatedAt      DateTime? @map("rotated_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@map("exchange_credentials")
}

/// Снимок баланса/equity счёта: equity curve, лимиты пропа, сверка Сторожем.
model AccountSnapshot {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  accountId      String   @map("account_id") @db.Uuid
  takenAt        DateTime @map("taken_at") @db.Timestamptz(6)
  balance        Decimal  @db.Decimal(38, 18)
  equity         Decimal  @db.Decimal(38, 18)
  unrealizedPnl  Decimal? @map("unrealized_pnl") @db.Decimal(38, 18)
  marginUsed     Decimal? @map("margin_used") @db.Decimal(38, 18)
  origin         DataOrigin
  raw            Json?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, takenAt])
  @@index([organizationId])
  @@map("account_snapshots")
}

// ---------------------------------------------------------------------
// 4. ТОРГОВЛЯ: ОРДЕРА, ИСПОЛНЕНИЯ, СДЕЛКИ, ДВИЖЕНИЯ СРЕДСТВ
// ---------------------------------------------------------------------

/// Ордер. Для импорта — что вернула биржа; для движка — что поставил Order Manager.
/// client_order_id генерирует движок → идемпотентность повторной отправки.
model Order {
  id               String      @id @default(uuid()) @db.Uuid
  organizationId   String      @map("organization_id") @db.Uuid
  accountId        String      @map("account_id") @db.Uuid
  instrumentId     String      @map("instrument_id") @db.Uuid
  tradeId          String?     @map("trade_id") @db.Uuid
  decisionId       String?     @map("decision_id") @db.Uuid
  riskEvaluationId String?     @map("risk_evaluation_id") @db.Uuid
  externalOrderId  String?     @map("external_order_id")
  clientOrderId    String?     @map("client_order_id")
  purpose          String? // entry | stop | take | exit | breakeven | trailing
  side             OrderSide
  type             OrderType
  timeInForce      String?     @map("time_in_force")
  reduceOnly       Boolean     @default(false) @map("reduce_only")
  price            Decimal?    @db.Decimal(38, 18)
  stopPrice        Decimal?    @map("stop_price") @db.Decimal(38, 18)
  qty              Decimal     @db.Decimal(38, 18) // в базовом активе (нормализовано)
  filledQty        Decimal     @default(0) @map("filled_qty") @db.Decimal(38, 18)
  avgFillPrice     Decimal?    @map("avg_fill_price") @db.Decimal(38, 18)
  leverage         Decimal?    @db.Decimal(20, 8)
  status           OrderStatus
  origin           DataOrigin
  placedAt         DateTime    @map("placed_at") @db.Timestamptz(6)
  updatedAt        DateTime    @updatedAt @map("updated_at") @db.Timestamptz(6)
  closedAt         DateTime?   @map("closed_at") @db.Timestamptz(6)
  raw              Json?

  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account        Account         @relation(fields: [accountId], references: [id], onDelete: Cascade)
  instrument     Instrument      @relation(fields: [instrumentId], references: [id])
  trade          Trade?          @relation(fields: [tradeId], references: [id])
  decision       AgentDecision?  @relation(fields: [decisionId], references: [id])
  riskEvaluation RiskEvaluation? @relation(fields: [riskEvaluationId], references: [id])
  executions     Execution[]

  @@unique([accountId, externalOrderId])
  @@unique([accountId, clientOrderId])
  @@index([organizationId, placedAt])
  @@index([tradeId])
  @@map("orders")
}

/// Исполнение (fill) — атом истины о торговле. Сделка (trade) собирается из исполнений.
/// Ручная сделка тоже пишет «синтетические» исполнения (external_id = "manual:<uuid>"),
/// чтобы у статистики был один путь расчёта.
model Execution {
  id             String     @id @default(uuid()) @db.Uuid
  organizationId String     @map("organization_id") @db.Uuid
  accountId      String     @map("account_id") @db.Uuid
  instrumentId   String     @map("instrument_id") @db.Uuid
  orderId        String?    @map("order_id") @db.Uuid
  tradeId        String?    @map("trade_id") @db.Uuid
  externalId     String     @map("external_id") // id сделки на бирже → ключ идемпотентности
  side           OrderSide
  positionSide   String?    @map("position_side") // long | short | both (hedge mode)
  price          Decimal    @db.Decimal(38, 18)
  qty            Decimal    @db.Decimal(38, 18) // в базовом активе
  qtyContracts   Decimal?   @map("qty_contracts") @db.Decimal(38, 18) // как отдала биржа, если в контрактах
  quoteQty       Decimal?   @map("quote_qty") @db.Decimal(38, 18)
  fee            Decimal    @default(0) @db.Decimal(38, 18) // со знаком: + списание, − ребейт
  feeAsset       String?    @map("fee_asset")
  feeQuote       Decimal?   @map("fee_quote") @db.Decimal(38, 18) // комиссия в валюте PnL на момент филла
  isMaker        Boolean?   @map("is_maker")
  realizedPnl    Decimal?   @map("realized_pnl") @db.Decimal(38, 18) // если биржа отдаёт сама
  executedAt     DateTime   @map("executed_at") @db.Timestamptz(6)
  origin         DataOrigin
  rawRecordId    String?    @map("raw_record_id") @db.Uuid
  createdAt      DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  instrument   Instrument   @relation(fields: [instrumentId], references: [id])
  order        Order?       @relation(fields: [orderId], references: [id])
  trade        Trade?       @relation(fields: [tradeId], references: [id])
  rawRecord    RawRecord?   @relation(fields: [rawRecordId], references: [id])

  @@unique([accountId, externalId])
  @@index([organizationId, executedAt])
  @@index([accountId, instrumentId, executedAt])
  @@index([tradeId])
  @@map("executions")
}

/// Сделка = позиция от открытия до закрытия (round-trip). Единая модель для человека и агента.
/// Кто исполнял — executor; откуда пришли данные — origin; по чьему сигналу — signal_id.
/// Денормализованные итоги (entry_avg, net_pnl, r_multiple...) пересчитывает
/// SQL-функция tp_recompute_trade(id) из executions + ledger_entries (одна реализация для TS и Python).
model Trade {
  id                 String      @id @default(uuid()) @db.Uuid
  organizationId     String      @map("organization_id") @db.Uuid
  accountId          String      @map("account_id") @db.Uuid
  instrumentId       String      @map("instrument_id") @db.Uuid
  executor           Executor
  origin             DataOrigin
  agentId            String?     @map("agent_id") @db.Uuid
  strategyVersionId  String?     @map("strategy_version_id") @db.Uuid
  signalId           String?     @map("signal_id") @db.Uuid
  decisionId         String?     @map("decision_id") @db.Uuid
  playbookId         String?     @map("playbook_id") @db.Uuid // стиль/сетап человека: «SMC 15m», «Шорт пампов»
  status             TradeStatus
  side               TradeSide
  timeframe          String? // "5m", "15m"
  openedAt           DateTime?   @map("opened_at") @db.Timestamptz(6)
  closedAt           DateTime?   @map("closed_at") @db.Timestamptz(6)

  // --- план (что собирался сделать) ---
  plannedEntry       Decimal?    @map("planned_entry") @db.Decimal(38, 18)
  plannedStop        Decimal?    @map("planned_stop") @db.Decimal(38, 18)
  plannedTakeProfits Decimal[]   @map("planned_take_profits") @db.Decimal(38, 18)
  plannedRiskQuote   Decimal?    @map("planned_risk_quote") @db.Decimal(38, 18) // 1R в валюте PnL
  stopIsLiquidation  Boolean     @default(false) @map("stop_is_liquidation") // триггер тильта Ф2 + метрика «цена ликвидационного стопа»

  // --- факт (пересчитывается из исполнений) ---
  leverage           Decimal?    @db.Decimal(20, 8)
  marginMode         String?     @map("margin_mode") // isolated | cross
  marginUsed         Decimal?    @map("margin_used") @db.Decimal(38, 18)
  liquidationPrice   Decimal?    @map("liquidation_price") @db.Decimal(38, 18)
  actualStop         Decimal?    @map("actual_stop") @db.Decimal(38, 18) // последний стоп на бирже перед выходом
  maxQty             Decimal?    @map("max_qty") @db.Decimal(38, 18)
  entryAvg           Decimal?    @map("entry_avg") @db.Decimal(38, 18)
  exitAvg            Decimal?    @map("exit_avg") @db.Decimal(38, 18)
  pnlAsset           String?     @map("pnl_asset") // USDT
  grossPnl           Decimal?    @map("gross_pnl") @db.Decimal(38, 18)
  fees               Decimal?    @db.Decimal(38, 18)
  funding            Decimal?    @db.Decimal(38, 18)
  netPnl             Decimal?    @map("net_pnl") @db.Decimal(38, 18)
  netPnlUsd          Decimal?    @map("net_pnl_usd") @db.Decimal(38, 18) // для сводной статистики по разным валютам
  returnPct          Decimal?    @map("return_pct") @db.Decimal(20, 8) // к марже
  rMultiple          Decimal?    @map("r_multiple") @db.Decimal(20, 8)
  mfe                Decimal?    @db.Decimal(38, 18) // макс. благоприятное движение (Ф2, по свечам)
  mae                Decimal?    @db.Decimal(38, 18)
  recomputedAt       DateTime?   @map("recomputed_at") @db.Timestamptz(6)

  // --- психология (заполняет человек; для агента — пусто) ---
  entryReason        String?     @map("entry_reason")
  emotionBefore      String?     @map("emotion_before") // код из справочника эмоций (настраиваемый список)
  emotionAfter       String?     @map("emotion_after")
  confidence         Int? // 1–10, CHECK в SQL-миграции
  followedPlan       Boolean?    @map("followed_plan")

  // --- идемпотентность и дубликаты ---
  externalPositionId String?     @map("external_position_id") // id позиции на бирже, если есть
  idempotencyKey     String?     @map("idempotency_key") // из заголовка Idempotency-Key (ручной/голосовой ввод)
  possibleDuplicateOfId String?  @map("possible_duplicate_of_id") @db.Uuid // ручная сделка ↔ импортированная
  mergedIntoId       String?     @map("merged_into_id") @db.Uuid

  createdAt          DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime    @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt          DateTime?   @map("deleted_at") @db.Timestamptz(6)

  organization      Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account           Account          @relation(fields: [accountId], references: [id], onDelete: Cascade)
  instrument        Instrument       @relation(fields: [instrumentId], references: [id])
  agent             Agent?           @relation(fields: [agentId], references: [id])
  strategyVersion   StrategyVersion? @relation(fields: [strategyVersionId], references: [id])
  signal            Signal?          @relation(fields: [signalId], references: [id])
  decision          AgentDecision?   @relation(fields: [decisionId], references: [id])
  playbook          Playbook?        @relation(fields: [playbookId], references: [id])
  possibleDuplicate Trade?           @relation("TradeDuplicate", fields: [possibleDuplicateOfId], references: [id])
  duplicates        Trade[]          @relation("TradeDuplicate")
  mergedInto        Trade?           @relation("TradeMerge", fields: [mergedIntoId], references: [id])
  mergedFrom        Trade[]          @relation("TradeMerge")
  executions        Execution[]
  orders            Order[]
  ledger            LedgerEntry[]
  tags              TradeTag[]
  violations        TradeRuleViolation[]
  notes             Note[]
  attachments       Attachment[]
  riskEvents        RiskEvent[]
  aiReviews         AiReview[]

  @@unique([accountId, externalPositionId])
  @@unique([organizationId, idempotencyKey])
  @@index([organizationId, closedAt])
  @@index([organizationId, openedAt])
  @@index([accountId, instrumentId, openedAt])
  @@index([agentId])
  @@index([signalId])
  @@index([playbookId])
  @@map("trades")
}

/// Движения средств вне филлов: фандинг, отдельные комиссии, депозиты/выводы, переводы.
/// Нужны для честного PnL сделки (фандинг) и equity curve (депозит ≠ прибыль).
model LedgerEntry {
  id             String     @id @default(uuid()) @db.Uuid
  organizationId String     @map("organization_id") @db.Uuid
  accountId      String     @map("account_id") @db.Uuid
  instrumentId   String?    @map("instrument_id") @db.Uuid
  tradeId        String?    @map("trade_id") @db.Uuid // фандинг привязывается к открытой в этот момент сделке
  kind           LedgerKind
  externalId     String     @map("external_id") // id записи на бирже; для синтетики — "calc:<...>"
  asset          String
  amount         Decimal    @db.Decimal(38, 18) // со знаком: + приход, − расход
  amountQuote    Decimal?   @map("amount_quote") @db.Decimal(38, 18)
  occurredAt     DateTime   @map("occurred_at") @db.Timestamptz(6)
  origin         DataOrigin
  rawRecordId    String?    @map("raw_record_id") @db.Uuid
  createdAt      DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  instrument   Instrument?  @relation(fields: [instrumentId], references: [id])
  trade        Trade?       @relation(fields: [tradeId], references: [id])
  rawRecord    RawRecord?   @relation(fields: [rawRecordId], references: [id])

  @@unique([accountId, kind, externalId])
  @@index([organizationId, occurredAt])
  @@index([tradeId])
  @@map("ledger_entries")
}

// ---------------------------------------------------------------------
// 5. РАЗМЕТКА ЧЕЛОВЕКА: СТИЛИ, ПРАВИЛА, ТЕГИ, ЗАМЕТКИ, ВЛОЖЕНИЯ, ДНИ
// ---------------------------------------------------------------------

/// Стиль/сетап человека («SMC 15m BTC», «Шорт пампов MEXC»). Для агентов вместо этого — StrategyVersion.
model Playbook {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  userId         String?   @map("user_id") @db.Uuid
  name           String
  description    String?
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User?        @relation(fields: [userId], references: [id])
  trades       Trade[]
  rules        Rule[]

  @@unique([organizationId, name])
  @@map("playbooks")
}

/// Правило человека: пункт чек-листа (Ф2) или жёсткое правило. Нарушения — TradeRuleViolation.
model Rule {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  userId         String?   @map("user_id") @db.Uuid
  playbookId     String?   @map("playbook_id") @db.Uuid
  code           String // короткий код: "no_reentry_5m", "stop_not_liq"
  text           String
  kind           String    @default("rule") // rule | checklist
  sortOrder      Int       @default(0) @map("sort_order")
  active         Boolean   @default(true)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User?                @relation(fields: [userId], references: [id])
  playbook     Playbook?            @relation(fields: [playbookId], references: [id])
  violations   TradeRuleViolation[]

  @@unique([organizationId, code])
  @@map("rules")
}

model TradeRuleViolation {
  tradeId   String   @map("trade_id") @db.Uuid
  ruleId    String   @map("rule_id") @db.Uuid
  comment   String?
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  trade Trade @relation(fields: [tradeId], references: [id], onDelete: Cascade)
  rule  Rule  @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  @@id([tradeId, ruleId])
  @@map("trade_rule_violations")
}

model Tag {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  name           String
  color          String?
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trades       TradeTag[]

  @@unique([organizationId, name])
  @@map("tags")
}

model TradeTag {
  tradeId String @map("trade_id") @db.Uuid
  tagId   String @map("tag_id") @db.Uuid

  trade Trade @relation(fields: [tradeId], references: [id], onDelete: Cascade)
  tag   Tag   @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([tradeId, tagId])
  @@index([tagId])
  @@map("trade_tags")
}

/// Заметка: текст или голос. Голос из Telegram: аудио → Attachment, распознанный текст → transcript,
/// структурированный разбор (сделка/эмоция/правило) → parsed. Telegram-id → идемпотентность.
model Note {
  id                String    @id @default(uuid()) @db.Uuid
  organizationId    String    @map("organization_id") @db.Uuid
  userId            String    @map("user_id") @db.Uuid
  tradeId           String?   @map("trade_id") @db.Uuid
  dayDate           DateTime? @map("day_date") @db.Date // заметка к дню, а не к сделке
  kind              NoteKind
  channel           Channel
  text              String?
  transcript        String?
  audioAttachmentId String?   @unique @map("audio_attachment_id") @db.Uuid
  durationSec       Int?      @map("duration_sec")
  parsed            Json? // результат LLM-разбора голосовой заметки
  parseStatus       String?   @map("parse_status") // pending | done | failed | confirmed
  telegramChatId    BigInt?   @map("telegram_chat_id")
  telegramMessageId BigInt?   @map("telegram_message_id")
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt         DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id])
  trade        Trade?       @relation(fields: [tradeId], references: [id])
  audio        Attachment?  @relation("NoteAudio", fields: [audioAttachmentId], references: [id])
  attachments  Attachment[] @relation("NoteAttachments")
  llmCalls     LlmCall[]

  @@unique([telegramChatId, telegramMessageId])
  @@index([organizationId, createdAt])
  @@index([tradeId])
  @@map("notes")
}

/// Файл (скриншот, картинка графика детектора, голосовое). Сам файл — в объектном хранилище
/// (S3-совместимое), в БД только ключ и метаданные. Не BYTEA.
model Attachment {
  id             String         @id @default(uuid()) @db.Uuid
  organizationId String         @map("organization_id") @db.Uuid
  kind           AttachmentKind
  storageKey     String         @unique @map("storage_key")
  mime           String
  sizeBytes      Int            @map("size_bytes")
  sha256         String
  width          Int?
  height         Int?
  tradeId        String?        @map("trade_id") @db.Uuid
  noteId         String?        @map("note_id") @db.Uuid
  uploadedById   String?        @map("uploaded_by_id") @db.Uuid
  createdAt      DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  deletedAt      DateTime?      @map("deleted_at") @db.Timestamptz(6)

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trade        Trade?        @relation(fields: [tradeId], references: [id])
  note         Note?         @relation("NoteAttachments", fields: [noteId], references: [id])
  uploadedBy   User?         @relation("AttachmentUploader", fields: [uploadedById], references: [id])
  audioOf      Note?         @relation("NoteAudio")
  signals      Signal[]
  detectorRuns DetectorRun[]

  @@index([organizationId, createdAt])
  @@index([tradeId])
  @@index([sha256])
  @@map("attachments")
}

/// День глазами человека: настрой, оценка дисциплины, итоговая заметка.
model DailyJournal {
  id              String   @id @default(uuid()) @db.Uuid
  organizationId  String   @map("organization_id") @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  date            DateTime @db.Date // локальная дата в tz пользователя
  mood            String?
  disciplineScore Int?     @map("discipline_score") // 1–10
  plan            String?
  summary         String?
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id])

  @@unique([userId, date])
  @@index([organizationId, date])
  @@map("daily_journals")
}

/// Дневные итоги счёта (производная таблица, пересчитывается). Граница дня — по tz счёта/пропа.
model DailySummary {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  accountId      String   @map("account_id") @db.Uuid
  date           DateTime @db.Date
  dayTz          String   @map("day_tz")
  startBalance   Decimal? @map("start_balance") @db.Decimal(38, 18)
  endBalance     Decimal? @map("end_balance") @db.Decimal(38, 18)
  startEquity    Decimal? @map("start_equity") @db.Decimal(38, 18)
  endEquity      Decimal? @map("end_equity") @db.Decimal(38, 18)
  realizedPnl    Decimal  @default(0) @map("realized_pnl") @db.Decimal(38, 18)
  fees           Decimal  @default(0) @db.Decimal(38, 18)
  funding        Decimal  @default(0) @db.Decimal(38, 18)
  netPnl         Decimal  @default(0) @map("net_pnl") @db.Decimal(38, 18)
  netFlows       Decimal  @default(0) @map("net_flows") @db.Decimal(38, 18) // депозиты − выводы
  maxDrawdownPct Decimal? @map("max_drawdown_pct") @db.Decimal(20, 8)
  tradesCount    Int      @default(0) @map("trades_count")
  wins           Int      @default(0)
  losses         Int      @default(0)
  computedAt     DateTime @map("computed_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, date])
  @@index([organizationId, date])
  @@map("daily_summaries")
}

/// ИИ-разбор: еженедельный (человек), разбор сделки, Post-Trade Reviewer агента.
model AiReview {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  userId         String?  @map("user_id") @db.Uuid
  agentId        String?  @map("agent_id") @db.Uuid
  tradeId        String?  @map("trade_id") @db.Uuid
  kind           String // weekly | trade | post_trade | strategy_research
  periodFrom     DateTime? @map("period_from") @db.Timestamptz(6)
  periodTo       DateTime? @map("period_to") @db.Timestamptz(6)
  status         String   @default("queued") // queued | done | failed
  contentMd      String?  @map("content_md")
  findings       Json? // [{type:"pattern", text, tradeIds[]}, ...]
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User?        @relation(fields: [userId], references: [id])
  agent        Agent?       @relation(fields: [agentId], references: [id])
  trade        Trade?       @relation(fields: [tradeId], references: [id])
  llmCalls     LlmCall[]

  @@index([organizationId, createdAt])
  @@map("ai_reviews")
}

// ---------------------------------------------------------------------
// 6. PROP-AGENTS: КЛАСТЕРЫ, ВЕРСИИ, АГЕНТЫ, АРЕНА
// ---------------------------------------------------------------------

/// Кластер = стратегия (smc-btc, ma-cross). Карточка живёт в репо: clusters/<slug>/.
model Cluster {
  id               String   @id @default(uuid()) @db.Uuid
  organizationId   String   @map("organization_id") @db.Uuid
  slug             String
  name             String
  repoPath         String   @map("repo_path") // trade-performance/prop-agents/clusters/smc-btc
  telegramChatId   BigInt?  @map("telegram_chat_id")
  telegramThreadId BigInt?  @map("telegram_thread_id")
  state            RunState @default(RUNNING)
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  versions     StrategyVersion[]
  agents       Agent[]
  signals      Signal[]
  riskPolicies RiskPolicy[]
  riskEvents   RiskEvent[]

  @@unique([organizationId, slug])
  @@map("clusters")
}

/// Версия стратегии = снимок config.json/rules.yaml + коммит карточки. Неизменяема.
/// Новая версия (правка Германа или Strategy Researcher) → SHADOW → ACTIVE только с approved_by.
model StrategyVersion {
  id           String        @id @default(uuid()) @db.Uuid
  organizationId String      @map("organization_id") @db.Uuid
  clusterId    String        @map("cluster_id") @db.Uuid
  version      String // "0.1"
  status       VersionStatus @default(DRAFT)
  config       Json // содержимое config.json / rules.yaml
  configHash   String        @map("config_hash") // sha256 канонического JSON
  gitCommit    String?       @map("git_commit")
  parentId     String?       @map("parent_id") @db.Uuid
  changelog    String?
  createdBy    ActorType     @map("created_by")
  approvedById String?       @map("approved_by_id") @db.Uuid // только человек
  approvedAt   DateTime?     @map("approved_at") @db.Timestamptz(6)
  promotedAt   DateTime?     @map("promoted_at") @db.Timestamptz(6)
  retiredAt    DateTime?     @map("retired_at") @db.Timestamptz(6)
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  cluster      Cluster            @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  parent       StrategyVersion?   @relation("VersionLineage", fields: [parentId], references: [id])
  children     StrategyVersion[]  @relation("VersionLineage")
  agents       Agent[]
  signals      Signal[]
  runs         DetectorRun[]
  decisions    AgentDecision[]
  trades       Trade[]
  asCandidate  ShadowEvaluation[] @relation("EvalCandidate")
  asBaseline   ShadowEvaluation[] @relation("EvalBaseline")

  @@unique([clusterId, version])
  @@unique([clusterId, configHash])
  @@index([organizationId])
  @@map("strategy_versions")
}

/// Агент = кластер + версия + модель + площадка; свой счёт (account_id уникален) и свой топик.
model Agent {
  id                String    @id @default(uuid()) @db.Uuid
  organizationId    String    @map("organization_id") @db.Uuid
  clusterId         String    @map("cluster_id") @db.Uuid
  strategyVersionId String    @map("strategy_version_id") @db.Uuid
  accountId         String    @unique @map("account_id") @db.Uuid
  experimentId      String?   @map("experiment_id") @db.Uuid
  name              String
  model             String // "claude-opus-5.5", "openrouter/…", "none" для бейзлайна
  mode              AgentMode
  replica           Int       @default(1) // повтор N≥3 в арене
  state             RunState  @default(RUNNING)
  telegramThreadId  BigInt?   @map("telegram_thread_id")
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  stoppedAt         DateTime? @map("stopped_at") @db.Timestamptz(6)

  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  cluster         Cluster         @relation(fields: [clusterId], references: [id])
  strategyVersion StrategyVersion @relation(fields: [strategyVersionId], references: [id])
  account         Account         @relation(fields: [accountId], references: [id])
  experiment      Experiment?     @relation(fields: [experimentId], references: [id])
  decisions       AgentDecision[]
  trades          Trade[]
  riskPolicies    RiskPolicy[]
  riskEvals       RiskEvaluation[]
  riskEvents      RiskEvent[]
  aiReviews       AiReview[]

  @@index([organizationId])
  @@index([clusterId])
  @@index([experimentId])
  @@map("agents")
}

/// Эксперимент арены: матрица {модель × кластер × площадка} на период.
model Experiment {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  name           String
  hypothesis     String?
  config         Json?
  startedAt      DateTime  @map("started_at") @db.Timestamptz(6)
  endedAt        DateTime? @map("ended_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  agents       Agent[]

  @@index([organizationId])
  @@map("experiments")
}

/// Итог сравнения тени со старой версией (Shadow Evaluator). Решение о замене — человек.
model ShadowEvaluation {
  id                 String   @id @default(uuid()) @db.Uuid
  organizationId     String   @map("organization_id") @db.Uuid
  candidateVersionId String   @map("candidate_version_id") @db.Uuid
  baselineVersionId  String   @map("baseline_version_id") @db.Uuid
  periodFrom         DateTime @map("period_from") @db.Timestamptz(6)
  periodTo           DateTime @map("period_to") @db.Timestamptz(6)
  metrics            Json // после комиссий и стоимости LLM: netR, PF, maxDD, trades, llmCostUsd ...
  verdict            String // candidate_better | not_better | insufficient_data
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  candidate    StrategyVersion @relation("EvalCandidate", fields: [candidateVersionId], references: [id])
  baseline     StrategyVersion @relation("EvalBaseline", fields: [baselineVersionId], references: [id])

  @@index([organizationId])
  @@map("shadow_evaluations")
}

// ---------------------------------------------------------------------
// 7. СИГНАЛЫ, РЕШЕНИЯ LLM, СТОИМОСТЬ
// ---------------------------------------------------------------------

/// Прогон детектора: бэктест (история) или live-прогон, в котором что-то нашлось.
/// Пустые live-прогоны каждые 5 мин не пишем (это heartbeat — в логи/метрики).
model DetectorRun {
  id                String     @id @default(uuid()) @db.Uuid
  organizationId    String     @map("organization_id") @db.Uuid
  strategyVersionId String     @map("strategy_version_id") @db.Uuid
  instrumentId      String     @map("instrument_id") @db.Uuid
  mode              SignalMode
  timeframe         String
  rangeFrom         DateTime   @map("range_from") @db.Timestamptz(6)
  rangeTo           DateTime   @map("range_to") @db.Timestamptz(6)
  candles           Int
  stats             Json? // {setups, closed, winrate, sumR, sumRAfterFees}
  chartAttachmentId String?    @map("chart_attachment_id") @db.Uuid
  startedAt         DateTime   @map("started_at") @db.Timestamptz(6)
  finishedAt        DateTime?  @map("finished_at") @db.Timestamptz(6)
  error             String?

  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  strategyVersion StrategyVersion @relation(fields: [strategyVersionId], references: [id])
  instrument      Instrument      @relation(fields: [instrumentId], references: [id])
  chart           Attachment?     @relation(fields: [chartAttachmentId], references: [id])
  signals         Signal[]

  @@index([organizationId, startedAt])
  @@map("detector_runs")
}

/// Сигнал детектора (без LLM). Ключ дедупликации заменяет out/seen.json:
/// (версия, инструмент, ТФ, режим, сторона, время сетапа). Статус обновляется детектором.
model Signal {
  id                String       @id @default(uuid()) @db.Uuid
  organizationId    String       @map("organization_id") @db.Uuid
  clusterId         String       @map("cluster_id") @db.Uuid
  strategyVersionId String       @map("strategy_version_id") @db.Uuid
  detectorRunId     String?      @map("detector_run_id") @db.Uuid
  instrumentId      String       @map("instrument_id") @db.Uuid
  timeframe         String
  mode              SignalMode
  side              TradeSide
  setupTime         DateTime     @map("setup_time") @db.Timestamptz(6) // поле time детектора (закрытие свечи CHoCH)
  detectedAt        DateTime     @map("detected_at") @db.Timestamptz(6)
  entry             Decimal      @db.Decimal(38, 18)
  stopLoss          Decimal      @map("stop_loss") @db.Decimal(38, 18)
  takeProfits       Decimal[]    @map("take_profits") @db.Decimal(38, 18)
  stopPct           Decimal      @map("stop_pct") @db.Decimal(20, 8)
  status            SignalStatus
  statusChangedAt   DateTime     @map("status_changed_at") @db.Timestamptz(6)
  filledAt          DateTime?    @map("filled_at") @db.Timestamptz(6) // симуляция детектора
  exitAt            DateTime?    @map("exit_at") @db.Timestamptz(6)
  simulatedR        Decimal?     @map("simulated_r") @db.Decimal(20, 8)
  htfBias           Int?         @map("htf_bias")
  priceAtDetect     Decimal?     @map("price_at_detect") @db.Decimal(38, 18)
  payload           Json // все поля детектора (swept_level, choch_level, fvg_top/bot, индексы — только справочно)
  chartAttachmentId String?      @map("chart_attachment_id") @db.Uuid
  createdAt         DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)

  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  cluster         Cluster         @relation(fields: [clusterId], references: [id])
  strategyVersion StrategyVersion @relation(fields: [strategyVersionId], references: [id])
  detectorRun     DetectorRun?    @relation(fields: [detectorRunId], references: [id])
  instrument      Instrument      @relation(fields: [instrumentId], references: [id])
  chart           Attachment?     @relation(fields: [chartAttachmentId], references: [id])
  events          SignalEvent[]
  decisions       AgentDecision[]
  trades          Trade[]
  riskEvals       RiskEvaluation[]

  @@unique([strategyVersionId, instrumentId, timeframe, mode, side, setupTime])
  @@index([organizationId, detectedAt])
  @@index([clusterId, status])
  @@map("signals")
}

/// История смены статуса сигнала (pending → open → win/loss ...).
model SignalEvent {
  id        String       @id @default(uuid()) @db.Uuid
  signalId  String       @map("signal_id") @db.Uuid
  status    SignalStatus
  at        DateTime     @db.Timestamptz(6)
  data      Json?

  signal Signal @relation(fields: [signalId], references: [id], onDelete: Cascade)

  @@unique([signalId, status])
  @@map("signal_events")
}

/// Решение мозга кластера по сигналу: ВЗЯТЬ / ПРОПУСТИТЬ / HOLD, с обоснованием.
/// Уровни LLM не меняет — proposed_* хранятся для контроля (должны совпасть с сигналом).
/// human_* — когда кнопку жмёт Герман (полуавто).
model AgentDecision {
  id                String         @id @default(uuid()) @db.Uuid
  organizationId    String         @map("organization_id") @db.Uuid
  signalId          String         @map("signal_id") @db.Uuid
  agentId           String?        @map("agent_id") @db.Uuid // null — пока решает Hermes без отдельного агента
  strategyVersionId String         @map("strategy_version_id") @db.Uuid
  action            DecisionAction
  confidence        Decimal?       @db.Decimal(5, 4) // 0..1
  proposedEntry     Decimal?       @map("proposed_entry") @db.Decimal(38, 18)
  proposedStop      Decimal?       @map("proposed_stop") @db.Decimal(38, 18)
  proposedTakes     Decimal[]      @map("proposed_takes") @db.Decimal(38, 18)
  reasons           Json? // {context, setup, exit} — по схеме ТЗ
  rawOutput         Json?          @map("raw_output")
  schemaValid       Boolean        @map("schema_valid")
  totalTokens       Int?           @map("total_tokens")
  totalCostUsd      Decimal?       @map("total_cost_usd") @db.Decimal(20, 10)
  telegramMessageId BigInt?        @map("telegram_message_id")
  humanAction       DecisionAction? @map("human_action")
  humanUserId       String?        @map("human_user_id") @db.Uuid
  humanAt           DateTime?      @map("human_at") @db.Timestamptz(6)
  decidedAt         DateTime       @map("decided_at") @db.Timestamptz(6)

  organization    Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  signal          Signal           @relation(fields: [signalId], references: [id])
  agent           Agent?           @relation(fields: [agentId], references: [id])
  strategyVersion StrategyVersion  @relation(fields: [strategyVersionId], references: [id])
  llmCalls        LlmCall[]
  riskEvals       RiskEvaluation[]
  orders          Order[]
  trades          Trade[]

  @@index([organizationId, decidedAt])
  @@index([signalId])
  @@index([agentId])
  @@map("agent_decisions")
}

/// Каждый вызов LLM в системе: роли мозга кластера, улучшатели, разбор голоса, еженедельный разбор.
/// Единая таблица → единый учёт стоимости по агенту/модели/дню.
model LlmCall {
  id             String     @id @default(uuid()) @db.Uuid
  organizationId String     @map("organization_id") @db.Uuid
  decisionId     String?    @map("decision_id") @db.Uuid
  aiReviewId     String?    @map("ai_review_id") @db.Uuid
  noteId         String?    @map("note_id") @db.Uuid
  role           String // context_analyst | chart_vision | news | bull | bear | strategy_trader | post_trade_review | strategy_research | voice_parse | weekly_review
  provider       String // anthropic | openrouter | hermes
  model          String
  billing        LlmBilling
  promptVersion  String?    @map("prompt_version") // версия шаблона промпта (git sha / semver)
  promptHash     String?    @map("prompt_hash")
  prompt         String? // полный текст; может содержать ПД → политика хранения
  response       String?
  inputTokens    Int?       @map("input_tokens")
  outputTokens   Int?       @map("output_tokens")
  cacheTokens    Int?       @map("cache_tokens")
  costUsd        Decimal?   @map("cost_usd") @db.Decimal(20, 10) // null, если подписка и стоимость неизвестна
  latencyMs      Int?       @map("latency_ms")
  status         String // ok | error | timeout | invalid_schema
  error          String?
  startedAt      DateTime   @map("started_at") @db.Timestamptz(6)

  organization Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  decision     AgentDecision? @relation(fields: [decisionId], references: [id])
  aiReview     AiReview?      @relation(fields: [aiReviewId], references: [id])
  note         Note?          @relation(fields: [noteId], references: [id])

  @@index([organizationId, startedAt])
  @@index([decisionId])
  @@index([model, startedAt])
  @@map("llm_calls")
}

// ---------------------------------------------------------------------
// 8. РИСК
// ---------------------------------------------------------------------

/// Жёсткие лимиты (риск на сделку, дневной лимит, плечо, мин. R:R, пауза после серии, whitelist).
/// Пишет только человек (через API с ролью OWNER) — у роли БД движка только SELECT.
/// Неизменяемая запись: правка = новая строка + valid_to у старой + запись в audit_logs.
model RiskPolicy {
  id               String    @id @default(uuid()) @db.Uuid
  organizationId   String    @map("organization_id") @db.Uuid
  scope            RiskScope
  accountId        String?   @map("account_id") @db.Uuid
  agentId          String?   @map("agent_id") @db.Uuid
  clusterId        String?   @map("cluster_id") @db.Uuid
  riskPerTradePct  Decimal?  @map("risk_per_trade_pct") @db.Decimal(20, 8)
  dailyLossPct     Decimal?  @map("daily_loss_pct") @db.Decimal(20, 8)
  totalLossPct     Decimal?  @map("total_loss_pct") @db.Decimal(20, 8)
  maxLeverage      Decimal?  @map("max_leverage") @db.Decimal(20, 8)
  minRr            Decimal?  @map("min_rr") @db.Decimal(20, 8)
  lossStreakPause  Int?      @map("loss_streak_pause")
  maxOpenPositions Int?      @map("max_open_positions")
  whitelist        String[] // символы
  extra            Json?
  approvedById     String    @map("approved_by_id") @db.Uuid
  validFrom        DateTime  @default(now()) @map("valid_from") @db.Timestamptz(6)
  validTo          DateTime? @map("valid_to") @db.Timestamptz(6)

  organization Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account?         @relation(fields: [accountId], references: [id])
  agent        Agent?           @relation(fields: [agentId], references: [id])
  cluster      Cluster?         @relation(fields: [clusterId], references: [id])
  evaluations  RiskEvaluation[]

  @@index([organizationId, scope])
  @@map("risk_policies")
}

/// Проверка риск-слоем конкретного намерения войти: одобрено / урезано / отклонено и почему.
model RiskEvaluation {
  id                String      @id @default(uuid()) @db.Uuid
  organizationId    String      @map("organization_id") @db.Uuid
  accountId         String      @map("account_id") @db.Uuid
  agentId           String?     @map("agent_id") @db.Uuid
  signalId          String?     @map("signal_id") @db.Uuid
  decisionId        String?     @map("decision_id") @db.Uuid
  riskPolicyId      String?     @map("risk_policy_id") @db.Uuid
  propProfileId     String?     @map("prop_profile_id") @db.Uuid
  verdict           RiskVerdict
  requestedQty      Decimal?    @map("requested_qty") @db.Decimal(38, 18)
  approvedQty       Decimal?    @map("approved_qty") @db.Decimal(38, 18)
  requestedLeverage Decimal?    @map("requested_leverage") @db.Decimal(20, 8)
  approvedLeverage  Decimal?    @map("approved_leverage") @db.Decimal(20, 8)
  ruleCodes         String[]    @map("rule_codes") // ["DAILY_LIMIT_NEAR", "RR_BELOW_MIN"]
  explanation       String?
  snapshot          Json? // equity, дневной PnL, открытые позиции на момент проверки
  evaluatedAt       DateTime    @map("evaluated_at") @db.Timestamptz(6)

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account       @relation(fields: [accountId], references: [id])
  agent        Agent?        @relation(fields: [agentId], references: [id])
  signal       Signal?       @relation(fields: [signalId], references: [id])
  decision     AgentDecision? @relation(fields: [decisionId], references: [id])
  riskPolicy   RiskPolicy?   @relation(fields: [riskPolicyId], references: [id])
  propProfile  PropProfile?  @relation(fields: [propProfileId], references: [id])
  orders       Order[]

  @@index([organizationId, evaluatedAt])
  @@index([accountId, evaluatedAt])
  @@map("risk_evaluations")
}

/// Событие риска: kill-switch, пауза после серии, достигнут дневной лимит, расхождение позиций,
/// а также триггеры тильта человека (Ф2: kind = "tilt_quick_reentry" и т.п.).
model RiskEvent {
  id             String    @id @default(uuid()) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  scope          RiskScope
  accountId      String?   @map("account_id") @db.Uuid
  agentId        String?   @map("agent_id") @db.Uuid
  clusterId      String?   @map("cluster_id") @db.Uuid
  tradeId        String?   @map("trade_id") @db.Uuid
  kind           String // kill_switch | daily_loss_limit | max_drawdown | loss_streak_pause | position_mismatch | connectivity | manual_pause | tilt_*
  severity       Severity
  actionTaken    String?   @map("action_taken") // paused | flattened | notified | none
  message        String
  data           Json?
  occurredAt     DateTime  @map("occurred_at") @db.Timestamptz(6)
  resolvedAt     DateTime? @map("resolved_at") @db.Timestamptz(6)
  resolvedById   String?   @map("resolved_by_id") @db.Uuid

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account?     @relation(fields: [accountId], references: [id])
  agent        Agent?       @relation(fields: [agentId], references: [id])
  cluster      Cluster?     @relation(fields: [clusterId], references: [id])
  trade        Trade?       @relation(fields: [tradeId], references: [id])

  @@index([organizationId, occurredAt])
  @@index([kind, occurredAt])
  @@map("risk_events")
}

// ---------------------------------------------------------------------
// 9. ИМПОРТ И ФОНОВЫЕ ЗАДАЧИ
// ---------------------------------------------------------------------

/// Запуск импорта по счёту: статус и счётчики (сколько новых, сколько дублей).
model ImportJob {
  id             String       @id @default(uuid()) @db.Uuid
  organizationId String       @map("organization_id") @db.Uuid
  accountId      String       @map("account_id") @db.Uuid
  mode           String // full | incremental | file
  status         ImportStatus @default(QUEUED)
  streams        String[] // ["futures_deals","futures_orders","funding","spot_trades:BTCUSDT"]
  requestedBy    String?      @map("requested_by") // user.id | "cron"
  fetched        Int          @default(0)
  inserted       Int          @default(0)
  updated        Int          @default(0)
  duplicates     Int          @default(0)
  errors         Int          @default(0)
  errorLog       Json?        @map("error_log")
  startedAt      DateTime?    @map("started_at") @db.Timestamptz(6)
  finishedAt     DateTime?    @map("finished_at") @db.Timestamptz(6)
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  firstSeen    RawRecord[]  @relation("RawFirstJob")
  lastSeen     RawRecord[]  @relation("RawLastJob")

  @@index([organizationId, createdAt])
  @@index([accountId, status])
  @@map("import_jobs")
}

/// Курсор инкрементального импорта: докуда дочитали каждый поток каждого счёта.
model ImportCursor {
  accountId String   @map("account_id") @db.Uuid
  stream    String
  cursor    Json // {"last_time": 1696..., "last_id": "..."} — формат зависит от API площадки
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@id([accountId, stream])
  @@map("import_cursors")
}

/// Сырая запись площадки «как пришла» (landing zone). Позволяет пересобрать сделки
/// без повторного похода в API и разбирать спорные случаи. Уникальна по (счёт, поток, внешний id).
model RawRecord {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  accountId      String   @map("account_id") @db.Uuid
  stream         String
  externalId     String   @map("external_id")
  payload        Json
  payloadHash    String   @map("payload_hash")
  firstJobId     String?  @map("first_job_id") @db.Uuid
  lastJobId      String?  @map("last_job_id") @db.Uuid
  firstSeenAt    DateTime @default(now()) @map("first_seen_at") @db.Timestamptz(6)
  lastSeenAt     DateTime @default(now()) @map("last_seen_at") @db.Timestamptz(6)

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      Account       @relation(fields: [accountId], references: [id], onDelete: Cascade)
  firstJob     ImportJob?    @relation("RawFirstJob", fields: [firstJobId], references: [id])
  lastJob      ImportJob?    @relation("RawLastJob", fields: [lastJobId], references: [id])
  executions   Execution[]
  ledger       LedgerEntry[]

  @@unique([accountId, stream, externalId])
  @@index([organizationId])
  @@map("raw_records")
}

/// Очередь фоновых задач в самой PostgreSQL (SELECT … FOR UPDATE SKIP LOCKED) — без Redis.
/// Импорт, распознавание голоса, ИИ-разбор, пересчёт сделок/дней.
model Job {
  id          String    @id @default(uuid()) @db.Uuid
  queue       String // import | transcribe | ai_review | recompute
  kind        String
  payload     Json
  status      JobStatus @default(QUEUED)
  dedupeKey   String?   @unique @map("dedupe_key")
  runAt       DateTime  @default(now()) @map("run_at") @db.Timestamptz(6)
  attempts    Int       @default(0)
  maxAttempts Int       @default(5) @map("max_attempts")
  lockedAt    DateTime? @map("locked_at") @db.Timestamptz(6)
  lockedBy    String?   @map("locked_by")
  lastError   String?   @map("last_error")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  finishedAt  DateTime? @map("finished_at") @db.Timestamptz(6)

  @@index([queue, status, runAt])
  @@map("jobs")
}
```

**Ещё о схеме:**
- `jobs` — системная таблица без `organization_id`: организация лежит в `payload`. При SaaS-изоляции через RLS
  к `jobs` имеет доступ только воркер.
- Уникальные ключи на nullable-колонках (`trades(account_id, external_position_id)`,
  `trades(organization_id, idempotency_key)`, `notes(telegram_chat_id, telegram_message_id)`) работают
  правильно: в PostgreSQL NULL не конфликтует с NULL.
- Индексы `@@index([organizationId, …])` стоят на всех таблицах с данными пользователя. Основные запросы
  статистики идут по `trades(organization_id, closed_at)`.
- Свечи в схеме не хранятся. График карточки сделки берёт свечи из публичного API площадки через кеш
  (см. раздел 9.1, п. 6).

---

## 5. Идемпотентный импорт (MEXC и любые площадки)

### 5.1. Принцип

Импорт можно запускать сколько угодно раз, с перекрытием по времени и после сбоя посередине — результат
будет тем же. Это держат три вещи:

1. **Внешний id → уникальный ключ.** У каждой записи площадки есть свой id. В БД стоят уникальные ключи:

   | Таблица | Уникальный ключ | Откуда ключ |
   |---------|-----------------|-------------|
   | `raw_records` | `(account_id, stream, external_id)` | id записи в ответе API |
   | `executions` | `(account_id, external_id)` | id исполнения (trade/deal id) |
   | `orders` | `(account_id, external_order_id)` и `(account_id, client_order_id)` | id ордера на бирже / наш clientOrderId |
   | `ledger_entries` | `(account_id, kind, external_id)` | id записи фандинга или перевода |
   | `trades` | `(account_id, external_position_id)` | id позиции, если площадка его даёт, иначе детерминированный ключ (см. 5.3) |
   | `trades` (ручные) | `(organization_id, idempotency_key)` | заголовок `Idempotency-Key` от клиента или Hermes |
   | `notes` (Telegram) | `(telegram_chat_id, telegram_message_id)` | id сообщения в Telegram |
   | `signals` | `(strategy_version_id, instrument_id, timeframe, mode, side, setup_time)` | поля сигнала детектора |

2. **Вставка через `INSERT … ON CONFLICT`.** Дубль — `DO NOTHING`, счётчик `duplicates += 1`. Изменилась
   запись (ордер сменил статус) — `DO UPDATE … WHERE payload_hash <> excluded.payload_hash`, счётчик `updated += 1`.
3. **Курсор двигается только после коммита страницы.** Упали посередине — следующий запуск начнёт с последнего
   подтверждённого места. Курсор хранится как `import_cursors(account_id, stream)`.

### 5.2. Потоки MEXC (всё помечено «проверить»: эндпоинты, поля и глубина истории не сверены с документацией)

| Поток (`stream`) | Что | Внешний id | Проверить |
|------------------|-----|-----------|-----------|
| `futures_deals` | Исполнения по фьючерсам (основная торговля: пампы 10x, SMC) | id исполнения | Эндпоинт истории исполнений USDT-M фьючерсов, глубина истории, пагинация, объём в контрактах или в монетах (`contract_size`) |
| `futures_orders` | История ордеров фьючерсов (план стопа/тейка, отменённые) | orderId | Эндпоинт, отдаются ли стоп-ордера (plan orders) отдельным потоком |
| `futures_positions` | Закрытые позиции | positionId | Есть ли id позиции в истории; если есть — по нему группируем исполнения в сделку |
| `funding` | Фандинг | id записи | Эндпоинт истории фандинга, привязка к positionId |
| `spot_trades:<SYMBOL>` | Спот-исполнения | id сделки | Спот-история, похоже, запрашивается по символу (как у Binance-совместимого API) — нужен список символов; глубина истории ограничена (**проверить**, открытый вопрос TZ дневника) |
| `file:<имя>` | Выгрузка из кабинета MEXC (CSV/XLSX), если API не отдаёт старую историю | id из файла или синтетический | Формат выгрузки, есть ли в ней id |

Чтение — ключом **только на чтение** (решение TZ дневника). Права ключа импортёр проверяет при старте; если ключ
умеет торговать — предупреждение в UI и в Telegram.

### 5.3. Алгоритм одного запуска

```
POST /api/v1/accounts/:id/imports  → import_jobs(status=QUEUED) + jobs(queue=import, dedupe_key="import:<account>")
   (dedupe_key не даёт запустить два импорта одного счёта параллельно)
воркер:
 1. для каждого stream: cursor = import_cursors[stream]; окно = cursor − перекрытие (24 ч)
 2. страница ответа → в одной транзакции:
      a. raw_records UPSERT (account, stream, external_id) → inserted / updated / duplicates
      b. нормализация → executions / orders / ledger_entries   ON CONFLICT DO NOTHING (orders — DO UPDATE)
         · объём в базовом активе (qty) + как отдала биржа (qty_contracts)
         · комиссия со знаком, в своём активе + feeQuote
      c. import_cursors[stream] = последняя запись страницы
 3. сборка сделок для затронутых (account, instrument), начиная с самого раннего изменённого executed_at:
      · есть positionId → trade.external_position_id = positionId
      · нет → проход по чистой позиции (FIFO): 0 → ≠0 открывает сделку, возврат к 0 закрывает;
        external_position_id = "fifo:<external_id первого исполнения>"   ← детерминированно
      · строка сделки стабильна: перерасчёт не трогает поля человека (эмоции, заметки, теги, план)
      · фандинг: ledger_entries.trade_id = сделка, открытая в момент начисления
 4. SELECT tp_recompute_trade(id) для изменённых сделок → пересчёт daily_summaries за затронутые даты
 5. import_jobs: status = SUCCEEDED/PARTIAL, счётчики; уведомление «импортировано N, дублей M»
```

### 5.4. Дубли между источниками

| Ситуация | Что происходит |
|----------|----------------|
| Агент торгует на площадке, движок пишет исполнения (`origin=ENGINE`), позже тот же счёт импортируется | Движок кладёт в `external_id` биржевой id исполнения. Импорт упирается в `(account_id, external_id)` — дубля нет |
| Движок повторно отправил ордер после таймаута | `client_order_id` генерирует движок, уникален на счёт. Биржа и БД не примут второй |
| Герман внёс сделку руками (или голосом), потом пришёл импорт MEXC | Автоматически не склеиваем: id разные. Импорт ищет ручную сделку на том же счёте и инструменте, с той же стороной, открытием ±2 мин и объёмом ±1%. Найденную помечает `possible_duplicate_of_id`. UI предлагает «объединить»: психология, заметки, скриншоты и теги переезжают на импортированную, ручная получает `merged_into_id` и `deleted_at`. Окна совпадения — в настройках, подобрать на реальных данных |
| Старые сделки из файла выгрузки, затем те же через API | Ключи разные (`file:` vs `api`). Та же процедура «возможный дубль», плюс сверка по `(время ms, цена, объём, комиссия)`. Если в выгрузке есть настоящий id исполнения — используем его, и тогда дубля нет |
| Голосовое пришло дважды (повтор вебхука) | `(telegram_chat_id, telegram_message_id)` уникален |

---

## 6. Структура папок

Предложение. Сейчас из этого есть только `journal/TZ.md`, `prop-agents/*` и этот файл.

```
trade-performance/
├── README.md                      # как связаны проекты, решения, карта топиков
├── .env                           # секреты локально (в .gitignore); на сервере — свой .env
├── infra/
│   ├── docker-compose.yml         # postgres, s3 (minio), web, worker, engine — для локалки и сервера
│   └── .env.example               # имена переменных без значений
├── shared/                        # ОБЩЕЕ ДЛЯ ДВУХ ПРОЕКТОВ
│   ├── DATA_ARCHITECTURE.md       # этот документ
│   ├── db/                        # единственный владелец схемы БД
│   │   ├── package.json           # prisma CLI (версия зафиксирована)
│   │   ├── prisma.config.ts       # DATABASE_URL, путь к миграциям
│   │   ├── prisma/schema.prisma   # схема из раздела 4
│   │   ├── prisma/migrations/     # SQL-миграции; ручные вставки: CHECK, роли/GRANT, функции, RLS
│   │   ├── sql/                   # исходники функций (tp_recompute_trade, tp_recompute_day) — копируются в миграцию
│   │   └── seed/                  # venues, instruments (BTCUSDT MEXC), организация «Герман», кластер smc-btc
│   ├── contracts/                 # JSON Schema контрактов между TS и Python
│   │   ├── signal.v1.json         # сигнал детектора (то, что сейчас в last_signal.json)
│   │   ├── decision.v1.json       # {action, entry, sl, tp[], confidence, reasons{context,setup,exit}}
│   │   ├── voice_note.v1.json     # результат разбора голосового
│   │   └── codegen.sh             # → journal/web/src/contracts (zod), shared/python/tp_core/contracts (pydantic)
│   └── python/tp_core/            # Python-пакет, общий для воркера и движка (pip install -e)
│       ├── db/tables.py           # СГЕНЕРИРОВАН sqlacodegen из БД после миграции; CI проверяет дрейф
│       ├── db/session.py          # подключение (роль tp_engine / tp_worker)
│       ├── repo/                  # signals, executions, trades, llm_calls, risk — сырой SQL с ON CONFLICT
│       ├── money.py               # Decimal, квантование по tick_size/step_size
│       ├── connectors/            # адаптеры площадок: mexc.py (чтение), hyperliquid.py, okx_demo.py, blofin.py, propr.py …
│       ├── importer/              # потоки, нормализация, сборка сделок (FIFO / positionId)
│       └── llm/                   # шлюз моделей + запись llm_calls (модель, токены, стоимость)
├── worker/                        # Python-сервис фоновых задач (очередь jobs в PostgreSQL)
│   └── main.py                    # import · transcribe (голос) · ai_review · recompute · tilt (Ф2)
├── journal/
│   ├── TZ.md
│   └── web/                       # Next.js (App Router) + TS + Tailwind + shadcn/ui + TanStack Query
│       ├── app/(app)/…            # дашборд, сделки, карточка сделки, дни, разборы, агенты
│       ├── app/api/v1/…/route.ts  # API v1 (раздел 7)
│       ├── src/server/db.ts       # Prisma Client (генерируется из shared/db/prisma/schema.prisma)
│       ├── src/server/services/   # trades, stats, notes, imports, agents — бизнес-логика без HTTP
│       ├── src/server/auth/       # аутентификация (как вошёл) — способ входа см. РКН A3
│       ├── src/server/rbac/       # авторизация (что можно): роль в memberships + scopes api_tokens
│       ├── src/lib/decimal.ts     # строки ↔ Decimal, формат для UI
│       └── tests/
├── prop-agents/
│   ├── TZ.md · ARCHITECTURE.md · STRATEGY_CARD_TEMPLATE.md
│   ├── engine/                    # Python-пакет tp_engine (зависит от tp_core)
│   │   ├── data/                  # свечи, фандинг, OI, новости — с временем публикации
│   │   ├── detectors/base.py      # общий интерфейс детектора: run() → list[Signal по контракту]
│   │   ├── brain/                 # роли LLM; невалидный ответ → HOLD
│   │   ├── risk/                  # Risk Gate: читает risk_policies/prop_profiles, пишет risk_evaluations
│   │   ├── execution/             # Order Manager поверх tp_core.connectors
│   │   ├── supervisor/            # Сторож: kill-switch, сверка позиций → risk_events
│   │   └── arena/                 # эксперименты, shadow evaluator
│   ├── clusters/smc-btc/          # карточка и детектор — источник истины по правилам (как сейчас)
│   │   ├── config.json · strategy.md · rules.yaml · CHANGELOG.md
│   │   ├── smc_detector.py        # пишет в БД через tp_core.repo.signals; картинки → attachments
│   │   └── out/                   # только локальная отладка (в .gitignore)
│   └── scripts/migrate_out_to_db.py   # одноразовый перенос out/*.json (раздел 8)
└── research/
```

Почему так:
- `shared/db` — отдельный пакет, а не часть `journal/web`. Схема принадлежит обоим проектам, и миграции не
  должны зависеть от сборки фронтенда.
- `tp_core` общий для воркера и движка. Адаптеры площадок нужны и импорту дневника (чтение), и исполнению
  агентов (торговля) — один код вместо двух.
- Импорт для дневника пишем на Python, а не на Node. Так закрывается открытый вопрос Ф0 из TZ дневника: те
  же адаптеры и та же сборка сделок, что у движка. Веб только ставит задачу и показывает статус.

---

## 7. API v1 дневника (MVP)

Общие правила:
- Префикс `/api/v1/`. Ответы — JSON, числа-деньги строками, время ISO-8601 UTC.
- Списки с курсорной пагинацией: `?cursor=&limit=`.
- Аутентификация: сессия веба или `Authorization: Bearer <api_token>` (Hermes, движок, скрипты).
- Авторизация: роль в организации (`memberships.role`) + `scopes` токена. Каждый запрос ограничен
  `organization_id` текущего пользователя или токена.
- Запросы на создание принимают `Idempotency-Key`.
- Эндпоинты входа (`/api/auth/*`) остаются за библиотекой аутентификации и не версионируются. Способ входа
  определяет раздел A3 РКН.

**Профиль и справочники**
- `GET /api/v1/me` — текущий пользователь, организация, роль, таймзона.
- `PATCH /api/v1/me` — таймзона, язык, список эмоций.
- `GET /api/v1/venues` — площадки.
- `GET /api/v1/instruments?venue=&q=` — поиск инструмента.

**Счета**
- `GET /api/v1/accounts` — счета (человек и агенты, фильтр `?owner=human|agent`).
- `POST /api/v1/accounts` — создать счёт (площадка, тип, базовая валюта, ссылка на ключ).
- `GET /api/v1/accounts/:id` — счёт + последний снимок баланса + статус импорта.
- `PATCH /api/v1/accounts/:id` — изменить название, tz дня, профиль пропа.
- `DELETE /api/v1/accounts/:id` — мягкое удаление.
- `GET /api/v1/accounts/:id/snapshots?from=&to=` — снимки баланса и equity.

**Импорт**
- `POST /api/v1/accounts/:id/imports` — запустить импорт (`{mode: "full"|"incremental"}`) → `202` + id задачи.
- `POST /api/v1/accounts/:id/imports/file` — загрузить выгрузку MEXC (CSV/XLSX) → `202`.
- `GET /api/v1/accounts/:id/imports` — история запусков.
- `GET /api/v1/imports/:id` — статус и счётчики: получено / новых / обновлено / дублей / ошибок.

**Сделки**
- `GET /api/v1/trades` — список. Фильтры: `account`, `executor`, `origin`, `instrument`, `playbook`, `tag`,
  `status`, `from`, `to`, `agent`, `signal`.
- `POST /api/v1/trades` — ручная сделка (план + исполнения) с `Idempotency-Key`. Сервер пишет синтетические
  исполнения и вызывает `tp_recompute_trade`.
- `GET /api/v1/trades/:id` — карточка: исполнения, ордера, фандинг, заметки, вложения, теги, нарушения,
  сигнал и решение агента.
- `PATCH /api/v1/trades/:id` — план (стоп, тейки), психология, стиль, теги, нарушенные правила, причина входа.
- `DELETE /api/v1/trades/:id` — мягкое удаление.
- `POST /api/v1/trades/:id/merge` — объединить с возможным дублем (`{intoTradeId}`).
- `GET /api/v1/trades/:id/candles?tf=` — свечи вокруг сделки для графика (прокси к публичному API площадки + кеш).

**Заметки и вложения**
- `POST /api/v1/notes` — текстовая заметка (к сделке, ко дню или свободная).
- `POST /api/v1/notes/voice` — голосовое (multipart или ссылка на файл от Hermes + `telegram_chat_id`/`message_id`)
  → `202`. Дальше распознавание и разбор в очереди.
- `GET /api/v1/notes?trade=&from=&to=` — заметки.
- `PATCH /api/v1/notes/:id` — правка текста, привязка к сделке, подтверждение разбора голоса.
- `DELETE /api/v1/notes/:id` — мягкое удаление.
- `POST /api/v1/attachments` — получить presigned URL на загрузку скриншота.
- `GET /api/v1/attachments/:id` — подписанная ссылка на скачивание.
- `DELETE /api/v1/attachments/:id` — мягкое удаление.

**Статистика**
- `GET /api/v1/stats/summary` — PnL, win rate, profit factor, средний R, число сделок; фильтры как у `/trades`.
- `GET /api/v1/stats/equity` — кривая капитала с учётом депозитов и выводов.
- `GET /api/v1/stats/drawdowns` — просадки: максимальная, текущая, длительность.
- `GET /api/v1/stats/breakdown?by=playbook|instrument|weekday|hour|duration|executor|agent` — разрезы.
- `GET /api/v1/stats/liquidation-stops` — сколько стоят сделки со стопом на ликвидации (Ф2, поле уже есть).

**Дни**
- `GET /api/v1/days?from=&to=` — дневные итоги по счетам + дневник дня.
- `GET /api/v1/days/:date` — один день целиком.
- `PATCH /api/v1/days/:date` — настрой, оценка дисциплины, план, итог.

**Справочники человека**
- `GET/POST /api/v1/playbooks`, `PATCH/DELETE /api/v1/playbooks/:id` — стили и сетапы.
- `GET/POST /api/v1/tags`, `PATCH/DELETE /api/v1/tags/:id` — теги.
- `GET/POST /api/v1/rules`, `PATCH/DELETE /api/v1/rules/:id` — правила и пункты чек-листа.

**ИИ-разборы**
- `POST /api/v1/reviews` — заказать разбор (`{kind:"weekly", from, to}` или `{kind:"trade", tradeId}`) → `202`.
- `GET /api/v1/reviews` — список разборов.
- `GET /api/v1/reviews/:id` — текст, находки, ссылки на сделки, стоимость.

**Агенты (только чтение в дневнике, P1)**
- `GET /api/v1/agents` — агенты: кластер, версия, модель, счёт, состояние.
- `GET /api/v1/agents/:id` — агент + краткая стата.
- `GET /api/v1/signals?cluster=&status=&from=&to=` — сигналы детекторов.
- `GET /api/v1/signals/:id` — сигнал + решения + вызовы LLM + проверки риска + сделка.
- `GET /api/v1/llm-usage?groupBy=model|agent|role|day` — токены и стоимость LLM.
- `GET /api/v1/risk-events?scope=&kind=&from=` — события риска и тильта.

**Управление риском (только роль OWNER, всё в audit_logs)**
- `GET /api/v1/risk-policies` — действующие лимиты.
- `POST /api/v1/risk-policies` — новая редакция лимитов (старая закрывается `valid_to`).
- `POST /api/v1/strategy-versions/:id/promote` — перевести тень в бой (человек подтверждает).
- `POST /api/v1/agents/:id/pause` · `POST /api/v1/agents/:id/resume` — то же, что `/pause` и `/resume` в Telegram.

**Задачи**
- `GET /api/v1/jobs/:id` — статус фоновой задачи (импорт, голос, разбор).

---

## 8. Перенос текущих файлов prop-agents (`clusters/smc-btc/out/`) в БД

Сейчас в `out/` лежат: `setups.json` (19 сетапов исторического прогона), `seen.json` (пустой список),
`history.png`, `test_live.png`, `monitor.err`. Файла `last_signal.json` пока нет: живого сигнала ещё не было.
Каталог `out/` в `.gitignore`, данные есть только на Mac.

| Файл | Куда в БД | Как |
|------|-----------|-----|
| `config.json` (v0.1) | `clusters` (slug `smc-btc`) + `strategy_versions` (version `0.1`, `config` = содержимое, `config_hash`, `status=ACTIVE`, `approved_by` = Герман, `git_commit`) | Детектор при старте делает upsert версии по `(cluster, config_hash)`. Если Герман поменял число и забыл поднять `version`, хэш разойдётся, и детектор остановится с ошибкой, а не будет молча писать сигналы под старой версией |
| `setups.json` | `detector_runs` (mode `BACKTEST`, диапазон 25.09–09.10, 4031 свеча, `stats`) + 19 × `signals` (mode `BACKTEST`) + `signal_events` | Маппинг: `side` → `side` (LONG/SHORT); `entry`, `sl` → `stop_loss`, `tp` → `take_profits[0]` с квантованием по `tick_size`; `stop_pct`; `status` → enum; `time` → `setup_time`. Всё остальное (`swept_level`, `choch_level`, `fvg_top/bot`, `*_i`) → `payload` |
| `history.png` | `attachments` (kind CHART) + `detector_runs.chart_attachment_id` | Файл → объектное хранилище, в БД — ключ и sha256 |
| `last_signal.json` (когда появится) | `detector_runs` (mode LIVE) + `signals` (mode LIVE) + `attachments` (`live.png`) | `price` → `price_at_detect`, `htf_bias` → `htf_bias`, `detected_at` → `detected_at` |
| `seen.json` | **Не переносится, отменяется** | Его заменяет уникальный ключ `signals`. Детектор делает `INSERT … ON CONFLICT DO NOTHING RETURNING id`: вернулась строка — сигнал новый, Hermes будит агента |
| `test_live.png` | Не переносится | Тестовый артефакт |
| `monitor.err` | Не в БД | Логи. На сервере — в журнал процесса или систему логов |
| Карточка ВЗЯТЬ/ПРОПУСТИТЬ от Hermes (сейчас только в Telegram) | `agent_decisions` (`agent_id` = null, пока решает Hermes) + `llm_calls` (`provider=hermes`, `billing=SUBSCRIPTION`, `cost_usd=null`) | Hermes после ответа вызывает `POST` в движок или API с решением по `decision.v1.json` и `telegram_message_id` |

**Что изменить в детекторе перед переносом** (код не трогаю, это задача для prop-agents):
1. **Индексы → время.** `sweep_i`, `ref_i`, `choch_i`, `fvg_i`, `fill_i`, `exit_i` — номера свечей внутри
   скачанного окна. При следующем прогоне окно сдвигается, и номера теряют смысл. Нужно отдавать время свечей
   (`sweep_time`, `fvg_time`, `fill_time`, `exit_time`). Иначе `filled_at` и `exit_at` из старого
   `setups.json` не восстановить: их там нет, только индексы. Поэтому 19 исторических сетапов лучше **не
   переносить из файла, а перепрогнать** детектор v0.1 на том же диапазоне с новым выводом. Из файла — только
   если перепрогон невозможен, тогда `filled_at`/`exit_at` = null.
2. **Ключ сигнала.** Сейчас ключ `side|time` не содержит символ, ТФ и версию. Как только появятся второй
   кластер или тень, ключи столкнутся. В БД ключ составной (см. раздел 5.1).
3. **Статус обновлять, а не только создавать.** Каждый live-прогон пересчитывает статус открытых сигналов
   (pending → open → win/loss/expired/cancelled). Обновление `signals.status` + строка в `signal_events`.
4. **Семантика `time`.** Сейчас это `tc` свечи CHoCH из ответа MEXC klines. **Проверить**, что `tc` — время
   закрытия (open + интервал или open + интервал − 1 мс), иначе ключ может «прыгать» на 1 мс между версиями кода.
5. **Комиссия в бэктесте.** `stats` в `detector_runs` хранит и `sumR`, и `sumRAfterFees` с указанием ставки:
   улучшатели сравнивают версии «после комиссий».

---

## 9. Риски и открытые вопросы

### 9.1. Риски

1. **Две технологии на одной схеме (TS + Python).** Дрейф моделей Python. Меры: генерация `tables.py` из
   живой БД, CI-проверка дрейфа, контракты в JSON Schema, формулы — в SQL-функциях.
2. **Сборка сделок из исполнений** — самое хрупкое место: частичные закрытия, разворот через ноль, hedge
   mode, ликвидация, ADL. Мера: тесты на реальной выгрузке MEXC Германа до запуска статистики, ручная
   правка сделки (`PATCH`) и сохранение `raw_records`, чтобы пересобрать.
3. **API MEXC не сверен.** Эндпоинты, поля, глубина истории, контракты или монеты в объёме, наличие
   positionId — всё **проверить** на документации и живом ключе на первом шаге Ф0. Если история короткая —
   импорт из выгрузки кабинета.
4. **Inverse-контракты** (расчёт в монете) в MVP не считаем. Флаг `is_inverse` есть, формулы нет.
5. **Хранение промптов (`llm_calls.prompt`)**: объём и персональные данные (заметки, голос, сделки уходят в
   промпт). Нужна политика хранения — например, полный текст 90 дней, дальше только хэш и метрики.
6. **Свечи для карточки сделки** берём из публичного API площадки по запросу. При SaaS и 1000 пользователях
   упрёмся в лимиты. Тогда — кеш свечей (отдельная таблица или TimescaleDB/Parquet), и рыночные данные агентов
   тоже переедут туда.
7. **Граница торгового дня** у человека (МСК), у пропа (своя tz и время сброса) и у биржи (UTC) разная.
   Поэтому `daily_summaries` считается по счёту с `day_tz`. Ошибка здесь = неверный дневной лимит пропа:
   в риск-слое это критично.
8. **Очередь в PostgreSQL** нормальна до тысяч задач в минуту. Если арена вырастет до сотен агентов с
   WebSocket-потоками — пересмотреть (Redis/NATS для рыночных данных, БД — только для журнала).
9. **Supabase vs свой сервер** — см. раздел 10 (A2). Все решения документа работают на любой PostgreSQL 15+.
   От Supabase не используем ничего, кроме самой БД и, возможно, хранилища.
10. **Правило «удаляем мягко» против 152-ФЗ:** по запросу субъекта данные надо удалить физически. Нужна
    процедура purge (каскад по `organization_id`/`user_id` + файлы в хранилище + бэкапы по сроку ротации).

### 9.2. Открытые вопросы к Герману

1. Где стоит БД: Supabase (какой регион) или свой сервер (какой провайдер, страна)? Здесь же — сервер
   движка (TZ prop-agents, «Сервер: провайдер, регион, доступ к биржам») и хранилище файлов.
2. Способ входа в дневник сейчас: только Telegram (ты один) или сразу телефон/почта? Для SaaS — см. A3.
3. MEXC: что торгуешь — USDT-M фьючерсы, спот или оба? Насколько глубоко назад нужна история? Есть ли выгрузка из кабинета?
4. Сделки с Bybit до блокировки — импортировать из файла?
5. Список эмоций для карточки — дать свой или начать со стандартного (страх, жадность, FOMO, месть, скука, спокойствие, уверенность)?
6. Психология у агентских сделок не заполняется. Нужно ли поле «оценка Германа» для сделок агентов (полуавто: кнопку жмёшь ты)?
7. Валюта сводной статистики: USDT считаем равным USD или конвертируем по курсу?
8. Сколько хранить полные промпты и ответы LLM?
9. Распознавание голоса: чем (локальный Whisper на сервере или внешний API)? От этого зависит трансграничная передача (A4).
10. Окна совпадения для «возможного дубля» ручной и импортированной сделки (±2 мин, ±1%) — ок для старта?

---

## 10. Правовой контур (обязательный выход архитектора)

Архитектура фиксирует то, что потом не переделать: где стоят база и бэкапы, кто хостер, как входит
пользователь, какие данные куда уходят. Пока дневник — личный инструмент Германа, обработка его же данных
для личных нужд может не подпадать под 152-ФЗ (**оценивает юрист**). Но SaaS (Ф3) заложен в схему с первого
дня, поэтому вопросы раздела A задаём сейчас.

**Нужен прогон агента `rkn-compliance` в РАННЕМ режиме (раздел A).** Ответы — в раздел «Правовой контур»
файла `docs/projects/trade-performance/project.md`. **Такого файла сейчас нет**: его нужно создать по шаблону
`docs/projects/_template/project.md`.

### Вопросы раздела A (`docs/core/rkn-compliance.md`) применительно к проекту

**A1. Состав данных и цели.** Для каждой цели: какие данные, чьи, как обрабатываются, сколько хранятся, как
уничтожаются.
- Учётная запись: имя, e-mail/телефон, Telegram user id, таймзона. Нужен ли e-mail, если вход по телефону?
- Торговые данные: сделки, балансы, счета, id аккаунтов на биржах. Финансовые сведения; есть ли у них особый режим — вопрос юристу.
- Психология: эмоции, уверенность, нарушения правил, свободные заметки. Чувствительные по смыслу данные о поведении.
- **Голосовые записи:** храним ли аудио после распознавания и сколько. Не являются ли они биометрическими
  (не являются, если голос не используется для установления личности — подтвердить у юриста).
- Скриншоты: могут содержать лишнее — имя аккаунта, баланс, чужие чаты.
- Ключи бирж (Ф3): хранить только зашифрованными, только read-only.
- Тексты промптов и ответов LLM: копия всего перечисленного. Срок хранения?
- Нет ли полей «на всякий случай»: например, `users.phone` и `users.email` одновременно, `trades.entry_reason`.

**A2. Размещение БД.** Физически ли сервер с БД в России? «Компания российская» ≠ «сервер в России».
- Supabase (облако за рубежом — **проверить регионы**) при российских пользователях SaaS нарушает
  локализацию. Свой сервер в РФ — нет.
- Бэкапы БД и объектное хранилище (скриншоты, голос) — где? Зарубежный бакет с дампом обнуляет локализацию.
- Конфликт: движку нужен доступ к биржам и пропам, часть из них недоступна из РФ (Bybit уже заблокирован). Вероятная
  схема: БД и дневник — в РФ, исполнитель агентов — за рубежом. Но тогда данные идут за рубеж (A4). Решить до
  выбора хостинга.

**A3. Способ авторизации.** Для ресурса с российской аудиторией единственный вход через иностранного
провайдера недопустим.
- Вход через Telegram — иностранный провайдер. Только как дополнительный к допустимому основному
  (российский номер телефона / ЕСИА / собственная система). Для личного MVP — вопрос юристу, для SaaS —
  обязательно.
- Схема это поддерживает: `auth_identities` с несколькими провайдерами, `users.phone`. SMS-шлюз — тоже A4.

**A4. Сторонние сервисы и трансграничная передача.** Каждый сервис, куда уходят данные пользователя, — какие
поля и в какую страну.
- LLM: Anthropic (Claude), OpenRouter и модели за ним. Уходят сделки, заметки, расшифровки голоса,
  скриншоты (vision). США и др.
- Hermes (оркестратор) — где работает и куда шлёт данные.
- Распознавание голоса — внешний API или локально.
- Telegram — голосовые и сообщения проходят через Telegram.
- Биржи и пропы (MEXC, Hyperliquid, OKX, BloFin, Propr, HyroTrader, SizeProp) — по API уходят ключи и
  идентификаторы счёта пользователя. Страны — проверить.
- Хостинг и CDN фронтенда (Vercel/Cloudflare по умолчанию в `docs/core/stack.md`) — IP посетителей за рубежом.
- Шрифты, скрипты, аналитика (Sentry, Vercel Analytics, Axiom) — каждый сервис = трансграничная передача;
  шрифты держать у себя.
- TradingView Lightweight Charts — библиотека, ставится пакетом (не CDN), данных не передаёт. Проверить, что
  подключена не с CDN.

**Дополнительно (раздел C2, на суждение юриста):** еженедельный ИИ-разбор с персональными рекомендациями.
Может ли он считаться «рекомендательной технологией» при SaaS?
