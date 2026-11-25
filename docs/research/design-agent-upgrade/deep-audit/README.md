# Impeccable → Kowalski → Taste: результат сравнительного статического аудита

Дата исследования: 2026-11-25. Владелец: Гермес. Координатор: Джарвис.

**Основной документ — [COMPARISON.md](COMPARISON.md): содержимое upstream → реальные аналоги Friday → только полезные дельты.** Это результат исследования и план, не установка, не новая исполняемая команда агентов и не runtime/visual/security PASS.

## Короткий ответ

Вы были правы: основные идеи Impeccable и Kowalski уже перенесены во Friday. Это подтверждено не только сходством текста, но и Git provenance. Переустанавливать всё и создавать дублирующие роли не нужно. Самая содержательная новая область — **положительные библиотеки Taste**: типографические направления, композиции с условиями применения, copy/voice, diagrams и управляемые визуальные сцены. Их следует адаптировать выборочно в текущую команду, не подключать все house rules/runtime/hooks глобально.

Сначала стоит исправить собственные расхождения между инструкциями и реализацией, затем дополнить контент, и лишь после этого сравнить реальный результат на одном брифе. Больше запретов не равно больше вкуса.

## 1. Impeccable

Подробно: [контент и playbooks](impeccable-content.md), [runtime](impeccable-runtime.md), `impeccable-close-*.md`, `closure-*.md`, [полный CLI contract A](support-cli-a.md) и [B](support-cli-b.md), [support](support-rest.md).

- **Уже есть:** anti-slop/anti-references, polish/audit/critique аналоги, базовая типографика, brand constraints и проверка responsive/accessibility.
- **Что добавить:** различение Read/Explore/Operate/Decide на уровне поверхности, более предметные playbooks и outputs, структурированный finding с rule/severity/evidence/scope, сохранение существующей функциональности, waivers с областью и причиной, привязка evidence к текущей revision.
- **Что исправить у себя:** scoped запрет дефолтного бренд-шрифта против blanket Inter/Arial regex. Inter-body уже разрешён таблицей пар. Также пересмотреть hard-fails hero>2строк/nav>80px/list>5: это наши opinionated rules, а не только проблема upstream.
- **Что не переносить автоматически:** account sync, installers/hooks, source injection и subprocess permission bypass. Документы описывают внешнюю отправку DESIGN/report/screenshot и default-on поведение некоторых функций; telemetry-off не означает offline.
- **Реально воспроизведено локально:** существующий Friday `design-lint.mjs` возвращает0 при missing target и при найденном ERROR. Это receipt только этого скрипта, не доказательство поведения всего lifecycle. См. [local-lint-probe.json](local-lint-probe.json).

## 2. Emil Kowalski

Подробно: [kowalski-full.md](kowalski-full.md). Весь snapshot содержит36 файлов; все отмечены full в проверенном ledger. Это чтение навыков и примеров, не запуск каждого внешнего linked demo.

- **Уже есть:** frequency gate, easing/duration, reduced motion, interruptibility и основные interaction-принципы. `motion.md` прямо называет автора.
- **Главная дельта:** перевести доктрину в проверяемое поведение: start/middle/settled, entry/exit, отмена/повторное действие, focus, normal/reduced motion, offscreen/destroy/performance.
- **Конкретный пробел:** `motion-engine.md` обещает `createDraggable`, общий `templates/motion.ts` не предоставляет его. Это несовпадение общего контракта/шаблона, не утверждение об отсутствии любых drag-wrapper во всех клиентах.
- **Конфликт для согласования:** global decorative bounce ban, разрешённый inertial spring и Taste no-overshoot preset — разные scopes, которые нельзя склеить одной regex-проверкой.
- **Не нужно:** второй motion engine только ради популярности пакета. Примеры переводятся в утверждённый стек проекта.

## 3. Taste Skill

Подробно: [content/runtime](taste-content-runtime.md), [assets и реализации](taste-assets.md), `taste-close-*.md`, [библиотеки данных](data-families-final.md).

- **Что действительно полезно:**64 palette records,39 type records,11 hero families,27 diagram presets, copy/voice editing, условия применимости и требования к исходным материалам, metadata cost/trigger/stop/fallback для motion/scenes.
- **Почему это не очередной шаблон:** положительная библиотека объясняет, какое решение подходит конкретному бизнесу, контенту и набору assets. Она должна расширять диапазон решений, а не заставлять каждый сайт выбирать один и тот же hero.
- **Что уже есть:** Friday typography-pairs/design-profiles, taste-curator и Nullume; сами слова typography/layout/curation не новая возможность.
- **Что переносить:** компактные recipes с applicability/reject-if, несколько обоснованных направлений, редактуру копирайта, семантические diagrams и scene contracts. Факты клиента/brand/MASTER остаются выше библиотеки.
- **Что оставить opt-in:** обязательные100svh hero, случайный dealer, fixed heights, hover lifts, ограничения палитр/типов страниц, глобальные checkers/Stop hooks. Gallery-only/retired entries нельзя механически отправлять в production.
- **Не путать demo с фактами:** чужие testimonials, цифры, имена, контакты и generic product objects не становятся реальными данными клиента. CC BY-SA/Unsplash/brand marks требуют отдельных rights/attribution решений перед использованием.

## Рекомендуемые следующие изменения — ещё не выполнены

| Порядок | Дельта | Где | Критерий приёмки |
|---|---|---|---|
|1|Развести missing/invalid/findings/clean и стабильный structured output|design-lint + callers|Missing target и known error не дают ложный clean; caller проверяет semantic result, а не только exit0|
|2|Уточнить scope font/hero/nav/list/bounce правил|core docs + invoked SKILL/commands + actual TOML payloads|Допустимый Inter-body и содержательный RU hero проходят; реальное clipping/a11y нарушение остаётся блокером; scoped exceptions проверены|
|3|Устранить draggable contract/template gap|motion-engine + shared wrapper|Пример из документа реально выполняется; interrupt/destroy/keyboard/reduced motion проверены, нет утечки слушателей|
|4|Адаптировать Taste positive libraries и copy/voice|taste-curator + существующая команда|Один реальный обезличенный бриф → два разных обоснованных направления, без выдуманных claims и смены approved brand|
|5|Ввести surface-aware design plan|существующие design/system/review роли|Read и Operate получают разные решения с rationale; общие brand/a11y требования не ослаблены|
|6|Добавить temporal evidence и freshness|motion-curator + QA|Запись реального сценария normal/reduced, interruption/repeat/offscreen/destroy; inputs/revision привязаны к текущему артефакту|
|7|После принятого пилота — tool adapters|Figma/Canva/Remotion отдельно|Actual tool call → exact-target read-back либо настоящий MP4 → visual acceptance; не prompt-файл вместо результата|

Структура: Джарвис/design-department → существующие taste/design/motion исполнители → независимый review/brand/QA. Не делать агента под каждый скачанный skill. Новые Figma/Canva/Remotion роли оправданы только недостающей исполняемой поверхностью и реальным pilot; Herdr — отдельная среда исполнения/наблюдения, не security sandbox и не замена durable orchestration.

## Проверяемые границы покрытия

Пины:

- `pbakaus/impeccable` — `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`.
- `emilkowalski/skills` — `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c`.
- `Leonxlnx/taste-skill` — `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`.
- Friday baseline — `388ec708f39583172d7f36110f6424cc175b5512`. [Проверка drift](friday-baseline-drift.json) фиксировала отсутствие изменений среди271 начальных comparator paths; это не сертификат неизменности всего рабочего дерева.

[coverage-merged.json](coverage-merged.json) — пересчитанный union evidence, не сумма заявлений исследователей. Проверены hashes source snapshot, ledger paths и объединение точных ranges. CLI contract закрыт union `[1,1797]` + `[1798,3594]`, а не фиктивным повышением одного partial в full.

| Snapshot | Всего paths | Full* | Byte-alias к full | Структурно проверенные данные/fixtures/vendor | Alias к таким данным | Binary metadata, без общего visual review |
|---|---:|---:|---:|---:|---:|---:|
|Impeccable|5034|1646|823|2471|46|48|
|Kowalski|36|36|0|0|0|0|
|Taste|1664|531|0|970|0|163|

\* Full включает canonical semantic reading и проверенные provider transformations, а не ручное независимое чтение каждой generated копии. Methods сохранены per-file. Byte identity не означает runtime equivalence. `classified-reviewed` не равно semantic full; копия classified не наследует full.

**Важно: это не «каждая строка каждого fixture вручную и каждая картинка просмотрены».** Все папки и пути учтены, навыки/references и назначенные authored implementations разобраны; тестовые корпуса/packed data проверены отдельно на структуру, provenance и consumers. Сохранилось0 partial и0 unclassified/unread paths в итоговой классификации, но это не повышает структурную проверку до ручного чтения.

Residual Impeccable corpus: собственный checker структурно разобрал2468 paths, **включая пять authored executable test helpers, а не только fixture/reference data**. В корпусе1621JSON и78JSONL/16058vector rows;534markup traversal и235прочих text scans. Parse issues0; это не запуск тестов, не CSS/JS/framework compilation и не доказательство корректности ожидаемых ответов. Frozen goldens намеренно содержат error exits; специально broken fixtures не объявлялись production bugs. Методы — [corpus-fixtures-coverage.json](corpus-fixtures-coverage.json).

**Отдельное substantive closure R2-B1:** `tests/live-e2e/agents/llm-agent.mjs` и `tests/oracle/vectors/{hooks-impl.mjs,hooks.mjs,record-calls.mjs,recorder.mjs}` — authored test infrastructure. После замечания независимого ревью координатор полностью прочитал эти5файлов/1933строки и разобрал provider/SDK, writes, retries, validators, loader transforms, recorder serialization/dedupe и destructive output reset. Они учитываются как full **по этому более позднему чтению**, не по structural scan. См. [support-authored-test.md](support-authored-test.md) и [точный ledger](support-authored-test-coverage.json). Scanner теперь маркирует их отдельным artifact_kind и использует frozen assignment, чтобы повторный запуск не терял данные после semantic merge. Это не production gap и не runtime PASS.

Vendored minified modernScreenshot проверен по bytes/wrapper/API/consumer, не полностью повторно семантически прочитан и не rebuild/security PASS; точная package/license provenance остаётся открытым вопросом перед использованием.

Taste photos/icons/SVG/геоданные проверены по schema/fields/paths/XML/ranges, не все визуально и не с независимым подтверждением каждой лицензии. Font-metrics sample Impeccable латинский: это не доказательство RU coverage. Hash проверка988 data-ledger rows не доказывает личное ручное перечитывание всех этих rows координатором.

## Review и история документов

- [independent-review.md](independent-review.md) — независимое ревью **R1**, verdict REQUEST_CHANGES; это исторический документ, не review R2.
- R2 учитывает его B1/B2/B3: наши arbitrary hard-fails; scoped typography vs regex; тройной bounce конфликт. Также уточнены MD/payload/script/runtime уровни и локальный Perfect Skin hover scope.
- [independent-review-r2.md](independent-review-r2.md) подтвердил закрытие прежних B1/B2/B3, hashes/range union/totals и содержательное сравнение, но вернул disclosure blocker для пяти authored test helpers. Исправления — отдельный substantive closure и явная классификация выше. Сам исторический review не переписывался в PASS.
- Ранние отчёты честно оставлены с INCOMPLETE/partial: их gaps закрываются последующими `*-close-*`, `closure-*`, `support-*` и merge, не переписыванием истории.
- Старый `support-2.md` — interrupted working note, superseded для своего scope отчётами support-cli-a/b + support-rest; сам по себе не completion evidence.

## Что не сделано

Upstream installers/hooks/imports/tests не запускались; все upstream defects, кроме явно указанного локального lint probe, — static findings/contract risks. Не зарегистрированы новые роли, не изменены клиентские проекты и глобальные configs. Не подключены Figma/Canva, не выполнен Remotion render/Herdr runtime pilot; прежние install approvals истекли без подтверждения. Reddit full threads остаются blocked, snippets не засчитаны чтением. Коммита/push и публикации этого пакета нет; чужие dirty-изменения не включались.

Доступы не мешают закончить сравнение, но не позволяют назвать интеграции рабочими. Подробные rollout gates сохранены в [IMPLEMENTATION.md](../IMPLEMENTATION.md).
