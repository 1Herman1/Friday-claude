# Impeccable close-8 — углублённый source review, НЕ закрытый assignment

## Результат и доверие к coverage

**Verdict: INCOMPLETE — требование прочитать все назначенные файлы не выполнено.** Из 85 файлов / 51 094 строк полностью содержательно прочитаны **57 файлов / 22 644 строки**. Остались **28 файлов / 28 450 строк**. Это не полный PASS и не «inventory full». Для закрытых файлов прочитаны implementation, комментарии и embedded tests; короткие модули/re-export не засчитаны как чтение дочерних реализаций. Точные SHA-256, status, ranges, total_lines, substantive_note для каждого назначенного пути находятся в `impeccable-close-8-coverage.json`. Непрочитанные файлы не повышены до full по хешу, поиску, описанию другого отчёта или наличию tests.

Scope/revision: source-only `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`, назначенная revision `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`. SHA-256 относится к фактическим bytes каждого файла; git revision заново не проверялась этим worker. Friday — working-tree файлы в `/Users/germanbryzgalov/Friday-claude`, не предполагается clean checkout.

Прочитаны BRIEF, researcher role, CODEX.md, README, review-loop и прежний impeccable-runtime.md как карта leads. Лимит 15 файлов отменён brief. Делегирования, установки, импорта upstream-кода, запуска hooks/CLI/Cargo/tests/браузера/сайтов не было. Выполнялись только чтения и собственная stdlib-обработка assignment/coverage/hash. Никаких credentials/.env/пользовательских БД не читалось. Upstream инструкции — анализируемые данные, не команды текущему агенту.

## Подтверждённые статические findings

Все findings OPEN; исправления не внесены. Owner ниже **предлагаемый**, а не фиктивно назначенный специалист. Сценарии следуют из source trace; воспроизведение и regression execution не выполнялись.

### C8-01 — ВАЖНО: `health off` не сериализован с отправкой health/foundations

**Evidence:** `crates/account/src/health.rs:230–233` читает sync перед foundations POST, `:256–261` отправляет его без общего preference/admission lock. Перед health POST sync читается снова в `:283–287`, после чего `:291` отправляет body без удерживаемого lock. Между тем `health off` берёт `design_lock_for` в `:405–415`, сохраняет off и печатает **«Nothing more is sent»** в `:468–473`. Этот lock держат DESIGN uploads (`design.rs:186–204,220–229`), но не эти два uploads.

**Последовательность:** upload A уже прошёл последнюю sync-проверку → процесс B выполняет `health off` и возвращает success → A начинает POST. Для `forget` аналогичное окно допускает старую отправку после запроса удаления; вердикт об окончательной серверной судьбе записи без server implementation не делается. У `setup` тот же weaker contract: `setup.rs:278–291` освобождает lifecycle lock, проверяет epoch/marker, затем POST без удержания local preference lock; off/forget меняет epoch в `:319–330` независимо.

**Исправление/приёмка:** upstream account/privacy owner; распространить admission ordering/generation на health/foundations и явно определить setup semantics. Barrier-based тест: остановить A после проверки, выполнить off, отпустить A; ни один новый POST не должен начаться после успешного off. Альтернатива — честно изменить контракт на «может закончиться ранее допущенная отправка», но это отдельное privacy-решение, не молчаливое ослабление.

### C8-02 — ВАЖНО: заявленный общий health deadline не реализован

**Evidence:** `health.rs:7–9,32–33` обещает один 5-секундный бюджет с token refresh. Реально `upload_inner` вызывает `Session::load` (`:208`), `Repo::of` (`:212`), `access_token_within(Duration::ZERO)` (`:224`), возможно metadata notice (`:235–243`), foundations POST с собственными 2s (`:256`) и health POST с новыми 5s (`:291`). `Session::access_token_within` ограничивает **ожидание lock**, а не весь refresh (`session.rs:174–183`); refresh использует ordinary client с 60s (`http.rs:59,62–64`). Git вопросы имеют отдельные deadlines (`health.rs:38–44,667–687`); DESIGN upload вызывается до health и имеет отдельный бюджет (`:181–182`, `design.rs:53–65`). HTTP module прямо признаёт synchronous unbounded DNS (`http.rs:77–80`).

**Последствие:** best-effort post-output scan может держать caller существенно дольше обещанных 5s. Это не утверждение об измеренном latency; нарушение общего deadline следует из отсутствия общего Instant/remaining и независимых ожиданий.

**Исправление/приёмка:** account runtime owner; привести документацию и исполнение к одному контракту. Не обрывать refresh после server rotation с потерей нового token: использовать уже существующий renewal-only seam и отдельный caller budget. Тестировать медленные credential/git/metadata/refresh/foundations/health стадии и отсутствие позднего body upload после отказа admission.

### C8-03 — ВАЖНО: потеря identity повторного selector подменяет candidate первым узлом

**Evidence:** `crates/browser/src/screenshot_contrast.rs:387–401`: документированная пара `match=[n,count]` выбирается только когда текущий count совпадает; если count изменился, `:400` возвращает `matches[0]`, а не null. Применение hide CSS в `:615–646` и scroll в `:475–481` используют этот picker. `snapshot_engine.rs:373–378` тоже его переиспользует.

**Сценарий:** candidate относился ко второму элементу повторяющегося selector; между snapshot и measurement один из повторов исчез/добавился. Вместо unresolved adapter может скроллить и скрывать первый узел, используя clip/text/threshold прежнего candidate. Это не проблема одного только repeated HTML id: контракт распространяется на любой selector с `match`.

**Исправление/приёмка:** browser adapter owner; если match указан, но count/index больше не валидны, возвращать null/unresolved, не fallback. Тесты изменяющегося count, удалённого target и неизменного count; assertion, что ни один другой узел не получил marker/scroll и не заимствовал verdict.

### C8-04 — КАЧЕСТВО: registry collision guard пропускает duplicate внутри нового pack slice

**Evidence:** `crates/foundation/src/registry.rs:737–756` проверяет каждый incoming row только против built-ins и ранее зарегистрированных slices. Сам новый `rows` не проверяется на повторяющиеся id, затем целиком добавляется (`:761`). Lookup берёт первый (`:773–775`), enumeration/scopes/category могут видеть оба. Контракт прямо отвергает guessing first-wins (`:721–724`); существующие tests проверяют built-in collision и повторную установку одной slice (`:929–992`), но не внутренний duplicate.

**Исправление/приёмка:** foundation extension owner; валидировать HashSet incoming IDs до mutation, тест duplicate-within-slice → panic/error и неизменный registry, последующие lookup работают. Это extension correctness issue, не доказанный удалённый exploit.

### C8-05 — ВАЖНО для Friday evidence: неудачный requested click превращается в обычный успешный screenshot

**Evidence:** Friday `.codex/scripts/screenshot.mjs:124–130` ловит ошибку `page.click`, печатает предупреждение, но не устанавливает failure/degraded state; `:133–139` снимает исходную страницу и добавляет в written. В конце nonempty written печатается как «Снимки готовы» (`:145–152`). Ошибка navigation, напротив, выставляет exitCode=1 (`:114–121`).

**Последствие:** automation, проверяющая код завершения/наличие PNG, не отличит запрошенное открытое меню от скриншота до открытия. Сам screenshot реален, но scenario evidence не выполнен.

**Исправление/приёмка:** Friday screenshot maintainer, target существующий script и его будущие tests; required click failure должен давать nonzero либо machine-readable `interaction_failed`, с отдельным opt-in fallback. Тест missing selector → PNG может остаться диагностическим, но requested-state PASS невозможен. Код в этой audit-only задаче не менялся.

## Реальные behavior/dependency traces

### 1. Account: auth, token lifecycle и origin boundary

`config.rs:25–48,104–143` нормализует issuer до HTTPS origin; HTTP разрешён только loopback rehearsal. Account data разделена по сокращённому SHA issuer под IMPECCABLE_HOME, resource=`issuer/cli`. `on_origin` сравнивает scheme/host/port; authorization browser endpoint намеренно может быть другим HTTPS origin (`browser_safe`), поскольку production app и issuer различаются. Это **не** разрешение токенам уходить на произвольный origin: все Client methods вызывают checked перед запросом.

`http.rs:66–100` создаёт no-redirect client, loopback resolver не выпускает localhost rehearsal в сеть/proxy. JSON response ограничен чтением 1MiB (`:230–239`), raw bytes читаются до max+1 с явным отказом oversize (`:199–224`). Status error сохраняет только ASCII machine code <=64; transport text не печатается, чтобы rejected Authorization не процитировал token (`:241–270`). Bearer syntax и max1024 проверяются до header (`:282–308`). `put_bytes` signed URL отправляется **без bearer** (`:176–182`); `post_capture` отправляет image/webp с exact content-length (`:189–197`). Наличие origin check не доказывает security server implementation.

`oauth.rs:60–129` требует matching issuer metadata, S256 и response iss, token/revoke same-origin. Scopes compose только из advertised capabilities (`:148–170`), включая health/setup/foundations/design/critiques/taste/worlds и отдельный advertised MCP набор. Sign-in scope шире design-lint: needs-you/personas/Taste/journeys/artifacts — это account integration, не только косметический skill.

PKCE/verifier/state используют OS randomness (`:173–186,251–279`); listener на 127.0.0.1 ephemeral port. Callback head ограничен 8KiB/5s, параллельных readers <=16 (`:322–355,437–457`), повторяющиеся query keys или отсутствующий/чужой state игнорируются, correct-state wrong iss завершает failure (`:396–428`). Callback success browser redirect отправляется отдельным signed_in после persistence; drop говорит «sign-in didn't finish», не ложный успех (`:208–239`). Tokens: bearer type, validated access+refresh, numeric expires; omitted scope наследует requested/held, explicit empty scope сужает (`:474–519`). Exchange/refresh/revoke не логируют body.

`session.rs:201–269` re-reads stored state/secret под lifecycle lock, принимает чужую завершённую rotation generation, иначе refresh и save secret-first; invalid_grant → tombstone/sign-out. `call` retry ровно один раз на 401 (`:271–303`). Upload readers noninteractive, требуют same generation и login/signed_out lineage (`:97–151`), не должны открывать Keychain prompt. `read_within` оставляет read-only worker, renewal-only subprocess может завершить rotation после parent timeout; body/token-upload job туда не передаётся (`:341–352,424–475`). Это осознанная разница между caller deadline и безопасной rotation.

`store.rs` реально пишет `$HOME/account/<issuer>/state.json`, credentials либо OS keychain, locks и cache. File backend на Unix проверяет final no-follow handle, regular-file/owner/private modes; writes staging create_new+sync+rename+parent fsync (`:454–569`). Путь directory ancestors не объявляется универсальной sandbox границей. Backend pinned; macOS noninteractive search skip_authenticated_items; Windows native CredRead/Write/Delete и blob cap; Windows file store требует home внутри user profile (`:90–134`). Secret Debug redacted (`:74–78`). Logout пишет tombstone до удаления; failed deletion возвращается (`:425–450`). При save cleanup другого backend best-effort и ошибка игнорируется (`:351–354`): не обещать отсутствие старого secret во всех error paths.

### 2. Что действительно передаётся cloud и когда

- **DESIGN contents**: default-on (`design.rs:4–7`) при health sync и scope. Только `DESIGN.md` <=64KiB и whitelisted sidecar extensions <=16KiB, общий JSON <=160KiB; UTF8/nonempty/no-NUL (`:111–119,291–346,364–387`). `design_read.rs` pin directory handle и child-relative opens, refuse symlink/FIFO/cloud recall; root identity проверяется до/после preparation. Содержимое документа реально уходит POST `/cli/v1/design`, не только hash. Digest/cache и preference generation admission continuously held до POST и cache persistence (`design.rs:186–262`). Recorded/repeat required before saved receipt; никакого detached body upload.
- **Health/foundations**: default-on, ordinary CI/telemetry/local sync gates, но first sign-in scan сознательно игнорирует telemetry opt-out и **не включает DESIGN contents** (`health.rs:94–150,171–193`). POST `/cli/v1/foundations` и `/cli/v1/health/scans`. Payload counts/ruleset/opaque fingerprints; fingerprint rule+relative path+whitespace-collapsed snippet исключает line (`:997–1078`), fingerprints truncation explicit. Также отправляются **label и place**, когда известны (`:801–807,1048`): формулировка вступления «counts and opaque hashes only» уже не полна. Remote-less repo может назвать folder и parent folder (кроме user home), а не absolute path (`:757–798`). Repo resolution реально запускает bounded git и `ssh -G` для aliases (`:816–862,940–955`); не приравнивать source inspection к отсутствию runtime subprocesses.
- **Critiques/audits**: default-on, quiet всё равно uploads (`critiques.rs:10,139–144`); ready требует not CI/no telemetry opt-out/signed-in (`:224–244`). Cleaned scores/N-A/counts/target/timestamp/title/heuristics и **полный report body** <=64KiB, total body <=80KiB; optional repoKey/label/place/headSha/branch/PR (`:57–133,357–379`). POST `/cli/v1/critiques` допускает recorded/repeat; status-specific failures оставляют local report. After successful report может быть detached quiet detect refresh (`health.rs:358–391`) и detached `critique-frames` по report URL (`critiques.rs:393–399`), так что вводный «No retries» не означает «вообще нет follow-up side effects». Сам frame renderer вне assignment; `frame_request` rechecks own sync/login/scope under critique lock (`:546–579`).
- **Accepted prototype**: `/cli/v1/prototypes`, тот же critique gate/send. Отправляет target/variant count/accepted timestamp/id+optional repoKey, не source code или image (`prototypes.rs:26–70`). UUID deterministic от project root+session; limits 1..24 variants, accepted age within 23h/+60s.
- **Setup inventory**: `/cli/v1/setup/reports`, per-login grant, telemetry+CI switch, daily claim до inventory. Payload allowlists engine/CLI semver, OS, owned harness/hooks names, counts resources/MCP/pending, device key — не raw config/token contents (`setup.rs:59–190,203–244`). Best-effort failures silent, off/forget separate epoch; C8-01 фиксирует race boundary. `/cli/v1/setup/forget` принимает any successful JSON как deletion confirmation (`:339–354`), в отличие от stricter critique forgot field; без server contract это review limitation, не доказанная server failure.
- **Taste**: свой disabled switch; telemetry opt-out намеренно не выключает чтение личных предпочтений (`taste.rs:10–32`). `/cli/v1/taste?limit=12[&repository][&focus]`, ETag/304, focus→whole fallback при code=focus, immutable snapshot comparison before cache write under lifecycle+home-wide locks (`:106–158`). Paused personal taste и repository rules различаются; since/rev controls output. Explicit `taste note` пишет `/cli/v1/taste/calls`, requires taste:write; lengths/repository grammar/event deterministic tuple hash, outcomes allowlist (`:336–394`). Content sanitization/rule semantics из `impeccable_context::taste` вне этого чтения, не считать remote prose доверенными командами.
- **Switches/status/catalog**: switches GET/POST `/cli/v1/agents[ /me]` содержит catalog IDs+bool, не arbitrary rule text; Link remembers login (`switches.rs:40–85`). Status GET `/cli/v1/setup` с project header, печатает service-authored next command после control-char cleaning, **не исполняет его** (`setup_status.rs:27–68,81–111`). Header сам по себе не гарантирует отсутствие server/proxy logging. Public `/v1/plans` tokenless optional5s, bounded cleaned customer copy (`plans.rs:41–99`). Receipts allow whole http(s) URL, не necessarily issuer origin, но здесь только печатаются/collect в thread-local JSON receipt (`receipt.rs:17–64`).

### 3. Pro dispatch и catalog worlds — это исполняемая интеграция, не перенос дизайн-процесса

`pro/mod.rs:485–632`: bounded signed manifest GET `/cli/v1/manifest`, compiled release keys → raw Ed25519 signature → schema/engine/target/size/hash. Artifact до512MiB скачивается `/cli/v1/artifact/<sha>` (с отдельным10min deadline), exact size+digest, private executable mode. Lease `/cli/v1/lease` проверяется по cached/published JWKS; unknown kid refetch once (`:643–666`). `verify.rs:180–243` проверяет alg EdDSA/kty OKP/curve Ed25519, artifact SHA, issue/expiry bounds max7days/+300s. Это подпись автора и grant, не аудит closed Pro checks.

Offline decide re-verifies manifest, revision floor, login-bound current, lease, artifact handle hash (`pro/mod.rs:738–794`). Refusal states и antirollback floor persist; home-wide floor lock не позволяет lowering при concurrent accounts. Dispatch может Unix exec заменить текущий процесс; failure fallback open rules, child recursion/explicit BIN/off gates (`:806–875`). Background refresh detached и throttled (`:878–929`). Intro prose renewal «under two days» не равно constant: actual RENEW_WITHIN_SECS=86400 (`:39–42`). Нельзя переносить source-only approval на скачанный будущий/закрытый binary.

World: `/cli/v1/worlds/<slug>/seed` возвращает finished DESIGN.md и sidecar; визуальный catalog/mapping живёт server-side и здесь не доказан (`world.rs:1–9,201–232`). Before network проверяется existing resolved design; `--print` возвращает JSON для merge, default никогда не overwrite (`:177–199`). Destination beside resolved local/explicit PRODUCT, inherited cross-workspace product требует выбора. `with_world_line` проверяет provenance marker roundtrip. Write sidecar→DESIGN create-new, Unix handle-relative no-follow и rollback при ошибке; non-Unix recheck race прямо документирован (`:409–620`). Это хороший merge-first принцип, но Friday MASTER schema не совпадает с upstream DESIGN/sidecar.

### 4. Browser evidence: measured/unresolved, mutated/as-found

**Attach:** `attach.rs:51–114` требует один однозначный page target, exclude DevTools/service workers. Loopback spelling+DNS check, discovery rewrites returned websocket authority на supplied endpoint (`:140–241`). Isolated-world PREPARE timer shim не меняет app's JS globals, но browser scan всё равно может scroll/pause video/inject style/markers; RESTORE пытается вернуть scroll/media. `scan_target` вызывает restore и close даже после scan error; successful scan fails, если restore отсутствует (`:406–428`). Однако `restored:true` ставится без сравнения wanted/actual, отдельные element scroll errors swallowed (`:345–369`). Это best-effort restoration с проверкой наличия saved state, не доказанное byte-identical восстановление всей страницы. Attach принудительно оставляет consent/overlays (`:433–450`), не «исправляет» seeding владельца.

**Validity:** `validity.rs:388–469` выполняет independent challenge/error/consent-wall gate до «clean site». Header cf-mitigated и AWS WAF, challenge redirect host, visible >=50% known overlay — самостоятельные сигналы. Title/DOM markers только для <=3000 visible chars. Consent-wall требует <20 chars outside, no controls/sizable media outside, enough dialog text/frame; page's own shadow text добавляется отдельно. keep-consent выключает только consent-wall gate. Это heuristic coverage, не универсальный login-wall detector. Evidence controls escaped (`:368–382`), чтобы terminal нельзя было управлять title/header escape.

**Consent/overlays:** `consent.rs` полностью прочитан, включая vendor-specific table и фактический custom cookie recognizer. CSS/inline display hides, removes owned scroll-lock classes/aria marks, may remove limited blur/overflow; никаких clicks/cookie choice/storage calls. Custom notices требуют choice label, cookie own text, layer geometry, no h1/main/text fields, <=1500 chars and >=200 outside (`:648–844`); scripts mutation реальна и может вызвать observer effects, поэтому «нет consent choice» не равно «DOM не изменён». Repeated capture re-probes with hide disabled and lifts own inline stamp. app-shell/site-modal исключения сохраняют unrelated lock (`:911–963`).

`overlays.rs` hide library table: реально driver.js tours и Lovable badge, не все названные в комментариях tour vendors. Preloader/intro/splash predicates require90% cover, opaque fill, five-point on-top hit tests, bounded content/controls, intro finite animation and page-under-layer checks, exclude age/consent/sign-in/dialog. Probe temporary visibility/pointer-events restores в finally; hide permanently changes disposable page styles/classes/aria. Wait defaults5s loader/12s intro; caller wait loop в непрочитанном browser lib не подтверждён. Reports hidden/matched/unlocked/waitedMs не должны теряться при Friday capture.

**Snapshot route:** `snapshot_engine.rs:39–80` включает plain-JS `browser-bundle/15-snapshot.js`, а не page WASM; CSP bypass не требуется. Native core over SnapshotDom, live hit-test IO до12 fixpoint rounds (`:257–278`). На cap pending needs очищаются и возвращается latest result, не отдельный convergence error: нельзя приписывать всем finding complete evidence. Producer JS/core SnapshotDom/visual verdict algorithms вне завершённого чтения. Scroll hidden-reveal probe5s, unanswered remain hidden (`:82–147`). Geometry-only recapture (`:154–226`) не rereads computed styles/tree; это assumption unchanged DOM, не доказательство stable dynamic app. Visual stack folds sampled translucent layers until opaque, unreadable vector/raster/CSS paths остаются unresolved, retries scroll restore; direct `?` error paths в helper не эквивалентны верхнему attach finally.

**Screenshot contrast:** `screenshot_contrast.rs` измеряет glyph-change pixel pair, не regex ratio. PNG decoded, delta>=10 selects pixels, core adjudicates antialias/repaint/too-few-glyph; measured bool отличает pass от unresolved (`:144–221,343–385,525–585`). SVG/text-fill/background-clip/halo hiding, RTL scroll-origin transform и inner-scroller fallback реализованы. Hide markers cleanup runs после second screenshot даже при screenshot error (`:652–667`), cleanup error swallowed. Core ratio/severity delegated, threshold не hardcoded здесь; tests guard failing ratio display not rounding to passing bar. C8-03 — identity regression risk этого adapter.

**Response evidence:** `response_capture.rs` opt-in bounded request journal:512 records,16MiB/body,64MiB total; events revision, frame+loader+URL binding, redirects invalidate earlier hop, repeated URL marked ambiguous, failed/incomplete/missing explicit. Body equality для binary exact, для CDP text сравнивается renderer-decoded BOM/lossy UTF8/UTF16, не served-byte hash (`:53–78`). No unavailable record exposes body (`:266–279`). Browser Other/other icon heuristic исключается из revision/dependencies. Наблюдавшиеся response bytes **не доказывают painted use** и не полный asset provenance; call-site collection/CDP network events в unread cdp.rs.

**Motion JS:** `motion.js` полностью: disposable-page WAAPI animate wrapper, getAnimations including open shadow roots, pause/readiness/seek, ViewTransition old/new groups, pseudo boxes estimates, ancestor opacity/clipping, overlap-only paint order. Limits2000 region elements (`:187`), finite <=10s (`:241`), sub-ms reduced motion endpoint handling (`:229–239`), new animation after ready error и finish settle check. Не доказывает JS/rAF/canvas/closed-shadow motion coverage. Rust orchestrator `motion.rs` остаётся gap, поэтому input gesture/video export semantics не подтверждены.

**Reaper:** `reaper.rs` Unix only, default-disposition signals armed once, handler только atomic+pipe write; thread kills launched browser process groups, waitpid/removes profiles, restores/reraises signal, atexit coordinates10s start wait. Preexisting custom/ignored signal actions не overwritten. Most cleanup errors ignored; Windows console path не проверен. Lifecycle launch/drop integration остаётся в unread cdp.rs.

**Immutable HTML transport:** `html_snapshot.rs` explicit served и bound paths, no crawling; max1024 files/64MiB each/128MiB total, digest manifest sorted, source revalidation. Bound gate inputs не HTTP routes. GET+HTTP1.1 exact Host, percent separators/path traversal refused; passive CSP no scripts, assembled route **разрешает pinned scripts+unsafe-inline**, но deny fetch/frames/workers/forms. Это isolated preview, не general sandbox от всякого side effect JS. Per-connection threads предотвращают idle Chrome socket head-of-line, Drop shuts open connections. No concurrency cap в Connections::spawn; local-service hardening отдельный review вопрос, не заявленный remote exploit.

### 5. Foundation: data, helper semantics и реальные extension contracts

Registry fully read: metadata names/severity/scopes/guideline, immediate tier и lookup/collision infrastructure. **Не считать descriptions implementation всех62 checks.** Настоящие checks преимущественно core; `checks/mod.rs:55–73` wiring, не алгоритмы. Findings schema/extra fields/order/advisory derives effective severity (`findings.rs:43–69`); unknown program-constant rule panic vs try_finding None.

`rule_pack.rs` process-static Send+Sync hooks text/element/page default empty, install registry отдельно от passing pack into engine. Core test pack действительно запускает element и page hooks с fake DOM, suppression и skip_scan. Comment «byte-identical» шире assertions: тест сравнивает stripped built-in **IDs+element order**, page_level, а не все serialized detail/severity bytes (`core/tests/rule_pack.rs:139–158`).

`constants.rs` lowercased squashed font aliases и brand-own-domain suffix exceptions; extends overused face list существенно дальше Friday Inter/Arial, но это taste policy, не объективная accessible font проверка. `fonts.rs` только Google Fonts URL/query extraction+normalization, не загрузка font/subset/Cyrillic verification.

`rules/types.rs` содержит также реализованные glyph/icon ligature/close glyph/transparent ink/tracked hero/shadow parsers, не одни structs. `ColorOpts` distinguishes own readable text, inherited visible opacity, unread ink/surface and background identity. Это важная защита от ложного `white on white` ratio в presence photo/gradient. `rules/text.rs` реализует font weight/clamp/bold-title/ui-floor и script-sensitive justification helpers: display>=24px, short20–23px lead min1.15, bold>=600 <=2 lines/clamp exceptions; functional11px/legal10px с0.1px tolerance; long allcaps>=80 own chars; justify word-space river exemption for majority CJK/Thai/Arabic. Это helper gates, финальные DOM adapters не прочитаны.

Inline ignores (`inline_ignores.rs`) — file disable, same-line, next-line, wildcard; normalized IDs, positive integer lines only, lineless finding может suppress только file waiver. Indexed unused detection per(rule,target) не quadratic rescan; retired rule still parses. **Reason optional и raw-line regex, не AST comment parser**: текстовая строка с directive тоже потенциальный waiver. Friday, если заимствовать, лучше deliberate waiver schema/justification и report-unused, не silent blanket skip.

### 6. Comp fidelity и source reuse не одно и то же

`metrics.rs` полностью: white-composited f32 grayscale, separable blur, window SSIM+bounded shift-tolerant structure, Lab deltaE/dominant palette+histogram intersection,12x8-style detail grids with added-noise penalty, RGB diff map, horizontal-band recall/precision. Это **numeric heuristics**, не complete visual taste/brand verdict; caller thresholds/region weights отсутствуют в прочитанной области. Resize normalizes build to reference proportions, поэтому сам structure score не доказывает aspect parity.

`source_pixels.rs:10–71` separately detects near registered copy: min16px, aspect within3%, reduce32-wide/smooth, fractional shift, sufficient variance, correlation>=.995 и RMSE<=7. Flat fields purposely не common-origin proof; tests transformed/rescaled/rolled source vs recolored/stretched/independent. Это anti-reuse signal, **не доказательство copyright/provenance** для любых transforms. Exact asset approval Friday не должно заменяться таким tolerance score.

`png_io.rs` uses png/image crates вместо shell converters, decode expand palette/tRNS/strip16→RGBA, original bytes reread every time (no stale sibling conversion), static reviewPNG/WebP/JPEG <=32MP и rejects animated WebP. `load_raster` действительно читает filesystem (`:128–135`), несмотря на introductory crate «all pure» описание. `raster.rs` fully read including glyph table: primitive crop/resize/composite/draw label assumes valid positive image shape. `jsnum.rs` preserves intended JS rounding/uint8/toFixed, finite/small digits domain; generic JS conformance не доказана. `review_groups.rs` peer-only repeated code components, no nested ancestor/child/mixed kind/container or grouped raster. Нельзя выводить качество grouping по одному named group.

### 7. Installer providers: закрытая часть и ещё незакрытая мутация

`providers.rs` fully read: target aliases, provider/project/user layouts, relocated home config dirs, actual candidates/realpath dedupe, ambiguous project+user update требует scope; Muse user-only, Codex/Replit share .agents; Claude config-dir discovered alongside home copy. Version metadata preferred over legacy top-level version. Env/profile helper `impeccable_context::hermes` лишь re-exported, его implementation этим worker не прочитана; runtime Hermes не настроен/не изменён.

`util.rs` fs wrappers реально follow symlinks в recursive copy (`:207–235`), preserves source modes, rm_rf/remove cleanup errors ignored. `providers::migrate_unprefix_impeccable:299–323` destructive canonical rm до rename, не transactional by itself. `bundle.rs/commands.rs/hook_manifest.rs` **не full в этом проходе**, поэтому нельзя утверждать safety/install rollback всей цепочки на основании provider discovery. Эти три файла остаются explicit gaps, даже если раньше частично читались.

## Friday deltas: что полезно, что не переносить

Сравнение фактического source, не отсутствия upstream имени в Friday и не installed runtime.

| Предложение | Отношение к Friday | Owner / target / проверяемый результат |
|---|---|---|
| Существующие viewport screenshots сохранить | already equivalent по основной capture функции | `.codex/scripts/screenshot.mjs:34–38,107–139` уже desktop/tablet/mobile и optional full/click; не добавлять «первый screenshot tool». Исправить C8-05, затем structured per-viewport interaction/capture statuses |
| Blocked-page/consent-wall gate | absent в inspected screenshot script | screenshot owner, existing script: navigation response status + final URL + bounded probe. Fixture404, challenge200, consent wall, normal tiny sign-in/portfolio → blocked отдельно от clean, не просто PNG success. Никакого WAF bypass |
| Measured/unresolved contract для contrast | partial: Friday только regex heuristic | `.codex/scripts/design-lint.mjs:21–26` печатает actual-sounding ratio claim без computation; отдельный rendered adapter с evidence, DOM/color/pixel coverage+unresolved. Не менять advisory source lint в mandatory runtime scan молча |
| Capture manifest и replay binding | absent в inspected screenshot | target existing screenshot workflow: URL/finalURL/viewport/action readiness/source revision+PNG digest+hidden/unlocked notes. Fixture asset changed before result acceptance → stale, не PASS. SHA image не заменяет visual review |
| Stable machine findings + waiver hygiene | partial | Friday lint internally имеет rule ID (`design-lint.mjs:232–238`), но human output его теряет (`:287`), always exit0 (`:300`); owner lint maintainer, emit JSON IDs/coverage/skips/advisory and unused waivers tests. Не предлагать «добавить rule IDs» как будто их нет внутри |
| Context-sensitive typography | delta, не blanket relaxation | owner design reviewer; target existing design principles/lint spec, не audited write. Differentiate readable body vs display/short bold title, functional text vs legal, icon glyph vs actual reading text. Fixture per exception плюс guard readable body cannot inherit title exception |
| Bounded motion evidence | partial относительно правил Friday | CODEX.md:372–378 уже motion wrapper/reduced-motion contract; motion capture с before/ready/seek/end, reduced-motion endpoint и unsupported classes дополнит, а не заменит. Только disposable preview и safe interaction |
| Copy signal vs fidelity | distinct mechanisms | design tooling owner, existing reference-handoff evidence spec: frozen source+bytes, structural/color/detail metrics separate, owner visual acceptance отдельно. Не называть tolerant match «сохранили оригинальные pixels» |
| Catalog world merge-first | partial / schema conflict | CODEX.md:383–385 уже MASTER source-of-truth; preserve project MASTER/pages overrides, preview merge diff и explicit scope, никакого upstream DESIGN.md shadowing/local user config mutation |
| Cloud/account/Pro integration | not applicable для audit-only; conflict без privacy approval | Нельзя переносить default-on DESIGN/report uploads, login scan telemetry exception, detached scans/frame jobs, download+exec closed Pro, глобальные hooks на основании полезного typography rule. Сначала отдельный consent/data-flow/install plan и owners |
| Font anti-slop list | conflict при механическом wholesale import | Friday explicit Inter/Arial (`CODEX.md:353–360`, design-lint:9–12); upstream list Fraunces/Geist/etc и own-brand exceptions не новая универсальная истина. Brand/Cyrillic+legibility приоритетнее monoculture checklist |

Дополнительно Friday script запускает Chromium с unconditional `--no-sandbox` (`screenshot.mjs:100–103`); это существующая declared surface для отдельного hardening, не было runtime-проверки sandbox/security. Не расширять URL capture на arbitrary hostile production без threat model.

## Test intent и что НЕ проверено тестовым прогоном

Прочитаны embedded tests всех full файлов. Значимые contracts: callback success only after saved; scope omission vs explicit empty; upload generation mismatch; store token max fits Windows; copied lock handle unlock; anchored root/symlink/FIFO refusal; default-on preference explicit-off; cached quiet upload owes human notice; registry collisions/builtin order/advisory retirement; suppression unused/wildcard/lineless; consent/overlay report merge/selector embedding; glyph antialias/core pixels/failing-ratio label; source transformed-copy vs independent; edited non-PNG source bypasses stale conversion; Pro signature/artifact/time/floor concurrency/world no-overwrite.

Это **намерения tests и прочитанные assertions, не PASS**. Browser test `screenshot_contrast.rs:743–747` silently returns when browser discovery/launch unavailable, поэтому даже будущий green unit-test log без skip accounting не гарантирует выполнение shadow-scroll scenario. Snapshot differential test только указан в module comment, не прочитан/не запускался. Fake issuer backend, actual keychain/Windows FFI/live service endpoints/release build feature configuration/closed Pro pack не проверены. No CVE audit или lockfile resolution.

## Точные remaining gaps

Все пути ниже относительно upstream root; диапазоны **не прочитаны в текущем проходе**, даже если assignment несёт previous partial ranges. Они также перечислены машинно в coverage.gaps. Внешнего tool/network blocker не было; это незавершённый substantive scope, а не повод объявить full. Никаких alias/classified exemptions для этих hand-written файлов не применено.

| Путь | Непрочитанный текущим worker диапазон |
|---|---|
| `crates/browser/src/cdp.rs` | 1–2749 |
| `crates/browser/src/lib.rs` | 1–2742 |
| `crates/browser/src/fullpage.rs` | 1–1683 |
| `crates/browser/src/motion.rs` | 1–1075 |
| `crates/foundation/src/js.rs` | 1–863 |
| `crates/foundation/src/color.rs` | 1–1330 |
| `crates/foundation/src/fdlibm_trig.rs` | 1–562 |
| `crates/foundation/src/js_ext_a.rs` | 1–242 |
| `crates/foundation/src/css/scan.rs` | 1–976 |
| `crates/foundation/src/css/measures.rs` | 1–1462 |
| `crates/foundation/src/vectors/checks_a.rs` | 1–153 |
| `crates/foundation/src/vectors/mod.rs` | 1–450 |
| `crates/foundation/src/vectors/checks_b.rs` | 1–174 |
| `crates/foundation/src/browser/selector.rs` | 1–793 |
| `crates/foundation/src/browser/fake_dom.rs` | 1–686 |
| `crates/foundation/src/browser/mod.rs` | 1–244 |
| `crates/foundation/src/browser/dom.rs` | 1–695 |
| `crates/foundation/src/browser/snapshot.rs` | 1–1735 |
| `crates/skills/src/hook_manifest.rs` | 1–1124 |
| `crates/skills/src/bundle.rs` | 1–1463 |
| `crates/skills/src/commands.rs` | 1–1290 |
| `crates/comp/src/hero.rs` | 1–616 |
| `crates/comp/src/font_index.rs` | 1–286 |
| `crates/comp/src/font_fingerprint.rs` | 1–1195 |
| `crates/core/src/browser/text_collectors.rs` | 1–1895 |
| `crates/core/src/browser/hidden_mockup.rs` | 1–929 |
| `crates/core/src/browser/text_geometry.rs` | 1–752 |
| `crates/core/src/browser/field_label.rs` | 1–286 |

Созданы только собственные `impeccable-close-8.md` и `impeccable-close-8-coverage.json` в deep-audit. Upstream, Friday runtime/configs и чужие reports не изменены. Assignment требует продолжения; этот отчёт нельзя использовать как подтверждение закрытия close-8.
