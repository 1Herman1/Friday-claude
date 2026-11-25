# Этап 01 — независимое code-review

**Verdict: PASS.**

Критичных проблем не обнаружено.

## Идентичность, scope и revision

- Роль: code-reviewer, адаптированная в Hermes; reviewer ID: `hermes-stage-01-independent-code-review` (метка этого отчёта, не выдуманный native Codex session ID).
- Прочитаны полностью `.codex/agents/review/code-reviewer.md`, `.codex/workflows/review-loop.md`, `.codex/CODEX.md`.
- Scope: `.codex/scripts/design-lint.mjs`, `.codex/scripts/test-design-lint.mjs`, `docs/research/design-agent-upgrade/rollout/stage-01-lint.md`; существующий caller `.codex/scripts/lifecycle.py:117–170` и импортированный `.codex/scripts/lib/projects.mjs`.
- Исходный HEAD: `388ec708f39583172d7f36110f6424cc175b5512`; ветка: `claude/greeting-nnz368`.
- Во время проверки HEAD внешним процессом переместился на `aef39998f9dac0a3dfa229fdf03d5c4748ed9c22` (`journal: verify hourly BingX sync and refresh open position reviews`). `git diff 388ec708f39583172d7f36110f6424cc175b5512 HEAD --stat -- <scope>` пуст: этот коммит не меняет проверяемые файлы. Suite повторена после обнаружения смены HEAD: 37/37 PASS. Verdict привязан к следующему содержимому рабочего дерева, а не ко всем dirty-изменениям репозитория.

| Файл | SHA-256 проверенной версии |
|---|---|
| `.codex/scripts/design-lint.mjs` | `9f0ac6e57f178a02bf1d2b39861e16e18cf2ccc511c3ddfda7eb7220d32be29a` |
| `.codex/scripts/test-design-lint.mjs` | `383a20a372c779cf141ccea140eb62fbbb922c949b62ac353f57e5b32950bb73` |
| `.codex/scripts/lifecycle.py` | `e4a18ce5843c67c785c27d81e3dd8f7b7055a4e73cfb706737e2cf91c0fb1e36` |
| `.codex/scripts/lib/projects.mjs` | `92b5056f70ddac2c141a04c31e580de1c33753da0f31f4891aeef32ef86726d9` |
| `docs/research/design-agent-upgrade/rollout/stage-01-lint.md` | `bbc8e6140c59f719869c8e53a0901fd166c3b6ff95b91507327241d008e4a0c2` |

Оба переданных владельцем хеша совпали. Исходники не менялись; Git writes, установка, сеть, UI и делегирование не выполнялись. Единственный созданный файл в репозитории — этот отчёт. Дополнительный воспроизводящий probe сохранён в Hermes scratch; все временные fixtures удалены.

## Findings

Подтверждённых findings с confidence ≥80% нет. Блокирующих новых багов, уязвимостей или проблем производительности в назначенном изменении не воспроизведено. Исходные font/policy false positives не объявляются регрессиями этого этапа.

Проверены границы CLI-ввода, отсутствие shell/eval-инъекций и новых секретов в scope, обработка I/O и сохранение результатов mixed targets, отсутствие изменений auth/DB/XSS-путей. Синхронный filesystem I/O здесь принадлежит отдельному CLI, а не серверному event loop; прежние эвристики детекции не пересматривались.

## Побайтовая сверка всех правил

Из `git show HEAD:.codex/scripts/design-lint.mjs` и рабочего файла извлечены полные блоки `const RULES = [` / `const MASTER_RULES = [` до соответствующего `];` (включая regex, severity, hints и комментарии). Сравнение выполнено по bytes, не по нормализованному тексту. Дополнительно повторено против исходного HEAD `388ec708…`.

| Блок | Правил | Размер извлечённого блока | SHA-256; результат |
|---|---:|---:|---|
| RULES | 14 | 3691 bytes | `d24478efc307ed2430bf708813fdb0ade4e4280cab693eb66ecf0366f54dec82`; byte-equal обоим HEAD |
| MASTER_RULES | 3 | 1140 bytes | `f6f866b30da533778497624456677ccb92934bfb56f11e2bdda5dee9193b5da3`; byte-equal обоим HEAD |

Все 17 правил также имеют отдельные subprocess seeds в повторённой suite, с проверкой rule/line/level/exit. Новых font scopes в проверенной версии нет.

## Реальные receipts

Среда: Node `v24.21.0`; явный `TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch`.

```sh
TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch node --test .codex/scripts/test-design-lint.mjs
# Первый независимый запуск: tests 37; pass 37; fail 0; skipped 0; cancelled 0; todo 0; exit 0.
# Повтор после смены HEAD: tests 37; pass 37; fail 0; skipped 0; cancelled 0; todo 0;
# duration_ms 1018.349792; exit 0.
node --check .codex/scripts/design-lint.mjs
node --check .codex/scripts/test-design-lint.mjs
# Оба exit 0.
PYTHONDONTWRITEBYTECODE=1 TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch \
  python3 /Users/germanbryzgalov/.hermes/cache/scratch/stage01-independent-review.py
# ADVERSARIAL_CASES 17 PASS; exit 0.
```

Probe запускает настоящий CLI в изолированном cwd и использует настоящий импортированный projects helper. Для каждого JSON case проверены: один parseable document, пустой stderr, process status = JSON exitCode, точный scannedFiles, соответствие трёх coverage counts массивам, summary counts фактическим findings/diagnostics и точные diagnostic codes. Permission cases используют реальный chmod(0), не mock filesystem.

В таблице `T/D/S` — targetCount/discoveredCount/scannedCount.

| Независимый CLI case | Exit | T/D/S | Диагностика / сохранённый результат |
|---|---:|---|---|
| clean | 0 | 1/1/1 | findings=[] |
| WARNING `{price}` | 0 | 1/1/1 | warnings=1 |
| ERROR `Inter`, `--json` после target | 2 | 1/1/1 | errors=1 |
| missing | 1 | 1/0/0 | missing-target |
| missing + ERROR + WARNING | 1 | 3/2/2 | missing-target; errors=1, warnings=1, operationalErrors=1 |
| unknown option + clean | 1 | 2/1/1 | invalid-target; clean просканирован |
| whitespace target + clean | 1 | 2/1/1 | invalid-target; clean просканирован |
| empty directory + clean | 1 | 2/1/1 | empty-target; clean просканирован |
| recursive directory + overlapping file | 0 | 2/4/4 | TSX/JSX/HTML/CSS; JS/node_modules/dist исключены |
| `clean.tsx` + `./clean.tsx` | 0 | 2/1/1 | dedup по absolute path; сохранена последняя запись `./clean.tsx` |
| unreadable directory + ERROR | 1 | 2/1/1 | read-error(path=locked); ERROR finding сохранён |
| nested unreadable directory + sibling | 1 | 1/1/1 | read-error(path=nested/locked); sibling просканирован |
| unreadable file + ERROR | 1 | 2/2/1 | read-error(path=warn.tsx); ERROR finding сохранён |
| empty registry | 1 | 0/0/0 | zero-targets |
| настоящий registry helper | 0 | 1/1/1 | implicit TSX-only discovery сохранён |
| unreadable registry | 1 | 0/0/0 | read-error(path=docs/projects/README.md) |
| unreadable MASTER | 1 | 1/1/0 | fail-closed read-error; файл не заявлен scanned |

Human-output cases (clean, WARNING, ERROR, missing, MASTER ambiguity), explicit empty argument, source-path MASTER priority, legacy `.ts`, registry src preference/overlap и nested symlink cycle дополнительно покрыты полной suite. Она подтверждает отсутствие ложного clean при операционных ошибках и сохранение старого human формата.

## Existing caller / libprojects

- `lifecycle.py:157–166` по-прежнему вызывает CLI через argv без shell и без `--json`; human-format совместимость сохраняется. Exit 2 не теряется: caller показывает отчёт и не кеширует digest. Exit 1 обрабатывается аналогично; exit 0 с WARNING показывает отчёт и кеширует; clean exit 0 кеширует без отчёта.
- Эти четыре ветки реально выполнены через `post_edit`, подставляя scratch ROOT, mocked `_save_state`/`changed_ui` и перенаправляя только путь executable к настоящему CLI. Фактические receipts: `clean.tsx cache=True reports=False`; `warn.tsx cache=True reports=True`; `error.tsx cache=False reports=True`; `missing.tsx cache=False reports=True`. Session lock/cache существующего caller создавались только в scratch, не в репозитории. Это проверка caller integration, не полный hook runtime.
- `lib/projects.mjs` не изменён. Проверены его реальные registry parsing, существующие codeRoots, TSX-only/src-preference и dedup через suite/probe. Missing registry roots по прежнему контракту helper отфильтровываются; это не новое изменение этапа.

## Ограничения и итог

- PASS относится только к указанному scope и хешам. Это не all-system PASS, не визуальная приёмка и не разрешение deployment.
- Известный baseline Python suite: 62 tests, 6 failures/errors, диагностированных отдельно координатором. Полный Python suite здесь не повторялся и не объявляется зелёным.
- Исторический RED→GREEN журнал implementer не воспроизводился целиком; независимо подтверждены конечный diff, byte parity, 37 тестов, 17 дополнительных CLI cases и четыре caller-ветки.
- Открытых подтверждённых дефектов в проверенном scope нет. **PASS**.
