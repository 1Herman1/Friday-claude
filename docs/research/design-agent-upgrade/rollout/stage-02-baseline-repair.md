# Stage 02 — baseline repair

## Результат и границы

Шесть диагностированных baseline-падений устранены: четыре lifecycle failures относились к неканоническому fixture ROOT; два parity failures — к отсутствующему reviewed crosswalk и устаревшей безусловной проверке «сэр». Отдельно устранён реальный конфликт config/startup с уже действующим условным правилом CODEX.

Приоритет current CODEX задан владельцем этой задачи. Политика общения не изменена: identity Гермес; новый чат «Привет, Гермес!»; обычная беседа «Гермес», сложное объяснение «сэр»; собранность, уважение, краткость и инициатива сохранены. CLAUDE.md и .claude/ не изменялись. Сам CODEX.md, role payloads, manifest и design-lint этим исполнителем не менялись. Git-записей в общем checkout нет; штатные unittest создают Git repositories только в disposable scratch fixtures.

Изменены только:
- `.codex/scripts/test_lifecycle.py`: resolve() в двух setUp и unborn fixture; новый canonical-root invariant и проверка actual startup output.
- `.codex/scripts/lifecycle.py`: только строка startup instruction, без изменений routing/containment/cache/parser.
- `.codex/scripts/test_content_parity.py`: reviewed owner-adaptations contract; расширенные deletion mutants; вместо устаревшего абсолютного обращения — identity/greeting/оба контекста/тон/инициатива/config-reading contract. Все invalid/empty adaptation guards сохранены.
- `.codex/content-parity.json`: только три добавленные adaptations для source 357–358, 377, 875; точные frozen source_text, явная причина intentional source/current différence, непустые requirements на оба обращения и сохранённый тон/инициативу.
- `.codex/config.toml`: только developer_instructions; все остальные bytes сохранены относительно entry snapshot.
- этот отчёт.

## RED → minimum GREEN

Все команды Python выполнялись через `sys.executable` Hermes Python 3.14, `-B`, `PYTHONDONTWRITEBYTECODE=1`. Рабочий каталог `/Users/germanbryzgalov/Friday-claude`. TMPDIR только внутри `/Users/germanbryzgalov/.hermes/cache/scratch/`: `stage02-real` и `stage02-alias -> stage02-real`.

Логи ниже находятся в `/Users/germanbryzgalov/.hermes/cache/scratch/`:

| Вертикальный цикл | RED до исправления | Минимальный GREEN |
|---|---|---|
| `test_fixture_root_is_canonical_like_production` | `stage02-root-red.log`: 1 test, 1 failure; alias path != resolved path | Только resolve() fixtures; `stage02-root-green.log`: все 18 lifecycle tests OK, исходные assertions сохранены |
| `test_owner_adaptations_preserve_conditional_address_and_tone` | `stage02-adaptation-red.log`: 0 owner adaptations вместо 3 | Только три precise ledger entries; `stage02-adaptation-green.log` и `stage02-crosswalk-green.log`: каждый focused test OK |
| `test_owner_identity_in_effective_instructions` | `stage02-config-red.log`: greeting отсутствует в actual parsed developer_instructions | Только developer_instructions; `stage02-config-green.log`: OK |
| `test_startup_preserves_current_owner_policy` | `stage02-startup-red.log`: actual isolated startup output теряет greeting/conditional contexts/tone/initiative и содержит старое absolute правило | Только startup instruction; `stage02-startup-green.log`: OK |

Focused команда: `[sys.executable, '-B', '-m', 'unittest', 'discover', '-s', '.codex/scripts', '-p', TEST_FILE, '-k', TEST_NAME]`. Lifecycle startup проверялся на изолированном ROOT, не запускался hook общего checkout.

Первичный full run этого исполнителя (`stage02-baseline-alias.log`) застал параллельную разработку routing tests: 66 tests, 14 failed assertions/subtests и 1 error. Это не выдаётся за прежний baseline 62: дополнительно падали новые routing tests, которые исправлял parent вне моего scope. Исходные шесть симптомов присутствовали. Диагностический receipt исходных 62 сохранён в `baseline-diagnosis-unittest.log`.

## Финальная проверка

Команда: `[sys.executable, '-B', '-m', 'unittest', 'discover', '-s', '.codex/scripts', '-p', 'test_*.py', '-v']`.

- `stage02-final-canonical.log`: **69 tests, OK**, 14.158 s, exit 0.
- `stage02-final-alias.log`: **69 tests, OK**, 14.158 s, exit 0.
- Сопоставление имён tests из `baseline-diagnosis-unittest.log` с финальным verbose log: **все исходные 62 сохранены**, missing set пуст. Добавлены 3 tests этого repair и 4 параллельных routing tests. Ни skip, ни удаления tests нет.
- `node --test .codex/scripts/test-design-lint.mjs`: **37/37 pass**, 0 failures/skips; `stage02-node37.log`. Код и tests lint этим исполнителем не изменялись.
- `[sys.executable, '-B', '.codex/scripts/selftest.py']`: exit 0; **45 original roles + codex-docs**, native prompt sync, 90 source mappings, TOML/JSON/script syntax PASS; `stage02-selftest.log`. Сохранён существующий warning freshness `.claude/commands/feature.md`; source/manifest вслепую не обновлялись.

Исходные проверки пяти необычных путей, journal вне projects/, patch hash, двух failed-lint retries и external path exclusion остались и проходят на alias TMPDIR. Production ROOT остаётся `Path(__file__).resolve().parents[2]`; новый тест независимо импортирует production module и проверяет этот invariant.

## Mutation evidence

`stage02-mutations.json`: **18 из 18 deletion mutants пойманы assertion failures без errors**. Для каждой из трёх поверхностей — parsed config developer_instructions, actual startup additionalContext, CODEX crosswalk — отдельно удалялись:

1. `Гермес` (identity),
2. `«сэр»` (сложное объяснение),
3. `Привет, Гермес!` (greeting),
4. `собранным`,
5. `уважительным`,
6. `инициативно`.

Config/startup mutants выполняли настоящие regression methods с in-memory подменой только проверяемого текста, без записи mutation в репозиторий; CODEX deletion использовал настоящий crosswalk checker и ledger. Расширенный постоянный crosswalk mutation test сохраняет также все предыдущие deletion checks. Существующий invalid adaptations test с empty/malformed requirements, bounds, source_text и reason проходит неизменённым.

## Точный own patch и чужое dirty-состояние

Публиковать только hunks исполнителя, **не весь git diff dirty-файлов**.

- Точный unified patch пяти изменённых существующих файлов: `/Users/germanbryzgalov/.hermes/cache/scratch/stage02-own.patch`.
- SHA-256 before/after и paths: `/Users/germanbryzgalov/.hermes/cache/scratch/stage02-own-patch-manifest.json`.
- Полные entry snapshots: `/Users/germanbryzgalov/.hermes/cache/scratch/stage02-own-before/`.
- Для dirty `.codex/config.toml`, `.codex/scripts/lifecycle.py`, `.codex/scripts/test_lifecycle.py` entry snapshot **byte-identical** соответствующим файлам `/Users/germanbryzgalov/.hermes/cache/scratch/design-rollout/before/`; следовательно own patch точно относительно требуемого before.
- `test_content_parity.py` и `content-parity.json` были существующими untracked файлами и в `design-rollout/before/` отсутствовали. Для них patch построен относительно полного entry snapshot, не как создание с нуля: прежние assertions/ledger сохранены. Этот отчёт — единственный новый repo-файл моего scope.
- Проверено программно: относительно entry snapshot production config и lifecycle меняют ровно по одной строке и сохраняют число строк. Никакие соседние config изменения не включены в own patch.

## Ограничения / handoff

Это проверка файловой конфигурации и isolated startup, не доказательство reload уже открытого Codex IDE или live firing native hooks. Независимое ревью и публикация принадлежат parent; этот отчёт не подменяет их self-approval. Существующий source-freshness warning остаётся явно открытым вне baseline-repair scope.
