# F1 — reference-handoff: scoped adoption proposal

## Verdict

**BLOCKED для публикации точного five-file proposal; не общий GREEN.** Новый offline guard получил genuine RED → GREEN в exact HEAD export после overlay только четырёх разрешённых файлов. Полный clean Python suite при этом обнаружил дополнительную зависимость существующего adopted test от неопубликованной маршрутизации config/roles. Она не перенесена и не скрыта skip/удалением gate. Parent должен выполнить independent review, разрешить минимальное устранение этой зависимости и публикацию до F2.

Исполнитель: adapted Hermes coder, не native Codex. HEAD: `e9e31fd5b80f48729a87823409c966f9c2b36d42`, ветка `claude/greeting-nnz368`. Изменения репозитория ограничены новым test и этим report. Четыре adopted originals прочитаны полностью, сохранены в scratch и не переписаны. Commit/push, смена ветки, reset/stash, установки, provider calls и браузер не выполнялись. F2/CI/client code не менялись.

## Точный proposal: 5 файлов + report

1. `docs/core/media-reference-handoff.md` — adopt exact original.
2. `docs/core/templates/media-handoff.json` — adopt exact original.
3. `.codex/scripts/validate_media_handoff.py` — adopt exact original.
4. `.codex/scripts/test_media_handoff.py` — adopt exact original; имеет найденную ниже внешнюю test dependency.
5. `.codex/scripts/test_handoff_publication.py` — новый offline publication regression.
6. `docs/research/design-agent-upgrade/rollout/followup-01-handoff.md` — этот report.

Новый production/source helper не создан и для offline validator не требуется. Это **proposal**, не опубликованное исправление и не работающий media pipeline.

### Original SHA-256

| Файл | Original SHA-256 |
|---|---|
| `docs/core/media-reference-handoff.md` | `a087ceb703d309c55fd073652598231e25ad526e318bf645fa1b03e6c67e0e0a` |
| `docs/core/templates/media-handoff.json` | `2004fe80dc61882f07bd3df092acae3771f2e755186667e78139000d963828d4` |
| `.codex/scripts/validate_media_handoff.py` | `21aece625d70bed4581837cbe50812222cea5e4d4e116454aba96fe43b0528b7` |
| `.codex/scripts/test_media_handoff.py` | `51285a87e3aaa07dfffe3a607887494810471f1b9db5c25415d92e54bafc37b0` |

SHA сохранность четырёх originals проверена после regression runs и в repo, и в overlay export.

## Доказательства и воспроизведение

Scratch root: `/Users/germanbryzgalov/.hermes/cache/scratch/handoff-f1-ef9i4e9k/`.

- `source-map.json`: exact HEAD, interpreter, original hashes, commands, overlay allowlist и clean-export path.
- `originals/`: snapshots четырёх файлов.
- `head.tar`: `git archive` exact HEAD, prefixes `.codex .claude docs/core .mcp.json CLAUDE.md docs/projects/README.md docs/projects/.active`; не копия dirty working tree.
- `clean-export/`: исходный archive плюс только five-file candidate overlay.
- `red.log`, `green.log`: фактический финальный RED/GREEN до последней правки isolation, см. revision caveat ниже.
- `checks.json`, `working-*.log`, `clean-*.log`: реальные команды/exit/output.
- `dependency-closure.json`: наличие зависимостей в HEAD/export, состояния пяти role routes.
- `clean-files.json`: per-file SHA inventory проверенного export.
- `changes.json`: полный read-only scope исходного shared dirty checkout.

Использован существующий Python 3.11.15:
`/Users/germanbryzgalov/.local/share/uv/python/cpython-3.11.15-macos-aarch64-none/bin/python3`.
Системный `python3` здесь 3.9.6, не подходит для stdlib `tomllib`; ничего не устанавливалось. TMPDIR — указанный scratch root; `PYTHONDONTWRITEBYTECODE=1`. Node dependency-isolation regression использовал существующий `MOTION_DEPS=/Users/germanbryzgalov/.hermes/cache/scratch/motion-stage04`; browser не запускался.

Команда tracer guard (из соответствующего дерева):

```text
$PY -m unittest discover -s .codex/scripts -p test_handoff_publication.py -v
```

В RED к archive добавлен только новый test, ни один из четырёх originals ещё не overlay:

```text
AssertionError: False is not true : mandatory published dependency missing: docs/core/media-reference-handoff.md
Ran 6 tests in 0.002s
FAILED (failures=9)
exit 1
```

9 failures включают subtests; это 6 test methods. После overlay exact originals:

```text
Ran 6 tests in 0.156s
OK
exit 0
```

Guard проверяет наличие contract/template/validator/adopted tests, mandatory consumers, import closure стандартной библиотеки и реально запускает скопированный validator через `python -I` в disposable cwd. Проверяет fixture dry-run, отказ без dry-run, отказ `fixture:false` даже с dry-run, AI rights, pilot/budget, запрет масштаба и publication gate. `generation_executed` во всех CLI probes обязан быть false.

### Реальная regression matrix (проверенная revision до последней isolation-правки)

| Проверка | Working tree | Exact HEAD + five-file overlay |
|---|---|---|
| Python discover `test_*.py` | 85 tests, OK, exit 0 | 78 tests, **1 failure**, exit 1 |
| Node lint/library/dependency-isolation | 57 pass, 0 fail/skip, exit 0 | 57 pass, 0 fail/skip, exit 0 |
| selftest.py | exit 0, прежний source-freshness WARNING | exit 0, тот же WARNING |
| sync-roles.py (без --apply) | `Drift: none`, exit 0 | `Drift: none`, exit 0 |
| новый guard отдельно | 6 tests, OK, exit 0 | 6 tests, OK, exit 0 |

Node command:
`node --test .codex/scripts/test-design-lint.mjs .codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs`.

Selftest WARNING остаётся `.claude/commands/feature.md`; manifest/source freshness не изменялись. Working GREEN включает чужой baseline и не доказывает GREEN proposal.

### Revision caveat / pending execution approval

После приведённых прогонов внесена только в новый test дополнительная isolation-правка: все `/fixture/` paths в disposable manifest перенаправляются внутрь его temp tree, чтобы negative `fixture:false` probe не мог читать одноимённые абсолютные пути хоста. Четыре originals не менялись.

Повторный запуск final RED/GREEN + всей matrix был отправлен в terminal, но вернулся `status: pending_approval`, `exit_code: -1`, `description: script execution via heredoc`. Он **не подтверждает execution**. Альтернативным инструментом запрет не обходился. Следовательно последние логи, SHA нового test в `source-map.json` и `clean-files.json` относятся к предыдущей протестированной revision нового test, а не к его текущей isolation-правке. Parent должен разрешить pending command либо запустить эквивалент после разрешения, обновить map/manifest и проверить final exact proposal. Не выдавать текущую revision за проверенную.

## Dependency closure: что подтверждено и где блокер

- Validator imports: `argparse`, `json`, `pathlib`, `hashlib`, `re`; только stdlib, schema_version 1 реализован кодом, внешнего JSON Schema/package нет.
- Adopted test imports stdlib, включая `tomllib` (Python >=3.11); validator динамически загружается по существующему repo-relative пути; template читается по repo-relative пути. CLI dry-run и schema/gates реально исполнены.
- Обязательные consumers `.codex/CODEX.md`, `.codex/agents/design/taste-curator.md`, `docs/core/design-surface-workflow.md` в exact HEAD сохраняют reference-handoff obligation. Contract closure разрешается после overlay, gates не удалены.
- `.codex/config.toml`, role MD/TOML и `.codex/skills/nullume/SKILL.md` существуют в HEAD. `tools/nullume/bin/nullume.js` также существует в HEAD, но намеренно вне заданных archive prefixes и F1 offline tests; readiness/generation commands из docs не запускались. Наличие runtime файла не доказывает подключение backend.
- `project.md`, `brand.md`, MASTER, UI-kit, approved originals, rights/vision/native events — per-task inputs и ручные gates, а не поставляемые fixture evidence. Contract явно различает synthetic fixture, documentary validation и реальные права/генерацию.
- **Незамкнута adopted routing test dependency**: `.codex/scripts/test_media_handoff.py:65` требует `docs/core/media-reference-handoff.md` в `config['developer_instructions']`. В HEAD этого нет, поэтому clean suite закономерно красный.
- Далее тот же test на строках 66–75 требует direct contract route и `Codex IDE` для пяти ролей. Проверка actual HEAD content показала отсутствие обоих маркеров во всех пяти MD; синхронные TOML соответствуют этим MD. Это не MD/TOML drift, а отсутствующая расширенная маршрутизация. Исправление только config не гарантирует GREEN.

## Scoped next proposal для parent, НЕ применённый

Не публиковать эти пять файлов с заявлением «все проверки зелёные». Для сохранения adopted test без переписывания его оригинала требуется отдельно разрешённый **минимальный routing delta**, не wholesale foreign baseline:

- `.codex/config.toml`: только обязательное чтение approved contract в developer_instructions.
- По одной согласованной contract/Codex IDE маршрутизации в `.codex/agents/design/{taste-curator,design-department,media-generator,brand-guard,design-reviewer}.md`.
- Соответствующие пять `.codex/agents/{taste-curator,design-department,media-generator,brand-guard,design-reviewer}.toml`: exact sync только этих scoped MD changes.

Эти дополнительные 11 existing paths **не включены** в выполненный five-file overlay и не изменены. Parent должен оценить их семантику относительно уже обязательных gates, не копировать целиком текущие чужие dirty версии. Альтернатива — отдельно согласованная реорганизация adopted routing test, но она противоречит текущему запрету переписывать original и здесь не выполнялась. Skip/ослабление теста ради GREEN не предлагается.

Следующий порядок: разрешить final rerun → independent code/security review exact revision → закрыть найденную F1 routing dependency в отдельно разрешённом scope → повторить clean regressions → parent publication и read-back → только затем F2. Task gate/память вне разрешённых test/report/scratch paths исполнителем не изменялись; независимое ревью и publication принадлежат parent.
