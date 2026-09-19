---
name: nullume
description: Генерация фото, видео, аудио, музыки и озвучки через Nullume CLI и MCP (kie.ai). Когда нужна дёшево и быстро — картинки, видео, саунд-эффекты, озвучка. Когда нужен style kit — используй Artlist (media-generator). Когда нужна огромная библиотека моделей с прозрачными ценами и выбором оптимальной — это Nullume.
allowed-tools: Bash, Read
---

# Nullume — генерация медиа через kie.ai

Собственный CLI-инструмент и MCP-сервер для генерации изображений, видео, аудио и музыки через агрегатор kie.ai. **Главное отличие от Artlist:** прозрачный прайсинг, выбор оптимальной модели по цене, дешёвые генерации (nano-banana-2-lite от $0.02), новые модели (Seedance 2, Kling 2.5, Suno V5).

## Две дороги: команда в терминале vs. MCP-инструменты

### Дорога 1: CLI (интерактивный инструмент на машине)

```bash
cd tools/nullume && npx tsx src/cli/index.ts <команда> <опции>
```

Или после глобальной установки (спринт 3):
```bash
npx nullume <команда> <опции>
```

**Основные команды:**
- `nullume balance` — текущий баланс в кредитах
- `nullume models list --category image --search <текст>` — поиск моделей
- `nullume models get <id> --json` — точная схема модели (поля input, обязательные, цена)
- `nullume generate cost <id> [--set k=v]` — оценка стоимости без генерации
- `nullume generate create <id> --prompt "..." [--image file.jpg] [--set k=v] --wait --json` — запустить генерацию и дождаться результата
- `nullume lib search <текст>` — поиск в библиотеке вкуса (спринт 2)

### Дорога 2: MCP-инструменты (для агентов Claude Code)

Инструменты видны в Claude Code под префиксом `mcp__nullume__*`:
- `mcp__nullume__list_models` — список моделей с фильтрацией
- `mcp__nullume__get_model` — схема модели
- `mcp__nullume__estimate_cost` — оценка стоимости
- `mcp__nullume__generate` — запустить генерацию (ждёт по умолчанию)
- `mcp__nullume__get_job` — статус задачи
- `mcp__nullume__upload_file` — залить локальный файл

Ответ — JSON + пути к файлам на диске (не base64).

## Стоимостной шлюз (обязательно перед генерацией)

**Порядок перед каждой генерацией:**

### Шаг 1: получить свежий id модели и её схему

Никогда не используй id модели из памяти или примеров в этом скилле.

```bash
nullume models list --category image --search "text-to-image" --json
# Выберешь нужный id из результата
nullume models get <id> --json
# Посмотришь обязательные поля, их дефолты и точную цену
```

### Шаг 2: оценить стоимость

```bash
nullume generate cost <id> --set aspect_ratio=1:1 --json
```

Ответ содержит `credits` (кредиты) и `usd` (доллары). **Метка `approximate: true`** означает, что цена подобрана по описанию — это оценка, дообщи об этом.

### Шаг 3: сверить с балансом

```bash
nullume balance --json
```

Если баланс < 100 кредитов — предупреди.

### Шаг 4: спросить подтверждение (ОБЯЗАТЕЛЬНО, если хотя бы одно верно)

- Стоимость > $1.00
- Стоимость > 10 % текущего баланса
- Источник оценки `fuzzy` или `unknown` (неизвестная цена)

Примеры:
- ✓ **Подтверждение не нужно:** nano-banana-2-lite $0.02, баланс 1000 кредитов (0.1 %)
- ✗ **Спроси подтверждение:** Veo 3.1 $1.28, баланс 50 кредитов (256 %)
- ✗ **Спроси подтверждение:** неизвестная цена `approximate: true`, даже если баланс большой

Без явного «да, генерируй» запрос не отправляй. При отказе предложи более дешёвый вариант (другую модель, меньшее разрешение, короче длительность).

## Правила работы

1. **`--json` всегда.** Все команды с выводом в stdout запускай с флагом `--json`.

2. **`--wait` всегда при генерации.** Запускать через `generate create ... --wait --json`. URL результатов живут ~24 часа, поэтому скачивай сразу.

3. **Никогда не показывать пользователю:**
   - `taskId` (задача для внутреннего использования)
   - Коды ошибок API (451, 429, 422)
   - Имена инструментов MCP (`mcp__nullume__*`)
   - Только показывай результат и цену

4. **Чёрновик дешёвой моделью, затем финал.** Прогони первый вариант на nano-banana-2-lite или `-mini` версии модели (если есть). Финальный рендер — только после утверждения, на топовой версии.

5. **Не трать кредиты впустую.** Проверять сборку запроса через `--dry-run` (не отправляет, не списывает). Каждый реальный запрос — реальная цена.

## Дерево выбора модели по задаче

### Текст → картинка (text-to-image)

**Поиск:**
```bash
nullume models list --category image --search text-to-image --json
```

**Черновик:** `nano-banana-2-lite` (самая дешёвая, ~$0.02)
**Финал:** `ideogram/ideogram-2-turbo` или `flux-pro` (качество выше)

### Картинка → видео (image-to-video)

**Поиск:**
```bash
nullume models list --category video --search image-to-video --json
```

**Черновик:** `seedance-2-mini` или `-lite` версия ($0.15–0.40)
**Финал:** `seedance-2` или `veo-3.1` (Veo $1.28, очень хорошо)

**Грабли:** `aspect_ratio` должна совпадать с исходной картинкой, иначе обрежет. Используй `--set aspect_ratio=1:1` или скачивай картинку исходного размера.

### Текст → видео (text-to-video)

**Поиск:**
```bash
nullume models list --category video --search text-to-video --json
```

**Черновик:** `nano-banana-2-lite` с `motion_type` (если есть)
**Финал:** `veo-3.1` или `kling-2.5`

### Озвучка (text-to-speech)

**Поиск:**
```bash
nullume models list --category audio --search tts --json
```

**Финал:** `elevenlabs/text-to-speech-turbo-2-5` (самое качественное)

### Музыка (text-to-music)

**Поиск:**
```bash
nullume models list --category audio --search music --json
```

**Финал:** `suno-v5` (лучшее качество, долгая генерация — `--wait-timeout 900`)

### Апскейл / удаление фона

**Поиск:**
```bash
nullume models list --category image --search upscale --json
```

## Грабли kie.ai (важно)

1. **`generate_audio=false` при ошибке про copyright**
   
   У видеомоделей (Seedance, Kling) может прийти ошибка: `[500] output audio may be related to copyright restrictions`. Тогда перезапусти с `--set generate_audio=false`.

2. **`aspect_ratio` под исходник**
   
   Если работаешь с картинкой, всегда уточни её пропорцию и передай: `--set aspect_ratio=1:1` или `16:9`. Дефолт часто 16:9 и обрежет квадратное изображение.

3. **Поле картинки называется по-разному**
   
   `first_frame_url`, `image_url`, `image_urls`, `input_urls`, `image`. Команда `--image` подставит правильное автоматически. При ручном `--set` смотри в `models get <id> --json` точное имя поля.

4. **`[451]` — перезалей через upload**
   
   Код 451: API не смог скачать твой URL. Запросили `https://...` и получили таймаут или 403. Решение:
   ```bash
   nullume upload ./photo.jpg --json
   # Получишь fileUrl
   nullume generate create ... --set image_url=<fileUrl>
   ```

5. **`[429]` — rate limit, подожди**
   
   Слишком много запросов за раз. Лимит: 20 запросов / 10 секунд. Автоматический retry есть, но если не помогает — жди 30–60 секунд и повтори.

## Библиотека вкуса (спринт 2: заглушка)

В спринте 2 появится команда `lib` для коллекции референсов:

```bash
nullume lib init                        # инициализировать библиотеку
nullume lib add ./ref1.png ./ref2.png   # добавить референсы
nullume lib cluster --k 5 --json        # кластеризовать в 5 семейств стилей
nullume lib family show <id>            # показать представителей семейства
nullume lib family set <id> --name "editorial-brutal" --descriptor ./d.json
```

На этапе спринта 2 добавится раздел. Сейчас помни: `lib` команды не запускаются, они в работе.

## Пример сессии (6–8 команд подряд)

```bash
# 1. Проверим баланс
nullume balance --json
# {"total": 5000, "used": 2543}

# 2. Ищем модель для картинки (дешёвый черновик)
nullume models list --category image --search text-to-image --json | head -20
# Видим в выводе: nano-banana-2-lite с ценой "4" кредита

# 3. Смотрим точную схему
nullume models get nano-banana-2-lite --json
# {"id":"nano-banana-2-lite","category":"image","price":{"credits":4,"usd":0.02},...}

# 4. Оцениваем стоимость конкретно (черновик 512x512)
nullume generate cost nano-banana-2-lite --set width=512 --set height=512 --json
# {"credits":4,"usd":0.02,"approximate":false}

# 5. Всё дешево, спрашиваем подтверждение (не нужно, < $1 и < 10% баланса)
# Генерируем черновик
nullume generate create nano-banana-2-lite \
  --prompt "editorial still life: coffee cup and autumn leaves, golden hour light" \
  --set width=512 --set height=512 \
  --wait --wait-timeout 300 \
  --out ~/.nullume/outputs \
  --json

# 6. Видим результат в JSON: {"taskId":"...","state":"success","urls":["https://..."]}

# 7. Если понравился — ищем топовую модель
nullume models list --category image --search ideogram --json

# 8. Генерируем финал
nullume generate create ideogram/ideogram-2-turbo \
  --prompt "editorial still life: coffee cup and autumn leaves, golden hour light, professional photography, warm tones, shallow depth of field" \
  --set width=1024 --set height=1024 \
  --wait --out ~/.nullume/outputs \
  --json
```

**Примечание:** в примере выше `nano-banana-2-lite` — реальный id (проверь через `nullume models list --search nano --json` перед использованием).

## MCP и агенты

Когда агент Claude Code запускает Nullume через MCP, порядок не меняется:
1. `mcp__nullume__list_models` с фильтрацией
2. `mcp__nullume__get_model` для схемы
3. `mcp__nullume__estimate_cost` для оценки
4. **Запросить подтверждение пользователя (при условиях)**
5. `mcp__nullume__generate` с флагом wait=true
6. Скачать результаты

Ответы приходят в JSON + пути к файлам (используй `Read` чтобы посмотреть картинку).
