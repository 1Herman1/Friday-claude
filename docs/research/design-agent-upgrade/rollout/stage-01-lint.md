# Этап 01 — design-lint: exit, coverage, JSON

## Результат и границы

Локальный функциональный scope GREEN: **37 tests, 37 pass, 0 fail, 0 skip**. Это CLI/subprocess-проверка, **не визуальная приёмка**, не deployment и не независимое ревью. Независимые code/security review и parent rerun остаются координатору.

Ветка `claude/greeting-nnz368`, исходный HEAD `388ec708f39583172d7f36110f6424cc175b5512`. Git writes/commit/push не выполнялись. Изменены только `.codex/scripts/design-lint.mjs`, новый `.codex/scripts/test-design-lint.mjs` и этот отчёт. Чужие dirty-файлы не редактировались.

## Контракт

- Exit 0: clean или только WARNING findings/MASTER-scope warnings.
- Exit 1: invalid/missing/empty target, zero discovered files, ошибки чтения файла/каталога/реестра. Операционная ошибка имеет приоритет над ERROR findings, но результаты остальных targets сохраняются.
- Exit 2: ERROR findings при отсутствии операционных ошибок.
- Без `--json` сохранены строки `file:line — hint [LEVEL]`, итог `N проблем в M файлах`, чистый итог `Проблем не обнаружено.` и прежние сообщения MASTER-scope в stderr. При операционной ошибке чистый итог не печатается.
- `--json` в любой позиции: один JSON document и newline в stdout, без человеческих строк; диагностики включены в JSON, stderr пуст для проверенных сценариев.
- schemaVersion: 1; findings: `{file,line,rule,hint,level}`; diagnostics: `{code,path,level,message}`; summary: `{errors,warnings,operationalErrors}`; exitCode совпадает с process status. `summary.warnings` считает именно findings; MASTER warnings находятся отдельно в diagnostics.
- coverage: `{mode,targets,files,scannedFiles,targetCount,discoveredCount,scannedCount}`. Explicit targets сохраняются дословно, включая отсутствующие; registry targets — существующие codeRoots из прежнего импортированного helper. `files` — обнаруженные файлы, `scannedFiles` — успешно проверенные. Missing targets не раздувают discoveredCount. Пересекающиеся пути дедуплицируются по абсолютному пути; файлы сортируются. Finding order: file → line → прежний порядок правил.
- Explicit directory рекурсивно ищет `.tsx/.jsx/.html/.css`, исключает `node_modules` и `dist`; nested symlinks не обходятся. Пустой explicit directory не маскируется валидным соседним target. Explicit files сохраняют legacy-поддержку произвольного расширения. Implicit registry сохраняет прежние src-preference и TSX-only discovery.
- Обе константы RULES и MASTER_RULES **побайтово совпадают с HEAD** (проверено извлечением блоков). Font/bounce-policy, font-size/doctype и остальные regex-эвристики не улучшались. MASTER priority по `projects/<project>/` и `tools/<project>/` перед active project сохранён.

## Реальный TDD журнал

Основная команда на последовательных срезах: `node --test .codex/scripts/test-design-lint.mjs`. На каждом шаге сначала добавлялся один end-to-end test, выполнялся RED, затем минимальная правка и повтор всей накопленной suite. В таблице `P/F` — реальные pass/fail до и после правки.

| Срез | RED | GREEN | Наблюдавшееся падение |
|---|---:|---:|---|
| Missing target | 0/1 | 1/0 | status `0 !== 1` |
| ERROR findings | 1/1 | 2/0 | status `0 !== 2` |
| JSON v1 + clean coverage | 2/1 | 3/0 | `--json` считался отсутствующим файлом, status `1 !== 0` |
| Explicit recursive directory | 3/1 | 4/0 | каталог читался как файл, status `1 !== 0` |
| Empty directory + valid file | 4/1 | 5/0 | status `0 !== 1` |
| Zero registry targets | 5/1 | 6/0 | status `0 !== 1` |
| Unreadable file + valid file | 6/1 | 7/0 | uncaught EACCES в stderr вместо JSON diagnostics |
| Invalid arguments | 7/1 | 8/0 | `missing-target` вместо `invalid-target` |
| Unreadable directory + valid file | 8/1 | 9/0 | uncaught EACCES scandir |
| MASTER ambiguity JSON | 9/1 | 10/0 | human MASTER warning в stderr |
| Nested directory symlink cycle | 10/1 | 11/0 | symlink `loop.tsx` читался как файл, status `1 !== 0` |
| Mixed missing + ERROR coverage | 11/1 | 12/0 | missing path ошибочно входил в discovered files |
| Legacy explicit `.ts` file | 12/1 | 13/0 | status `1 !== 2` |
| Unreadable registry | 13/1 | 14/0 | uncaught EACCES из реального imported helper |
| Characterization regression: 17 seeds + 5 cases | — | 36/0 | уже существующее поведение; новые production rules не добавлялись |
| Registry root coverage/overlap | 36/1 | 37/0 | coverage.targets `[]` вместо двух codeRoots |
| Human MASTER-warning compatibility | targeted 0/1 | full 37/0 | stdout только newline вместо старого clean summary |

В ходе legacy compatibility среза исправлено собственное неверное предположение теста: существующий explicit файл нельзя запрещать только по расширению. Invalid-argument test теперь проверяет unknown option и пустую строку; отдельный RED→GREEN на `tokens.ts` доказывает сохранение исходной поддержки.

**Отклонение среды:** первоначальные итерации запускались без явного TMPDIR, и поздняя проверка показала, что shell использовал macOS `/var/folders/.../T`, несмотря на переданный общий контекст scratch. Fixtures удалялись test cleanup. После обнаружения baseline missing RED повторён на копии исходного CLI + настоящего helper в Hermes scratch: 1 test, 0 pass, 1 fail (`0 !== 1`). Полная финальная suite повторена с явным scratch TMPDIR: 37/37 PASS. Это исправляет воспроизводимость итоговой проверки, но не переписывает историю первоначальных запусков.

## Точный список checks (37)

Отдельные реальные subprocess seeds: каждый проверяет точное имя правила, строку 2, severity, coverage.scannedCount=1 и process/JSON exitCode, а не фиктивный счётчик:

1. forbidden-font — `Inter`.
2. purple-blue-gradient — `from-purple-500 to-blue-500`.
3. gray-text-on-color-bg — `text-gray-500 bg-red-500`.
4. side-border-decor — `border-l-4`.
5. bounce-elastic-easing — `animate-bounce`.
6. small-touch-target — `h-4 w-4`.
7. too-round-corners — `rounded-3xl`.
8. price-without-division — `{price}`.
9. transition-all — `transition-all`.
10. blanket-will-change — `will-change: transform`.
11. ease-in-on-ui — `ease-in`.
12. animate-layout-prop — `transition: width 2s`.
13. scale-from-zero — `scale(0)`.
14. marketing-filler — `xРеволюционный` (сохранена старая Cyrillic word-boundary эвристика).
15. offbrand-hex — `color: #445566` при MASTER `#112233`.
16. offbrand-font — `font-['Other']` при MASTER `Brand`.
17. arbitrary-spacing — `p-[7px]`.
18. warning human output stays successful without claiming no findings.
19. clean human output and existing exclusions remain unchanged (rounded-full, ease-in-out, value={price}, /100, toFixed; doctype/font-size без новой политики).
20. imported MASTER scope follows projects and tools path before active project.
21. implicit registry keeps src preference and TSX-only discovery through real imported helper.
22. JSON findings are deterministic and preserve exact explicit file spelling (пробел и `./`).
23. registry coverage retains discovered root targets and deduplicates overlapping roots.
24. unreadable registry produces JSON diagnostic instead of uncaught exception.
25. explicit file keeps legacy non-UI extension support.
26. mixed missing and ERROR target retains actual coverage with exit 1 precedence.
27. directory symlink cycles are not traversed or treated as UI files.
28. MASTER ambiguity diagnostics are structured warnings in JSON (+ старый human stdout/stderr).
29. unreadable directory is structured and does not abort mixed targets.
30. invalid arguments are structured operational errors (unknown option, empty argument).
31. unreadable file produces structured read-error and preserves other results.
32. zero registry targets never claim clean (JSON + human).
33. empty explicit directory is operational failure even alongside valid target.
34. explicit directory recurses through TSX JSX HTML CSS and deduplicates overlaps (включая исключение JS/node_modules/dist).
35. JSON v1 reports findings, exact paths and coverage without human stdout (полное deepEqual schema shape).
36. ERROR findings exit 2 and keep human output.
37. missing target exits 1 instead of false clean.

## Итоговые проверки

```sh
TMPDIR=/Users/germanbryzgalov/.hermes/cache/scratch node --test .codex/scripts/test-design-lint.mjs
# tests 37; pass 37; fail 0; cancelled 0; skipped 0; todo 0; exit 0
# Node v24.21.0; os.tmpdir() подтверждён как Hermes scratch.
node --check .codex/scripts/design-lint.mjs
node --check .codex/scripts/test-design-lint.mjs
# exit 0 для обоих
python3.14 .codex/scripts/selftest.py
# PASS: 45 original roles + codex-docs; 22 skills; 5 lifecycle events; 3 MCP configs
# PASS: 90 source mappings, source freshness reviewed, native prompt sync, TOML/JSON and script syntax
# прежний WARNING Source files changed: .claude/commands/feature.md; exit 0
python3.14 .codex/scripts/sync-roles.py
# Drift: none; exit 0
git diff --check
# exit 0
```

Полный Python unittest baseline с известными 5FAIL+1ERROR в lifecycle/content-parity в этой области не менялся и здесь не объявляется зелёным; его исправление принадлежит координатору. Python3.9 не использовался для selftest, выбран доступный Python3.14 без установок. Новых зависимостей/скачиваний нет.

## SHA-256 / diff summary

- `.codex/scripts/design-lint.mjs`: `9f0ac6e57f178a02bf1d2b39861e16e18cf2ccc511c3ddfda7eb7220d32be29a`.
- `.codex/scripts/test-design-lint.mjs`: `383a20a372c779cf141ccea140eb62fbbb922c949b62ac353f57e5b32950bb73`.
- CLI tracked diff: 92 insertions, 35 deletions. Добавлены isolated subprocess suite и этот report; старые detection blocks не изменены.
- Хеш самого report возвращается отдельно (не включён в собственное содержимое).

Самопроверка scope: локальный функциональный PASS; открытых воспроизведённых дефектов назначенного scope после финальной suite не осталось. Это не substitute для независимого reviewer verdict или owner visual acceptance.
