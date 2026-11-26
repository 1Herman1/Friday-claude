# F2 — scope MASTER целевого проекта

Base: `fc673e38cb742a9d4ed2767186d594850406f9c8`.

## Изменение

Для явно распознанных `projects/<target>/...` и `tools/<target>/...` resolver использует только собственный `docs/projects/<target>/design-system/MASTER.md`. Если MASTER отсутствует, возвращает null и структурированный `master-scope` WARNING с target path и явным сообщением, что project-specific сверка пропущена. Чужой active/sole MASTER не подставляется. Для generic paths прежние active/sole fallback сохранены. Глобальные RULES продолжают работать; отсутствие MASTER не одобряет Inter и не превращает ERROR в PASS.

Это не автоматическая сертификация brand/body/display/a11y. `summary.warnings` версии JSON v1 считает rule findings, а не отдельный массив diagnostics; диагностическое предупреждение доступно в JSON и human stderr. Exit0 здесь означает отсутствие ERROR/operational error при явно объявленной пропущенной MASTER-сверке.

## TDD и исполнители

Первую failing regression добавил `sa-0-6590560d`; production ещё не менял. Его общий guard остановился на изменённом FOLLOWUP-PLAN.md. Координатор проверил точный SHA: это собственное уже разрешённое обновление статуса опубликованного F1, не неизвестная правка source. Пользовательского согласия не недоставало. Кодовые guards и preexisting содержимое сохранены; родитель продолжил минимальную правку, расширил regression cases и проверил весь exact candidate.

- Parent повторил настоящий первый RED: target без MASTER получал offbrand-hex/offbrand-font чужого active проекта.
- Минимальная правка resolver → первый regression GREEN.
- Финальная матрица также исполнена с **оригинальным HEAD resolver** в изолированном export: RED, воспроизводя непокрытые раньше branches; затем с исправлением — GREEN.
- Добавлены7test methods: основной active-case; projects/tools×active/sole/none/invalid-active; explicit ACTIVE_PROJECT; собственный MASTER; generic fallback; global forbidden-font; независимость результата от изменения чужого MASTER.
- Старые test assertions не удалялись. RULES и MASTER_RULES побайтно сохранены. SHA256: RULES `5c323dddd22144ecc3028a7a211b10d773ee1eff5398b740dc871392fc303543`; MASTER_RULES `f6f866b30da533778497624456677ccb92934bfb56f11e2bdda5dee9193b5da3`.

## Свежий parent regression

|Проверка|Результат|
|---|---|
|Working Node|64PASS,0fail/skip|
|Clean exact-HEAD+owned overlay Node|64PASS,0fail/skip|
|Working Python|86PASS|
|Clean Python|79PASS|
|Clean selftest|exit0, прежний feature.md freshness WARNING|
|Clean role sync|Drift:none|

64Node =49lint +14library +1dependency-isolation. Actual command outputs, positive/negative probes и scope note: `/Users/germanbryzgalov/.hermes/cache/scratch/design-followup-_9uk291c/f2/`. Initial worker snapshot/RED: `/Users/germanbryzgalov/.hermes/cache/scratch/f2-master-scope-4qk83a3n/`.

Implementation scope: только design-lint.mjs и test-design-lint.mjs; docs — этот receipt и coordinator plan. Ни config/roles, ни client code, ни foreign parity baseline, ни feature.md source/manifest в F2 не изменялись. Providers/installers/browser не запускались. Следующие gates: independent code/TypeScript/secrets review, exact own-only publication и remote read-back. Source freshness/CI остаются следующими последовательными этапами.
