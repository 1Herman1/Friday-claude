# Follow-up 04 — независимые QA и silent-failure verdicts

## Идентичность и scope

Один фактический reviewer: **Hermes Agent, runtime session `20261127_185336_fb66c8`**. Это независимый адаптированный Hermes-review, не native Codex activation, не исполнитель изменений и не два независимых человека. Обе роли исполнены самостоятельно, без делегирования. Полностью прочитаны реальные `.codex/agents/quality/qa-engineer.md`, `silent-failure-hunter.md` и `.codex/workflows/review-loop.md`.

- Base: `c10a97d7e80d805087889efc448ee3e0aafb5234`.
- Frozen tree: `3e6077d67f1a1e0a2ca98cfcf5199e2b862cc2fb`.
- Map: `~/.hermes/cache/scratch/design-ci-parent-06580sea/stability/review-map.json`.
- Map SHA-256: `97f42b00ed59244f92196309d7fdcd75add4968599a3e2121b3ea82b2f8aa8f7`.
- Исполнение: точный `stability/export`, не грязный общий checkout.

Полностью прочитаны все восемь frozen-файлов: workflow, `test_design_ci.py`, `followup-04-design-ci.md`, `test-motion-template.mjs`, `lib/motion-observation.mjs`, `test-motion-observation.mjs`, `followup-04-motion-observation.md`, `FOLLOWUP-PLAN.md`. Их SHA-256 совпали с map, соответствующими Git blobs frozen tree и рабочими файлами; итоговая повторная проверка: **8/8 без изменений**. Дополнительно проверены Git blob identities всех **1742 включённых tracked-файлов** export. Это ограниченный export: 2802 unrelated tracked blobs в нём отсутствуют; полнота всего монорепозитория не заявляется.

Worker `source-guard-before.json` и `source-guard-after.json` полностью равны. Все **75** перечисленных production/core/pilot hashes независимо совпали и с export, и с общим ROOT. Template SHA-256: `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`; это hash template, не совокупный hash всех fixture-файлов. Fixture и настоящий engine не подменялись.

## QA verdict: REQUEST_CHANGES

**QA-01 — ВАЖНО / блокирует acceptance: обычный integration всё ещё может промахнуться по движущемуся tile.**

- Место: `.codex/scripts/test-motion-template.mjs:99–110`, вызов normal interrupt на строке 153.
- `grab()` получает bbox, наводит мышь на `box.x + 23`, затем делает два отдельных browser evaluate перед `mouse.down()`. Повторное наведение есть только в ветке `latency && !before.inertiaPaused`; штатный CI запускает без latency.
- Первый независимый запуск **точной штатной команды** `node .codex/scripts/test-motion-template.mjs --integration` завершился **exit 1**, `grab requires both event bounds`.
- Receipt: `~/.hermes/cache/scratch/motion-run-TB0X76/receipt.json`, SHA-256 `f45ae27bc6d74f654cd4129926f4ec4e634002040247e97f60ebfbc709c793c2`.
- Actual trusted mousedown: `id=2`, `clientX=238`, `target=""`, event-before tile `x=240.92300415039062`, `grabbed=false`, `inertiaPaused=false`, `after=null`, `sameEvent=false`. Мышь уже левее текущего tile. Это не engine jump и не ослабление observer; это сохранившаяся гонка выбора координат в harness.
- В том же запуске настоящий drag и инерция до interrupt уже выполнялись. Ошибка сохранена в receipt и не проглочена.
- Три последующих последовательных запуска той же команды прошли; receipts `motion-run-llXvvw`, `motion-run-EAXU1N`, `motion-run-PN8jIN`. Следовательно, наблюдение: **1 FAIL + 3 PASS из четырёх normal attempts**, а не устойчивый GREEN. Это не оценка вероятности флейка и не основание отбросить первый FAIL.
- Владелец triage: родительский координатор; finding передан ему для назначения исправляющего исполнителя. Нужны устойчивое реальное попадание при живой инерции в normal path и регрессия этого пути. Не исправлять ожиданием settling, pause engine, расширением порога, skip или повтором до первого PASS. После исправления — новая frozen revision и повторное независимое ревью. Здесь исходники не исправлялись.

### Фактически выполненные проверки

Логи данного reviewer: `~/.hermes/cache/scratch/followup04-independent-qa/`.

| Проверка | Фактический результат |
|---|---|
| Полный Python discovery, `-p 'test_*.py' -v` | **88 PASS**, exit 0 (`python88.log`) |
| Реальный CI contract | **5 PASS**, exit 0; отдельно перечислены **20 успешных negative subtests** (`ci5.log`, `ci20-enumerated.log`) |
| Четыре явные Node suites из workflow | **74 PASS, 0 fail/cancelled/skip/todo**, exit 0 (`node74.log`) |
| Selftest | exit 0, без freshness warning (`selftest.log`) |
| Readonly role sync | exit 0, `Drift: none` (`sync.log`) |
| Normal full integration | первая попытка FAIL; три последовательных повтора PASS (`normal.log`, `normal-repeat-{1,2,3}.log`) |
| Missing MOTION_DEPS / MOTION_BROWSER | два свежих процесса, каждый exit 1 с соответствующим assertion, до strict TS/browser/receipt |
| Полная Python suite + намеренный semantic failure в памяти | **89 tests, FAILED (failures=1), exit 1**, остальные 88 выполнены; negative probe, не положительный gate (`python-semantic-negative.log`) |

Python suite использовала уже установленный Hermes Python 3.14.9; `python3` системы — 3.9.6, для suite не применялся. Node 24.21.0, macOS arm64. Использованы только существующие `motion-stage04` dependencies и Chromium headless shell 1255. Рабочие 95 Python cases из чужого dirty tree здесь не выдаются за независимо выполненную проверку frozen candidate.

### Независимая проверка обоих browser regression receipts

Node74 действительно запустил положительный **80 ms** subprocess и отрицательный **actual DOM translate 12 px** subprocess. Проверены не только logs/status, но и прочитанные JSON receipts, hash template/lock, actual event поля и позиции; агрегация — `receipt-validation.json`.

1. Positive: `~/.hermes/cache/scratch/motion-observation-regression-xlSjAT/receipt.json`, SHA-256 `f11be1a2706905a5101dfdc57c5acbb4bab68ab1f80fef3bf218dfc54af227d6`. `result=PASS`; **9 actual grabs**, все trusted/sameEvent/target=tile, false→true grabbed, after inertiaPaused=true, все same-event deltas **0 px**. Контролируемые pre-event advances: **11.814208984375** и **4.89990234375 px**. Это живая инерция, не vacuous settled PASS.
2. Negative: `~/.hermes/cache/scratch/motion-observation-regression-uAN8zm/receipt.json`, SHA-256 `43f467d8276ca99d5ecba5a2f577acc4a48a366ada6b6abde36d7478422a88fc`. `result=FAIL`, subprocess exit 1; actual same trusted tile event, engine grabbed=true и inertiaPaused=true; DOM delta **12 px**, `grab must not jump to pointer center`. Scratch target-handler действительно устанавливает CSS `translate`, после engine и до observer-after; ни snapshot, ни engine не мокируются.

Во всех четырёх положительных full receipts (80 ms case и три normal повтора) независимо проверены девять event bounds и девять rAF stability traces, диапазон каждого trace `<1px`, normal/restored temporal advance `>1px`, cleanup/listener invariants и отсутствие pageerrors. Положительные повторы не отменяют QA-01.

### Старый сбой и смысл assertions

Прочитаны исходный parent `final/motion.json`, original receipt `motion-run-xGp9pj/receipt.json` и causal diagnostic `motion-run-CUokxC/receipt.json`; их hashes, а также inconclusive/stale-target receipts проверены против worker trace-summary. Оригинальные failures не изменялись.

Causal diagnostic действительно показывает legacy-before **174.385498046875** → external-after **187.4467010498047** (13.061203002929688 px), тогда как capture и target-after одного trusted mousedown с timestamp **1051.300000011921** оба имеют x **187.4467010498047**, grabbed false→true и inertiaPaused false→true. Исходный parent receipt сам по себе не содержит таких same-event bounds; causal conclusion основан на отдельном реальном diagnostic, не на выдуманной ретроспективной трассе parent.

Новый observer использует window capture и установленный после engine tile listener, reference equality реального event и arm id; window bubble действительно непригоден при engine stopPropagation. Между before/after нет ожидания, rAF или Node roundtrip. Строгий исходный no-jump порог **`abs(delta) < 1`** сохранён, включая отказ при ровно 1 px. Interrupt `<30` перенесён на те же event bounds и теперь избыточен относительно `<1`, но не расширен. Сохранены held stability и normal/reduced/dynamic/interruption/repeat/destroy assertions; существующие settled waits не добавлены как обход grab. Исправление измерения причинно обосновано, однако выбор координат normal grab остаётся дефектным по QA-01.

## Silent-failure verdict: PASS — только ограниченная область propagation

Скрытых сбоев не обнаружено в прочитанных восьми файлах и проверенной цепочке исполнения. Это **не общий acceptance PASS** и не разрешение публикации: QA-01 открыт.

- Полностью прочитан workflow: нет `continue-on-error`, conditional gate, `|| true`, секретов или write permission; только `contents: read`, неперсистентные checkout credentials. Явные pinned setup actions, Python 3.12/Node 24 и явные test commands. `npm ci --prefix ... --ignore-scripts --no-audit --no-fund` выполняется в изолированном prefix; browser install/export и проверка executable предшествуют всем 74 Node tests; full integration — следующий обязательный шаг.
- `defaults.run.shell: bash` означает Actions `bash --noprofile --norc -eo pipefail {0}`: [официальный workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#defaultsrunshell). Все **7 run-блоков** проверены через `bash -n`. Отдельные обозначенные fault-injection probes с этими flags подтвердили abort после отказа selftest, npm, browser command substitution и Node tests (exit 37), pipeline failure (exit 1); последующие sentinel commands не выполнялись. Это локальная проверка shell semantics, не запуск npm/installers и не имитация успешного Actions run.
- Реальная полная Python suite выполнена, не заменена syntax-only проверкой. Отдельный deliberate semantic-failure probe выполнил все исходные 88 cases и дополнительный failing test, вернув 1; workflow не содержит маскирующей конструкции вокруг discovery.
- Все 20 contract mutations действительно изменяют исходный текст и отклоняются: 14 unsafe/config mutations + 6 command removals. Покрыты permissions, credentials, ignored failure, condition, secret, action pin, untrusted event, isolated lock/root install/browser env и обязательные команды. Отдельный пятый test проверяет npm/browser-before-Node ordering. Checker честно является ограниченным textual contract, не универсальным YAML/Actions validator.
- `node --test` без filter/skip flags; реальные browser regressions требуют env без skip fallback, проверяют spawn error/status и actual receipt. Normal runner integration env assertions стоят до загрузки dependencies/TS/browser; наличие раннего `PASS createDraggable export contract` в missing-env stdout не является full integration PASS: оба процесса завершаются 1.
- TypeScript diagnostics должны быть пусты; esbuild/import/SSR/browser assertions awaited. pageerror collection проверяется; catch ставит FAIL и **rethrows**, finally сохраняет receipt и закрывает browser/server. Успех subprocess не подменяет receipt semantics. QA-01 как раз доказывает, что missed target не превращается в тихий PASS.

## Ограничения и изменения

Реальный Linux/GitHub Actions run, Linux npm/browser installation и Actions expression engine **не выполнены**. Manual a11y, product acceptance, physical devices и native activation вне scope и не заявлены. Ни providers, ни remote dispatch, ни установки, ни visible browser/bringToFront, ни Git writes не использовались.

Единственный созданный repository-файл — этот отчёт. Дополнительные scratch logs/receipts принадлежат реальным локальным проверкам. Frozen восемь файлов, production, fixtures и чужая dirty работа не изменены. Итог: **QA REQUEST_CHANGES; silent-failure PASS в описанных границах; публикационный gate остаётся BLOCKED**.
