# Nullume — Опись пакета

Дизайн-генератор медиа (картинки, видео, аудио) через kie.ai с библиотекой вкуса для стилей.

## Состав пакета

```
nullume/
├── bin/
│   ├── nullume.js              # Точка входа CLI
│   └── mcp-stdio.sh            # Адаптер MCP-сервера (stdin/stdout)
│
├── dist/                        # Скомпилированный код (TypeScript → JavaScript)
│   └── src/**/*.js              # Исполняемый JS после npm run build
│
├── data/                        # Вендоренные данные (коммитятся)
│   ├── models.json              # Каталог моделей kie.ai (сейв snapshot)
│   ├── prices.json              # Справочник цен
│   ├── presets.json             # Заготовки параметров для генерации
│   ├── feeds.json               # RSS-источники для импорта референсов
│   └── x-graphql.json           # GraphQL-схема для X (Twitter)
│
├── skills/
│   └── nullume/
│       └── SKILL.md             # Метапроцедура для Claude Code (вводится на nullume init)
│
├── .claude/
│   └── agents/
│       └── design/
│           └── taste-curator.md # Агент для кураторства референсов
│
├── docs/
│   ├── decisions/
│   │   ├── ADR-006-architecture.md           # Архитектурное решение
│   │   └── ADR-007-reference-sources-policy.md  # Политика источников
│   ├── project.md               # Контекст проекта (для Friday)
│   └── brand.md                 # Бренд проекта (для Friday)
│
├── design-system/               # Дизайн-система (для Friday, опционально)
│   └── MASTER.md                # Токены палитры, типографики, шкалы
│
├── templates/
│   └── github/
│       ├── ci.yml               # GitHub Actions для тестов и сборки
│       └── catalog-audit.yml    # GitHub Actions для еженедельного аудита
│
├── scripts/
│   ├── build-catalog.mts        # Собирает models.json из docs.kie.ai
│   ├── audit-catalog.mts        # Проверяет расхождения в каталоге
│   ├── sync-skill.mts           # Синхронизирует SKILL.md в Friday
│   ├── copy-assets.mjs          # Копирует данные в dist после сборки
│   ├── dashboard-console-check.mjs  # Dev-check: логирование консоли дашборда (playwright-core)
│   └── dashboard-flow-check.mjs     # Dev-check: E2E-проверка дашборда (playwright-core)
│
├── src/
│   ├── cli/                     # CLI команды (balance, generate, models, lib)
│   ├── mcp/                     # MCP-сервер для Claude Code
│   ├── core/                    # Общие утилиты (HTTP, ошибки, пути)
│   └── types.ts                 # Общие типы TypeScript
│
├── .env.example                 # Пример переменных окружения
├── README.md                    # Русская документация
├── README.en.md                 # Английская документация
├── LICENSE                      # MIT
├── package.json                 # Метаданные и зависимости
├── tsconfig.json                # Конфигурация TypeScript
└── tsconfig.build.json          # Конфиг для сборки (dist/)
```

## Что делает `nullume init <dir>`

Интеграция Nullume в новый проект (может быть вне Friday):

1. **`.mcp.json`** — добавляет запись сервера Nullume (или обновляет, если `--force`)
2. **`.claude/skills/nullume/SKILL.md`** — копирует метапроцедуру для Claude Code
3. **`.env.example`** — дополняет строкой `KIE_API_KEY=` (если не было)
4. **`.gitignore`** — дополняет строкой `.env` (если не было)

**Результат:** проект готов к работе с CLI и MCP-инструментами Nullume.

## Требования от получателя

### Обязательные
- **Node.js ≥ 22.13** (LTS; проверить: `node --version`)
- **npm** (встроен в Node)
- **Ключ kie.ai** (бесплатная регистрация на https://kie.ai, скопировать из личного кабинета)
- **Баланс ≥ 1–2 USD** (проверить: `nullume balance`)

### Опционально (для библиотеки вкуса, спринт 2)
- `npm install @huggingface/transformers` (CLIP для эмбеддингов)
- `nullume lib init` (создаст SQLite БД)
- Для чистых источников (Unsplash, Are.na): ключи опциональны
- Для local-only (Pinterest, Dribbble, X): требует `export NULLUME_LOCAL_IMPORTERS=1` и `config.acknowledgedRiskyImporters=true`

## Где лежат данные

```
~/.nullume/                  # Домашний каталог пользователя
├── config.json              # API-ключ и настройки (права 600, только владелец)
├── cache/                   # Кэш каталога моделей (TTL 24ч)
├── jobs/                    # История генераций (JSON)
├── downloads/               # Результаты: картинки, видео, аудио
├── library/                 # SQLite БД и эмбеддинги (спринт 2)
├── models/                  # CLIP-модели (автоматический кэш)
└── sessions/                # Токены Pinterest/Dribbble/X (права 600)
```

**Важно:** все данные вне git, никогда не коммитить `~/.nullume/config.json`.

---

## English Summary

**Nullume** is a standalone media generation CLI and MCP server (works with kie.ai). 

**Package includes:** CLI executable, MCP server adapter, precompiled code (dist/), pre-built data (models catalog, presets), Claude Code skill, taste library curator agent, GitHub Actions workflows, and documentation (English + Russian).

**What `nullume init` does:** Integrates Nullume into a project by setting up `.mcp.json`, copying the skill, and updating `.env.example` and `.gitignore`.

**Prerequisites:** Node.js ≥ 22.13, npm, kie.ai account with balance (register free at kie.ai, get key from dashboard).

**Data stored at:** `~/.nullume/` (config, cache, downloads, embeddings DB for taste library).

Full docs: `README.md` (Russian) or `README.en.md` (English).
