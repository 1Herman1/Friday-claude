# Impeccable — дополнительное чтение runtime и тестов, close-1

## Вердикт и граница достоверности

**Задание НЕ закрыто полностью.** Из назначенных 139 файлов / 51 090 строк в этом продолжении полностью прочитаны **109 файлов / 17 797 строк**. Остались **30 файлов / 33 293 строки** без substantive reading в этой сессии. Они перечислены в конце и имеют `status: unread`, пустые `ranges` в `impeccable-close-1-coverage.json`. Инвентаризация, SHA256 и прежний mechanical scan не повышены до `full`. Это содержательный частичный результат, не разрешение координатору объявлять exhaustive audit завершённым.

Scope: source-only snapshot `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`, revision из assignment: `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`. Роль: адаптированный Hermes researcher, не нативный Codex runtime. Дополнение к прежним `impeccable-content.md` / `impeccable-runtime.md`, не замена их покрытия.

Полностью дочитаны все пять назначенных файлов `crates/core/src/**`, все назначенные account tests вместе с полным fake issuer, все пять назначенных GitHub YAML; из JS-тестов и вспомогательного runtime — перечисленные ledger файлы. Основная незакрытая область — большие browser/extension/LLM/live тесты, `agent.mjs`, `ui.mjs`, основной Rust hook test suite.

**Проверок запуском upstream не было:** ни import, ни installers, hooks, npm/bun/cargo, бинарники, тесты, браузер или платные модели не запускались. Чтение теста означает установление его утверждений и ограничений, а не успешный прогон. Secret files, `.env`, credential store и пользовательские конфиги не открывались. Писались только эти два собственных артефакта аудита; исходники и Friday client/config не менялись. Ограничение результата — незавершённое чтение большого остатка, не техническая ошибка сборки или сети.

## Подтверждённые статические находки

Все ниже — вывод по исходнику, без исполнения. Предлагаемый regression test — критерий будущего исправления, не уже выполненный тест. Владелец upstream-кода — соответствующий maintainer; координатору Friday передаются findings для решения о переносе/передаче, никто автоматически не назначен исправителем.

### C1 — ВАЖНО: installation subprocess обходит уже предусмотренную очистку API keys

**`tests/live-e2e/session.mjs:112–135`**: `runInstall()` вызывает `execFileSync(cmd, installArgs, {cwd, stdio, timeout})` без `env`; optional Rollup repair также без `env`. При обычном Node child-process default весь `process.env` передаётся дочернему процессу. Следовательно, когда ключи пришли через CI environment, package manager и lifecycle scripts зависимостей получают их. Это конкретный разрыв изоляции, не доказательство произошедшей кражи.

Для dev server в том же файле `:214–224` уже применяется `withoutProviderKeys(process.env)`, а документация `tests/lib/dev-keys.mjs:8–12,84–86` прямо требует не передавать provider credentials children. File-backed keys в `process.env` не вставляются, поэтому условие риска — ключ действительно экспортирован в окружение (типичный CI case), не сам факт наличия dev key file.

Исправление: явно задать очищенный environment в обоих installation subprocesses, включая repair. Проверка: test install stub видит PATH/нечувствительные settings, но не `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CLAUDE_AUTH_TOKEN`; запускается только после отдельного разрешения тестирования. Суффиксный фильтр сам по себе не sandbox и не защищает произвольный секрет с другим именем.

### C2 — КАЧЕСТВО: CSS fast-path пропускает валидные uppercase side bars

**`crates/core/src/checks/side_bar.rs:426–429`** возвращает пустой результат, если raw source не содержит строчных `inset`, `before`, `after` (и `border` в дополнительном режиме). CSS keyword/property spelling регистронезависим; последующие regex для `INSET_RE`/`PSEUDO_RE` в `:249–259` как раз case-insensitive.

Пример для будущего regression: `.it { BOX-SHADOW: INSET 3px 0 0 red; }` возвращается раньше парсинга; семантически эквивалентный lowercase вариант распознаётся. Через snapshot/computed style другой путь может обнаружить эффект, поэтому утверждение здесь именно о CSS-text scanner, не об обязательной слепоте всех движков.

Исправление: регистронезависимый дешёвый prefilter. Проверка: одинаковый результат mixed/upper/lowercase CSS для inset/pseudo/state-border.

### C3 — КАЧЕСТВО: pseudo inset resolver не воспроизводит порядок CSS shorthand/longhand

**`crates/core/src/checks/side_bar.rs:315–360`** сначала берёт физические longhands, затем заполняет только отсутствующие стороны из `inset`, logical shorthands и logical longhands. Это фиксированный приоритет названия свойства, а не source-order cascade.

Например, `.it::before { position:absolute; left:10px; inset:0; width:2px; background:red; }`: действующий поздний `inset:0` задаёт левый край 0, а helper оставляет `left:10px`, после чего edge test `:384–390` отказывает. Порядок logical/physical declarations имеет тот же класс ограничения. Дополнительно зависимость `crates/foundation/src/css/scan.rs:243–257` удаляет `!important` и оставляет последнее значение по имени; таким способом нельзя сохранить важность более раннего shadow.

Исправление: разрешать эти свойства в порядке declarations с importance или явно считать такой scanner эвристикой. Проверка: перестановки `left`/`inset`, logical/physical forms и important shadow vs поздний normal override. Это не повод переносить упрощённый CSS parser во Friday как authoritative cascade engine.

### C4 — КАЧЕСТВО: user bot выбирает не самый новый question daemon

**`tests/new-work-e2e/user-bot.mjs:34–53`** обещает newest state file, но `mtime` получает строку filename (`readFileSync(...) && f`), metadata времени не читаются; `.sort()` применяется к объектам без comparator. Выбор не привязан к времени изменения. При нескольких state files возможен ответ не тому daemon.

Исправление: `stat.mtimeMs` + числовая сортировка с детерминированным tie-break либо обязательный `key` при неоднозначности. Проверка: два state files с обратным filename/time order; выбирается действительно новый.

### C5 — КАЧЕСТВО: часть acceptance в seed walk существует только в комментарии

**`tests/skill-workflow/seed-walk.test.mjs:1–5,28–37,55–75`** описывает working page, менее 20 минут, менее $6 и одну correction round. В реализации default spend cap — $12, timeout — 30 минут, а единственный итоговый assert — существование `index.html`. Нет требования `outcome === complete`, working interaction, свежих captures, допуска по времени/стоимости/rounds. `finishReviewReads` — число открытий reference, не независимых проверок; `captureRuns` считает bash shot/first-viewport, но не предоставленный `browser_snapshot`.

Это measurement harness с очень слабым success criterion, не полноценный quality gate. Наличие файла после budget checkpoint может пройти этот test. Исправление: развести observational benchmark и acceptance gate; для gate добавить complete, function/DOM checks и используемые capture tools. Стоимость привязать к выбранной модели: `SEED_WALK_MODEL` настраивается, а `PRICE` зафиксирован для Sonnet.

### C6 — КАЧЕСТВО: activation evaluation допускает отложенную загрузку skill и не ограничивает длительность вызова

**`tests/skill-behavior/activation.eval.mjs:102–115,145–172`** требует загрузить matching skill BEFORE anything else, но считает любой `Skill(impeccable)` среди всех steps успехом; `firstTool` лишь записывается. При `ACTIVATION_STEPS>1` Read/Bash перед Skill не превращает результат в failure. При default одном step смысл уже, но и параллельные calls в одном step не доказывают порядок исполнения.

`runOne()` имеет 4 retries на thrown errors, но не AbortSignal/deadline. В отличие от него `tests/skill-behavior/harness.mjs:417–476` специально решает stalled socket через реальный abort. Следовательно, число retries не ограничивает зависший первый provider call.

Исправление: отдельно измерять ever-activated и activated-before-work; explicit client timeout для каждого вызова. Проверка: trace Read→Skill не проходит strict gate; never-settling provider завершается по timeout с ошибкой, не PASS.

## Реализация правил: прочитанный core, а не названия checks

### `checks/text_rules.rs` — чистые функции, без сетевых и файловых side effects

Зависимости: `impeccable_foundation::rules::text` re-export (`:15–17`), JS-compatible whitespace/numeric/string helpers, UTF-16 length, color parsing, `Finding`/`StyleMap`. Часть constants/selector sets живёт в foundation, не объявлена заново в этом файле.

- **Kicker** (`:150–222`): heading level truthy и не выше 4; heading text минимум 3 UTF-16 units, не slash path, font-size минимум 20px. Предыдущая label только p/span/div/small, длина 2–34; не `Step N`, не просто 1–2 цифры. Отбрасываются даты/bylines/paths/doc numbering. У h1 dotted eyebrow допускается только без даты/path/byline vocabulary. Нужны uppercase, small-caps либо ASCII caps-only; tracking минимум 0.06 font-size. Это не запрет любого текста над заголовком.
- **Small caps faces** (`:224–242`): берётся первая font-family; SC/small caps name учитывается, но исключается широкий список китайских SC-family prefixes. Это защита от трактовки Simplified Chinese как small capitals.
- **Размер label** (`:244–266`): максимум из базовых 14px для kicker /13px для numbered и относительных 0.45 heading-size, с абсолютным пределом относительной части 16px. Finite positive heading required для относительного расчёта.
- **Numbered labels** (`:268–342`): h2–h4; известный label tag и parsed index; heading не слишком близок по размеру (<1.3 label). Нужно хотя бы одно: mono family substring, weight≥600, tracking≥0.5px, uppercase transform, accent chroma. На странице минимум два кандидата и два различных индекса; по одному finding на кандидат. Index equality имитирует JS SameValueZero.
- **Tracking** (`:344–405`): crushed только строже −0.07em для reading и −0.09em от 40px display, а не запрет нормального tight tracking. CJK определяется по реальному тексту: первые 256 chars, хотя бы один CJK и не менее половины scripted chars, не по `lang`.
- **Measure estimation** (`:407–505`): Latin advance 0.5em proportional /0.6em mono; fullwidth CJK 1em с весом по составу текста. Mono смотрит первую family и known code faces/слова mono, не fallback `monospace` за display face. `reads_as_code` ищет структурные знаки `{ } [ ] < > = ; " backtick backslash _`, но не приравнивает цену/рейтинг к code.
- **Em dash** (`:508–582`): `——` как китайская пара — один знак; ровно `--` с nonspace после считается заменой; `---` только между letters/digits. ASCII rules длиннее не считаются. Список-separators вычитается saturating. Две совместные границы: floor **8**, плотность не реже одного dash на **500 UTF-16 units** (constants проверены адресным чтением foundation). None input → пусто.
- **Repeated card-like surface** (`:584–611`): не просто border-radius: нужен shadow либо минимум три border sides ≥1px, и radius>0 либо background alpha>0.1. Style отсутствует → false. Затем unit tests `:613–834` проверяют граничные значения, code vs labels, CJK/monospace и em-dash punctuation.

### `checks/side_bar.rs` — геометрический anti-pattern с исключениями

- Left/right bar считается `side-tab` **только на rounded box**, от 1px; square box допустим любой толщины (`:63–67,108–123`). Одинаковые стороны — frame; рядом с другими сторонами bar≥2px и hairlines≤1px либо не меньше двойной толщины соседей.
- Исключаются table parts, hr/nonrendered tags, circles и CSS caret с прозрачными border sides (`:55–61,184–245`). Цвет не обязан быть accent; neutral/currentColor/unresolved token может рисовать bar. Alpha<0.1 не рисует.
- Старый `check_borders` вызывается первым, его left/right side-tab удаляются; top/bottom findings сохраняются. Это замена семантики inline sides, не второй дублирующий pass.
- Inset shadow: x-only, y/blur/spread=0, |x| 1–12px, выбирается самый толстый layer (`:273–311`). Narrow own box≤40px не считается чужой боковой полосой (`:464–474`).
- Pseudo: absolute/fixed, width/inline-size 1–12px; left/right offset=0; полный height через top+bottom=0, height100% либо обе кромки в 0–20px. Нужен paint, один URL-background без цвета исключён (`:363–407`).
- State selectors разбираются снятием hover/focus/focus-visible/focus-within/active/checked/target только вне functional pseudos; `:not(:focus)` сохраняется (`:147–178`). Inline radius handling отдельно учитывает normal/important source order (`:80–97`), в отличие от упрощённого pseudo inset resolver.
- CSS comments blanked с сохранением UTF-16 offsets; findings переводят индекс обратно в исходные bytes; одинаковые selectors (кроме nesting `&`) дедуплицируются с заменой на более толстый bar и его position (`:430–515`). Caller должен проверить rounded geometry: CSS-text candidate сам этого окончательно не знает. No filesystem/network writes.

### `browser/text_layers.rs` — когда contrast verdict вообще относится к видимому тексту

Это алгоритм над `Dom` probe trait, а не pixel renderer. Зависимости: DOM/flat tree, effective opacity/background parsers, occlusion grid/viewport, foundation SVG intrinsic size/gradient stops. `browser/mod.rs:83–109` показывает boundary foundation probe/selector и core checks; асинхронные image loading/canvas остаются JS (`:62–69`).

- Четыре состояния `Covered`, `UnreadSurface`, `Consistent`, `Undecided`; verdict сохраняется для последних двух (`text_layers.rs:42–64`). Unknown не выдаётся за измеренный clean.
- `elementsFromPoint` над текстом: opaque replaced media либо fill при opacity≥.95 и fill alpha≥.95 скрывает text. Frosted scrim отдельно требует effective fill alpha≥.75, blur≥8px и ≥трети размера шрифта; неизвестный size не даёт suppression (`:146–174`).
- Под текстом detached sibling image/video/canvas, SVG shape, gradient или flat fill могут отменить ancestor-walk surface. Flat fill composited; RGB channel-distance tolerance 24; unknown paint отменяет verdict только там, где walk дошёл до document ground, не всегда (`:676–754`).
- Decoration не равна surface: opacity≤.1 — wash; pictures/shapes/gradients≤.3 — texture; masks читаются как texture; repeated gradient cells≤64px и repeated image tiles≤256px учитываются отдельно. Sparse circular dot texture: sum ink≤.15 по всем layers, прозрачные/цветные stops в правильном порядке, радиус в px (`:204–533`).
- Grid минимум наполовину во viewport, каждый заданный point должен иметь ответ; минимум половина points находит сам текст. Все deciding points covered → Covered; covered+unread без consistent → UnreadSurface. Частично доступный text сохраняет verdict, кроме отдельного cover, держащего ≥85% direct text box (`:606–658,790–832`).
- `covered_for_good` для size/leading/measure строже: cover должен сохраняться при scroll, а bottom-fixed cookie banner обычно не означает permanently hidden text (`:560–604,781–788`).
- Below-fold fallback проверяет later sibling image/fill или higher-z sibling: до 16 ancestors и 3000 elements; нет измерения/превышен budget → не подавляет finding. Учитываются overflow clips, z-order/flex-grid order helper, positioned layers, opacity product, masks/clip paths/filter/blend/rotation, padding-box border и radius inset (`:834–1327`).
- JPEG-only transparency certainty относится к structural avatar fallback: complete+natural size, object-fit fill/cover, host match≤3px, avatar≤160px либо initials≤3 chars; PNG/WebP/SVG/unknown URL не признаются непрозрачными (`:1215–1327`). Не распространять эту гарантию на `covers()` внутри viewport: там `<img>` признаётся cover без проверки pixel alpha. Это ограничение точности, не доказанная эксплуатация.

`vectors.rs:16–35`: known function tables просто объединяются; вызов идёт foundation→vectors_a→vectors_b, unknown → None. Такой replay проверяет воспроизведение зафиксированной семантики, не её визуальную правильность.

## Что на деле доказывают прочитанные тестовые подсистемы

### Account lifecycle / remote side effects

Все назначенные account tests прочитаны вместе с `support/fake.rs`, поэтому assertion опирается на поведение double, а не только имя test:

- `login.rs:42–209`: forged state/issuer не должен обменивать code; local stalled callback не мешает; logout tombstone предотвращает resurrection старым refresh/login, и опоздавший login не заменяет новый. `:212–249` проверяет revoke текущего refresh grant и local logout на invalid_grant; `:252–271` отличает unreadable credential state от signed-out. Browser landing только после успешного exchange (`:286–305`).
- Fake issuer проверяет client/resource, PKCE S256 и redirect (`support/fake.rs:432–499,834–905`), scopes bind к grant, rotate/reuse detection. **Это не проверенный production service.** На reuse double очищает все live refresh/access sets, не только одну grant (`:868–874`); listener threads не имеют teardown в `Fake` (`:145–163`), поэтому изоляция fixture не эквивалентна production lifecycle.
- `scopes.rs:8–129`: все 32 комбинации offered feature scopes, refresh без расширения consent задним числом, omitted token scope наследует исходные grants; worlds only if offered. `taste_grant.rs`: удаление cache только issuer-владельцем при потере taste scope.
- `pro.rs`: signed release/lease/digest cache, invalid signature — artifact не скачивается; no entitlement сразу обрывает lease; 48h lease renew в последний день; unknown signing key refetch; revision floor не сбрасывается revocation. Stalled download не блокирует logout; stale entitlement response от другой login epoch не меняет текущий Pro; FIFO artifact не подвешивает decide. Это модель signed cached executable dispatch, не просто набор design rules.
- `taste.rs:18–116`: rules sanitation, max12 rules×240 chars, private0600 cache, issuer/ETag revalidate,304 freshness,500/network preserve;403/404 delete. `IMPECCABLE_NO_TASTE` запрещает, CI не планирует background refresh, **DO_NOT_TRACK сам taste read не отключает**. Focus web/slides/motion — отдельные cache, старый server400 fallback без focus; explicit note пишет remote calls, стабильно хеширует event/repository, валидирует chose≤200 chars до sending. Paused personal taste может сохранить repository rules.
- `setup.rs`: optional consent setup:write, whitelist inventory projection и ежедневный claim до inventory, opt-outs CI/DNT/no telemetry, corrupt state не планирует worker. Off работает во время network wait; старый claim не возобновляется после off/on или нового login. Не считать такие обращения полностью отсутствующими только из-за DNT.
- `receipts.rs`: remote success печатает service destination,500 честно оставляет local report без обещания automatic retry; returned link только HTTP(S), control/newline/javascript отвергаются. Это test double response, не реальная отправка в ходе аудита.

### Model behavior / workflow completion — разные уровни доказательства

`skill-behavior/harness.mjs` действительно собирает neutral skill production transformer, а не вручную вставляет один reference. Read/write workspace-scoped через canonical symlink checks; staged `.claude` readonly. **Bash — настоящий host shell, не security sandbox** (`:17–19,182–191`). В narrow routing mode allowed только exact context command; denyBash имитирует host refusal без исполнения. Mutation snapshots SHA1 исключают `.claude`, `.git`, node_modules и symlinks; нельзя переносить их как аудит всех host changes. Bash reference coverage определяется присутствием полного reference content в stdout, а не просто упоминанием path.

`assertions.mjs:11–48`: advice должен дойти до пользователя; no project write, no question/init interview, no menu scan; init/document не обязательны перед narrow polish, critique необязателен перед polish. Отдельно `:85–109` требует сказать о denied context launcher **до следующего tool**, а не дописать оправдание в final.

`skill-workflow/full-build.test.mjs`: opt-in, real paid model, system-font/offline HTML fixture, Chromium preflight до model calls. Проверяет complete, context exactly once, question+brief до implementation, redesigned DESIGN после последней правки, свежие desktop/mobile captures, scoped bolder changes, critique report prose ДО question. `finish-handoff.test.mjs` — иной, синтетический resumed checkpoint: prior message о закрытом review является seed data; тестирует только корректное документирование/preservation после такого checkpoint.

`browser.mjs:83–106` связывает capture с target/viewport/sourceHash и проверяет hash до/после capture. `source-hash.mjs` включает local CSS/JS/images/fonts, но исключает hidden paths/node_modules/symlinks и не покрывает любые произвольные файлы проекта. `scope.mjs` сравнивает target computed styles/pseudos на двух ширинах, сохраняет header/footer text и header hrefs: no-op comments/unused CSS не проходят. При этом не доказывает pixel identity всего, что вне scope.

### Live UI и fixture runtime

- `live-e2e/session.mjs`: stage fixture+git commit→dependency install→live boot/inject→framework dev server→agent loop→real browser; appDir отдельно от repo root. teardown закрывает context/agent/worker/dev/helper/tmp best effort. Presence engine проверяется до большинства suites, но missing engine означает skip, не runtime PASS.
- `preactions.mjs`: picker временно выключается для click/goto/wait, потом восстанавливается; условно skip уже видимого next wait. Cycling recovery учитывает fatal noRetry, повторяет preactions, reload только LLM/HMR path. `steer.mjs`: short lock может не наблюдаться, зато обязательны source+DOM marker; без DOM по explicit fixture setting это более слабая проверка.
- `live-static-accept.test.mjs`: без HMR accepted wrapper должен исчезнуть сразу, CSS scope и tuned vars сохраниться после следующего pick; later-session CSS не затрагивает accepted variant. `live-e2e-accept-cleanup-regression.test.mjs:112–136` требует одновременно clean source, clean DOM и durable completed phase — одного чистого файла недостаточно.
- `live-top-layer.test.mjs`: real mouse input проверяет modal inertness, host migration в topmost dialog, nested/reopen/removal, outline alignment при scroll и clipboard fallback в не-inert subtree. Synthetic `.click()` прямо не считается заменой pointer test.
- `live-browser-session.test.mjs`: checkpoint monotonic между instances, insecure-origin UUID fallback и denied localStorage graceful no persistence. Math.random fallback — session identifier, не доказательство secure token.
- `lib/live-servers.mjs` arm() ставит process/repo/run markers, exit/signals и detached pipe-reaper non-Windows. `process-group.test.mjs` проверяет reaped child вместо `kill(pid,0)` zombie polling, second-signal escalation и shutdown handle retention. Это процессы, запускаемые только тестами при исполнении; в аудите arm/import не вызывались.

### Package loader / release / CI

- `plugin-e2e.test.mjs` — реальный Claude loader inventory с isolated HOME/USERPROFILE/config: one skill, все shipped agents,3 hook groups. Это сильнее проверки JSON shape, но даже inventory не доказывает выполнение роли. CLI missing → skip.
- `validate-plugin-manifest.test.js` запрещает непроверенные loader keys, включая `agents` любой формы; проверяет emitted filenames с rename/provider filter. Absent subtree допустимо даёт пусто, поэтому такой unit result нельзя выдавать за факт installed integration.
- Cursor tests: relocated base dir со spaces, stdin/cwd/exit propagation, Windows `.cmd` quoting, пять agents, ссылки nonempty и без unresolved placeholders. OpenAI stage выбирает Codex payload и **не пакует hooks**; VS Code — skill-only contribution без editor runtime/main/scripts, запрещены untrusted/virtual workspace.
- Transformer tests проверяют provider tags в body/reference/agent TOML; allowlisted frontmatter; Codex/agents/Muse version в metadata; DSH без неподдерживаемых hook/agent механизмов. Explicit script markers переписываются, похожие слова в executable strings/paths/regex — нет. Не считать разные adapters byte-identical aliases.
- `launcher-download.test.mjs`: большой fault matrix со stub executable и loopback downloads. Pin manifest→download→hash→cache; no digest/no file/empty/hash-tool failure/removal at move/transport404 дают отказ и cleanup; stamp доверяется при digest+size+mtime, без повторного hash; exact sibling version+successful probe, Windows shim vs exe quoting, INT130/TERM143, dead-old staging sweep, outage final-host diagnostics и cached fast-path process budget. Это не безусловная защита same-size backdated local tampering: test `:347–352` намеренно подтверждает отсутствие rehash по доверенному stamp.
- `check-engine-release.test.mjs` и `publish-platform-packages.test.mjs` подтверждают по doubles sidecar/manifest matching, missing/malformed rejection, transient503 retry, package executable/license/bin shape. `bundle-signing.test.mjs` — Ed25519 payload domain+version+size+sha/artifact/key binding, исключение public test key из prod keyring, sanitized secret-read error.
- `.github/workflows/release-engine.yml`: пять targets; tag/Cargo/ENGINE_VERSION equality; native smoke кроме cross ARM; Windows signing отдельный protected OIDC job без checkout, publisher+timestamp verification, publish только tag push, unsigned artifact вне publish pattern. Dispatch build-only не даёт signing/publish rights. SHA256 sidecars не равны подписи bundle, это разные trust paths.
- `sync-generated-output.yml`: direct commits в main/next, до5 попыток fresh origin reset/rebuild; optional PAT иначе default token suppresses downstream workflows. Поэтому факт generation sync не равен факту следующего CI run.
- `sheriff.yml`: не read-only audit, scheduled `--apply`, warn7/close14, issue/PR write permissions, label mutation; dispatch dry-run только explicit. **Не переносить как автоматическую политику Friday**, где чужие задачи/ветки/публикации требуют scope.
- `dependabot.yml` покрывает Bun и Actions, не Cargo; это описанный scope файла, не утверждение, что иных dependency scanners во всём repo нет.

### Oracle: данные и evaluator не смешивать

Полностью прочитанные oracle cases — исполнимые fixture definitions с setup writes, steps, args и нормализацией; ожидаемые verdicts содержатся во внешних goldens. Из case name самого по себе PASS не следует.

`run.mjs:18–32` сравнивает actual/golden, missing golden ошибочен, platform skip отдельно. Однако accepted delta в DELTAS.md разрешает **любой** diff данного case ID (`:27,34–42`), а пустой prefix match не имеет positive case-count gate. `record.mjs` переписывает golden и предупреждает review-only текстом; нельзя массово re-record binary, затем объявить подтверждённым старый JS parity. В этом аудите не делалось ни то, ни другое.

Live cases подробно фиксируют: monorepo context/root selection и app pointers; injection token-port match/CSP quote+entity restore/framework conflicts/orphan safe path healing; source locator text vs tag/component, same-line/self-closing wrappers, generated-file guards; parameter baking range/steps/toggle, accept receipts replay/conflict, no-original discard отказ, file locks; manual commit не очищает buffer за одним только mock status без фактического source change. Основные large `context/hooks/detect` cases остаются unread.

## Сравнение с Friday: переносить delta, не весь продукт

Локальные доказательства — прочитанные working-copy `.codex/CODEX.md`, `.codex/workflows/review-loop.md`, `.codex/scripts/design-lint.mjs`, `.codex/scripts/screenshot.mjs`. Live state клиента/хуков и регистрация TOML здесь не проверялись. Отсутствие ниже относится к этим просмотренным файлам, не ко всему Friday.

| Область | Статус в inspected Friday scope | Доказательство и точный delta |
|---|---|---|
| Review актуальной revision и реальный результат | **already equivalent по требованию**, execution не проверялся | `review-loop.md:29–44,50–54` уже запрещает skip как успех, требует повторные проверки после изменения revision и настоящую reviewer identity. Не нужно ещё раз копировать лозунг «review then finish». |
| Свежесть изображения после изменения CSS/font | **partial** | Friday `screenshot.mjs:107–139` снимает три viewport, но не пишет content hashes/dependency manifest. Upstream workflow `browser.mjs:92–105` + `assertions.mjs:41–48` bind final captures к sourceHash после last edit; comp corpus дополнительно invalidates после font change. Delta: receipt с actual loaded local dependencies + image/source hashes и отказ от stale acceptance, а не ещё одна screenshot-команда. |
| Side-border | **conflict/partial** | Friday `design-lint.mjs:28–33` всегда ERROR для border-l-4/r-4, не видит inset/pseudo, не различает square/round/table/caret. Upstream `side_bar.rs:65–67,184–245` square допускает и ловит rounded1px в том числе neutral/state. Прежде чем менять запрет, owner должен выбрать семантику. Не молча подменять house rule upstream taste rule. |
| Контраст | **partial** | Friday `design-lint.mjs:20–26` — same-line Tailwind heuristic, не измеряет ratio и rendered layers; CODEX.md:693–695 требует screenshot judgement. Delta: measured browser evidence с uncertain/unread classification; не приписывать regex точность WCAG. |
| Typography/CJK/mono/коды | **absent in inspected executing lint** | Полный RULES list `design-lint.mjs:7–103,187–219` не содержит crushed tracking/CJK/first-family mono/dash density. Возможный delta только как opt-in advisory, с примерами исключений; латинские caps/byline regex не переносить как русский semantic grader. |
| Изоляция workflow тестов до платного вызова | **not established** | Upstream `skill-workflow/browser.mjs:32–73` preflight, external route block, SW block; Friday screenshot `:100–139` снимает заданный URL без fixture offline isolation. Это разные use cases. Для новых synthetic model eval добавить отдельный harness, не блокировать все клиентские screenshot сети. |
| Документирование существующего system | **partial; не доказано отсутствие в других docs** | Friday CODEX.md:383–385 MASTER.md — existing source of truth. Upstream finish-handoff `:63–86` отделяет preserve/no-change от approved redesign/new-world writes и не чинит чужой pre-existing sidecar drift. Delta: regression на preservation/drift boundary, не второй конкурирующий DESIGN.md в корне каждого проекта. |
| Нативный loader integration | **not established** | Friday CODEX.md:53–57,821–826 честно требует проверить реальную поддержку. Upstream plugin loader E2E дополняет shape validation. Для Friday адаптировать под конкретный доступный host после отдельного разрешения, не объявлять проверенным от наличия TOML/MD. |
| Cloud taste/Pro/account telemetry | **not applicable без отдельного product decision** | Это отдельные OAuth grants, remote writes/reads/cache/downloaded Pro executable. Не нужны для переноса typography/layout и не разрешены текущим audit-only. DNT≠all network off. |

### Предлагаемые работы (не выполнены)

1. **QA owner / `.codex/scripts/screenshot.mjs` + отдельные tests:** capture receipt и freshness gate для CSS/image/font dependency changes; после любой relevant byte change старый снимок непригоден. Expected output: JSON receipt + negative stale test. Не использовать слишком узкий HTML-only hash.
2. **Design owner + coder / `.codex/scripts/design-lint.mjs`:** сначала owner decision по square side bars; затем bounded fixture suite для round/square/frame/table/triangle/inset/pseudo/state. Не переносить C2/C3 ошибки parser.
3. **QA owner / отдельные workflow eval fixtures:** advice-only no writes, narrow polish без setup detour, denial disclosure до следующего tool, preservation vs redesign, report-before-question, real pointer/touch vs synthetic invocation. Expected: trace-order assertions + semantic DOM/capture checks; не fileLoaded-only или exists-only success.
4. **Security/QA owner при создании paid eval:** keyless child env в install/dev/browser helpers, allowlisted synthetic workspace, real client AbortSignal и расходный cap; сначала исправить/не наследовать C1, C5, C6. No upstream model calls до отдельного budget/scope approval.

## Покрытие и продолжение

Ledger содержит ровно одну строку на каждый из 139 assigned paths: `path`, `sha256`, `status`, `ranges`, `total_lines`, `substantive_note`. Для `full` диапазон `[1,total_lines]`; SHA256 — fingerprint source, не свидетельство чтения. Два tool outputs были усечены; пропуски дочитаны отдельно (harness middle; live-roots и live-wrap prefix). Никакого `full` из усечённого неизвестного участка не присвоено.

Дополнительные зависимости вне assignment прочитаны адресно, не целиком и не включены в 17 797: `crates/foundation/src/css/scan.rs:235–289`; constants найденные в `crates/foundation/src/rules/text.rs:424–428`; caller references в browser/visual/painted/element_checks — search evidence, **не full review этих файлов**. Local Friday context files — сравнительное чтение, не upstream coverage.

### Остаток: требуется реальное чтение, не следующий mechanical scan

- `tests/live-agent-target.test.mjs` — 1176
- `tests/extension-build.test.mjs` — 775
- `tests/extension-walks.test.mjs` — 2918
- `tests/plugin-paths.test.js` — 401
- `tests/extension-popup.test.mjs` — 969
- `tests/live-browser-ignores.test.mjs` — 346
- `tests/live-e2e-agent-output.test.mjs` — 235
- `tests/live-browser-source.test.mjs` — 1937
- `tests/new-work-e2e.test.mjs` — 1225
- `tests/live-e2e-llm-agent.test.mjs` — 1840
- `tests/live-svelte-adapter-deepseek.test.mjs` — 871
- `tests/extension-agent.test.mjs` — 427
- `tests/release.test.mjs` — 519
- `tests/extension-account.test.mjs` — 840
- `tests/live-e2e.test.mjs` — 2565
- `tests/build.test.js` — 804
- `tests/hook-build.test.mjs` — 516
- `tests/review-theme.test.mjs` — 405
- `tests/skill-behavior-harness.test.mjs` — 476
- `tests/live-server-leak.test.mjs` — 302
- `tests/github-sheriff.test.mjs` — 992
- `tests/framework-fixtures.test.mjs` — 303
- `tests/skill-behavior/scenarios.test.mjs` — 1097
- `tests/lib/utils.test.js` — 705
- `tests/live-e2e/ui.mjs` — 1453
- `tests/live-e2e/agent.mjs` — 2688
- `tests/oracle/cases/context.mjs` — 1053
- `tests/oracle/cases/hooks.mjs` — 381
- `tests/oracle/cases/detect.mjs` — 443
- `crates/hook/tests/hook_tests.rs` — 4631

**Итог:** substantive source-reading добавлено, новые статические findings и Friday deltas зафиксированы. Exhaustive close-1 остаётся незавершённым до чтения указанного остатка; никакого общего PASS и runtime verification не заявляется.
