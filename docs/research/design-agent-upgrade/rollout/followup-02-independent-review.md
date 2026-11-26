# F2 — независимое bounded review

## Идентичность, scope и итог

**Actual reviewer: Hermes Agent, model `gpt-6.1-sol`, одна независимая delegated review session.** Это адаптированное исполнение трёх ролей одним реальным ревьюером, не три человека/агента и не native Codex session. Делегирования не было. Полностью прочитаны `.codex/agents/review/code-reviewer.md`, `.codex/agents/review/typescript-reviewer.md`, `.codex/agents/security/security-secrets-scanner.md`, `.codex/CODEX.md`, review-loop, TypeScript rules/anti-patterns и security anti-patterns, включая §13.

| Роль, исполненная той же actual identity | Verdict | Findings ≥80% confidence |
|---|---|---|
| `code-reviewer` | **PASS** | Нет. Критичных проблем не обнаружено. |
| `typescript-reviewer` — адаптация к JS `.mjs` | **PASS** | Нет проблем runtime/API в проверенном JS scope. |
| `security-secrets-scanner` | **PASS** | Утечек секретов не обнаружено в bounded scope. |

Base и текущий HEAD при проверках: `fc673e38cb742a9d4ed2767186d594850406f9c8`.
Frozen candidate tree: `228c959bce3eebb22e005204a995a2c97744161f`.
Map/evidence directory: `/Users/germanbryzgalov/.hermes/cache/scratch/design-followup-_9uk291c/f2/`.

Вердикты относятся **только к четырём файлам этого tree**, перечисленным ниже. Полностью прочитаны оба изменённых JS-файла (368/483 строки) и оба документа (34/23 строки), а не только diff. Этот review receipt — отдельный разрешённый результат ревью, не пятый файл исходного frozen candidate. Source-freshness, CI и публикация остаются следующими gates координатора; этот PASS не утверждает их завершение.

## Проверка frozen bytes и границ

`git diff --name-only <base> <tree>` содержит ровно четыре map paths. Для каждого проверены совпадение SHA256 map, текущего source, export и UTF-8 proposal value; Git blob OID через `git ls-tree`/`git show`; Git mode `100644` и export filesystem mode `0644`.

| Path | SHA256 | Git blob |
|---|---|---|
| `.codex/scripts/design-lint.mjs` | `188f33829ad9ec0982a1f24de172bb9b149605c6073512c5ccba9f156e38b243` | `d9bb8737c1ebdaa22a69fcc310d648ce2ca253bc` |
| `.codex/scripts/test-design-lint.mjs` | `829a68354b59e0ddba300f723b517e1145e0c6495e312b85439ed4e45fc5def8` | `d155c4f1c78ff10570d8b4619fea7db22ae93c7e` |
| `docs/research/design-agent-upgrade/rollout/followup-02-master-scope.md` | `1d3b47a1d54c5a868be806c84940e3a5b38efa1c1d9d1d7c7773912581f21726` | `47ac3cb7789729b32a3ca28655a8c2b3ce08a4c3` |
| `docs/research/design-agent-upgrade/rollout/FOLLOWUP-PLAN.md` | `60b97f37dee33f58ffc121a079ee4e4cbfa0e932dc345aaaea265e3f4e6f6441` | `67032e19d541484fcbc760e9c40107ab6792af66` |

`publication.diff` побайтно совпадает с `git diff --binary <base> <tree>`. Обе rule arrays извлечены целиком из base и candidate и сравнены как bytes, не через нормализованный JSON:

- `RULES`: `5c323dddd22144ecc3028a7a211b10d773ee1eff5398b740dc871392fc303543` — base = candidate = map.
- `MASTER_RULES`: `f6f866b30da533778497624456677ccb92934bfb56f11e2bdda5dee9193b5da3` — base = candidate = map.
- В diff тестового файла **нет удалённых строк**: старые assertions сохранены. Базовый suite фактически исполнил 42 теста; финальный — 49, семь новых test methods.
- Повторные guards после тестов: все четыре source/export SHA256 неизменны, HEAD всё ещё base. Реальный index, Git refs и исходники не менялись ревьюером.

Export — **ограниченный tooling export, не полный checkout**: отсутствуют клиентские и другие нерелевантные разделы, включая root package manifest. Первоначальная проверка полноты всего tree закономерно остановилась на отсутствующих разделах; это не было засчитано как полный export PASS. Затем отдельно проверены exact Git blob bytes всех 187 файлов `.codex/` и двух review documents; четыре map файла также проверены отдельно. Фактически выполненные clean tests ниже относятся именно к этому export. Нет утверждения о полном application regression или чистоте shared working checkout.

## `code-reviewer`: семантика и отрицательные сценарии

Production diff ограничен resolver `.codex/scripts/design-lint.mjs:138–147`: распознанный target обрабатывается до generic active/sole fallback и до early return при нуле MASTER. Собственный MASTER возвращается; отсутствие собственного MASTER даёт null и `master-scope` WARNING с target path. Чужой active/sole MASTER не используется. Остальной resolver и правила неизменны.

Проверено чтением и реальными CLI subprocess runs:

- `projects/<target>/…` и `tools/<target>/…` без MASTER не заимствуют чужую палитру/шрифт при active, sole, none, invalid-active и `ACTIVE_PROJECT`, включая невалидный env selector.
- Собственный MASTER выигрывает независимо от чужого active/env. Неверные относительно собственного MASTER цвет/шрифт продолжают давать rule findings.
- Generic paths сохраняют active/sole/env fallback. Отдельные ambiguity, operational errors, coverage и deterministic JSON защищены прежними тестами.
- Без target MASTER `Inter` остаётся глобальным `forbidden-font` ERROR, exit 2. Отсутствие MASTER не является approval и не маскирует ERROR.
- Missing-MASTER WARNING находится в `diagnostics`, не в `findings`; `summary.warnings` считает rule findings; `operationalErrors = 0`, schemaVersion 1 сохранена. Human stderr объявляет пропущенную MASTER-сверку отдельно от stdout rule ERROR.
- Изменение чужого MASTER не меняет результат named target без MASTER.

Дополнительно выполнен независимый adversarial loop: **75 CLI cases PASS**. Это 72 комбинации `2 prefixes × 6 selector contexts × 2 own-MASTER states × 3 samples`, плюс два generic fallback cases и human missing-MASTER + forbidden-font ERROR. Для комбинаций проверялись actual exit, findings, diagnostic count/code/level/path, summary, schemaVersion и scannedFiles. Temporary fixtures находились внутри разрешённого scratch и удалены; source/export не подменялись.

Findings: нет. **Verdict: PASS.**

## `typescript-reviewer`: bounded JS API/runtime review

Применены релевантные Node/JS пункты роли: null design-system flow, path recognition/normalization, env precedence, synchronous CLI filesystem boundary, diagnostic/result shape, exit precedence, child-process arguments и fixture isolation. Прочитан реальный импорт `lib/projects.mjs`; dependency closure не заменена mock. Синхронный filesystem здесь — offline CLI, не backend request handler. `spawnSync` получает argv без shell; fixture runner удаляет ambient `ACTIVE_PROJECT`, а env-specific тест задаёт его явно. Ошибки чтения остаются operational diagnostics.

Это существующие `.mjs`, не TypeScript-проект: требование выдуманной TS compilation, Fastify route schema или browser/backend runtime не вводилось. Node execution и selftest syntax checks выполнены реально. Generic fallback и JSON v1 API не изменены вне явно добавленной missing-target diagnostic.

Findings: нет. **Verdict: PASS.**

## Выполненные тесты и RED → GREEN

Runtime: Node `v24.21.0`, фактический Hermes-managed Python `3.14.9` (не shell Python 3.9). Для запусков заданы:

```text
TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch/design-followup-_9uk291c/f2
PYTHONDONTWRITEBYTECODE=1
MOTION_DEPS=/Users/germanbryzgalov/.hermes/cache/scratch/motion-stage04
```

`$PY` ниже — существующий `python3` из Hermes tools `python-3.14.9*/bin/`, найденный на диске и проверенный `--version`; установка/скачивание не выполнялись.

| Фактический независимый запуск | Результат |
|---|---|
| Original base resolver + final tests в отдельной disposable fixture | exit 1: **49 total, 44 pass, 5 fail, 0 skipped** — настоящий RED |
| Original base resolver + original base tests, та же изоляция | exit 0: **42 pass, 0 fail/skip** |
| `node --test .codex/scripts/test-design-lint.mjs`, frozen export | exit 0: **49 pass, 0 fail/skip**, 2.399 s |
| `node --test .codex/scripts/test-design-lint.mjs .codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs`, frozen export | exit 0: **64 pass, 0 fail/skip**, 6.280 s |
| Та же Node command, shared source с проверенными четырьмя bytes | exit 0: **64 pass, 0 fail/skip**, 6.123 s |
| `$PY -m unittest discover -s .codex/scripts -p 'test_*.py'`, frozen export | exit 0: **79 tests, OK**, 11.569 s |
| Та же Python command, shared source | exit 0: **86 tests, OK**, 9.678 s |
| `$PY .codex/scripts/selftest.py`, frozen export | exit 0; 45 original roles + codex-docs, 22 skills, 5 lifecycle events, 3 MCP configs, 90 source mappings; syntax/native prompt checks PASS |
| `$PY .codex/scripts/sync-roles.py`, без `--apply`, frozen export | exit 0: **Drift: none** |
| Дополнительный independent adversarial CLI loop | **75/75 PASS** |

64 Node = 49 lint + 14 library + 1 dependency-isolation. RED воспроизводит пять реальных failure methods: named-target active palette/font, prefixes/fallback modes, explicit env, missing-MASTER diagnostic при global font ERROR, unrelated MASTER edit independence. Исполнение с финальными bytes GREEN, без ослабления старых тестов.

Selftest сохранил отдельный известный WARNING: `Source files changed; review and sync: .claude/commands/feature.md`. Он **не** объявлен устранённым или безусловно зелёным source-freshness gate. Это следующий этап, не скрытый F2 source change.

Прочитаны сохранённые parent RED/GREEN и шесть regression outputs. Первый RED worker и дальнейшая минимальная реализация/расширение матрицы координатором не смешиваются: автор production fix и шести дополнительных matrix methods — parent. Сохранённый `scope-guard-note.json` объясняет остановку worker собственным уже разрешённым обновлением plan; неизвестного source edit или отсутствующего user approval из этого не следует.

## `security-secrets-scanner`: профиль и границы

Профиль — стандартный repository tooling **Python/Node/TOML**, не активный клиентский security-profile. Основание: непосредственно прочитанные imports/scripts и project-local Codex TOML boundary. Клиентский профиль и `.env` вне четырёх путей не читались. Ни один из четырёх paths не является `.env`, CI config или изменением runtime config.

Полностью просканированы bytes всех четырёх файлов, не только added lines: AWS access key, Stripe live/test, GitHub PAT, private-key block, JWT, credential string assignments (`apiKey/password/passwd/secret/token`) и credential-bearing database URLs. **Ноль signature hits.** Полные секреты не печатались. Ручной review не нашёл ключей, строк подключения, secret logging или обхода §13; для offline CLI без интеграционных credentials нет основания выдумывать defect про reuse/rotation ключей.

Дополнительно bounded code-boundary scan четырёх файлов: **0** `eval`, `new Function`, `exec`/`execSync`, network `fetch`/HTTP request и `shell: true` matches. Imports/действительный subprocess путь просмотрены вручную: CLI читает локальные файлы, тесты запускают Node по argv; resolver change не добавляет network, installer, browser, backend, privileged execution или secret access.

Ограничения: это не full-repository/history audit, не проверка всех tracked env files, не внешний security runtime, dependency/CVE audit или доказательство absence of all vulnerabilities. История не переписывалась; клиентские secrets, CI и operational key rotation вне scope. **Verdict: PASS** в указанных границах.

## SHA256 evidence artifacts

Хеши рассчитаны фактически; это привязка сохранённых parent receipts, не замена новым независимым запускам выше.

```text
review-map.json       d5468db05139af58e2e974917facb93e270a9e02dfb15139619b61084fb8974d
proposal.json         26d00635557f6be15d7b0fc313fee755aa9217ee121f0acc78b0cc0fdbe9439f
publication.diff      f1e40018468a2283444cff7c77cfc766175d7f69f7a23aaf9269612b09d031eb
red.json              fd77edcec0c2b4d9d614ad8856a82918bd99b88633d4e3e54e75d3e035bf23a1
green.json            3d8841bb13a06e7af3911f93611b6eee201d2ba2c5dca87a161bcca9bdf769e8
matrix-red.json       fea592e6a7693743711a7c895d534a4ddec20743c45a45dc1830c428030fe14a
working-python.json   94491a20334ca589d7d18513865d9794b8756282057bc06f93b6cb6bb23bdb8f
clean-python.json     d79c0514d9c59d1ca2215b973c489344e9eae9b80641ab7422a4db7886acdc4f
working-node.json     7afb6df1cd94ae4583437773aebd7317cd60105c73677c126d3956aca83b2b61
clean-node.json       86d746b47a90251d6dc2ef451dcce536bc61f21f8485a71ea410ab68b49163a0
selftest.json         38a435d7adc1d495a3ea3d1e473e2ceb8111cbccb608869cd8c1d0342b392c8b
sync.json             86f88ed1b892853db2c36c97ebb02df5ce3d2ef3d6f5bb8945cf9a1fe9b5d6bf
scope-guard-note.json 277f67a4b527bf916a7600aae77a819e36b9a4dccb496c78fb0ea0ac17a4351e
```

## Handoff

Незакрытых подтверждённых findings нет. Все три bounded verdict — PASS под одной actual identity. Создан только этот review document; исходники, frozen map/proposal/export и Git state не редактировались. Проверочные временные fixtures удалены. Публикацию не выполнял. Координатору до публикации повторить guards exact reviewed bytes и затем выполнить own-only publication/remote read-back; только после этого переходить к source-freshness. Любые изменения проверенных bytes требуют повторной актуализации затронутых проверок и review.
