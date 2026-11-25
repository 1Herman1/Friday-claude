# Closure 7 — содержательное закрытие назначенных диапазонов

## Результат и границы доказательства

Сэр, прочитаны все **32 назначенных диапазона / 17 974 строки**: Impeccable — 15 313, Taste — 2 661. Точные пути, полные SHA-256 файлов, total_lines и прочитанные ranges находятся в `closure-7-coverage.json`. Все 32 SHA-256 и количества строк совпали с upstream inventory. Срезы больших файлов **не объявлены полными файлами**: ledger использует `status: partial` для каждой назначенной записи; заполненный range означает полное закрытие именно задания. Дополнительный соседний контекст отмечен отдельно и в 17 974 не включён.

Revision snapshots: Impeccable `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`, Taste `d1a2bb41d927083ac7118f60cfc9cdf711810ea0` (inventory). Friday — текущие прочитанные working-tree файлы, не утверждение о чистом HEAD. Kowalski в это назначение не входит.

**Вердикт: PASS по покрытию назначенных ranges; NOT RUN по runtime/tests/UI.** Ничего из upstream не импортировалось и не запускалось, installers/hooks/браузер/тесты/сеть не использованы. Анализ теста ниже означает его контракт и assertions, не зелёный прогон. Изменены только два назначенных файла отчёта. Отдельное независимое ревью выполняет координатор, не этот конечный специалист.

## 1. Impeccable — реальные проверки, а не только архитектура

### 1.1 `crates/foundations-scan/src/lib.rs:1–1600`

Чистое ядро над `Source`: само не открывает файлов, процессов, потоков и часов (`:1–10,79–144`). Хост даёт sorted relative listing, ограниченные bytes, git-tracked list и факт недоступного stylesheet. Для streaming-host различаются Missing / Unreadable / Present; сохраняются компактные facts, а не весь source.

Ограничения не декоративны: 20 000 files, 100 000 entries, 6 000 reads, 512 KiB sample/file, отказ читать файлы >2 MiB; retained structural text ≤128 files /4 MiB; secrets имеют отдельные 20 000 reads /256 MiB (`:22–40`). Walk исключает dependencies/build/обычные hidden directories и symlinks; скрытые CI directories разрешены, DFS в порядке имён, итог sorted (`:42–77,683–737`). `fact` кэширует результат и следит за бюджетами (`:1108–1149`).

**Содержание facts:**
- HTML с runnable script, external CSS/import либо недоступным local CSS получает unresolved; JSON/importmap script не считается исполняемым (`:324–357`). Это граница статического доказательства, не запрет JS.
- Dependencies извлекаются из package manifests глубиной ≤2; root package scripts отделены от nested SDK dependencies (`:368–406,1152–1209`). Ищутся icon/manifest sources, ErrorBoundary, catch-all route, social preview, реальный error-capture marker; один лишь PostHog analytics не равен captureException (`:408–440`).
- Motion определяется по CSS/Tailwind/Web Animations/Svelte/motion syntax, guard — reduced-motion/useReducedMotion/MotionConfig; `animate-none` исключён (`:442–456`). Наличие guard — текстовый факт, не доказательство всех ветвей.
- Design tokens: собственные CSS color vars без vendor prefixes, var uses, theme API/Tailwind theme; отдельно hardcoded colors (`:458–492`). Giant/generated evidence использует line count и первые пять строк (`:494–504`).
- Migration recognizers: Rails change/down, Laravel up/down, JS/TS экспортированные методы, SQL up/down markers и `.up.sql` pair (`:509–560,1542–1600`; конец функции дочитан `:1601–1613`). Это проверка наличия down/change, не исполнимости или восстановления данных.
- CI извлекает команды и push/PR trigger, знает команды npm/test runners/cargo/go/pytest и др.; unknown action/task/команда переводит отсутствие результата в unknown, не безусловный fail (`:577–605,1352–1378`). README ищет install + run, затем проверяет существование именованных package scripts, допускает server.js для npm start (`:1483–1539`). Ни CI, ни README не исполняются.

`scan:803–916` собирает roadmap states: отсутствие доказательства — omission, не checked. При caps сохраняются лишь доказанные находкой положительные/отрицательные состояния. Git secrets budget независим от walk, кроме fallback listing. SecretFacts сохраняет **line/kind без значений**, максимум пять hits/file, исключает placeholders и Google Firebase client keys по контексту (`:159–215`). Это разумная redaction, но recognizer не заменяет secret scanner.

Web view умеет remap одного nested app и Astro srcDir/publicDir (`:974–1064`), не обещает оценить произвольный monorepo. React Native/Expo и Rails api_only не объявляются сайтами (`:1273–1285`). Notes-only репо не принуждается к app infrastructure. Dependency/IaC checks в этом срезе принимают **наличие config** (Dependabot/Renovate/Dockerfile/hosting/tf etc.), не работоспособность deployment или сканера (`:1381–1466`).

### 1.2 `crates/cli/src/foundations.rs:1–333`

18 items в осмысленном порядке launch → revenue → scale: secrets, contrast, AI patterns, 404, icons, social, legal, README, CI, tokens, reduced motion, real packages, dependency scanning, error tracking, reversible migrations, giant files, current dependencies, IaC (`:18–109`). Сетевые утверждения «real packages/current dependencies» не выдумываются локальным ядром.

Detector class mapping отдельно: low-contrast → readable-contrast, registry slop → no-generic-ai-patterns. Non-advisory finding всегда failing; advisory не позволяет заявить none-found. `--no-advisory`, regex-only components, inline/value ignores, caps блокируют pass; unresolved styles отдельно блокируют contrast (`:134–196`). Отличать **none found by this scan** от нормативного WCAG PASS обязательно.

CLI canonicalizes folder, подавляет вывод внутреннего detect, соединяет local/detector items, выбирает первый failing как next, печатает JSON `{items,next}` либо roadmap с not checked. В JSON нет secret locations, в terminal есть до пяти redacted file:line/kind. Может вызвать account upload после полного scan при health gate. **Exit 0 в :283 даже при failing items** — это roadmap command, не CI gate. Возврат внутреннего detector в :246 не используется; из одного успешного выхода foundations нельзя выводить успешный detect.

### 1.3 `crates/core/src/browser/quality.rs:3201–4800`

Заголовочный outline (`:3206–3342`) удаляет script/style/template/noscript text и игнорирует фактически NotRendered/NoArea или declared mockup. Sr-only, parked carousel, fading reveal не удаляются из смыслового outline. Footer waiver узок: разрешён вход в footer columns / closing CTA; более поздний skip внутри footer продолжает репортиться. Не переносить как blanket «footer headings не важны».

Page overflow (`:3344–3722`) причинно различает **text cut off** и **page scrolls sideways**: viewport/root/body overflow, RTL scroll side, root scrollWidth, ancestor clip. Отбирает реально сканируемые painted text blocks с учетом scoped ignores, выдаёт один page-level finding вместо десятков неверных рекомендаций добавить padding. Находит widest causal box, но не обвиняет асимметрично translated slider track (16px asymmetry); именует bare div через id/ancestor/excerpt. Без recorded scrollWidth wording осторожнее, не доказательство reachability.

Большая часть второй половины — важные regression fixtures (`:3724–4800`):
- buried raster — не SVG, маленький icon, blurred placeholder, crossfade под уже нарисованным sibling;
- маленькая footnote link внутри sup не UI nav; html.js-nav-ready не делает весь page navigation;
- line-length по **rendered text-line rects**, не ширине контейнера: короткий хвост после одной длинной строки не wall of text; вложенный list не присваивает родителю свои строки; inline fragments объединяются, columns с gutter остаются разными; tight leading не удваивает line; нет line evidence → нет обвинения (`:3877–4087`);
- cramped padding по glyph-space, не `padding:0`: flex-centred button может иметь 12px воздуха; transparent focus border не рисует край (`:4089–4344`);
- flush children по реальным текстовым insets, table cell padding/transparent shells, offset/transform cancellation, margin collapse versus flow-root (`:4122–4192,4346–4784`). Последний accordion helper дочитан до `:4835`, не включён в assigned total.

### 1.4 `crates/core/src/browser/page_checks.rs:1–1600`

`check_typography:238–350`: font-family выбирается как первый nongeneric face, aliases нормализуются; ≥20 text elements, уникально наиболее частый font, own-brand-domain exemption. Чтобы short labels не перевешивали body copy, suppress если face <5% characters. На CJK-majority page дополнительно считают letters, потому Latin-first stack может реально рисоваться fallback font. Face-not-loaded suppress требует **обе** записи document.fonts и measured rendered faces, не просто отсутствие загруженного webfont (`:103–232`). Это точнее Friday regex запрета имени.

Flat hierarchy samples: actual rendered, не sr-only/zero-opacity/hidden, size 8..200px, роль heading/body, исключены body chips из 1–2 own characters, script текст не считается (`:357–454`). Severity делегирована shared rule implementation, её пороги за пределами среза не приписываются этому файлу.

Nested cards — computed paint/geometry, не просто `.rounded` внутри `.border` (`:456–1389`):
- исключены media/input safe tags; rounded/shadow и ≥3 painted edges либо отличающийся fill;
- edge alpha/width/style, compositing against plausible underlying surface; delta channel 8 для края, >3 для fill; surface sanity читается по ink до 8 text holders/64 nodes;
- fill-only inner chat/stat tile не inner card; pill/single-line label, field composer с ≥1 text field и ≤1 короткой button row (20 chars), media frame ≥60% area — отдельные семантики;
- shared 3 edges или corner в clipped column — часть той же card; control strip ≥3 small controls/scroll track, first dialog panel, figure+caption, main monospace output, media player не обобщаются как плохая вложенность;
- output block: ≤2000 nodes, ≥60% text в основном block, ≥90% monospace, preformatted/inline-run/stacked code checks; обычные monospace labels не код;
- минимальные deepest offenders, product-mockup advisory, full-page frame отдельно (≥75% document height и без видимой самостоятельной границы).

Срез доходит до heading-rhythm helpers: normal-flow painted boxes, display:contents walk-through, ≥8px horizontal overlap, background image действительно band лишь при cover/tiling/full gradient, rule/photo/heading-group разделяют контент, framed block — не separator (`:1392–1600`; функция дочитана `:1601–1609`). Итоговый heading-rhythm rule за границами не объявлен прочитанным.

### 1.5 `crates/cli/src/first_viewport.rs:1–479` и `crates/cli/tests/first_viewport.rs:1–357`

Самостоятельный executable quality gate, не screenshot wrapper:
1. Required URL + thesis/action selectors; defaults 390×844, 1440×900, custom viewports.
2. Thesis painted area visible ≥50% с ancestor clips и собственной scroll area; action wholly inside. Fixed/absolute escaping containment учитывается; rotated-away backface не виден.
3. Price/percentage первого экрана должны иметь видимую sample/illustrative/placeholder/fictional метку рядом (160px) либо явный `--figures-supplied`.
4. Full-page capture до 20 000px, empty band ≤0.6 viewport height; media box не считается пустотой; optional review PNG.
5. На свежей странице primary action действительно **кликается**: 1.2s quiet baseline наблюдает background mutations, затем 800ms ищет новую mutation, submit, scroll или navigation start. Поздний control ждут до 3s. `_blank`, download, mail/tel/sms принимаются без перехода. Неверный `#`/missing href/js link failing.

Side effects важны: page scripts/network, lazy images переключаются eager, scroll/fullpage layout, screenshots/files, реальный click/submit/navigation. **Не запускать на клиентском checkout/form просто ради визуального аудита.** Нужны fixture/staging и запрет destructive/payment actions.

Статический риск: click evaluation error в `:372–375` трактуется `true` (расчёт на navigation destroying execution context), поэтому произвольная JS exception тоже может выглядеть как «answers a click». Разделить navigation-confirmed и unknown evaluation failure перед переносом. Другие ограничения: geometric visibility не доказывает отсутствие occluder; 800ms не бизнес-success; sample vocabulary английский; names PNG по width могут перезаписаться для двух одинаковых widths с разной height.

Тесты конкретно покрывают hidden/backface/clipped media, slow navigation, cancelled Navigation API в том числе listener из click, ticking background не response, fixed containing block, real PNG header. Если browser не установлен, browser cases **возвращаются рано**: process-level green не равно проверенный browser coverage. Здесь не запускались.

### 1.6 Контракты live-edit и installer tests

**`tests/live-e2e-llm-agent.test.mjs:1–1600`.** Provider config default в snapshot — OpenAI gpt-5.6-terra/medium; Anthropic/DeepSeek explicit/env precedence, custom baseURL; Anthropic без temperature, DeepSeek temperature0 + low-effort thinking. Нет key → null, paid provider replay только `IMPECCABLE_LLM_REPLAY=1`, иначе skip (`:23–267`). Это наблюдение тестового контракта, не актуальная рекомендация модели Friday.

Главный transferable intent (`:358–1521`): schema-valid sourceEdits, complete current batch, coverage по **каждому op**, failed entries не получают writes; sourceHint file+line не заменяется outerHTML; text/objectKey/context candidates допустимы без hint. Текст `007` сохраняется буквально и quoted, model numeric/boolean/array/object не превращается в произвольный display string; expression-only JSX/спецсимволы валидно quoting. Lookup-rendered copy правится в соответствующей map entry, rename label обновляет coupled count/icon/image/asset keys, restore восстанавливает numeric type, не `'17'`. Repair работает с current source, не rollback чужих файлов. Assertions prompt-regex — наличие guidance, не доказательство модельного соблюдения. Progressive variants: first params пустые; remaining exact requested final set, first innerHTML неизменен, already-published CSS не повторяется; preserve copy и replacement-root, no source-identical no-op (`:1523–1600`, конец assertion дочитан `:1601–1613`).

**`tests/live-e2e.test.mjs:1601–2565`.** Tail helpers обеспечивают nested appRoot отдельно от repo/contextRoot (PRODUCT/DESIGN сверху, state снизу + pointer; `:1610–1654`). Error artifacts включают logs/source/git diff/screenshot, это локально чувствительные артефакты, не безопасная телеметрия (`:1706–1757`). `auto` вправе перейти на fake, explicit llm без key skip; не выдавать fake как agent-backed PASS (`:1795–1842`). Malformed ack не очищает pending buffer. Save → stash count → Apply loading → server stash0 → source contains/missing/regex → **reload после проверки served module** (`:1934–2062,2220–2265`): overlay text не доказывает persistence. Accepted cleanup проверяет wrappers/carbonize/manifest, stateProbe сравнивает before/after, поддержаны source-shadow/Svelte adapters.

Ограничения test helpers: `assertVisibleText:2267–2280` проверяет textContent, не visibility; stash/status fetch `:2302–2314` без AbortSignal, поэтому внешняя polling deadline сама не ограничивает зависший fetch. Их нельзя переносить как образец абсолютно bounded runtime.

**`crates/skills/tests/drift_ports_tests.rs:1–1593`.** Exclusive wx download сохраняет старый destination; 404/transport/insecure initial/redirect/too many redirects не оставляют файл; staging random mkdtemp/0700/cleanup. Provider-specific agents/home/project, relocated DSH_HOME без порчи project install; inferred update и check согласованы; engine binaries не мешают freshness. Hooks — launcher exists/current, затем prune дубликата, чужие formatter/model/permissions/events сохраняются. Особенно важно: `--no-hooks` не означает no config writes — существующий Cursor preToolUse migrates в postToolUse и без нового consent (`:1069–1145`). Declined project consent блокирует **новые** home/project hook installs. Doctor после update сообщает, не правит PRODUCT. Unmanaged `.codex/skills` copy отдельно от `.agents/skills`, symlink на тот же install не дубликат. Это тесты в fake home, не разрешение менять Friday paths.

**`crates/cli/tests/loop_connect.rs:1601–1902`.** Cursor exact roundtrip restore; Copilot wake hooks зависят от Loop version, оставляет per-repo tool approval человеку, не пишет approval config. Codex fake app-server доверяет только конкретным hooks, которые connect добавил, disconnect отзывает только их trust. OpenCode сохраняет JSONC как есть и даёт followup вместо переписывания, merge JSON, journal plugin, shell quote paths, XDG/custom home, version gate и symlink plugin-dir preservation. Connect/disconnect — широкая конфигурационная операция, не skill-content import.

**`crates/cli/src/install_sign_in.rs:1–228`.** Terminal+stderr TTY → offer, CI/help none, `-y`/nonTTY → hint **до** Keychain read. Fresh sign-in schedules setup, connects MCP, scans repo, предлагает Mac Loop при плане Pro+ и отсутствии app; errors не делают установленный skill неустановленным. `tcflush` убирает старые Enter, пустой новый ответ yes. В отличие от чистого копирования MD это account/network/MCP/application onboarding с дополнительными side effects.

### 1.7 Health и serve-question: state/consent не подразумеваются

**`crates/cli/tests/health.rs:1–1408`.** Fake HTTP service + subprocess/gits/locks, не network-free unit suite. Ожидается full git-root-only scan, стабильные repo/stream/ruleset/fingerprints, unique scanId; path/snippet/remote owner не уходят в counts. CI/DNT/no-telemetry/off обычно запрещают sync, corrupt state считается off, невозможный persist не успех; forget требует server confirmation и оставляет off даже при отказе. Scope предлагается только advertised service и хранится на конкретном grant; combined scopes independent. Design/rules ignore changes меняют baseline, mtime не меняет. Busy lifecycle не блокирует detect, token refresh не ломает session generation; off/forget fences admitted upload и stale late success.

**Реальная privacy delta:** `:607–720` утверждает default-on sync **всего текста DESIGN.md** при соответствующем granted scope плюс whitelisted color/typography metadata; components/narrative sidecar не отправляются, file limits/control bytes проверяются, hash cache только после success. Это не «только анонимные counts». `:1310–1324` прямо закрепляет исключение: **первый login scan отправляется даже с DO_NOT_TRACK=1**, считая sign-in согласием для одного scan; далее DNT работает. `:1338–1355` отделяет DESIGN upload от login, но следующий detect может отправить его. Для Friday это conflict с минимизацией и явным scope, не готовый default.

**`crates/context/src/serve_question.rs:3201–4329`.** Назначенный tail — тесты, не всё production implementation. Контракты:
- Surface roll comp-led: все cards обязаны declare comp до hand/state/spawn/delivery; refusal оставляет roll для исправления, successful update consume (`:3211–3260`).
- Per-hand generated marker name содержит tag hand, reused image-slot не переносит старое approval; failed hand write сохраняет marker, prune не удаляет marker параллельного нового hand; legacy markers проверяют содержимое (`:3263–3394`).
- Chosen decision comp = option one будущего composition round, **не approval финальной композиции**. Approval требует соответствующего phase/served hand; stale images и missing sidecar сообщаются отдельно (`:3396–3468,3737–3933`). `NEXT open/render-check` — инструкция один раз на hand, не факт просмотра.
- Worlds board+hero используются style inspiration, не копирование content/layout; свежесть и scope roll, safe slug/http URLs, fetch лишь under configured card base либо HTTPS named public-looking host, loopback/IP/internal/userinfo отсекаются. Проверяются bytes signature вместо доверия image Content-Type; HTTP wall с 200 не сохраняется как картинка; fallback URL не ломает question delivery; existing cache/fake mode не fetch (`:3471–3727`). URL appearance tests сами по себе не доказывают DNS-rebinding protection.
- Loopback Host/Origin exact match и detached key до Origin (401 vs403), percent-decoding; burst socket tests; choice ping claim/confirm/retry stable pingId, DNT suppress, picker/agent no duplicate (`:3938–4202`).
- Questions/mocks/review self-ignore; tracked old roll.json не переписывается, новый roll.local.json wins и игнорируется, owner получает разовый git-rm-cached hint (`:4204–4327`). Useful pattern: protected tracked state migration без destructive cleanup.

### 1.8 Browser treatment и numerical compatibility

`crates/browser/tests/consent_hiding.rs:1–700`: default скрывает known vendor/own cookie notice перед scoring, removes только принадлежащие consent scroll locks/blur/aria-hidden, evidence показывает matched/hidden/unlocked. `--no-consent-hiding` оценивает banner вместо прикрытого page. Late/shadow/frame walls — invalid/consent-wall, не clean scan; short page/form/nested web-component не wall. Newsletter/login/legal policy links, site-modal/app-shell locks, чужой paywall/decorative blur остаются. Tests защищают от ошибочной «очистки» всего overlay. Для Friday RKN-review нужен **отдельный неизменённый consent capture**, иначе такое скрытие уберёт предмет правового аудита.

`crates/browser/tests/declared_mockups.rs:1–172`: frame-like inert/aria-hidden declared drawing исключает low-contrast/nested/tiny/UI-text и outline; live demo, small badge, two text runs, form step, carousel rest, dialog, hidden copy рядом с original — не blanket exemption. Screenshot-labelled drawing advisory и для pixel pass; page text тех же цветов не exempt. Оба browser suites рано return без browser — не считать их присутствие runtime proof.

`tests/oracle/cases/detect.mjs:1–443`: generator corpus, не assertions результатов: per-fixture JSON/text, --no-config чтоб не игнорировать свои fixtures; scopes/unknown flags/SARIF/GitHub/changed git files/missing target precedence, config/inline/design/linked stylesheet/globstar boundary/brand hue waiver; --before/--kept static wiring сохранение. Setup меняет disposable git/files/chmod; invocation на рабочем Friday запрещён этим аудитом. Важно иметь clean, missing, unknown и zero-input cases, не только positive findings.

`crates/foundation/src/fdlibm_trig.rs:1–562`: bit-level scalbn, range reduction pi/2 tables, kernel sin/cos polynomial и quadrant, NaN/Inf и smoke tests. Comments честно фиксируют arm64 FMA one-ulp exception: «exact V8 parity» не безусловно bit-exact. `js_ext_a.rs:1–242`: UTF-16 counters/slices (surrogate orphan dropped, advance rounds up/retreat down), ASCII word/JS whitespace/number truthiness, insertion-order linear Vec JsMap. Comma split намеренно повторяет JS regex lookahead, не полноценный nested CSS parser. Это portability infrastructure, не дизайн-правила Friday; не переносить ради вкуса.

## 2. Taste — проверки и назначенные демонстрации

### 2.1 `skills/taste-skill/scripts/consistency.mjs:6465–7489`

Начало/конец функций дополнительно прочитаны `6425–6464,7490–7515`. Это browser-side portion: DOM/computed styles/text ranges/canvas/scroll/animation APIs и state caches `seen/told/snaps/loopers/moving/heldInfo`. Оно **меняет scroll**, измеряет во времени, ловит exceptions отдельно по check и сохраняет `out.errors`; отсутствие findings без просмотра errors не PASS.

**Geometry/interaction (`:6473–6646`):** centred text ось сравнивается с внутренним content frame, page deviation ≥12px FAIL, ≥6 WARN, исключены fixed/drawn/scroller/marquee/controls. Button label учитывает icon/picture, imbalance >12 WARN; photo в button FAIL, другое raster WARN. Heading line collision и stranded action >300px horizontal/>240px vertical, но nearby form/list/media также засчитываются как content. Nav signature записывает fonts/sizes/fill/current hash styles/marks и число sections, не требует видимого current state на короткой странице без раздельных sections. Phone 320 pass ограничен fold/collision/tap-size, не претендует на весь audit.

**Causal motion (`:6649–7023`):** не «нашли transform значит плохо». Snapshot vector включает matrix/individual translate-rotate-scale/opacity/clip/filter/color/text. Отсекает carried scroll positioning. Settle ждёт 220ms snapshots до 3s и помечает продолжающиеся loops. Probe делает четыре шага вперёд/назад, возвращает, повторяет extreme, watches still clock 6×400ms или 11×400ms для mock, дополнительно смотрит visible mock loop. Сравнивает baseline/return и repeat с half-max tolerance; threshold vector distance .012. Большой linked block ≥100×60 или sticky stage — FAIL, маленький — WARN. Fixed small bars исключены, sticky stage ≥35%vh с hold≥25%vh измеряется отдельно до 30 steps.

Reveals ниже hero отличаются от hero entrance: pre-scroll restDist/clip/class splits, media load fade исключён; outermost по section, не сотня glyph reports. IO hook evidence ловит старт animation на входе, кроме short effect mount ≤600ms / first-screen data-enter ≤1200ms. CSS scroll/view timelines отдельный channel. Это **house policy** против scroll-linked/reveal, а не WCAG правило; Friday при высоком MOTION_INTENSITY разрешает reveal.

**Composition/content (`:7025–7442`):** occupancy grid ≥8px cells, histogram largest interior empty rectangle, card empty band >30% WARN/>40% FAIL, section hole >40%width и >25%vh (FAIL >35%vh). Нельзя автоматически уплотнять специально задуманное whitespace: statement/split-hero facts exceptions явные. Visual coverage <25% main section обнаруживает недоделанный page; place/product pricing/rooms/goods НЕ exempt как software pricing, statement/word/editorial hero и short page exempt по declared type. Quiet section text-only <5% отдельно.

Page info собирает max descendant heading size, lines/words, hero/after copy, CTA location и actual href, priced card без action, longBare >1.5vh. Empty/#/missing anchor FAIL; CTA только scroll в нерешающую секцию WARN. В этом коде javascript: links просто пропускаются (`:7290`), это не security validation. Card-family сопоставляет repeated classes без state/layout tokens: разные title faces ≥3 cards FAIL; fills — минимум два экземпляра каждого (одна featured card допустима), stripes compare inset/bleed/round. Heading outranked измеряет **actual canvas x-height/caps**, WARN body/heading≥.92, FAIL≥1.0. Link looks и same action button vs link выявляются без footer sitemap noise.

**Hover (`:7444–7489`, завершение `7490–7493`):** hidden-at-rest images до 12 candidates; card hover candidates ≤30; transforms/3D/rotation/lift и image zoom, signature вместе с pseudos/до80 descendants, loops исключены. Комментарий задаёт linked card 2px lift/photo1.02–1.03/no tilt, но конечный downstream verdict за пределами assigned range не приписан этому срезу.

### 2.2 Все назначенные assets: concrete design, dependencies и статус

Это code-reviewed templates/demos, **не визуально просмотренные страницы**. Проверены 70 статических local src/href/from/@import references в назначенной группе: все targets существуют. Это existence, не успешный import/render, не транзитивное покрытие всей библиотеки. Remote Google Fonts остаются внешним запросом. Ни один HTML mock не доказывает реальные app/order/refund/payment capabilities.

| Файл (под `skills/taste-skill/assets/`) | Содержание и полезная грань / ограничение |
|---|---|
| `ui/cards.html:1–617` | Девять композиций: 2×2, 7:5 bento, split text/panel, equal-size stats, integrations, quote+result, pricing, tall panels, developer tools. Общие tokens light/dark; планшет full-row без пустой половины; clipped/faded UI screens, не icons вместо продукта. `fx.js/ui.js`, localStorage theme, query frozen clock, still grounds free contexts; per-group UI-loop и однократный hover/focus edge-glow с reduced guard (`:542–614`). Business facts вымышлены, CTA self-anchor. Gallery GL max16 — не budget обычного сайта4. |
| `objects/_print-core/cards.html:1–161` | Rendered cup/wheel/lamp/cards; tile engraving/halftone/dither; wide hero clear text half и square mobile. fx/ui/auto print mounts, palette reset, ready после Promise; comments context budget не runtime observation. |
| `moments/_demo/in-page.html:1–149` | Полноценная place composition: harbour photo hero, room/price rows, три photo chapters с собственными photos, отдельный word-highlight statement; booking mailto/directions и mobile actionbar; Fraunces+Figtree, inverse tokens, credits/licenses. `system/motion/layout`, module preloads + 700/2500ms safe classes. Реальный moment runtime не в HTML. |
| `layout/hero-product.html:1–119` | Coffee product photograph + точные roast/price/delivery facts, Instrument Serif/Sans, 4:3 mobile media, menu/CTA/footer. Каждый shop/basket action ведёт к #use: образец layout, не ecommerce implementation. |
| `layout/fonts.html:1–117` | Fetch type.json → domain filter → Google Fonts axis family merge/order → h2/h3/body specimen с clamped weight/tracking/stretch/scale; await fonts.ready. Trusted library metadata через innerHTML, нет fetch-error UI и Cyrillic specimen. |
| `objects/_scenes/demo.js:1–83` | Escaped cfg text, пять palettes, hero/card mount + surface swap, history query palette, destroy/remount fallback, pause/resume и controller.ready. Catch rejected ready → console.warn, затем dataset.ready=1: ready не означает successful mount. При remount pause state не переигрывается явно. |
| `scenes/letter-physics/demo.html:1–81` | Ledger mock labelled role img, inverse statement «week → afternoon», concrete-photo background, `--h:1`, sc-js failsafe и scenes.js. Physics implementation в module, не здесь; links #. |
| `ui/calendar/fragment.css:1–68` | Fluid 280–440px, seven-column range band + ink endpoints, единственная accent date, today dot, clearing/event dim/now. 30/32px dates/28px nav — mock scale, не готовые 44px controls; нет local reduced-motion override. |
| `components/fx-tabs/component.css:1–64` | Active indicator — clip-path window по неподвижному effect, без canvas resize; aria-selected цвет меняется после inline --w; focus outline, 4px panel entrance, reduced-motion indicator/panel off, mobile scroll fade/end и таблица с hidden fourth column. 36px tabs не 44px baseline Friday. |
| `layout/demo.css:1–57` | Явно demo-only manually drawn window/sidebar/rows/chips/chat, dark variant, tabular nums; mobile sidebar/numeric column hide. Не source of truth для функциональных components. |
| `moments/giant-type-pass/demo.html:1–49` | Giant two-line type + photo pass travel60/focusY60, coastal trip copy, before/after real photo sections и credits; moments module/preloads/safe class, actions #. |
| `objects/_print-core/demo.css:1–39` | 100svh clipped stage, pointerless text overlay, pointer-enabled palette segment, focus ring/pause z-order, mobile stacked bar; Google Fonts import, no local reduced-motion override. |
| `ui/chat/fragment.html:1–32` | Question/answer/source data-hooks, Shopify inline masked SVG + doc citation, semantic mock close/send spans, не form/input/button/aria-live. «Changed address» — presentation string, не действие над заказом. |

Две tool-output truncation восстановлены из полного spill: cards source `228–277`, combined first_viewport source `358–382`. Непрочитанного середины в assigned ranges нет.

## 3. Friday — semantic comparison и доказанный delta

Сравнение **только с прочитанным local scope**, не claim об отсутствии возможностей во всём Friday. `.codex/CODEX.md`, README/researcher/review-loop прочитаны; отдельные executing role TOML/live hook state не проверялись. Readable MD → намерение; script → статически установленное поведение; active runtime → NOT VERIFIED.

| Область | Статус и Friday evidence | Доказанный delta / не переносить |
|---|---|---|
| Визуальный review трёх ширин | **already equivalent по требованию**, не runtime: `.codex/agents/design/design-reviewer.md:39–65`, `.codex/scripts/screenshot.mjs:34–38,107–139` | Friday уже требует смотреть screenshot; не добавлять ещё одно общее «проверь mobile». |
| Measurement первого экрана | **partial**: `.codex/commands/preflight.md:14–15`, screenshot фиксирует raster, не thesis/action shares | Impeccable добавляет bounded numeric gate + sample figures + blank bands + causal click. Отдельный optional fixture tool, не замена judgement и не live destructive click. |
| Font anti-slop | **partial/conflict в строгости**: design-lint `:7–18` ловит имя Inter/Arial построчно; reviewer `:127–132` даёт 65–75 chars | Upstream unique primary/rendered face/CJK/glyph evidence подавляет false positives. Generic font запрет не равен measurement. Не брать blacklist или демо Geist/Fraunces как бренд по умолчанию. |
| Nested card/spacing | **partial**: reviewer `:140–146` rounded/border/shadow nesting и тесный padding | Delta: paint/semantic exceptions, text rects, tables/dialog/media/labels/transparent shell. Контраст и insets нельзя доказать Tailwind regexp. |
| Contrast | **partial**: design-lint `:20–26` class-pair heuristic; preflight `:11` норматив AA | Нельзя назвать найденную комбинацию «измеренный contrast <4.5». Browser compositing + screenshot adjudication отдельны от regex. |
| Reduced motion / loops | **already equivalent по принципам**: `docs/core/motion.md:87–103,140–148` | Полезны behavioural probes/loop-clock exemptions и resource destroy; policy detector не копировать целиком. |
| Scroll reveal | **conflict**: Friday motion `:66–70,137–138` разрешает при повышенном M, Taste `consistency:6912–7023` осуждает ниже hero | Ввести policy profile/advisory, не универсальный FAIL; иначе разрешённый Friday motion неизбежно «красный». |
| Touch targets/motion tab UI | **conflict для production**: reviewer `:153–156`, CODEX `:360`, preflight `:18–19` | Taste demo 28–36px controls и 350/420ms clip motion не ready-made Friday controls. Их mock scale не оправдание реального маленького tap target. |
| Tokens/cross-project boundaries | **already equivalent частично**: design-lint `:124–161,166–184` выбирает MASTER по пути файла и cache | Upstream nested appRoot/repoRoot separation и ruleset content hash полезны для нового tooling, не миграция Friday MASTER в DESIGN.md. |
| Honest unknown/coverage | **partial**: CODEX `:780–804`, review-loop `:29–42`; design-lint `:263–300` default только .tsx, missing paths silently skip, exit0 | В новом scanner явно filesScanned/errors/unsupported/unknown, zero-input не clean. Existing lint exit0 не внедрять как binary release gate без adaptation. |
| Preview persistence/source integrity | **partial в inspected scope**: preflight `:20`, review-loop revision `:40–42` | Полезны typed numeric/exact-copy/coupled keys, current-source repair, reload after module catches up; tests не только overlay DOM. Готовый live editing backend не добавлять без отдельной задачи. |
| Health/account sync | **conflict / not applicable к audit**: CODEX `:25–29,53–55,88–90,228–238` | Не переносить default DESIGN upload/DNT override. Local-only отчёт достаточен; отдельные scopes и readback/fences хороши лишь при одобренном sync feature. |
| Consent hiding | **conflict если смешать с RKN**: preflight `:26–38`, CODEX `:387–406` | Снимать raw consent/legal state отдельно, normalized content scan маркировать intervention evidence; нельзя выдавать hidden-banner scan за проверку правовой обвязки. |
| Comp provenance/owner acceptance | **already equivalent по gate**: CODEX `:20–29,84–90`, reviewer `:25–33` | Delta per-hand marker/prompt sidecar/stale warning, а не повторять owner approval. NEXT instruction не acceptance receipt. |
| Library templates | **partial**: preflight `:22`, reviewer `:86–91` требуют real visuals и MASTER | Добавлять metadata template-kind=demo/mock/production, dependency/licence/state contract; не переносить вымышленные цены, реальные-looking claims и # actions. |

### Рекомендации только по delta (будущая работа, здесь не выполнялась)

1. **Owner qa-engineer + tooling maintainer; target `.codex/scripts/screenshot.mjs` либо отдельный sibling measurement tool.** Предложить JSON evidence с viewport/thesisShare/actionInside/blankBand/unknown/errors, но click только явно разрешённые fixture targets. Acceptance: hidden/clipped/fixed/slow/cancelled/busy pairs, unsupported/eval error → unknown/fail, отдельный frozen screenshot. Не копировать `EvalOutcome error => true`.
2. **Owner design-reviewer maintainer; target `.codex/agents/design/design-reviewer.md` и синхронный executing adapter только отдельной revision.** Уточнить реальные line boxes/glyph padding и semantic card exceptions; headings/footer не blanket waiver. Expected output: finding содержит measured/visual evidence, не class-name conclusion; negative fixtures table/chat/media/mock/live.
3. **Owner qa-engineer; target tests нового browser evidence layer.** Перенять causal forward/back/still-clock probes, явно экспортировать check errors/unsupported и profile M. Expected: reversible scroll-linked ≠ load fade/loop; high-M allowed reveal не mandatory failure; reduced-motion две ветви.
4. **Owner component-curator/taste-curator; target каталог разрешённых refs/templates, не автоматически клиентский код.** Из templates полезны real product visual over calm ground, one accent date, same-sized stat baselines, photo chapters и clipped UI. Сохранить licences, external fonts, dependencies, mock controls и домен; acceptance: Cyrillic specimen, 44px controls, working destination, real client facts, reduced/no-script/error view.
5. **Owner code-reviewer/qa-engineer; target будущий visual-copy edit regression suite.** Exact staged copy/leading zeros + type restoration + dependent lookup keys + persistence after reload. Expected: failed-entry source untouched; repair current revision only; source and served module and final browser state проверены раздельно.
6. **Owner privacy/security + RKN; target любое будущее external-account integration.** До реализации separate opt-in DESIGN contents, no DNT override by generic login, grant-bound consent, off/forget races, allowlisted metadata и bounded fetch/refresh. До разрешения оставить local-only. Для normalized browser scan всегда raw consent snapshot + список DOM interventions.

## 4. Проверка завершения и ограничения

- Coverage JSON: 32 unique `(repo,path)` entries, все assigned intervals полностью присутствуют, сумма 17 974. Нет alias/classified shortcut: весь назначенный text прочитан содержательно.
- Hashes/total_lines проверены против существующих inventory, затем повторно по bytes. Это целостность snapshot, не runtime test.
- Все 70 обнаруженных static local asset references существуют; динамические selectors/data-ui/effect keys и remote fonts не считаются проверенными transitive imports. Rust production implementations, на которые ссылаются тесты, вне назначенного среза не объявлены прочитанными.
- Source-only findings: click eval fail-open, health privacy exceptions, helper visibility/deadline limitations и demo ready-on-error подтверждены прочитанным кодом; exploit/runtime воспроизведения нет. Указанные владельцы — рекомендации координатору, не заявление об их фактическом назначении.
- Никаких установок, конфигурационных изменений, hooks, test runs, UI inspection, commits/deploys. Созданы только `closure-7.md` и `closure-7-coverage.json`; служебные tool spills находятся в Hermes cache.
