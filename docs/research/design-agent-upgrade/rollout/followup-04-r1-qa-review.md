# F04-R1 — независимая повторная проверка QA / silent-failure

## Идентичность, revision и verdicts

Один фактический reviewer: **Hermes Agent, runtime session `20261127_191342_72be2c`**. Независимый от implementer адаптированный Hermes-review, не native Codex activation и не два независимых человека. Полностью прочитаны `.codex/agents/quality/qa-engineer.md`, `silent-failure-hunter.md`, `.codex/workflows/review-loop.md`; обе роли выполнены самостоятельно, без рекурсии/делегирования.

- **QA verdict: PASS — F04-R1 закрыт в ограниченной области исправления порядка реального ввода на новой frozen revision.**
- **Silent-failure verdict: PASS — проверенная цепочка fail-closed сохраняется; скрытых сбоев не обнаружено.**

Это не COMPLETE для design CI: фактический Linux/GitHub Actions run остаётся **PENDING**. Никакой сертификации physical devices, client keyboard/a11y, product/visual acceptance или native IDE activation этот отчёт не даёт.

Проверенный candidate:

- Base: `c10a97d7e80d805087889efc448ee3e0aafb5234`.
- Tree: `f28abd3446729c053a23f905b57c04a9215159be`.
- Map: `/Users/germanbryzgalov/.hermes/cache/scratch/design-ci-parent-06580sea/r1-final/review-map.json`.
- Map SHA-256: `3c9ace384ca2dbce725b5572aaf9cb4b25305e64d42b162c23bd28beb7979235`.
- Исполнение: точный `r1-final/export`, не foreign dirty checkout.

Полностью прочитаны все **12 frozen paths** из map: workflow, CI contract, runner, observer, observation suite, CI/motion ledgers, FOLLOWUP-PLAN, оба исторических review, inconclusive R1 input report и parent fix report. SHA-256 каждого совпал с map, actual tree blob, export и working ROOT; заключительная проверка после тестов — **12/12 совпадений**. `git diff --check base tree` чист. Дополнительно NUL-safe проверены Git blob identities всех **1746 присутствующих файлов** export; это dependency export, не заявление о наличии всего монорепозитория.

Существующие worker before/after guards равны; все **75 core/production/pilot hashes** независимо совпали с export и ROOT. Template/fixture/lock дополнительно совпали с base. Production template SHA-256: `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`. Это hash template, не совокупный hash клиента. Источники и чужая dirty работа не исправлялись.

## QA: что проверено и почему F04-R1 закрыт

`.codex/scripts/test-motion-template.mjs:99–112`: snapshot → arm → optional controlled delay → **финальный actual bbox → real mouse.move → real mouse.down**. Между final aim и down больше нет snapshot/arming evaluate. Порядок общий для default и 80ms mode; прежний offset **23px** сохранён. Нет settling перед interrupt, pause engine, retry loop, расширения hit target, observer/mouse mock или подмены receipt. Последующие settled waits относятся к прежним отдельным сценариям и не заменяют live interruption.

`.codex/scripts/test-motion-observation.mjs:62–104`: новый default case исполняет настоящий полный browser replay **без** `--observation-latency`. Scratch instrumentation только отмечает порядок реальных вызовов и assert; не меняет engine/event/geometry. Два freshAimChecks наблюдались при live legacy snapshot, оба freshBounds=true; дополнительно receipt требует actual **event-before inertiaPaused=false**, а не только флаг до события. В фактическом запуске таких actual interruptions **2**.

Независимо воспроизведён **один** deterministic RED: новый protocol test + старый runner из rejected tree, только в disposable scratch copy. Exit 1, `live input coordinates must be sampled after observer arming` (`independent-protocol-red.log`). Это нарушение порядка до press, **не новый случайный missed-target receipt**. Новая frozen версия того же test прошла в полном Node75. Parent RED/GREEN artifacts также прочитаны; они не выдаются за самостоятельно выполненный parent experiment.

Observer (`lib/motion-observation.mjs:3–40`) неизменён: window capture before и установленный после engine tile listener after одного реального event; reference equality, arm id, trusted input, tile target, actual grabbed false→true, after inertiaPaused=true. Между event bounds нет CDP/rAF/timer. Строгий смысл **`abs(after.x - before.x) < 1`** сохранён: ровно 1px и 12px отвергаются unit cases; actual 12px DOM mutation отвергается browser case. Это непрерывность во время grab, не запрет законной инерции до события. Внешний interrupt `<30px` использует те же event bounds и избыточен относительно `<1`, не ослабляет его. Отдельные held/stability traces сохранены.

### Реальные новые проверки

Evidence directory: `/Users/germanbryzgalov/.hermes/cache/scratch/f04-r1-qa-72be2c/`. `run_checks.py`, `results.json` сохраняют точные команды, порядок, exit и logs; `validation.json` — программную проверку actual receipts/чисел/negative subtests.

| Проверка на exact export | Результат |
|---|---|
| Full `python -m unittest discover -s .codex/scripts -p 'test_*.py' -v` | **88 PASS**, exit 0, без skip |
| CI contract, отдельный discovery `test_design_ci.py` | **5 PASS**; отдельно выполнены/перечислены **20** успешных negative subtests (14 mutations + 6 command removals) |
| Четыре явные Node suites workflow | **75 PASS**, 0 fail/cancelled/skip/todo; настоящий positive80ms, DOM12px negative и новый default-live case выполнены |
| `selftest.py` | exit 0, без WARNING |
| `sync-roles.py`, без `--apply` | exit 0, `Drift: none` |
| Standalone default `node .codex/scripts/test-motion-template.mjs --integration`, попытка 1 | **PASS**, exit 0, `motion-run-rG4owB` |
| Та же команда, следующая последовательная попытка 2 | **PASS**, exit 0, `motion-run-JFiz3p` |

Было заранее назначено ровно **две** standalone default попытки, обе выполнены последовательно независимо от результата, без retry-until-PASS. Ни одного нового положительного integration FAIL в этих двух попытках не было. Рабочие 95 Python tests родителя не выдаются за нашу проверку candidate; независимо выполнены clean88.

### Прочитанные и проверенные receipts этого reviewer

Все пути ниже — под `/Users/germanbryzgalov/.hermes/cache/scratch/`, файл `receipt.json`.

| Case / receipt directory | Result / проверка | SHA-256 |
|---|---|---|
| Positive80ms: `motion-observation-regression-YY8W1q` | PASS; 9 grabs; 2 actual live interruptions; pre-event advances **15.45111083984375**, **30.889892578125px** | `20f072163fe365f194cc24e722fdb9426d001e3ac3db92ea06021c02c943b6e1` |
| Actual DOM12px: `motion-observation-regression-fsSajI` | **ожидаемый FAIL**, subprocess exit 1; trusted same tile event, actual grabbed/paused, DOM delta **12px**, `grab must not jump to pointer center` | `372ce2923637b5a4506191f5917a5cb2c9004f2e5848b2c6f694770850f23c2f` |
| Default protocol: `motion-observation-regression-mHNMOm` | PASS; 9 grabs; 2 actual live interruptions; 2 live freshAimChecks=true | `a4b3a4d785eae6129fe9f59597af65a43c52bc492eae4c3bee9948fa49ecb0b5` |
| Standalone normal 1: `motion-run-rG4owB` | PASS; 9 grabs; 2 actual live interruptions | `f48a1e9fbe282528d21fb94254be0c18774f209a395e8b337e6e8b9bec5df0c3` |
| Standalone normal 2: `motion-run-JFiz3p` | PASS; 9 grabs; 2 actual live interruptions | `6157f9bb4185aec0eb6a1c74c4850c1b45224729697d25295129d1af850d9afa` |

Во всех четырёх положительных full receipts каждый actual grab trusted/sameEvent/target=tile, grabbed false→true, after inertiaPaused=true; все same-event deltas **0px**. У каждого receipt **9 непустых multi-frame rAF traces**, с внешними before/after bounds; диапазон каждого **0px**, то есть строго `<1px`. Проверены normal/restored temporal advances `>1px`, template/lock SHA и отсутствие pageerrors. Положительный80ms case с продвижением до события >30px особенно явно не является settled/vacuous PASS. Negative намеренно ломает первый grab: это **не live-inertia negative**, а actual same-event DOM continuity control. Handler реально задаёт `style.translate='12px 0px'` после engine, до observer-after; не подменяет snapshot.

## Все FAIL сохранены, не заменены последующим GREEN

Исторические review на rejected tree `3e6077d67f1a1e0a2ca98cfcf5199e2b862cc2fb` остаются REQUEST_CHANGES, не переписаны этим отчётом. Оба старых actual default misses повторно прочитаны и хешированы:

- `motion-run-TB0X76/receipt.json`: SHA `f45ae27bc6d74f654cd4129926f4ec4e634002040247e97f60ebfbc709c793c2`, FAIL `grab requires both event bounds`; trusted press clientX=238, tile x=240.92300415039062, inertia live, after=null.
- `motion-run-8Qm5Lz/receipt.json`: SHA `9679989038fa0671725a9660b39eb34311fd21ae697ba478e21cc4343599325d`, тот же FAIL; clientX=345, tile x=349.5293884277344, inertia live, after=null.

Их последующие исторические PASS не отменяют failures. Fresh180ms tracer остаётся **inconclusive, не actual missed-input RED и не positive proof**; его failed coverage assertion сохранён в `followup-04-r1-input.md`. Основание bounded closure здесь — устранённый source-order seam, независимый old-source protocol RED/current GREEN, новые реальные default-live receipts и две заранее назначенные normal попытки, а не притворство о новом random miss или статистическая гарантия отсутствия любых host stalls.

Новые ожидаемые отрицательные результаты тоже сохранены: DOM12px FAIL; old-source protocol RED exit 1; missing-env subprocesses exit 1; semantic Python negative exit 1; shell fault probes ниже. Они не смешиваются с положительными acceptance gates.

## Silent-failure: propagation и ограничения проверки

- Workflow относительно rejected tree изменил только имя Node step. `.codex/scripts/test_design_ci.py` и observer unchanged; все обязательные gates активны. Только `contents: read`, persist-credentials=false; нет continue-on-error, condition/skip, `|| true`, secret/provider/write/upload/deploy. Изолированные package+lock/npm/browser executable/export предшествуют Node75 и standalone integration. Никаких локальных установок не выполнялось.
- Все **7 run blocks** прошли локальный `bash -n`. Отдельные явно обозначенные fault injections под `bash --noprofile --norc -eo pipefail` подтвердили abort после selftest/npm/browser command substitution/Node отказов (**exit37**), pipeline failure (**exit1**); последующий SENTINEL не выполняется. В probes функции возвращают ошибку вместо запуска installers; это проверка shell propagation, **не Actions/npm installation execution**.
- Два свежих процесса с удалённым MOTION_DEPS или MOTION_BROWSER каждый вернули **exit1** с явным assertion до TS/browser/receipt. Раннее сообщение export-contract PASS не считается integration PASS (`missing-MOTION_*.log`).
- Независимый full discovery + один intentional semantic failing test действительно исполнил **89 tests**, `FAILED (failures=1)`, exit1; остальные исходные88 исполнены. Это negative probe, не syntax-only замена полного gate (`python-semantic-negative.log`).
- CI textual contract честно ограничен, не универсальный YAML/schema validator. Реально перечислены все20 subtest outcomes, каждый mutant меняет source и отклоняется. Полный workflow дополнительно прочитан; локальная bash-проверка не сертифицирует GitHub expressions/events.
- TS diagnostics обязательны, real engine/SSR/browser awaited, spawn error/status и receipt semantics проверяются. Runner catch записывает FAIL и rethrows; finally сохраняет receipt и закрывает browser/server. Pageerrors не игнорируются. Missing after/target/grab/paused/trusted/sameEvent не проходят как «нет данных». Ни observer, ни mouse не мокируются в положительных browser cases.

Новых подтверждённых открытых defects в проверенном scope не найдено. Гарантия отсутствия автоматизированного промаха при произвольной паузе ОС не заявляется: bbox→move/down всё ещё реальные отдельные driver operations, но конкретный добавленный snapshot/arming gap удалён в обоих modes, а настоящий hit/live grab остаётся fail-closed assertion.

## Среда, изменения и оставшиеся gates

Фактическая среда: macOS arm64, Node **24.21.0**, уже установленный Hermes Python **3.14.9**; существующие `motion-stage04` deps и Chromium headless shell1255. PYTHONDONTWRITEBYTECODE=1, TMPDIR в Hermes scratch; runner запускает только `headless:true`. Не было visible browser, provider/network Actions dispatch, installs, source fixes или Git writes в исходном repository. Python tests могут создавать собственные disposable Git fixtures в scratch; это не изменение source/index.

Единственный созданный repository-файл — **этот отчёт**. Scratch scripts/logs/receipts сохранены отдельно. Первоначальная дополнительная export-validation остановилась на quoted Unicode Git path (не candidate failure); исправлена только scratch-проверка на NUL-safe `git ls-tree -rz`, после чего все1746 identities совпали. Ничего не скрыто перезапуском положительного browser gate.

**Итог: QA PASS (bounded F04-R1 closure); silent-failure PASS.** Actual Linux/GitHub run, Linux dependency installation, exact-SHA remote workflow execution и product/device/a11y acceptance не выполнены и этим отчётом не закрываются. Исторические FAIL и текущие negative controls остаются в evidence; публикации не было.
