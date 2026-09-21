# Проект: Nullume (CLI + MCP для генерации медиа)

Один из проектов репозитория Friday (реестр — `docs/projects/README.md`),
собственный CLI и MCP-сервер для генерации медиа через kie.ai и библиотека вкуса
для подбора стилей. Общие правила разработки, агенты и воркфлоу —
универсальные, описаны в CLAUDE.md. Здесь — только то, что относится именно
к Nullume.

Код лежит в `tools/nullume/` — универсальная инфраструктура для инструментов
репозитория, как `tools/icon-mcp-server/`. Со спринта 3 публикуется в npm как
самостоятельный пакет.

## Выкатка

Ветка выкатки: нет — сервера нет. Публикация в npm (спринт 3), из `tools/nullume/`.
Что проверять после: `npx nullume balance` и одна генерация с `--wait`.

Рабочая ветка здесь НЕ указывается: она одна на весь репозиторий и объявлена
в `docs/projects/README.md`. Новых веток не заводить.

## Спринт 2 (библиотека вкуса)

### Зависимости и флаги

- `+ jimp` — превью картинок и палитра (чистый JS, без нативных зависимостей)
- `@huggingface/transformers` в optionalDependencies — эмбеддинги CLIP (динамический импорт, не обязателен)
- `node:sqlite` с флагом `--no-warnings=ExperimentalWarning` (exp. feature, требует Node ≥ 22.13)

### Каталоги

- `~/.nullume/library/` — SQLite БД с riferenze, эмбеддингами, семействами
- `~/.nullume/models/` — CLIP-модели (ленивый загруз, cachedir автоматический)
- `~/.nullume/sessions/` — Pinterest/Dribbble/X токены с правами 0o600

### CLI команды

- `lib init [--model clip|siglip] [--skip-models]` — инициализировать БД и модели
- `lib sources` — список доступных источников (clean vs. local-only)
- `lib import <source> [--collection X] [--limit N] [--dry-run]` — импортировать
- `lib add <files>` — добавить локальные файлы
- `lib embed` — вычислить эмбеддинги CLIP
- `lib list` — все референсы в БД
- `lib search <query>` — поиск по текстовому описанию
- `lib cluster [--k N|--auto-k]` — кластеризовать в семьи
- `lib propose [--json]` — Claude заполняет дескрипторы
- `lib dashboard` — дашборд утверждения семейств (локальный, 127.0.0.1)
- `lib family list|show <id>|set <id>|merge|discard` — операции с семействами
- `lib session set <source>` — установить учётные данные для local-only
- `lib status` — статус библиотеки (count: references, embeddings, families)

### MCP (только clean, не local-only)

- `lib_search` — поиск по запросу
- `lib_families` — список семейств
- `lib_family` — детали семейства (exemplars, descriptor)
- `lib_import` — enum с clean-источниками (не Pinterest cookies/Dribbble/X)
- `lib_clusters` — результат кластеризации
- `lib_propose` — предложения Claude

### Агент

Новый агент `.claude/agents/design/taste-curator.md` — куратор референсов, методология заполнения дескрипторов (палитра, типографика, motion, dials, доминирующий паттерн).

## Пользователь

Имя: Гермес

Опыт:
- Разработка сайтов на WordPress и Shopify
- SEO продвижение
- Понимает структуру проектов, но не всегда понимает код

Как общаться с Гермесом:
- Объяснять код простыми словами — что делает эта строка и зачем
- Не предполагать что термины очевидны — расшифровывать аббревиатуры и технические понятия
- Сначала объяснение на русском, потом код
- При выборе решений объяснять плюсы и минусы простым языком
- Аналогии с хоккеем
- Обращение — «сэр»; роль Claude — Джарвис, правая рука по работе с системой

## Технологический стек Nullume (реальный)

Это CLI-инструмент и MCP-сервер, не веб-сайт. Стек радикально отличается
от дефолта в `docs/core/stack.md`.

**Что НЕ применимо:** Next.js, Prisma, PostgreSQL, Vercel, React, браузерный
клиент, веб-приложение.

### Язык и рантайм
- Runtime: Node.js ≥ 22.13
- Language: TypeScript
- Module system: ESM
- Package manager: npm (не yarn, не pnpm)

### Основные зависимости
- CLI framework: `commander@^15` (фреймворк для CLI-команд)
- Validation: `zod@^4` (валидация схем API, инпутов пользователя)
- MCP-сервер: `@modelcontextprotocol/sdk@^1.30` (SDK для MCP)
- HTTP-клиент: встроенный `node:fetch` (таймауты, rate-limiting, retry в обёртке)
- Файловая система: встроённые `node:fs`, `node:path`, `node:crypto`

### Спринт 2 (библиотека вкуса)
- Эмбеддинги: `@huggingface/transformers@^4` (CLIP-модель без Python и нативных зависимостей)
- БД: встроённый `node:sqlite` (exp.flag; требует Node ≥ 22.13)

### Инструменты разработки
- TypeScript: `typescript@^5.9`, `@types/node@^22`
- Запуск: `tsx` (TypeScript executor)
- Тесты: `node --import tsx --test` (встроённый test runner, моки через fetch)

### Хранилище данных
- Конфигурация и сессии: JSON-файлы в `~/.nullume/config.json`, `~/.nullume/sessions/*.json` (права 0o600)
- Кэши и загрузки: JSON + JPEG/PNG/WebM в `~/.nullume/{cache,jobs,downloads,models,library}/`
- Спринт 2: SQLite в `~/.nullume/library/` (встроен в Node)
- Вне git — все данные в `~/.nullume/`

### Инфраструктура и выкатка
- **Развёртывание:** нет собственного сервера. CLI работает на машине пользователя.
- **Публикация:** npm (спринт 3); скилл `.claude/skills/nullume/` в репозитории для Friday.
- **CI:** GitHub Actions — typecheck, тесты, еженедельный аудит каталога kie.ai.
- **Ключи и секреты:**
  - `KIE_API_KEY` → из `.env` или переменной окружения → сохраняется в `~/.nullume/config.json` (600)
  - Pinterest/Dribbble/X токены → `~/.nullume/sessions/` (600) только в CLI, не в MCP/CI
  - В чат/коммиты не присылаются

## Выкатка на сервер

Не применимо. Nullume публикуется в npm (спринт 3), а не на сервер.
Выкатка = `npm publish --access public` из CI после тагирования.

## Правовой контур (для агента `rkn-compliance`)

Nullume — инструмент для владельца (Гермеса) и средства автоматизации (Claude Code).
Не публичный веб-сайт. Персональных данных третьих лиц не собирает.

- Оператор ПД: —; инструмент не обрабатывает данные граждан РФ
- Контакт по вопросам ПД: —
- Ответственный за организацию обработки: —
- Уведомление в РКН: не требуется
- Карточка в реестре операторов: —
- Хостинг: локально на машине Гермеса + облачное хранилище результатов на kie.ai (~24 часа)
- Физическое расположение БД: —; нет БД
- Бэкапы: —
- Трансграничная передача: запросы на kie.ai + опциональные Are.na, Unsplash, Pinterest API
- Сервисы, обрабатывающие ПД: kie.ai (промпты, не ПД); Are.na, Unsplash, Pinterest API
- Категории собираемых ПД: запросы (prompts) — не ПД; результаты — на диске Гермеса и облаке kie (24 ч)
- Способ авторизации: —; нет веб-сайта
- Cookie и аналитика: —
- Интернет-реклама: —
- Рекомендательные технологии: —
- Отраслевые и возрастные ограничения: —
- Дата последней проверки комплаенса: 19.09.2026

**Принятые риски:**

- `node:sqlite` отмечен как экспериментальный; требует флага `--no-warnings=ExperimentalWarning`; Node ≥ 22.13
- Pinterest local-only mode работает под собственной сессией Гермеса; риск блокировки — владелец принимает (ADR-007)
- Секреты на диске с правами 600; защита от других пользователей достаточна

## Домены проекта (бизнес-логика)

### Единицы и лимиты
- **Кредиты kie.ai:** 1 кредит = $0.005
- **Цены моделей:** указаны в каталоге `data/models.json` (вендоренный snapshot)
- **URL результатов:** живут ~24 часа на kie.ai
- **Rate limit:** 20 запросов / 10 секунд на kie.ai
- **Стоимостной шлюз:** запрашивать подтверждение при стоимости > $1.00, расходе > 10% баланса или неизвестной цене

### Генерация
- **Один вариант на запрос по умолчанию**
- **Загрузка локальных файлов:** `--image file.jpg` → автоматический upload
- **Таймауты:** сетевой 10 с, ожидание 600 с, загрузка 300 с
- **Имя файла:** `<model>-<id8>-<n>.<ext>` где id8 — первые 8 символов taskId

### Библиотека вкуса (спринт 2)
- **Дескриптор:** палитра, типографика, ритм отступов, радиусы, shadows, motion, dials, pattern, prompt_fragment, negative_fragment
- **Импортёры:** чистые (Are.na, Unsplash, галереи) + local-only (Pinterest, Dribbble, X)
- **Гейт local-only:** требует `config.acknowledgedRiskyImporters=true` + env `NULLUME_LOCAL_IMPORTERS=1`, отказывает при CI

## Три поверхности

### CLI (`bin/nullume.js`)
Команды: `setup`, `balance`, `models list/get/recommend`, `catalog refresh/audit`, `generate create/cost/wait/list`, `upload`, `lib *`.
Флаги: `--json` (JSON-вывод), `--quiet` (только ошибки).
Exit codes: 0 (успех), 1 (ошибка), 2 (валидация).

### MCP (`src/mcp/index.ts`)
Инструменты: `list_models`, `estimate_cost`, `generate` (wait по умолчанию), `get_job`, `lib_search`, `lib_family_*`.
Ответы: пути к файлам + JSON, никогда base64.

Регистрация в `.mcp.json`:
```json
"nullume": {
  "command": "bash",
  "args": ["tools/nullume/bin/mcp-stdio.sh"],
  "env": {"KIE_API_KEY": "${KIE_API_KEY}"}
}
```

### SKILL.md (`.claude/skills/nullume/`)
Метапроцедура для Claude Code: стоимостной шлюз, всегда `--json --wait`, дешёвый вариант → финал,
не показывать taskId, грабли kie.

## Git

- Коммитить только по явной просьбе пользователя
- Пушить на рабочую ветку из `docs/projects/README.md`
- Сообщения коммитов: короткие, на английском, «что и зачем»
- Не создавать PR без явной просьбы
- `data/*.json` коммитятся (вендоренный каталог)
- `~/.nullume/` и `node_modules` — не коммитятся
