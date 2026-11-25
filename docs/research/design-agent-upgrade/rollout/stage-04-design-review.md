# Stage04 — независимый bounded design review

## Verdict: PASS — только isolated technical motion fixture

Роль: adapted `design-reviewer`; reviewer ID: Hermes leaf subagent `stage04-design-review` текущей сессии, не implementer и не координатор. Перед ревью полностью прочитаны `.codex/agents/design/design-reviewer.md`, `.codex/workflows/review-loop.md`, `.codex/CODEX.md`, motion/design principles и Apple-patterns. Делегирования и source fixes не было.

Трактовка: техническая drag-fixture для разработчика/QA, нейтральный debug-интерфейс, V/M/D=1/2/1 (описательные регуляторы, не бренд-токены). Это не клиентский сайт, маркетинговая композиция или готовый accessible widget.

**Findings: проблем не обнаружено в назначенном bounded scope.** Нет подтверждённых blocking findings. PASS не означает product accessibility, client visual approval, production integration или разрешение публикации.

## Scope / exact content revision

Authoritative candidate: `/Users/germanbryzgalov/.hermes/cache/scratch/design-rollout/publication-final-candidate.json`, SHA-256 `e1918fe626252bba2a68050cd69efe651a33b81a19f7989aec19c4f1f91d2654`; заявленный base `1b63e10d639d46767ddb3432d3f599f5a6e2ecd8`. Git не использовался: это привязка к содержимому, не независимая проверка истории/публикации.

Полностью прочитаны fixture HTML/TS, wrapper, motion-engine contract и текущий runner. Фактические SHA-256 совпали и с candidate, и с `parent-clean-export-gqnk5l48`:

| Payload | SHA-256 |
|---|---|
| `docs/research/design-agent-upgrade/rollout/motion-pilot/fixture.html` | `09fb978e1c9a301feb0918750bc62a5e8cab14dff2528f499e625bc1d1b30244` |
| `docs/research/design-agent-upgrade/rollout/motion-pilot/fixture.ts` | `f85ef00cb67bad96af7529d63c9c4a8be6cdabad5b99ff9300eccd891fab8d1c` |
| `docs/core/templates/motion.ts` | `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3` |
| `docs/core/motion-engine.md` | `fd0fb024c5b860ebe33fb65dc1b706c7319e4d3037052bf0cf2fe7ea16a9e77f` |
| `.codex/scripts/test-motion-template.mjs` | `330900f6cf7604ba890843fc76e9d547caf6d0cdea996454b384d1d9a64f01fb` |

Generated `motion.ts` в replay побайтно совпадает с template; generated `fixture.ts` совпадает после единственной предусмотренной замены import path. Старый runner hash в `stage-04-independent-review.md` не подменён текущим: parent isolation fixes и их итоговое code/QA review остаются отдельной областью.

## Реально просмотренные кадры

Все четыре предоставленных PNG явно открыты через `vision_analyze` и просмотрены непосредственно в приложениях текущего сообщения. Evidence directory: `/Users/germanbryzgalov/.hermes/cache/scratch/motion-run-jY8iTG`.

| PNG | SHA-256 |
|---|---|
| `before.png` | `849c5860c772bf779d31966325ffeab57977809dec4f6551d44f5708f852783b` |
| `mid.png` | `cf9670959baf932cc8820b1d0d53dcff4c3e24d7f83ae6f9f771d34fc5233acc` |
| `repeat-settled.png` | `141a2de5d3fd69b2b645cce23bafb96c35ed539c013f8b0c61b7d669e9d07bf1` |
| `reduced-settled.png` | `52fcb192f2eb8b18446d37e5f8b2d127eee2b2fac5037beb7075cc7fb7f1e2c6` |

В наблюдаемом viewport **1200×650**: заголовок отделён размером/весом; disclaimer читается полностью, включая «Not a keyboard widget or production a11y example» и объяснение reduced motion. Mint-блок 100×100 и центрированный `Drag` видны целиком во всех четырёх состояниях; clipping, наложения на текст и исчезновения label не наблюдаются. Пустое поле уместно для изолированной проверки горизонтального перемещения. System font здесь не заявлен бренд-шрифтом.

Контраст вычислен по фактическим CSS sRGB-парам: white / `#16202a` **16.48:1**, `#102019` / `#83d8c1` **10.11:1**. Это проверка этих пар, не полный WCAG audit.

Фактически выполнен `node .codex/scripts/design-lint.mjs docs/research/design-agent-upgrade/rollout/motion-pilot/fixture.html docs/research/design-agent-upgrade/rollout/motion-pilot/fixture.ts`: **exit 0**, одно WARNING `fixture.html:2` о цвете вне палитры проекта. Это не defect fixture: scope не принадлежит клиентскому brand/MASTER; применять палитру активного клиента к техническому пилоту было бы неверной интерпретацией.

## Temporal evidence — не из PNG

Полностью прочитан настоящий `receipt.json`, SHA-256 `6539e6fa7d28359d8e872b8a6f63b48fb0b70f743eef8fcd5c3b9712ee4623be`: **PASS**, `errors: []`, animejs **4.5.0**, Chromium headless **159.0.8154.6**. Самостоятельный новый browser replay этим reviewer не запускался; вывод основан на проверенном receipt/trace payload и прочитанном runner, а не на присвоении чужого запуска себе.

- Mouse drag перемещает DOM x=40 →150. Normal release x=150 → measured mid=155.2030029296875: автоматическая инерция действительно наблюдалась.
- Off-center grab проверяется runner непосредственно до/после down с порогом <1px. Re-grab останавливает inertia; held trace x=205.3636932373047 неизменен. Между отдельными interrupt samples прошло время активной инерции, поэтому их разность не объявляется скачком при захвате.
- Repeat duplicate release не увеличивает счётчик; следующий drag увеличивает его ровно один раз. Repeat settle x=366.92620849609375 стабилен.
- Initial reduce сохраняет drag, но release остаётся x=150. Dynamic reduce удерживает текущий x=154.61509704589844; restore не воспроизводит старое движение. Следующий normal gesture снова имеет inertia. Preference change во время held drag сохраняет follow, затем отменяет release motion.
- Все **девять** сохранённых stable traces пересчитаны: rangeX=0; наблюдаемые окна приблизительно 151.5–499.8ms. Destroy active drag/inertia отключает handle, балансирует media listener 1/1, не создаёт semantic release; после него нет drift, synthetic touchstart не prevented.

Это подтверждает ограниченные movement/cancellation/stability assertions runner. Не доказывает непрерывность каждого промежуточного кадра, высокий FPS, отсутствие dropped frames или device latency. PNG снимается после sample и не обязан представлять его точный timestamp; визуальное положение `mid.png` не используется вместо measured mid.

## Semantic limitations и обязательные продуктовые gates

`fixture.html:3` прямо раскрывает test-only pointer scope; `motion-engine.md:130–140` явно перечисляет отсутствие tabindex/role, Arrow/Home/End, Escape/cancel, focus, ARIA value/live и reorder semantics. `<div id="tile">Drag</div>` не выдан за кнопку/slider/APG widget. Это честное ограничение fixture, не завершённая доступность.

**До продуктовой acceptance обязательны** доступный эквивалент действия без dragging, подходящий semantic/APG pattern, клавиатура, focus/announcements и соответствующее cancel-поведение. Один tabindex и технический PASS этого не заменяют. Reduced/cancel gates не отменены: wrapper stop cancels automated release и live inertia, но это не Escape/cancel пользовательской операции. Destroy — unmount cleanup с возвратом исходных styles/x=40, не доступная пользовательская команда отмены и не сохранение финальной позиции.

Контракт `motion-engine.md:103–128` также честно раскрывает reduced cancellation snap/boundary settling, необходимость брать semantic state из фактической позиции, unsafe `.draggable` escape hatch и обязательный wrapper `destroy()`. Не заявлено, что planned destination гарантированно достигнута.

Ограничения: только представленные desktop frames и mouse/headless traces; mobile/tablet, 200% zoom, физический touch/pen, screen reader, Safari/Firefox, pointer capture, отдельный offscreen сценарий, GPU/performance и production UX не сертифицированы. Фиксированные координаты/границы fixture не выдаются за responsive product layout. Полный независимый code/QA/secrets verdict находится в отдельном `stage-04-independent-review.md`; этот отчёт его не заменяет и не расширяет.

Единственная repo-запись reviewer — данный отчёт. Нет source edits, Git-действий, внешней сети, установок, headed browser или клиентского visual approval.
