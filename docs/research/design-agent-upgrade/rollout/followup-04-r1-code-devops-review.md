# F04-R1 — независимое повторное code / JS-TypeScript / DevOps / secrets review

## Verdict и фактическая идентичность

Reviewer: **Hermes Agent, runtime session `20261127_191342_58956d`**. Один фактический независимый reviewer для четырёх областей, не implementer, не четыре независимых агента и не native Codex activation. Полностью прочитаны MD/TOML роли code-reviewer, typescript-reviewer, devops, security-secrets-scanner; review-loop, TypeScript rules/anti-patterns и security §13. Делегирования и исходных исправлений не было.

| Область | Verdict для frozen revision | Основание |
|---|---|---|
| CODE | **REQUEST_CHANGES** | Обязательный положительный browser regression фактически упал на новой revision: остаточный missed-target input, F04-R1-R |
| JS-TYPESCRIPT | **REQUEST_CHANGES** | Protocol-order исправлен и default regression проходит, но Node 24 suite: **74 PASS / 1 FAIL из 75**; strict TS/SSR проходят |
| DEVOPS | **REQUEST_CHANGES** | Статические CI admission/pins/read-only/order checks проходят; обязательная Node gate не GREEN. Linux/Actions отдельно **PENDING** |
| SECRETS (bounded) | **PASS** | В полных 12 frozen файлах и их diff сигнатур/литералов секретов не найдено; границы ниже |

**F04-R1 нельзя закрыть по этой revision. Publication/acceptance остаётся BLOCKED.** Новый порядок устраняет конкретные лишние observation round trips, но фактический положительный replay всё ещё промахнулся. Default-path PASS и прежние parent PASS этот новый failure не отменяют.

## Frozen scope и provenance

- Base: `c10a97d7e80d805087889efc448ee3e0aafb5234`.
- Tree: `f28abd3446729c053a23f905b57c04a9215159be`.
- Map: `~/.hermes/cache/scratch/design-ci-parent-06580sea/r1-final/review-map.json`.
- Проверенный map SHA-256: `3c9ace384ca2dbce725b5572aaf9cb4b25305e64d42b162c23bd28beb7979235`.
- Исполнение: map `r1-final/export`, не shared dirty checkout.

Все **12/12** map entries проверены: export bytes = working bytes = `git show tree:path`; SHA-256 = оба поля map; Git blob SHA-1 и tree mode совпадают, все `100644`, export filesystem `0644`. Base→tree содержит ровно эти 12 путей; `publication.diff` побайтно равен Git diff, `git diff --check` чист. HEAD остался base. Ничего не staging/commit/push/reset/stash.

Полностью прочитаны оба изменённых `.mjs`, observer, Python CI contract, workflow и все семь rollout-документов из map: CI ledger, motion ledger, FOLLOWUP-PLAN, два исторических review, inconclusive worker report и новый parent-fix receipt. Исторические REQUEST_CHANGES/BLOCKED относятся к своим явно указанным revision/attempt; это не нынешние автоматически закрытые findings и не нынешние положительные доказательства.

Точные aliases к ранее reviewed восьмифайловому scope (`stability/review-map.json`), дополнительно перечитанные здесь:

| Неизменённый путь | SHA-256 |
|---|---|
| `.codex/scripts/test_design_ci.py` | `1d13b1b5f04a108758fa8d1278439f3b10a63124cecc88c37fbfd2bf2c2247db` |
| `rollout/followup-04-design-ci.md` | `22552578802d6f15d309900e661484f3584aa862fbb5e94ae782081379d4550f` |
| `.codex/scripts/lib/motion-observation.mjs` | `faa801c586e87bc11d95c139a40ec8d439b9e5ddcf870a1fab0e45c4ade6dd09` |
| `rollout/followup-04-motion-observation.md` | `5ad6ffc0bd1b8a23d314a190525d1e10f5b5d300c4f3b7b7362be86a70ac7369` |
| `rollout/FOLLOWUP-PLAN.md` | `3d5a4f724b363e9d13e3c9f796aa59371e7fac89956c57f5ae55361452f81021` |

`rollout/` здесь сокращает `docs/research/design-agent-upgrade/rollout/`. Workflow изменён только label относительно rejected tree, не executable instructions. Новый runner SHA-256 `c55622cea60be10386a6b43108edccfd758f32fae92a0ed4392c5167083a0da9`; observation test `892433b1278c15678814a957aadf8b2da76781854b8291ec3986dcb393453048`.

Все **1746** присутствующих файлов bounded export совпали с candidate blobs; **2802** tree entries намеренно отсутствуют. Это не полный монорепозиторий. Все **75** записей worker source-guard-before/after равны и совпали с export/working. Production и fixture также равны base/tree/export/working:

- `motion.ts`: `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`.
- `fixture.ts`: `f85ef00cb67bad96af7529d63c9c4a8be6cdabad5b99ff9300eccd891fab8d1c`.
- `fixture.html`: `09fb978e1c9a301feb0918750bc62a5e8cab14dff2528f499e625bc1d1b30244`.

## F04-R1-R — фактический residual miss в обязательной положительной regression

**HIGH, блокирует acceptance; уверенность: actual failure receipt. Владелец: parent coordinator для назначения отдельного исправляющего исполнителя.**

Место: `.codex/scripts/test-motion-template.mjs:99–111`, вызов restored-inertia grab `:186`; `.codex/scripts/test-motion-observation.mjs:79–83` и workflow Node regression step.

На exact frozen export выполнен один полный запуск четырёх Node suites явно существующим **`/usr/local/bin/node` v24.21.0**, соответствующим major CI. Результат: **75 tests, 74 pass, 1 fail, 0 cancelled/skipped/todo, exit 1**. Упал положительный `real headless controlled latency accepts pre-event inertia`, не намеренный DOM mutant и не protocol negative.

Receipt: `~/.hermes/cache/scratch/motion-run-NmbE69/receipt.json`.
SHA-256: `b44a3ae9a2231f5f5b96a0d9e68a38fbf105538d31fbc1f6dd1ce68cbde5941c`.

Scratch runner `motion-observation-regression-2vtD2O/.codex/scripts/test-motion-template.mjs` побайтно совпал с frozen runner: положительный latency case ничего в нём не инструментирует. Последний actual press: latency=80, id=3 в текущей загрузке, trusted=true, target="", clientX=319, clientY=211; actual event-before tile x=322.76141357421875, grabbed=false, inertiaPaused=false; after=null, sameEvent=false. Pointer левее actual tile. Ошибка `grab requires both event bounds`, stack runner `:111` / `:186`. Предыдущие завершённые same-event deltas равны 0.

Новый порядок snapshot→arm→optional latency→final bbox→mouse.move→mouse.down реально присутствует; никаких добавленных observation calls между aim/press нет. Следовательно, конкретный protocol defect исправлен, однако это **не обеспечивает достаточное фактическое попадание во всех уже обязательных положительных replay**. Не утверждаю, что Node 24 сам является причиной: измерения всех protocol timestamps/host scheduling здесь нет. Доказан residual miss, а не engine discontinuity. Сохранившийся отказ observer корректен.

Требуется отдельное исправление/обоснованное принятие owner-ом этого остающегося блокера и новая frozen revision с затронутыми gates/review. Не скрывать failure retry/pass-loop, skip, settling/pause, увеличением hit area/offset или ослаблением `<1px`/trusted/same-event checks. Здесь исходники не исправлялись; не запускал повтор упавшей команды ради PASS.

## Что действительно исправлено и предел regression

Runner `:100–107` переносит snapshot, arm и контролируемые 80ms **перед** финальным bbox, затем настоящий move с прежними +23/+31 и настоящий down — в обоих режимах. Никаких новых settle/pause/retry или ослабленных assertions. Observer неизменён: window capture before и установленный после engine target after, reference equality реального event, arm id, trusted tile hit, actual false→true grabbed, inertiaPaused=true, строгий `abs(delta)<1`. Existing held traces и normal/reduced/dynamic/repeat/destroy checks сохранены.

Default regression инструментирует только disposable runner copy, не engine/mouse/fixture. Flags отражают фактическое выполнение bbox после arm; assertion исполняется до реального press при live snapshot. Дополнительно полный replay обязан показать actual event-before inertiaPaused=false. Это bounded protocol-order invariant, не универсальный анализ произвольной будущей перестановки кода и не magical hit guarantee при любой задержке хоста.

Проверены parent `r1-parent/protocol-red.json` и `protocol-green.json`, actual receipts и scratch sources. Инструментированный OLD source побайтно равен rejected runner плюс ровно нынешний guard; GREEN аналогично равен frozen runner плюс guard. RED `motion-run-QADoO1` содержит freshBounds=false/live=true, exit 1 на `live input coordinates must be sampled after observer arming`; GREEN `motion-observation-regression-36vUTT` — два true/live=true и PASS. Это реальный RED protocol invariant, **не новый принудительно полученный случайный miss**.

Старые реальные default failures независимо перечитаны и хешированы: `motion-run-TB0X76` SHA `f45ae27bc6d74f654cd4129926f4ec4e634002040247e97f60ebfbc709c793c2`, `motion-run-8Qm5Lz` SHA `9679989038fa0671725a9660b39eb34311fd21ae697ba478e21cc4343599325d`: оба trusted misses/after=null/live inertia. Старый 180ms experiment `motion-observation-regression-Wf1XKo` SHA `b42b81d615a310af204b1ddd32c0e884c3a17731c67a252723d4cd75c1f7ef79` имеет PASS subprocess receipt: failing coverage assertion остаётся **INCONCLUSIVE**, не missed-input RED. Исторические отчёты не переписаны.

## Фактические проверки — все попытки сохранены

Evidence: `~/.hermes/cache/scratch/f04-r1-independent-code-20261127_191342/`. JSON logs содержат точные commands/cwd/output/exit, `receipt-validation.json` — прочитанные actual receipts, `provenance-scan.json` — map/alias/guard/scan.

Среда: существующий Hermes Python **3.14.9**, macOS arm64; `PYTHONDONTWRITEBYTECODE=1`, TMPDIR в указанном evidence scratch, MOTION_DEPS=`~/.hermes/cache/scratch/motion-stage04`, existing headless shell 1255. Никаких установок.

| Проверка | Результат |
|---|---|
| Полный Python `unittest discover -s .codex/scripts -p 'test_*.py' -v` | **88 PASS**, exit 0, включая 5 CI contract cases/20 negative subtests |
| Python selftest | PASS, без WARNING |
| Readonly `sync-roles.py` | `Drift: none` |
| Первые четыре Node suites, PATH Node **26.12.1** | **75 PASS**, 0 fail/skip; сохранено как дополнительная среда, не подмена CI Node24 |
| Первый normal integration, PATH Node26 | PASS, strict TS + SSR + real replay |
| Четыре suites, explicit **Node24.21.0** | **74 PASS / 1 FAIL**, exit 1 — F04-R1-R |
| Один normal integration, explicit Node24 | PASS, strict TS + SSR + real replay; не отменяет предыдущую suite failure |
| Ruby Psych YAML/bounded structure и `bash -n` | PASS, 10 steps; не официальный Actions validator |

Первый shell probe с системным python3 остановился на отсутствии tomllib до review/tests; использован существующий Hermes Python, без install. После первых successful runs обнаружен различающийся PATH инструментов: Python subprocess нашёл managed Node26, обычный shell — `/usr/local/bin/node`24. Поэтому Node checks выполнены отдельно на explicit target major; все результаты, включая новый FAIL, сохранены. Это не rerun-until-green.

Fresh Node24 default-regression receipt `motion-observation-regression-6a7EQs`: SHA `6bcfb0a3fc684ea3584bb05aef2a3808bc130d68a65af9f55ab878f3eb07f95b`; 9 trusted same-event tile grabs, **2 actual live interruptions**, два true freshAimChecks, все deltas=0. Node24 normal receipt `motion-run-P3B2lF`: SHA `7945feb25859c1ba39b87d73f1dd87f4165b1760d5bb1025fc0a19113faa3369`; 9/2/deltas0. Node24 expected mutant `motion-observation-regression-7iUqiY`: SHA `53fd76112d806f5cb090afbab62adfc52cbb337d5883ca75102cf5dc962593db`; actual trusted same-event DOM +12px, FAIL на прежнем no-jump assertion, как требуется.

Node26 positive latency receipt `motion-observation-regression-fgRKxs` содержит actual pre-event advances 8.360992431640625 и 7.641815185546875px; default и normal также 9 grabs/2 live/deltas0. Обе parent normal receipts `motion-run-rcIICa` и `motion-run-9FXclk` перечитаны: 9/2/deltas0. Их PASS не выдаются за гарантию или отмену Node24 failure.

## CI admission и bounded security

Workflow полностью перечитан. Branch/path filters и input-free workflow_dispatch сохранены; только `contents: read`, неперсистентные checkout credentials, Node24/Python3.12, npm cache disabled. Нет secrets reference, protected environment, upload, paid/provider/deploy action, PR/untrusted event, ignored/conditional test gates. Порядок: scratch→selftest/sync/full Python→copy pinned package+lock→isolated `npm ci --prefix ... --ignore-scripts --no-audit --no-fund`→runner-only browser install/export executable→четыре Node suites→strict TS/SSR/integration. Локально installer не исполнялся.

Три 40-hex pins совпали с сохранёнными primary-source verification artifacts; пересчитаны hashes сохранённых action.yml, runtime node24:

- checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`;
- setup-node `949feb2413d6458794dcd2491c4babbbce0c15c1`;
- setup-python `6d4fd22b20465ccc0f7354476588e8df7c9ca0e0`.

Это read-back уже полученных artifacts, не fresh online/latest lookup. Изолированный installed lock равен pilot lock SHA `d5c07cd0ebc685c72ce408abd5d7e085661cbb42596656adaa17097351eb2be5`. Другие workflow event blocks перечитаны: deploy branches и provider pilot branches не совпадают с target branch; nullume-ci ограничен tools/nullume; manual/scheduled jobs не запускаются этой proposal. Новых вызовов/цепочек paid deployment не добавлено.

Bounded scan: полные **12** файлов и base→tree diff, AWS/GitHub/Stripe/private-key/JWT signatures, literal password/token/API-key/secret, unsafe shell/eval/exec/pickle constructs — совпадений нет. `.env` paths не добавлены. Stack — offline Python stdlib/Node.mjs/YAML technical fixture; отдельного применимого security-profile для этого cross-project harness нет, клиентские профили не подменяют его. Не заявляется аудит всей Git history/foreign dirty files, server/repository settings, реальных credentials или CVE database. Найденного секрета/необходимости ротации нет.

## Ограничения и изменения

**Linux npm/browser installation, GitHub Actions expression/event engine и actual exact-SHA run остаются PENDING для parent после разрешённой публикации.** Даже полностью зелёный macOS review не заменил бы этот gate; здесь дополнительно имеется фактический положительный test failure. Point 2 плана не COMPLETE.

Единственный authored repository file — этот отчёт. Остальные записи — disposable scratch logs/receipts тестов; Python suite создаёт собственные isolated Git fixtures, не пишет исходный repository index. Source/fixtures, frozen 12 файлов и исторические отчёты не изменены; финальные SHA-256 и modes повторно проверены. Нет Git publication/dispatch, providers, installer, visible browser, source fix или новой feature.
