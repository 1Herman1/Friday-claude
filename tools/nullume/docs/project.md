# Проект: Nullume (CLI + MCP для генерации медиа)

Самодостаточный CLI-инструмент и MCP-сервер для генерации медиа через kie.ai и управления библиотекой вкуса (семейства стилей, референсы).

## Архитектура

- **CLI:** `nullume` — локальный инструмент на машине пользователя, генерирует изображения/видео/аудио
- **MCP-сервер:** регистрируется в `.mcp.json`, работает с агентом `taste-curator` для подбора стилей
- **Библиотека вкуса (спринт 2):** SQLite локально + дашборд утверждения семейств

## Три поверхности на одном ядре

### CLI (`bin/nullume.js`)
Команды: `setup`, `balance`, `models list/get/recommend`, `catalog refresh/audit`, `generate create/cost/wait/list`, `upload`, `lib *` (импорт, кластеризация, дашборд).

Флаги: `--json` (JSON-вывод), `--quiet` (только ошибки).

### MCP (`src/mcp/index.ts`)
Инструменты: `list_models`, `estimate_cost`, `generate`, `lib_search`, `lib_families`, `lib_family_*` и т.д. Ответы: пути к файлам + JSON, никогда base64.

Регистрация в `.mcp.json`:
```json
"nullume": {
  "command": "npx",
  "args": ["-y", "nullume", "mcp"],
  "env": {"KIE_API_KEY": "${KIE_API_KEY}"}
}
```

### SKILL.md (`.claude/skills/nullume/`)
Метапроцедура для Claude Code: стоимостной шлюз (подтверждение > $1), всегда `--json --wait`, выбор дешёвого варианта → финал.

## Технологический стек

| Слой | Чем реализовано |
|---|---|
| Язык / рантайм | Node.js ≥ 22.13, TypeScript, ESM |
| CLI фреймворк | commander |
| MCP-сервер | @modelcontextprotocol/sdk |
| HTTP-клиент | node:fetch + обёртка (таймауты, retry, rate-limit) |
| Валидация | zod v4 |
| Спринт 2: Эмбеддинги | @huggingface/transformers (CLIP, динамический импорт) |
| Спринт 2: БД | node:sqlite (требует Node ≥ 22.13, флаг `--no-warnings=ExperimentalWarning`) |

## Файловая структура

```
tools/nullume/
├── agents/                       # Агент taste-curator
│   └── taste-curator.md
├── bin/
│   ├── nullume.js               # Entry point CLI
│   └── mcp-stdio.sh             # MCP wrapper для development
├── data/
│   ├── models.json              # Вендоренный каталог kie.ai
│   └── prices.json
├── docs/
│   ├── adr/                     # Архитектурные решения
│   │   ├── ADR-006-architecture.md
│   │   └── ADR-007-reference-sources-policy.md
│   ├── project.md               # этот файл
│   ├── brand.md                 # Бренд и тон Nullume
│   └── security-profile.md      # Карта стека для агентов безопасности
├── skills/nullume/
│   └── SKILL.md                 # Метапроцедура для Claude Code
├── src/
│   ├── cli/                     # CLI-команды
│   │   ├── commands/            # Новые команды
│   │   │   └── init.ts          # Инициализация в новом проекте
│   │   └── index.ts
│   ├── core/                    # Общая логика
│   │   ├── config.ts            # ~/.nullume/config.json
│   │   ├── net.ts               # safeFetch обёртка
│   │   ├── providers/           # Интерфейсы генерации (kie, потом fal)
│   │   ├── jobs/                # Управление задачами
│   │   └── files.ts             # Загрузка/скачивание
│   ├── library/                 # Спринт 2: библиотека вкуса
│   │   ├── sessions.ts
│   │   ├── importers/           # Импортёры из источников
│   │   │   ├── http.ts          # Общий HTTP-клиент
│   │   │   ├── gate.ts          # Гейт для local-only
│   │   │   └── clean/           # Are.na, Unsplash, RSS и т.д.
│   │   ├── search.ts            # Поиск в БД
│   │   └── clusters.ts          # Кластеризация и предложения
│   └── mcp/                     # MCP-сервер
│       ├── tools/               # Инструменты
│       └── index.ts
├── scripts/
│   ├── build-catalog.mts        # Вендоринг каталога kie.ai
│   ├── audit-catalog.mts        # Проверка дрифта каталога
│   ├── sync-repo.mts            # Синхронизация с Friday (если в контексте Friday)
│   └── copy-assets.mjs          # Копирование после сборки
├── templates/
│   └── github/                  # GitHub Actions workflows
│       ├── ci.yml               # Typecheck, тесты, еженедельный audit
│       └── catalog-audit.yml    # Проверка каталога
├── .env.example                 # Пример конфигурации
├── .gitignore
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

## Хранилище данных

- **Конфигурация:** `~/.nullume/config.json` (права 0o600) — KIE_API_KEY, Are.na токен и т.д.
- **Сессии:** `~/.nullume/sessions/*.json` (600) — Pinterest cookies, Dribbble, X токены (только CLI, local-only)
- **Кэши и результаты:** `~/.nullume/{cache,jobs,downloads}/` — JSON + файлы результатов
- **Спринт 2:** `~/.nullume/library/` — SQLite БД с референсами, эмбеддингами, семействами

## Предшественники и причины

- **Artlist** — дорогие модели, нет nano-banana-lite, нет Veo 3, нет Seedance 2
- **Higgsfield** — хорошие видео, но тоже дорого
- **kie.ai** — агрегатор сотен моделей, прозрачный прайсинг, дешевле. Но нет официального SDK — пишем свой.

## Запуск

```bash
# Установка из npm (спринт 3)
npm install -g nullume
nullume setup --key $KIE_API_KEY

# Из source (разработка)
npm install
npm run build
npm start -- setup --key $KIE_API_KEY
npm start -- generate create -m flux-pro "a sunset over mountains"
```

## Тестирование

```bash
npm run typecheck
npm test
npm run audit:catalog  # еженедельная проверка дрифта kie.ai
```

## Выкатка

Публикация в npm (спринт 3):
```bash
npm version patch  # или minor/major
npm publish --access public
```

GitHub Actions: запускаются тесты, typecheck, еженедельный audit каталога.
