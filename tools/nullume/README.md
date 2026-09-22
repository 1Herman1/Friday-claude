# Nullume — CLI для генерации медиа через kie.ai

Личный инструмент для создания картинок, видео, аудио и музыки с полным контролем цены. Вместо того чтобы платить посредникам, ты напрямую генерируешь через kie.ai — и экономишь 3–10 раз. Как своя ледовая арена вместо проката: дешевле на объём, управляешь всеми параметрами, видишь точную цену до первого взмаха клюшкой.

## Быстрый старт

```bash
# 1. Установка
cd tools/nullume
npm ci

# 2. Базовая настройка (один раз)
npm run setup
# Мастер запросит API-ключ с kie.ai и проверит баланс

# 3. Генерируем картинку (черновик)
npx tsx src/cli/index.ts models list --category image --search text-to-image --json
npx tsx src/cli/index.ts generate create nano-banana-2-lite \
  --prompt "кот в красном свитере" \
  --wait --json

# 4. Результат в файле + JSON с URL
# Готово!
```

## Требования

- **Node.js ≥ 22.13** (LTS)
- **npm** (встроен в Node)
- **Ключ kie.ai** (бесплатная регистрация на kie.ai, получить в личном кабинете)
- Интернет-соединение

## Что в пакете

Полный состав, включая структуру каталогов, требования от получателя и где лежат данные — в `MANIFEST.md`.

## Установка

### Вариант 1: локально в проекте (для разработки)

```bash
cd tools/nullume
npm ci        # установить зависимости (lock-файл точный)
npm run typecheck   # проверить типы
```

### Вариант 2: глобально (после спринта 3)

```bash
npm install -g nullume@latest
nullume --help
```

## `setup` — первый запуск

Мастер настройки запустится один раз и спросит:

```bash
npm run setup
# или после npm i -g:
# nullume setup
```

**Что происходит:**
1. Запрашивает API-ключ (не выводится в консоль)
2. Проверяет баланс на kie.ai
3. Сохраняет ключ в `~/.nullume/config.json` (права 0o600, только ты)
4. Показывает текущий баланс в кредитах и долларах

Если потеряешь ключ, просто запусти `setup` ещё раз или установи вручную:
```bash
export KIE_API_KEY=sk_live_...
npx tsx src/cli/index.ts balance --json
```

## Ключи и сессии

Nullume может работать с разными источниками медиа. Ключи и токены для каждого хранятся по-разному: одни в конфиге, другие в защищённых файлах сессий, третьи в переменных окружения.

### kie.ai — три способа передачи ключа

Ключ kie.ai нужен для генерации. Передать его можно тремя способами, в порядке приоритета:

| Способ | Где | Как задать | Когда использовать |
|--------|-----|-----------|-------------------|
| Переменная окружения | `$KIE_API_KEY` | `export KIE_API_KEY=sk_live_...` | В CI/CD, Docker, при тестировании |
| Конфиг | `~/.nullume/config.json` | `npm run setup` или вручную | На локальной машине (основной способ) |
| GitHub Actions | `KIE_API_KEY` secret | Settings → Secrets and variables → Actions | Для автоматической проверки в репозитории |

**Как задать ключ:**

1. **Локально (один раз, рекомендуется):**
```bash
npm run setup
# Интерактивно спросит ключ и сохранит в ~/.nullume/config.json
```

2. **Вручную отредактировать конфиг:**
```bash
cat > ~/.nullume/config.json << EOF
{
  "apiKey": "sk_live_..."
}
EOF
chmod 600 ~/.nullume/config.json
```

3. **Через переменную окружения (временно):**
```bash
export KIE_API_KEY=sk_live_...
nullume balance --json
```

4. **Для GitHub Actions (деплой + live-check):**
   - Перейди в Settings репозитория → Secrets and variables → Actions
   - Создай новый secret `KIE_API_KEY` со значением ключа
   - Workflow `nullume-live-check.yml` прочитает его автоматически

**Защита:** Конфиг сохраняется с правами `0600` (только владелец может читать). Никогда не коммитай `.env` или `config.json` в git.

### Pinterest API (официальный, без cookies)

Самый надёжный способ — использовать Pinterest API v5 с официальным токеном доступа. Это "чистый" источник, доступный везде: локально, в MCP, в CI.

**Получить токен:**
1. Перейди на [developer.pinterest.com](https://developer.pinterest.com)
2. Создай приложение (если ещё нет)
3. В настройках приложения запроси права: `boards:read` и `pins:read`
4. Скопируй access token

**Способы передачи:**

1. **Переменная окружения (быстро):**
```bash
export PINTEREST_ACCESS_TOKEN=AbCdEf...
nullume lib import pinterest-api --limit 50
```

2. **В конфиг (постоянно):**
```bash
# Отредактируй ~/.nullume/config.json:
{
  "importers": {
    "pinterest": {
      "accessToken": "AbCdEf..."
    }
  }
}
```

3. **В GitHub Actions (для CI):**
   - Создай secret `PINTEREST_ACCESS_TOKEN` в Settings репозитория
   - Workflow сам его подхватит через `getImporterSetting`

### Pinterest, X, Dribbble — локальные сессии (риск на тебя)

Три сервиса работают через локальные браузер-сессии: Pinterest (поиск), X (закладки/лайки), Dribbble (шоты). Сессии сохраняются в `~/.nullume/sessions/` с правами `0600`.

**Тройной гейт: все три условия сразу или не работает:**
1. `acknowledgedRiskyImporters: true` в `~/.nullume/config.json`
2. `export NULLUME_LOCAL_IMPORTERS=1` в окружении
3. Не в CI (нет переменных `CI` или `GITHUB_ACTIONS`)

Сессии работают только локально, никогда не пойдут в MCP или CI.

#### X (auth_token и ct0)

**Риск:** Автоматизация под своей учётной записью нарушает Terms of Service X. Риск блокировки аккаунта. Используй на свой риск.

**Какие cookies нужны:**
- `auth_token` — токен авторизации
- `ct0` — CSRF-токен

**Как получить:**

1. Открой [x.com](https://x.com) в браузере под своей учётной записью
2. Открой DevTools (F12), вкладка Application → Cookies → x.com
3. Найди `auth_token` и `ct0`, скопируй их значения
4. Сохрани в сессию одним из двух способов:

**Вариант А: Через JSON файл (надёжнее):**
```bash
cat > ~/.nullume/sessions/x.json << 'EOF'
{
  "cookies": {
    "auth_token": "AbCdEf...",
    "ct0": "1234567890abcdef"
  },
  "createdAt": "2026-09-21T00:00:00Z",
  "note": "X закладки и лайки"
}
EOF
chmod 600 ~/.nullume/sessions/x.json
```

**Вариант Б: Через CLI (интерактивно):**
```bash
nullume lib session set x --cookie auth_token=AbCdEf... --cookie ct0=1234567890abcdef
```

**Включить гейт:**
```bash
# Отредактируй ~/.nullume/config.json:
{
  "acknowledgedRiskyImporters": true
}

# И в оболочке:
export NULLUME_LOCAL_IMPORTERS=1
```

**Использование:**
```bash
nullume lib import x-cookies --collection bookmarks --limit 20
# или:
nullume lib import x-cookies --collection likes --limit 20
```

#### Pinterest (auth_token и c_user)

**Риск:** Pinterest заблокирует аккаунт при обнаружении автоматизации. Если заблокируешь, удали `~/.nullume/sessions/pinterest.json`, жди 24–48 часов, повтори.

**Какие cookies нужны:**
- `auth_token` — токен сессии
- `c_user` — ID пользователя

**Как получить:**

1. Открой [pinterest.com](https://pinterest.com) под своей учётной записью
2. DevTools → Application → Cookies → pinterest.com
3. Найди `auth_token` и `c_user`

**Сохранить:**

```bash
cat > ~/.nullume/sessions/pinterest.json << 'EOF'
{
  "cookies": {
    "auth_token": "AbCdEf...",
    "c_user": "123456789"
  },
  "createdAt": "2026-09-21T00:00:00Z",
  "note": "Pinterest поиск по собственной сессии"
}
EOF
chmod 600 ~/.nullume/sessions/pinterest.json
```

**Включить гейт и использовать:**
```bash
export NULLUME_LOCAL_IMPORTERS=1
nullume lib import pinterest-cookies --query "design" --limit 50
```

#### Dribbble (access token)

**Риск:** Низкий — API Dribbble поддерживает токены. Но лимиты могут быть строгими.

**Как получить токен:**
1. Перейди в Settings → Integrations → Create new token
2. Выбери права: read

**Сохранить:**

```bash
cat > ~/.nullume/sessions/dribbble.json << 'EOF'
{
  "token": "AbCdEf...",
  "createdAt": "2026-09-21T00:00:00Z"
}
EOF
chmod 600 ~/.nullume/sessions/dribbble.json
```

**Или через env (проще):**
```bash
export DRIBBBLE_ACCESS_TOKEN=AbCdEf...
nullume lib import dribbble --limit 20
```

**Включить гейт (если хочешь из сессии):**
```bash
export NULLUME_LOCAL_IMPORTERS=1
nullume lib import dribbble --limit 20
```

### Краткая таблица: что где нужно

| Источник | Тип | Способ 1 | Способ 2 | Гейт | Где лежит |
|----------|-----|----------|----------|------|-----------|
| **kie.ai** | API ключ | `npm run setup` | env `KIE_API_KEY` | — | `~/.nullume/config.json` |
| **Pinterest API** | Access token | env `PINTEREST_ACCESS_TOKEN` | config `importers.pinterest.accessToken` | — | любой способ |
| **X** | Cookies | JSON файл | CLI `lib session set` | `acknowledgedRiskyImporters: true` + `NULLUME_LOCAL_IMPORTERS=1` | `~/.nullume/sessions/x.json` |
| **Pinterest** | Cookies | JSON файл | CLI `lib session set` | `acknowledgedRiskyImporters: true` + `NULLUME_LOCAL_IMPORTERS=1` | `~/.nullume/sessions/pinterest.json` |
| **Dribbble** | Token | env `DRIBBBLE_ACCESS_TOKEN` | JSON файл `~/.nullume/sessions/dribbble.json` | опционально | env или сессия |

**Важно:** Все файлы сессий (`~/.nullume/sessions/*.json`) должны иметь права `0600` (только владелец). CLI автоматически устанавливает эти права.

## Пять главных команд

### 1. Баланс и кредиты

```bash
nullume balance --json
# {"total": 5000, "used": 2543}
```

**Что означает:**
- `total` — оставшиеся кредиты (1 кредит = $0.005)
- `used` — потрачено с момента регистрации на kie.ai

### 2. Найти нужную модель

```bash
# Все картинки по тексту
nullume models list --category image --search text-to-image --json

# Все видео из картинки
nullume models list --category video --search image-to-video --json

# Музыка
nullume models list --category audio --search music --json

# Озвучка
nullume models list --category audio --search tts --json
```

Выводит: id модели, категорию, цену в кредитах, признаки `[stale]` (устаревшая) и `[≈]` (цена примерная).

### 3. Схема модели — какие поля, какая цена

```bash
nullume models get <id> --json

# Пример:
nullume models get nano-banana-2-lite --json
```

Показывает:
- `required` — обязательные поля (например, `prompt`)
- Дефолты (ширина, длительность, количество вариантов)
- Точную цену

### 4. Оценить стоимость перед генерацией

```bash
nullume generate cost <id> --set width=512 --set height=512 --json

# Выведет:
# {"credits": 4, "usd": 0.02, "approximate": false}
```

Используй эту команду **перед каждой генерацией** чтобы убедиться, что не потратишь зря.

### 5. Запустить генерацию и получить результат

```bash
nullume generate create <id> \
  --prompt "описание того, что нужно" \
  --set width=1024 \
  --wait --json

# Выведет JSON с URLs результатов; файлы скачиваются в ~/.nullume/downloads/
```

**Главные флаги:**
- `--prompt "..."` — описание (обязательно для большинства моделей)
- `--image file.jpg` — локальная картинка (будет загружена автоматически)
- `--set k=v` — переопределить параметр (width, height, duration, aspect_ratio и т.д.)
- `--wait` — дождаться результата (обязательно, иначе получишь только taskId)
- `--out ./каталог` — скопировать результаты в свой каталог (по умолчанию `~/.nullume/downloads/`)
- `--json` — JSON-вывод (нужна для программирования)

## Сколько это стоит

| Модель | Цена | Примечание |
|--------|------|-----------|
| `nano-banana-2-lite` | $0.02 | самая дешёвая картинка |
| `ideogram-2-turbo` | $0.08–0.16 | отличное качество картинок |
| `seedance-2-mini` | $0.15–0.40 | видео из картинки, быстрое |
| `veo-3.1` | $1.28 | видео из картинки, премиум качество |
| `suno-v5` | $0.50–1.00 | музыка (30 сек), долгая генерация |
| `elevenlabs-tts` | $0.02–0.10 | озвучка текста, быстро |

**Пример сметы для MVP:**
- Черновик картинок (10 шт): 10 × $0.02 = $0.20
- Финальные картинки (3 шт): 3 × $0.16 = $0.48
- Одно видео: $0.40
- Музыка: $0.75
- Озвучка (5 фраз): 5 × $0.05 = $0.25
- **Итого: ~$2.10**

С сервисом вроде Artlist то же самое стоило бы $15–25.

## Где лежат файлы

```
~/.nullume/
├── config.json           # твой API-ключ (права 600, только ты)
├── cache/               # кэш каталога моделей и схем (обновляется сам, 24ч TTL)
├── jobs/                # истории всех задач в JSON
├── downloads/           # скачанные результаты (картинки, видео, аудио)
├── models/              # кэш CLIP-моделей для спринта 2
├── sessions/            # Pinterest/Dribbble токены (только локально, спринт 2)
└── library/             # SQLite база референсов (спринт 2)
```

**Важно:** `config.json` с ключом — приватный, никогда в git.

## Установка в другой проект

Если нужен Nullume в своём проекте (не в Friday), есть три способа:

### Способ 1: локально из GitHub (рекомендуется для разработки)

```bash
git clone https://github.com/1Herman1/Friday-claude.git
cd Friday-claude
npm install
cd tools/nullume

# Инициализировать в другом проекте
node bin/nullume.js init /path/to/other/project
```

### Способ 2: глобально из npm (когда выйдёт спринт 3)

```bash
npm install -g nullume@latest

# В своём проекте
nullume init
```

### Способ 3: локально в своём проекте

```bash
cd /path/to/your/project
npx -y nullume init
# Или: npm install nullume --save-dev && npx nullume init
```

**Что делает `init`:**
1. Обновляет `.mcp.json` с правильной командой запуска Nullume
2. Копирует `SKILL.md` в `.claude/skills/nullume/` (для агентов Claude Code)
3. Дополняет `.env.example` строкой `KIE_API_KEY=`
4. Дополняет `.gitignore` строкой `.env`

**Подключить CI (опционально):**
```bash
# Скопировать GitHub Actions workflows в твой проект
mkdir -p .github/workflows
cp node_modules/nullume/templates/github/*.yml .github/workflows/
# или из исходников:
# cp ~/Friday-claude/tools/nullume/templates/github/*.yml .github/workflows/
```

Это включит автоматическую проверку типов, тесты и еженедельный аудит каталога моделей kie.ai.

**Флаги:**
- `--dir /path` — целевой каталог (по умолчанию текущий)
- `--force` — перезаписать существующую запись в `.mcp.json`
- `--json` — вывод результата JSON

**Пример:**
```bash
nullume init /path/to/project --json
# {
#   "created": [".mcp.json", "skills/..."],
#   "updated": [".env.example", ".gitignore"],
#   "skipped": [],
#   "errors": []
# }
```

## Подключение к Claude Code

Nullume подключен как MCP-сервер в `.mcp.json`:

```json
"nullume": {
  "command": "bash",
  "args": ["tools/nullume/bin/mcp-stdio.sh"],
  "env": {"KIE_API_KEY": "${KIE_API_KEY}"}
}
```

**Как это работает:**
1. Claude Code запускает Nullume как MCP-сервер (stdio, как обычный процесс)
2. Агенты используют инструменты `mcp__nullume__list_models`, `mcp__nullume__generate` и т.д.
3. Все результаты приходят в JSON, картинки лежат на диске

**Видны со следующей сессии** после подключения. Если инструменты не появились:
1. Проверь, что `KIE_API_KEY` задана: `echo $KIE_API_KEY`
2. Перезагрузи Claude Code (новая сессия)
3. Спроси `@coder` про `mcp__nullume__list_models`

**Не переживай о базе64** — в Artlist картинки приходили как base64 (~20k токенов каждая). Здесь MCP отдаёт только пути к файлам на диске, Claude читает их через встроенный `Read`.

## Обновление каталога моделей

Kie.ai выпускает новые модели каждую неделю. Каталог кэшируется на 24 часа.

**Обновить вручную:**
```bash
nullume models list --refresh --json
```

**Еженедельный аудит (в CI):**
```bash
npm run build:catalog       # собрать из docs.kie.ai → data/models.json
npm run audit:catalog       # проверить расхождения
```

Если модель исчезла или поле поменялось, аудит скажет об этом.

## Если видишь ошибку сети или `403`

**Признак проблемы:**
```
Error: fetch failed [ERR_HTTP2_CONNECT_FAILURE] or
Error: 403 Forbidden from proxy
```

**Вероятная причина:** песочница Claude Code или корпоративный прокси блокирует доступ к api.kie.ai.

**Проверка:**
```bash
curl -v https://api.kie.ai/api/v1/chat/credit
# Если видишь CONNECT tunnel failed или 403 — дело в сети
```

**Решение:**
1. Проверь: `echo $HTTPS_PROXY` (должен быть прокси с CA-сертификатом)
2. Если работаешь из песочницы Claude Code — это нормально, используй CLI локально на своей машине
3. Если нужно работать из песочницы — напроси доступ к kie.ai или используй Artlist/Higgsfield (они работают)

## Библиотека вкуса (спринт 2)

Коллекция референсов дизайна с автоматической кластеризацией в семьи стилей. Используешь для подбора и утверждения стилей перед генерацией контента через `--style <slug>`.

### Пошаговый workflow

**Этапы:** init → ключи → import/add → embed → cluster → propose → dashboard approve → generate --style

**Владелец:**
1. Инициализация (один раз)
2. Импорт из источников (CLI или дашборд)
3. Кластеризация (автоматический выбор количества групп)

**Claude (taste-curator):**
4. Анализ и предложение дескрипторов

**Владелец:**
5. Утверждение в дашборде
6. Генерация контента в стиле

#### Шаг 1: установка и инициализация

```bash
cd tools/nullume
npm install

# Первый запуск (один раз)
npx tsx src/cli/index.ts lib init
# Создаст: ~/.nullume/library/, ~/.nullume/models/, БД SQLite
```

#### Шаг 2: настроить ключи и импорт-директории

Отредактируй `~/.nullume/config.json`:

```json
{
  "acknowledgedRiskyImporters": false,
  "library": {
    "embedModel": "clip",
    "importDirs": ["/Users/you/Pictures/refs", "/path/to/design/folder"]
  },
  "sources": {
    "raindrop": {"token": "your-raindrop-token"},
    "unsplash": {"apiKey": "your-unsplash-key"}
  }
}
```

**`library.importDirs`** — каталоги, откуда `lib add` и дашборд («Собрать → Добавить свои файлы») берут локальные картинки. Без него разрешён только текущий рабочий каталог. Это защита от случайных ошибок с правами.

**Eagle** работает автоматически через локальный API на `localhost:41595`.

#### Шаг 3: импортировать из чистых источников

```bash
npx tsx src/cli/index.ts lib import eagle --limit 50
npx tsx src/cli/index.ts lib import raindrop --collection "Design" --limit 30
npx tsx src/cli/index.ts lib import pinterest-api --limit 40
npx tsx src/cli/index.ts lib import unsplash --limit 25
npx tsx src/cli/index.ts lib import pexels --limit 25
npx tsx src/cli/index.ts lib import rss --limit 30
npx tsx src/cli/index.ts lib import arena --limit 20
npx tsx src/cli/index.ts lib import civitai --limit 20
npx tsx src/cli/index.ts lib import shotcafe --limit 20
```

#### Шаг 4: local-only с гейтом (опционально)

```bash
export NULLUME_LOCAL_IMPORTERS=1
# Требует также config.acknowledgedRiskyImporters=true
npx tsx src/cli/index.ts lib import pinterest-cookies --dry-run
```

#### Шаг 5: добавить локальные файлы

```bash
npx tsx src/cli/index.ts lib add ~/my-refs/*.png ~/my-refs/*.jpg
```

#### Шаг 6: вычислить эмбеддинги

```bash
npx tsx src/cli/index.ts lib embed
# Загрузит CLIP-модель (1–2 мин), затем вычислит эмбеддинги
```

#### Шаг 7: кластеризовать в семьи

```bash
npx tsx src/cli/index.ts lib cluster --json
# {"k": 4, "clusters": [...]}
```

#### Шаг 8: предложить Claude заполнить дескрипторы

```bash
npx tsx src/cli/index.ts lib propose --json
# Claude предложит имена и описания для каждого семейства
```

#### Шаг 9: открыть дашборд и утвердить

```bash
npx tsx src/cli/index.ts lib dashboard --open
# Открывается на http://127.0.0.1:PORT?token=...
```

**Четыре таба дашборда:**

1. **Референсы** — сетка всех картинок, фильтры, поиск, боковая панель с тегами
2. **Собрать** — запуск импортёров (статус готовности), добавление локальных файлов через абсолютный путь
3. **Семейства** — список с editor'ом для каждого семейства:
   - name, slug, summary
   - mood words (теги)
   - дескриптор: palette, typography, dials (DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY, symmetry), motion, spacing
   - exemplars (выбрать репрезентативные картинки)
   - prompt_fragment и negative_fragment для генерации
   - **Approve** — перевести статус в approved
   - **Копировать команду** — скопировать готовый `nullume generate create --style <slug>` в буфер обмена
4. **Кластеризация** — пересчёт, результат (k, silhouette score, распределение), контекст для Claude

#### Шаг 10: генерировать в стиле

```bash
nullume generate create flux-pro \
  --prompt "a cozy office with morning light" \
  --style editorial-warm-minimal \
  --wait --json
```

### Источники и риски

| Источник | Чистый? | Лимит | Риск |
|---|---|---|---|
| Eagle | ✓ (локальный) | неограниченно | нет |
| Raindrop, Pinterest v5, Unsplash, Pexels, Pixabay, Are.na, Civitai, RSS, shot.cafe | ✓ clean | per API | сетевая блокировка |
| **Pinterest cookies** | ✗ local-only | soft | **блокировка аккаунта** |
| **Dribbble** | ✗ local-only | свои шоты | ограничение API |
| **X (платный)** | ✗ local-only | платно ($0.005/запрос) | **траты денег** |

Все local-only требуют `acknowledgedRiskyImporters=true` + `NULLUME_LOCAL_IMPORTERS=1` + отсутствие CI.

### При блокировке

**Pinterest:** удалить `~/.nullume/sessions/pinterest.json`, ждать 24–48 ч, повторить.

**X:** остановить импорты, проверить счёт в Developer Portal, установить месячный лимит.

Полные детали — в `docs/decisions/ADR-007-reference-sources-policy.md` репозитория Friday.

## Сборка и публикация

### Сборка

```bash
npm run build           # TypeScript → dist/
npm test                # Запустить тесты
npm run typecheck       # Проверить типы
```

### Публикация в npm (только владелец)

```bash
npm login              # Один раз: введи логин/пароль npm
npm run build && npm test   # Обязательно проверить перед пушем
npm publish --access public   # Выложить в публичный npm

# Проверка
npm info nullume  # Должен показать новую версию
```

Скилл будет в пакете (в `skills/nullume/SKILL.md`) для всех, кто установит Nullume через npm.

**Обновить версию перед публикацией:**
```bash
npm version patch    # 0.1.0 → 0.1.1
# или
npm version minor    # 0.1.0 → 0.2.0
```

## Лицензия

MIT © 2026. Основано на идеях [VelsVisual](https://github.com/nick-vels/VelsVisual) (MIT © Nick Vels).

Идеи в коде могут переноситься свободно, но:
- Атрибуция приветствуется
- VelsVisual сам использует MIT, мы тоже (условие совместимости)
- Никаких скрытых ограничений на использование

## Дальше

- Документация агентов — `.claude/skills/nullume/SKILL.md`
- Архитектурные решения — `docs/decisions/ADR-006-nullume-kie-cli-mcp.md` и `ADR-007-reference-sources-policy.md`
- Исходный код — `tools/nullume/src/`
- Общие правила разработки — `CLAUDE.md` в корне репозитория
