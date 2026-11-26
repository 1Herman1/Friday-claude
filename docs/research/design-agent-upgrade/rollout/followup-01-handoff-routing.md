# F1b — минимальная маршрутизация handoff: проверенный proposal

## Verdict

**Технический GREEN точного clean proposal; НЕ публикация и НЕ независимое ревью.**
Реально повторены final RED → GREEN для текущей isolation-revision guard и
RED → GREEN дополнительной routing dependency без изменения adopted test.
Parent выполняет независимое code/security review, merge/publication и read-back
перед F2. F2 не начат. Исполнитель — adapted Hermes coder, не native Codex.

Единственная запись в исходном репозитории этим исполнителем — этот новый report.
Все 11 existing dirty routing files, четыре adoption originals и текущий
`test_handoff_publication.py` **не переписывались**. Source-work hashes проверены
до и после прогонов, HEAD не изменился: `e9e31fd5b80f48729a87823409c966f9c2b36d42`.
Не выполнялись commit/push/reset/stash/checkout/создание ветки, установки,
provider calls, клиентские правки, browser/window actions. Тесты используют
локальные disposable fixtures; никакого изменения Git исходного checkout.
Task gate/память вне разрешённого report не записывались; координация и review у parent.

## Proposal и защита от чужого dirty baseline

Scratch: `/Users/germanbryzgalov/.hermes/cache/scratch/handoff-f1b-kyg_j6xg/`.

- `head.tar` и `head-source/` получены из **actual git HEAD**, не dirty файлов.
- Archive prefixes: `.codex .claude docs/core .mcp.json CLAUDE.md docs/projects/README.md docs/projects/.active`.
  Это export для offline suite, не полная поставка клиентских проектов/Nullume runtime.
- `source-work/` — read-only-for-publication снимки 16 исходных файлов для guards,
  **не** источник wholesale routing publication.
- `proposal/` — 11 новых минимальных HEAD-based routing contents с исходными путями.
- `proposal.json` — JSON path → proposed full content; SHA-256
  `109d29c96f3bdd18880d1078c89dd33364e282cdab2433c77cd0d8afd9d944a9`.
- `proposal.diff` — exact HEAD delta, SHA-256 `47580dd833a329ef27e0f17d1b2a83d3814de42c8576163a0bd874244ae67e07`.
- `manifest.json` — HEAD, per-path `source_work_sha256`, `head_sha256`,
  `proposal_sha256`, interpreter, команды/environment и archive SHA.
- `clean-export/` — exact archive + пять F1 файлов + 11 scoped routing proposals.
- `clean-files.json` — полный проверенный per-file SHA inventory export.
- `checks.json`, `*.log`, `verification.log` — реальные результаты и hashes логов.
- `prepare_f1b.py` лежит в родительском scratch; `build_proposal.py` и
  `verify_proposal.py` — только scratch helpers, не предлагаются в runtime/repo.

Programmatic archive-vs-export проверка: **ровно 5 additions, 11 modifications,
0 removals**. Все прочие байты archive сохранены. У всех пяти TOML изменено
только `developer_instructions`; остальные поля сохранены и сравнены через
`tomllib`, текст вне developer-value не переписан. Config изменён только в
`developer_instructions`.

### Семантика минимального delta

Config: добавить обязательное чтение contract и Codex IDE execution route.
Каждая из пяти MD: один 12-line routing block, actual tool discovery/blocker,
приоритет AI-input rights → один пилот с бюджетом → owner acceptance → отдельный
scale approval → explicit production/embedding approval. Gates не расширены
на все обычные media-задачи. Все остальные инструкции четырёх MD сохранены.

`media-generator`: дополнительно заменить один старый introductory paragraph,
который безусловно направлял все изображения/видео/аудио в Artlist. Теперь native
Codex images и existing Nullume → KIE video только после readiness/inputs/rights/
budget; музыка/озвучка остаются отдельной backend/format/rights/budget проверкой,
недоступность — blocker, не удаление возможности и не silent provider fallback.
Исторические Artlist style-kit/upload/model/status/balance правила сохранены,
но явно условны: только реально доступный и разрешённый Artlist **вне** этой
reference-handoff цепочки. Для native/Nullume бренд-кит сохраняется как palette,
rules и разрешённые originals во входах. Не выдуманы tools, доступ или бесплатность.
Ограничения голоса, прав, экономии, brand-guard pairing и read-only review сохранены.

**Сохранённое legacy поле:** description media-generator в config/TOML всё ещё
исторически упоминает Artlist. Это HEAD metadata, намеренно не переписанное по
условию «сохранить все другие TOML fields»; conditional developer-body уточняет
фактическое исполнение. Это не доказательство подключённого Artlist.

### SHA-256 11 proposed contents

| Path | Proposed SHA-256 |
|---|---|
| `.codex/config.toml` | `282643dceb754c2644f2298cb7bcfeef7dc72a1ac540360f2dcb32cd6fff1ff5` |
| `.codex/agents/design/taste-curator.md` | `53cedda38d3a079f285040e736295e917ab5936c8656e7d4568cc96d02e9dcab` |
| `.codex/agents/design/design-department.md` | `19e9829e0d541512b3e57787701a0f22a8ce8ea7376dae81c85125045f2d16ce` |
| `.codex/agents/design/media-generator.md` | `015ddfa039a61d6223a8828035f7e46d371c7b3806f9e8ce8bc709dc59e1bd43` |
| `.codex/agents/design/brand-guard.md` | `eee1481fe25e97a16f404ffa6ed841e5b950f4b47bb18656eaec3b58a2c21e3a` |
| `.codex/agents/design/design-reviewer.md` | `547b4bbe2dde372ada4f017c518b301a1ff65d501c996bb6e51a6a8f632dec4f` |
| `.codex/agents/taste-curator.toml` | `395f01ee61cd226bf46773b3765c1ef1b3872a25e9d55e81d62740bcc96160c7` |
| `.codex/agents/design-department.toml` | `04234cf0c5a184cc85755c78aa6a5dd86e2a9e00eae3a15aa53a890d80206595` |
| `.codex/agents/media-generator.toml` | `0c55f4d5384aa0a7a18b74930e6d29bff972d2e4a205ad38fe62a65961334702` |
| `.codex/agents/brand-guard.toml` | `e19414eadf15d194d983ec1f975bd4d6d3995fa3d1fda48e82b41dc51a279f08` |
| `.codex/agents/design-reviewer.toml` | `dcfbd08c27862126c4978231a8890035ce04411f10a883dac16bfbddfd5c9904` |

### Неизменяемые adoption files и final guard

| Path | Source-work = clean-overlay SHA-256 |
|---|---|
| `docs/core/media-reference-handoff.md` | `a087ceb703d309c55fd073652598231e25ad526e318bf645fa1b03e6c67e0e0a` |
| `docs/core/templates/media-handoff.json` | `2004fe80dc61882f07bd3df092acae3771f2e755186667e78139000d963828d4` |
| `.codex/scripts/validate_media_handoff.py` | `21aece625d70bed4581837cbe50812222cea5e4d4e116454aba96fe43b0528b7` |
| `.codex/scripts/test_media_handoff.py` | `51285a87e3aaa07dfffe3a607887494810471f1b9db5c25415d92e54bafc37b0` |
| `.codex/scripts/test_handoff_publication.py` | `811c2a79e40b1591faf15332d77e7920efc4ab40c1658cd214ee66fbc1791db4` |

Четыре adoption hashes совпали с parent baseline
`/Users/germanbryzgalov/.hermes/cache/scratch/design-followup-_9uk291c/baseline.json`.
Изоляционная правка guard (`/fixture/` → disposable missing-path prefix) не
менялась; именно эта revision реально исполнена во всех новых прогонах.

## Реальные проверки — final revision

Python: `/Users/germanbryzgalov/.local/share/uv/python/cpython-3.11.15-macos-aarch64-none/bin/python3` (3.11.15).
Для прогонов `TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch/handoff-f1b-kyg_j6xg` и `PYTHONDONTWRITEBYTECODE=1`.
Node dependency-isolation: существующий
`MOTION_DEPS=/Users/germanbryzgalov/.hermes/cache/scratch/motion-stage04`.
Установок и запуска браузера нет. Все команды реально завершились; pending
approval не считался PASS и в этих новых вызовах не возникал.

| Stage / command | Actual result | Log |
|---|---|---|
| HEAD + только final guard | 6 methods, 9 assertion failures (subtests), exit 1; missing contract/validator | `red.log` |
| + четыре exact adoption files, только guard | 6 tests OK, exit 0 | `adoption-green.log` |
| Тот же adoption export, whole Python | 78 tests, 1 failure, exit 1: adopted test line 65, missing config route | `routing-red.log` |
| + 11 minimal proposed routes, whole clean Python | **78 tests OK, exit 0** | `clean-python.log` |
| Final guard отдельно, clean | **6 tests OK, exit 0** | `final-guard.log` |
| Final dirty working Python (без publication) | **85 tests OK, exit 0** | `working-python.log` |
| Clean Node regression | **57 pass, 0 fail, 0 skip, exit 0** | `clean-node.log` |
| Clean selftest | exit 0; 45 source roles + codex-docs, 22 skills, 5 lifecycle events, 3 MCP configs; 90 mappings | `clean-selftest.log` |
| Clean sync-roles, БЕЗ --apply | `Drift: none`, exit 0 | `clean-sync.log` |

Оставшийся **прежний selftest WARNING**: source freshness `.claude/commands/feature.md`.
Это не устранено и не объявлено чистой freshness-проверкой; source manifest и
Claude files не менялись. Разница 85 vs 78 обусловлена dirty working baseline:
working PASS не заменяет clean proposal PASS.

Команды из корня соответствующего дерева:

```text
$PY -m unittest discover -s .codex/scripts -p test_handoff_publication.py -v
$PY -m unittest discover -s .codex/scripts -p 'test_*.py' -v
node --test .codex/scripts/test-design-lint.mjs .codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs
$PY .codex/scripts/selftest.py
$PY .codex/scripts/sync-roles.py
```

Selftest дополнительно вызван отдельно и вернул exit 0, чтобы составная команда
selftest+sync не могла скрыть его exit status. Все counts сверены кодом с логами.

## Границы кода и доказательств

Полностью прочитаны CODEX, coder role, review-loop, предыдущий F1 report и все
четыре adoption files; строки adopted test 65–75 сохранены без skip/ослабления.
Validator imports — только argparse/json/pathlib/hashlib/re; он читает явно
заданные manifest/files и hashes, не вызывает shell, сеть, provider, eval/exec
или генерацию. JSON template целиком synthetic, не реальные права/изображения.
Adopted tests import stdlib и локальный validator; CLI probes — локальный Python.
Новый guard AST-проверяет stdlib closure и копирует validator в disposable cwd,
запускает `python -I`; fixture:false paths остаются внутри этого temp tree.
Его subprocess — только этот локальный CLI, не сеть/provider. Импорт validator
через importlib исполняет проверенный локальный module, не входной manifest-код.

Routing proposal — только инструкции/TOML values, новых executable hooks/helpers,
network calls или provider authorities не добавляет. Документированные readiness
и generation команды не запускались. Offline GREEN **не** доказывает реальность
rights/vision/owner evidence, native refs fidelity, backend entitlement, generation,
quality/owner acceptance или то, что открытая Codex IDE перечитала config.

## Перед publication / F2

Parent независимо ревьюит exact `proposal.json` + пять F1 файлов по hashes.
Перед записью сверить **actual HEAD и каждый source-work guard** с manifest;
при несовпадении остановиться и разобрать изменения, не overwrite dirty file
proposal целиком. Применять только minimal HEAD delta с сохранением чужого
незавершённого содержимого; proposed full contents — артефакт clean проверки,
а не разрешение затереть shared dirty versions. После merge проверить синхронность,
целевые hashes/semantic diff и заново тестировать фактическую published revision.
Независимое review/publication/read-back пока не выполнены этим исполнителем.
