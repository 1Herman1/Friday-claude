# Независимое узкое ревью Linux fixture correction

## Решение и идентичность

**PASS — только локальный технический допуск двух зафиксированных файлов. Actual Linux CI для исправления PENDING после отдельно разрешённой публикации координатором.** Это не разрешение push/deploy и не owner acceptance.

Reviewer: **один фактический независимый Hermes review-subagent этой делегированной сессии, gpt-6.1-sol / openai-codex**. Ниже четыре отдельных perspective-verdict одного исполнителя, не четыре независимых человека, не native role activations. Реализацию этого исправления reviewer не выполнял. Прочитаны actual `.codex/CODEX.md`, review-loop, code-reviewer, qa-engineer, security-secrets-scanner, silent-failure-hunter, проектный контекст/security-profile, §13 security anti-patterns. Новое визуальное ревью не проводилось и не требуется для неизменённого UI.

Base: `d0ab31fb90de0bd24cc000b5597a9d6608d042d2`.
Package: `~/.hermes/cache/scratch/stroymat-r3-repair-v1/linux-fixture-fix/`.

| Проверенные байты | SHA-256 |
|---|---|
| `.codex/scripts/test_client_design_pilot.py` | `6f0455a2d2c8d77aab57c206a525cd605857255cac341abc7f843f0f3aadcd3c` |
| `docs/research/design-agent-upgrade/rollout/followup-05-client-linux-fixture-fix.md` | `d33c192f86b124833c763c637512a906ab5d09edef1941cf6acf5621805ff7e4` |
| `owned-manifest.json` | `fab8e7bd0858948a6a94956d05e0a5d9abea94bdc88a10484ec24baf2493e717` |
| `verification.json` | `29a6cc817b027cd2a66c242290ce5ee6297c3d15945515e9afe96a21d0239eae` |
| `export-manifest.json` | `20587c0a4974e346fefab3bafe1eeab9f732610261a132f69679232d0a6588a2` |
| `receipts.json` | `d0315aa0b94032a1a78ac2785cee3e1ddbea77b27903a35db1792e459e1aa8ad` |
| `actual-head.tar` | `864c88b3c2eb2e919958ec2cdc6f58d015e269949124dffde51e01f11b73ffd8` |

## Code — PASS

Критичных проблем не обнаружено. Полностью прочитаны оба payload и production recipe; diff вычислен повторно от archive base, а не принят на веру из implementer summary. Файл отчёта новый; весь его текст входит в review scope.

В существующем ArchiveIsolation изменены только создание private scratch и `TemporaryDirectory(dir=private)`. Новый отдельный класс задаёт disposable HOME и внешний относительно HOME scratch TMPDIR; separation явно проверяется. Child запускает **точный существующий метод ArchiveIsolation**, не discovery и не новый portability-класс. Дальнейший child запускает только `ClientPilotTests`: рекурсии нет.

AST-проверка подтвердила сохранение всех старых test methods, ровно один новый test method и изменение ровно одного прежнего метода. Все девять `ClientPilotTests` побайтно/семантически прежние: негативные guards для source hash/inventory/traversal/symlink, output existing/repository/symlink и invalid render/CSS не ослаблены. Подмена production ограничения не происходила.

## QA — PASS (локально)

Создан собственный Git-less clean export в:

`~/.hermes/cache/scratch/linux-fixture-independent-rqdfkp2n/clean-export`

Read-only `git --no-optional-locks archive d0ab31fb90de0bd24cc000b5597a9d6608d042d2` дал точный SHA supplied tar; tar commit comment совпал. Поверх наложены ровно два owned payload. Проверены полный инвентарь и каждый regular-file hash: **4 569 файлов**, **4 567 non-owned regular files** совпали с base; весь export совпал с supplied export-manifest. `.git` в export отсутствует. После всех проверок export hashes остались прежними.

Фактический Python — уникальный установленный Hermes `python-3.14.9*/bin/python3`, версия **3.14.9**; Node через `/usr/local/bin` — **v24.21.0**. Интерпретатор выбран filesystem glob из-за маскировки части пути в tool display, не подменой на system Python. В финальном replay все test subprocess запущены без inherited `GIT_*`, `PYTHONPATH`, `NODE_PATH`, также `NODEPATH`; PATH `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`, TMPDIR reviewer evidence root, `PYTHONDONTWRITEBYTECODE=1`. Read-only Git discovery использует CLI `--no-optional-locks`, без Git environment donation.

Собственный RED: в disposable export применён final test с отменой только fixture repair. Результат точно совпал с `red-test.py`, SHA `422aa194498da6aac6e43f265c0f6467cc97c06b307fa1a564b26bfb7c6e40ab`. Новый regression действительно упал на production private-output rejection в nested старом ArchiveIsolation, не на import/syntax/zero tests. Затем восстановлены точные final bytes и один раз выполнены проверки ниже.

Команды из reviewer export (`PY` — фактический Hermes sys.executable):

```sh
# RED: final test minus only existing-method fixture fix
"$PY" .codex/scripts/test_client_design_pilot.py ArchiveFixturePortabilityTests -v
# Restore exact admitted test bytes, then GREEN:
"$PY" .codex/scripts/test_client_design_pilot.py ArchiveFixturePortabilityTests ArchiveIsolationTests -v
"$PY" -m unittest discover -s .codex/scripts -p 'test_*.py' -v
"$PY" .codex/scripts/selftest.py
"$PY" .codex/scripts/sync-roles.py
```

| Собственный запуск | Фактический результат | SHA-256 полного log |
|---|---|---|
| `red.log` | exit 1; 1 outer test; nested private-output ValueError | `68d9dcb60e1022f83ffbe86e0d40d20e0dd47080bd6419190a5c4b277a76b81c` |
| `focused-green.log` | exit 0; **2 tests, 3.156s, OK** | `a15d1e68a7efd2d67e124020b54aea391f6f71a6ee90202c53c27abc1121d9bb` |
| `full-green.log` | exit 0; **102 tests, 14.271s, OK**, без skips/failures/errors | `d86262b1794ce9a8dfb3aa1bc01a35722f4c9fb00bac578632add2f6d7518fbc` |
| `selftest.log` | exit 0; 45 original roles + codex-docs, 22 skills; source/native/syntax checks PASS | `1fff9e0f8016c708c326f255dc3aeeff2e13c31d9e80c43689fa4864d79dd6bc` |
| `sync.log` | exit 0; `Drift: none`; без `--apply` | `cf572f1c631c7af5cb337b61cccc6da9eca9d805de7faca93d25becd0bad1bf9` |

Финальные reviewer logs, commands, returncodes, guards и summary сохранены в `~/.hermes/cache/scratch/linux-fixture-independent-rqdfkp2n/`; supplied receipts не перезаписаны. Первый тоже успешный replay сохранён отдельно в `~/.hermes/cache/scratch/linux-fixture-independent-fuffg0li/`: RED exit 1, focused 2/3.119s, full 102/14.476s, selftest/sync exit 0. В первом outer harness после удаления inherited Git variables был явно добавлен безвредный `GIT_OPTIONAL_LOCKS=0`. Чтобы буквально выполнить требование нулевого `GIT_*` в test environment, весь replay один раз повторён в новом export без этого флага; source bytes не менялись, прошлый PASS не заменял скрытый failure. Это harness correction, не rerun-until-green. Также сверены hashes implementer RED/GREEN/final logs с его receipts.

## Secrets — PASS (bounded)

Утечек секретов не обнаружено в двух payload и их diff. Проверены credential signatures и literal credential assignments; проектный security-profile указывает статический offline HTML без backend/API secrets. Никаких installs/provider/network requests не делалось.

Canary создаёт только disposable fake `.git/{HEAD,config,objects,refs/heads}` под временным private scratch; poison variables указывают только туда. Сравнение всех canary regular-file bytes до/после сохраняется. Production recipe не вызывает Git/subprocess; test env очищается перед намеренным disposable poisoning. Ни main `.git`, ни чужая runtime/worktree metadata в тесты не донатились. Verdict не означает новый аудит секретов всей истории/архива.

## Silent failures — PASS

Скрытых сбоев не обнаружено в correction. Новый subprocess имеет timeout 120s и проверку returncode с обоими stdout/stderr в assertion. Прежние subprocess/assertions и canary-byte comparison сохранены; исключения не поглощаются. Nested existing tests реально выполняются, а не заменены mock/skip.

Сохранены и не переименованы в GREEN следующие diagnostics:

- Оригинальный Linux run **46083975998**: **101 tests, failures=1**, private-output rejection. Проверен сохранённый `frozen-v4/linux-first-failed.log`, SHA `a04f245113acf5336e43bc38ae4d586f4be9410962965b2f371f3724dd3e9ee8`.
- Собственный ожидаемый RED выше, exit 1.
- Первый reviewer launcher завершился exit 127 до тестов: literal redacted interpreter path не существует. Filesystem discovery исправил launcher, не source.
- Две попытки дополнительного static-scan wrapper были отклонены execute_code до выполнения из-за null-byte quoting SyntaxError; затем исправлено quoting. Это не результаты тестов. Свод сохранён как `wrapper-failure.log` в первом evidence root. Повторная финальная проверка выше связана только с удалением явного harness-флага, а не с подбором зелёного результата.

## Сохранность и границы допуска

Production recipe SHA остаётся `22ecaedc644199ee9ad38c7569aaf8cd48fb89162422db5e9481caaacf4dcaa1`; source-lock SHA `27d0d7f60c3b1f8b0df9943f669ceac20ab11025ad787f54109d731a13360584`. В recipe строки 118–125 по-прежнему отвергают symlink output, existing path, output внутри ROOT и output вне `$HOME/.hermes/cache/scratch`. RED непосредственно подтверждает последнее ограничение.

В main и собственном export проверены **25 locked source files** по hash, size, executable mode; **30 source/pilot regular files** из unchanged-before совпали по hash. Поэтому исходный UI, HTML, media/fonts/assets, CSS, browser harness и recipe не изменены этим пакетом. Повторно проверены **4 649 enumerated historical regular-file hashes** из supplied preservation manifest. Это bounded integrity comparison, не полный новый аудит истории, лицензий или качества этих артефактов. Старые private baseline/A/B и owner HTML не переиздавались; browser/visual review не запускался.

Собственные before/after read-only guards подтвердили неизменность main HEAD, `.git/HEAD`, config, index и exact stage listing. Git writes, push, installs, recovery, provider calls, deploy отсутствуют; чужие изменения не откатывались и чужие процессы не останавливались. Единственная repository-запись reviewer — данный отчёт; исполняемые копии и receipts только в private scratch.

**Открыто:** actual Linux rerun после parent publication; owner selection/acceptance и font/media rights остаются **PENDING**. Ни этот PASS, ни прежние visual PASS не закрывают эти отдельные gates. При изменении любого из двух admitted hashes требуется новое релевантное review.
