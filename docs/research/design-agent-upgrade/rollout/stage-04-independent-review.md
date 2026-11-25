# Stage04 motion — независимое review + replay

## Verdict: PASS (technical template/drag pilot only)

Ревьюер: Hermes leaf subagent `stage04-independent-review` (не implementer).
Исполнены адаптированные роли `code-reviewer` и `qa-engineer`; полные role MD,
`.codex/CODEX.md` и `review-loop.md` прочитаны. Отдельный bounded secrets verdict ниже.
Git, source fixes, установки, внешняя сеть, paid services, headed browser и
делегирование не использовались. Единственная repo-запись — этот отчёт;
дополнительные probes/мутация/receipts находятся только в Hermes scratch.

**Findings:** критичных проблем не обнаружено. Подтверждённых blocking findings нет.
PASS не закрывает продуктовую accessibility/design/production приёмку.

## Scope / content revision

Проверены целиком `docs/core/templates/motion.ts`, `docs/core/motion-engine.md`,
`.codex/scripts/test-motion-template.mjs`, fixture TS/HTML, motion pilot report,
ledger и RED/GREEN JSON; lock/остальные motion text включены в bounded scan.
Идентификация revision по содержимому, без Git:

| Файл | SHA-256 |
|---|---|
| `docs/core/templates/motion.ts` | `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3` |
| `.codex/scripts/test-motion-template.mjs` | `d0a0cee963f1094f3c588001c0703a41e3a7bb7f46e5c7ce0f34cc6f28cbb591` |
| `docs/core/motion-engine.md` | `fd0fb024c5b860ebe33fb65dc1b706c7319e4d3037052bf0cf2fe7ea16a9e77f` |
| `motion-pilot/fixture.ts` | `f85ef00cb67bad96af7529d63c9c4a8be6cdabad5b99ff9300eccd891fab8d1c` |
| `motion-pilot/fixture.html` | `09fb978e1c9a301feb0918750bc62a5e8cab14dff2528f499e625bc1d1b30244` |
| `motion-pilot/dependencies.lock.json` | `125f97d0c2e6c6eef0e4196b4c31781d8a16d80854fb5ba9e0a491169c2ad457` |

Все пять значений `source-hashes.json` совпали с фактическими файлами.

## Выполненные проверки

Фактически запущено из `/Users/germanbryzgalov/Friday-claude`:

```sh
MOTION_DEPS="$HOME/.hermes/cache/scratch/motion-stage04" \
MOTION_BROWSER="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell" \
node .codex/scripts/test-motion-template.mjs --integration
```

**Exit 0**: export contract; strict TypeScript с настоящими declarations
(`strict:true`, `skipLibCheck:false`, не только transpile); actual-engine SSR;
real headless temporal pilot. Версии: Node v24.21.0, animejs 4.5.0,
TypeScript 5.9.3, esbuild 0.28.2, playwright-core 1.65.1.

Независимый receipt:
`/Users/germanbryzgalov/.hermes/cache/scratch/motion-run-RdjGs8/receipt.json`
SHA-256 `8a4f9fea337ce2a1b90168193553afef9368277ba78c28e71c32fd6496d0ecf0`.

- SSR import без DOM успешен; factory возвращает null; subscription cleanup вызывается.
- Нормальный drag действительно двигает DOM: release x=150 → mid x=156.99949645996094;
  наблюдается инерция, а не синтетическая интерполяция теста.
- Off-center grab без скачка; re-grab останавливает уже начавшуюся инерцию;
  duplicate mouseup не дублирует release; следующий drag работает; natural settle стабилен.
- Initial reduce сохраняет direct drag, отменяет release motion; release callback один.
- Dynamic reduce останавливает уже наблюдаемое движение: x=162.18899536132812
  до смены и после неё. Restore не воспроизводит старую инерцию; новый жест снова движется.
- Preference change во время held drag не выключает pointer-follow; release затем неподвижен.
- Destroy live drag и release inertia: media adds/removes=1/1, enabled=false,
  paused tickers/animations, нет поздних update/release и drift; возврат inline position к x=40
  — намеренный unmount revert. Все девять записанных stable RAF traces имеют rangeX=0.
- Cancelable synthetic touchstart после destroy не prevented; page errors пусты.

### Cleanup действительно проверен RED, не только чтением receipt

В **отдельной scratch-копии** runner/source/fixtures удалён только grabbed cleanup
блок `motion.ts:166–172`; native `revert()` сохранён. Повторная integration:
strict TS/SSR PASS, затем **exit 1** на `test-motion-template.mjs:202`:
`destroy must remove engine touch-prevention listeners during a live drag`, `true !== false`.
Это подтверждает чувствительность regression test к настоящему дефекту native teardown.
Оригинальный checkout при мутации не менялся.

Mutant receipt:
`/Users/germanbryzgalov/.hermes/cache/scratch/motion-run-61yqsH/receipt.json`
SHA-256 `ca9f26bb3377bec485abbdc02323f210f81580de53d43fb9f0ddf7285405dcda`;
mutant template SHA-256 `7306d331220aa78ea13fa79b7915ed4a1c4d77796905b6f197d97c9ff516cb67`.

### Дополнительные независимые lifecycle probes

`node /Users/germanbryzgalov/.hermes/cache/scratch/stage04-independent-probe.mjs`
— **exit 0**. Настоящий wrapper/engine, headless mouse: consumer вызывает wrapper
`destroy()` из `onRelease`, `onUpdate` и `onSnap`. Во всех трёх случаях handle выключен,
после destroy нет callback-вызовов за наблюдаемые 500ms и нет оставшегося touch preventer;
ложного semantic release при teardown не появилось. Page errors пусты.
Отсутствующий selector отдельно даёт native TypeError, не ложный SSR/null success;
factory не обещает обработку отсутствующего browser target. Это не blocking finding.
Исключения, бросаемые consumer callbacks, не сертифицированы этими probes.

Receipt: `/Users/germanbryzgalov/.hermes/cache/scratch/stage04-independent-probe.json`
SHA-256 `0103b42d26cf2d28a86ce75ffcdca801af8133add4c6e4b39528b21ad51c794e`.

## Preservation и bundle cost

После удаления одного нового import, appended export block и одной разделительной
пустой строки восстановленная основа **побайтно равна** существующему old snapshot
`/Users/germanbryzgalov/.hermes/cache/scratch/ps-loading-states/docs/core/templates/motion.ts`:
5446 bytes, 122 строки, SHA-256
`a7572e26ccca3dbd84e0a1fa7b4160b82d63d2a82a0d39e1fa6d15804efb8ed4`.
Это не выдаётся за проверку Git baseline: Git не использовался.
Прежние animate/spring/scroll/constants/exports не переписаны.

Независимая сборка воспроизвела before **53304 bytes / 20541 gzip**, after
**76780 bytes / 27077 gzip**: delta **23476 raw / 6536 gzip**. Метод runner: одинаковая
minified ESM сборка whole-wrapper/export surface с теми же installed dependencies.
**Это не production application bundle cost**; consumer imports/tree-shaking меняют цену.

## Контракт и обязательные остающиеся gates

- `motion.ts:145–155`: cancellation до/после consumer release и live preference guard
  соответствуют порядку native engine 4.5 (`handleUp` планирует motion до onRelease).
- `motion.ts:160–173`: wrapper destroy снимает media subscription и через muted
  release/snap/update/settle + handleUp завершает active event teardown перед revert.
- `motion-engine.md:96–128`: unmount обязан использовать **возвращённый wrapper.destroy()**.
  `.draggable` — явный unsafe escape hatch; direct revert/enable/callback replacement/
  direct animations обходят policy и не сертифицированы этим PASS.
- `motion-engine.md:130–140`, `fixture.html:3`: честный **drag-only**, не keyboard widget.
  **Для продукта обязателен доступный эквивалент без dragging**, keyboard/focus/ARIA и
  подходящий APG pattern; один tabindex не закрывает gate. Fixture этого не реализует
  и не заявляет. Без этого продуктовую acceptance считать пройденной нельзя.
- Не проверены физический touch/pen, Safari/Firefox, screen reader, pointer capture,
  device latency/GPU, production integration и полный upstream option matrix.
  Synthetic touchstart доказывает только удаление preventer, не реальный touch gesture.
  Отдельного offscreen сценария здесь нет; старые scroll/animate semantics сохранены,
  но drag pilot их заново не сертифицирует. Визуальная owner acceptance не выдавалась.

## Отдельный bounded security-secrets-scanner verdict: PASS

Полная роль и `security.md` §13 прочитаны. Дополнительно проверены фактические
motion source/docs/runner и все файлы `motion-pilot/` на момент audit, включая
lock, receipts и появившийся parent-replay: **17 файлов / 173187 bytes**, 7 групп
сигнатур (provider keys, private keys, JWT, literal credentials, URL credentials,
registry auth). Совпадений нет. Утечек секретов в этом scope не обнаружено.
Lock integrity/SHA-256 — ожидаемые публичные checksums, не секреты.

Это отдельная ограниченная secrets-проверка тем же реальным leaf reviewer, **не**
вымышленная дополнительная сессия/полный репозиторный security audit. Для общей
template-области отдельного project security profile нет; стек определён по lock.
Git history, tracked env, CI, прочие проекты, CVE/network audit и ротация вне scope
и не выполнялись. Этот verdict не заменяет secrets gate более широкой публикуемой дельты.

Audit evidence (полные file hashes, прошлые RED/GREEN результаты, preservation,
secrets coverage, replay trace summary):
`/Users/germanbryzgalov/.hermes/cache/scratch/stage04-independent-audit.json`
SHA-256 `efc88c212cc56b2d98f6424226716f2d09996f0d8e05a5f38ea153ff509c42a5`.
Scratch evidence временное; исходные durable pilot receipts остаются в repo.
