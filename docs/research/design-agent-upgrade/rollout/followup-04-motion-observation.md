# Follow-up 04 — наблюдение захвата во время инерции

## Статус и границы

Локальный кандидат исправления тестового наблюдения, не production-исправление и не
доказательство успешного GitHub Actions. База текущего checkout:
`c10a97d7e80d805087889efc448ee3e0aafb5234` (параллельный journal-коммит сохранён).
Никаких commit/push/dispatch/install, провайдеров, клиентских изменений или видимого браузера.
Независимые ревью и реальный Linux/GitHub запуск остаются координатору.

Разрешённые файлы: исходные три CI-файла, `.codex/scripts/test-motion-template.mjs`,
`.codex/scripts/lib/motion-observation.mjs`, `.codex/scripts/test-motion-observation.mjs`
и этот отчёт. Production `docs/core/templates/motion.ts` и fixture не изменены.

## Подтверждённая причина

Изначальный parent replay упал с `grab must not jump to pointer center` при restored
inertia. Исходные receipts неизменны:
`~/.hermes/cache/scratch/design-ci-parent-06580sea/final/motion.json` и
`~/.hermes/cache/scratch/motion-run-xGp9pj/receipt.json`.

Read-only scratch-копия HEAD runner воспроизвела то же утверждение с контролируемой
80 ms задержкой между прежним before snapshot и настоящим mouse.down. Из диагностики
убрана только дорогая mid screenshot, чтобы гарантированно наблюдать ещё живую
инерцию; engine, fixture и порог 1 px сохранены. Receipt:
`~/.hermes/cache/scratch/motion-run-CUokxC/receipt.json`.

- Старый before: x=174.385498046875; последующий after: x=187.4467010498047.
- Старое измерение классифицировало 13.061203002929688 px как скачок.
- Capture и target-bubble **одного trusted mousedown** (timeStamp=1051.300000011921):
  обе позиции x=187.4467010498047, actual event target=tile.
- grabbed: false → true; inertiaPaused: false → true. Реального скачка здесь нет.
- Window bubble не подходит: настоящий animejs handleDown вызывает stopPropagation.
  Поэтому after-listener стоит на tile после engine listener, в том же dispatch,
  без дополнительного rAF/таймера/микрозадачи между границами.

Первая диагностическая попытка с 60 ms прошла без продвижения x. Это не доказательство
исправности: `motion-run-nHFkKm/receipt.json` сохраняет этот неубедительный контроль.
Позднее latency-регрессия также обнаружила настоящий промах устаревшей геометрии:
`motion-run-uKuUv3/receipt.json` (отсутствует after bound). При искусственной задержке
тест теперь заново наводит реальную мышь по свежему bbox; инерция при этом не
останавливается. Промах остаётся ошибкой, он не превращается в PASS.

## Изменение и RED/GREEN

Каждый grab вооружает observer новым id. Capture сохраняет before и ссылку на
настоящее событие; target-listener сохраняет after только для той же ссылки.
Утверждения требуют trusted input, tile target, фактический grab и остановку инерции,
а затем прежний строгий порог `<1px`. Receipt сохраняет только этот actual press.
Внешняя interrupt-проверка `<30px` также сравнивает границы события; независимый
held-stability trace сохранён. Все normal/reduced/dynamic/inertia/interruption/
repeat/destroy assertions остаются в runner.

1. Старый реальный headless replay с контролируемой задержкой: RED, тот же assertion.
2. Unit на легальное продвижение до события: RED со старой формулой before/after;
   переход на event bounds: GREEN.
3. CI contract сначала RED при отсутствии нового executable suite и неверном порядке
   установки браузера. Workflow теперь запускает четыре Node suite после браузера;
   официальный Actions pins и разрешения не изменены.
4. Новая suite: восемь unit cases и два настоящих browser subprocess cases.
   Положительный case выполняет полный replay с 80 ms latency и требует actual
   pre-event advance >1px. Негативный case внедряет в scratch-копию реальный
   `style.translate='12px 0px'` target-handler после engine и до observer-after.
   Это меняет DOM, не snapshot и не mock engine; runner обязан упасть на прежнем
   no-jump assertion, receipt обязан показать actual same-event delta >=12px.

Scratch evidence/proposal/map: `~/.hermes/cache/scratch/motion-observation-worker/`.
Первый новый test harness ошибочно использовал inherited системный TMPDIR для двух
временных деревьев; это исправлено до финальной проверки на HOME scratch (как runner).
Финальные команды явно задают TMPDIR под разрешённым scratch.

## Проверка текущего кандидата

Полный локальный прогон выполнен на реальном текущем ROOT и отдельно на точном
архиве HEAD `c10a97d7e80d805087889efc448ee3e0aafb5234` + только семи owned files,
включая `.github`. Чужая грязная работа не попадает в overlay.

| Gate | Working ROOT | HEAD + owned overlay |
|---|---|---|
| Полный Python discover | 95 PASS | 88 PASS |
| Четыре Node suite | 74 PASS, 0 fail/skip | 74 PASS, 0 fail/skip |
| Selftest | PASS, без freshness warning | PASS, без freshness warning |
| Readonly sync | Drift: none | Drift: none |
| Strict TS + SSR + полный normal replay | PASS | PASS |
| Следующий последовательный полный replay с latency=80ms | PASS | PASS |

Разница Python counts — существующий foreign content-parity suite (7 cases), не
исключения/skip. Среда: существующие Node 24.21.0 и Hermes Python 3.14.9; animejs
4.5.0, TypeScript 5.9.3, esbuild 0.28.2, playwright-core 1.65.1. Existing isolated
deps `~/.hermes/cache/scratch/motion-stage04`, existing Chromium headless shell
1255; запуск всегда `headless:true`, без bringToFront/native open. Новых установок нет.

`verification-results.json` содержит команды/exit/logs, `trace-summary.json` —
actual event deltas и пути. В завершённом комплекте normal/latency replay плюс
Node browser regressions дают шесть положительных полных replay и два ожидаемых
отрицательных mutant replay. Все положительные event deltas равны 0; реальные
mutants дают ровно 12px и exit 1. Controlled advance до события >1px подтверждён
на ROOT и overlay; это не ожидание settling, CPU stress или замена engine.

`source-guard-before.json` / `source-guard-after.json` сравнивают все docs/core и
motion-pilot fixture bytes. `head-production-identity.json` отдельно подтверждает
тождество production/fixture между исходным aa69a378, текущим c10a97d7 и ROOT.
Production SHA-256:
`a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`.
`proposal-map.json`, `proposal-overlay.tar`, `proposal.patch`, `final-head-source.tar`
сохраняют точную candidate provenance; copies receipts лежат в `receipts/`, исходные
parent failures не изменены. Self-reference hash отчёта хранится только во внешней карте.

Первый package aggregation остановился до формирования карты из-за отсутствующей
папки receipts; mkdir исправлен, затем реальные receipts собраны без изменения исходников.
Предыдущий CI-report PASS — исторический результат раннего worker, а не текущий verdict;
parent replay его опроверг. Нельзя считать публикационный gate закрытым без новых
независимых ревью и реального GitHub Actions.
