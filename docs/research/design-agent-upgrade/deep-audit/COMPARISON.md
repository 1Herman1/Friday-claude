# Сравнение Impeccable → Kowalski → Taste → Friday

**Сравнительная сводка R2, после независимого ревью.** Закрыты разборы всех навыков, canonical references и назначенных реализаций; справочные/генерируемые данные имеют отдельные статусы покрытия. Authored test infrastructure не приравнивается к fixture data: пять helpers после R2 review разобраны отдельно в `support-authored-test.md`. Это статический анализ, не runtime/security/visual PASS и не утверждение ручного прочтения каждой копии, fixture или картинки. Подробные source:line, методы и ограничения — в отчётах и coverage ledger. Источники зафиксированы по SHA, а не по движущемуся `main`.

Статусы: **есть** — найден смысловой аналог; **частично** — механизм/глубина отличаются; **дельта** — не найдено в явно осмотренной общей базе; **конфликт** — существующая политика требует решения, не слепого переноса. Указание «есть» не доказывает live-исполнение.

Уровни доказательств: **MD** — доктрина; **registered TOML/SKILL** — зарегистрированный instruction payload; **script/template** — конкретная реализация; **observed runtime** — только реальный receipt/запуск. Шаблон `docs/core/templates/motion.ts` сам не входит в клиентские bundles. Его пробел не распространяется автоматически на все клиентские wrappers.

## 1. Impeccable — что уже перенесено и что изменилось

Доказанное заимствование: Git `392b1437` и `a16f574d`. Текущий pinned upstream содержит не только markdown, но собственный движок и состояние проекта. Переносить весь продукт ради нескольких playbooks — другое решение, чем дополнить Friday правилами.

| Возможность и наполнение upstream | Что уже есть у нас | Статус | Что добавлять / не дублировать |
|---|---|---|---|
| Anti-references: шрифт по умолчанию, неуместные градиенты/glow, nested cards, слабая иерархия | `docs/core/design-principles.md:49–102`, design-reviewer, domain negative lists | Есть; происхождение доказано | Сохранить. Не создавать второй список той же базовой доктрины |
| Polish: целостный final pass; blockers/a11y/states раньше косметики | `.codex/commands/polish.md`, соответствующий SKILL | Частично | Уточнить приоритет работ и identity-preserving refinement, без второй `/polish` |
| Visitor modes Persuade/Operate/Read/Experience на уровне конкретной поверхности | Доменные ecommerce/SaaS/dashboard профили | Частично | Добавить **surface mode**, не новый бренд: landing SaaS=Persuade, editor=Operate, docs=Read |
| Shape/init: task, реальная аудитория/материал/состояния, material gaps, non-goals | planner, project.md, brand.md, design-system | Частично | Дополнить существующий brief, не создавать конкурирующий PRODUCT authority |
| Typeset: optical sizing, wrap balance/pretty, fallback metrics, длинные реальные строки/zoom | Шрифтовые пары, кириллица, measure, tabular nums, swap/preconnect | Частично, база уже сильная | Добавить font-loading/optical/long-label доказательства; сохранить RU filter |
| Layout: spatial thesis, proximity before boxes, structural adaptation и extremes | 4/8 rhythm, grids/breakpoints/mobile, MASTER | Частично | Явный argument hierarchy/grouping и reading/focus order, не ещё одна стандартная сетка |
| Colorize: semantic roles, contrast всех состояний, deliberate dosage, OKLCH для новых систем | Role/on-role пары, AA, 1accent+neutral+semantic | Есть основа; часть defaults конфликтует | Не переопределять выбранный бренд. Цветовые defaults отличать от проверяемого контраста и функциональной семантики |
| Scoped typography: brand-display, body и UI font — разные роли | MD запрещает Inter/Arial/system **по умолчанию как главный бренд-шрифт**, а `typography-pairs.md:29–30` уже допускает Inter-body | Есть scoped доктрина; конфликт в реализации | Исправлять blanket regex `design-lint.mjs:9–12`, а не заново разрешать уже разрешённый body. Наш synthetic Inter probe не является owner approval или MASTER registration |
| Surface-aware geometry против жёстких универсальных чисел | `audit-design.md:22–27`, `polish.md:26–31` и вызываемые SKILL блокируют hero >2 строк, nav >80px, списки >5 без grid/tabs/carousel и несколько акцентов | Собственные opinionated hard-fails Friday; конфликт в Read/Operate | Нужен scope по поверхности/домену и evidence. Трёхстрочный помещающийся RU hero и читаемый длинный список не должны автоматически считаться дефектом; реальные clipping/navigation/a11y defects остаются блокерами. В этом аудите правила не отменены |
| Critique: независимое суждение A **до** detector B, затем synthesis | audit-design запускает lint и отдаёт findings дизайнеру | Частично / методологическое отличие | Разделить design critique и technical audit: первому независимый визуальный взгляд, второму детерминированный слой |
| Audit: a11y/perf/theming/responsive/native evidence, unknown ≠ clean | UX P1–P10, профильные reviewers, lint/screenshots | Частично | Разделить проверено/не измерено; не называть regex измеренным WCAG |
| Harden: stress inputs, localisation, retries/input preservation, cancel/lostcapture/blur/multitouch | Loading/error/empty, Intl, state preservation, undo | Частично | Полная матрица данных/состояний/отмены жеста; tests после cancelled drag |
| Onboard: first value, first-use vs cleared/no-results/no-permission/error, account+version completion | Empty next-step и общие UX правила | Частично | Отдельный workflow активации по реальному продукту, не обязательный tour всем |
| Clarify: единый словарь, microcopy каждого состояния, конкретные последствия действия | marketing-agent, filler lint, формы/errors | Частично | Source-backed glossary и flow-level copy review |
| Document/extract: фактическая система **после** build, reused token vs local exception | MASTER before build, запрет silent overwrite | Частично | Extract/refresh существующего MASTER по actual code; не канонизировать дефект/неиспользуемый planned token |
| Motion reviewer: normal/reduced temporal packet, before/first/middle/last/settled, entry/exit/interrupt | Motion doctrine и still screenshot workflow | Доказанная дельта проверки | Ввести temporal acceptance; скриншот остаётся layout evidence |
| Live/generate: реальные варианты, browser choice, source injection/cleanup/journal | Dials/reference selection и обычный coder | Дельта, но отдельный большой runtime | Не активировать автоматически. Вкус/варианты можно внедрить без всего executable suite |
| Runtime detector/context/hooks/cache | Наш PostToolUse lint, session/hash cache, token checks, lifecycle/task_gate | Уже есть механизм, coverage частичная | Не «добавить первый линтер», а сравнить missing checks, выходные статусы, области сканирования и side effects |

## 2. Kowalski — базовая моторика уже наша

Все 36 upstream файлов прочитаны: 20 skills, девять reference-файлов и служебные файлы. Source-only prompt/reference pack, а не собственный бинарный engine.

| Возможность и наполнение upstream | Что уже есть у нас | Статус | Точный полезный delta |
|---|---|---|---|
| Animate-or-not frequency gate: keyboard/100+ none, frequent reduce, occasional normal, rare delight | `docs/core/motion.md:12–24` | Есть | Не дублировать |
| Три custom easing и duration ranges, press scale.97, trigger origin/modal center | `motion.md:26–85`, template EASE/DURATION | Есть; точные совпадения | Не «внедрять новые кривые» под новым именем |
| Reduced motion и interruptibility | motion.md + apple-patterns + wrapper | Есть доктрина; полнота реализации не доказана | Проверять реальное изменение preference, active animation и nested/keyframe cases |
| Decorative bounce preset ≠ carried-velocity gesture spring ≠ Taste no-overshoot preset | `design-principles.md:76–78` объявляет ban, но `motion.md:105–119` допускает damping≈0.8, template:70–77 переводит его в bounce0.2; regex ловит лишь animate-bounce/ease-elastic | Частично / конфликт scope | Зафиксировать разрешённую inertial exception и запрет беспричинного декоративного bounce; не отвергать spring по имени option. Taste no-overshoot — отдельный opt-in preset. Реальное движение/overshoot здесь не тестировались |
| Choreograph: cast lead/support/static, один entrance на контейнер, nonuniform hierarchy, полная длительность волны | Стаггер, hierarchy/vector, 1/3, 50ms heterogeneous start, distance duration | Частично | Дополнить group ownership/one-entrance/interrupt semantics, не стереть локальные исключения |
| Remove-animations: убрать безопасно, не оставить opacity0, callback/transitionend/timeouts/focus dependencies | Frequency gate и запрет бессмысленной анимации | Дельта процедуры | Subtraction workflow с zero-reference cleanup и regression; без ретюнинга «вместо удаления» |
| Improve/find/review: полный motion inventory, exact plans с revision/code quote/drift stop, rejected candidates | Review-loop и эксперт-spec→executor | Частично | Persistent animation plan/reconcile и frequency map, не новый оркестратор |
| Break-ui: каждое rendered value, mixed worst-case fixtures, 0/1/huge/long/RTL/emoji, 320px/200% | Общие UX edge cases/Intl/empty/loading/error | Частично | Единый dev-only stress harness и data fixtures, без реальных клиентских ПД |
| Mobile-native web: hover capability, input16px, svh/dvh по смыслу, safe-area web, scroll axis, keyboard/theme | Mobile-first,16px body,touch manipulation,44px,часть native safe-area | Частично | Мобильный web checklist по симптомам и реальные проверки iOS/Android |
| Gestures: raw1:1 tracking, capture, velocity projection, interruption/regrab, cancel paths | Apple доктрина; engine doc обещает createDraggable | Доказанный local contract gap | `motion-engine.md:47` обещает export, в полном `templates/motion.ts` его нет; сначала согласовать/реализовать контракт, не импортировать Motion/Vaul вслепую |
| Animation-performance: driver/property/trigger/cause, реальный frame profile, main-thread vs compositor | transform/opacity, will-change, offscreen pause, DOM batching | Частично | Причинная диагностика и temporal/frame evidence; CPU throttle не выдавать за мобильный GPU |
| Learn-taste: quote/diff→owner final value→why→class/scope→duplicate/conflict→test candidate | Архив/память/taste reference library | Частично по намерению; процесса нет в осмотренной базе | Project-scoped correction ledger. Это не то же, что подбор референсов taste-curator |
| Prototype: 3 реально разные рабочие версии, один piece, isolated route, owner choice→promote→cleanup | Reference picker/обычная разработка | Дельта процедуры | Локальный functional variant harness, без production imports; адаптировать28px upstream picker под наши hit areas |
| Native Expo/Swift/Sonner/library chooser/vocabulary | React-native skill, component-curator, мини-словарь | Частично / task-dependent | Подключать под реальную задачу/installed stack, не на каждый web проект |

## 3. Taste Skill — самостоятельный полезный слой, не исключённый кандидат

Текущий Taste — **методика + библиотека положительных рецептов + vanilla implementation kit + browser QA**. Не сводить его к dials и не отвергать целиком из-за opinionated house rules. Исторический перенос именно из Taste в Friday пока не доказан: dials совпадают по идее, но source attribution в соответствующем Git-коммите отсутствует.

| Возможность и наполнение upstream | Что уже есть у нас | Статус | Что добавлять |
|---|---|---|---|
| Copy до markup: fact sheet, claim→proof, reader questions задают sections | marketing-agent, реальный brief/brand, filler ban | Частично | Единый source-backed fact sheet, не выдумывать недостающий proof |
| Voice card +12 регистров, positive copy moves, tells/overcorrection, cross-page sameness | Brand tone, русские anti-filler examples | Частично | Register/voice/tone/failure-mode card и проверка повторяемости между проектами |
| Material-aware layouts: hero под фото/экран/предмет/фильм/слово и фактические visual slots | Профили и пять общих landing flows | Частично | Recipe catalog **materials→fit→responsive→typical failures**, выбор с rationale, не random как источник истины |
| Sections library: job/desktop/tablet/mobile/copy/visual/motion/mistakes | Общий blueprint/landing skill | Дельта глубины позитивной базы | Взять метод описания и нужные recipes под MASTER, не один универсальный page order |
|19 UI illustration kits и card crop grammar | component-curator21st, общие anti-patterns | Дельта локальных positive examples | Window+approve/diff/terminal/files примеры, отделить illustration от working accessible UI |
|10 diagram topologies /27 process presets | Icon-curator и отдельные проектные diagrams | Дельта общей библиотеки | Реальные процессы/labels + local icons, still/a11y, без fake integrations |
|64 палитры /39 type records: distribution notes, axes, kind/material fit | Восемь RU пар, role tokens, Nullume descriptors/styles | Частично | Опциональная source library с Cyrillic/rights/contrast filter, не override MASTER |
| Photos provenance/subject/crop/stand-ins/shot list/credits | Native reference handoff, original/rights/approval, Nullume | Частично; наши rights gates строже | Замена missing-materials shot list, per-slot/per-width crops, source/operation manifest; не публиковать stock как продукт клиента |
| Motion recipes/moments/scenes: needs/avoidWith/start-middle-end/fallback | Motion doctrine+wrapper, не полноценный kit | Частично | Opt-in recipes и lifecycle адаптер: one-loop group, offscreen/hidden pause, route cleanup, baked still fallback |
|25 effects, procedural objects и spec renderer | Общая media pipeline, точные product originals | Экспериментальная дельта | Отдельный approved creative lab; не считать generic model реальной упаковкой/логотипом |
|Browser consistency/layout stress/shoot/perf + gate с named waivers | Regex lint, screenshots, selftest/review-loop | Частично | Проверенные отдельные checks и понятный QA report; не заменять наш завершительный gate чужим Stop hook |
|Seed/history anti-repetition | Dials/families/подбор референсов | Частично | Зафиксированный chosen id/reason/inputs; полный pipeline upstream не deterministic из-за Math.random/history/network |
|House rules: screen sections/no captions/mandatory hero+moment/hover lift/contact placeholders/palette bans | Brand/project exceptions, purpose/frequency, реальные контакты | Конфликт при глобальном переносе | Оформить как **opt-in preset**, не universal hard-fails; не стирать полезную начинку из-за конфликта presets |

## Приоритеты до любых установок

1. **Устранить ложные заявления готовности.** Regex не измеряет WCAG; still не проверяет motion; template не даёт обещанный отсутствующий export. Локальный scratch-probe уже воспроизвёл exit0+clean для отсутствующего файла и exit0 даже при ERROR (`local-lint-probe.json`). Это не проверка поведения всех lifecycle gates.
2. **Добавить положительную методику:** Taste copy/voice/materials/recipes; Impeccable surface-mode/refinement/independent critique; Kowalski safe removal/stress/mobile/learning.
3. **Согласовать содержательные конфликты:** уже допустимый MD Inter-body vs blanket lint regex; decorative bounce vs inertial spring vs Taste no-overshoot; material motion vs transform-only; arbitrary hero/nav/list/accent hard-fails самого Friday. No-hover-lift — не глобальная политика: конкретный owner запрет находится в `docs/projects/perfect-skin/specs/desktop-refinement-2026-11-12.md:24–33`. Отдельно сохранить capability-hover, keyboard equivalence и неподвижный hit target; наличие lift — визуальный preset. Не чинить чужие dirty файлы в audit-only этапе.
4. **Только затем bounded pilots/registration.** До них никакой обещанной экономии, working integrations или «все сайты станут не-AI».

Рекомендации здесь — предложения по дельте, не выполненные изменения системы. Разборы: `impeccable-content.md`, `impeccable-runtime.md`, `kowalski-full.md`, `taste-content-runtime.md`, `taste-assets.md`; последующие `*-close-*` и `closure-*` закрывают отмеченные в ранних отчётах диапазоны. `independent-review.md` — review R1; B1/B2/B3 и R1/R3/R4 учтены в этой R2. Числа финального покрытия и остаточные ограничения смотреть в README и merged ledger, не складывать промежуточные totals.
