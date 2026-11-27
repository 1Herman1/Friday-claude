# R3 — независимое post-recovery / bounded publication review

## Verdict: PASS — только пять документов, не pilot WIP

Reviewer: **Hermes delegated reviewer, текущая независимая review-сессия**. Один фактический reviewer применил documenter / code / DevOps / QA / secrets perspectives; это не пять отдельных агентов. Прочитаны реальные `.codex/agents/ops/{devops,documenter}.md`, `.codex/agents/review/code-reviewer.md`, `.codex/agents/quality/qa-engineer.md`, `.codex/agents/security/security-secrets-scanner.md`, общий CODEX, review-loop и §13 security anti-patterns. Загружен requesting-code-review skill. Явный read-only scope имеет приоритет над общими командами запуска тестов/task-gate.

PASS относится к source/security/ops accuracy документа восстановления и его execution TZ, неизменности трёх ранее проверенных r2 ledger-файлов и этому отчёту. Это **не** разрешение на recovery, Git write, публикацию кода/клиентских медиа или принятие пилота. Родитель может публиковать только перечисленные четыре payload + этот review; новый pilot WIP, `followup-05-client-pilot.md`, private receipts и любые другие dirty файлы не входят.

## Exact payload SHA256

Все пути ниже относительны `docs/research/design-agent-upgrade/rollout/`:

| Файл | SHA256 фактических bytes |
|---|---|
| `followup-05-git-recovery.md` | `676f174bdab9bb23912beb704eaca75c50497202c8910c649f8b918c40970d5b` |
| `FOLLOWUP-PLAN.md` | `a4aa4117abdaed844fde646fe73d8b4b1c3c1c24cce1489e4e262834ed0c7ddc` |
| `followup-04-linux-acceptance.md` | `a417bd0b18d5edd53100d79c59bee179ea2abeeffd3179e63a446a004a18c00c` |
| `followup-04-linux-ledger-review.md` | `29ed2aaf4e3dd42c4ee8a8c58e997138b866ebca8f480a66da3c394bff6bd0fc` |

Три r2 хеша точно равны уже одобренным. Их техническое CI-ревью не повторялось; принятие Linux ledger сохраняется для прежнего exact source/run, не переносится на пилот. `git diff -- FOLLOWUP-PLAN.md` подтверждает только прежние изменения строк статусов 2/3; `git diff --check -- <полный путь плана>` вернул 0. Новый recovery report прочитан целиком, а не только через tracked diff. Изменение любого payload требует повторного review. Хеш самого review родитель фиксирует после записи: self-referential hash внутрь файла не включается.

## Свежий read-only main read-back

Git subprocess environment создавался как `{k:v for k,v in os.environ.items() if not k.startswith('GIT_')}`, затем явно `GIT_OPTIONAL_LOCKS=0`. Все Git-вызовы: `git -c core.hooksPath=/dev/null ...`, cwd `/Users/germanbryzgalov/Friday-claude`. Ни fetch, ни fixture/test suite не запускались.

Фактически выполненные команды и результат:

- `rev-parse HEAD` → `77d9e09390835250b39a684d245a32f2338fff32` (повторён после проверок, тот же результат).
- `symbolic-ref HEAD` → `refs/heads/claude/greeting-nnz368`.
- `rev-parse --show-toplevel` → `/Users/germanbryzgalov/Friday-claude`; `rev-parse --git-common-dir` → `.git`.
- `var GIT_COMMITTER_IDENT` → `Герман Брызгалов <germanbryzgalov@MacBook-Air-German.local>`; timestamp не часть сравнения identity.
- `config --local --get core.worktree`, `user.name`, `user.email` → каждый exit 1, stdout пуст: ошибочные локальные значения отсутствуют. Это восстановленный fallback, не доказательство исторических config bytes.
- `remote get-url origin` → `git@github.com:1Herman1/Friday-claude.git`.
- `ls-remote --exit-code origin refs/heads/claude/greeting-nnz368` → ровно тот же полный `77d9e093…` для этой ветки, exit 0; remote только прочитан.
- `ls-tree -r -z 77d9e09390835250b39a684d245a32f2338fff32` и `ls-files --stage -z`: Python разобрал NUL records и сравнил отсортированные mode/OID/stage/path. **4554 записей, все точно равны base, stage 0**. SHA256 вывода stage: `4841bc7c2df120eac29a2c9db7e0c66feb38d46f4b2e3406769d4ab25c334f00`.
- `diff --cached --name-only 77d9e09390835250b39a684d245a32f2338fff32 --` → пусто, exit 0.

Main config bytes точно равны private `proposed-config`, SHA256 `528dd8f32b23aa5182e68303045fd999c82b92fe79e9031ecedf5a1f20092a6c`; main index точно равен `recovery-main-index`, SHA256 `89624791653706d075c7fb2ab8ba3ca50eb04ddf3249e0f0498042cbbbd9a54a`. Это exact текущая целевая реконструкция, **не** exact неизвестное историческое staging/config состояние. Recovery report корректно различает эти понятия.

## Source preservation и сохранённый nonzero postcheck

Прочитаны, но не исполнены `recover_metadata.py`, независимый REQUEST_CHANGES и receipts в private `~/.hermes/cache/scratch/git-incident-20261127-201955/`.

Python `json.loads`, сравнение словарей и SHA256 фактических файлов установили:

- `full-source-before-apply.json` и `full-source-after-apply.json`: **81730 записей каждый, словари и bytes равны**; общий SHA256 `d835abdf159f10a7b320b47cfa118a1c605e5790a6a47b3be4cf3fa759d0dc3c`.
- Единственный exclusion marker — `trade-performance/prop-agents/engine/funding_monitor/out`, type `concurrent-runtime-output-excluded`. Root `.git` отсутствует в source inventory как административный каталог; остальные вложенные `.git` алгоритм не исключает. Записи содержат type/mode, file size/SHA256 и symlink target; traversal не следует symlink.
- Алгоритм проверяет изменение regular file во время чтения и не проглатывает traversal/special-file ошибки. Сравнение относится к recovery window, **не** обещает неизменность всего живого shared дерева до настоящего момента. Свежий полный source scan не запускался: законный pilot WIP продолжается. ACL/xattrs/hardlink topology этим не доказаны.
- `recovery-final-verification.json` SHA256 `96a6e42628571c4d81c4e531e1d851d7c86edf8690a2c14e72190c5fc7555e0f` согласуется с independent read-back целей.
- `apply-current-checkpoint-execution.json` действительно exit 1 на строке 130: `worktrees/worktree6/FETCH_HEAD`; `recovery-stopped.json` действительно phase `ref-restored`, не `verified`. Сам script проверяет main ref/index/config/identity/remote и source equality **до** broad metadata assert. Нельзя объявлять весь apply process exit 0; recovery report этого не делает. Нельзя его повторно применять: уже завершённые цели отдельно проверены.
- Старые REQUEST_CHANGES и failures сохранены. Прежний contaminated `stroymat-r3/python-clean.log` прочитан без запуска: `Ran 96 tests in 12.374s`, `FAILED (failures=4, errors=29)`; SHA256 `0d2907f8c0c0351deb50e9baa294dea879a3cfd844fcf63c62820a3b7b948d72`. Recovery report верно не использует это как acceptance.

## Foreign metadata: историческая и текущая границы различаются

Свежий recursive Python lstat/type/mode/SHA256 comparison `.git` с `pre-recovery-checkpoint` не ограничился чтением итогового boolean receipt. Main изменения ограничены config/index, целевой branch ref и append-only main/branch reflogs; старые reflog bytes остаются точными prefixes. Другого скрытого изменения основных main metadata в этом сравнении не обнаружено.

Foreign `worktrees/worktree6/FETCH_HEAD` и index действительно изменены. Через `ls-files --stage -z` с **только command-local** `GIT_INDEX_FILE` сравнен foreign index с **pre-recovery-checkpoint**: 4445 записей, семантически равны. С самым ранним `git-metadata` index они уже **не равны**: между первоначальным snapshot и свежим checkpoint был законный media commit. Нельзя подменять один baseline другим.

**Важно:** утверждение recovery report «только FETCH_HEAD/index» описывает разобранный postcheck в recovery window, а не весь текущий common Git directory. Во время этого review законная параллельная media работа продвинула `refs/remotes/origin/ci/serum-actual-one` с `9c5d23034abaebefaeca66d8b59b20a426742a0e` до `d756353fce87e30f554f5ff5d459ea7b0b5e8579`, дописала соответствующий reflog и создала 33 новых loose objects относительно checkpoint. Это не скрытая main ошибка:

- Foreign reflog prefix сохранён; новая запись — `update by push` от восстановленной identity. Это действие другого writer, не push reviewer/recovery executor.
- `rev-list --objects d756353fce87e30f554f5ff5d459ea7b0b5e8579 872273797eb998e9bed78f10b4624e4e96bc7a55 ^9c5d23034abaebefaeca66d8b59b20a426742a0e` программно объяснил **все 33** новых OID: unexplained set пуст. Проверка только final commit closure сначала оставляла 5 OID; они объяснены intermediate media commit/tree/workflow blob, не скрыты и не удалены.
- `show --no-patch --format=... 872273797eb998e9bed78f10b4624e4e96bc7a55` и `diff --name-status` связывают intermediate revision с тем же media parent; различие intermediate/final — только `.github/workflows/serum-actual-generation.yml`. Содержимое/платный запуск этой чужой задачи не переаудируется и не принимается этим verdict.

Нет claim «других writers не было», «все incident consequences отменены» или «foreign metadata никогда не менялись». Не было reapply/undo/переписывания foreign ветки. Проверка metadata — наблюдение на момент чтения, не synchronization lock для будущего publish.

## History consequence и execution TZ

`show --no-patch --format=%H%n%an <%ae>%n%cn <%ce>%n%s 9c5d2303` (весь format — один argv, передан напрямую subprocess, без shell) прочитал существующий `9c5d23034abaebefaeca66d8b59b20a426742a0e`: author **и committer** `Fixture <fixture@example.invalid>`, subject `media: freeze owner reference-matched one-attempt generation`. История не переписана. Current correct identity не исправляет эту историческую атрибуцию; recovery report явно сохраняет этот остаточный эффект и exact-SHA dependency другой задачи. Восстановлены целевые main metadata, не все последствия инцидента.

Execution TZ принят как **требования к последующей работе**, не как выполненная реализация: Git-less hash-locked source; stripped GIT_* subprocess env; disposable poisoned canary без live metadata donation; regeneration A/B из текущего CSS; неизменные layout checks; полные applicable regressions и независимое technical/visual review; owner visual acceptance отдельно PENDING; затем исходные пункты 4–9. Нет browser/test PASS, native IDE/a11y/permission/owner acceptance из факта recovery. Pilot fixer не ожидался и его WIP не принимается. Future checks должны быть изолированы, а не повторять unsafe live-Git export.

## Bounded security / publication gate

Полный текст четырёх payload прочитан; Python signature scan (private-key headers, GitHub/OpenAI/AWS key prefixes, quoted secret/password/token assignments) дал 0 hits во всех четырёх. В тексте нет обнаруженных credential literals или инструкций exfiltration; private paths — только ссылки, не копии auth/config/log содержимого. Project-specific application security profile не использовался: это document-only admission, не application/whole-history security clearance и не доказательство отсутствия всех видов секретов. Секреты/auth files не читались; rotation/provider/browser действий не было.

| Perspective | Verdict | Граница |
|---|---|---|
| Documenter / source | PASS | Report/TZ соответствует прочитанным receipts, exact восстановленные цели отделены от неизвестных historical bytes и pending pilot. |
| DevOps | PASS | Fresh main/root/index/identity/remote, сохранённый nonzero postcheck, foreign cache/fetch и более поздние foreign ref/objects объяснены; quiescence не заявлена. |
| QA | PASS | Проверена evidence, не запускалась новая acceptance suite; contaminated 96-test FAIL не переименован в PASS. |
| Security | PASS | Только перечисленные prose payload и bounded history references; нет adoption чужого WIP/сырых private receipts. |

Blocking findings в этих payload: **нет**. Перед публикацией родитель обязан повторить exact-byte guards и main/index/remote preconditions, сформировать candidate из **этих пяти документов только**, сохранить все foreign изменения и read back exact remote revision после разрешённой публикации. PASS не разрешает весь dirty tree или ordinary broad staging.

Единственный созданный файл — этот отчёт. Никаких recovery/Git writes, tests, installs, service stops, provider/auth/browser изменений или undo чужой работы reviewer не выполнял.
