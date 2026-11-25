# Независимое semantic review: Impeccable → Kowalski → Taste → Friday

## Verdict и scope

**REQUEST_CHANGES для финализации сравнительной сводки; основное направление сравнения подтверждено.** Это не FAIL репозиториев и не verdict runtime. Taste не пропущен; ложного общего «Friday ничего из этого не имеет» в R1 нет. Полезные дельты отделены от большинства уже перенесённых правил правильно. Однако сводка недостаточно явно различает собственные arbitrary hard-fails Friday, scoped MD-норму о шрифтах и blanket executing regex; неполно раскрыт конфликт bounce/overshoot.

Reviewer: независимый adapted Hermes researcher, не автор COMPARISON и исходных отчётов. Объект: `COMPARISON.md` R1, 77 строк, текущие working-tree документы и pinned source-only snapshots из BRIEF. Baseline Friday — `388ec708f39583172d7f36110f6424cc175b5512` согласно BRIEF; live IDE state не проверялся. Upstream SHA: Impeccable `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`, Kowalski `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c`, Taste `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`.

Проверка включала чтение сводки/основных Impeccable и Taste content conclusions, targeted reading реальных upstream type/layout/motion/copy правил, Friday doctrine/commands/scripts/template, парсинг зарегистрированных TOML, начальных coverage ledgers и receipt локального lint probe. Это выборочная независимая проверка ключевых claims, не повтор полного assigned semantic reading каждого upstream. Closure/support ещё дополняются: итоговые totals и completion финализирует координатор после merge. Установки, upstream execution, browser и tests не выполнялись и не требуются для этого audit-only verdict.

## Blockers финальной сводки

### B1 · Существенно: arbitrary hard-fails есть не только у Taste, но и в действующих Friday commands/skills

**Где:** `COMPARISON.md:18–21,68,74`; локально `.codex/commands/audit-design.md:22–27`, `.codex/commands/polish.md:26–31`; invoking payloads `.codex/skills/audit-design/SKILL.md:40–45`, `.codex/skills/polish/SKILL.md:44–49`.

Friday объявляет блокерами hero heading >2 строк, navigation >80px/перенос, несколько accent colours и список >5 пунктов без grid/tabs/carousel. Это не просто рекомендации в справочнике: те же нормы есть в вызываемых SKILL. Длина заголовка не доказывает viewport overflow; семантически правильный длинный список не становится дефектом из-за числа пунктов; несколько semantic action colours не равны incoherent branding. В Read/Operate эти правила могут прямо ухудшать задачу. Поэтому картина «у Taste жёсткий preset, у Friday только content/brand overrides» неполна.

**Исправление сводки:** отдельная строка `local hard-fails / conflict`: существующие arbitrary hero/nav/list/accent ограничения требуют surface/domain/brand scope либо объективного evidence критерия. Не отменять их этим аудитом. Разделить настоящие functional/a11y/approved-token obligations и вкусовые default numbers. Owner — design-department + commands/SKILL maintainer. Предлагаемая acceptance: длинный читаемый Read список и трёхстрочный помещающийся RU hero не получают автоматический FAIL; реально обрезанный hero/недоступная навигация получают finding по evidence.

### B2 · Существенно: blanket font ban ошибочно приписывается всей Friday doctrine, хотя подтверждён прежде всего в script

**Где:** `impeccable-content.md:189` (F4: «один system/Inter ban даже при body-approved pair»); `COMPARISON.md:19,74`.

**Реальные слои:** `docs/core/design-principles.md:58` запрещает Inter/Arial/system **по умолчанию как главный бренд-шрифт**, а не любое использование Inter. `docs/core/typography-pairs.md:29–30` прямо рекомендует Inter для body; `:33` допускает одну family Golos для Compact UI. `.codex/scripts/design-lint.mjs:9–12` напротив ловит любое слово Inter/Arial, включая fallback/comment/body и утверждённую пару, без анализа роли и без approved-token exception. `:227–230` применяет общий RULES к строке независимо от MASTER. В upstream `impeccable/skill/reference/operate.md:13–16,54–61` разрешает одну family и системные UI fonts; `typeset.md:7–11,50–57` требует сохранения identity/ролей, а не обязательной замены шрифта.

**Исправление сводки:** «MD anti-default-brand rule уже scoped; положительные body пары уже есть. Доказанный дефект — blanket regex и неявные конфликты приоритетов, плюс возможное уточнение Operate/Read». Не рекомендовать заново добавлять разрешение Inter-body, которое уже существует. Не называть все global typography rules одинаково absolute.

**Receipt нюанс:** `local-lint-probe.json:13–17` доказывает ERROR+exit0 на synthetic fixture. Файл `scratch/design-deep-audit/local-lint-probe/approved-body-font.tsx:1` содержит только `<p style={{fontFamily: "Inter"}}>…</p>`; в нём нет доказательства owner approval или MASTER registration. Название case — не approval evidence. Семантическое противоречие approval подтверждается общей таблицей пар и исходником regex, не этим probe в изоляции.

### B3 · Средне: сводка не закрывает disputed bounce — смешаны безусловный ban, допустимая инерционная пружина и чужие scoped prescriptions

**Где:** `COMPARISON.md:36–38,64,68,74`; `docs/core/design-principles.md:43–44,76–78`; `docs/core/motion.md:105–119`; `docs/core/motion-engine.md:53–60`; `docs/core/templates/motion.ts:70–77`.

Friday global anti-reference называет bounce/elastic запретом. Но motion doctrine разрешает damping≈0.8 после inertial gesture; template реально переводит его в `bounce: 0.2`. Это не просто отсутствующая новая возможность и не достаточное основание банить каждый spring option с именем bounce. Upstream тоже различаются: Kowalski `skills/animate/SKILL.md:134–141` допускает bounce 0.1–0.3 для drag/playful; Impeccable `skill/reference/animate.md:61` запрещает curves **by reflex**, не вообще; Taste `references/motion.md:57–59` требует no overshoot для своего kit. Локальный regex `design-lint.mjs:35–38` проверяет лишь `animate-bounce|ease-elastic`, не все физические пружины.

**Исправление сводки:** добавить явный `partial/conflict, scope decision`: decorative bounce preset ≠ carried-velocity gesture spring ≠ Taste no-overshoot preset. Owner motion doctrine. Acceptance-предложение: decorative bounce flagged, approved inertial spring не отвергается по имени поля; реальный overshoot/reduced path проверяются позже в отдельном разрешённом пилоте. Сейчас ни spring correctness, ни target-device motion не объявлять PASS.

## Recommendations / оговорки, не новые runtime blockers

### R1 · Hover: не превращать project owner preference в недоказанный global default

`COMPARISON.md:68,74` правильно помечает Taste hover lift как спорный, но «owner no-hover-lift» следует снабдить точным project/brief scope и ссылкой. В проверенной общей doctrine отдельного blanket no-lift правила не найдено: `motion.md:19,41,68,74` регулирует частоту/тайминг/press; `ux-guidelines.md:57` — доступность действия без hover. В `design-profiles.md:56` есть даже SaaS hover200–250ms, который надо согласовать с общей frequency heuristic <100ms, а не выдавать один из интервалов за физический закон.

Источники: Taste `references/motion.md:68–82` задаёт fine-pointer hover, card lift2px и instant focus. Impeccable `skill/reference/animate.md:63–65` не требует no-lift: он оставляет pointer target неподвижным и двигает child, чтобы избежать flicker. Это разные claims. Исправление: отдельно `hover capability/keyboard equivalence` (полезная проверка), `stable hit target` (полезная механика), `visual lift` (опциональный preset; конкретный owner запрет сохранить только в его scope). Не навязывать lift одобренному no-lift проекту.

### R2 · Coverage: byte aliases корректны; full-by-reconstruction нельзя подавать как независимое ручное чтение

Рассмотрены первоначальные ledgers, не финальная merged статистика. Независимое byte comparison всех alias rows дало:

- `impeccable-content-coverage.json`: 1284 aliases, все реальные файлы/каноны существуют и побайтово совпадают; 615 с canonical_status=full, 669=classified.
- `impeccable-runtime-coverage.json`: 696 aliases, все побайтово совпадают; canonical_status распределён full/partial/classified/mechanical-scan-only/metadata-only. Поэтому общий alias total не означает semantic full.

Это проверка alias integrity, не проверка содержательного чтения всех канонов. `impeccable-content.md:13–18` и ledger definition честно раскрывают reconstruction: полный canonical + exhaustive transformation/delta review; transformed outputs не названы byte aliases. Однако `status=full` объединяет direct reading и reconstructed equivalence, тогда как BRIEF:17 даёт более узкое определение полного чтения. Для финальной таблицы выделить `direct semantic full` и `reconstructed/equivalence-reviewed` отдельными колонками/method; не писать «713 файлов вручную прочитаны». В качестве доказательства reconstructed coverage сохранить/сослаться на all-content comparison и проверку conditional/provider-specific blocks; одних hashes или совпадения имени недостаточно. Я не воспроизводил transformer и не подтверждаю весь transformation proof.

Начальные Taste ledgers явно оставляли unique implementation partial/unread; runtime Impeccable ledger явно называл mechanical scan и delegated-not-verified. Это корректная прозрачность, не доказанная фальсификация full. Последующие closure могут закрыть эти gaps; нельзя механически складывать исходные totals или снижать итог только потому, что ранний отчёт был incomplete. Координатор финализирует после closure/support.

### R3 · Instructional → payload → script → live надо сохранить как четыре уровня

Независимо распарсены текущие `.codex/agents/{motion-curator,design-reviewer,taste-curator,design-department}.toml`: `developer_instructions` совпадает с соответствующим design MD без первого heading. `.codex/config.toml` действительно регистрирует design-reviewer и motion-curator на эти TOML. Это подтверждает source-level payload parity, не reload/dispatch/live tools.

Полезно добавить одну компактную legend в COMPARISON: MD=доктрина; registered TOML/SKILL=потенциальный executing instruction payload; script/template=конкретная реализация; runtime observed=только receipt либо отдельный запуск. Сам motion template прямо говорит `docs/core/templates/motion.ts:1–4`, что не входит в bundle сам по себе. Поэтому не распространять его дефект на все существующие клиентские wrappers без проверки.

### R4 · Local lint receipt подтверждён, не расширять его scope

SHA256 текущего `.codex/scripts/design-lint.mjs` независимо вычислен и совпал с `local-lint-probe.json:3`: `f13c0e61b06a1e2cca7c26ec3756a0373dc85e93a4a03ca2392153f6c4688966`.

Исходник подтверждает оба результата: nonexistent target пропускается (`:283–285`), затем total0 печатает clean (`:293–295`); даже при findings всегда `process.exit(0)` (`:300`). Receipt записывает реальные stdout/exit для missing target и Inter fixture; повторный запуск этим reviewer не делался. Поэтому `COMPARISON.md:72` обоснован. Не заключать из него, что весь PostToolUse/task_gate/review-loop пропускает ошибки: callers могут интерпретировать stdout. Это отдельный неиспытанный execution chain. Regex gray/bg (`:21–26`) не computed WCAG, правило small-target (`:41–44`) не geometry/hit-area measurement. Локальный audit command `:8–12` описывает возможности шире измеренного — сводка верно предлагает честный evidence contract.

## Подтверждённые semantic conclusions и useful deltas

### 1. Impeccable

- **Typography partial, не absent:** локальные кириллические пары, measure, numeric features уже есть. Реальная глубина добавления: `skill/reference/typeset.md:52–54,59–84` — metric-compatible fallback, loading/zoom, progressive balance/pretty, real mixed-case optical trim. Применять только с real-language/render evidence, не сменой утверждённых fonts.
- **Layout partial, не absent:** `skill/reference/layout.md:17–24,31–59,61–72` — spatial thesis, proximity before boxes, density по задаче, structural adaptation и согласованный DOM/focus order. Это полезнее очередной «правильной сетки» и особенно важно против локальных arbitrary list/hero bans.
- **Temporal delta подтверждён:** `skill/reference/animate.md:83–96` требует normal/reduced, before/first/middle/last/settled, entry/exit setup и recapture invalid packet. Friday `motion-engine.md:77–81` и `motion-curator.md:61–67` требуют одиночный screenshot/reduced check, не такой temporal packet. Утверждение «still screenshot не доказывает плавность» верно. Наличие motion-capture instructions не доказывает сам upstream runtime quality.
- **Material motion conflict реальный:** upstream `animate.md:38–43,75` допускает bounded filter/mask/shader при измерениях; Friday `motion.md:77–78`, `motion-curator.md:46` ограничивает transform/opacity. Это решение scope/budget, не автоматическое разрешение и не причина обходить wrapper.
- **Independent critique method:** Friday `audit-design.md:8–18` действительно передаёт detector output до дизайнерского суждения. Полезно различить independent critique и deterministic-first technical audit, не объявлять отсутствие review вообще.

### 2. Kowalski

- Exact easing/duration/frequency overlap подтверждён сопоставлением `skills/animate/SKILL.md:39–48,100–129` и Friday `motion.md:12–43,53–64`. Не надо импортировать эти основы повторно. Совпадение не доказывает parity всех skill workflows.
- **Export gap подтверждён только для documented shared template contract:** `docs/core/motion-engine.md:47` обещает createDraggable, полный `docs/core/templates/motion.ts:1–122` его не определяет/экспортирует. Предлагается сначала исправить/согласовать контракт. Не утверждать, что каждый клиентский модуль или установленный anime.js лишён API.
- Safe removal, stress fixtures, mobile capability checks и correction ledger сохраняют смысл как отдельные процедурные дельты; review-loop/архив сами по себе не равны точному animation plan или learn-taste pipeline. Полная переоценка всех Kowalski процедур этим review не заявляется.

### 3. Taste

Taste в `COMPARISON.md:50–68` представлен самостоятельной полноценной главой: copy, positive layouts/sections/UI/diagrams, palette/type/material libraries, photos, motion/lifecycle, QA и anti-repetition. **Обвинение «Taste исключён из-за presets» по текущей R1 не подтверждается.** Текущий источник действительно не сводится к старым dials.

Наиболее полезная проверенная дельта — `skills/taste-skill/references/copy-voice.md:31–60,62–90,157–176`: sourced fact sheet, claim/proof, voice card, client voice priority, voice vs state-dependent tone, rival substitution и cross-page sameness. Это не повтор filler regex. Важная оговорка сохранена в исходном отчёте правильно: «nothing invented» в upstream имеет исключение для coined name и plausible place hours/prices (`:50–52`); production Friday не должен унаследовать его молча.

Material-aware positive recipes лучше перенести как метод `material→fit→responsive→failure`, а не как fixed page order/one-screen sections. Mandatory hero/moment и no-overshoot — проверяемые **house policies**, не универсальная truth/a11y норма. Библиотечные количества сами по себе не доказательство visual quality или execution safety; данный reviewer их авторитетно не финализирует.

## Что менять в сводке, не в клиентах/конфигах

1. Добавить symmetric строку local arbitrary hard-fails и scope/acceptance (B1).
2. Исправить формулировку font conflict на MD scoped / script blanket; не считать fixture approval receipt (B2).
3. Явно сопоставить decorative bounce vs inertial spring vs Taste no-overshoot (B3).
4. Снабдить no-hover-lift project/owner attribution, отделить stable target/capability (R1).
5. Финальное coverage разделить по method/canonical status и дождаться closure/support merge (R2); не требовать запрещённого runtime прогона ради semantic audit.
6. Сохранить основные delta-only рекомендации, Taste главу, stronger rights gates и границы observed runtime. Финальный verdict — о конкретно закрытом audit scope, не «все repo/runtime PASS».

**Создан только этот отчёт.** COMPARISON, исходные отчёты/ledgers, роли, конфиги, клиентские файлы и source snapshots не изменялись. Подтверждённые corrections адресованы координатору; новых разрешений на rollout этот review не даёт.
