# Stage 05 — isolated surface policy + scoped font exception

## Результат и границы

Локальная реализация проверена; **integration / independent review / publication pending parent**.
HEAD при финальном прогоне: `1b63e10d639d46767ddb3432d3f599f5a6e2ecd8`.
Никаких git writes, клиентских правок, внешних сервисов или новых ролей.
Точный write scope: новый `docs/core/design-surface-workflow.md`, новый
`.codex/scripts/test_design_surface.py`, существующие `.codex/scripts/design-lint.mjs`
и `.codex/scripts/test-design-lint.mjs`, этот `rollout/stage-05-surface-policy.md`.
CODEX, commands, skills, roster/config, каталоги и исходные core MD не изменялись.

- Per-page modes строго Persuade / Operate / Read / Experience по canonical audit:49–58.
  Identity/refinement lock; task-first sequence; copy/voice без invented claims;
  state/onboarding/localization/typography/actual-system extraction intents.
- Global base остаётся authority для safety/a11y/guards; MASTER — для токенов,
  scoped approved page override — только для своей страницы/поля. Mode не отменяет bans.
- Hero/nav/list числа не универсальный hard-fail Read/Operate, но реальные
  clipping/hit-area/a11y defects — blockers. Decorative bounce, inertial spring и
  no-overshoot разделены без отмены существующих guards.
- Temporal packet before/first/mid/last/settled + interrupt/repeat/reduced/offscreen/destroy,
  frame-time и paint continuity; static PNG не выдаётся за motion verification.
- Это core policy, **не утверждение подключения новых workflows**. Routing через
  CODEX/commands/skills и проверку реальных consumers выполняет parent отдельно.

## Минимальная production delta

`forbidden-font` сохраняет Inter/Arial detection и ERROR, но для каждого matched
имени проверяет exact membership в `ds.fonts` существующего `loadDesignSystem`.
При распознанном target projects/tools MASTER должен принадлежать этому target;
даже target без MASTER не может позаимствовать одобрение из чужого active MASTER.
Проверка получает filePath третьим аргументом; прочие rule functions его игнорируют.
Никаких изменений resolution, parser, других RULES/MASTER_RULES, levels или exits.

Это line-based pattern detector, **не AST и не computed WCAG/role detector**.
Exact MASTER-font approval не различает body/fallback/display: новое использование
body font как brand display остаётся предметом ручного identity review. Parser
page overrides не читает. Prose, Inter Tight и lowercase inter не дают Inter approval;
approved Inter не снимает ERROR с unapproved Arial. Legacy default brand seeds сохранены.

## Реальный вертикальный RED → GREEN

Каждый следующий production/document slice добавлен после наблюдаемого RED.
Все CLI fixtures — isolated temporary roots; TMPDIR текущей среды указывает в Hermes scratch.

| Slice | Наблюдаемый RED | Минимальный GREEN |
|---|---|---|
| approved target body/fallback | `target MASTER approved…`: exit assertion `2 !== 0`; 1 test, 0 pass, 1 fail | exact parsed DS-font exception; 1 pass, 0 fail |
| per-page mode + lock | отсутствующий документ: `Surface brief… not found in ''`; 1 fail | mode table и identity/refinement lock; 1 pass |
| task-first/copy intents | `### 1. Intent not found`; 1 fail | последовательность и concrete intent playbooks; 2 tests pass |
| priority/guards/scopes | отсутствующие scope markers; 1 test, 15 failing subtests | additive priority/scopes/protected gates; 3 tests pass |
| temporal evidence | `## Temporal evidence not found`; 1 test, 13 failing subtests | temporal packet + lifecycle matrix; 4 tests pass |
| no foreign approval for target without MASTER | `target without MASTER…`: `0 !== 2`; 1 fail | same-target MASTER check in forbidden-font only; 1 pass |

Дополнительно regression matrix проверяет active-other vs target approved и
unapproved, projects/tools paths, exact case/name, mixed approved+unapproved names,
Arial и prose outside fontFamily. Эти guards в основном подтверждали уже корректное
поведение и не объявляются отдельными RED receipts. При написании Python-теста
была опечатка `: paste` (IndentationError), исправлена **до** RED запуска; она не
используется как свидетельство недостающего поведения.

## Финальные прогоны

- `node --test .codex/scripts/test-design-lint.mjs`: **42 tests, 42 pass, 0 fail,
  0 skipped** (прежние 37 + 5 новых; все 17 legacy rule seeds включены).
- Python 3.14: `-m unittest discover -s .codex/scripts -p 'test_*.py'`:
  **73 tests, OK** (baseline 69 + 4 новых policy contracts), 12.355s.
  Interpreter: `/Users/germanbryzgalov/.hermes/installs/85f1f94234f7e14a/environments/2cb3796150ef4be4b476ddcadb93d64d/venv/bin/python3.14`.
- Mutation check в отдельной scratch-копии: **12/12 caught**. Удаление каждого
  clarify/harden/onboard/typeset/polish/critique/extract-refresh marker вызывает
  assertion failure; отдельно ловится удаление пяти core guard markers
  (44×44px, purple-blue seed, wrapper import, damping default, revision).
  Это проверка static contract coverage, не доказательство runtime capabilities.
- `git diff --check` на обоих изменённых lint files: exit 0.
- Byte-preservation проверка: восстановление только нового forbidden-font block
  и третьего аргумента даёт исходный SHA256 **всего** lint-файла; удаление только
  нового contiguous test блока даёт исходный SHA256 **всего** test-файла.
  Следовательно старые RULES, все прежние tests, hints/levels/seeds не переписаны.

## Payload SHA256 (отчёт исключён из собственного хеша)

| Файл | SHA256 |
|---|---|
| `docs/core/design-surface-workflow.md` | `5444b227d3a4a10393542c6af9926cc17934ff6d2eaccdaaf2058f99ee71bcbb` |
| `.codex/scripts/test_design_surface.py` | `e64f0c69f0f71a83721d5dd9cba357c71fd9ff5a3d1f25469546481e658a2f4a` |
| `.codex/scripts/design-lint.mjs` | `b7a9dfc9fbc8e47e4c7f2f672b8942d8978ebf92e3fab44529498b9f8d5177f6` |
| `.codex/scripts/test-design-lint.mjs` | `d45b50a7b728d4c1794f725c72b688e72b5c791acfcda998232444858b81b05e` |

## Protected files: before = after на момент проверки

| Файл | SHA256 | Статус |
|---|---|---|
| `.codex/CODEX.md` | `aa968e63a56935b0302318229244412e3345cf5ce1918f97f83a07ff6c736a4c` | unchanged |
| `.codex/commands/design-system.md` | `f75fadb6ae80dbe762f9955b22d7ad6c359f5b0a79155199a23889492ebac9bd` | unchanged |
| `.codex/skills/design-system/SKILL.md` | `31cb027960a4175d8cff1014de81d78859e40b7b7232c433f1a8e2c72b5470de` | unchanged |
| `docs/core/design-principles.md` | `14bc9be975a8b2227fb93b7633a1f107efd57a7fe64a94c2333ba12daf7f087f` | unchanged |
| `docs/core/motion.md` | `7cc3cf39a0e1d4ed8b4c1be6ef5e13f88f5a183fb92a46ed309a7781d6dcab15` | unchanged |

## Receipts и воспроизводимость

Полные raw outputs находятся локально в
`/Users/germanbryzgalov/.hermes/cache/scratch/`; hashes ниже фиксируют именно
фактические результаты, не синтетический вывод. Этот MD сохраняет существенные
RED assertions и GREEN totals; raw scratch не обещан как опубликованный artifact.
Финальные suites можно повторить командами выше. Policy mutation probe копировал
только документ, тест и три защищённых MD в TemporaryDirectory под scratch;
оригиналы не менял. Сохранён JSON результата каждого mutant.

| Receipt в scratch | SHA256 |
|---|---|
| `surface-font-red.txt` | `837e58a0b87cc367ef8fd65f8f9e78556c0d4cccb6ac38fe932aa4eea55fa14d` |
| `surface-font-green.txt` | `35d6abf17550ae880d72299085dd1cabd231bcf0ae7765ba03a34677a3c07eec` |
| `surface-no-master-red.txt` | `01cb4a80c49564682ab2ba7b0b05a1fcfd103760d0c1d208f8331cb1837fad59` |
| `surface-no-master-green.txt` | `fc136f85e55534a7404a5978da06f22c9a55398891d9a0b16de49313a77cceff` |
| `surface-modes-red.txt` | `da85f38d8740dc636990707bd2c98245c5cf9dfc158e7523911e2c8f83f26926` |
| `surface-modes-green.txt` | `fb184ea57734512b1f088f9181209901b9cd46df3eb7eaa2500ea9e48dde20b5` |
| `surface-workflow-red.txt` | `d0c3d03164f2799b06c7d92360a316d5403f287d82fa01fa3455bf84f46b5a92` |
| `surface-workflow-green.txt` | `fe008aab760eb03ccac7578e2b84665b1b50b0d7f855b17a0c7a8d039435b658` |
| `surface-scopes-red.txt` | `06d159e8c5cdb4bafabe016bddddd519e54fd6aad60c5b25d480c2172bce8e39` |
| `surface-scopes-green.txt` | `921b60a7fd52e978fbb551cacd29df2d6708879400278e1fcc70fceeb0c6f8e0` |
| `surface-temporal-red.txt` | `f3f142aa7a38f81a43bcb654cf7229a39db25a31aea8ea971e54164dbe1da2c8` |
| `surface-temporal-green.txt` | `feabb4add9e2ca3374e538560634d1ec97dc4f4ce89aab12f3d726e36ea9b2f6` |
| `surface-node-green.txt` | `9c91ab31cf7382dcf3026a61a3e4ddae80279a4bdee3b61af0a3770df6a440ef` |
| `surface-python-green.txt` | `31334fbb7ed38411470bd77b8dafd2ed43747e79d066bcd1ee0024ee785da67a` |
| `surface-mutations.json` | `c8fd5682543fa92941e9640abc144b13488533f74d551646fb96842301b09505` |
| `surface-hashes.json` | `bc03f0a3910c564bd4d1febbf73a0f6353427edf41b6cc2545402c39344b9d5a` |

## Осталось координатору

Независимое code/policy/security review текущего scope; подключение потребителей
и integration tests с CODEX/commands/skills; затем разрешённое пакетирование и
публикация. Самопроверка leaf не названа независимым review. Owner visual acceptance
клиентского UI, реальное motion performance и внешние интеграции этой дельтой не
проверялись и не объявляются PASS. Подтверждённых локальных test failures не осталось.
