# F3 — восстановление feature и проверенный receipt

## Результат и границы

Исполнитель: Hermes subagent, адаптированная роль `.codex/agents/core/coder.md`,
не нативный Codex и не независимый reviewer. База:
`0a7af7680f490ad6c738f454810c46fd25caa39d`, ветка `claude/greeting-nnz368`.
Восстановлена цепочка `$feature` → `new-feature.md` → неизменённый
`review-loop.md`. Исправлен только source_sha256 одной записи feature после
сопоставления требований и GREEN семантического теста. Независимое ревью и
публикация принадлежат координатору; этот отчёт их не подменяет.

Разрешённый delta: `.codex/skills/feature/SKILL.md`,
`.codex/workflows/new-feature.md`, `.codex/migration-manifest.json` (одно поле),
новый `.codex/scripts/test_feature_migration.py`, этот отчёт. Git writes,
push/reset/stash/checkout, Claude/config/role/selftest/client/CI/backend/browser
изменения не выполнялись. Ранее грязные файлы не включены в clean export.

## Реальная Git provenance (не доказательство согласия автора/владельца)

Проверены `git log --all`, `git blame`, `git show` для source и обоих targets.

- Миграция: `1c41295b787a154950da03d53ef034cdb1d27c2e`,
  2026-11-07T23:43:38+03:00. Skill содержал runtime adapter и объяснение
  `$ARGUMENTS`, но не саму цепочку source. Workflow сохранял подробные шаги.
- Усиление: `567209de81642cbcf384a5f146bedd93a76712b0`,
  2026-11-09T23:41:07+03:00. Оба targets заменены generic review-loop;
  текущие до F3 bytes совпадают с этой revision. Усиление независимого ревью,
  полного scope, повторных проверок и gate сохраняется, не откатывается.
- Source `.claude/commands/feature.md` — 1455 bytes, 19 строк. SHA-256
  `1b52ca3e9caf7208008f3bea0a5416db6d5476483623067a9ba659c9f2a39132`
  одинаков в migration, review-loop commit, HEAD и working before/after F3.
  Поэтому предупреждение НЕ доказывало изменение source после миграции.
- Manifest feature receipt был empty-file hash
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Он заменён реальным frozen source SHA, не force-freshness обходом.
- Blame: описание/brief/route/planner/researcher/review — `a4acbcdbf`;
  conditional architect/project stack — `be4318524`; QA/build/E2E —
  `e6736f60c`; рабочая ветка — `2e1aa1fd4`. Авторство/commit message
  не трактуются как отдельное согласие пользователя.

## Полный semantic crosswalk

Обозначения: C — `.claude/commands/feature.md`; W —
`.claude/workflows/new-feature.md`; S — target feature skill; N — target
new-feature workflow; R — неизменённый review-loop. Номера source строк
относятся к фактически прочитанным файлам, target пункты — к F3.

| Source obligation | До F3 / практический дефект | F3 target / классификация |
|---|---|---|
| C1–4 metadata, описание и hint | generic skill не описывал конкретную цепочку | S metadata сохранена; описание фичи из пользовательского запроса: native adaptation |
| C6 `$ARGUMENTS` | generic «задача» | S: явный user brief, без выдуманного Codex substitution API |
| C8 follow workflow | S шёл только в generic R; N был дубликатом | S явно «Следуй N»; N явно «Следуй R»: реальный маршрут |
| C10, W8–11 planner, декомпозиция, файлы, риски, понятный план/критерии | researcher предшествовал planner | N1: planner первым, план/критерии до реализации |
| C11, W13–16 researcher, аналоги, интеграции, архитектура, все затронутые файлы, handoff | исчезли explicit аналог/интеграции/15 | N2: восстановлено; native researcher вместо Claude Explore |
| C11 лимит 15 | отсутствовал | N2: лимит только initial similar-logic research. Исходная W14 требует все затронутые файлы; R требует full review. Это согласование областей, не cap обязательного ревью или явно исчерпывающего аудита |
| C12 conditional architect БД/API, схема, route contract, project stack | planner/architect слиты, условие неявно | N3: отдельный conditional architect после research; project.md |
| C13, W18–21 coder, контекст+план, минимальный код, стиль/стек/rules | generic coder, нет явного project stack/rules | N4: всё восстановлено, плюс текущий TDD, без лишних функций |
| C14, W23–28 parallel file-type reviews | generic profile reviewers | N5: TS/React/DB predicates, code-reviewer quality/security/fallback; parallel waves сохраняют лимит слотов |
| C14, W32 silent failure | в R только critical; source требовал для feature | N5: silent-failure-hunter явно для feature |
| C15–16, W35–38 QA для денег/доступа/инвариантов, stock/idempotency | generic «проверки» | N6: explicit automated coverage, stock/idempotency; ручной сценарий для остального, если ТЗ/R не требуют больше |
| W38 «вёрстку тестами не покрываем» | newer loop требует все критерии | N6: не вводится blanket запрет тестов UI вопреки newer обязательной верификации; manual достаточен лишь при отсутствии дополнительных требований |
| C17 build и key E2E | исчезли explicit obligations | N7: сборка и ключевой E2E обязательны, реальные команды/результаты, skip не pass |
| W30–32 исправить замечания | strengthened generic loop уже был | N8 + R: findings → correction → current revision retest/review до всех критериев/нулевых открытых дефектов |
| C19, W33 commit/push после проверки | generic «по правилам» | N9: память → scope → gate complete → commit/push после проверки; project.md + актуальный единый registry, без новых веток |
| Новые обязательства 567209de и текущего R | нельзя откатывать ради source parity | N intro/5/8/9: full staged/unstaged/untracked/deleted/committed scope, независимость, secrets scanner/fallback, gate, Codex memory, post-publication verification |
| Runtime/permissions | source Claude notation не предоставляет tools/approval | N intro/final: доступный spawn или blocker, leaf не рекурсирует; запреты commit/push/deploy, бюджет/права/pilot/owner acceptance приоритетны |
| Source blank lines/headings | не являются отдельным поведением | Новая каноническая структура вместо duplicate generic loop; требования не исключались пустой adaptation record |

## TDD и mutation evidence

1. Написан первый тест `test_invoked_feature_preserves_source_obligations`.
   RED: 1 test, 1 failure — source-specific N недостижим из S.
   После минимального восстановления S/N: GREEN 1/1.
2. Добавлен receipt tracer bullet. RED: 4 tests, 2 failures — stale feature
   receipt (обычный тест и precondition hash mutation); semantic/mutation tests
   уже GREEN. Только после проверки crosswalk исправлено одно manifest поле.
3. GREEN: 4/4. Negative fixtures — реальные изолированные файлы, не mocks:
   удаление build, E2E, conditional architect, silent-failure, gate complete,
   запрета публикации, owner acceptance, secrets scanner, S→N, N→R и shared
   post-publication rule. Отдельно удалены реальные N/R/task_gate/changes/registry
   dependencies. Hash mutant возвращает empty-file hash и реально отклоняется
   тем же check_receipt. Всего 17 negative probes (11 rule/route + 5 dependency
   + 1 hash), не 17 самостоятельных unittest cases.

Это статический instruction regression + семантическое чтение, не доказательство
исполнения нового продукта, build/E2E клиента, нативного spawn, reload IDE,
работы hook runner или независимого review. Пустые/недостижимые документы не
выдаются за работающий маршрут.

## Фактическая верификация

Scratch: `/Users/germanbryzgalov/.hermes/cache/scratch/f3-feature/`.
Python 3.14.9 из уже установленного Hermes tools; системный python3 3.9.6
не использован для tomllib suites. Ничего не устанавливалось.

| Проверка | Before | After working | After clean |
|---|---:|---:|---:|
| Python unittest discovery `test_*.py` | working 86, clean 79 | 90 PASS | 83 PASS |
| Node design-lint + design-library + motion-dependency-isolation | clean 64 PASS | 64 PASS | 64 PASS |
| selftest.py | PASS, одно feature freshness warning | PASS, warning отсутствует | PASS, warning отсутствует |
| sync-roles.py (без --apply) | Drift: none | Drift: none | Drift: none |
| git diff --check | — | PASS | exported payload unchanged |

Команды: `PYTHONDONTWRITEBYTECODE=1 <python3.14> -m unittest discover -s
.codex/scripts -p 'test_*.py'`; `node --test .codex/scripts/test-design-lint.mjs
.codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs`;
`<python3.14> .codex/scripts/selftest.py`; `<python3.14> .codex/scripts/sync-roles.py`.
Node использует существующий `MOTION_DEPS=.../.hermes/cache/scratch/motion-stage04`;
browser не запускается. Final logs: `final-{working,clean}-{python,node,selftest,sync}.log`.
RED: `red-semantics.log`, `red-receipt.log`; initial GREEN: `green-semantics.log`.

Встреченные операционные ошибки: первый расширенный wildcard Node run захватил
лишний standalone motion contract и получил 64/65 (нет MOTION_DEPS). После чтения
документированной команды и explicit existing dependency prefix required 64/64
в обоих деревьях. Первые scratch receipts попали под фактический process TMPDIR,
не совпадавший с объявленным; весь собственный scratch перенесён в указанный
Hermes scratch, финальные suites используют явный TMPDIR. Никакой такой сбой
не объявлен PASS и не исправлялся изменением production/selftest.

## Clean export и точные hashes

`git archive HEAD` с prefixes `.codex`, `.claude`, `docs/core`,
`docs/research/design-agent-upgrade`, `.mcp.json`, `CLAUDE.md`,
`docs/projects/README.md`, `docs/projects/.active`; overlay только четырёх
implementation/test файлов выше. Этот ledger добавляется отдельно и не является
исполняемой зависимостью. Scratch `export-manifest.json` содержит base/prefixes/SHA.

| Overlay | SHA-256 |
|---|---|
| `.codex/skills/feature/SKILL.md` | `59f87be4e140e63f1be0d728024b3b30fd5db24f2a8adb39845058cbad716225` |
| `.codex/workflows/new-feature.md` | `d34caee60ebe76d4b1b44db7221c4250929ac538f12cd1df4522ccc440347330` |
| `.codex/migration-manifest.json` | `d5ad620c39c5eecdc3b44e58d997c43333134a54d43513d3a3790c874ad0f247` |
| `.codex/scripts/test_feature_migration.py` | `cdb143b5e32c6419e72949d20dbb0fe3c21e23e7e7e86f36844faf1ee92fc77c` |

JSON comparison before/after: ровно `files[59].source_sha256` изменён;
все остальные 89 entries и manifest metadata сохранены. Source frozen SHA
before/after одинаков; `git diff HEAD -- .claude` пуст. Selftest не редактировался.
Manual gates и внешние разрешения сохранены; independent review/publication
ожидаются от координатора, не заявлены выполненными исполнителем.
