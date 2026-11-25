# H&B Design Agent Upgrade — этапы и контракт внедрения

Дата исследования: 2026-11-25. Владелец: Гермес. Координатор: Джарвис.

## Границы и текущее состояние

Запрос владельца: аудит своей разработки/агентов, GitHub+Reddit research design/motion skills, Figma/Canva MCP, Remotion, Herdr, новая структура и последовательное внедрение.

Исходно были разрешены исследование и подготовка; последующее прямое поручение владельца разрешило delta-only локальное внедрение и публикацию own changes в GitHub. Это выполнено по rollout/PLAN.md и rollout/STATUS.md. Нет разрешения на платную генерацию/подписки, клиентский production deploy/медиа, замену утверждённого дизайна или перенос секретов. Чужие незавершённые изменения не принадлежат этому внедрению.

**Текущее состояние2026-11-26:** локальное ядро принято/проверено/опубликовано пятью implementation commits; полные64/39/11/27 библиотеки доступны через CODEX→command/SKILL/taste MD+TOML→CLI. Surface methodology подключена к существующим потребителям, createDraggable прошёл настоящий Chromium/strict-TS/SSR pilot. Существующий roster сохранён; новые Figma/Canva/Remotion роли не зарегистрированы без пилотов. Upstream runtime/hooks не устанавливались, MCP не подключены, Remotion render и Herdr runtime не запускались. Наличие Markdown или успешный push не доказывают live IDE activation, внешнюю автоматизацию, owner visual acceptance или remote CI.

Проверено: GitHub `gh auth status` успешен для 1Herman1; свежий fetch дал HEAD...origin/claude/greeting-nnz368 `0 0`. Исходное рабочее дерево сильно изменено другими задачами. В нём не выполнялся rebase/reset или массовый commit.

## Реестр результатов и блокеров

| Направление | Факт | Статус |
|---|---|---|
| GitHub источники | Авторские репозитории найдены, metadata/HEAD SHA в source-lock.json | Исследовано; не security audit всех файлов |
| Reddit | Найдены обсуждения; отдельные поисковые extracts доступны, полный web/browser доступ заблокирован | Частичное исследование, не полный scrape |
| Impeccable install | Catalog exact id `official/creative/impeccable`, state not_connected, settled_by deadline | Не установлен |
| Remotion skill install | Catalog id `skills-sh/remotion-dev/skills/remotion-best-practices`, not_connected, deadline | Не установлен |
| Figma MCP install | manage_connections, name figma, mcp true, not_connected, deadline | Не подключён |
| Canva MCP install | manage_connections, name canva, mcp true, not_connected, deadline | Не подключён |
| Hosted Canva | В status существует canva_mcp, connected false; обнаружены SEARCH_DESIGNS/GET_DESIGN_CONTENT schemas | Не является MCP smoke PASS |
| Native toolchain | Node v24.21.0; ffmpeg в PATH; herdr/hc/codex/ffprobe в PATH не найдены | Не утверждает отсутствие установок вне PATH |

Карточки подключения/установки уже закрылись по deadline без подтверждения. Не повторять их и не обходить ручным редактированием конфигов или альтернативной установкой без нового запроса владельца. Для возобновления нужен явный повторный запрос подключить/установить. Это блокирует зависимые интеграционные тесты, но не исследование и контракт архитектуры.

## Целевая структура: роли ≠ скиллы ≠ инструменты ≠ среда

- **Роль** отвечает за определённый результат и имеет границы записи.
- **Skill** — методика, не самостоятельный сотрудник, не новый API и не лицензия.
- **MCP** — канал реальных вызовов; права/OAuth/tool schemas проверяются отдельно.
- **Herdr** — кандидат среды исполнения/наблюдения. Его вклад не заменяет требования к оркестратору, sandbox, review и хранению состояния.

Не делать отдельного агента «на каждый скачанный skill». Сохранять текущий design-department и существующих кураторов. Предлагается добавить только роли для отсутствующих исполняемых поверхностей после аудита:

```text
Джарвис / orchestrator
└─ design-department — brief, routing, acceptance ledger
   ├─ taste-curator — референсы + два направления + rationale
   ├─ design-system / coder — токены, typography, implementation
   ├─ figma-specialist [NEW, не зарегистрирован]
   ├─ canva-specialist [NEW, не зарегистрирован]
   ├─ motion-curator — интерфейсное движение (существующий)
   └─ remotion-director [NEW, не зарегистрирован]
      └─ coder — детерминированные композиции/renderer
Независимая приёмка: design-reviewer + brand-guard + QA/performance по scope
```

`design-system` выше — этап/навык существующей команды, не ложное утверждение о зарегистрированной роли с этим именем.

### figma-specialist: контракт будущей роли

Вход: URL файла и node selection; brand/MASTER; задача/размеры; allowed target draft; права на ассеты.

Порядок: discover actual tools → identity/access check → read context/screenshot/variables/components → план узкого diff → изменение только копии/draft → read-back exact nodes → screenshot review и handoff разработчику.

Выход: file URL, page/frame/node IDs, component/variable mapping, screenshots, список разрешённых изменений, tool receipts и реальные ограничения. Не считать SVG-import эквивалентом native auto-layout/components. Не переопределять MASTER из Figma без решения владельца.

Figma official docs на дату проверки поддерживают чтение и **native write через use_figma** на remote server; нельзя использовать устаревший тезис «официальный MCP только read-only». Write beta, требует edit access, поддерживаемого клиента, условия seat/plan; изображения загружаются отдельными инструментами, fonts должны быть доступны аккаунту. Наличие этого в документации не доказывает поддержку в нашей сессии.

### canva-specialist: контракт будущей роли

Вход: разрешённый design/folder/brand kit, канал (deck/social/print/video), реальные тексты, формат, право на медиа.

Порядок: discovery → bounded search existing design → read one approved design → duplicate/sandbox where supported → transaction edit → commit transaction → read-back design + export → скачать и просмотреть фактический экспорт.

Выход: design ID/URL, edit receipt, export ID/status, локальный файл и проверка формата. Не обещать pixel-exact сложный frontend из Canva и не выдавать Canva Dev MCP для SDK разработки за инструмент редактора дизайнов. Шаблоны/brand templates искать соответствующим инструментом, не search-designs.

### remotion-director: контракт будущей роли

Вход: message/audience, storyboard, duration/fps/aspect, подтверждённые assets/fonts/audio/rights, delivery constraints.

Выход: scene spec → React composition + props → проверенные stills → actual MP4 → metadata/decode/frame review → owner pilot acceptance. Motion-curator UI не дублирует эту ответственность.

LLM пишет код; Remotion рендерит кадры. Это не диффузионная генерация реального мира. Для реалистичного product footage отдельно использовать согласованный media pipeline; Remotion собирает сцены и монтаж, не превращает front packshot в доказанную 3D геометрию.

## Этапы с критериями приёмки

### 0. Discovery / architecture — исходный исследовательский этап

- Repo audit: сравнить существующие роли/дизайн-правила с upstream; посчитать роли кодом.
- Source registry: canonical URLs, immutable SHAs, лицензии/unknown.
- Для каждого product/tool отличать found/configured/call-success/output-verified.
- Итог: README, repo-audit, design-skills-research, motion-herdr-research, source-lock, этот ledger.

**Gate:** все claims привязаны к источнику; unresolved names и blocked pages отмечены. Полное исследование Reddit не считать выполненным при blocked доступе.

### 1. Delta-only / bounded typography-layout experiment

- После углублённого сравнения использовать `deep-audit/COMPARISON.md` и доказанные historical imports: не переустанавливать уже перенесённую методику. Сначала закрыть локальные несовпадения lint/MD, scopes и motion helper; затем выборочно адаптировать недостающий контент в текущие роли. Исторический план реализован в bounded локальном scope по rollout/STATUS.md; этот документ отдельно сохраняет gates ещё не выполненных клиентских/внешних pilots.
- Impeccable surface/playbooks → существующие design/system/review роли; Kowalski motion → motion-curator; **Taste positive typography/composition/copy/diagram libraries → taste-curator и существующая команда**. House presets, samplers, runtime/hooks остаются отдельным opt-in решением. Не активировать overlapping animate/audit triggers глобально.
- Только если доказана необходимость upstream пакета, после нового разрешения на install фиксировать установленную версию и side effects; catalog-reviewed версия может отличаться от pinned GitHub. Remotion отдельно по своему этапу. Установка не prerequisite адаптации разрешённых методических дельт.
- Один обезличенный реальный brief, две разные композиции, baseline screenshot, одинаковые constraints и модель, сравнение артефактов и реальных logs. Не выдумывать token cost/time saving, если telemetry нет.
- Desktop/mobile, кириллица, long text, keyboard, reduced motion. Дизайнерская оценка владельца обязательна перед распространением.

**Gate:** конкретная content/rule delta в фактически исполняемом payload + реальный результат before/after и проверка regressions. Для опционально установленного пакета дополнительно installed/loaded state. Skill-файл или checklist сами по себе не PASS.

### 2. Figma MCP pilot

- Новый запрос владельца возобновляет install/authorize штатным manage_connections (никаких ручных mcp_servers edits).
- Нужен sandbox Figma file URL, permission/seat, approved scope.
- Проверки: tool discovery; read exact frame; variables/components mapping; screenshot; в draft создать/изменить один frame только при actual write support.
- Повторно прочитать exact target, проверить auto-layout/text/IDs, показать результат. Нет write tool или неподдерживаемый клиент → явный partial read-only result.

**Gate:** реальный read, отдельный реальный write/read-back, владелец видит draft; клиентский production не тронут.

### 3. Canva MCP pilot

- Подключить через штатную карточку после повторного запроса; определить MCP vs hosted route, не подключать два канала без необходимости.
- Безопасный первый smoke: search до одного разрешённого design и read; не обходит отсутствующую авторизацию.
- Draft pilot: одна обложка/три слайда с реальными текстами; transaction lifecycle согласно фактической schema; export PNG/PDF, скачивание/визуальная проверка.

**Gate:** design URL/ID и реально просмотренный export. Не PASS по одной успешной авторизации.

### 4. Remotion pilot

- Отдельная папка вне клиентского public, без создания новой ветки или переключения согласованной рабочей ветки. Проверить текущие Remotion skills и коммерческие условия до production.
- Render pilot: короткий H&B typography/product demo без платной генерации, с локальными разрешёнными assets; сценарий/стиль сначала согласовать, если это определяет направление.
- Считать fps/duration/frame count кодом. Не использовать CSS time/Math.random/Date.now для недетерминированной timeline. Deterministic props/seed.
- Still samples в начале/середине/конце плюс scene boundaries; полный MP4 decode и browser playback; SILENT значит ноль audio streams, не просто muted.
- Проверить mobile vertical safe zones и читаемость кириллицы.

**Gate:** фактический MP4 + metadata + reviewed frames; не один проект с README и не mock output.

### 5. Новые зарегистрированные роли

- После pilots оформить figma-specialist / canva-specialist / remotion-director в выбранном runtime.
- В Codex синхронно readable role + registered TOML/config и repo selftest/drift checks. Для Джарвиса в Hermes определить явный adapter/skill и реальные доступные MCP; выбор openai-codex модели НЕ активирует .codex roster.
- Не менять dirty .codex config/roles без merge-проверки текущей чужой работы; не менять .claude автоматически.
- Прогнать по одной end-to-end задаче на роль, независимое ревью и security secret scan.

**Gate:** зарегистрировано/загружено/исполнено/проверено отражаются отдельно, не «агенты готовы» по наличию prompt-файлов.

### 6. Herdr / более глубокая автоматизация

- Сначала verify актуального CLI и выбор app/core/terminal, сверить поддержку Hermes/Codex, auth, hooks/status semantics, sleep/reconnect.
- Без скрытой установки/открытия окон: владелец явно подтверждает setup. Затем два disposable workspace/worktree, ограниченные tool permissions, no client secrets.
- Pipeline: brief/job ID → skill/role routing → worker in isolated worktree → deterministic tests → independent visual/code review → evidence store → owner gate → deliver; publish отдельно.
- Durable state вне чата: job ID, stage/revision, input/output hashes, attempts, lease/heartbeat, timeout, retry budget, idempotency key, blocker, approvals. Нужен отдельный orchestrator/state store, не только PTY terminal statuses.
- Тесты сбоев: убить worker, перезапустить host, повторить delivery, разорвать MCP OAuth, sleep/reconnect; убедиться в отсутствии двойного экспорта/записи/платной попытки. Не запускать по cron только ради демонстрации.
- Работа 24/7 требует бодрствующего хоста/серверного executor; закрытие окна и сон/выключение Mac — разные события.

**Gate:** воспроизводимый restart/recovery и exact target read-back. Herdr сам по себе не security sandbox и не доказательство автономной студии.

## Что нужно от владельца на блокирующей развилке

1. Явный новый запрос на повторное подключение Figma/Canva и установку выбранных skills (первый approval завершился deadline).
2. Ссылка на отдельный тестовый файл Figma; для Canva — разрешённый test design/folder или разрешение создать draft.
3. Только если гипотеза расшифровки неверна — ссылки на отдельные «Fluency4 AI/Hernesis».

Исследовательская ветка может завершиться без этих доступов, интеграционное внедрение — нет.

## Оценка пользы и расходов

Рекомендация — внедрять, но малыми проверяемыми pilots, не собирать «зоопарк» навыков и терминалов. Первая польза: типографический/UX QA, воспроизводимые design handoffs, ролики/варианты на собственных данных. Коммерческий эффект зависит от принятого качества и времени доработок, не от количества агентов.

Точная стоимость пока unknown: тарифы/seat Figma, Canva quotas, Remotion commercial/hosting и выбранная модель/лимиты подтверждаются до платных действий. Локальный кодовый render не равен бесплатному коммерческому сервису. Не обещать часы/экономию без baseline benchmark.

## Первичные ссылки интеграций

- https://developers.figma.com/docs/figma-mcp-server/
- https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
- https://www.canva.dev/docs/apps/mcp/
- https://hermes-agent.nousresearch.com/docs/llms.txt
- https://www.remotion.dev/docs/agents/skills
