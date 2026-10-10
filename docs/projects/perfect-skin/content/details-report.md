# Описания товаров: сопоставление с сайтом

Исходники: `source/` (см. `SOURCES.md`). Файлы строит `npm run parse:client-docx` в `server/`; повторный прогон не меняет выход.

## Итоги

- Позиций в файлах клиента: 77 (товаров 76, дополнений 1)
- Товаров на сайте: 81 (розница 57, кабинетные 24)
- Совпало с текстом: 63 (розница 40, кабинетные 23)
- Товаров сайта без текста: 18 (розница 17, кабинетные 1)
- Позиций из файлов, которых нет на сайте (отложено в `_pending/`): 9
- Неоднозначных и конфликтов: 0
- Предупреждений: 12
- Подозрительных мест в тексте: 26

## Совпало: slug ← источник (63)

- `3-flower-serum-multi-uvlazhnyayushhaya-syvorotka` ← isseimi-part3.docx «3 FLOWER SERUM Мульти увлажняющая сыворотка» [Объем: 30 мл] (primary)
- `365-night-repair-cream-obnovlyayushhij-krem-s-vinogradnymi-kislotami` ← isseimi-part3.docx «365 NIGHT REPAIR CREAM Обновляющий крем с виноградными кислотами» [Объем: 50 мл] (primary)
- `acido-glicolico-eksfoliiruyuschiy-eliksir-s-glikolevoy-kislotoy` ← isseimi-part3.docx «ÁCIDO GLICOLICO Эксфолиирующий эликсир с гликолевой кислотой» [30 мл] (primary)
- `acido-hialuronico-peptidos-hidrosoluble-syvorotka-s-gialuronovoy-kislotoy` ← isseimi-part3.docx «Acido Hialuronico + Peptidos Hidrosoluble – Сыворотка с гиалуроновой кислотой» [Флакон с пипеткой 50 мл] (primary)
- `acido-kojico-eksfoliiruyuschiy-eliksir-s-koyevoy-kislotoy` ← isseimi-part3.docx «ACIDO KOJICO Эксфолиирующий эликсир с койевой кислотой» [30 мл] (primary)
- `acido-lactico-eksfoliiruyuschiy-eliksir-s-molochnoy-kislotoy` ← isseimi-part3.docx «ACIDO LACTICO Эксфолиирующий эликсир с молочной кислотой» [30 мл] (primary)
- `acido-mandelico-eksfoliiruyuschiy-eliksir-s-mindalnoy-kislotoy` ← isseimi-part3.docx «ACIDO MANDELICO Эксфолиирующий эликсир с миндальной кислотой» [30 мл] (primary)
- `acido-piruvico-eksfoliiruyuschiy-eliksir-s-pirovinogradnoy-kislotoy` ← isseimi-part3.docx «ACIDO PIRUVICO Эксфолиирующий эликсир с пировиноградной кислотой» [30 мл] (primary)
- `advance-repair-obnovlyayuschiy-krem` ← isseimi-part3.docx «Advance Repair Обновляющий крем» [200 мл] (primary)
- `antiox-c-antioksidantnyj-krem` ← glacee.docx «ANTIOX-C – Антиоксидантный крем с инкапсулированным озоном и витамином С» [50 мл.] (primary)
- `aqua-o3-whitening-depigmentiruyuschaya-syvorotka-s-ozonom` ← isseimi-part3.docx «Aqua O3 Whitening Депигментирующая сыворотка с озоном» [5 флаконов по 5 мл] (primary)
- `aquao3-firming-syvorotka-s-ozonom-liftingovyy-kontsentrat` ← isseimi-part3.docx «AQUA O3 FIRMING УКРЕПЛЯЮЩИЙ КОКТЕЙЛЬ ДЛЯ ЛИЦА» [5 флаконов по 5 мл] (primary)
- `aquao3-gf-antiaging-syvorotka-s-ozonom-omolazhivayuschiy-kontsentrat` ← isseimi-part3.docx «AQUA O3 ANTIAGING – Регенерирующая сыворотка с озоном» [5 флаконов по 5 мл] (primary)
- `aquao3-lipo-syvorotka-s-ozonom-lipoliticheskiy-kontsentrat` ← isseimi-part3.docx «АQUA O3 LIPO - АНТИЦЕЛЛЮЛИТНЫЙ КОКТЕЙЛЬ» [5 флаконов по 5 мл] (primary)
- `aquao3-repair-syvorotka-s-ozonom-vosstanavlivayuschiy-kontsentrat` ← isseimi-part3.docx «АQUA O3 REPAIR Коктейль против рубцов и растяжек» [5 флаконов по 5 мл] (primary)
- `balance-toner-tonik-s-morskoj-termalnoj-vodoj` ← glacee.docx «ВALANCE TONER – Балансирующий тоник с морской термальной водой» [250 мл.] (primary)
- `baobab-oil-illuminator-and-repairer-vosstanavlivayushhee-maslo-baobaba` ← isseimi-part3.docx «BAOBAB OIL ILLUMINATOR AND REPAIRER Восстанавливающее масло баобаба» [Объем: 30 мл] (primary)
- `bee-venom-cream-antivozrastnoj-krem` ← isseimi-part2.docx «BEE VENOM CREAM – Антивозрастной крем» [Объем: 50 мл] (primary)
- `biocell-syvorotka-obnovlyayushhaya` ← isseimi-part3.docx «BIOCELL СЫВОРОТКА ОБНОВЛЯЮЩАЯ» [Объем: 30 мл] (primary)
- `charcoal-mask-maska-s-ugolnym-poroshkom-alginatnaya` ← isseimi-part3.docx «CHARCOAL MASK Маска с угольным порошком» [Объем: 200 мл] (primary)
- `chia-detox-cream-uvlazhnyayushhij-krem-s-chia` ← isseimi-part3.docx «CHIA DETOX CREAM Увлажняющий крем с чиа» [Объем: 50 мл] (primary)
- `collagen-booster-vosstanavlivayushhaya-syvorotka` ← isseimi-part1.docx «COLLAGEN BOOSTER -ВОССТАНАВЛИВАЮЩАЯ СЫВОРОТКА» [Объем: Флакон с пипеткой, 30 мл] (primary)
- `contour-k-krem-dlya-glaz` ← glacee.docx «CONTOUR-K – Легкий восстанавливающий крем для контура глаз с витамином К1» [15 мл] (primary)
- `crema-elite-ultra-uvlazhnyayushhij-krem` ← isseimi-part1.docx «CREMA ELITE – УЛЬТРА УВЛАЖНЯЮЩИЙ КРЕМ» [Объем: 50 мл] (primary); isseimi-part3.docx «Crema Elite – Ультраувлажняющий крем» [200 мл] (cabinet)
- `dinamizante-vosstanavlivayushhij-krem` ← glacee.docx «DINAMIZANTE Восстанавливающий крем» [50 мл] (primary)
- `egf-hidrosoluble-syvorotka-s-epidermalnym-faktorom-rosta` ← isseimi-part3.docx «EGF Hidrosoluble – Сыворотка с Эпидермальным Фактором Роста» [Флакон с пипеткой 50 мл] (primary)
- `emulsion-higienizante-krem-skrab-dlya-snyatiya-makiyazha` ← isseimi-part1.docx «EMULSION HIGIENIZANTE - Крем-скраб для снятия макияжа» [Объем: 200 мл] (primary); isseimi-part3.docx «EMULSION HIGIENIZANTE - Крем-скраб для снятия макияжа» [Объем: 1000 мл] (cabinet)
- `energel-ochishhayushhij-gel-s-morskoj-termalnoj-vodoj` ← glacee.docx «ENERGEL Очищающий гель с морской термальной водой» [250 мл] (primary)
- `eye-resistance-krem-dlya-glaz` ← glacee.docx «EYE RESISTANCE – Укрепляющий крем для кожи вокруг глаз» [15 мл.] (primary)
- `fgf-hidrosoluble-syvorotka-s-faktorom-rosta-fibroblastov` ← isseimi-part3.docx «FGF Hidrosoluble – Сыворотка с Фактором Роста Фибробластов» [Флакон с пипеткой 50 мл] (primary)
- `fluido-viscoso-forte-syvorotka-obnovlyayushhaya` ← isseimi-part2.docx «FLUIDO VISCOSO FORTE – Обновляющая сыворотка» [Объем: 30 мл] (primary)
- `fluvix-syvorotka-obnovlyayushhaya` ← isseimi-part3.docx «FLUVIX СЫВОРОТКА ОБНОВЛЯЮЩАЯ» [Объем 15 мл.] (primary); isseimi-part3.docx «FLUVIX СЫВОРОТКА ОБНОВЛЯЮЩАЯ» [Объем 30 мл.] (cabinet)
- `gen-adn-ukreplyayushhij-krem` ← glacee.docx «GEN ADN – Укрепляющий крем-гель с эффектом лифтинга и ДНК-защиты» [50 мл] (primary)
- `hidrorrenovadora-krem-dlya-stimulirovaniya-tkanej` ← isseimi-part3.docx «HIDRORRENOVADORA КРЕМ ДЛЯ СТИМУЛИРОВАНИЯ ТКАНЕЙ» [Объем 50 мл] (primary)
- `hidrorrevitalizante-vosstanavlivayushhij-krem` ← glacee.docx «HIDRORREVITALIZANTE Восстанавливающий крем» [50 мл] (primary)
- `hydrocombat-krem-s-ozonom` ← glacee.docx «HYDROCOMBAT – Увлажняющий крем-гель с инкапсулированным озоном» [50 мл.] (primary)
- `jojoba-oil-o3-seboreguliruyushhee-maslo-zhozhoba-s-ozonom` ← isseimi-part3.docx «JOJOBA OIL + O3 Себорегулирующее масло жожоба с озоном» [Объем: 30 мл] (primary)
- `k-b-butter-cream-krem-s-maslami-baobaba-i-karite-dlya-bazovogo-zakrytiya-protsedury-i-massazha` ← isseimi-part3.docx «K & B BUTTER CREAM Крем с баобабом и карите» (primary)
- `kerathor-plus-izotonicheskij-tonik` ← isseimi-part1.docx «KERATHOR PLUS – ИЗОТОНИЧЕСКИЙ ТОНИК» [Объем: 200 мл] (primary); isseimi-part3.docx «В этот препарат KERATHOR PLUS – ИЗОТОНИЧЕСКИЙ ТОНИК» [Объем: 200 мл в СПОСОБ ПРИМЕНЕНИЯ добавить:] (amendment)
- `kgf-gel-acondicionador-vosstanavlivayuschiy-gel-dlya-kozhi` ← isseimi-part3.docx «KGF Gel Acondicionador – Восстанавливающий гель для кожи» [200 мл] (primary)
- `mascarilla-atp-alabastro-alebastrovaya-maska-s-atf` ← isseimi-part3.docx «Mascarilla ATP + Alabastro Энергетическая маска с АТФ и алебастром для лица» [Объем: 200 мл] (primary)
- `mascarilla-peel-off-vitamina-c-maska-s-vitaminom-s-alginatnaya` ← isseimi-part3.docx «PEEL -OFF MASK Маска с витамином С» [Объем: 200 мл] (primary)
- `natural-cleansing-milk-naturalnyj-ochishhayushhij-krem-dlya-licza` ← isseimi-part3.docx «NATURAL CLEANSING MILK Натуральный очищающий крем для лица» [Объем: 500 мл] (primary)
- `nutriestimul-antivozrastnoj-pitatelnyj-krem` ← isseimi-part2.docx «NUTRIESTIMUL – АНТИВОЗРАСНОЙ ПИТАТЕЛЬНЫЙ КРЕМ» [Объем: 50 мл] (primary)
- `o3-depur-krem-s-ozonom` ← isseimi-part2.docx «O3 DEPUR – Крем с озоном» [Объем: 50 мл] (primary)
- `oxioderm-maska-s-ozonom` ← isseimi-part3.docx «OXIODERM Маска с озоном» [Форма: 3 дозы (салфетки) 13х17 см] (primary)
- `peeling-intensivo-intensivnyy-fiziko-himicheskiy-piling` ← isseimi-part3.docx «PEELING INTENSIVO Интенсивный физико-химический пилинг» [100 мл] (primary)
- `pure-marine-water-cream-uvlazhnyayushhij-krem-s-morskoj-vodoj` ← isseimi-part3.docx «PURE MARINE WATER CREAM Увлажняющий крем с морской водой» [Объем: 50 мл] (primary)
- `redensificante-redensificziruyushhij-krem-dlya-zreloj-kozhi` ← glacee.docx «REDENSIFICANTЕ Реденсифицирующий крем для зрелой кожи» [50 мл] (primary)
- `regenerativo-cellular-syvorotka-obnovlyayushhaya` ← isseimi-part2.docx «REGENERATIVO CELLULAR Сыворотка обновляющая» [Объем: флакон с пипеткой, 50 мл] (primary)
- `reti-bogatyj-retinolom-krem` ← glacee.docx «RETI+ – Ночной ремоделирующий крем с ретинолом» [50 мл] (primary)
- `rose-hip-oil-o3-regeneriruyushhee-maslo-shipovnika-s-ozonom` ← isseimi-part3.docx «ROSE HIP OIL + O3 Регенерирующее масло шиповника с озоном» [Объем: 30 мл] (primary)
- `scrub-lotion-krem-dlya-snyatiya-makiyazha` ← isseimi-part3.docx «SCRUB LOTION КРЕМ ДЛЯ СНЯТИЯ МАКИЯЖА» [Объем: 200 мл] (primary)
- `senitul-vosstanavlivayushhaya-maska` ← isseimi-part3.docx «SENITUL ВОССТАНАВЛИВАЮЩАЯ МАСКА» [28х35 см /13х17 см] (primary)
- `serum-triple-accion-syvorotka-trojnogo-dejstviya` ← glacee.docx «SERUM TRIPLE ACCIÓN – Сыворотка тройного действия с комплексом факторов роста» [30 мл] (primary)
- `silicio-organico-peptidos-hidrosoluble-syvorotka-s-organicheskim-kremniem` ← isseimi-part3.docx «Silicio Organico + Peptidos Hidrosoluble – Сыворотка с органическим кремнием» [Флакон с пипеткой 50 мл] (primary)
- `solucion-neutralizante-neytralizuyuschiy-rastvor` ← isseimi-part3.docx «SOLUCION NEUTRALIZANTE Нейтрализующий раствор» [50 мл] (primary)
- `tonico-facial-equilibrante-osvezhayushhij-i-toniziruyushhij-tonik` ← isseimi-part1.docx «TONICO FACIAL EQUILIBRANTE – Освежающий тоник» [Объем: 200 мл] (primary); isseimi-part3.docx «TONICO FACIAL EQUILIBRANTE – Освежающий тоник» [Объем: 1000 мл] (cabinet)
- `tts-energizing-mask-maska-so-stvolovymi-kletkami` ← isseimi-part2.docx «TTS ENERGIZING MASK – Маска со стволовыми клетками» [Монодоза: 1 маска, пропитанная высококонцентрированным активом для регенерации и питания кожи.] (primary)
- `tts-essential-mask-ukreplyayushhaya-i-obnovlyayushhaya-maska` ← isseimi-part2.docx «TTS Essential Mask – Укрепляющая и обновляющая маска» [Монодоза: 1 маска, пропитанная высококонцентрированным лифтинг-активом.] (primary)
- `tts-moisturizing-mask-uvlazhnyayushhaya-maska` ← isseimi-part2.docx «TTS MOISTURIZING MASK - УВЛАЖНЯЮЩАЯ МАСКА» [Монодоза: 1 маска, пропитанная высококонцентрированным активом для глубокого увлажнения кожи.] (primary)
- `veevenom-serum-syvorotka-pchelinyj-yad` ← isseimi-part2.docx «BEE VENOM SERUM – Регенерирующая сыворотка с пчелиным ядом» [Объем: 30 мл (флакон с пипеткой)] (primary)
- `vitamina-c-peptidos-hidrosoluble-syvorotka-s-vitaminom-s` ← isseimi-part3.docx «Vitamina C + Peptidos Hidrosoluble – Сыворотка с витамином С» [Флакон с пипеткой 50 мл] (primary)

## Нет на сайте (отложено, не заводим) (9)

- `4dhyalcross` ← glacee.docx «4D HYAL CROSS – Суперувлажняющая сыворотка с гиалуроновой кислотой» [30 мл.] (primary)
- `blockmelan` ← isseimi-part3.docx «BLOCKMELAN Депигментирующая сыворотка» [30 мл] (primary)
- `cbdnightmask` ← glacee.docx «СBD NIGHT MASK – Ночная восстанавливающая маска с каннабидиолом и мелатонином» [50 мл] (primary)
- `cleansingbalm` ← glacee.docx «CLEANSING BALM – Очищающий бальзам» [200 мл.] (primary)
- `hydraview` ← isseimi-part3.docx «HYDRA VIEW гидра-крем для век» [15 мл] (primary)
- `liposomec` ← glacee.docx «LIPOSOME-C – Антиоксидантная сыворотка» [30 мл.] (primary)
- `purifyingwater` ← glacee.docx «PURIFYING WATER – Мицеллярная очищающая вода с термальными микроэлементами» [200 мл.] (primary)
- `seafoam` ← isseimi-part3.docx «Sea Foam Очищающая пенка с морской водой» [Обьем 150 мл] (primary)
- `ttsbrighteningmask` ← isseimi-part3.docx «TTS BRIGHTENING MASK Депигментирующая маска» [Монодоза: 1 маска, пропитанная высококонцентрированным лифтинг-активом.] (primary)

## Товары сайта без текста (18)

- `bb-cream-matiruyushhij-krem` — BB CREAM Матирующий крем
- `chia-protect-oil-maslo-chia-s-ozonom` — CHIA PROTECT OIL Масло чиа с озоном
- `contorno-de-ojos-md-multiuvlazhnyayushhij-krem-s-peptidami` — CONTORNO DE OJOS MD Мультиувлажняющий крем с пептидами
- `depurative-crema-ochishhayushhij-krem` — DEPURATIVE CREMA Очищающий крем
- `dermosun-spf-50-solnczezashhitnyj-krem` — DERMOSUN SPF 50 Солнцезащитный крем
- `keradetox-keratoliticheskij-tonik` — KERADETOX Кератолитический тоник
- `korpo-slim-crema-anticzellyulitnyj-i-modeliruyushhij-krem` — KORPO SLIM CREMA Антицеллюлитный и моделирующий крем
- `korpo-slim-gel-ukreplyayushhij-gel-dlya-nog` — KORPO SLIM GEL Укрепляющий гель для ног
- `natural-tonic-naturalnyj-tonik-dlya-licza` — NATURAL TONIC Натуральный тоник для лица
- `orange-esential-oil-tsitrusovoe-maslo-chistoe-efirnoe-maslo` — ORANGE ESENTIAL OIL Цитрусовое масло, чистое эфирное масло
- `podarochnyj-nabor-bee-venom-s-pchelinym-yadom-dlya-razglazhivaniya-morshhin-i-ustraneniya-tusklosti-kozhi` — Подарочный набор «Bee Venom» с пчелиным ядом для разглаживания морщин и устранения тусклости кожи
- `podarochnyj-nabor-expert-team-box-1-dlya-glubokogo-ochishheniya-i-uvlazhneniya-kozhi` — Подарочный набор «Expert Team. Box 1» для глубокого очищения и увлажнения кожи
- `podarochnyj-nabor-expert-team-box-2-dlya-tonizaczii-kozhi-i-ustraneniya-otekov-krugov-vokrug-glaz` — Подарочный набор «Expert Team. Box 2» для тонизации кожи и устранения отеков кругов вокруг глаз
- `podarochnyj-nabor-expert-team-full-box-dlya-uhoda-za-muzhskoj-kozhej` — Подарочный набор «Expert Team. Full Box» для ухода за мужской кожей
- `podarochnyj-nabor-obnovlennaya-kozha-dlya-korrekczii-vozrastnyh-izmenenij-kozhi-licza-i-vek` — Подарочный набор «Обновленная кожа» для коррекции возрастных изменений кожи лица и век
- `podarochnyj-nabor-obnovlennaya-kozha-dlya-liftinga-i-ukrepleniya-kozhi` — Подарочный набор «Обновленная кожа» для лифтинга и укрепления кожи
- `sontorno-de-ojos-multiuvlazhnyayushhij-krem-dlya-vek-s-peptidami` — СONTORNO DE OJOS Мультиувлажняющий крем для век с пептидами
- `tts-o3-ozono-kislorodnaya-maska-s-ozonom` — TTS O3 OZONO Кислородная маска с озоном

## Неоднозначные и конфликты (0)

Нет.

## Применённые правила (21)

- алиас «peeloffmask» → mascarilla-peel-off-vitamina-c-maska-s-vitaminom-s-alginatnaya
- isseimi-part3.docx: «PEEL -OFF MASK» → mascarilla-peel-off-vitamina-c-maska-s-vitaminom-s-alginatnaya (алиас)
- isseimi-part3.docx: дополнение «В этот препарат KERATHOR PLUS – ИЗОТОНИЧЕСКИЙ ТОНИК» → usage.notes товара kerathor-plus-izotonicheskij-tonik
- isseimi-part2.docx: строка-продолжение склеена с предыдущим пунктом «как работает»
- isseimi-part3.docx: FLUVIX 15 мл: обрезана вклейка 30 мл (12 строк)
- isseimi-part3.docx: строка-продолжение склеена с предыдущим пунктом «как работает»
- isseimi-part1.docx: маркеры 💡 ◀ • удалены (10)
- isseimi-part1.docx: неразрывные пробелы заменены на обычные (2)
- isseimi-part2.docx: маркеры 💡 ◀ • удалены (13)
- isseimi-part2.docx: мусор Word «Конец формы»/«Начало формы» удалён (4)
- isseimi-part2.docx: неразрывные пробелы заменены на обычные (4)
- isseimi-part3.docx: маркеры 💡 ◀ • удалены (14)
- isseimi-part3.docx: неразрывные пробелы заменены на обычные (10)
- isseimi-part3.docx: «ПРЕПАРАТЫ ДЛЯ ПРОФЕССИОНАЛЬНОГО ПРИМЕНЕНИЯ» — маркер зоны, не товар (1)
- isseimi-part3.docx: «Подобные маски уже были в Части 2» пропущено (1)
- glacee.docx: маркеры 💡 ◀ • удалены (14)
- glacee.docx: неразрывные пробелы заменены на обычные (1)
- Заголовки и маркеры: NBSP и повторные пробелы схлопнуты, маркеры 💡 ◀ • удалены, текст не правился
- Строки «…» и точек — границы блоков; INCI («Состав (INCI)») не сохраняется
- Заголовки секций: регистр, ё, латинская C вместо кириллической С («Cпособ» → «Способ»), двоеточие необязательно
- Двойные «Кому подойдёт», «Как работает» и «Активные ингредиенты» в одном блоке — слиты без дублей

## Не сопоставлено с текстом из файла: строки вне товаров (0)

Нет.

## Предупреждения (12)

- acido-piruvico-eksfoliiruyuschiy-eliksir-s-pirovinogradnoy-kislotoy: isseimi-part3.docx: повтор секции «Ключевые механизмы действия» — слита с предыдущей
- bee-venom-cream-antivozrastnoj-krem: isseimi-part2.docx: повтор секции «Как это работает» — слита с предыдущей
- crema-elite-ultra-uvlazhnyayushhij-krem: isseimi-part3.docx: повтор секции «Ключевые механизмы действия» — слита с предыдущей
- egf-hidrosoluble-syvorotka-s-epidermalnym-faktorom-rosta: isseimi-part3.docx: повтор секции «Ключевые механизмы действия» — слита с предыдущей
- emulsion-higienizante-krem-skrab-dlya-snyatiya-makiyazha: isseimi-part1.docx: лайфхак без текста: заголовок есть, абзацев нет
- fluvix-syvorotka-obnovlyayushhaya: isseimi-part3.docx: повтор секции «КОМУ ПОДОЙДЕТ» — слита с предыдущей
- hydrocombat-krem-s-ozonom: glacee.docx: повтор секции «КОМУ ПОДОЙДЕТ» — слита с предыдущей
- k-b-butter-cream-krem-s-maslami-baobaba-i-karite-dlya-bazovogo-zakrytiya-protsedury-i-massazha: isseimi-part3.docx: в файле нет строки объёма: объём берётся из прайса
- kerathor-plus-izotonicheskij-tonik: isseimi-part1.docx: повтор секции «АКТИВНЫЕ ИНГРЕДИЕНТЫ» — слита с предыдущей
- natural-cleansing-milk-naturalnyj-ochishhayushhij-krem-dlya-licza: основной записи нет: кабинетная фасовка «500 мл» стала основной, её применение — в pro.usage
- nutriestimul-antivozrastnoj-pitatelnyj-krem: isseimi-part2.docx: повтор секции «АКТИВНЫЕ ИНГРЕДИЕНТЫ» — слита с предыдущей
- regenerativo-cellular-syvorotka-obnovlyayushhaya: isseimi-part2.docx: объём в файле «50 мл», на сайте «30» — записано как основная

## Подозрительные места в тексте клиента (не исправлялись) (26)

- isseimi-part2.docx «NUTRIESTIMUL – АНТИВОЗРАСНОЙ ПИТАТЕЛЬНЫЙ КРЕМ»: «АНТИВОЗРАСНОЙ» — вероятно «АНТИВОЗРАСТНОЙ»
- isseimi-part2.docx «TTS MOISTURIZING MASK - УВЛАЖНЯЮЩАЯ МАСКА»: «Витамие» — вероятно «Витамин»
- isseimi-part3.docx «3 FLOWER SERUM Мульти увлажняющая сыворотка»: пробел перед знаком: «…РИМЕНЕНИЯ | Нанесите .4–6 капель сы…»
- isseimi-part3.docx «Sea Foam Очищающая пенка с морской водой»: «Обьем» — в остальных местах «Объем»
- isseimi-part3.docx «OXIODERM Маска с озоном»: «в соответствие с» — вероятно «в соответствии с»
- isseimi-part3.docx «OXIODERM Маска с озоном»: смесь алфавитов в слове «Oзон»
- isseimi-part3.docx «OXIODERM Маска с озоном»: пробел перед знаком: «… маска-дермокомпресс , разработанна…»
- isseimi-part3.docx «PEEL -OFF MASK Маска с витамином С»: пробел перед знаком: «…лубокое увлажнение | .Альгинатная м…»
- isseimi-part3.docx «CHARCOAL MASK Маска с угольным порошком»: пробел перед знаком: «…жение снизу вверх. | . …………………………………»
- isseimi-part3.docx «KGF Gel Acondicionador – Восстанавливающий гель для кожи»: «в соответствие с» — вероятно «в соответствии с»
- isseimi-part3.docx «АQUA O3 REPAIR Коктейль против рубцов и растяжек»: смесь алфавитов в слове «АQUA»
- isseimi-part3.docx «АQUA O3 LIPO - АНТИЦЕЛЛЮЛИТНЫЙ КОКТЕЙЛЬ»: смесь алфавитов в слове «АQUA»
- isseimi-part3.docx «PEELING INTENSIVO Интенсивный физико-химический пилинг»: «элексир» — вероятно «эликсир»
- isseimi-part3.docx «ACIDO MANDELICO Эксфолиирующий эликсир с миндальной кислотой»: «элексир» — вероятно «эликсир»
- isseimi-part3.docx «ACIDO MANDELICO Эксфолиирующий эликсир с миндальной кислотой»: смесь алфавитов в слове «себостазa»
- isseimi-part3.docx «ÁCIDO GLICOLICO Эксфолиирующий эликсир с гликолевой кислотой»: «элексир» — вероятно «эликсир»
- isseimi-part3.docx «ACIDO LACTICO Эксфолиирующий эликсир с молочной кислотой»: «элексир» — вероятно «эликсир»
- isseimi-part3.docx «ACIDO PIRUVICO Эксфолиирующий эликсир с пировиноградной кислотой»: «элексир» — вероятно «эликсир»
- isseimi-part3.docx «ACIDO KOJICO Эксфолиирующий эликсир с койевой кислотой»: «элексир» — вероятно «эликсир»
- isseimi-part3.docx «В этот препарат KERATHOR PLUS – ИЗОТОНИЧЕСКИЙ ТОНИК»: «в соответствие с» — вероятно «в соответствии с»
- glacee.docx «4D HYAL CROSS – Суперувлажняющая сыворотка с гиалуроновой кислотой»: нет пробела после знака: «…мального барьера.Эта сверхлегкая, н…»
- glacee.docx «СBD NIGHT MASK – Ночная восстанавливающая маска с каннабидиолом и мелатонином»: смесь алфавитов в слове «СBD»
- glacee.docx «REDENSIFICANTЕ Реденсифицирующий крем для зрелой кожи»: смесь алфавитов в слове «REDENSIFICANTЕ»
- glacee.docx «ANTIOX-C – Антиоксидантный крем с инкапсулированным озоном и витамином С»: пробел перед знаком: «…Сыворотку Liposome-C . Сыворотка ус…»
- glacee.docx «GEN ADN – Укрепляющий крем-гель с эффектом лифтинга и ДНК-защиты»: пробел перед знаком: «…отками TRIPLE ACCIÓN . Нанесение сы…»
- glacee.docx «ВALANCE TONER – Балансирующий тоник с морской термальной водой»: смесь алфавитов в слове «ВALANCE»

