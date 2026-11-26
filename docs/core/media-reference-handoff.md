# Контракт handoff визуальных референсов v1

Единый контракт для `taste-curator` → `design-department` → `media-generator` →
`brand-guard` / `design-reviewer`. Изображения — **native Codex image generation**;
видео — **KIE через существующий Nullume**. Artlist не является маршрутом этой
цепочки. Музыка/озвучка остаются отдельной задачей: не переключать провайдера
молча. Правила этого контракта для медиа приоритетнее общих auto-approve и
«дешёвого черновика»; запрос исправить workflow не разрешает генерацию.

Целевая среда исполнения — **Codex IDE**: .codex/config.toml →
.codex/agents/*.toml (синхронизированные .codex/agents/design/*.md).
Общие документы остаются в docs/, Claude-инструкции не меняются.
В IDE сначала обнаружить доступные browser/vision/native image tools; примеры
Hermes ниже не объявляют эти инструменты инструментами Codex. Проверка файлов
конфигурации не доказывает, что уже открытая IDE-сессия перечитала их.
Разрешённый владельцем поиск/подготовка refs не требует повторного разрешения;
AI rights, расходы, пилот и публикация остаются отдельными gates.

## 1. Куратор: проект и визуальный поиск

Прочитать конкретные `project.md`, `brand.md`, `design-system/MASTER.md`, UI-kit
и переопределения страницы. Нет UI-kit/MASTER — явно назвать пробел, не выдать
чужое семейство Nullume за утверждение проекта. Собственная методика сравнения —
**implementation rubric**, не новые клиентские требования.

Искать визуально в браузере **Pexels / Pixabay / Unsplash / Pinterest**:
узкие запросы по сцене, материалу, свету, композиции, а не только «skincare».
Nullume — дополнительная библиотека, не замена свежему поиску. Сначала проверить
условия доступа/AI-use по тексту; не загружать запрещённые изображения в модель.
Показать для каждой обложки выбранные и отвергнутые варианты с причинами:
палитра относительно MASTER, освещение/материалы, положение товара, иерархия,
место под текст, desktop/mobile crop, отличимость от остальных обложек.
Каждой обложке — собственный `cover_id`, manifest и предметная сцена; один фон
с тремя перестановками упаковок не считать тремя самостоятельными сценами.

### Браузер и доступ

В Hermes при разрешённой работе в пользовательском браузере использовать
`browser_exec(..., local=True)` в узком scope нужных источников. Это запрос
копии default Chromium profile, **не обещание доступа к Safari, аккаунту или
залогиненной сессии**. Проверить фактический результат: `real_profile_unavailable`
или fresh-profile fallback означает браузер БЕЗ пользовательского login.
Проверить страницу/скриншот: security check — не выдача поиска. В других рантаймах
сначала обнаружить доступный browser tool; не выдумывать MCP/browser capabilities.

Нет браузера у субагента — родитель делает поиск и передаёт разрешённые изображения,
либо фиксируется blocker. Login — только vault/user, никогда чтение/экспорт cookies,
auth-файлов, паролей или обход WAF. Не менять Nullume gates/config/runtime ради
доступа. Сайт может быть недоступен; fallback — другой разрешённый источник или
файлы владельца, с честным указанием пробела. API readiness и browser readiness —
разные проверки; `lib sources` показывает регистрацию, не готовность.

## 2. Ролевые файлы и provenance

Один JSON на обложку, начиная с `docs/core/templates/media-handoff.json`.
Шаблон **целиком synthetic test fixture**, не исследование: `fixture://` и
`/fixture/` намеренно не настоящие ссылки/файлы. Не сдавать его как найденные refs.
Для реальной работы заменить ВСЕ fixture-поля, поставить `fixture: false`.

Для каждого ref хранить:
- `id`, `role`: `scene`, `product` либо `label`; для product/label — `sku`
  (непустая реальная строка или явный null). При null обязателен проверенный
  `product_id` либо `slug`, `identity_verified: true` и `identity_evidence`
  на запись каталога/инвентаря. Не сочинять SKU. Product и label используют одну
  пару (тип идентификатора, значение): приоритет SKU → product_id → slug.
  Если выбрано product_id, одинакового slug недостаточно. Reviewer сверяет
  evidence с реальным каталогом; validator не удостоверяет истинность записи;
- `source`, `page_url`, `original_url`, абсолютные `original_path`, `preview_path`,
  SHA-256 оригинала. Для собственных файлов допустим документированный `file://`
  источник, но не вымышленная публичная ссылка;
- `rights`: classification (`reference-only` / `permitted-AI-input` / `publishable`),
  **отдельные** `ai_permission`, `ai_evidence`, `publication_permission`, basis,
  дата проверки. Строка «Pinterest», автор pin, preview, clean importer и лицензия
  на коммерческое размещение сами по себе НЕ подтверждают AI permission;
- `vision.loaded` + evidence конкретного успешного открытия файла агентом.

Сцена, каждый реальный SKU/packshot и крупная этикетка — **отдельные файлы**.
Этикетка может быть честным crop собственного разрешённого packshot, с записанным
происхождением; не рисовать/«восстанавливать» отсутствующие надписи. Сцена не
подменяется фотографией флакона на белом фоне. Preview служит навигацией, финалисты
проверяются по оригиналам; если доступен лишь thumbnail, отметить ограничение.

Research-only допустим: `stage: research`, `transfer: null`, `generation: null`.
Unknown/no AI permission → `reference-only`, `ai_permission: false`,
`vision.loaded: false`: остаются URL/права/пробелы, **не передавать даже в vision**.
Такой этап не является готовым визуально проверенным handoff. Чтобы завершить
отбор агентом, найти AI-разрешённую альтернативу: действительно открыть её
изображение в vision (доступный image/vision tool Codex IDE; в Hermes — `vision_analyze`).
Факт текстового описания, путь в промпте или browser DOM не равен просмотру картинки.
Для browser screenshot с reference-only материалом действует тот же AI gate.

## 3. Передача без потерь

Для `stage: ready` должны быть реальные оригиналы, сравнение, vision evidence,
неизменяемые детали SKU/этикетки, palette/layout desktop+mobile, права и разрешение
владельца на **один пилот** с лимитом расходов/usage.

- Если текущая схема `delegate_task` поддерживает `images`, передать **все**
  разрешённые изображения этим параметром плюс JSON/полные инструкции агента.
  Проверить схему инструмента в текущем рантайме, не изобретать параметры.
- Иначе `transfer.method: agent-vision-load`: агент сам явно открывает каждый
  original в vision до работы и возвращает evidence; текстовый список путей не
  замена картинкам. `transfer.ref_ids` сохраняет все ID в порядке `refs`.
- В Codex IDE исполнитель явно открывает все разрешённые originals доступным
  image/vision tool (`agent-vision-load`); поддерживаемые image attachments можно
  использовать дополнительно. Если отдельно выбран CLI, передать все файлы
  `--image`. Перечислить роли, stable идентификаторы и запреты, потребовать все
  пути в фактическом native image call. Ни IDE attachments, ни CLI-флаги не доказательство.
- **CLI attachments не доказывают native inputs.** После пилота сверить actual
  `referenced_image_paths` native вызова со всем manifest. `--style` и exemplars
  не гарантия: текущий Nullume может использовать preview, не добавлять scene
  при пользовательском image, а single-image модель — взять только первый файл.
  Любая потеря/подмена ref или single-image backend для multi-ref → STOP, не
  разрешать silent first-image fallback и не объявлять fidelity подтверждённой.

## 4. Проверенные команды и readiness (не запускать генерацию автоматически)

Из корня репозитория, без установки и без секретов:

```bash
npx --offline --yes @openai/codex --version
npx --offline --yes @openai/codex login status
npx --offline --yes @openai/codex features list
npx --offline --yes @openai/codex exec --help
node tools/nullume/bin/nullume.js --help
node tools/nullume/bin/nullume.js models list --category video --json
node tools/nullume/bin/nullume.js models get MODEL_ID --json
node tools/nullume/bin/nullume.js generate cost MODEL_ID --json
node tools/nullume/bin/nullume.js generate create --help
```

`MODEL_ID` — placeholder: взять реальный из каталога и сверить схему/параметры.
`balance --json` — отдельная readiness-проверка после разрешённого подключения
KIE владельцем. В аудите 15.11.2026 KIE key отсутствовал: ни баланс, ни серверная
auth, ни видео не подтверждены. Ключ вводит владелец безопасно; агент не просит
секрет в чате. Нет ключа/баланса/согласованного бюджета → только план, без upload.
`generate create` не имеет `--dry-run` в проверенном help; не считать такой флаг
защитой от расходов. `generate cost` не генерирует. Схемы/цены — не доказательство
рабочей модели. Native Codex feature flag/auth тоже не доказывают entitlement,
остаток лимита или качество; подписка не означает бесплатную генерацию.

Только ПОСЛЕ отдельного разрешения на пилот, из ограниченного scratch-каталога
вне сайта (подставить реальные разрешённые пути):

```bash
npx --offline --yes @openai/codex exec \
  --skip-git-repo-check --sandbox workspace-write \
  --enable image_generation --ignore-user-config \
  -C "$SCRATCH" \
  --image "$SCENE" --image "$PRODUCT" --image "$LABEL" \
  --output-last-message "$SCRATCH/result.txt" - < "$SCRATCH/prompt.txt"
```

Для нескольких SKU добавить все product/label attachments, не только первый.
PTY/tracked process; не `--ephemeral`: нужны события для проверки. Prompt требует
native image_gen, реальные output files, все refs, **никаких PIL/SVG/procedural
замен изображений или Python-motion вместо видео**, никаких writes в сайт.
Contact sheet для сравнения допустим только как подписанный обзор реальных
разрешённых оригиналов, не готовая обложка/результат генерации.

Видео: только существующий Nullume → KIE, после readiness, точной схемы модели,
прав на inputs и утверждённого бюджета. Не запускать автоматически recipe с
image-шагом KIE вместо native Codex; утверждённый native кадр передать разрешённой
image-to-video модели. Проверить поддержку входов без first-image fallback.
Для многокадровой модели убедиться в роли/порядке всех кадров. Новые runtime
изменения и новые провайдеры — отдельное разрешение.

## 5. Проверка native результата и production gate

После пилота найти фактический native tool call в session evidence: он может
быть code-mode `exec` с `tools.image_gen__imagegen(...)`, а не top-level image_gen.
Сохранить компактный extract реального вызова (`referenced_image_paths`) с
указателем на session/event, без auth/большого base64. Если вызов копировал файлы,
сопоставить по хешам и сохранить mapping; валидатор требует канонический порядок
manifest, нельзя молча вписать ожидаемые пути вместо наблюдавшихся.
`generation.native_call.evidence_path` указывает на JSON extract. Сверить
completed `image_gen.generation` event и байты/хеш сохранённого PNG; открыть
результат в vision. Неполные события → **unverified**, не успех.

`stage: native-verified` допустим только после этих ручных проверок. Валидатор
проверяет структуру, пути, хеши и равенство списков с extract; **не удостоверяет**
подлинность прав, одобрения, vision evidence или native события, не оценивает
изображение и не вызывает провайдеров. Это документарный gate, не runtime
interceptor. Reviewer должен прочитать реальные evidence, не только green JSON.

Implementation rubric: соответствие сцены и MASTER/UI-kit; desktop/mobile crop;
реальный SKU, геометрия/материал упаковки; точное визуальное сравнение этикетки,
логотипа/объёма/надписей, отсутствие чужого бренда и артефактов. **Не обещать
идеальную этикетку.** Ошибка или нечитаемость критичных деталей → отклонить пилот,
не масштабировать и не дорисовывать программно без нового отдельного решения.
Видео дополнительно: начало/конец, весь таймлайн, деформация товара/текста,
loop seam и reduced-motion/poster для будущего UI.

`brand-guard` проверяет сам ассет; `design-reviewer` — визуальный контекст UI,
desktop/mobile, без дублирования. Сначала один пилот → owner acceptance → отдельное
разрешение масштаба. Исходный сайт/медиа остаются нетронутыми. Сохранение проверенного
черновика — вне `public/` и deployment. Production/встраивание — только после
явного owner approval результата и прав; поручение «сделай» не равно «публикуй».

## 6. Offline валидация

```bash
python3 .codex/scripts/validate_media_handoff.py docs/core/templates/media-handoff.json --dry-run
python3 -m unittest discover -s .codex/scripts -p test_media_handoff.py -v
# Реальный manifest (без fixture exemptions):
python3 .codex/scripts/validate_media_handoff.py /absolute/path/handoff.json
```

Exit 0 = документ прошёл проверки, exit 1 = blocked. Даже `--dry-run` не отключает
проверки реальных файлов, если `fixture: false`. Synthetic fixture проходит только
с `--dry-run`; тесты не являются реальным исследованием или проверкой генератора.
