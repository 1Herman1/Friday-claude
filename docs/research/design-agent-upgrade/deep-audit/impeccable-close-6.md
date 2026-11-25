# Impeccable close-6 — extension runtime и browser regression intent

## Вердикт: НЕ ЗАКРЫТО / INCOMPLETE

Назначение: `impeccable-close-6.json`, upstream revision из задания `9e460a87ef338ee9d12c7beed8fedc597a5af5f7`. Пути `extension/`, `crates/` ниже относительны source-only snapshot `/Users/germanbryzgalov/.hermes/cache/scratch/design-deep-audit/impeccable`; пути Friday — `/Users/germanbryzgalov/Friday-claude`.

**Не выдавать этот отчёт за закрытие 51 088 строк.** Прочитаны целиком 74 из 111 назначенных файлов (17 909 строк); ещё 79 строк одного файла прочитаны частично. Остаются 36 непрочитанных файлов и остаток одного частичного: **33 100 строк**. Причина незакрытия — объём содержательного чтения в данном проходе, не отсутствующий доступ и не разрешение заменить его поиском. `all_assigned_closed=false`. Точные SHA-256, диапазоны и индивидуальные substantive notes — `impeccable-close-6-coverage.json`. Полный перечень оставшихся путей приведён в конце.

Полностью закрыта hand-written extension область задания, включая `driver.js`, `page-helpers.js` (generated executable payload всё равно прочитан целиком), `panel/panel.js`, account/background/popup/devtools; исключение — vendor `consent-rules.js`, который НЕ объявлен автоматически прочитанным. Из крупных core implementation полностью прочитан `checks/measures.rs`, а `browser/quality.rs`, `browser/visual.rs`, `checks/text_context.rs` остаются открыты. Прочитаны все назначенные browser test files длиной до 150 строк и `wasm/tests/detect_exports.rs`; большие browser/core/comp tests НЕ закрыты.

BRIEF, researcher role, CODEX, README, review-loop и предыдущие impeccable content/runtime reports прочитаны; лимит 15 файлов не применялся. Исполнитель — adapted Hermes researcher, без делегирования. Ни upstream, ни тесты, ни JS/Rust импорты, ни browser, installers/hooks/npm/cargo не запускались. Использовались чтение, собственный Python для учёта/хешей и проверки literal import existence. Секреты/пользовательские БД не читались. Изменены только два новых deliverable-файла этого задания. Native host/server/provider реализации вне этой области не объявляются безопасными по наличию локальных guards.

## 1. Статические findings

Предлагаемые владельцы — рекомендации координатору, а не фактически назначенные агенты. Все дефекты открыты; исправления и тестовые прогоны не производились.

### C6-F1 — ВАЖНО: устаревший OAuth ответ может занять место нового sign-in

`extension/account/session.js:457–474` проверяет identity ожидающего sign-in через `pending.state` **до** ожидаемого HTTP token exchange (`:470–472`). Затем `keep(at, 'signing-in', tokens)` проверяет только строковое состояние записи (`:181–188`), не `pending.state`. `extension/account/worker.js:269–280` запускает ANSWERS через независимые promises; worker-wide single-flight для sign-in нет. Per-panel `pre.signingIn` в `walks/panel/panel.js:1202–1208` защищает только один экземпляр UI, не popup/settings/другое окно.

Статический schedule: sign-in A прошёл проверку своей pending записи и ждёт обмена code; sign-in B записал новый `signing-in` с другим `state`; ответ A пришёл, `keep` увидел совпадающий общий state и сохранил токены A поверх B. B затем получает `pending`, либо конкурирующие ответы дают ненадёжный выбор аккаунта. Очередь `edit` исключает потерю одновременной записи, но не проверяет identity операции.

**Owner/target:** account maintainer, session keep/signIn. Передавать generation/pending nonce и сравнивать её внутри serialized edit при commit токенов; при несовпадении retire ответ, не принимать access. **Expected test:** injected fetch/launch/store, A token exchange deferred → B pending written → resolve A: запись B остаётся, A refresh только в retire; B завершается своим аккаунтом. Дополнительно sign-out/re-sign-in/refresh overlap. Это логическая трасса, не выполненный reproducer.

### C6-F2 — ВАЖНО: HTTP 429 при revoke забывает refresh token без retry

`extension/account/session.js:273–286`: любой ответ `<500` добавляется в `told`, затем refresh удаляется из `retire`. Значит 429 Too Many Requests считается окончательным подтверждением revoke, хотя запрос не обслужен; после очистки записи следующему startup/status нечего retry. Обещание «again until it answers» в `:13,62–63` не выполняется для transient client-side throttling.

**Owner/target:** account maintainer, retire. Отделить успешный/документированный terminal отказ от retryable 429 (и согласованных timeout statuses), учитывать Retry-After. **Expected test:** первый revoke429 сохраняет retire, второй200 очищает; bearer/refresh не попадает в popup/report. Не утверждается, что реальный upstream issuer сейчас возвращает429: дефект условной ветки воспроизводим fake-fetch seam без сервера.

### C6-F3 — ВАЖНО: DevTools может скопировать findings предыдущей страницы с URL новой

`extension/devtools/panel.js:175–188` на `navigated` вызывает `showScanning()`, но `showScanning :219–225` заменяет DOM, **не очищает `currentFindings`** и не отключает Copy all. Copy (`:237–265`) берёт старый массив, а URL асинхронно получает из текущего inspected window (`:227–233`). Аналогично начало ручного rescan сохраняет старый отчёт; промежуточные findings принимаются без `scanComplete`.

Сценарий: scan A закончен → navigation B → до новых findings Copy all → содержимое A с URL B. У popup уже есть более сильный реализованный контракт: `popup/popup.js:55–88,142–160` инвалидирует scan/revision, проверяет complete и актуальный tab/url/loading перед clipboard.

**Owner/target:** extension detector UI, panel.js. Хранить scan envelope `{tab,url,scanId,complete}`; инвалидировать при navigation/start/failure и повторно проверить после URL await. **Expected test:** A→B pending, Copy disabled; late A не возвращает Copy; B partial не копируется как complete; завершённый empty B можно копировать как корректный пустой результат.

### C6-F4 — ВАЖНО: DevTools не показывает ошибку scan и остаётся в Scanning

`background/service-worker.js:198–204` отправляет panel `{action:'scan-failed',message}` и popup broadcast. `devtools/panel.js:169–189` обрабатывает только pointer/findings/state/overlays/navigated; `scan-failed` отсутствует. После Rescan (`:199–202`) forbidden page/отказ offscreen показывает бесконечный scanning indicator, а прежние данные всё ещё доступны для Copy (F3). Initial state также не интерпретирует `scanError`/`scanComplete`. Popup `:104–108` ошибку показывает.

**Owner/target:** extension detector UI. Единая таблица состояний loading/partial/complete/error для popup+panel; error message через textContent, retry остаётся доступен. **Expected test:** blocked injection / core startup reject после rescan → видимая причина и не stale-copy, не «Clean» и не вечная загрузка.

### C6-F5 — КАЧЕСТВО: заявленный reconnect Elements sidebar не реализован

`extension/devtools/sidebar.js:17–29` зовёт getPort только при загрузке; disconnect лишь ставит `port=null`. Selection callback (`:31–66`) только рендерит cached findings/делает eval, getPort не вызывает. При потере/перезапуске worker sidebar самостоятельно не подпишется снова. Для сравнения `devtools/devtools.js:26–43` реально reconnect timer; panel.js имеет getPort при heartbeat/post.

**Owner/target:** extension detector UI. Reconnect с bounded backoff/visibility или lazy getPort при selection, teardown timer при закрытии. **Expected test:** disconnect→новый worker→selection → новый порт, current state, не старые findings.

### C6-T1 — тестовый gap, не доказанный production дефект: CSP passivity обходится без scanner

`crates/browser/tests/csp_passivity.rs:55–90` создаёт Browser/new_page/goto и проверяет, что CSP-blocked inline script не выполнился. **BrowserEngine.detect_url/detect_url_evidence не вызывается.** Это проверка low-level page setup, а не защита от будущего `setBypassCSP` внутри самого scan pipeline. Тест также возвращает обычный success-return при отсутствии/launch failure браузера (`:57–66`).

Owner browser QA: сохранить этот unit integration и добавить scan entrypoint fixture с marker/readback; наличие установленного браузера/реальное выполнение требовать отдельным CI receipt. Ни этот, ни остальные browser tests в аудите не запускались.

## 2. Реализованная extension трасса, эффекты и границы

### 2.1 On-demand detector, не правило в content world

`background/chrome-worker.js:4–6` imports detector worker → walks worker → account worker; `shared/build.js:4` — development account/devHosts true. Store/Firefox преобразования описаны комментариями, но их emitter этим проходом не прочитан: production permission parity из dev flags не выводится.

Popup/panel scan → `service-worker.js:207–243`: minted UUID, старый scan cancel, on-demand injection snapshot/overlay/content script, lazy offscreen host/WASM, config disabledRules/lineLength80|120/spotlightBlur. Chrome offscreen документ или Firefox hidden iframe (`:124–171`); отказ обнуляет readiness promise для следующей попытки; guarded scanId проверяется после awaits. State — Map в памяти worker; после restart current document scan ID восстанавливается через content reply (`:30–61`), а явный null не «оживляется».

Content script (`content/content-script.js:185–264`) снимает DOM snapshot, отвечает core на hitTests/loadImage/readPixel, рисует отдельные findings/visual stages и сообщает complete **только по done**. Generation/sessionSequence/cancel защищают от позднего чужого результата. Lazy IntersectionObserver threshold.5 переснимает unresolved contrast при попадании кандидата в viewport, очередь строго последовательная из-за shared capture/visualIO (`:143–179,266–303`). Navigation popstate/hashchange → cancel/new scan (`:352–369`); pushState/replaceState interception здесь нет, поэтому полного SPA route tracking не обещать.

Побочные эффекты detector: DOM overlay/banner/highlight, temporary snapshot/pixel IO зависимости, offscreen document и sync settings, clipboard, badge/count broadcasts. DevTools inspectElement скроллит и открывает inspect (`panel.js:401–408`). Это не «ничего не меняющий read-only источник». Remove cancels sessions/disconnects observer/clears UI; injected script flag и listeners остаются idempotent в живом документе.

### 2.2 Remote persona walk и local native agent — разные trust models

Handoff content читает только `<script type=application/json id=impeccable-outing>` и шлёт text; нет window-message bus (`handoff-content.js:8–19`). Worker take проверяет Chrome sender id/frame0/tab/outing URL (`link.js:139–173`); schema parser (`handoff.js:120–180`) ограничивает размер16Ki UTF-16, unknown fields, persona/errand/task lengths, doneWhen6, allow8, exact origin, paired WebSocket host/path, local chosen-account port. Ticket не в query, а WebSocket subprotocol (`worker.js:84–102`); session storage, не disk local storage. После открытого socket ticket считается spent; reconnect только waiting, refresh outing page максимум дважды,15s; на ON_TAB disconnect — fail, не replay старого session (`link.js:59–136`). Outgoing messages режутся по256Ki без разрыва surrogate pairs; incoming req требует object/op string/id number; old socket late reply discarded (`worker.js:29–81`).

Driver открывает about:blank, debugger attaches и Fetch arm до navigation; либо adopt именно названного worker таба с повторной origin проверкой. Нельзя передать tab/frame/target/session/context/window override — `guard.onlyThisTab`, wrapper `driver.js:2092–2093`. Сохраняет/восстанавливает device emulation, native-select fallback, browser group. Stop/open races закрываются stopped opening marker; error cleanup detach/remove/ungroup. Старый worker sizedTab восстанавливается при старте (`driver.js:1332–1364`).

Persona transport поддерживает **legacy arbitrary server source** и **named local helper mode**: named запрещает fn и принудительно выставляет noSecrets для fieldReads/typeInto (`driver.js:1438–1448`). Legacy reader isolated world НЕ sandbox против DOM/script injection (`:646–657`), при sign-in снимаются только new-document scripts; уже внедрённый listener/storage сохраняется, прямо отмечено `:530–539`. Поэтому «никакой код сервера никогда не исполняется» — неверно для compatibility branch.

Local agent (`agent.js`) принимает native messaging от `style.impeccable.browser`; свой session, четыре tools, нет evaluate/cdp/upload. Exact-origin Allow once/Always allow/deny; память Allow once очищается, Always хранится local; удаление Always завершает активный session. Idle10m, lease1h, Stop лишает дальнейших вызовов и требует нового Allow (`:69–94,342–479`). **free writes deliberate:** local agent доверяется как руки человека, отдельного approval каждого submit здесь нет (`control.js:172–174`, `agent.js:174`). Это не модель безопасного audit-only browser.

### 2.3 Что реально удерживает writes, а что нет

Fetch guard: exact top-origin fence; GET/HEAD/OPTIONS считаются reads; прочие методы — только writable origins и пока hold открыт; hold возвращает409 для subrequests, abort для top form (`guard.js:266–343`). Default writes закрыты, server пишет `writes`, либо deed yes открывает до close/fence. Sign-in trusted user input window5s/takeover отдельно (`driver.js:64–105`). DNR net-hold покрывает foreign frames/new popups/workers, обновляется сериализованно и каждые250ms; при missing API/update failure **degraded Fetch-only + note**, не fail-closed расширенного обещания (`net-hold.js:90–138`). DNR host matching без port/subdomain isolation может затронуть workers других пользовательских tabs того же host.

Явные ограничения, не новые скрытые баги: GET может менять состояние, WebSocket messages не удерживаются; OOPIF reads не Fetch target; popup first request возможен до close, tiny download может существовать до removal (`guard.js:42–59`). Guard запрещает собственные account pages, local agent staging exception scoped по decoded routes; фиксированные OAuth consent URLs блокируются до user takeover. Это allowlist по имени, не DNS/private-network sandbox.

### 2.4 Pause/sign-in/evidence guards

`control.js:80–117,158–218`: pause fences синхронно инвалидируют операции; поздние данные/ошибки чтения не возвращаются; click/key/upload не переигрываются после Continue. LOOKING проверяет sign-in до и после. Named helper/AX read не должен возвращать секрет; `driver.js:1466–1513` описывает до200 fields, неизвестные трактует secret, descendants/value удаляет; не более5 same-site frame trees. Password/card/OTP/cross-origin frame focus нельзя печатать, кроме Tab/ShiftTab/Esc (`:1636–1646,1979–2000`). Sign-in detection включает visible/named/password/autocomplete/filled/autofill/401, marks show-password clones (`signin.js:58–177`); passkey не виден — честный gap.

Пиксели: secret cover через fixed code во всех frames и closed roots, verify computed cover, иначе нет снимка; cover TTL2s и поздний shot отвергается. Sign-in one-still branch отдельно blanks все вводимые поля и отмечает pictured; больше во время pause не снимает (`driver.js:691–913,1908–1943`). Cover временно меняет inline styles/adoptedStyleSheets; сохранение/возврат значения учитывает внешние изменения (`page-helpers.js:2004–2241`). Badge скрывается при evidence/point ops; Yes требует trusted click+visible/topmost+500ms, сторона panel независимо (`badge.js:83–120,255–287`). Closed shadow root не мешает самому сайту удалить/перекрыть host — visibility check важнее декларации «не reach».

Film — собственные viewport shots, не Chrome screencast geometry,84ms pacing/150ms shot timeout и pointer/capture serialization; muted pause/takeover/withdrawn secret; persona sight transforms применяются к передаваемым кадрам. Filmstrip local-agent —6 stills, предупреждает background-tab throttling; не доказательство настоящего FPS/performance budget.

### 2.5 Helper payload и sidepanel: не чистые измерители

`page-helpers.js` полностью прочитан, несмотря на generated/external-source header. Реализует fuzzy text target scoring/modal/scoped duplicate resolution/hit tests; может scrollIntoView, .click, select option/input/change, native setters/type, open details с restoreClosed, scroll panes, mask text skim, fonts/locale prototype patching. `collectA11ySample:1394–1668` ограничивает sample200 images/250 controls/200 fields/focus16; при probeFocus переписывает :focus-visible→:focus, фокусирует/blur, потом восстанавливает изменённые selectors и scroll, **не возвращает прежний focused control**. `readCover:1151–1259` scrolls targets и возвращает страницу на0; failure path не общий try/finally. Поэтому активные измерительные probes должны иметь scope/cleanup contract, не «пассивный scan» по названию. Генератор helper payload находится вне snapshot;16-hex HASH — protocol identity, не подпись доверенного server source.

Sidepanel сделан DOM/textContent, модальные фоны inert, return-focus, nullable loading/error/empty, bounded faces polling, GL-free FLIP transform/opacity/reduced-motion, mic stop on pagehide. Account/persona RPC sender control остаётся worker, не panel authority. Важный side effect `panel/panel.js:823–851`: после паузы набора1.2s и минимум12 chars **до Send** отправляет task+tab URL на account plan endpoint; до3 speculative calls между Send, тратят hourly plan quota. Не переносить как безусловный локальный UX optimization. Voice transcription через browser speech recognition, Google dependency явно disclosed `copy.js:113–124`; аудио backend не проверялся.

First-run disclosure о signed-in actions и передачах screenshot/video/steps AI-provider есть (`copy.js:266–286`), но `panel.js:1293–1318,1472` хранит один browser-global firstRunSeen, не account+version. Это конкретная глубина onboarding реализации, не совпадение с более строгим content playbook. Intro maker держит поле inert до конца authored sequence (`:501–561`); Friday не следует импортировать такую задержку первого действия только ради motion.

### 2.6 Account state machine

`flow.js`: allowed issuers prod/staging/local, PKCE S256/random32, RFC metadata same-origin token/revoke, paired dialog, callback exact origin+path/no credentials/single code-state-iss and matching state/issuer, bounded code. Resource `/extension/v1`; optional scopes только advertised. Это проверка public-client обмена, не аудит server-side auth.

`session.js`: refresh token в extension IndexedDB, access memory only; record bound issuer/client/resource; IDB result после tx commit; per-issuer edit queue+refresh single-flight, token requests credentials:omit/redirect:error,401 retry once. Signed-out локально до remote revoke; retire durable, кроме F2. Face bearer only own prefix, MIME+size256Ki checks, max100 persona/history, apps50/waiting3. Response arrayBuffer читается целиком прежде actual-size cap — caps не streaming network allocation bound. Account worker отвечает только своим popup/panel pages и никогда токеном, но имя/email/persona/task/history являются данными, не «никакой privacy поверхности».

Startup status/availability/server requests и check-in alarm0.5min — реальные сетевые side effects при подписанном account, даже без ручного Scan. Notifications хранят at-most-once shown20 в session, decline retry, generation/issuer stale guards (`waiting.js`). Own-tab walk стартует server-side, затем adopted-handoff validated; локальный отказ посылает cancel. Клиентский plan approval не доказывает server risky-action enforcement: backend вне snapshot.

## 3. Core gates: измерение не равно регуляторному запрету

Полностью прочитан `crates/core/src/checks/measures.rs` с embedded tests. Внешние parsing/StyleMap types re-exported из foundation (`:19–21`); foundation реализация этим чтением не закрыта.

- Radial spotlight declaration:>=2 stops, far alpha<=.05,1–2 colored stops, каждый alpha<.45 и chroma gate, surface>=240×160 (`:35–75`). Prominence отдельный: effective alpha>=.14, contrast>=1.30 если backdrop известен, behind_text closure вызывается последним; неизвестная фотография пропускает contrast gate, но не alpha/text (`:292–364`). Это corpus taste heuristic, НЕ WCAG ratio text.
- Background gradient mean не учитывает stop positions (`:130–157`); layered alpha composites, Image/Unreadable отдельно, white fallback только на завершении backdrop stack (`:165–289`). Нельзя выдать усреднённый фон за per-glyph pixel contrast.
- Oversized h1: font>=72px, UTF-16 chars>=40, при валидном viewport dominates height>=.28 или area>=.25; при отсутствии rect/viewport эти gates недоступны (`:435–475`). Это warning контекстной композиции, не глобальный max font size.
- Border+halo current engine API:>=3 comparable cards,32px effective halo, hairline<=1.5px alpha>=.28 на>=2 сторонах; wrapper depth2, siblings24/side, cell nodes32; near-black invisible halo suppressed через known-surface helper. CountingTree test проверяет bounded navigation reads для200 vs20000 child cells (`:477–790,792–985`). **Legacy pure function всё ещё16px single element** (`:966–984`) — экспортный контракт не равен narrowed engine adapter.
- Hidden text >=200 total,>=150 hidden, share>.3 (`:1046–1074`); opaque decorated box fill alpha>.6 либо>=2 borders alpha>.3 (`:1080–1102`); tracked uppercase labels<=40, multiline proof через height>1.5 line-height; Unicode case и UTF-16 snippets — не ASCII-only весь текст.
- `url_is_svg`/raster exemption и ident BEM/camel token split предотвращают icon/slideshow ложные срабатывания (`:825–899`). Встроенные tests проверяют parsing/alpha/fallbacks/clipped sr-only/box shorthand/gradient weighting. Их наличие не означает выполненный прогон.

## 4. Browser test intent и полезность для Friday

Для каждого полностью прочитанного test файла ledger содержит отдельную substantive note, не общий «browser tests». Основной pattern: local fixture server → discovery existing browser → BrowserEngine UrlEngine → selectors/snippets/severity/count assertions. Большинство при отсутствии браузера обычным return выходят из #[test]; отдельные пропускают launch, fixture или CLI binary. Поэтому green harness без environment receipt не доказывает непустое исполнение.

Проверенные серии дают не только recall, но и paired should-flag/should-pass controls:

- `gradient_surface.rs:86–123`, `transient_opacity.rs:80–150`: actual glyph ground, nested alpha, opacity-at-rest vs imminent reveal; active stepper advisory отдельно от actionable text.
- `visual_contrast_gates.rs:90–109`, `covered_text.rs:91–121`, `surface_resolution.rs:94–138`: rendered visibility/clipping/disabled/glyph filters, first uncovered dedup/count, shadow-tree fills, display:contents not surface, unknown photo не выдуманный hard verdict.
- `low_contrast_pixel_reads.rs:85–91`, `unread_pixel_verdicts.rs:87–128`, `pixel_pass_identity.rs:39–132`: pixel pass заменяет element guess, refused read не clean measurement, backdrop/outline advisory; duplicate ID и RTL negative scroll origin не должны подменить candidate.
- `not_at_rest*.rs`, `never_painted.rs`, `hidden_and_hydration.rs`, `not_visible_at_capture.rs`, `not_shown_at_capture.rs`: stopped reveals vs closed UI, paint vs DOM presence, actual state vs transitions, transformed1px geometry, hydration recoverable advisory, no blanket suppression.
- `scroll_linked_and_sliders.rs:75–143`: scroll reveal probing сохраняется в scan facts; all-hidden slider выдаёт capture note, не false clean; replay сравнивает source-origin-filtered findings+notes. Это source test intent, replay implementation ещё не прочитана.
- `line_breaks.rs:46–111`, `line_length_text_count.rs:88–120`, `heading_rhythm.rs:81–147`: rendered lines/combining chars/hidden text exclusions, font-host-tolerant twin counts, intentional pretty/balance/manual breaks, measured hierarchy gaps. Не заменять typographic judgment бинарным lint.
- `design_system_palette.rs:95–138`: documented OKLCH palette→CLI→browser equivalence suppresses generic-color/drift и имеет undeclared neon control. `isolated_world.rs:19–52`: poisoned page prototype isolation и invalid evidence after navigation.
- `wasm/tests/detect_exports.rs:51–160`: native plain-call экспорт shape, malformed options fallback, inline ignores toggle, DESIGN font var fallback, custom pack appended registry. Не проверяет настоящий browser WASM loading/CSP.

## 5. Friday comparison: только проверенные дельты

Friday `design-lint.mjs` и `screenshot.mjs` перечитаны полностью, local hashes в additional_sources ledger. Live hooks/browser/provider не проверялись.

| Возможность | Verdict | Что доказано / target и expected acceptance |
|---|---|---|
| Source anti-slop lint/MASTER | already implemented / partial | `design-lint:7–103,124–219`: правила+path-first MASTER, но line regex,hex6/fonts, не computed DOM. Не добавлять «первый detector». |
| Rendered contrast и contextual exceptions | absent in inspected lint/screenshot scope | `design-lint:21–26` всего лишь regex hint; screenshot `:107–139` только capture. Owner design tooling: optional measured-evidence слой с known/unknown/advisory, real text+ground, paired controls; не тащить account/walks. |
| Stage/scan identity и stale evidence | useful new contract | Upstream popup generation/url/complete guard сильнее его panel. Owner screenshot workflow: pin url/viewport/state/revision в receipt; missing requested click (`screenshot:124–130`) не незаметный equivalent desired-state proof. Test slow A→B/late A/failed click→not accepted. |
| Motion evidence | partial | Friday `screenshot:12,133–137` одна выдержка+один кадр, не continuity. Agent filmstrip6/back-tab warning — пример bounded packet, не benchmark. Owner design reviewer: normal/reduced before/mid/settled+visibility and actual temporal metadata. |
| Side-effect disclosure | preserve local audit-only / conflict whole import | Walk реально signed-in clicks/types/remote recordings; default source audit не разрешает эту поверхность. Owner security/privacy: отдельные previews/fixture-only action allowlist; GET/WebSocket/OOPIF limits named; не обещать sandbox. |
| Prompt-to-plan speculative calls | not applicable without explicit decision | `panel:823–851` task+URL и quota до Send. Не переносить в Friday hooks; opt-in/данные/стоимость/отмена должны быть отдельным контрактом. |
| Stronger test oracle design | useful delta | Paired positive/negative twins, unknown capture notes, font-host tolerance, replay facts и source-origin checks. Owner QA: пустой suite/skip ≠ measured pass; do-not-run при этой задаче сохранён. |
| Taste heuristics vs a11y | conflict if unconditional | Halo32/card row3/glow alpha thresholds — opinionated gates, не WCAG. Owner lint: measured context + documented brand exemptions, отдельный advisory, не переносить raw pure16px API как engine behavior. |

Дополнительно подтверждены прежние local limitations: `design-lint:263–273` auto-walk только .tsx, `:283–300` missing targets skip и всегда exit0. Рекомендации: files_scanned/nonexistent/unsupported отчёт до clean, явная advisory/failing policy, не объявлять source regex проверкой AA. `screenshot:100–103` запускает отдельный browser с no-sandbox; это не подключение к подписанным пользовательским tabs и не эквивалент guards extension. Наличие screenshot utility — already implemented, не runtime activation.

## 6. Полнота и оставшиеся пробелы

Все111 назначенных paths имеют SHA256/status/ranges/total_lines/substantive_note. Alias не использовались: одноимённые или похожие test harnesses не признаны дублями. Механическая проверка65 literal static relative imports из full extension files дала0 missing; **не** доказывает runtime initialization/circular-import ordering, dynamic asset availability или внешние helper generator dependencies. Никакие произвольные upstream modules не импортировались для проверки.

`consent-rules.js:1–40,42–80` прочитаны. Очень длинная compact data строка41 была усечена самим reader и исключена из ranges; остальной vendor runtime81–3788 не прочитан. Header говорит autoconsent17.2.0/MPL-2.0, bridge хранит cmp/popup/optOut/result/error и отвечает init; это provenance declaration, не независимая проверка лицензии/целостности всего vendor body.

Следующая таблица — **незакрытая работа**, не присвоенное full inventory. Для unread нужен весь диапазон; partial диапазоны точно исключают уже прочитанное. Крупнейшие непрочитанные реализации нельзя закрыть по тестовым названиям или этому описанию. Вердикт остаётся INCOMPLETE до их substantive read.

| Открытый путь | Непрочитанные строки |
|---|---|
| `extension/walks/consent-rules.js` | 41–41, 81–3788 |
| `crates/browser/tests/brand_and_vendors.rs` | 1–303 |
| `crates/browser/tests/card_heuristics.rs` | 1–362 |
| `crates/browser/tests/evidence_findings.rs` | 1–331 |
| `crates/browser/tests/page_level_forms.rs` | 1–153 |
| `crates/browser/tests/fullpage_screenshot.rs` | 1–1053 |
| `crates/browser/tests/counted_pairs.rs` | 1–153 |
| `crates/browser/tests/page_globals.rs` | 1–260 |
| `crates/browser/tests/text_forms.rs` | 1–165 |
| `crates/browser/tests/round13_defects.rs` | 1–181 |
| `crates/browser/tests/consent_hiding.rs` | 1–700 |
| `crates/browser/tests/cdp_attach.rs` | 1–427 |
| `crates/browser/tests/right_box.rs` | 1–244 |
| `crates/browser/tests/evidence.rs` | 1–588 |
| `crates/browser/tests/differential.rs` | 1–330 |
| `crates/browser/tests/computed_forms.rs` | 1–189 |
| `crates/browser/tests/overlay_hiding.rs` | 1–557 |
| `crates/browser/tests/own_box_surface_and_ink.rs` | 1–159 |
| `crates/browser/tests/low_contrast_advisory.rs` | 1–182 |
| `crates/browser/tests/response_capture.rs` | 1–170 |
| `crates/browser/tests/unread_surfaces.rs` | 1–233 |
| `crates/browser/tests/borrowed_grounds.rs` | 1–152 |
| `crates/browser/tests/shadow_trees.rs` | 1–336 |
| `crates/browser/tests/recall_and_gates.rs` | 1–316 |
| `crates/browser/tests/text_geometry.rs` | 1–404 |
| `crates/browser/tests/painted_gate_coverage.rs` | 1–163 |
| `crates/browser/tests/advisory_contexts.rs` | 1–350 |
| `crates/browser/tests/declared_mockups.rs` | 1–172 |
| `crates/browser/tests/measured_boxes.rs` | 1–205 |
| `crates/browser/tests/html_snapshot.rs` | 1–266 |
| `crates/core/src/browser/quality.rs` | 1–8274 |
| `crates/core/src/browser/visual.rs` | 1–7021 |
| `crates/core/src/checks/text_context.rs` | 1–3121 |
| `crates/core/tests/heading_rhythm.rs` | 1–833 |
| `crates/comp/tests/parity.rs` | 1–416 |
| `crates/comp/tests/record.mjs` | 1–199 |
| `crates/core/src/checks/vectors_a.rs` | 1–423 |

Непроверенные вне этой assignment зависимости: native host relay, server OAuth/risky-plan enforcement/provider retention, generated helper factory вне repository, browser/WASM/offscreen implementation за call sites, fixture HTML и большие core/browser/comp tests из таблицы. Их существование/вызовы не превращены в semantic full. Полный production security/design verdict этим документом не выдаётся.
