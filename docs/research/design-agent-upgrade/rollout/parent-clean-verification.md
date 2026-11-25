# Parent verification — clean export и dependency isolation

## Проверенная revision

Base HEAD `1b63e10d639d46767ddb3432d3f599f5a6e2ecd8`. Exact owned candidate и SHA каждого файла: локальный `~/.hermes/cache/scratch/design-rollout/publication-final-candidate.json`. Это source-only map, не commit и не утверждение remote CI. Материализован clean export из Git HEAD, а не копия dirty checkout; чужие untracked parity/media helpers отсутствуют.

## Реальные результаты

- Dirty working tree после добавления самостоятельного owner-policy regression: **79 Python tests, OK**.
- Clean prospective export: **60 Python tests, OK**. Различие раскрыто: чужие untracked parity/media tests не входят в candidate; ни один тест из опубликованного HEAD ради зелени не удалён.
- Clean prospective Node: **57 tests /57 pass /0 fail /0 skip** —42lint +14library +1dependency isolation.
- Clean selftest exit0, role sync `Drift: none`. Selftest сохраняет прежний WARNING по `.claude/commands/feature.md`; source-hash manifest ради сокрытия drift не переписан. Ложный дополнительный warning `.mcp.json` в первом subset export устранён включением настоящего tracked файла из HEAD.
- Clean motion integration: strict TypeScript с `skipLibCheck:false`, настоящий animejs4.5.0, SSR, headless Chromium и все существующие normal/reduced/dynamic/interrupt/repeat/destroy scenarios — exit0. Receipt: `~/.hermes/cache/scratch/motion-run-jY8iTG/receipt.json`.
- Standalone output: before53304bytes/raw20541gzip; after76780raw27077gzip. Это не production cost и не клиентская визуальная приёмка.

## Найденный и исправленный дефект воспроизводимости

Исходный parent replay в рабочем checkout был GREEN, а **тот же test из чистого export** был RED:
`animejs/dist/modules/text/split.d.ts:31: Cannot find namespace 'NodeJS'`.
Изолированный prefix содержал animejs/TypeScript/esbuild/playwright-core, но не `@types/node`. Компилятор неявно находил ambient types в `Friday-claude/node_modules`; чистое дерево этой зависимости не имело.

Исправление ограничено test harness и pilot dependency lock/package:
- `@types/node@22.20.5` установлен только в разрешённый scratch prefix, с `--ignore-scripts --no-audit --no-fund --save-exact`.
- Compiler явно получает `types:['node']` и `typeRoots:[<MOTION_DEPS>/node_modules/@types]`.
- До компиляции обязательная проверка изолированного `@types/node/index.d.ts`; отсутствующий dependency — понятный FAIL, не ambient fallback.
- Не использованы skipLibCheck, `any`, фиктивный NodeJS namespace или production fixes. Motion template не изменён.

Новый негативный regression `test-motion-dependency-isolation.mjs` создаёт dependency prefix с четырьмя реальными module symlinks, но **без** Node types. Запускает harness из исходного repo (ambient types там есть), с несуществующим browser path: корректная реализация обязана отказать до strict-TS PASS или запуска браузера. Исходная версия доходила до browser launch — valid RED; исправленная отказала именованным diagnostic —1/1 GREEN. Первую попытку RED с отсутствовавшим fixture lock нельзя считать behavioral evidence; lock добавлен до valid RED.

Повторение:
```sh
export TMPDIR="$HOME/.hermes/cache/scratch"
export MOTION_DEPS="$HOME/.hermes/cache/scratch/motion-stage04"
export MOTION_BROWSER="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell"
node --test .codex/scripts/test-motion-dependency-isolation.mjs
node .codex/scripts/test-motion-template.mjs --integration
```
Для нового prefix скопировать pilot `dependencies.package.json` как `package.json`, `dependencies.lock.json` как `package-lock.json` и выполнить `npm ci --ignore-scripts --no-audit --no-fund` только в нём. Browser должен реально существовать; автоматической установки/скачивания нет.

## Маршрутизация surface policy

Parent добавил три integration contracts; наблюдён RED на отсутствующие routes, затем GREEN. CODEX, invoked design-system command/SKILL, taste-curator MD и зарегистрированный TOML направляют в `docs/core/design-surface-workflow.md`, явно называют Persuade/Operate/Read/Experience и identity/refinement lock. Main route описывает task-first workflow, scoped fonts/layout, temporal evidence и неизменность authority/gates. Это подключение инструкции, не установка новых slash-команд или runtime.

Stage03 originally-authored routing test ошибочно требовал три утверждения из чужого dirty media baseline; exact publishable версия проверяет существующий HEAD и собственные brand/MASTER/page/reference obligations. Чужие production gates в рабочем checkout не удалялись. Полный foreign baseline не публикуется.

## Чего это не доказывает

Независимое review parent-specific delta выполняется отдельно; до него candidate не принят к публикации. Browser только headless Chromium на текущем Mac; нет физического touch, Safari/Firefox/device, keyboard-complete widget, клиентского owner acceptance, IDE reload или GitHub Actions PASS. Права/бюджет/доступы внешних интеграций не заменяются тестами.
