# Профиль безопасности: Nullume

Карта стека для агентов `security-*`. Универсальные классы уязвимостей — в
`docs/core/anti-patterns/security.md`; здесь только то, как эти классы
выглядят в Nullume.

---

## Стек

| Слой | Чем реализовано |
|---|---|
| Язык / рантайм | Node.js ≥ 22.13, TypeScript, ESM |
| CLI фреймворк | commander |
| MCP-сервер | @modelcontextprotocol/sdk |
| HTTP-клиент | node:fetch + обёртка (таймауты, retry, rate-limit) |
| Валидация | zod v4 |
| Аутентификация | API-ключи (kie.ai, Are.na, Unsplash, Pinterest) |
| Сохранение данных | JSON-файлы + SQLite (спринт 2) |
| Хранилище | локально `~/.nullume/` + облако kie.ai (24 ч) |

Чего в проекте **нет** (чтобы агенты не искали): браузерный клиент, веб-сервер,
база данных на сервере, аутентификация пользователей, CORS, CSRF, сессии.

## Где что лежит

| Что | Путь |
|---|---|
| HTTP-клиент и обёртка fetch | `src/core/net.ts` |
| Конфигурация и ключи | `src/core/config.ts` |
| Провайдер kie.ai | `src/core/providers/kie/` |
| Защита при загрузке/скачивании | `src/core/files.ts`, `src/core/download.ts`, `src/core/jobs/results.ts` |
| Задачи и кэш | `src/core/jobs/`, `~/.nullume/jobs/` |
| CLI-команды | `src/cli/commands/` |
| MCP-инструменты | `src/mcp/tools/` |
| Секреты на диске | `~/.nullume/config.json` (600), `~/.nullume/sessions/` (600) |
| Коряги kie.ai | спринт 1: `docs/decisions/ADR-006` |

## Перевод классов в конкретику

| Класс | Что искать в Nullume |
|---|---|
| §1 Тайминг | —; нет сравнения паролей или OTP-кодов |
| §2 Криптография | `~/.nullume/config.json` должен быть 0o600 (проверить chmod в `config.ts`) |
| §3 Доступ без проверки | —; нет многопользовательского доступа; владелец один на машине |
| §4 SQL-инъекция | SprinT 2: sqlite (`LibraryStore`); валидация через Zod перед вставкой в БД |
| §5 XSS / сырой HTML | —; CLI только текст, нет HTML-рендера |
| §6 CORS / CSRF | —; CLI не принимает запросы из браузера |
| §7 Загрузки | `src/core/download.ts`: валидация расширений, размеров, path traversal (нет `..` в путях) |
| §7 Upload | `src/core/files.ts::assertUploadable`: magic bytes + deny-patterns, размер < 200 МБ; `src/core/providers/kie/client.ts`: multipart, path-traversal check |
| §8 Переполнение | —; Node.js не уязвим к классическому buffer overflow |
| §9 Rate limit | `src/core/net.ts`: token-bucket 20/10 с на kie.ai, retry на 429 с backoff |
| §10 Отказ в обслуживании | —; локальный CLI, DoS владельца себе самому |
| §11 Платежи | Стоимостной шлюз в SKILL.md (`tools/.claude/skills/nullume/`): подтверждение > $1 |
| §12 Гонки | `src/core/jobs/`: имя файла = UUID4, нет конкурентного доступа |
| §13 Секреты | `KIE_API_KEY` в env → `config.json` (600); Pinterest/Dribbble токены в `sessions/` (600) |
| §13 .env | `.env.example` в репо, `.env` + `.env.local` в `.gitignore` |
| §14 Логи | Не писать ключи в stderr/stdout; логирование функция log(msg, level); debug-флаг |
| §15 Зависимости | `npm audit`, `@dependabot/...` на GitHub, еженедельный audit |
| §16 SSRF | `src/core/download.ts`: https-only, DNS validation (deny private ranges), manual redirects, 512MB limit |
| §17 Порты | —; CLI работает локально |
| §18 Авторизация API | Ключ kie.ai в заголовке `Authorization: Bearer`; Never в URL или теле |
| §19 Версионирование | npm publish с семверсионированием; спринт 3 |
| §20 Хостинг | Нет хостинга; локальный инструмент |
| §21 Настройка | `.env` и `~/.nullume/config.json` — источники истины |
| §22 Валидация | Zod на границе: CLI-аргументы, API-ответы от kie.ai/Are.na/Unsplash |
| §23 Сериализация | JSON.parse + Zod перед использованием; не `eval()` |

## Сигнатуры секретов, специфичные для стека

- `KIE_API_KEY=sk-...` (переменная окружения или `nullume setup --key`)
- `LOTTIEFILES_API_KEY=...` (для MCP icon-library, не nullume)
- Pinterest API v5 токен: `~/.nullume/sessions/pinterest.json` (local-only)
- Dribbble токен: `~/.nullume/sessions/dribbble.json` (local-only)
- X платный ключ: `~/.nullume/sessions/x.json` (local-only)
- Are.na токен: `~/.nullume/config.json` (чистый источник, никакого гейта)
- Unsplash ключ: `~/.nullume/config.json` (чистый источник)

## Защита, встроенная в стек

| Риск | Закрыто стеком | Что всё равно проверять |
|---|---|---|
| Инъекция в ike.ai API | Zod валидирует промпты | Нет `eval()` или динамического кода в промптах |
| SSRF на загрузке | fetch вызывает только из kie.ai | Валидация URL схемы (https), хоста |
| Утечка ключей в логи | —; возможно случайно | Grep по паттернам секретов в `config.ts` и `net.ts` |
| Гонка в `jobs/` | UUID4 в имени файла | Проверить что UUID правда используется везде |

## Защита от local-only рисков (ADR-007)

Local-only импортёры (Pinterest-поиск, Dribbble, X) работают только локально:

- Флаг `config.acknowledgedRiskyImporters=true` обязателен в `~/.nullume/config.json`
- Переменная окружения `NULLUME_LOCAL_IMPORTERS=1` обязательна при запуске
- При `CI=1` или `GITHUB_ACTIONS=1` гейт в `src/library/importers/gate.ts` бросает ошибку
- Никогда не экспортируются в MCP (`src/mcp/tools/*`)
- Предупреждение при каждом запуске: «Используются импортёры с ограничениями»

Риск: Pinterest/Dribbble/X API ToS может запретить автоматизацию; владелец принимает риск блокировки.

## Команды проверки

```bash
npm audit --omit=dev              # уязвимости в зависимостях
npm run typecheck                 # проверка типов TypeScript
npm test                          # юнит-тесты
npm run audit:catalog             # еженедельный дрифт-аудит каталога kie.ai
bash -n .claude/hooks/session-start.sh  # проверка синтаксиса шеллских скриптов
```

## Доступ к сервисам

| Сервис | Как | Где ключ |
|---|---|---|
| kie.ai API | POST /api/v1/jobs/createTask | `KIE_API_KEY` в env |
| Are.na API v3 | GET /api/channels | `~/.nullume/config.json` |
| Unsplash API | GET /photos | `~/.nullume/config.json` |
| Pinterest API v5 | GET /api/v5/search/partner/pins (свои доски) | `~/.nullume/sessions/pinterest.json` |
| Dribbble API v2 | GET /v2/user/shots | `~/.nullume/sessions/dribbble.json` (local-only) |
| X API v2 | GET /2/tweets/search/recent | `~/.nullume/sessions/x.json` (local-only) |

## На что смотреть при инциденте

- Утечка `KIE_API_KEY` → перестановка ключа через kie.ai личный кабинет
- Утечка Pinterest/Dribbble/X токенов → разрыв сессии в их личных кабинетах
- Утечка файла `config.json` → пересоздание, так как только владелец имеет доступ к `~/.nullume/`
- DoS на kie.ai → rate-limit 20/10 с встроенный; мониторить баланс кредитов

## Известные и принятые риски

| Риск | Почему принят | Пересмотреть |
|---|---|---|
| Pinterest local-only под собственной сессией владельца | Нужна Pinterest для стилей; официально это нарушает ToS | Если счёт заблокируют — перейти на платный X API или отказ от Pinterest |
| Node sqlite экспериментальный | Встроена, не требует нативной компиляции | Спринт 2: если проблемы — перейти на better-sqlite3 или postgres-local |
| Ключи на диске с правами 600 | Защита от других пользователей достаточна; владелец один на машине | Если работают много пользователей — перейти на системный keychain (macOS) или libsecret (Linux) |
| Нет ротации ключей | Ключи kie.ai постоянные; refresh token нет | Если ключ компрометирован — ручная регенерация через ключи.kie.ai |
