# Stroymat — независимое визуальное ревью before / A / B

## Итог

**REQUEST_CHANGES — для заявления о полном соответствии MASTER.** Один подтверждённый новый конфликт: desktop hero A/B намеренно получает 4:3 вместо обязательного 16:9. **PASS в ограниченном смысле:** текущие приватные варианты пригодны для сравнительного показа владельцу с явным раскрытием этого исключения; видимого блокирующего наложения текста/изображений в просмотренных финальных кадрах нет. Это не разрешение публикации и не owner acceptance.

**Рекомендация: B** для снабженца на объекте. Последовательные строки и меньшие фотографии быстрее приводят к формату, толщине и статусам; A сохраняет более выразительную редакционную галерею, но требует больше прокрутки. Это экспертная рекомендация по видимой структуре, не результат пользовательского тестирования/измерения конверсии.

Исполнитель: один фактический независимый Hermes reviewer, адаптировавший полностью прочитанные роли `.codex/agents/design/design-reviewer.md` и `brand-guard.md`; не native Codex activation и не два независимых сотрудника. Раздельные ролевые выводы приведены ниже. Implementer self-review не использован как замена собственной vision-проверки.

Читаю это как B2B-витрину обновления ассортимента для снабженца/прораба с телефона на объекте, характер сдержанный, V/M/D=5/3/3. Explore → Operate для поиска спецификации/запроса прайса; Read для логистики и реквизитов. Цены, checkout, формы и новые коммерческие обещания не требуются.

## Основание и проверенная revision

Полностью прочитаны реальные роли, Stroymat `project.md`, `brand.md`, `design-system/MASTER.md`, `docs/core/design-surface-workflow.md`, design-principles, design-profiles, ux-guidelines, замороженные README и followup-05-client-pilot. Цель — Stroymat, не активный Perfect Skin; `.active` не менялся. Оригинальная скомпилированная страница сохранена, а не пересоздана как удобный baseline.

Приватный корень evidence: `/Users/germanbryzgalov/.hermes/cache/scratch/stroymat-r3-repair-v1/`. Только `preview-v3/` считается финальной визуальной revision. Frozen payload manifest SHA-256: `1f50055cbf720869dac5efefff6d5538dcbda3a0564f438c1552d8f4084d5c76`. Экспортная база по receipt: `d89bcbcf0a88b9a000008328d67d80ec6c83b5a5`; исторический оригинал относится к `77d9e09390835250b39a684d245a32f2338fff32`.

| HTML, относительно private root | SHA-256, пересчитан при ревью |
|---|---|
| `preview-v3/baseline.html` | `528aaed361aadd44585b53a9db1e517a3231105989f3c8bf3fd6568d8ff34dca` |
| `preview-v3/A.html` | `fbb076faa9d1c4bf52b9b11bf957e94c90414ac2f83b0fc25df4f072aa5bcf6c` |
| `preview-v3/B.html` | `bbbcecabc2c1bc41cca43ed52bac001382f4a0df23a6bc17d3699811b1f25633` |

## Design-reviewer: наблюдения по реальным изображениям

| Область | Before | A | B |
|---|---|---|---|
| Первый экран desktop | Крупный заголовок поверх сильно затемнённого общего изображения, быстрых переходов к размерам нет | Разделены текст и крупный предметный кадр, видны «Форматы и толщины» / «Запросить прайс» | Компактный masthead и небольшой кадр; начало каталога ближе к первому экрану |
| Карточки desktop | ОСП большой featured-кадр, текст поставки перед спецификацией | Редакционная большая первая/последняя позиция, парная середина; спецификация заметнее, выше поясняющего текста | Регулярные строки: фото / название и наличие / спецификация; реально другая композиция, не смена цвета |
| 390 mobile | Большая фотография карточки предшествует названию и цифрам | Крупный кадр остаётся впереди, но формат 1250 × 2500 заметно усилен; наличие перед пояснением | Миниатюра рядом с названием, спецификация на всю ширину; следующая позиция появляется раньше. Подписи статусов текстовые, не только цвет |
| 768 tablet | Baseline не переоценивается как новая реализация | Две галерейные колонки, читаемые значения | Фото слева, тело справа; в финальном firstcards изображение не закрывает ОСП, размеры и статусы |
| Long RU, 390 | Не используется как источник новых товарных данных | Длинное имя занимает несколько строк, длинные значения полностью переносятся | Более узкая колонка имени из-за thumbnail, поэтому строк больше; спецификация остаётся полной и не обрезается |

Сильные стороны обоих: графитовый верх / тёплая светлая галерея, спокойный латунный CTA, узнаваемые кириллические Manrope/Golos Text, тон фактический. Размер ОСП читается первым значимым числом карточки; толщина «все основные» сохранена как исходная неопределённость, не превращена в придуманный диапазон. «Со склада» и «Транзит с завода» разделены словами и цветом. Отсутствующие размеры гипсокартона/мембран и наличие у ряда позиций не придуманы: страница не становится гарантией наличия каждого материала. Цены не появились; запрос прайса и телефон визуально доступны, в том числе через нижнюю mobile dock. Контакты не активировались.

На 390 верх A/B фактически совпадает (одинаковый hash): вариантность находится прежде всего в каталоге, а не во всех элементах страницы. На 768 обе версии ставят большое hero-изображение перед текстом/действиями; это слабее mobile text-first, но CTA виден в просмотренном верхнем кадре и не перекрыт. Не объявляю это новым blocker: запрета image-first для tablet в брифе нет. Полные кадры просмотрены для ритма и последовательности восьми материалов/логистики/контактов; автоматическое уменьшение full PNG не позволяет удостоверять каждую мелкую букву.

### Подтверждённая находка — P4/P5, ВАЖНО

`client-pilot-stroymat/layouts.css:43,55` — новые desktop overrides `.hero-media` A/B задают `aspect-ratio:4/3`, тогда как `docs/projects/stroymat/design-system/MASTER.md:121` требует hero 16:9. Уверенность >80%: видимые кадры подтверждены независимым реальным headless Chromium DOM-read без изменения исходников:

| Variant / viewport | Actual hero frame | Computed aspect-ratio |
|---|---|---|
| baseline / 1440 | 1440 × 828 | auto; absolute fill |
| baseline / 768 | 768 × 828 | auto; absolute fill |
| baseline / 390 | 390 × 828 | auto; absolute fill |
| A / 1440 | 600 × 450 | 4 / 3 |
| B / 1440 | 240 × 180 | 4 / 3 |
| A и B / 768 | 720 × 405 | 16 / 9 |
| A и B / 390 | 358 × 201.375 | 16 / 9 |

Исходная bitmap во всех случаях 1376 × 768; её bytes сохранены. Baseline сам не обеспечивает фиксированный 16:9 display frame, но **конкретный 4:3 desktop override — новое решение**, а не унаследованная декларация baseline. Сохранение изображения не требует менять рамку на 4:3. Scope-aware право на task-led layout не даёт молчаливого approved page override для конкретного требования MASTER. Назначение координатору/исполнителю: восстановить desktop frame 16:9 с тем же asset либо получить и записать явное узкое approval исключения. Затем переснять затронутые состояния и обновить evidence; текущий hash не переносит verdict на будущую revision. В этом ревью source не исправлялся.

## Brand-guard: отдельный ограниченный вывод

**PASS для сохранённой медиа-идентичности приватного сравнения; не полная media compliance.** В реально просмотренных карточках видны торец/фактура материала, нейтральные студийные поверхности, без рабочих/строительной техники, не добавлены новые марки, упаковка или рекламные плашки. Нейтрально-тёплые изображения не спорят с палитрой UI.

Унаследованное и раскрытое исключение: hero изображает несколько слоёв разных материалов, что расходится с MASTER:118–123 и brand:59 («один материал», не «всё сразу»). Это существующий source asset, byte-preservation обязателен; **не новая регрессия A/B и не требование платной перегенерации**. Не объявляю его полностью соответствующим MASTER. Никакой новой генерации/медиа не было. Права на owner private preview не означают сертифицированные права на новое распространение, production или AI-input; лицензии шрифтов и права на изображения этим ревью не удостоверены. Пропорция рамки выше — задача design-reviewer, не второй дублированный finding brand-guard.

## Final overlap repair и legacy findings

Собственным vision просмотрен именно `B-tablet-firstcards.png` из v3: image и текст разделены, растяжения thumbnail поверх тела не видно. Read-only сверка `frozen/overlap-v3.json` даёт восемь карточек на каждой ширине 390/700/701/768/860/899/900/1024/1440, ноль отмеченных пересечений; это corroboration сохранённого receipt, не новый полный прогон этой матрицы мной. Реальное новое DOM-чтение этого ревью покрывает девять комбинаций baseline/A/B × 1440/768/390 для hero.

Читаемый browser receipt содержит 15 состояний: baseline/A/B × desktop 1440, mobile 390, tablet 768, long-RU 390, reduced 390, height 900. Proposal clipping/intersection/overflow списки пусты. Baseline legacy 44px phone/footer против 48px contact threshold и desktop clipping ОСП/Фанера сохранены и не приписываются proposal. Отчёт о 101 Python PASS — свидетельство implementer frozen verification, не независимо запущенный мной regression suite. Code/security, aria, performance и детерминированный линт остаются параллельному technical reviewer; не дублирую их догадками и не заявляю собственного lint PASS.

## Taste: фактически использованное, не новое исследование

По полным frozen README/report: `heroes/split` — приняты разделение текста/предмета и mobile text-before-picture; отклонены фиксированные 900/844 viewport, шкала 72/40, floating fact-card, looping dot и tech effects. `typography/manrope` — принято существующее heading identity и точный открытый рисунок цифр; отклонены all-Manrope body, новые scale/weight/tracking и JetBrains Mono. На снимках видны разделённый hero и сохранённая пара шрифтов, не новый «стиль из библиотеки». Сам lookup не повторялся и свежая reference research не заявляется. Наличие library record не лицензирует font binaries.

## Exact image evidence

Все перечисленные ниже файлы реально открыты через vision; SHA-256 пересчитан и совпал с private frozen evidence manifest. Пути относительно `preview-v3/` private root выше. Full PNG оценивались только как общий ритм при downscale; desktop/mobile top + firstcards, tablet top + firstcards и long-RU firstcards — непосредственная визуальная основа выводов.

| Screenshot | SHA-256 |
|---|---|
| `A-desktop-firstcards.png` | `31c958d7deeef0da403975dccccfdc643f4a2e5a5085f32a3e948a3e40ee275c` |
| `A-desktop-full.png` | `f5c16aba1ee07f16a14eeb9d89c12762251826520832f87678325b4175485d62` |
| `A-desktop-top.png` | `b0e65085824347750e45d7049325bef299e64aaff5adcab7f7d8ccf016775714` |
| `A-long-ru-firstcards.png` | `571b58906272e042c42c3fa98d48dfbf0428b90057d4717294da408c1897deef` |
| `A-mobile-firstcards.png` | `05f490e8d1c7a7cb0a5fa6ddd17d04dbd3994916707513fe1ba1eaa766b8111e` |
| `A-mobile-top.png` | `ab42534ed013a85c93410e51bddfa70ebb1651e6f381ca75f7d2ceac1beaafe5` |
| `A-tablet-firstcards.png` | `9230f35f3f73183d04919402d28f8009f4ffe84748680bbeeefae786621eab64` |
| `A-tablet-top.png` | `49f1694ad8b773d10cd41a6291a8225988cd2843f56fd9d97636d43302c27168` |
| `B-desktop-firstcards.png` | `7bafd9217622ee0a9d97cd396d4a015bc04371b3b571558530b7cccfaa4af182` |
| `B-desktop-full.png` | `67ca7decd2ceea1b88abd7f0d0fc1afe55ac44b4da1d90ab1d4e684f9bb5be65` |
| `B-desktop-top.png` | `91f58d73eac0c81283c84a100cdbc518c0ce398307bc9b7a8c2e567062af25aa` |
| `B-long-ru-firstcards.png` | `0d711527cd2fd8218d0aaa8ce7b6443ab8ea4951715eab685745cae54f9b5d83` |
| `B-mobile-firstcards.png` | `305c1a1bcb0c5deb9802005f1ea2a52c6e2cb273d29f53b0f841031170c6ef69` |
| `B-mobile-full.png` | `7d3e613c8c85c5e11229d95f2b399580a62962c5cf925b9599415228104818ef` |
| `B-mobile-top.png` | `ab42534ed013a85c93410e51bddfa70ebb1651e6f381ca75f7d2ceac1beaafe5` |
| `B-tablet-firstcards.png` | `67aab7d4a7c2d725aa76c61048d62155938285832e291229d698bb71049de19f` |
| `B-tablet-top.png` | `b9fdfddea7c86482a71d5f5f26142f0a1d608ff6b79bdecbb066a2ceb94fbdce` |
| `baseline-desktop-firstcards.png` | `03654781c3cbbf5ebbc807400c4e9bb368ebe59bf45347171742f7db268665ec` |
| `baseline-desktop-top.png` | `f9edb0f263be223c73bd52726a69bec89775be013a9eb186ef3a02b96fd46460` |
| `baseline-mobile-firstcards.png` | `fcb633b549ddf3da5b416ba4d6b4635537cbb0f6ffea738dc8d9352f49795e6b` |
| `baseline-mobile-top.png` | `95e00c7a7c96e33a1f66e5f80d8cda8a820d2cbd69990c88921aaafa68472dbb` |

Дополнительные точные привязки:

- `frozen/evidence-manifest.json` SHA-256 `e2e25ff5b36f125a22022f6e0fdd1e16a0f55319fa57036737e2b496f3818f57`.
- `frozen/overlap-v3.json` SHA-256 `112f1af469d55a460433ab02660170b93dac2be21e31678f73c5d4517524ac56`.
- `preview-v3/browser-receipt.json` SHA-256 `d0ad4d4dd62ef01540f0f80d620c5e03eb0aeb1d2dfcf370857f21f94a33e6aa`.

## Ограничения и следующий gate

Это статическое visual review реальных локальных browser captures плюс ограниченная DOM-проверка, не физический телефон/планшет, солнце/перчатки, Safari/Firefox/cross-browser, 200% zoom, exhaustive font cmap, contrast measurement, temporal motion acceptance, права или актуальное складское подтверждение. Long-RU — искусственная стресс-строка, не клиентская коммерческая копия. Reduced-motion receipt прочитан, но отдельные reduced PNG мной не открывались; их полноценное визуальное/временное одобрение не заявляется.

B рекомендован, A остаётся содержательной альтернативой. После разрешения ratio finding нужен повторный affected visual review. Выбор владельца A/B, approval исключений/прав и owner acceptance **PENDING**. Production, публикация и deployment не разрешены этим документом.

Изменён только этот review report. Source, Git metadata, assets, fixtures и исходные receipts не изменялись; установки, платные операции и deploy не выполнялись. Одна вспомогательная попытка чтения CSS/JSON завершилась tool timeout; данные затем получены read-only другим способом, DOM-проверка реально завершилась успешно.
