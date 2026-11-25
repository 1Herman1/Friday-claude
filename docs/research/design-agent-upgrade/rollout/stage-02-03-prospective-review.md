# Независимое ревью materialized prospective stage02+03

## Verdict

**PASS для frozen prospective scope. Критичных проблем не обнаружено.**

Роль: code-reviewer, независимый Hermes subagent; reviewer ID: `stage0203-independent-z9wiimec`. Прочитаны `.codex/agents/review/code-reviewer.md`, `.codex/CODEX.md`, `.codex/workflows/review-loop.md` и `rollout/publication-ownership.md`. Это ревью точных prospective bytes, не текущего dirty checkout и не финальных stage05 additions parent.

## Revision и воспроизводимые артефакты

- HEAD до и после проверки: `1b63e10d639d46767ddb3432d3f599f5a6e2ecd8`.
- Исходное предложение: `/Users/germanbryzgalov/.hermes/cache/scratch/design-rollout/publication-proposal.json`.
- Frozen copy: `/Users/germanbryzgalov/.hermes/cache/scratch/stage0203-independent-z9wiimec/proposal.json`; SHA-256 `1ea50c398d9fa9e69a62ee15e4570841c482485452e27cdd01443310aabced16`.
- **Exact export:** `/Users/germanbryzgalov/.hermes/cache/scratch/stage0203-independent-z9wiimec/export`.
- **Tested overlay map:** `/Users/germanbryzgalov/.hermes/cache/scratch/stage0203-independent-z9wiimec/tested-map.json`; SHA-256 **`d2c54f1b4d6bbb8681bb9dad538021d8d7997202dfb468847d2a5c0f458fece9`**.
- Полная карта 342 файлов export: `/Users/germanbryzgalov/.hermes/cache/scratch/stage0203-independent-z9wiimec/export-files-map.json`; SHA-256 `94311d3ba837e6b9386529b22ec5f61dcd511c15985dd4ce26259c101c35968d`.
- Команды, return codes и полные stdout/stderr: `results.json` и `logs/*.log` в том же scratch-каталоге. Дополнительные проверки: `semantic-checks.json`.

Карты сериализованы как UTF-8 JSON path→SHA256, sort_keys=true, indent=2, завершающий LF; приведён SHA самих файлов карт.

## Материализация и ownership

База получена исключительно `git archive HEAD` для `.codex`, `.claude`, `docs/core`, `CLAUDE.md`. Единственный недостающий source manifest — `.mcp.json` — дополнен `git show HEAD:.mcp.json`, не из worktree. В export нет `.git` исходного репозитория, чужих untracked `.codex/content-parity.json`, `test_content_parity.py`, `test_media_handoff.py`.

Overlay содержит **12/12 exact prospective contents + 55/55 guarded allowlist files = 67 файлов**. Для каждого prospective content независимо проверены SHA-256 и Git blob SHA-1; существующие HEAD bytes проверены по base SHA-256. Для каждого allowlist файла проверены точные bytes SHA-256 и отсутствие path в HEAD. Никакие wildcard imports dirty worktree не использованы. В соответствии с поручением материализованы все 12 contents и все 55 allowlist entries, поэтому export включает также уже перечисленные в proposal stage04 motion template/receipts; это не утверждение о browser integration stage04.

Проверены шесть доступных `design-rollout/before` снимков по записанным before SHA, а также stage02-own-before config/lifecycle/test_lifecycle. Для clean-before command/SKILL/motion исходником сравнения служит HEAD; до-спринтовых отдельных копий этих файлов в `before` нет. Сравнение frozen HEAD→prospective показывает только разрешённые additive Taste-вставки в CODEX/MD/command/SKILL, одну policy-строку config/startup и canonical-root/owner regression additions в lifecycle tests. Все parsed config keys кроме developer_instructions сохраняются. Зарегистрированный Taste TOML body совпадает с MD body и HEAD body + frozen собственным suffix (с учётом завершающего whitespace); новые библиотеки не подменяют исходный Nullume contract.

Live Taste payload уже получил дополнительный parent surface-workflow suffix. Он сознательно не использован для восстановления frozen proposal и не является blocker этого ревью. Более новые dirty media/parity gates не включены и не оценены как опубликованные. Scope-adjusted frozen routing test проверяет опубликованную authority, а не присваивает чужие untracked зависимости.

## Фактические проверки final export

Среда: настоящий Hermes Python **3.14.9**, Node **v26.12.1**. `PYTHONDONTWRITEBYTECODE=1`; `PYTHONPATH` удалён; `TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch/stage0203-independent-z9wiimec/tmp`; Python-bin помещён первым в PATH для дочерних процессов. Network/install не выполнялись.

Все команды исполнены из exact export; после дополнения `.mcp.json` все команды повторены целиком:

| Команда | Реальный результат |
|---|---|
| Python `-m unittest discover -s .codex/scripts -p 'test_*.py' -v` | **53 PASS**, 0 failures/errors: test_design_routing 4, test_lifecycle 19, test_published_owner_policy 3, test_task_gate 27 |
| Python `.codex/scripts/selftest.py` | exit 0; 45 original roles + codex-docs, 22 skills, 5 lifecycle events, 3 MCP configs, 90 source mappings |
| Python `.codex/scripts/sync-roles.py` | exit 0; `Drift: none` (без --apply) |
| `node --test .codex/scripts/test-design-library.mjs` | **14 PASS**, 0 fail/cancelled/skipped/todo |
| `node --test .codex/scripts/test-design-lint.mjs` | **37 PASS**, 0 fail/cancelled/skipped/todo |
| `node .codex/scripts/test-motion-template.mjs` | exit 0; `PASS createDraggable export contract` — только smoke |

Library suite реально получила каждую полную запись, сверила IDs/counts, provenance/license, INDEX, JSON errors, mutation/fail-closed и readonly CLI contract. Проверены 64 palettes, 39 typography, 11 heroes, 27 diagrams как полный набор, не четыре summary. Полный Python discover относится к четырём реально экспортированным test modules, а не к чужим untracked suites.

После mutation suites повторно сверены **все 67 overlay SHA**: тестируемые proposal/allowlist bytes не изменились.

## Предупреждения, ограничения и blockers

- Selftest сохраняет warning о `.claude/commands/feature.md`: в HEAD SHA-256 `1b52ca3e9caf7208008f3bea0a5416db6d5476483623067a9ba659c9f2a39132`, а migration manifest записывает SHA пустого содержимого `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Это существующая source-freshness несогласованность HEAD, не новая regression proposal и не скрытый FAIL. Первоначальный warning об отсутствующем `.mcp.json` устранён дополнением именно HEAD bytes.
- Недостающих зависимостей для перечисленных checks после дополнения HEAD root нет; hard blockers stage02+03 не обнаружены.
- `preservation_source_sha256` не является top-level key фактического JSON: в нём `guards.tracked_worktree_sha256`. Полное preservation/index CAS ревью публикационной операции не заявляется; parent должен отдельно проверить эти guards перед Git writes.
- Native Codex reload, визуальная owner acceptance, runtime/remote CI, upstream checkout parity через TASTE_SOURCE и motion browser integration не проверялись и не заявляются.
- В исходном repo создан только этот разрешённый отчёт. Production/test proposals не менялись. Git object/index/ref writes, commit/push, branches/worktrees и запуск selftest dirty original checkout не выполнялись. Тестовые Git fixtures создавались только самими тестами в новом scratch TMPDIR.

Findings о реальных новых дефектах: **0**. Вердикт действует только для указанного frozen map; parent rerun и отдельная публикация остаются его обязанностью.
