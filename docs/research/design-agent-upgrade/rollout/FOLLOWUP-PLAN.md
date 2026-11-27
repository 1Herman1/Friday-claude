# Design follow-up — последовательный план исполнения

Разрешение владельца: «Запускай все пункты по порядку, дело по порядку, тестируй каждый пункт после редакции и переходи к следующему».

Начало: 2026-11-26. Исходный HEAD `e9e31fd5b80f48729a87823409c966f9c2b36d42` (новый nightly digest после аудируемого `ba9833c5`); branch `claude/greeting-nnz368`. Исходное dirty дерево сохранено; reset/stash/массовая публикация чужих изменений запрещены. Private before snapshots: `/Users/germanbryzgalov/.hermes/cache/scratch/design-followup-_9uk291c/`.

## Порядок и acceptance

| № | Пункт | Критерий завершения | Статус |
|---|---|---|---|
|1|F1 → F2 → source-freshness|Каждый tracer bullet RED→GREEN, working/clean regression, independent review, собственная проверенная публикация и remote read-back|IN_PROGRESS: F1 опубликован `fc673e38cb742a9d4ed2767186d594850406f9c8`; F2 опубликован `0a7af7680f490ad6c738f454810c46fd25caa39d`; source-freshness выполняется|
|2|Design-regression CI|Самодостаточный workflow, настоящий run на exact SHA, успешные design tests; unrelated Perfect Skin jobs не засчитываются|PENDING|
|3|Реальный before/after design pilot|Brief/brand, baseline, две композиции, RU/long text/mobile, фактический визуальный review; owner acceptance отдельно|PENDING|
|4|Native Codex activation|Новая настоящая IDE session, наблюдаемое чтение действующих payloads/роутов, bounded real task; static parity не заменяет проверку|PENDING|
|5|Motion product gates|Keyboard alternative/cancel/a11y, offscreen/hidden-tab, доступные браузеры, регрессии normal/reduced/interruption/destroy; физическое устройство не выдумывать|PENDING|
|6|Figma → Canva|Штатное подключение/авторизация, разрешённый sandbox, actual read/write/read-back/export и визуальный результат|PENDING|
|7|Remotion|Изолированный deterministic render, реальный MP4, полный decode/frames/metadata, visual review/лицензии|PENDING|
|8|Специализированные роли|После настоящих pilots: MD/TOML/config, real loaded/executed результат, role sync/selftest/E2E|PENDING|
|9|Herdr|Поддержка текущего runtime/лицензия, bounded setup, restart/recovery/idempotency/duplicate-delivery evidence; не security sandbox|PENDING|

Каждый logical change: тест до изменения → минимальная реализация → повтор → полный затронутый regression → независимое ревью точного scope/hash → исправления/повтор → publish exact owned tree → GitHub read-back. Только затем следующий logical change. Для F1 допускается узкое принятие существующих четырёх handoff файлов с полным чтением, hash guards и dependency closure; весь foreign parity/media baseline автоматически не присваивается. Первый five-file candidate дал настоящий clean-suite FAIL: adopted test требует отсутствующие native contract routes. Его gate сохранён как BLOCKED, без сброса evidence. Исправление продолжается в `design-followup-01-routing-closure`: добавлены config и пять MD/TOML пар, причём candidate строится из HEAD + минимальные routing/runtime adaptations, не из целых dirty версий. Исходные dirty файлы остаются нетронутыми.

Никаких платных вызовов, доступов, публикации клиентских медиа или изменения утверждённого дизайна без соответствующих gates. Авторизация проводится штатным инструментом, секреты не запрашиваются в чате. Если отсутствует доступ/владелец должен принять визуальный результат/неподдерживаемая IDE, фиксируется конкретный BLOCKED, а не PASS. Не открывать браузерные окна для тестов; использовать headless.
