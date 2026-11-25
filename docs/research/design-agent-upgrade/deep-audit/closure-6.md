# Closure 6 — содержательное закрытие назначенных диапазонов

## Результат и границы доказательства

Прочитаны **32/32 диапазона, 17 975/17 975 назначенных строк, 31 уникальный файл**: Impeccable — 18 диапазонов / 15 555 строк; Taste — 14 / 2 420. Файл `live-browser-source.test.mjs` назначен двумя непересекающимися диапазонами. SHA-256 каждого файла совпадает с исходным inventory и хешем начала чтения, число строк совпадает; множества прочитанных строк равны назначенным, без дыр. Повторная запись одного диапазона в промежуточном ledger удалена до подсчёта. Три усечённых вывода дочитаны из spill-файлов. Coverage содержит full-file и range SHA-256, точные ranges и содержательные заметки; `status: partial` оставлен у всех записей согласно контракту, даже когда назначение охватывает целый файл. Это **полное покрытие assignment, не полное покрытие upstream**.

Ревизии inventory: Impeccable `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`, Taste `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`. Локальный контекст — текущие прочитанные working-tree файлы Friday, не утверждение чистоты HEAD. Kowalski в этом assignment отсутствует.

Аудит только статический. Не выполнялись upstream imports, тесты, hooks, installers, браузер, UI, npm/install, внешние запросы или изменения исходников/конфигов. HTML прочитан как код, не просмотрен визуально. Проверены существования 53 статических локальных src/href/module references в назначенных Taste-демо: отсутствующих нет; это не чтение зависимостей и не доказательство их работы. Для разрезанных функций дополнительно прочитан соседний контекст `quality.rs:3192–3207`, `fullpage.rs:1575–1605`.

## I. Impeccable — реальные правила, а не только архитектура

### 1. Collector, подавления и уменьшение шума

`crates/core/src/browser/driver.rs:3201–3250`: HTML pattern context получает реально определённую темноту корня; reconciliation форм страницы предшествует mockup suppression. Rule pack запускается после встроенных page passes, а value-level waivers — после него: расширенный pack не обходит проектные исключения. `disabledValues` применяется только в extension mode; rule нормализуется trim/lowercase, value — отдельной нормализацией цвета/шрифта. Пустые группы удаляются.

`driver.rs:3253–3467`: дедупликация **после всех waivers**, чтобы проигнорированный первый экземпляр не заглушил остальные. Low-contrast группируется по тексту verdict, severity, маршруту в pixel pass и vendor: стороннее/непрочитанное пикселями не представляет собственное/прочитанное. Сохраняется document order, но glyph/цифра заменяется первым словесным представителем: минимум три alphabetic буквы, mathematical alphanumerics исключены (`3470–3481`). Учитываются копии, отброшенные SAFE_TAGS; finding переносится в существующую либо новую группу без двойных групп элемента. Nested cards группируются по ближайшей card-like внешней панели и severity; page frame исключён, поиск ограничен 10 000 шагами (`3484–3500`). Результат — один finding с `(and N more)` и список collapsed IDs для следующего pixel pass.

`driver.rs:3509–4800` — FakeDom regression intent, не real-browser proof:
- chrome overlay/extension не считается фиолетовой краской страницы; body считается;
- side stripes требуют округлённого элемента; hidden loader/glow/pulse/stripes не репортятся, organic clip остаётся вне этого списка;
- невидимый первый CSS candidate не расходует единственный report; неактивный media declaration проверяется computed paint;
- selector list разбирает верхнеуровневые запятые, quotes/escapes/`:is`; псевдо-stripe измеряется по **своей** mask/background, не host; старый snapshot без mask column сохраняет fallback;
- brand hue heading освобождается при согласованной широкой nav/footer band или настоящем logo; не при короткой nav pill, partner logo, article header, произвольной панели/градиенте;
- category hues учитываются отдельно по role/размеру и при шести действительно разных цветах, не шести почти одинаковых violet/cyan;
- vendor добавляется в detail и `thirdParty`, но warning UI-текста не понижается;
- DESIGN.md нормализует fonts (`Space+Grotesk`), валидные RGB и числовые radii; hidden elements не создают drift, повтор значения дедупится;
- collapsed submenu не расходует contrast pair; dead violet token без реально окрашенного элемента не считается;
- один teal accent на dark не равен AI palette; два незаявленных оттенка — основание, declared DS colors исключаются;
- extension-only skipScan опустошает element/page stages; waivers нормализуют hex против computed RGB и не выключают соседнее правило.

### 2. Типографика и layout по геометрии

`crates/core/src/browser/quality.rs:1601–2183`: helper semantics важнее названий. Текст не относится к padding wrapper при opacity ≤.02, absolute/fixed позиции либо собственном непрозрачном block surface; inline highlight остаётся текстом wrapper. SR-only распознаётся по selector, clip/clip-path либо 1px clipped absolute/fixed box. Heading descendants освобождаются от body-leading, но вложенный reading block возвращает body floor. Clamp ищется на глубине четырёх; clipping без clamp уменьшает число видимых строк, но не получает heading exemption. Геометрия учитывает transform scale относительно offsetHeight.

`quality.rs:2187–3160`, вход собирается `3163–3204`:
- **buried-raster**: opacity [0,.15), но не SVG, icon ≤48×48, blur placeholder ≥4px либо перекрытая ≥50% растровая state layer. Это защита от «ассет добавлен, но фактически спрятан», не запрет всех crossfade.
- **line-length**: не capacity box/font-size, а реальные line rects и rendered character count, распределённые пропорционально ширине. Нужны минимум две строки >`lineMax+5`, не одна длинная строка с коротким хвостом. Нет измерения — нет guessed finding. Inline-only prose и generic prose blocks поддержаны.
- **cramped-padding**: bounded direct text >20 chars, ширина >100 и высота >30, не inline code/inline highlight. Вертикальный floor max(4px,.3em), горизонтальный max(8px,.5em). Малыми должны быть и declared padding, и measured glyph inset. Full-bleed фон не создаёт ложную боковую границу.
- Wrapper-форма cramped: реальные borders/outline/отличающийся background, padding ≤2px, text flush, нет overflow >1px и нет insulation ≥4px. До трёх transparent shells разворачиваются; учитываются margin collapse, transforms, offsets и продолжение одинакового fill. Переполнение — другой дефект, не «no inset».
- **body-text-viewport-edge**: prose >40 chars шире половины viewport, не nav/site header/own fill/absolute/fixed. Phone ≤480px — gutter12, иначе16; измеряется текст, не автоматически box. Scroller/running track/mid-animation исключаются; fixed notice ниже половины высоты оставляется своему layout, кроме текста ближе4px к краю. Negative overflow не дублирует page-overflow.
- **tight-leading**: body font ниже display floor, >50 chars, несколько реально показанных строк, rounded ratio <1.3. Не headings, короткий bold title/clamp, lead ≥20px с достаточным leading и ≤3 строк, caps label, monospace code/box art. Fine print здесь advisory, не автоматический pass.
- **justified-text**: узкий многорядный блок без hyphens:auto и только script, растягивающий межсловные пробелы; inline ссылка наследует ширину родительского block, не становится ложной узкой колонкой.
- **tiny-text**: running body <12px, не caps/code/UI/caption/sub/sup и пр.; SVG drawn scale учитывается. Legal/footnote context может быть exempt, mock context advisory.
- **undersized-ui-text**: direct label ≥2 chars, исключения code/footnotes/SR-only; interactive/furniture/drawn button/short label проверяются по floor с .1px tolerance. Smallprint отдельный floor; неинтерактивный micro-label/mock advisory, настоящий control остаётся failure. Значения constants вне назначенного среза здесь не выдуманы; browser fixture отдельно явно фиксирует UI11px.
- **all-caps-body**: собственный длинный run, не суммарный текст labels внутри контейнера. **wide-tracking** >.05em имеет caps/control/CJK exemptions; extreme negative tracking вызывает helper с размером шрифта и не применяется к CJK.

Это read-only DOM computations, результат — RuleHit; значения/снимки/достоверность измерения предоставляет adapter. Нельзя переносить численные floors как универсальный дизайн-закон без выбора профиля.

### 3. CSS-text foundation и shared data

`crates/foundation/src/css/scan.rs:20–288`: custom properties first declaration wins, declaration map last wins и удаляет trailing !important. Это **не browser cascade**. Property-token boundary исключает `--...box-shadow`/хвост `border-width`, допускает чистый vendor prefix. Selector attribution сохраняет byte offsets при blanking comments, учитывает quotes/escapes и группирующие at-rules, но не приписывает nested selector без родителя. `px/rem/em` конвертируются с базой16 — не actual computed font size.

`scan.rs:296–825`: marquee — горизонтальный travel ≥20%, один translate вместе с scale/opacity может быть entrance, не loop. Pulse — opacity/shadow/двухосевой scale, если нет движения/resize: readable translations расходятся минимум на4px при одинаковой процентной части; matrix/pre-scale-before-translate/calc остаются unknown, а не точным расстоянием. Height-only waveform, moving offsets и single-axis blink/fill исключают pulse; противонаправленные offsets/resize распознают ripple. Infinite animation shorthand и longhand разбираются эвристически; longhand при наличии infinite count берёт все имена, не точную поэлементную CSS list cascade. Reduced-motion blocks удаляются brace scan. Landmark ranges и последняя id/class selector часть — текстовая аппроксимация, не selector engine (`827–976`).

`crates/foundation/src/browser/mod.rs:26–244`: shapes BrowserFinding/ElFinding/FindingGroup сохраняют severity и ignoreValue; waiver parser выбрасывает malformed entries, ненулевые numbers превращает в strings. `line_max()` default80, numeric strings приводятся по JS, плохая строка даёт NaN. `unreported_rules` влияет на substitution, но не фильтрует findings здесь. Rule pack — Rust static dependency, не принимается из JSON страницы. HiddenTextMeasure отдельно выводит не запустившиеся sliders, исключённые из числителя и знаменателя. CollectResult несёт collapsed element IDs следующему contrast этапу.

### 4. Context resolver

Полностью прочитан `crates/context/src/context.rs:1–1593`.

Вход — cwd, explicit target, env; выход Ctx с PRODUCT/DESIGN text, **раздельным provenance**, roots/platform/visual-implementation и surface brief reason/candidates. PRODUCT и DESIGN выбираются независимо: project local context → repo context; env directory используется, только если **обоих** нет (`165–205`). Внутри root выбирается первый каталог с любым context file: root, `.agents/context`, docs; это не независимый поиск каждого документа по всем трём каталогам (`370–390`). Safe read failure превращается в отсутствие текста; пути всё ещё могут присутствовать.

Explicit target за отдельной git boundary не наследует caller context (`272–335`); прогулка вверх останавливается на home/git. Workspace patterns — `.impeccable/config{,.local}.json projectRoots`, package workspaces, pnpm, lerna; fallback apps/packages при markers. Bare name разрешается только при единственном совпадении. Negations применяются группами; `**` — ограниченная аппроксимация по literal prefix/ближайшему package root, не полный glob implementation (`732–1225`). Явно указанные projectRoots не отфильтровываются UI heuristic.

UI candidate test — shallow dependencies/entry/style/UI/native markers, не recursive tree walk; React/Next/Vue/Svelte/Flutter/iOS/Android и пр. Pure Dart/API/tooling исключаются; если UI filter дал пусто, возвращается **полный список**, skipped0, чтобы heuristic не уничтожила выбор (`514–683`, tests `1488–1592`). Doctor selection остаётся unfiltered.

Visual implementation — другая bounded эвристика: ≤250 style/UI файлов, depth4, первые64Ki UTF-16 файла, без comments/minified/dependency/hidden dirs; thresholds tokens/visual declarations/class tokens или три styled files (`1285–1422`). Это не качество UI и не доказательство rendered screen. Platform принимает web/ios/android/adaptive и ios+android; seeded world только frontmatter slug lowercase/digits/hyphen ≤80 (`97–115`, `1229–1283`). Сам resolver читает, не пишет.

### 5. Hooks и installation boundary

`crates/skills/src/hook_manifest.rs:1–1124` — исполняемая installer/update логика, не набор пассивных MD:
- provider-specific source/destination: Claude settings.local project vs settings.json user; Codex .agents skill → .codex hooks; Antigravity workspace .agents vs global .gemini/config; GitHub committed portable command; Hermes plugin не project manifest;
- shell quoting/Windows поля различаются: Codex commandWindows, Claude Git Bash, Gemini предварительно escaped project token без лишних quotes, Grok/Antigravity cmd; existence guard **не** `|| true`, чтобы сохранить exit2;
- Cursor retired before-edit gate мигрирует на post-edit hook, foreign hooks сохраняются;
- JSONC backup `.bak`; malformed whole-user settings Gemini/Claude не заменяются даже force; malformed hook-only manifests force заменяет с backup;
- merge удаляет только собственные entries, не все hooks; fresh version/description может заменить metadata. Prune пустого собственного manifest удаляет файл, удаляет version/description при исчезновении hook subtree (`661–744`);
- current home wiring требует существующий launcher, все актуальные entries и правильные commands, не просто marker. Только после этого убираются dead/duplicate project entries; team-owned project skill сохраняет portable path (`855–970`, `1010–1092`);
- manifest copy использует atomic write; stale repair — обычный write, выполняется **без нового consent**, т.к. считается ремонтом уже существующего hook (`1027–1083`). Это важная граница для audit-only и update;
- Hermes: даже project install копирует plugin files в глобальный Hermes home; missing bundle directory skip, half bundle error, stale copy overwrite. `installed`=наличие двух файлов, `enabled`=отдельный config check (`972–1007`);
- set_hook_consent пишет local JSON и git exclude (`1097–1118`), не является dry read.

Вводный комментарий `hook_manifest.rs:13–14` говорит, что hooks on не guard-ит POSIX launcher, но прочитанные regression assertions `hook_tests.rs:4038–4076` уже требуют guarded три entries. Это **расхождение комментария и тестового контракта**, не доказанный runtime bug: writer admin не входит в этот assignment.

`crates/hook/tests/hook_tests.rs:3201–4631` закрепляет следующие реальные сценарии:
- findingsAfterFinish marker кладётся в build folder; Codex/Hermes Stop — top-level decision:block/reason, PostToolUse — additionalContext. Repeat Stop молчит (`3205–3280`);
- live preview markers останавливают **весь event**, включая CSS companion, ещё до edit cap; даже первый proposed write с markers проходит before gate. После принятия проверяет live-complete, здесь это заявленный отдельный owner (`3283–3396`);
- concurrent duplicate PostToolUse и Stop получают один claim; без tool id/unusable claim dir — fail-open **scan**, не silent skip. Hash paths безопасны, private home storage отвергает symlink/group-world writable roots, sweep удаляет только собственные hash names (`3398–3648`, `4416–4495`);
- session→project root index позволяет Stop из umbrella cwd видеть все затронутые проекты, не чужую сессию; combined caps lead-project, disabled project исключается. Hash-content mismatch/relative/missing roots игнорируются; directories700/files600; expiry не удаляет foreign files (`3650–3944`);
- auto-repair только после **local** consent, не tracked config; malformed/disabled сохраняются, actual complete wiring проверяется, альтернативный Claude account не подменяется default. Hermes plugin enabled распознаётся, disabled config не включается автоматически (`3946–4234`);
- shell writes дополнительно обнаруживаются по mtime после достоверного session start: UUIDv7 timestamp либо transcript birth; без них не угадывают. Dependency/hidden/build/FIFO/oversize исключаются, subfolder root исправляется (`4236–4414`);
- DESIGN.md, включая inherited, меняет identity Stop; cache atomic integrity тестируется, но тест `4462–4478` проверяет parseability и отсутствие staging files, **не сохранение всех восьми concurrent edits**;
- plain .js/.ts сканируются только при Impeccable context/config или configured extension, TSX/CSS всегда UI; иначе server scripts не занимают discovery cap (`4538–4631`).

Тесты создают fixtures, threads, private dirs, FIFO, state cache; **мы их не запускали**.

### 6. Live-browser state, не только screenshot UI

Полный `tests/live-browser-source.test.mjs:1–1937` — Node source regex contracts и VM извлечённых функций. Это сильнее проверки имён файлов, но **слабее настоящего browser/HMR integration**.

`12–128`: generation checkpoint только после acknowledged current session; plain generation dispatch до screenshot, annotated generation — после capture/upload. Steer timeout не просит повторить уже отправленное, late steer_done показывается. Hover маленького label поднимается к pickable ancestor, но не выходит из chrome.

`130–448`: copy edits stash/async commit/discard; restore только pure text leaf с совпавшим newText, mixed-content parent text node через hint, не textContent родителя и не raw CSS query по сохранённому ref. Remove — отдельная op, скрытие атрибутом без detach framework node, Undo только ref и не при409 apply conflict. Apply блокирует повторные действия/hover/pick, UI различает applying/verifying/repairing/needs decision. SSE completion переживает HMR; success count только verified applied/cleared, без fallback на начальное число. Context sanitized, leaf/container/nearby/source hint передаются без runtime markers. Accept/discard требуют HTTP durable ACK; optional events могут swallow+debug.

`450–1175`: durable accept освобождает foreground picker, source carbonize продолжает отдельно. Deferred recovery fenced session ID **и interaction revision ещё до выдачи нового ID**; cleanup/HMR не должны reload новую работу. Framework-owned DOM не чинится структурной заменой, static DOM может; по-session visibility sheets/watchers/reload budgets. Populated wrapper выбирается вместо первого пустого scaffold. Shader construction epoch инвалидируется до раннего return, GL/canvas удаляются при гонке; любой CYCLING route убирает overlay. Tune pending заканчивается по completed helper record. Agent target resolve до claim, lease holder identity, acting/done replay guard, busy-to-idle rescue, page-scoped cache и hidden bar не перехватывает clicks. Это полезные **state-machine invariants**, а не инструкция копировать весь live runtime.

`1177–1561`: только один RAF scroll tracker; JSX/Vue/Svelte raw source не DOMParser-inject, HTML marker block fallback сохраняется; orphan removal только после source evidence/retry budget,404 — evidence, transient unreadable не уничтожает сессию. Progressive checkpoint не спорит с HMR, final fallback750ms. Font capture следует stylesheet-relative URLs, redirects, imports/media/supports и extensionless MIME. IME Enter включая Safari229 не submits; coarse pointer без autofocus; clipboard fallback; unsafe markdown URL schemes удаляются; helper token удаляется из window даже при double init; localStorage property читается в try.

`1573–1838`: VM Tune ranges/toggle/steps сохраняются при reopen/progressive variants/reload, включая 0/false; stash scoped session+variant, invalid type/out-of-range/NaN/removed key отклоняются, variant switch сбрасывает defaults. `1840–1927`: pending dock sessionStorage TTL15min восстанавливает decision buttons, не бесконечный spinner; running repair всё ещё loading, rollback возвращает enabled Apply/Discard. `1929–1937`: hover не расширяет bar, steer unlock восстанавливает labels.

### 7. Browser intent и raster fidelity

- `crates/browser/tests/cdp_attach.rs:1–427`: raw независимый CDP client сверяет before/after document loads/navigation, scroll window+scroller, node/global count, activation, viewport/DPR и media paused states. Изолированный мир против broken Map/Array и CSP; ambiguous target требует выбора, ID поддержан. Hidden page **не** делает pixel verdict и выдаёт capture note; timeout оставшийся JS отменяется перед restore. Ошибка non-DevTools port содержит diagnosis. Тесты запускают собственный Chrome/local HTTP и могут skip; не проверялись здесь.
- `brand_and_vendors.rs:1–303`: brand/category/declared DESIGN hue exemptions, cyan170–197 не emerald/sky; footer entrance heading skip не значит пропустить internal footer jumps. Ad-tech errors advisory и отдельный cap, собственная ошибка error не теряется; widget vendor не понижает severity. Flat ramp при двух weight steps advisory, при одном warning.
- `text_forms.rs:1–165`: font <5% visible characters или никогда не загружен — не primary offender. Detail79% отражает другой element-based показатель, не заявленные в fixture11% characters. Pseudo stripe once, image-only stripe excluded; marquee требует содержимого, pulse name не bounce автоматически.
- `own_box_surface_and_ink.rs:1–159`: own-box gradient поверх opaque fill/нескольких layers; SVG только currentColor, filter/reveal без ошибочного computed verdict. aria-hidden не значит невидимо; fixed image/disagreeing samples идут в pixel pass. Есть should-flag и should-pass twins, а не только «нашёл что-нибудь».
- `crates/browser/src/fullpage.rs:1601–1683`: **только хвост unit tests**, не весь stitcher: clipped paste negative offsets, supplemental shots по реально недостаточному покрытию (NaN/invalid исключены), RTL negative origin и width cap сохраняющий viewport, fallback geometry1280×800, JPEG band tolerance.
- `crates/comp/src/hero.rs:1–616`: pure decoded raster+Region → numeric JSON diagnostics. Cap fingerprint min10px/6glyphs, mismatch22%; wrap, line pitch20%, gap max(.03,50% comp gap), density ratio<.75/>1.25, ink ΔE>22. Surround edges не рекомендуются как lettering, polarity filter; control border не становится first line. Chrome-strip rules max(5px,6%height); invented ink10×10 grid отличает добавленную детализацию в пустых соседних cells; plate clip comp margin≥6 против build≤1. SVG illustration heuristic64px/8shapes/480path chars отделяет icons/use sprites от больших иллюстраций. Это не OCR и не эстетический score. Синтетические RGBA tests защищают foreground advice.

### 8. Остальные назначенные тесты

`tests/lib/utils.test.js:1–705` — Bun build-utils contracts: frontmatter round-trip, user-invocable boolean special case, quoting `: ` / flow indicators и nested metadata; recursive MD references, nested portable script names, JSON scripts excluded. Homepage DO/DON'T catalog шести категорий **ручной**, не извлекается из SKILL.md. Provider placeholders адаптируют названия model/config/question tool; Codex slash→dollar только invocation, не path/URL; scripts заменяются только по явным marker declarations. Tests пишут/удаляют cwd/test-tmp: не запускались.

`tests/github-sheriff.test.mjs:1–992` — **репозиторная governance, не дизайн-проверка**. Wait только trusted maintainer command/dated state, не NLP inference по prose. Warning7/close14 требует trusted warning текущего blocker window; stale label не receipt. Contributor activity/maintainer review, draft transitions, conflicts, current reviewDecision, policy approval vs contributor-resolvable blocker и CI разделены. Maintainer decision останавливает aging, handoff запускает свежий window; regular/never-close/exempt политики. Fake-gh CLI dry-run fixture >6MiB проверяет полную REST hydration и raw page count после projection, чтобы пустая filtered page не остановила pagination. Не было GitHub вызовов. В Friday переносить имена maintainers и auto-close policy не нужно.

## II. Taste — строгие checks плюс конкретные композиции

### 1. `consistency.mjs:9190–9757`

Это содержательный срез, **не весь 11 485-line checker**. `waitReady` ждёт system ready / mounted moments до12s, eval timeout20s catch swallow. Local detection включает localhost/loopback/.localhost/.test/собственный server. `pageExists` local GET/файл; catch возвращает true: неопределённость не missing-link proof (`9192–9212`). Комментарий о блокировании form requests находится здесь, interception implementation — вне среза, поэтому безопасность формы этим чтением не подтверждается.

`9215–9320` — полный fix vocabulary, в том числе:
- nav one bar/opaque fixed band, единые nav/button/card family и consistency actions;
- phone tap44, безопасное stack/wrap вместо collision, min-height вместо обрезающего fixed height;
- rendered text clipping/orphans/number+unit NBSP/relative proximity;
- тело16px и ink7:1, muted4.5 только labels/captions;
- не больше четырёх GL contexts, still fallback shader failure, pause loop либо stop≤5s, reduced-motion законченный кадр;
- one effect ID≤2 sections, card layout≤2, nesting≤2, flat grounds≤3;
- сильные **house rules**, не универсальная a11y: no scroll-linked/reveal/pinned, no progress bars, no picture captions, whole-screen sections, product across80% content width, no print over photo.

Modules могут перезаписать FIX, CHECKS берётся после merge. Однострочный fix сам по себе ещё не detector implementation.

`9322–9456` — actual copy checks: category noun/audience/place headline2–8 words, hard fact в hero, section nouns, action verb и максимум5 words, banned vague labels, primary wording nav/hero/close, nav label lexical match target heading. Inputs flags или title `Name: what for whom`; KIN словари trades и crude plural stem. **Нормализация удаляет всё, кроме ASCII a-z0-9**, английские STOP/VERBS/SECTION_NOUNS: русский текст не поддержан семантически. `copy-fact` принимает digit/platform/genre/place occurrence, но не сверяет claim с первоисточником brief; рекомендация «take it from brief» сильнее реализованной проверки.

`9460–9589`: metadata effect families, type precedence flags→html/meta→category/title, product/place/software inference; auditFindings создаёт FAIL placeholder, sample/caption/meta-notes, effect/layout reuse, nesting; pricing cards у place/product без subscription — WARN. ≥4 identical cards FAIL, недостаточно placements/один ground WARN; second-column ≥3 x positions WARN; inter-row gap должен превышать internal caption gap. Extras: split number/unit, orphaned tab, stats крупнее h1/h2, inconsistent figures>1.35×, credit wall, смешанная ширина mobile buttons, fragment placement, повтор photos/views/whole product, тяжёлый photo≥3× безsrcset, stack gap, duplicated menu destinations, form nesting. Findings несут check/sev/id/sel/doc/more/fix, есть first-width dedupe и per-check caps.

`9593–9681`: hero CTA below fold первый FAIL/второй WARN, primary≥5 repetitions WARN, menu fill отличается от button palette>12 RGB WARN. Tech prose >90 words/screen или average>80 WARN. Product hero без media FAIL; desktop drawn product<60% FAIL,60–80 WARN, canvas estimate явно назван estimate. Labels на photos проверяются лексически: это **не visual identity/product rights validation**. Photo print hero/non-tech FAIL, fourth ground WARN, split align mismatch/float≥120px WARN, same target «this room» without chosen item WARN, contradictory hours FAIL/WARN, short desktop section WARN. Несколько требований противоречат полезным conventional patterns; импортировать только параметризованно.

`9682–9757`: lexical GLSL lint читает runtime shaders плюс same-origin source files/inline. Template/quoted/joined string extraction; macro defines не ошибочно ругаются, ES1/ES3 reserved words/qualifiers/attribute-varying/prefixes различаются. Дедуп word+source line. Files ограничены3MB, fetch/read failures swallow, CDN source пропущен; это не GPU compiler proof. **gl-fallback implementation начинается после назначенного конца**, здесь прочитан лишь её комментарий, не выполненная проверка.

### 2. HTML/JS демонстрации: композиция и runtime contract

| Файл / строки | Содержательная идея и ограничения |
|---|---|
| `assets/motion/demo.html:1–475` | Stackline micro-interactions gallery: dark/light tokens; assign/late/closed CSS choreography с разнесёнными old/new labels; 4s moving issue board; `data-m-loop`/`--m-still`, counters, tabs, switches, native FAQ. Responsive board скрывает mover/третью колонку≤1023, вторую≤639. Theme query/button synchronizes aria-checked. system/cards/motion CSS+JS, remote Geist+Picsum. Form `onsubmit=false`, invented company/stats: это demo, не рабочая signup. Loop pause/reduced-motion реализация в зависимостях, не в этом HTML. В demo есть progress bar вопреки house fix vocabulary. |
| `assets/components/index.html:1–365` | 20 components/5 palettes, fetch meta+HTML+dynamic JS+CSS. Failed loads отбрасываются из entries; CSS error считается settled, поэтому count parts не доказывает полностью рабочий каталог. Markup сразу сохраняет высоту, near10% IntersectionObserver start/destroy+fx.unmount; palette localStorage и remount; один dither object; instrumentation getContext/live/peak/debug global. Начальный `__tpGlMax=16` и последующий `fx.config.maxLive=4` требуют чтения fx.js для окончательного effective budget. Ready fixed1500ms не проверка состояния. Subgrid выравнивает две стадии half-width. |
| `assets/layout/hero-centred.html:1–207` | Dark software hero, Instrument Sans variable wdth92%, центрированный текст/mark и landscape window с CSS-painted fallback. Support chat stages, aria role img и decorative internals hidden. Stats desktop3-up, tablet split text/panel, phone148px и сокращённые rows/tool/sidebar: fit решается контентом, не масштабом всех букв. Fake anchors/claims. |
| `assets/layout/hero-film.html:1–120` | Service photo-overlay hero, Schibsted/light ink/dark page; desktop/phone object-position, secondary photo4:5, tour price rows вместо SaaS tiers. `Play the film` — **только #tours**, видео отсутствует. `.example` mailto, локальные JPEG и credit disclosure; не готовый тур-бизнес. |
| `assets/layout/hero-editorial.html:1–116` | Mona Sans wdth108%, большие слова с inline cropped photos; aria-label сохраняет заголовок, картинки декоративные. `data-ly-letters=wdth` hook требует layout.js; ordered process+durations, phone4:3 photo. Dummy mailto/anchors. |
| `assets/objects/photo-kit/demo.js:1–81` | Shared photo object harness: registry→3 credited photos, escaped labels, params precedence focus<opts.params<per-photo<query JSON, clock/WebGL1, object.mount controller; palette changes history.replaceState+rAF setPalette, replay/debug. Fetch failure не обработан здесь. Unknown `?solo` обходит byKey filter и затем обращается к undefined `p.alt`: статический дефект, см. findings. |
| `assets/objects/_print-core/blank-ground.html:1–70` | Maintainer failure-state fixture: два ground никогда не рисуются, object обязан own paper цвета ground; третий drawn — отдать paper ground. auto.mountAll→ui.grounds skip→poll100×200ms→structured rows/ok и data-ready pass/fail. Это полезный test intent, не увиденный PASS. |
| `assets/moments/line-carries-colour/demo.html:1–62` | Один inverse section-переход from base, печатные press rows, photos и fonts. mo-js класс сразу, mo-safe через2500ms — fallback scaffold; actual moment.js/CSS вне чтения. Placeholder anchors. |
| `assets/scenes/descend-through-weather/demo.html:1–58` | Двухэкранная `--h:2` hero scene, above-cloud peak→fjord valley, weather fact rows. sc-js/sc-safe2500ms, scenes CSS/JS dependencies. По HTML нельзя доказать scroll/reduced-motion поведение. Большой scene candidate не исключён заранее; требует разрешённого motion profile. |

Все перечисленные HTML прочитаны целиком; фотографии/эффекты не оценивались глазами. License credit text не является доказательством прав на production usage.

### 3. CSS fragments

- `components/fx-chart/component.css:1–47`: **своя единственная grid**, accent SVG non-scaling line/area; до data-fx-mounted CSS gradient fallback; reading state cursor+tooltip .15s, tooltip14px сбоку с flip, phone plot180 вместо220. Input/keyboard/ARIA требует JS/markup, CSS не доказывает доступность.
- `ui/stat/fragment.css:1–45`: 420px mock, tabular36px figure, quiet ink delta вместо тревожного accent, accent только последняя bar. `is-window` holes в cover превращают эффект в данные, не backdrop; `is-fill` намеренно выводит bars за низ panel и скрывает axis. Нельзя оценивать это как полноценный аналитический chart без отдельной data alternative.
- `ui/code/fragment.css:1–28`: 440px editor mock→100% phone; syntax — ink tints, единственный accent на marked line (2px stripe+9%wash), line numbers,13/20 monospace; hint opacity240ms/mark300ms. Местного reduced-motion override нет, но global dependencies могли его обеспечить; отсутствие во всём runtime не заявляется.

### 4. Ground contrast measurement harness

`assets/backgrounds/check.mjs:1–178`: executable Node harness, не пассивный reference. Builtins+global WebSocket, spawn Chrome SwiftShader/CPU, собственный profile/DevToolsActivePort, local HTTP5965–5969, subprocess `start.mjs css` для palette tokens с history в profile, `check.html`/index.json textZones/library palettes. Для palette×lit×ground делает screenshot scale.5, PNG RGB/RGBA decoder, средние4×4 pixels (=8CSSpx) в textZone, худший block ratio ink7/muted4.5, rounded corners inset. Outputs table/optional PNG/JSON, exit1 при fails,25min watchdog и own-PID cleanup. Не проверяет реальную форму glyphs/все размеры/время shader, а именно ground zones при800×900.

Статические проблемы достаточности и cleanup ниже; код не запускался, данные проверки не выдуманы.

## III. Находки и полезное сравнение с Friday

### Подтверждённые статические находки в назначенном scope

1. **Качество проверки, высокая уверенность — пустой ground selection способен дать ложный зелёный результат.** Taste `assets/backgrounds/check.mjs:37,143–157,170–178`: unknown `--grounds` отфильтрует всё; `results=[]`, `fails=[]`, summary `0/0 passed`, exitCode не выставляется из-за failures. Аналогично зона без полного BLOCK оставляет worst99. Нет проверки expected sample count/nonempty matrix. **Owner:** upstream Taste maintainer; Friday owner при возможной адаптации — QA + deterministic-check maintainer. **Expected:** unknown selection/error и zero sampled blocks → nonzero/unverified; отдельный positive control с известным ground. Никакого runtime reproduction здесь не выполнялось.
2. **Качество/error path — Chrome запускается раньше защищённого cleanup region.** `check.mjs:79–96`: spawn до port validation, server listen и try/finally; invalid port process.exit либо EADDRINUSE rejection происходят до finally/guard. Следовательно cleanup не гарантирован этими ветвями. Не утверждаю наблюдённый orphan process. **Owner:** Taste harness maintainer; **expected:** validate port/findChrome до spawn, server+child весь lifecycle в try/finally, тест занятого порта/invalid args без оставшегося child.
3. **Demo input error — unknown solo key.** `photo-kit/demo.js:20–21,34–37`: `solo` непосредственно попадает в keys без byKey validation, `p.alt` бросает TypeError для неизвестного ключа. **Owner:** Taste photo-kit maintainer; **expected:** validate solo и понятный fallback/error; тест invalid query. Риск demo-only, не production source Friday.
4. **Coverage limitation, не runtime дефект:** `hook_tests.rs:4462–4478` не доказывает lost-update safety cache, только целый JSON/no tmp. Если импортировать concurrent cache, нужен union-of-touched-files acceptance; «тест concurrent есть» недостаточно.

### Semantic parity / delta matrix

| Тема | Что реально есть Friday | Вердикт и решение |
|---|---|---|
| Дизайн от brand/master и screenshot | `.codex/CODEX.md:345–385,686–695`; `docs/core/design-principles.md:32–45,106–116` | **already equivalent в MD:** не нужно повторно добавлять обязательность refs/brand/screenshots. Numeric raster diagnostics upstream — отдельный **partial/absent in inspected scripts** delta. |
| Анти-slop fonts/palette | `.codex/scripts/design-lint.mjs:7–38` — построчный Inter/Arial, Tailwind gradient, gray classes, side border, bounce | **partial:** названия схожи, semantics разные. Impeccable проверяет фактически painted/loaded/character share/brand/category; Friday regex ругает любой Inter token даже не primary. Не переписывать доменную политику upstream исключениями автоматически; сначала project-level decision и pass/flag fixtures. |
| Контраст и текстовые размеры | Friday `design-principles.md:58–65,80–101` — 70–75 chars,4.5/3,44; lint `21–26` — сочетание class names, не ratio | **partial:** measured contrast/line rects/glyph insets/own surface/pixel routing **absent in inspected scripts**, а не «нет в Friday вообще». Taste7:1/16px — **conflict как blanket**, можно opt-in strict profile, не замена4.5/3. |
| Project resolution | Friday lint `105–184`: file path projects/tools→MASTER, потом active; cache keyed master | **already equivalent principle**, **partial mechanism**. Upstream broader explicit target/git boundary/provenance, но имена PRODUCT/DESIGN и workspace inference не знают Friday registry/docs/projects. Target adapter должен использовать registry, не менять .active на аудит. |
| DS enforcement | Friday lint `171–218`: six-digit hex/font block/Tailwind font token/4px remainder | **partial:** не computed RGB/OKLCH/radius, не source visibility, не token cascade. Сохранять MASTER/pages precedence; upstream DESIGN parser не копировать как новый второй source of truth. |
| Motion | Friday `motion.md:12–24,66–103,140–166,187–196` | **already equivalent** pause offscreen/tab, reduced-motion, functional gate, lazy mount и choreography. Taste no-scroll/no-progress/no-caption/full-screen — **conflict** с brand dials (`design-principles.md:26–30`, `motion.md:68–70`). Не импортировать глобально; сцены допускаются только выбранным profile. |
| Browser verification | Friday screenshot script `22–37,100–143`: playwright-core, new pages at3 widths, goto+wait1200/click/fullPage | **partial:** реально screenshot tool, но не CDP attach existing authenticated document/restore scroll/media/isolated world/no activation. Attach delta полезен отдельным режимом; не называть уже имеющимся. |
| Hook completeness/claims | Friday CODEX `45–57,714–723,780–804`; review-loop `29–44,52–54` различают instruction и live state | **already equivalent evidence principle**, upstream private claims/current wiring/cross-session caps — **absent in inspected narrow scripts**. Runtime lifecycle/registered TOML целиком здесь не читались: строгого вывода об отсутствии реализации нет. Installer hooks/Loop **not applicable** как drop-in: меняют user/global accounts. |
| Live apply/Tune | Friday review-loop `40–54`: revision binding, .codex/CODEX `84–90`: owner acceptance отдельно | **partial analogy**, не эквивалент live editor. Полезны accepted-session fencing, verified count и repaired-decision states; сам live runtime в inspected local scope не установлен/не доказан. |
| Reliability false PASS | Friday CODEX `800–804` требует непустой список; lint `263–300` может проверить0 и всё равно печатает «Проблем не обнаружено», всегда exit0 | **conflict MD/script:** проверка — advisory log, не бинарный quality gate. Это статически видно, но менять исходник audit-only нельзя. Заимствовать прежде всего strict evidence contract/count, не ещё100 эвристик. |
| Copy rules | Friday lint `98–102` — русский filler regex; design-principles refs brand/dial | **partial:** Taste category/CTA/hard-fact/consistency полезны, но ASCII-English checker непригоден как есть для русского. Hard fact occurrence не равен provenance. |
| Governance / build tests | Sheriff и utils tests | **not applicable** как новые UX rules. Полезные engineering lessons — full pagination/current receipt, adapter marker substitution не повреждает paths. Не переносить имена автора/регуляров и auto-close. |

Readable MD проверен отдельно от реальных local scripts. Executing agent TOML/live hooks/browser state **не проверены этим assignment**; ни одно совпадение текста не объявлено работающей интеграцией.

### Приоритетные рекомендации — только доказанный delta, без rollout

1. **P1: непустое доказательство и structured result.** Proposed target `.codex/scripts/design-lint.mjs`, owner deterministic-check maintainer + QA. Вывод scanned/matched/skipped/errors и explicit advisory vs strict exit contract; invalid path/0 eligible files должны стать unverified, не «чисто». Expected fixtures:0 files, wrong paths, positive defect, clean populated set. Текущий always-exit0 сначала документировать как advisory, не внезапно менять stop policy.
2. **P1: measured browser evidence adapter, не ещё regex.** Proposed target `.codex/scripts/screenshot.mjs` либо соседний approved audit module; owner browser QA. Сначала collect viewport/font readiness/capture notes и should-pass/flag twins для own-gradient, hidden submenu, SVG/filter, existing scroll/media restoration. CDP attach отдельный opt-in, без навигации/foreground user activation. Expected output включает measured/unknown/skipped, не guessed PASS; тест hidden tab и delayed wait cancellation.
3. **P2: quality rules небольшими группами.** Proposed `docs/core/ux-guidelines.md` и согласованный checker module, owner design-reviewer+QA. Добавить measured rendered-line length, edge gutters и glyph inset как diagnostics с severity/context; не заменить Friday70–75 универсальным upstream80 и не ругать legal/mock/code без роли. Expected boundary fixtures с transforms, clamps, full-bleed, legal, CJK и Cyrillic.
4. **P2: provenance-aware composition comparison.** Proposed workflow `/audit-design`/`/polish` handoff и будущий raster module, owner design QA. Hero cap-height/wrap/ink advice с confidence/unknown и safeguards control-surround; approved reference+same crop+same viewport. Expected report: numeric deltas плюс взгляд человека, не автоматическая aesthetic acceptance.
5. **P2: Taste profile/catalog как идеи, не глобальные запреты.** Proposed `docs/core/design-profiles.md` / component-curator references, owner design department. Дать варианты centred software window, film service photo, editorial variable-width type, purposeful stat-window/chart fallback. Fonts сначала Cyrillic support, photo assets права/brief, actions реальные. Не переносить dummy claims/anchors, `.example`, Google CDN или max16 gallery debug в client project.
6. **P2: отказоустойчивость effect runtime.** Proposed motion/component curator acceptance, owner motion-curator+QA. Blank-ground own-paper→ground transfer, explicit failed-shader still, viewport destroy и bounded GL budget. Expected slow/fail/no-JS/reduced-motion matrix. Демо html hooks не доказательство работающего fallback; зависимости сначала отдельный review.
7. **P3: русский copy validator.** Proposed copy audit module, owner marketing-agent+QA. Brand/category/CTA identity и facts backed by brief, Unicode-aware normalization и реальные русские verbs; WARN lexical miss, не ложный FAIL. Cases кириллица, смешанные brand, units/currency/inflection, quoted claim без источника.

Все рекомендации — предложения владельцам, не фактическое назначение/реализация. Открытые upstream findings переданы этим отчётом координатору; ничего не скрыто под «дедупом». Установка Loop/MCP/hook plugin, автоматическая правка config/consent либо изменения клиентских сайтов **не рекомендованы как часть текущего аудита**.

## Созданные файлы и финальный verdict

- `closure-6.md` — этот отчёт.
- `closure-6-coverage.json` —32 записи ranges, hashes, totals, notes, supplementary context и53 reference existence checks.

**Verdict: assignment coverage COMPLETE; runtime/design acceptance NOT VERIFIED и не запрашивалась.** Вне срезов driver/quality/loop_connect/hook_tests/fullpage/consistency ничего не объявлено полностью прочитанным. Зависимости, названные по коду и проверенные на существование, не объявлены выполненными или семантически проверенными. Исходники, config, роли и клиентские сайты не менялись.
