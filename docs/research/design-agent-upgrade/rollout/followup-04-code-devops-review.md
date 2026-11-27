# Follow-up 04 — независимое code / TypeScript / DevOps / bounded-secrets review

## Reviewer и verdict

Reviewer ID: `hermes-independent-code-devops-06580sea` — один фактический независимый Hermes reviewer, не implementer, не четыре отдельных агента и не native Codex execution. Роли адаптированы чтением полных `.codex/agents/review/code-reviewer.md`, `review/typescript-reviewer.md`, `ops/devops.md`, `security/security-secrets-scanner.md`; также прочитаны review-loop, TypeScript rules/anti-patterns и security §13. Делегирования не было.

| Область | Verdict | Основание |
|---|---|---|
| CODE (Node.mjs, Python stdlib, YAML, receipts/plan) | **REQUEST_CHANGES** | F04-R1: фактический положительный default replay завершился exit 1 из-за промаха движущегося tile |
| TYPESCRIPT / JavaScript test harness | **REQUEST_CHANGES** | Тот же F04-R1 в изменённом grab helper; strict TS и SSR сами проходят |
| DEVOPS | **REQUEST_CHANGES** | Статические CI/security/order checks проходят, но обязательный final integration gate воспроизвёл F04-R1; Linux/Actions acceptance отдельно PENDING |
| BOUNDED-SECRETS | **PASS** | В exact восьми файлах и их diff утечек секретов не обнаружено; пределы ниже |

Одна находка, не три независимых дефекта. Общий publication gate **BLOCKED** до исправления и нового review новой revision. Два последующих успешных replay не отменяют сохранённый failure.

## Frozen scope и provenance

- Base: `c10a97d7e80d805087889efc448ee3e0aafb5234`.
- Candidate tree: `3e6077d67f1a1e0a2ca98cfcf5199e2b862cc2fb`.
- Map: `/Users/germanbryzgalov/.hermes/cache/scratch/design-ci-parent-06580sea/stability/review-map.json`.
- Map SHA-256 проверен: `97f42b00ed59244f92196309d7fdcd75add4968599a3e2121b3ea82b2f8aa8f7`.
- Исполнение — в указанном map `stability/export`, не в shared dirty ROOT.

Полностью прочитаны только восемь proposal файлов как review scope:

1. `.github/workflows/design-regression.yml`
2. `.codex/scripts/test_design_ci.py`
3. `.codex/scripts/test-motion-template.mjs`
4. `.codex/scripts/lib/motion-observation.mjs`
5. `.codex/scripts/test-motion-observation.mjs`
6. `docs/research/design-agent-upgrade/rollout/followup-04-design-ci.md`
7. `docs/research/design-agent-upgrade/rollout/followup-04-motion-observation.md`
8. `docs/research/design-agent-upgrade/rollout/FOLLOWUP-PLAN.md`

Для каждого независимо сопоставлены SHA-256 export/working/map, Git blob и mode из `git ls-tree`, bytes через `git show tree:path`: все совпали, все modes `100644` (export filesystem `0644`). Base→tree diff содержит ровно эти восемь путей; `publication.diff` побайтно равен Git diff; `git diff --check base tree` чист. Seven worker files + coordinator plan не присваивают чужие root changes.

Export — ограниченный dependency export, не полный checkout всех 4544 tree entries: все 1742 присутствующих файла точно соответствуют candidate blobs, extras отсутствуют; все 60 `docs/core` файлов присутствуют. Первоначальная широкая сверка отметила отсутствующие нерелевантные каталоги; последующая NUL-safe сверка отличила intentional omissions от byte mismatch. Полный Python/Node запуск на этом export проверил фактическую test closure; CI делает обычный полный checkout.

75 записей worker `source-guard-before.json`/`source-guard-after.json` равны и совпадают с текущими working bytes. Production и обе fixture проверены против base/tree/working и исторического identity receipt:

- `motion.ts`: `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`.
- `fixture.ts`: `f85ef00cb67bad96af7529d63c9c4a8be6cdabad5b99ff9300eccd891fab8d1c`.
- `fixture.html`: `09fb978e1c9a301feb0918750bc62a5e8cab14dff2528f499e625bc1d1b30244`.

HEAD остался base. Историческая aa69a378→c10a97d7 journal/review работа сохранена в base, не входит в proposal. Финальная повторная проверка map и всех восьми working/export hashes успешна.

## F04-R1 — обязательный default replay всё ещё может промахнуться по живой геометрии

**Важность:** HIGH / блокирует данный test-stability CI rollout. **Уверенность:** подтверждено actual receipt. **Владелец исправления:** координатор должен назначить implementer runner; reviewer исходники не менял.

**Путь:** `.codex/scripts/test-motion-template.mjs:99–110`, вызов `:189`; `.github/workflows/design-regression.yml:71` запускает именно этот default режим.

Bounding box берётся до `mouse.move`, отдельного snapshot и arm round trips. Повторное наведение по свежей геометрии выполняется только при `latency === 80`; обычный CI `--integration` оставляет старые координаты. При восстановленной живой инерции tile успел уйти из-под pointer. Event observer правильно отказал, но положительный harness стал красным без production jump.

Независимое воспроизведение на exact export, без модификаций runner, задержек или engine: первый `node .codex/scripts/test-motion-template.mjs --integration` дал exit 1, `grab requires both event bounds`, stack `grab:114` / caller `:189`. Receipt:

`~/.hermes/cache/scratch/motion-run-8Qm5Lz/receipt.json`

SHA-256: `9679989038fa0671725a9660b39eb34311fd21ae697ba478e21cc4343599325d`.

Последний actual press: latency=0, id=3 в этой загрузке, trusted=true, target="", clientX=345, clientY=211; actual before tile x=349.5293884277344, grabbed=false, inertiaPaused=false; after=null, sameEvent=false. Pointer оказался левее tile. Предыдущие завершённые event deltas равны 0. Это не доказательство нового engine bug и не прежняя ложная cross-CDP continuity delta: это реальный промах тестового ввода, корректно отвергнутый observer.

Два следующих неизменённых default запуска дали exit 0 (`motion-run-BtTOOT`, `motion-run-Pwxu3W`). Это подтверждает intermittent характер, а не устранение дефекта; статистическая частота по трём прогонам не оценивается.

**Требуемое исправление:** обеспечить надёжное попадание в движущийся tile и в default пути с сохранением живой инерции; добавить regression на этот обычный путь. Не ждать settling, не останавливать engine, не расширять `<1px`, не подменять событие/DOM snapshot и не скрывать failed assertions повторным успешным replay. После исправления повторить positive/negative suites и review новой frozen revision. Конкретную стратегию наведения выбирает implementer, не reviewer.

## Causal measurement и отрицательные контроли

Сам переход на event-scoped measurement корректен. `installGrabObservation` сохраняет event reference и before в window capture, after — в target listener, зарегистрированном после настоящего engine listener. В установленном animejs `handleDown` действительно вызывает `stopPropagation`, поэтому window bubble не был бы after bound. Между этими snapshot нет CDP/rAF/timer; identity, per-arm id, trusted input, target=tile, real grabbed transition и inertiaPaused проверяются. `<1px` не расширен; held-stability traces и normal/reduced/dynamic/repeat/destroy assertions сохранены. Missing completion и промах не превращаются в PASS.

Прочитаны и хешированы исходные failure и новые receipts, не только worker summary:

| Evidence | SHA-256 | Наблюдение |
|---|---|---|
| `design-ci-parent-06580sea/final/motion.json` | `070348608c13831eb88aa5c805350666e054ded761348eb75f0ed51e02b3b23a` | original exit 1, no-jump assertion |
| `motion-run-xGp9pj/receipt.json` | `72e0bc3d79e84f3b8e12fc130d418e5c88b039755d573f65331558e5ce4cafc0` | original FAIL preserved |
| `motion-run-CUokxC/receipt.json` | `ceb3252adb5d43a008c4ca7c5dd079be32e408c584513e3d5aaaa9b9db2fd483` | legacy delta 13.061203002929688px; actual trusted same-event before/after both x=187.4467010498047 |
| worker `receipts/clean-node-regression-0.json` | `cb7f084602944f12f2911c661ad0901e561b53a62368a1f5a46bea5c04f55027` | PASS, all nine deltas 0; actual pre-event advances >1px |
| worker `receipts/clean-node-regression-1.json` | `6b362c15d6ad80b46e2a9a3a56f2cbe14c6b7599f3ef4df60b1481476d07d0ec` | expected FAIL, actual same-event DOM delta 12px |

Независимо исполнены все десять новых Node cases: восемь unit и два headless subprocess. Bad/missing event, synthetic input, wrong target, absent grab, unpaused inertia и 1/12px jumps отвергаются. Positive latency=80 re-aim использует свежий bbox, не settles; actual advances 15.583404541015625 и 9.438873291015625px, все девять event deltas 0. Negative внедряет реальный `style.translate='12px 0px'` handler после engine и до observer-after, не mock snapshot; exit 1 и delta=12 подтверждены.

Новые independent evidence: `motion-observation-regression-WGlHHm/receipt.json` SHA `7992079fe2f05ec4ac2b21344b97eb2bdf31f7bfbb48b0d74bca2e538d901297`; mutant `motion-observation-regression-i5sths/receipt.json` SHA `2570d21b591b6a54d5339a63c6773a445c7d9c1e0f1d1733a298d2fa283ec340`.

## DevOps и bounded secrets

Workflow ограничен default branch `claude/greeting-nnz368`, design-related path filters и input-free workflow_dispatch. Только `contents: read`, checkout `persist-credentials: false`; нет PR/untrusted event, environment, secrets reference, deployment, upload, write permissions, conditional/ignored gates. Node 24 и Python 3.12 явны; setup-node automatic npm cache отключён.

Три official action SHA точно соответствуют сохранённым release/tag/commit verification artifacts (`feature-freshness-parent-0o4xiyqk/final/ci-action-pins.json`, `design-ci-worker/official-action-runtime-verification.json`). Fetched action.yml hashes пересчитаны и совпали; все используют node24. Reviewer не делал fresh GitHub/API/auth запросов: подтверждение latest/commit provenance опирается на эти ранее полученные receipts, не на новый online lookup.

Порядок верен: owned scratch → selftest/readonly sync/full Python → copy package+lock → isolated `npm ci --prefix ... --ignore-scripts --no-audit --no-fund` → runner Chromium install/export executable → четыре Node suite → strict TS/SSR/replay. Ни root npm, ни глобальных dependencies. Existing fixture lock содержит 33 package entries, registry hosts только registry.npmjs.org, exact installed lock совпадает. `@types/node` обязателен из MOTION_DEPS; regression отвергает ambient types. Chromium `install --with-deps` разрешён только будущему disposable Linux runner; локально не запускался. Runner `headless:true`, HTTP fixture только 127.0.0.1; dependencies/receipts/screenshots не upload.

Available Ruby Psych YAML parser + bounded structure assertions + `bash -n` по всем run scripts: PASS, 10 steps. YAML 1.1 `on` интерпретируется Psych как true и обрабатывается явно. Это не official GitHub schema/actionlint/Actions engine validation. Python contract честно textual и не претендует быть полным parser/security policy для любых будущих изменений; проверены actual YAML и все run scripts, а не только contract tests.

Прочитаны существующие relevant event blocks: deploy-perfect-skin — push только `deploy/perfect-skin`; deploy-simba — только `deploy/simba`; nullume-ci — `tools/nullume/**`; новая proposal ни один такой path/branch не затрагивает. Остальные просмотренные provider/media/admin workflows dispatch/schedule-only; workflow_run/workflow_call цепочек в просмотренных workflow events нет. Ничего не dispatch/run/push. Existing tracked workflows не менялись.

Bounded scan выполнен по полным восьми файлам и diff: AWS/GitHub/Stripe/private-key/JWT signatures, literal password/token/secret/API-key assignments, shell injection/eval/unsafe deserialize constructs; совпадений нет. Нет `.env` paths, auth-file reads, provider calls или secret-bearing output. Реальный stack — Node.mjs/Python stdlib/YAML technical fixture; client security profile не применяется. Это НЕ аудит всех foreign files, всей истории Git, настроек репозитория/сервера, реальных credentials или vulnerability advisory database. Нет найденного секрета, требующего ротации.

## Фактические повторные проверки и ограничения

Все команды выполнялись в exact map export на существующих Node v24.21.0 / Hermes Python 3.14.9, с:

```sh
export PYTHONDONTWRITEBYTECODE=1
export TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch
export MOTION_DEPS=/Users/germanbryzgalov/.hermes/cache/scratch/motion-stage04
export MOTION_BROWSER=/Users/germanbryzgalov/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

| Команда | Реальный результат |
|---|---|
| `python -m unittest discover -s .codex/scripts -p test_design_ci.py -v` | 5 PASS, exit 0 |
| `python -m unittest discover -s .codex/scripts -p 'test_*.py' -v` | 88 PASS, OK |
| `python .codex/scripts/selftest.py` | PASS, без freshness warning |
| `python .codex/scripts/sync-roles.py` | Drift: none |
| `node --test .codex/scripts/test-design-lint.mjs .codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs .codex/scripts/test-motion-observation.mjs` | 74 PASS, 0 fail/cancelled/skip/todo |
| `node .codex/scripts/test-motion-template.mjs --integration` | Strict TS + SSR PASS во всех трёх default попытках; browser replay: exit 1, затем 0, 0 — F04-R1 открыт |
| `ruby .../design-ci-worker/check_yaml.rb .github/workflows/design-regression.yml` | YAML/bounded structure/bash syntax PASS |

Новых installs, repository Git/index writes, исходных исправлений, provider/auth/native-browser действий не было. Test harness сам создаёт disposable scratch fixtures/receipts (включая изолированные Git fixtures Python suite); это не запись в исходный Git repository. Первый probe обнаружил, что HOME не repository и system python3=3.9; затем найден фактический `/Users/germanbryzgalov/Friday-claude` и использован existing Hermes Python. Broad filename discovery вернул macOS TCC denials для protected folders; они не открывались и в review не входят.

Единственный authored repository файл этого reviewer — данный отчёт. Реальный Linux npm/browser installation, GitHub Actions expression/event engine и exact-SHA workflow execution **PENDING**; локальные PASS и этот review их не заменяют. План корректно не помечает point 2 COMPLETE. После F04-R1 требуются новая frozen revision, повторные проверки/независимое review и только затем разрешённые координатором publication + actual Linux run/read-back.
