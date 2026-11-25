# Friday: аудит системы разработки и дизайна перед расширением агентов

## 1. Результат и границы

**Результат:** Friday уже имеет специализированный дизайн-отдел, разделение производства и ревью, систему токенов, кураторство референсов и UI-motion. Нужны не ещё одни универсальные «дизайнеры», а ограниченные адаптеры Figma, Canva и отдельного видеопроизводства Remotion с проверяемыми handoff. Массовая установка taste-skills без разбора приоритетов создаёт пересечение с существующими правилами и исполнителями.

**Роль:** researcher, адаптированная в Hermes; не native Codex и не native Claude. Переделегирование не выполнялось.

**Scope:** read-only исследование инструкций и архитектуры; единственная разрешённая запись — этот новый отчёт. Не запускались установка skills, изменение конфигов, генерация, доступ к платным сервисам, Git fetch/rebase/checkout/commit/push, hooks и task gate. Task gate создал бы дополнительные файлы вне разрешённого scope; его инициализация оставлена координатору при отдельном разрешении. Самопроверка отчёта не выдается за независимое ревью.

**Revision:** рабочая ветка `claude/greeting-nnz368`, HEAD `388ec708f39583172d7f36110f6424cc175b5512`. Локальная remote-tracking ссылка `origin/claude/greeting-nnz368` указывает на тот же SHA. Сравнение через `git show @{upstream}:<path>`; сетевой fetch в этой работе не выполнялся. Это сравнение с имеющейся ссылкой origin, а не самостоятельное доказательство актуального состояния GitHub.

Рабочее дерево уже содержало многочисленные чужие modified/untracked файлы. Ни один из них не исправлялся. Часть наиболее важных ограничений медиа и handoff находится именно в dirty-версии инструкций; совпадение HEAD и origin не означает чистоту инструкций.

**Verdict:** PASS для ограниченного архитектурного исследования и инвентаризации. **HOLD для массовой установки taste-skills и заявления о готовых Figma/Canva/Remotion-интеграциях.** Найденные разрывы не устранены этим аудитом; владельцы будущих исправлений предложены ниже и требуют назначения координатором.

## 2. Покрытие: полностью прочитанные файлы

`.codex/CODEX.md` прочитан полностью, строки 1–998. После него прочитаны ровно 15 релевантных файлов:

1. `README.md` — структура и назначение репозитория.
2. `.codex/workflows/review-loop.md` — acceptance, revision, независимый review.
3. `.codex/config.toml` — роли, concurrency/depth, MCP и локальный plugin.
4. `.codex/agents/design/design-department.md` — маршрутизация дизайн-работ.
5. `.codex/agents/design/design-reviewer.md` — визуальный контроль.
6. `.codex/agents/design/taste-curator.md` — референсы, семейства, descriptor и approvals.
7. `.codex/agents/design/motion-curator.md` — UI-motion и wrapper.
8. `.codex/agents/design/component-curator.md` — 21st.dev, токены, лицензии.
9. `.codex/agents/design/media-generator.md` — native images, KIE/Nullume, audio, gates.
10. `.codex/agents/design/brand-guard.md` — ассеты, бренд и handoff.
11. `docs/core/design-principles.md` — anti-references, dials, MASTER.
12. `docs/core/typography-pairs.md` — пары, кириллица и подключение.
13. `docs/core/motion.md` — UI-motion, easing, accessibility.
14. `.codex/skills/design-system/SKILL.md` — генерация MASTER/page overrides.
15. `docs/core/motion-engine.md` — anime.js и границы движка.

На лимите исследование содержания остановлено. Дополнительно выполнена **механическая инвентаризация имён/путей** агентов, skills, commands, workflows и существования TOML payloads. Это не семантическое чтение всех этих файлов. Claude-роли инвентаризированы по именам файлов, а не по полному содержанию или frontmatter; идентичность инструкций Claude и Codex не подтверждается.

Полные TOML payloads зарегистрированных ролей, lifecycle, design-lint, screenshots implementation, Nullume implementation, проектные MASTER/brand, policies источников и `media-reference-handoff.md` в эти 15 файлов не вошли. Ссылки на них ниже обозначают зависимости из прочитанных инструкций, а не проверенный код. Live MCP/auth/сервисы, пользовательские или глобальные skills не исследованы. Отдельный внешний пакет taste-skills и его точная версия не предоставлены — его конкретные команды и side effects не известны.

## 3. Программная инвентаризация

Подсчёт выполнен Python 3.14: рекурсивный `Path.rglob('*.md')` в каталогах агентов, исключая `README.md`; Codex-регистрация — TOML-разбор `.codex/config.toml`, только словари `[agents.<role>]` с `config_file`. Поля `enabled`, `max_depth`, `max_concurrent_threads_per_session` не считались ролями. Payloads считались отдельно по `.codex/agents/*.toml`.

| Объект | Claude | Codex |
|---|---:|---:|
| Markdown-файлы ролей без README | 45 | 46 |
| Зарегистрированные config_file роли | Не проверялось отдельным Claude runtime | 46 |
| TOML payloads | Неприменимо к этому подсчёту | 46 |
| `skills/**/SKILL.md` | 7 | 22 |
| `commands/**/*.md` | 15 | 15 |
| `workflows/**/*.md` | 6 | 8 |

У всех 46 зарегистрированных Codex-ролей `config_file` существует; множество имён Markdown совпадает с множеством зарегистрированных ролей. Это структурная целостность, **не** проверка смыслового sync Markdown ↔ TOML и не доказательство фактического spawn. Единственное дополнительное имя Codex относительно Claude — `codex-docs`. В origin config также 46 зарегистрированных ролей.

### Все имеющиеся роли

Следующие 45 имён присутствуют в обоих деревьях `.claude/agents/` и `.codex/agents/` с указанным относительным департаментом:

| Каталог | Роли |
|---|---|
| `core/` | `architect`, `coder`, `debugger`, `orchestrator`, `planner`, `researcher` |
| `design/` | `brand-guard`, `component-curator`, `design-department`, `design-reviewer`, `icon-curator`, `media-generator`, `motion-curator`, `taste-curator` |
| `legal/` | `rkn-compliance` |
| `marketing/` | `marketing-agent`, `seo-department`, `seo-specialist` |
| `meta/` | `agent-auditor`, `agent-evaluator`, `archivarius`, `challenger`, `strategist` |
| `ops/` | `anthropic-docs`, `automator`, `devops`, `documenter` |
| `quality/` | `performance-optimizer`, `qa-engineer`, `refactor-cleaner`, `silent-failure-hunter` |
| `review/` | `code-reviewer`, `database-reviewer`, `migration-guard`, `react-reviewer`, `typescript-reviewer` |
| `security/` | `security-api-surface`, `security-auth-access`, `security-business-logic`, `security-department`, `security-dependency-audit`, `security-incident-response`, `security-infra-cloud`, `security-observability`, `security-secrets-scanner` |

Дополнительно: `.codex/agents/codex-docs.md`; соответствующий payload `.codex/agents/codex-docs.toml`.

### Skills, команды и workflows

Claude skills: `api-first`, `ecommerce`, `landing`, `multi-plan`, `nullume`, `react-native`, `saas-architecture`.

Codex skills: эти же семь плюс перенесённые 15 команд: `archive`, `audit-design`, `bugfix`, `council`, `deploy`, `design-system`, `feature`, `polish`, `preflight`, `review`, `rkn`, `secure`, `security-profile`, `selftest`, `summary`. Эти же 15 имён есть в обоих каталогах `commands/`.

Общие workflows: `automation.md`, `bug-fix.md`, `deploy.md`, `hooks.md`, `new-feature.md`, `new-saas.md`. Дополнительные Codex workflows: `hermes.md`, `review-loop.md`.

В проектном Codex config зарегистрированы только MCP `21st`, `icon-library`, `nullume` — `.codex/config.toml:215–230`. Все три помечены `required = false`; регистрация не означает доступность. Имена `figma`, `canva`, `remotion` отсутствуют среди серверов как working-tree config, так и origin config. Поиск подстрок `figma`, `canva`, `remotion`, `taste-skill` в путях tracked + untracked non-ignored файлов через `git ls-files --cached --others --exclude-standard` вернул пустой список. Это ограниченное свидетельство отсутствия явно названных локальных артефактов, не доказательство отсутствия упоминаний в содержимом, скрытых глобальных интеграций или npm-зависимостей.

## 4. Как система работает сейчас

### 4.1 Вход и маршрутизация

`.codex/config.toml:1–7` → `.codex/CODEX.md` → зарегистрированная роль с `config_file`. В конфигурации шесть concurrent threads и глубина три; `.codex/CODEX.md:815–820` требует проверить поддержку клиентом, не считать конфиг выполненным запуском.

Одиночный UI-компонент идёт в `design-reviewer`; комплексный аудит — в `design-department` (`.codex/CODEX.md:356–364`). Отдел распределяет отдельные зоны между visual, React accessibility, performance и при необходимости SEO; production-curators не запускаются автоматически для профилактического аудита (`.codex/agents/design/design-department.md:77–115`).

### 4.2 Источник визуальных решений

`brand.md` + core principles + domain profile → dials → MASTER → при необходимости `design-system/pages/<slug>.md` → код. Приоритет page overrides и запрет молча перезаписывать существующий MASTER заданы в `.codex/skills/design-system/SKILL.md:61–71`. Компонент из каталога подстраивается под MASTER, а не наоборот (`.codex/agents/design/component-curator.md:50–59,72–93`).

`design-system` выдаёт спецификацию, не приложение: реализация отдельно через coder (`.codex/skills/design-system/SKILL.md:78–84`). Дизайн-токены уже имеют хозяина; внешний taste skill не должен становиться параллельным источником истины.

### 4.3 Проверки и приёмка

Инструкции требуют сначала design-lint, затем человеческоподобное визуальное суждение по снимкам (`.codex/agents/design/design-reviewer.md:39–61,79–102`). Общий цикл привязывает доказательства к revision, требует владельца каждой finding, исправления и повторное независимое review (`.codex/workflows/review-loop.md:22–48,75–80`).

Действительное выполнение hook/lint/browser этим аудитом не проверялось. В частности, наличие screenshot script не доказывает, что доступен Chromium, и статический снимок не доказывает корректность движения.

### 4.4 Референсы и производство

`taste-curator` → manifest и разрешённые оригиналы → `media-generator` → `brand-guard` по ассету + `design-reviewer` в UI-контексте (`.codex/agents/design/design-department.md:56–75`). У taste-curator предусмотрены импорт/поиск/кластеризация/descriptor и статус pending до owner approval (`.codex/agents/design/taste-curator.md:79–85,118–159,243–275`).

Проверка прав предшествует vision/upload; research-only не превращается в разрешение на генерацию (`.codex/agents/design/taste-curator.md:64–76`). Media-generator различает native Codex images, KIE/Nullume video и проверяемый audio backend (`.codex/agents/design/media-generator.md:35–45,85–114`). Это уже цепочка медиапроизводства, но не Canva-editable или Remotion-project pipeline.

### 4.5 Движение

CSS transition по умолчанию; anime.js только через проектный wrapper; Lottie для готовых анимированных иконок (`docs/core/motion-engine.md:10–34`). Motion-curator выбирает и встраивает конкретное движение, проверяет reduced motion и измеряет bundle growth при новом модуле (`.codex/agents/design/motion-curator.md:23–67`). Это **UI-motion**, не детерминированный видеорендер.

## 5. Что различается с origin

Побайтовое сравнение прочитанных файлов через `git show @{upstream}:<path>`:

**Отличаются от origin:** `.codex/CODEX.md`, `.codex/config.toml`, `.codex/agents/design/design-department.md`, `.codex/agents/design/design-reviewer.md`, `.codex/agents/design/taste-curator.md`, `.codex/agents/design/media-generator.md`, `.codex/agents/design/brand-guard.md`.

**Совпадают:** `README.md`, `.codex/workflows/review-loop.md`, `.codex/agents/design/motion-curator.md`, `.codex/agents/design/component-curator.md`, `docs/core/design-principles.md`, `docs/core/typography-pairs.md`, `docs/core/motion.md`, `.codex/skills/design-system/SKILL.md`, `docs/core/motion-engine.md`.

Здесь не делается вывод, что все изменения корректны или принадлежат этой задаче: они чужие и оставлены как есть. Новые дизайн-агенты следует проектировать поверх актуального working tree с согласованным владельцем, а не перегенерировать его из origin. Перед будущим изменением ролей требуется отдельная проверка исполняемых TOML payloads и semantic parity; существование пар файлов недостаточно.

## 6. Findings и владельцы следующих шагов

### A1 · ВАЖНО · Нет проектного adapter contract для Figma

**Доказательство:** `.codex/config.toml:215–230` содержит только три других MCP; `.codex/agents/design/component-curator.md:24–39` ориентирован на 21st.dev; `.codex/skills/design-system/SKILL.md:61–71` сохраняет Markdown MASTER/page overrides, а не синхронизацию с дизайн-файлом. В полном roster нет Figma-специалиста.

**Последствие:** «сделай по Figma» не имеет в исследованной системе контракта идентичности file/node/revision, получения скриншота/ассетов, сопоставления Variables/styles с MASTER и разрешения конфликтов. Нельзя назвать импорт токенов или обратную запись работающей интеграцией.

**Что менять позднее:** ограниченный Figma-read/handoff adapter: file key, node ID, source revision, разрешённые экспортируемые assets, mapping variables→project tokens, перечень intentional deviations. На первом этапе read-only; обратную запись и публикацию включать отдельным scope. При конфликте Figma/MASTER — owner decision, не last-write-wins.

**Предлагаемый владелец:** architect + automator для интеграции; design-department для приоритета design source; design-reviewer для соответствия реализации. Пока назначение не подтверждено координатором.

### A2 · ВАЖНО · Canva не покрывается существующим media-generator

**Доказательство:** `.codex/agents/design/media-generator.md:35–45,85–114,116–132` описывает генерацию файлов, KIE video и audio, но не редактируемый дизайн Canva; `.codex/config.toml:215–230` не регистрирует Canva. Роли `marketing-agent` и `brand-guard` есть в roster, но это не Canva adapter.

**Пробел:** нет подтвержденных account/team permissions, design/template identity, Brand Kit mapping, создания/дублирования редактируемого макета, export job/readback, версий и разрешения на внешний share. Полученный PNG не равен редактируемому Canva-проекту.

**Что менять позднее:** выделенный export/editable-design handoff, чёткое различение editable URL, snapshot и финального файла; бренд-токены берутся из проекта. Чтение/экспорт пилота отдельно от изменения template/brand kit и публикации. Доступность конкретных Canva API/MCP и тарифов нужно проверить по актуальной документации и авторизации; этот отчёт не предполагает их наличия.

**Предлагаемый владелец:** automator для adapter/readback, marketing-agent для назначения материала, brand-guard для экспортов; публикация — по разрешению владельца.

### A3 · ВАЖНО · Remotion должен быть отдельной production-веткой, не заменой motion-curator

**Доказательство:** `.codex/agents/design/motion-curator.md:20–49,69–75` ограничен интерфейсом и anime.js; `docs/core/motion-engine.md:23–34` различает CSS, engine и Lottie; `.codex/agents/design/media-generator.md:102–114` направляет видео в KIE/Nullume. В roster нет Remotion-роли.

**Пробел:** нет контракта composition ID, fps, durationInFrames, dimensions, asset manifest, audio policy, font readiness, deterministic frame sampling, render preset и проверенного артефакта. Это не доказательство отсутствия Remotion dependencies во всех проектах: package manifests вне лимита не читались.

**Что менять позднее:** отдельный Remotion producer/adapter для video-as-code; UI wrapper остаётся у motion-curator. До установки проверить совместимость конкретной версии и текущие условия лицензии/использования. Ввести preview stills/short render → owner acceptance → final render → probe/full decode/visual timeline → brand-guard → отдельное разрешение publication. Для silent-требования проверять отсутствие audio stream, не только mute в браузере.

**Предлагаемый владелец:** architect + coder для composition/runtime, qa-engineer для media acceptance, brand-guard для результата; связь с общим media-generator координирует design-department.

### A4 · ВАЖНО · Снимок объявлен проверкой движения, но не проверяет время

**Доказательство:** `.codex/agents/design/motion-curator.md:61–67` предлагает screenshot и reduced-motion check; `docs/core/motion-engine.md:77–81` говорит ревьюить моторику «по снимку». При этом `docs/core/motion.md:133–134,145–166` требует прерываемость, остановку вне viewport/вкладки и хореографию.

**Последствие:** скриншот не подтверждает easing, timing, interruption, повтор/cleanup и отсутствие ненужного autoplay. Это доказанный разрыв между текстом критериев и описанным методом проверки, а не найденный runtime-баг проекта.

**Что менять позднее:** для движения обязательны запись/реальное проигрывание, сценарий interruption, reduced-motion behavior, loop/visibility/unmount tests; для Remotion — покадровые и временные проверки. Статические снимки сохранить для layout/brand.

**Предлагаемый владелец:** motion-curator + qa-engineer; независимое visual review — design-reviewer.

### A5 · КАЧЕСТВО · В типографике есть неоднозначные правила для внешних вкусовых presets

**Доказательство:** `docs/core/design-principles.md:57–61` запрещает Inter как главный дефолтный бренд-шрифт; `docs/core/typography-pairs.md:29–30` одновременно рекомендует его как body в осмысленной паре. Это не прямое противоречие, пока различается «дефолт» и утверждённый выбор. Но `.codex/agents/design/taste-curator.md:211–214` содержит descriptor-пример с системным body `Segoe UI, -apple-system`, тогда как сам curator требует исключать системный бренд-шрифт (`:144–153`).

**Последствие:** массовый импорт presets может либо случайно переписать бренд системным шрифтом, либо отвергать уже осознанно выбранный Inter. Пример descriptor нельзя без проверки превращать в MASTER. Кириллица требует проверки фактических font files, а не только обещания каталога.

**Что менять позднее:** явные font roles, approved exception и glyph/subset evidence; отделить дескриптор наблюдаемого референса от production tokens. Не менять пары или шрифты текущих проектов этим аудитом.

**Предлагаемый владелец:** design-department/taste-curator; кодовое применение — coder, проверка реального рендера — design-reviewer.

### A6 · КАЧЕСТВО · Runtime-следы в маршрутизации повышают риск установки не туда

**Доказательство:** `.codex/config.toml:81–83` в description Codex `agent-auditor` ссылается на `.claude/*` и `CLAUDE.md`; `docs/core/motion-engine.md:13,79–80` также использует Claude-путь screenshot. Базовый адаптер `.codex/CODEX.md:6–7,39–42` требует оставлять Claude нетронутым и использовать реальный текущий runtime.

**Последствие:** название модели или «совместимый skill» может ошибочно привести установщик в `.claude/` либо к вызову чужого инструмента. Верхний адаптер смягчает риск, но не делает такие маршруты желательными.

**Что менять позднее:** отдельная Codex/Hermes capability map и явный install target. Не менять Claude для исправления Codex. После изменений проверить Markdown, registered payload и реальный запуск отдельно.

**Предлагаемый владелец:** agent-auditor + codex-docs; Hermes adapter — координатор текущего runtime.

## 7. Конфликты массовой установки taste-skills

Точный пакет/репозиторий/commit не указан, поэтому ниже — **проверенные точки столкновения Friday и условия допуска**, а не утверждения о содержимом неизвестного пакета.

| Потенциальный импорт | Уже действующее правило Friday | Условие безопасной адаптации |
|---|---|---|
| Универсальный «сделай красиво», редизайн всех экранов | MASTER/page overrides и запрет overwrite — `design-system/SKILL.md:61–71` | Только scoped draft; не менять утверждённые tokens без owner decision |
| Новые `/design-system`, `/polish`, `/audit-design`, `/preflight` | Уже есть одноимённые commands и Codex skills | Namespace и один authoritative entrypoint; не полагаться на неизвестный порядок разрешения коллизий |
| Ещё один curator/reviewer/generator | Восемь design-ролей, явные границы `design-department.md:77–115` | Добавлять capability в существующий маршрут либо узкий adapter; не запускать дублирующие аудиторы автоматически |
| Preset fonts/colors/radii/layout | `design-principles.md:21–45,57–84,106–116`; MASTER источник истины | Сначала mapping на бренд, кириллицу и доступность, затем согласование |
| Framer/GSAP/прямой anime.js и autoplay delight | `motion-curator.md:32–49`; `motion.md:12–24,87–103` | Для UI сохранять wrapper/frequency gate/reduced motion; новый движок — отдельное архитектурное решение |
| Референсы из сети, upload в модель | `taste-curator.md:43–45,64–76,277–280` | Provenance и AI-input permission до vision/upload; browser search не разрешает cookie export/import |
| Auto-generate/auto-publish | `CODEX.md:18–29,78–84`; `media-generator.md:75–83,116–136` | Пилот, budget, output/scale approvals и запрет publication не отменяются skill |
| `npm install`, hooks, scripts, MCP config | `CODEX.md:48–57,61–66` | Отдельный обзор install diff/скриптов/прав; не выполнять код неизвестного skill ради чтения |
| Собственная оркестрация всех экспертов сразу | `config.toml:4–7`; `review-loop.md:34–42` | Очередь волн в доступных слотах, один writer на файл, реальное independent review |
| Обещание native Codex generation из Hermes | `CODEX.md:35–42,53–55`; `media-generator.md:19–22,85–100` | Проверить установленный инструмент, route и evidence; model provider не равен runtime |

**Практический допуск:** сначала получить точный source/commit и перечень skills; прочитать их инструкции и исполняемые scripts без запуска; составить матрицу existing role/command → proposed capability; выбрать один полезный pilot в отдельном namespace. Проверить preview, стабильность tokens и отсутствие внешних writes. Только после independent review решать о следующем skill. Никакой массовой синхронизации в Claude.

## 8. Приёмочные сценарии для будущих adapters — не выполнены этим аудитом

### Figma

- **Happy:** есть разрешённый file/node/revision и MASTER → read/export handoff → screenshot/assets и token mapping с зафиксированными deviations → реализация в локальном preview → visual comparison desktop/mobile. Нужны проверки source identity, отсутствия непрошенного write, assets provenance и token parity.
- **Error:** нет доступа, удалён node или Figma tokens расходятся с утверждённым MASTER → точный blocker/owner decision; не сочинять макет и не перезаписывать токены. Нужны тесты stale revision и запрета write-back.
- **Где сейчас:** общий spec path уже есть в `design-system/SKILL.md:61–82`, визуальная проверка — `design-reviewer.md:39–75`; adapter отсутствует в проверенной проектной регистрации.

### Canva

- **Happy:** разрешены account/team/template и экспорт конкретного черновика → создаётся/выбирается editable design в разрешённом scope → export/readback exact design/revision → локальный файл → brand-guard → owner acceptance. Проверять отдельно editable deliverable и конечный export.
- **Error:** отсутствуют права, export job fails, неясная лицензия asset либо не тот team/brand kit → остановка, сохранение доказательств, без share/publish и без тихой подмены другим генератором.
- **Где сейчас:** бренд-проверка ассета описана в `brand-guard.md:50–85`; Canva job/permissions/readback не описаны в исследованных entrypoints.

### Remotion

- **Happy:** approved brief/assets и параметры композиции → детерминированный preview заданных кадров → owner acceptance → финальный render → probe/decode/timeline → brand-guard. Проверять fps, frame count, duration, размеры, fonts, alpha/audio policy, hashes и output path вне public до approval.
- **Error:** missing asset/font, render error, неверный fps/audio, rejected preview → fail/hold; не считать существующий MP4 автоматически принятой revision, не изменять production.
- **Где сейчас:** UI-motion спецификация есть в `motion.md`, производственный KIE route — `media-generator.md:102–114`; Remotion composition/render contract в прочитанных путях не представлен.

## 9. Рекомендуемый порядок внедрения

1. **Сначала ownership и совместимость:** выбрать активный runtime, проверить dirty baseline и исполняемые payloads; отделить незакоммиченные правила от origin. Не «чинить» чужие файлы попутно.
2. **Затем один read-only adapter pilot:** Figma handoff либо Canva export — по фактической ближайшей задаче и доступам владельца. Не устанавливать весь набор вкуса ради одной функции.
3. **Отдельно Remotion spike:** только после выбора реальной video-as-code задачи, с проверкой зависимостей/условий и тестовым render. Не переносить ограничение UI `transform/opacity` механически на offline cinema; принять отдельный production contract.
4. **После evidence и owner acceptance:** точечная адаптация нужных skills, regression и независимое review текущей revision. Publication и paid operations остаются отдельными gates.

Это рекомендации к последующим разрешённым работам, не выполненная установка и не разрешение на неё.

## 10. Выполненные проверки и ограничения

- Полное чтение `.codex/CODEX.md` и 15 перечисленных файлов; содержимое крупных батчей получено из сохранённого полного tool output, пропущенные sections дочитаны.
- `git status --short`, `git rev-parse HEAD`, текущая ветка, upstream и его SHA.
- Программный подсчёт roles/skills/commands/workflows; проверка существования всех registered payload paths и отсутствия незарегистрированных Markdown-имён.
- Read-only сравнение каждого прочитанного файла с локальной origin-ссылкой, подсчёт origin registered roles и MCP names.
- Поиск имён интеграций только по путям tracked/untracked non-ignored files; пустой результат не расширен до заявления об отсутствии интеграций во всей машине.
- Проверено, что целевой `repo-audit.md` до записи не существовал.

**Возникшая проблема среды:** системный `python3` оказался Python 3.9.6, без `tomllib`; первая попытка инвентаризации завершилась `ModuleNotFoundError`. Ничего не устанавливалось. Повтор тем же read-only алгоритмом через уже доступный `python3.14` успешно дал приведённые количества.

**Не проверено:** запуск реальных Codex/Claude subagents, hook activation, глобальные plugins/skills/MCP, Figma/Canva auth и API, npm dependency manifests, renderer Remotion, текущие лицензии/цены, runtime-поведение UI и независимое ревью самого отчёта. Реальные дефекты этих систем не выдумывались. Следующее независимое review отчёта и назначение owners остаются координатору.
