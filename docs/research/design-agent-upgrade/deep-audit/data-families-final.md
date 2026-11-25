# Библиотеки данных Impeccable и Taste: восстановленная итоговая сводка

## Метод и границы

Это восстановление сохранённого результата data-family задания после provider403, а не повторный запуск upstream. Сохранились `data-families-final-coverage.json`, scratch `data_family_probe.py` и `data-family-probe-output.txt`. Координатор прочитал код probe и его вывод, независимо пересчитал SHA-256 всех **988** ledger rows — совпадение для каждой записи; отдельно изучил примеры записей и ограничения словарей. Файл `data_family_probe.py` не импортировался и upstream scripts не исполнялись. Метки `full` для семантического чтения — свидетельство составителя ledger; независимая проверка hashes сама по себе их не доказывает. Структурные проверки описаны отдельно от ручного/визуального чтения.

Ledger содержит upstream и три локальных comparator. Не складывать его 988 rows с другими ledger как уникальное покрытие. В merged ledger требуется дедупликация по repo/path и верификация byte aliases.

## 1. Impeccable: font-index — инструмент подбора, не каталог лицензий

Canonical: `skill/scripts/data/font-index.json`, schema2. В сохранённой проверке: **2 041** entries, **1 922** families, **36** features, три измеренных образца (`48`, `14`, `48c`). Каждая packed запись имеет длину8; проверенные feature strings декодируются в36 значений, badRows/badCats/badWeight/badItalic равны0. Отдельный failures содержит127 семей, **71** из них также представлены в index: наличие имени в failures не означает полное отсутствие рабочего начертания.

- `text` и `textCaps` — латинские образцы. Это не доказательство кириллического покрытия, кернинга RU и корректного русского hero.
- В records нет самостоятельного юридического разрешения на каждый шрифт, glyph coverage, исходных font URLs или доказанной лицензии конкретного downloaded binary. Репозиторная лицензия не заменяет лицензию шрифта.
- **25** одноимённых font-index копий побайтово совпадают с canonical. Они не являются25 независимыми библиотеками.
- Индекс подходит как опциональный помощник поиска похожих форм/метрик, но не как новый источник утверждённой типографики Friday. Его producer/consumer implementation рассмотрены в runtime/closure отчётах.

**Дельта Friday:** расширять `typography-pairs.md` по реальным задачам: display/body/UI/mono, язык, веса, fallback, origin/license, загрузка и sample длинного RU заголовка. Утверждённая пара важнее similarity score. Автоматическая замена шрифта без проверки brand/layout недопустима.

## 2. Taste: положительная библиотека, которую стоит адаптировать

В отличие от одних anti-pattern запретов, данные Taste описывают допустимые композиции, область применимости, реальные материалы и стоимость движения.

| Семейство | Проверенное содержимое | Что извлекать для Friday |
|---|---|---|
| `library/palettes.json` |64 palettes; уникальные IDs и корректные проверенные hex. Роли bg/surface/ink/muted/accent/accentInk, отрасли, notes и seenIn | Библиотека положительных направлений и rationale. Проверять контраст фактически используемых состояний; validhex не означает WCAG PASS |
| `library/type.json` |39 records: display/text/mono, веса, классы, moods, kinds, tracking/stretch/scale | Рецепты по роли и брифу, не рандомная смена утверждённого brand-font. В `letters` встречаются и строка, и массив: адаптер должен учитывать схему |
| `assets/layout/heroes.json` |11 hero records, business type/material applicability, demo files и четыре viewport-образца | Семейства композиции и условия выбора: нужная фотография/UI/film/object, fallback. Не переносить обязательные100svh, header72/56 и другие house numbers глобально |
| `assets/diagrams/presets.json` |27 diagram presets, layout и семантические связи, labels/icons; schema без дубликатов IDs | Фактологичные объяснения процессов. Все имена, числа, подписи и связи заменяются данными клиента |
| `assets/effects/index.json` |25 effects с cost, family, parameters | Curated opt-in effects: один осмысленный визуальный приём, а не обязательный эффект на каждом сайте |
| `assets/moments/index.json` |18 moments, из них13 dealt; trigger, needs, avoidWith, reduced/phone | Контракт запуска/остановки и совместимость. Retired и weight0 нельзя возвращать в общий sampler лишь потому, что запись существует |
| `assets/scenes/index.json` |11 больших сцен; fits/types/needs; limits и still/light fallback | Семантический выбор сцен с ограничениями по содержанию, телефону, reduced motion и GPU |
| `assets/ui/index.json` |19 fragments; единый loop/still/cycles контракт | Обучающие UI-демонстрации с осмысленными состояниями, pause и неподвижным fallback; demo-данные не бизнес-истина |
| print-core / legacy `_scenes` |9 code objects и5 legacy scene objects | Точное соответствие объекту клиента. Часть legacy entries прямо gallery-only; `suits` сам по себе не разрешает production use |
| product-render specs |3 спецификации: city-bike, desk-lamp, robot-arm; parts/materials/views/props/motion | Пример машиночитаемого product scene contract; не подмена реальной упаковки/геометрии Perfect Skin generic3D объектом |
| backgrounds index |16 grounds; section/type/texture ограничения | Разделять технический фон, визуальный эффект и читаемую зону текста; переносить выборочно |

### Проверки данных и ограничения интерпретации

- Для photos index: **413** уникальныхIDs, fields/alt/source/license/dimensions/focus проверены структурно. Зафиксированы metadata-лицензии:267 Unsplash,53 CC BY-SA4.0,31 CC0,31 PublicDomain,17 CC BY-SA3.0,14 CC BY4.0. Это сведения upstream, не независимая юридическая экспертиза сайтов-источников.
- Коллекции icons/logos имеют2 121 records в общем индексе; map brands/marks —1 117, credits —215. Проверка локальных ссылок показала2117 существующих paths и4 ожидаемо отсутствующих `_.svg`. Это placeholder state, не четыре доказанных production дефекта.
- Drawing XML:466 SVG, parse errors0, по проверенному набору нет scripts/foreignObject/event-handler attributes и внешних href. Наличие валидногоXML не означает хорошего рисунка, визуального QA или полной защиты всех возможных SVG vectors.
- Data fields:128 arrow files;268 conventional field IDs и2 composite-embedded IDs из270 разобраны проверкой. Для2 entries нет отдельного standalone SVG — это не автоматически broken runtime.
- В простом registry cross-check всплыли возможные unresolved `ui:pen-line`, `grid-etch` и filename differences scene CSS/motion. Пока не пройден resolver/fallback, это **кандидаты проверки**, не подтверждённые runtime defects.
- `Land.js` —205 географических records, bounds и invalid country coords проверены; это classified geodata, не вручную прочитанная логика анимации. Реализации, использующие геоданные, рассматриваются отдельно.
- В нескольких индексах встречается non-existent license-like reference: `OFL-1.1` — identifier лицензии, не обязательный локальный файл. Нельзя превращать это в утверждение «библиотека нелицензирована».
- Пакеты demo photos/credits проверены на структуру/существование. Здесь **не выполнена визуальная оценка всех413 фотографий**, сетевой правовой аудит каждой иконки или браузерный запуск всех scenes. Все такие данные остаются classified/metadata, не semantic-full.

## 3. Сравнение с Friday и предлагаемый перенос

Friday уже имеет `typography-pairs.md`, `design-profiles.md` и Nullume descriptors; отсутствие буквально `library/type.json` не означает отсутствия типографики. Новое в Taste — глубина positive choices и привязка композиции к типу бизнеса/доступным материалам, не сами слова «палитра», «hero» или «motion».

1. **Для taste-curator/design-system:** адаптировать компактную positive library с provenance, examples, applicability и reject-if. Не ставить весь sampler/lint глобально.
2. **Для layout:** добавить композиционные семейства с обязательными input assets и контентным смыслом. Сначала реальный текст клиента, потом выбор layout. Hero100svh и запреты overlays — house presets, не аксиомы.
3. **Для copy:** сохранить voice/редакторские приёмы, но удалить demo claims, чужие имена, цены, testimonials и метрики; непроверенные факты не генерировать «ради убедительности».
4. **Для motion:** расширять storyboard/trigger/stop/fallback evidence. Budget в registry — политика кооперативного runtime, не доказательство hard GPU cap.
5. **Для материалов:** единый source/license/attribution/allowed-use manifest; brand assets и client packaging не заменять generic libraries. Новые фактические rights checks нужны перед публикацией, не задним числом.

## Итог

**Taste включить в план как отдельный источник содержательных улучшений**, а не исключать из-за спорных defaults. Переносить выбранные recipes и positive libraries в существующие роли; approved tokens и факты клиента имеют приоритет. Impeccable font index — опциональный инструмент, не срочная установка и не готовый RU-font/rights registry. Ни skills, ни библиотеки, ни новые роли этим отчётом не установлены.
