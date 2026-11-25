# Friday: подтверждённые заимствования и локальная база сравнения

Дата: 2026-11-25. Audit-only. HEAD `388ec708f39583172d7f36110f6424cc175b5512`, свежий fetch показал HEAD=origin; working tree содержит чужие незакоммиченные изменения.

## История: источник доказан, а не угадан по похожим словам

| Commit | Что подтверждает сообщение и diff | Ограничение вывода |
|---|---|---|
| `392b1437c8ea290606ef30a8985811b9a60f5920` | Прямое `Port ideas from pbakaus/impeccable to fight AI-slop UI`: `docs/design.md`, design-reviewer, `/polish`, routing в CLAUDE. Историческая дата 11 июля 2026 | Это перенос идей, не полная установка текущего upstream v4 |
| `a16f574db2ab3f687727c15e7b36ee2350ef35d7` | `Extend Impeccable's anti-references idea beyond design`: негативные списки TypeScript/security/database | Речь о методике, не о текущем detector binary Impeccable |
| `357c1f612a9f0deb158efd31f6f777eb764378fc` | Добавлены motion/Apple guidance, easing, duration/gate/springs и animation lint rules; источник Kowalski назван в действующем `docs/core/motion.md:4–5` | Message не фиксирует upstream commit; version provenance не восстановлена |
| `9fa7681580aacf75ac7a1aa8fb59c8789205524f` | Dials variance/motion/density, brief inference, preflight, redesign order; исключён em-dash ban как неверный для русской типографики | Источник Taste Skill в message не назван. Сходство дials не доказывает конкретную upstream revision |
| `f88a597e447d021004bc8c71c9a1535fded13508` | Прямо `Extract methodology from ui-ux-pro-max`: UX checklist 10 категорий/P1–P10, design-department, design-system | Это четвёртый исторический источник, не надо ошибочно приписывать весь checklist трём текущим upstream |
| `98108cd8d065a1fa9f350cb7fe7a0bf239704412` | Перенос universal/project структуры; ui-ux-pro-max profiles, typography, MASTER/page overrides, design-lint token checks | Новые пути не означают новое происхождение или активную регистрацию |
| `8c6a67d837c8a5be88fa3f54c14dc0980e6c797b` | Reference extraction из design-dna; choreography из lottie motion-design-skill; не усреднять conflicting refs, hierarchy/vector/1⁄3/50ms/distance | Не приписывать choreography автоматически Kowalski только потому, что оно теперь в том же motion.md |
| `04b81153989a355c5d520ada46b5440b476f3f8c` | Portable wrapper в docs/core/templates; portability checker/selftest исправляли zero-file blind spot | Исторический исправленный checker не доказательство текущего execution PASS |
| `558b38a3` | Anime.js motion engine с reduced-motion wrapper | Это осознанный свой engine contract, не пробел из-за отсутствия Motion/GSAP |

Источники истории получены `git log -S/-G` и `git show --format=fuller`, scope docs/core, исторические docs/design.md/docs/motion.md, commands/skills. Работа не утверждает полный forensic audit каждого Git-коммита.

## Уже прочитанная координатором текущая база

| Файл | Содержание и конкретные положения | Полнота |
|---|---|---|
| `docs/core/design-principles.md:1–116` | Dials 21–45; anti-references 49–84; palette/contrast/type 88–102; MASTER priority 106–116 | full |
| `docs/core/motion.md:1–196` | Frequency gate 12–24; три cubic-bezier 26–51; durations 53–70; component motion 72–85; reduced motion 87–103; springs 105–119; choreography/perf/distance 140–176; Lottie 178–196 | full |
| `docs/core/typography-pairs.md:1–62` | Cyrillic check, pairs and roles, tabular nums, variable/swap/preconnect/link, max font families/weights | full |
| `docs/core/design-profiles.md:1–93` | Ecommerce/Luxury/Pet/SaaS/dashboard; landing patterns; brand overrides profile | full |
| `docs/core/ux-guidelines.md:1–183` | P1–P10; accessibility/touch/perf/style/layout/type/motion/forms/nav/data; explicit ui-ux-pro-max provenance | full |
| `.codex/agents/core/researcher.md:1–77` | Role boundaries and default stopping rules | full; file limit overridden by current user exhaustive scope |

Расширенное сопоставление actual roles/TOML/scripts выполняется специалистами и отражается в их source→Friday таблицах. Таблица выше не заявляет, что исполнительные механизмы запущены.

## Принцип итогового сравнения

Различать три слоя:

1. **Смысл уже перенесён:** инструкция/правило эквивалентны или осознанно адаптированы.
2. **Механизм реализован:** присутствует настоящий loader/checker/state store/test, а не только текст «проверить».
3. **Исполнение доказано:** выполнена проверка текущей revision. В данном audit-only этапе upstream код не выполняется; поэтому live capability не объявляется.

Current upstream source pin не реконструирует старую версию, из которой пользователь переносил идеи. Новые глобальные rules не внедрять без конкретной delta и runtime проверки. Наличие полезного содержания Taste не тождественно принятию всех opinionated house rules; наоборот, конфликт нескольких defaults не повод исключать весь repo до анализа.
