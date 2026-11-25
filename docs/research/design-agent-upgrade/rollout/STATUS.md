# Design rollout — текущее состояние

**2026-11-26: локальное delta-only ядро принято, проверено и опубликовано.** Координатор — Джарвис; владелец — Гермес. Основа Friday, существующий roster, brand/MASTER, safety/rights/owner gates и клиентские проекты не заменялись. Upstream runtime/hooks/account sync не устанавливались.

## Принятые implementation этапы

| Этап | Содержание | Exact stage tree tests | GitHub commit |
|---|---|---|---|
|01|Lint exits0/1/2, JSON и фактический coverage, прежние guards сохранены|37Node; independent code/TS/secrets PASS|[1b63e10d](https://github.com/1Herman1/Friday-claude/commit/1b63e10d639d46767ddb3432d3f599f5a6e2ecd8)|
|02|Conditional owner-policy config/startup, canonical lifecycle fixtures, самостоятельный published regression|49Python +37Node; selftest/role sync PASS|[f4c6a8ab](https://github.com/1Herman1/Friday-claude/commit/f4c6a8ab8c77379214f8b8756f060f3b5634ab65)|
|03|Полные Taste records/INDEX, readonly CLI, CODEX/command/SKILL/taste MD+TOML routing|53Python +51Node; selftest/role sync PASS|[e2d59981](https://github.com/1Herman1/Friday-claude/commit/e2d59981c2dad3821d4b9c83eba7fc21162481fd)|
|04|Typed createDraggable, реальный animejs4.5.0 pilot и изолированные type dependencies|53Python +52Node; strict TS/SSR/headless integration PASS|[ee24dc56](https://github.com/1Herman1/Friday-claude/commit/ee24dc5645817290b9aa5da7756453e970f5a98c)|
|05|Per-surface playbook и effective routing, узкий MASTER font exception|60Python +57Node; strict TS/SSR/headless integration PASS|[82a1d684](https://github.com/1Herman1/Friday-claude/commit/82a1d6847365adb3ecb9dfaeec3b0c7fb6e96fa9)|

Каждый remote commit/tree прочитан обратно через GitHub API. Только существующая `claude/greeting-nnz368`, без новых веток/PR/force-push. Каждый stage task gate на момент своей приёмки: ready=true, reasons=[]. Последующие разрешённые этапы могут менять ранее проверенный scope. Source/index preservation проверено перед и после публикации. [Actual verification](final-verification.json), [порядок и инварианты](PLAN.md), [ownership algorithm](publication-ownership.md).

## Что включено в действующие инструкции

- **64 palettes /39 typography /11 hero families /27 diagrams:141 полная запись**, stable IDs, nested fields, pinned source hashes и MIT notice. [Полные поэлементные списки](../../../core/design-library/INDEX.md). Сторонние font/photo/logo binaries не импортировались.
- `.codex/CODEX.md` → design-system command/исполняемый SKILL и taste-curator MD/registered TOML → INDEX → реальный readonly `design-library.mjs`. Все141ID прошли lookup; независимые deletion mutants ссылок давали FAIL.
- `docs/core/design-surface-workflow.md`: per-page Persuade/Operate/Read/Experience, identity/refinement lock, task-first structure, copy/voice без fabricated claims, states, responsive/a11y и temporal evidence. Это intents/playbook, не новые slash-команды или runtime.
- Font exception только для точного parsed имени в MASTER целевого проекта: чужой active не одобряет target без MASTER. Independent72adversarialcases PASS. Regex не различает body/display роли и не вычисляет WCAG; manual identity/a11y review обязателен.
- Hero/nav/list numeric defaults не universal hard-fail Read/Operate; реальные clipping/hit-area/a11y blockers остаются. Decorative bounce не разрешён под видом inertial spring; no-overshoot/reduced-motion contracts сохранены.

## Motion evidence и ограничения

Реальный headless Chromium: before/mid/settled captures, normal/reduced, dynamic preference при inertia/hold, interruption/no-jump, repeat release, destroy drag/inertia, listener/touch-preventer cleanup. Strict TypeScript against real declarations и SSR реально исполнены.

Чистый export обнаружил скрытую зависимость harness от root `@types/node`: dirty-tree GREEN, clean-tree RED. Теперь типы явно из isolated prefix/lock, negative test запрещает ambient fallback; без skipLibCheck или фиктивных declarations. [Parent verification](parent-clean-verification.md), [final parent review](final-parent-delta-review.md), [independent motion code/QA](stage-04-independent-review.md), [fixture design review](stage-04-design-review.md).

Drag-only pilot не готовый keyboard/a11y widget. Продуктовая keyboard alternative, semantic/cancel behavior, physical touch, Safari/Firefox, отдельный offscreen/hidden-tab scenario, performance/device latency и client owner visual acceptance не сертифицированы. Standalone bundle measurement не production bundle delta.

## Working tree, publishable tree и CI

- Полный working-tree suite: **79/79 Python PASS**, включая существующие незавершённые parity/media suites.
- Exact clean implementation tree: **60/60 Python +57/57 Node PASS**, strict TS/SSR/headless integration PASS; selftest exit0, role sync Drift:none.
- Разница раскрыта: чужие preexisting untracked parity/media файлы не присвоены, не опубликованы и не затёрты. Рабочие файлы own adaptations остаются локальными; точные [owned patch artifacts](compatibility-deltas.json) сохранены отдельно, не выданы за installed baseline. Весь foreign baseline — отдельный scope/handoff.
- Прежний selftest source-freshness **WARNING `.claude/commands/feature.md` остаётся**: HEAD hash не совпадает с историческим migration manifest. Это известная до внедрения несогласованность, не новый test failure; manifest ради зелени не переписан.
- GitHub Actions API для implementation SHAs вернул пустые списки. **Remote CI PASS не заявляется**: push, local tests и Actions execution различаются.
- Открытая native Codex IDE не перезагружалась: registered payload parity и CLI проверены, live activation текущей IDE session не обещана.

## Внешнее продолжение — отдельно

Figma/Canva MCP не подключены: прежние confirmation cards истекли. Для нового setup нужны запрос владельца и sandbox target/права. Remotion MP4 и Herdr runtime/recovery pilot не выполнялись; их доступ/seat/лицензия/target/owner gates сохранены в [IMPLEMENTATION.md](../IMPLEMENTATION.md). Полный Reddit scrape заблокирован. Эти направления не выдаются за зелёные интеграционные тесты или готовые роли.

Reusable workflow и lookup routes сохранены в локальном `friday-studio` skill Джарвиса; смысловой итог — `.codex/sessions/2026-11-26-design-rollout.md`. Исследовательские reports сохраняют исторические revision hashes; актуальные implementation результаты — в этом ledger и final-verification.json.
