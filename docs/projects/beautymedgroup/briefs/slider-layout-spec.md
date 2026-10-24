# Спек раскладки: три баннера слайдера главной (А, Б, В)

Читаю это как: промо-слайдер на главной B2B-дистрибьютора космецевтики для
косметологов. Вайб — чистый клинический премиум. V/M/D = 4/2/3 (лёгкая
асимметрия: текст слева, товар справа; без анимаций; много воздуха).

Источник правил — `slider-banners.md` (ТЗ), `../brand.md`. Этот файл —
исполнимый спек: по нему готовится подложка, запускается nano-banana-edit,
вырезается фон и сдаётся PNG без участия дизайнера.

Пути ниже даны от `docs/projects/beautymedgroup/`.

Редакция 2 (24.10): решение Германа по заголовку А (§1), сверка с пинами
Hermes (§12) — замены в А, Б, В; зона «Т» расширена до 40% (§2).

---

## 0. Что измерено на сайте (а не угадано)

Стили темы (`themes/beauty/assets/css/style.css`) скачаны, слайд собран
локально и снят на 7 ширинах. Совпадение с живым сайтом — до пикселя.
Снимки: `media/site/mock-zones-on-site.png` (зоны поверх слайда),
`media/site/mock-title-a-collision.png` (заголовок А на 1440/1280/1024).

**Поправка к постановке:** розовая плашка `#FFF1F4` лежит под **текстом**.
Под картинкой — **серый блок `#E9E9E9`**, в его правом нижнем углу розовые
дуги розы `#FFD9DF` (SVG). Картинка прижата к низу серого блока и торчит
над ним вверх.

| Ширина | Как выводится большая картинка | Что под ней |
|---|---|---|
| ≥ 1700 | 900×616 (из файла 867 — растяжение по ширине на 3,8%), прижата к **левому** низу серого блока; справа от неё ещё ~120 px серого с розой | верхние 10% — над белым фоном |
| 1301–1699 | ширина 668 px, высота по пропорции, прижата к **правому** низу блока и к правому краю экрана | верхние 26–31% — над розовой плашкой (левее 64–71% ширины картинки) и над белым (правее) |
| 1001–1300 | 55% ширины экрана | то же, полоса 25–31% |
| 744–1000 | 54% ширины экрана | полоса ~12% |
| < 744 | фиксированно 360 px, от x = 44 px; на телефоне 360 px правые 12% уходят за экран; верхние 30% наползают на кнопку «Подробнее» (видно и на живом сайте — кисть пересекает кнопку) | — |

Превью 251×212: на 744–1699 — `top:332; left:64` внутри розовой плашки, на
≥ 1700 — справа от текста, **налезает на левый край большой картинки**
(x 0–12%, y 42–75% её кадра). На телефоне — 147×124 справа, на розовом.

Текущий визуальный язык слайдера: товары вырезаны, стоят на **нижней кромке**
кадра, без теней, картинка заполнена плотно. Серию держим в нём же.

---

## 1. Блокеры до генерации (без них картинка не спасёт слайд)

1. **Заголовок А — решено (Герман, 24.10): два уровня в одном поле, текст
   не сокращаем.** Исходная проблема: 79 знаков одним размером на 1440 дают
   4 строки и кружок превью закрывает «Подробнее», на 1024–1280 кнопка
   закрыта целиком, на ≥ 1700 кнопка выпадает из плашки
   (`media/site/mock-title-a-collision.png`).
   Решение — крупная строка-крючок и подзаголовок мельче, **только инлайн-
   стилем внутри поля**, без «Дополнительных стилей». Размер подзаголовка в
   `em` — он сам следует за брейкпоинтами темы (48 → 43 → 36 → 24 px):
   21,6 px на 1301–1699, 19,4 px на ≥ 1700, 16,2 px на 744–1000, не меньше
   15 px на телефоне (`max()`).

   **Значение поля `nazvanie` для А (вставлять как есть):**

   `Такого вы ещё не&nbsp;видели!<span style="display:block;margin-top:.35em;font-size:max(.45em,15px);line-height:1.3">Модифицированный пилинг Джесснера для любого типа&nbsp;кожи</span>`

   Проверено на локальном макете со стилями темы, 7 ширин, координаты
   сняты скриптом (снимок — `media/site/mock-title-a-two-level.png`):

   | Ширина | Строки (крупно + мелко) | Кнопка в плашке | Кнопка и кружок |
   |---|---|---|---|
   | 1920 | 2 + 3 | да, 48 px до края | кружок сбоку, не задевает |
   | 1440 | 1 + 1 | да | зазор 98 px |
   | 1280 | 2 + 2 | да | зазор 14 px |
   | 1024 | 2 + 2 | да | зазор 14 px |
   | 834 | 2 + 2 | да | зазор 50 px |
   | 390 | 2 + 2 | да | кружок справа, зазор 98 px |
   | 360 | 2 + 2 | да | зазор 84 px |

   `&nbsp;` держит «не видели!» и «типа кожи» вместе — без висячих слов.
   На 1001–1300 вторая строка подзаголовка подходит к картинке на 38–40%
   её ширины — поэтому зона «Т» в §2 расширена до 40%. После вставки через
   REST проверить GET-ом, что `style` и `&nbsp;` сохранились (у
   администратора `unfiltered_html` — должны), и посмотреть страницу.
2. **ВАЖНО (P5) — заголовок Б на 1024–1280 даёт 4 строки, превью ложится
   на кнопку.** Лечится одной строкой в «Дополнительных стилях» (проверено
   на макете для Б и В на всех ширинах):
   `@media (min-width:744px) and (max-width:1699px){.product__name{font-size:40px;line-height:48px}}`
   `@media (min-width:1700px){.product__name{font-size:36px;line-height:44px;margin-bottom:32px}}`
   С этими строками крупная строка А на 1024–1300 станет 40 px и уложится в
   одну строку — значение поля А менять не нужно, оно работает и с ними, и
   без них.
   Инлайн-вариант для Б, если строки в «Дополнительные стили» ставить не
   хотят (проверен на 7 ширинах: кнопка в плашке, кружок не задевает; на
   1920 кнопка встаёт ровно на нижний край плашки):
   `<span style="display:block;font-size:max(.75em,22px);line-height:1.2">Стерильные сыворотки для фракционной мезотерапии с&nbsp;пептидами и&nbsp;озоном</span>`
   Минус инлайна: на 1440 заголовок Б будет 36 px против 48 у соседних
   слайдов. CSS-строки меняют все слайды одинаково — для Б предпочтительнее.
3. **ВАЖНО — фото коробки AQUA O3 WHITENING похоже на подделку-макет.**
   Строка свойств на коробке слово в слово как у ANTIAGING («Líneas de
   expresión | Hidratación | Redensificación»), а «WHITENING» на флаконах
   набрано другим, жирным гротеском, чем «AQUA O3». Похоже, кадр собран из
   ANTIAGING заменой названия. Уточнить у клиента настоящий пэкшот Whitening
   до генерации: в баннер нельзя ставить коробку с чужими свойствами.
4. **КАЧЕСТВО — неразрывные пробелы в заголовках:** «с&nbsp;пептидами»,
   «и&nbsp;озоном», «с&nbsp;эффектом» — иначе предлог висит в конце строки
   (видно на 1440 у Б).

---

## 2. Сетка кадра 867×616 (общая для А, Б, В)

Наглядно: `media/site/slider-zones-867x616.png` (прозрачный PNG, класть
поверх результата для приёмки). Координаты — в процентах от кадра, x слева,
y сверху.

| Зона | Где | Правило | Откуда взялось |
|---|---|---|---|
| **Т — под текст** (красная) | x 0–40%, y 0–45% | пусто, только прозрачность | на 1001–1300 строки заголовка заходят в картинку до 40% ширины (у 1024) и до 34% высоты (у 1280–1300); запас до 45% — на случай другого заголовка |
| **П — под превью** (красная) | x 0–15%, y 45–78% | пусто | на ≥ 1700 сюда ложится кружок превью |
| **Н — только низкое** (жёлтая) | x 15–40% при y > 58%; x 0–15% при y > 78% | только низкие плотные объекты: мазок, капля, ломтик | стыкует товар с текстом «лестницей» вниз-влево |
| **Г — герой** (зелёная) | x 40–92%, y 6–100% | главный товар, центр массы на x 55–62% | правее текста, над розой |
| Поля | справа 94–100%, сверху 0–6% | пусто | на ≥ 1700 правый край кадра — не край экрана: срезанный объект будет висеть в воздухе |
| Полупрозрачное | y ≥ 32% | пузырьки, капли, гель, стекло — только ниже линии | выше картинка лежит на розовом/белом, а сгенерированное стекло несёт в себе серый `#E9E9E9` — будет грязное пятно |
| Белое и светлое | верх не выше y 10%; правее x 62% — не выше y 30% | белые тубы, коробки, колпачки | правее 64–71% верхняя полоса лежит на белом фоне — белый край растворится |

Общие правила кадра:
- ничего не режется левым, правым и верхним краем; **нижний край = пол**,
  предметы стоят на нём (последние 1–2 ряда пикселей непрозрачны);
- свободный клин в левом верхнем углу продолжает текстовую колонку, масса
  нарастает к правому низу — взгляд идёт от заголовка по диагонали к товару;
- самый тёмный/контрастный элемент — в зоне Г, не у края.

---

## 3. Конвейер (одинаковый для всех трёх)

nano-banana-edit перерисовывает **весь** кадр, включая этикетку. Поэтому
позицию и упаковку задаёт не промт, а подложка, а настоящий товар
возвращается поверх в конце.

1. **Подложка десктопа** 1248×832 (родной 3:2 nano-banana), заливка
   `#E9E9E9`. Итоговый кадр — x 77–1248 (левые 77 px — запас под обрезку
   до 867:616). Пересчёт: `x_px = 77 + x% × 11,71`, `y_px = y% × 8,32`.
   Товар вырезать из исходника (удаление фона) и поставить по таблице
   баннера. Доп. объекты на подложку не ставить — их рисует модель.
2. **Подложка мобайла** 1024×1024, `#E9E9E9`, `px = % × 10,24`.
3. **nano-banana-edit**: вход 1 — подложка; вход 2 — по таблице баннера
   (исходник товара как образец этикетки/текстуры). Промт = общий блок
   (§5) + блок баннера. Один прогон на кадр (решение 24.10).
4. **Вернуть оригинал:** вырезанный товар из исходника положить поверх
   сгенерированного в те же координаты (обязательно, если на этикетке
   поплыла хоть одна буква; на практике — всегда для А и В, у Б — коробки).
5. **brand-guard.**
6. **Десктоп:** удаление фона моделью с тонкой маской (щетина кисти,
   пузырьки) → обрезка до 1171×832 (срезать левые 77 px) → подогнать так,
   чтобы низ предметов касался нижней кромки → 867×616, PNG-24 с альфой,
   сжать (pngquant) до ≤ 500 КБ. Контактные тени после вырезки не
   сохраняем — как в текущем слайде.
   Опция: сдать 900×616 (обрезка 1216×832) — уйдёт растяжение на ≥ 1700;
   на остальных ширинах высота считается сама, зоны в процентах не меняются.
7. **Мобайл:** фон **не вырезать** — сдать WebP/JPG 1024×1024 прямо на
   сером, с живыми мягкими тенями (см. §9: на телефоне серый блок без розы,
   картинка займёт его целиком).
8. **Превью:** генерация 1:1 → круг d = 208 px по центру холста 251×212
   (x 21–229, y 2–210), углы прозрачные. Заливка круга — вертикальный
   градиент `#F7F5F6` → `#EAE7E8` (у текущего превью низ круга почти белый
   и на белом фоне его край пропадает; так кружок читается и на розовой
   плашке, и на белом).
9. **Приёмка на сайте:** наложить `slider-zones-867x616.png` на результат —
   ничего, кроме разрешённого, в красных зонах.

---

## 4. Свет и палитра — общие для серии

**Свет:** большой софтбокс сверху слева (~45° по азимуту и высоте) — со
стороны текста, свет «идёт от заголовка» к товару; мягкая заливка справа
(1:2); тонкий контровой сзади справа — отделяет края от серого и облегчает
вырезку. 5000 K, без цветных фильтров. Тени короткие, мягкие, вправо-назад.

**Камера:** чуть выше товара (10–15° вниз), «90 мм», без перспективных
искажений, всё резко (f/11), **без боке** — размытые края ломают вырезку
и спорят с плоским макетом сайта.

**Масштаб:** главный объект — 65–80% высоты кадра; общий центр массы на
x 55–62%; у всех трёх свободен одинаковый левый верхний клин.

| Роль | Цвет |
|---|---|
| Фон генерации (= серый блок сайта) | `#E9E9E9` |
| Плашка под текстом | `#FFF1F4` |
| Дуги розы на сайте | `#FFD9DF` |
| Акцент сайта (hover кнопки) | `#F08597` |
| Разрешённые цвета реквизита | прозрачное стекло, слоновая кость / шампань `#EFE6DA`, тёплый оранжевый геля, розовый грейпфрут `#F2A08A`, розовое золото / металл шампань `#C99A84` |
| Запрещено в реквизите | насыщенные зелёный, синий, фиолетовый; розовый того же тона, что дуги розы (сольётся); чёрный крупными пятнами |

Цвета товаров (оранжевый гель, янтарь флаконов, жёлтая сыворотка,
серо-голубой угол коробок) не трогаем — серию держат свет, фон, ракурс и
одинаковая сетка, а не перекраска.

---

## 5. Общие блоки промта

**STYLE** (в начало каждого промта):

```
Photorealistic premium commercial product photograph for the hero banner of a
professional B2B skincare distributor website. Background: seamless, perfectly
flat, uniform light neutral grey, exactly #E9E9E9 — no horizon line, no
gradient, no texture, no vignette. Lighting: large softbox key light from the
upper left at about 45 degrees, gentle fill from the right, subtle soft rim
light from the back right separating every edge from the background. Neutral
warm white balance, 5000 K. Only short soft contact shadows falling to the
lower right, no long cast shadows. Camera slightly above the products, 10-15
degrees down, 90 mm lens look, no perspective distortion, everything tack
sharp at f/11, no bokeh, no depth-of-field blur. Mood: clean, airy, calm,
clinical-premium, not spa, not cosy.
```

**FIDELITY** (сразу после STYLE, если во входе есть упаковка):

```
The packaging in the input image is a real product photo. Keep it exactly as
it is: same shape, proportions, colours, label layout, typography and every
printed word, same position and size in the frame. Do not redraw, retype,
restyle, mirror, rotate or re-angle the packaging. Do not add any text,
letters, numbers, logos, watermarks or brand marks anywhere else.
```

**FRAME-DESKTOP** (в конец десктопных промтов):

```
Keep the upper-left area completely empty, plain background only: the left
40% of the width from the top down to 45% of the height, and the left 15% of
the width down to 78% of the height. Nothing touches or is cut by the left,
right or top edges; all objects stand on the bottom edge of the frame. Keep a
small empty margin at the top and on the right.
```

**FRAME-MOBILE** (в конец мобильных):

```
Square composition, main object centred, about 6% empty margin on the left,
right and top. Objects stand on the seamless grey floor near the bottom edge
with soft natural contact shadows; the background stays (this version is not
cut out).
```

**Негатив** (nano-banana отдельного поля не имеет — добавлять строкой
`Avoid: …` в конец промта; для моделей с negative prompt — в поле):

```
text, letters, words, captions, typography, numbers, watermark, logo, brand
mark, extra labels, invented packaging, redrawn or misspelled label text,
warped label, duplicated product, extra bottles or tubes, faces, people,
extra hands or fingers, deformed fingers, purple, violet, blue-violet
gradient, neon, glow, sparkles, glitter, bokeh, lens flare, depth-of-field
blur, motion blur, dark background, black background, coloured background,
gradient background, vignette, glossy reflective floor, mirror reflection,
marble, wood, stone, leaves, plants, flowers, rose petals, candles, towels,
spa stones, smoke, fog, splash crown, foam, objects cut by the frame edges,
clutter, CGI look, 3D render look, plastic look, oversaturated colours
```
Для В из негатива убрать `people, extra hands` → оставить `extra hands,
second hand, deformed fingers`.

---

## 6. Баннер А — PEELING INTENSIVO

Заголовок: см. блокер 1. Вход: `media/client/slider-a/product-source.jpg` —
берём **только стоящую тубу** (лежащую открытую тубу не используем: она
срезана краем исходника и не в фокусе; надпись PEELING INTENSIVO уходит
вместе с фоном).

### 6.1. Десктоп 867×616

| Объект | x, % | y, % | Подложка 1248×832, px | Кто рисует |
|---|---|---|---|---|
| Туба стоя, этикетка в камеру | 42–66 | 20–100 | 569,166 – 850,832 | вырезка из исходника |
| Кисть-веер, прислонена к тубе справа, веер вверху | 54–76 | 6–100 | — | модель |
| Мазок геля с гранулами, диагональ «на стене» за тубой | 36–90 | 36–74 | — | модель |
| Густая капля геля на полу слева спереди | 30–42 | 88–100 | — | модель |
| Половинка розового грейпфрута срезом к камере, у правого основания тубы | 68–88 | 72–100 | — | модель |

- Свет сверху слева: блик по левой кромке тубы, тени вправо.
- Воздух: весь левый верхний клин (зоны Т и П), полоса над веером.
- Стык с текстом: мазок поднимается от зоны Н вправо-вверх — продолжает
  взгляд от кнопки к тубе. Верх тубы (y 20%) — левее 66%, на 1440 лежит на
  розовой плашке, белый колпачок не теряется.
- Тёмный веер — единственное, что поднимается выше 20%; на белой полосе он
  контрастен.
- Мазок полностью ниже линии 32% — ложится на серый блок как мазок на стене.

### 6.2. Превью 251×212
Крупный мазок геля с плотными гранулами и мокрым бликом, диагональ снизу
слева вверх направо, ~65% круга. Если в слайдере остаётся текущий слайд
«Peeling Pro» (там такое же превью) — заменить мазок на густую каплю
с гранулами, чтобы два кружка не повторялись.

### 6.3. Мобайл 1024×1024
| Объект | x, % | y, % | px |
|---|---|---|---|
| Туба | 34–58 | 14–94 | 348,143 – 594,963 |
| Кисть-веер | 50–72 | 4–94 | — |
| Половинка грейпфрута | 62–84 | 72–96 | — |
| Густая капля геля | 16–32 | 84–96 | — |

Убрано: мазок на стене — на 346 px он превращается в рябь, а текстуру на
телефоне и так показывает кружок превью прямо над картинкой.

### 6.4. Промты
**Десктоп** (вход 1 — подложка, вход 2 — исходник для текстуры геля):
```
[STYLE] [FIDELITY]
Image 1 is a layout plate: the ISSEIMI PEELING INTENSIVO tube already stands
at its final position, centre-right. Build the still life around it without
moving or changing it. Use image 2 only as the reference for the orange gel
texture with darker exfoliating granules. Add exactly these elements:
1) behind the tube, one broad thick diagonal brush-stroke swatch of that
orange gel with visible granules, painted on the background wall, rising from
the lower left (about 36% width, 74% height) to the upper right (about 90%
width, 36% height), opaque, with crisp edges;
2) a professional fan brush for chemical peels with a slim matte taupe
handle, rose-gold ferrule and a fan of soft brown-orange synthetic bristles,
leaning against the right side of the tube, the fan near the top of the
frame;
3) a small glossy dollop of the same gel with granules on the floor in front
of the tube on the left;
4) one half of a pink grapefruit at the front right, next to the base of the
tube, cut face turned towards the camera and slightly up, juicy translucent
flesh catching the light from the upper left.
Nothing else in the frame.
[FRAME-DESKTOP]
Avoid: [negative], lying tube, open cap, pipette, dropper bottles.
```
**Мобайл** (вход 1 — мобильная подложка, вход 2 — исходник):
```
[STYLE] [FIDELITY]
Image 1 is a square layout plate with the ISSEIMI PEELING INTENSIVO tube
standing slightly left of centre, about 80% of the frame height. Keep it
exactly. Add: a professional fan brush (slim matte taupe handle, rose-gold
ferrule, soft brown-orange bristles) leaning against the right side of the
tube; one half of a pink grapefruit, cut face towards the camera, at the
front right; a small
glossy dollop of the orange gel with granules from image 2 at the front left.
No swatch on the wall. Nothing else.
[FRAME-MOBILE]
Avoid: [negative], lying tube, pipette, dropper bottles.
```
**Превью** (вход — исходник, только для текстуры):
```
Macro top-down photograph of a single short, thick brush-stroke swatch of the
orange peeling gel from the input image, dense darker exfoliating granules,
wet glossy highlight, on a smooth very light warm grey surface (#F2F0F1). The
stroke runs diagonally from lower left to upper right, centred, filling about
65% of the square. Soft light from the upper left. No product, no packaging,
no text. Avoid: [negative].
```

---

## 7. Баннер Б — AQUA O3

Вход: `media/client/slider-b/` — `…05.40` (ANTIAGING, ¾), `…05.51`
(WHITENING, ¾ — см. блокер 3), `…05.47` (FIRMING, анфас), `…05.54` (пара
флаконов FIRMING, чистая вырезка). Фото процедуры `…05.35` в генерацию
**не передаём** (лицо модели; дермапен на нём со сторонним логотипом).

**Раскладка — ступенчатая стопка.** Коробки лежат друг на друге со сдвигом
вправо: у верхней коробки закрыта только крышка нижней, лицевые стороны с
названиями серий видны все три. Разный ракурс FIRMING (анфас) на вершине
стопки читается как «положили чуть повернув» — перерисовывать её в ¾ нельзя.

**Процедура уходит в кружок превью.** ТЗ просит «круглое окно-врезку» —
сайт даёт его бесплатно: превью и есть круг. Вторая круглая врезка внутри
большой картинки рядом с кружком превью = два одинаковых приёма подряд и
перегруз кадра, где и так три коробки, флаконы, дермапен и пузырьки.
Это отступление от ТЗ (там в превью флаконы) — на утверждение Германа;
запасной вариант ниже.

### 7.1. Десктоп 867×616
| Объект | x, % | y, % | Подложка, px | Кто рисует |
|---|---|---|---|---|
| Коробка ANTIAGING (низ стопки) | 46–76 | 69,5–100 | 616,578 – 967,832 | вырезка |
| Коробка WHITENING (середина) | 52–82 | 49–79,6 | 686,408 – 1037,662 | вырезка |
| Коробка FIRMING (верх, анфас) | 58–88 | 35,5–59,2 | 756,295 – 1107,493 | вырезка |
| Пара флаконов FIRMING, спереди слева | 30–46 | 79–100 | 428,657 – 616,832 | вырезка |
| Дермапен, лежит перед стопкой, кончик влево; корпус — сатинированный металл шампань / розовое золото | 50–90 | 90–100 | — | модель (без логотипа) |
| Прозрачные сферы-пузырьки 5–7 шт., диаметр 2–6% ширины кадра | 40–56 (+1–2 у верхней коробки на 86–92) | 46–76 | — | модель |

- Ширина коробки — 30% кадра: при большей стопка поднимается выше 30% и
  белая верхняя коробка правее 69% ложится на белый фон — край пропадёт.
- Вся масса — внутри серого блока: верх стопки на 35%, ниже полосы над
  блоком на всех ширинах. Верхняя полоса пустая — воздух.
- Стык с текстом: флаконы — низкий объект в зоне Н, от них пузырьки
  поднимаются вправо к стопке — та же диагональ, что у А.
- Белые коробки над розовыми дугами розы — дуги дают контраст белому.
- Дермапен — сатинированный металл цвета шампань / розового золота (так
  его подают пины `slider-b/pins/pin-06`, `pin-07`): тёплый металл отделяется
  от белых коробок (белый прибор на белом терялся), рифмуется с оправой
  кисти А, не спорит с серо-голубыми углами коробок.
- Пузырьков меньше и они крупнее (пин `pin-02`): при выводе 668 px мелкие
  пузырьки превращаются в пыль. Бесцветные — в отличие от золотистых сфер В.

### 7.2. Превью 251×212
Основной вариант: процедура — вымышленная девушка, ¾, глаза закрыты, рука
косметолога в белой перчатке держит дермапен (металл шампань) у скулы; кадр плотный,
лицо и прибор заполняют круг (на телефоне круг 122 px — мелкие детали не
прочитаются). Светлая гамма: белый, телесный, бледно-розовый.
Запасной (как в ТЗ): пара флаконов FIRMING из `…05.54` + пузырьки на
светлом круге — почти без генерации.

### 7.3. Мобайл 1024×1024
| Объект | x, % | y, % | px |
|---|---|---|---|
| ANTIAGING (низ) | 30–70 | 65–94 | 307,666 – 717,963 |
| WHITENING (середина) | 36–76 | 45,7–74,6 | 369,468 – 778,764 |
| FIRMING (верх) | 42–82 | 32,7–55,2 | 430,335 – 840,565 |
| Пара флаконов | 6–33 | 68–94 | 61,696 – 338,963 |
| Пузырьки | 8–34 | 34–66 | — |

Убрано: дермапен — фракционную мезотерапию на телефоне показывает кружок
превью с процедурой прямо над картинкой.

### 7.4. Промты
**Десктоп** (вход 1 — подложка):
```
[STYLE] [FIDELITY]
Image 1 is a layout plate: three ISSEIMI AQUA O3 boxes are already stacked in
a stepped pile on the right — ANTIAGING at the bottom, WHITENING in the
middle shifted to the right, FIRMING on top — and a pair of amber AQUA O3
FIRMING vials stands in front on the left. Keep every box and vial exactly as
it is. Make the stack physically believable with soft contact shadows where
each box rests on the one below and where everything stands. Add exactly:
1) a sleek generic microneedling pen lying on the floor in front of the
stack, slightly angled, tip pointing left: satin-finished champagne /
rose-gold metal body, transparent needle cartridge tip with a white base, no
display, no buttons with symbols, no logo, no text;
2) five to seven crisp, perfectly clear colourless spheres like air bubbles,
different sizes (the largest about 6% of the frame width), rising from the
vials through the empty space between the vials and the stack, between 46%
and 76% of the frame height, plus one or two next to the top box on the
right — a quiet hint of ozone and sterility, not foam.
Nothing else in the frame.
[FRAME-DESKTOP]
Avoid: [negative], cosmetologist, face, gloves, blue device, device screen.
```
**Мобайл** (вход 1 — мобильная подложка):
```
[STYLE] [FIDELITY]
Image 1 is a square layout plate: three ISSEIMI AQUA O3 boxes stacked in a
stepped pile right of centre (ANTIAGING bottom, WHITENING middle, FIRMING
top) and a pair of amber AQUA O3 FIRMING vials in front on the left. Keep
them exactly. Add soft contact shadows between the boxes and on the floor,
and five crisp clear colourless spheres of different sizes rising from the
vials on the left side. No device. Nothing else.
[FRAME-MOBILE]
Avoid: [negative], microneedling pen, device.
```
**Превью — процедура** (без входного изображения: фото процедуры не
передаём, чтобы не скопировать лицо модели):
```
High-key close-up beauty treatment photograph composed for a circular crop.
A cosmetologist's hand in a white nitrile glove holds a satin champagne
metal microneedling pen with a clear tip against the cheekbone of a young woman
with clean, smooth, natural skin, eyes closed, calm relaxed expression, face
in three-quarter view filling most of the frame. Soft daylight from the upper
left; white, warm skin and pale pink tones. The woman is a fictional person
and must not resemble any real person. No blood, no redness, no visible
needles, no text, no logos. Avoid: [negative без faces/people], heavy makeup,
glamour retouch, medical drama, blue device.
```
**Превью — запасной** (вход — `…05.54`):
```
[FIDELITY] Keep the pair of AQUA O3 FIRMING vials from the input exactly as
they are, centred, filling about 60% of the square, on a smooth very light
warm grey background (#F2F0F1); add five or six tiny crisp clear
micro-spheres around them; soft light from the upper left. Avoid: [negative].
```

---

## 8. Баннер В — COLLAGEN BOOSTER

Вход 1: `media/client/slider-c/product-source.jpg` (рука, открытый флакон,
пипетка, капля). Вход 2: `media/client/slider-c/product-catalog.jpg` —
**добавлен сейчас** из карточки товара на сайте: закрытый флакон с
пипеткой. Нужен потому, что в исходнике верх пипетки срезан кадром, а
срезанная стеклянная трубка, висящая над розовой плашкой, — дефект. Верх
пипетки (белая груша, золотое кольцо) достраиваем строго по входу 2.

Что убрать из исходника на подложке: блузку и бант (уходят с фоном), пальцы
второй руки слева сверху, держащие пипетку. Запястье в исходнике уходит за
правый край — модель продлевает его вниз, чтобы рука выходила **только
через нижний край** (на ≥ 1700 правый край кадра не совпадает с краем
экрана).

### 8.1. Десктоп 867×616 — «пипетка парит, капля падает»
| Объект | x, % | y, % | Подложка, px | Кто рисует |
|---|---|---|---|---|
| Колонна целиком: груша → пипетка → капля → флакон → рука | 40–74 | 9–100 | 545,75 – 944,832 | вырезка + достройка |
| Груша и кольцо пипетки (по входу 2) | 45–49 | 9–25 | 604,75 – 651,208 | модель по образцу |
| Стекло пипетки, кончик | ~49–56 | 25–52 | — | исходник + достройка стекла |
| Капля в полёте | ~56 | 52–58 | — | исходник |
| Флакон в ладони | 49–63 | 58–93 | 651,483 – 815,774 | вырезка |
| 3–4 крупные глянцевые золотистые сферы сыворотки, диаметр 4–9% ширины | 64–90 (одна может быть на 42–46) | 40–80 | — | модель |

- Колонна узкая и высокая — В отличается от А и Б силуэтом, но держит ту же
  сетку: пустой левый верх, масса справа от центра, рука встаёт с пола.
- Флакон — ~35% высоты кадра: компромисс ради целой пипетки (её длина
  примерно равна флакону). Масса добирается рукой и сферами.
- Груша на y 9% — левее 62%, лежит над розовой плашкой; на ≥ 1700 — над
  белым на 1% высоты, допустимо.
- Падающая капля и сферы — ниже 32%; стекло пипетки частично в
  верхней полосе — тонкое, серый оттенок внутри почти не заметен.
- Вместо шёлка — золотистые сферы сыворотки (пин `slider-c/pins/pin-07`,
  у Hermes — «эффект стеклянной кожи без лица»). Это буквальная метафора
  «эффекта фотошопа»: идеально гладкая глянцевая поверхность, и они того же
  цвета, что сыворотка во флаконе. От пузырьков Б отличаются цветом
  (золото против бесцветных) и размером (крупнее, меньше штук).

### 8.2. Превью 251×212
Макро: кончик стеклянной пипетки с крупной золотистой каплей, вот-вот
упадёт; блик сверху слева; капля ~60% круга.

### 8.3. Мобайл 1024×1024 — без пипетки
| Объект | x, % | y, % | px |
|---|---|---|---|
| Рука с открытым флаконом | 12–89 | 18–100 | 123,184 – 911,1024 |
| Флакон | 40–61 | 18–78 | 410,184 – 625,799 |
| Две золотистые сферы справа от флакона | 66–90 | 40–70 | — |

Убрано: пипетка с падающей каплей (в квадрате с целой пипеткой флакон
сжимается до ~110 px на экране; каплю на пипетке показывает кружок превью
над картинкой); сфер две вместо 3–4. Вместо падения — одна глянцевая капля на
кромке горлышка.

Общий принцип мобайла для всей серии: **второстепенное сообщение уходит в
кружок превью, главная картинка показывает товар крупно** (А — текстура,
Б — процедура, В — капля).

### 8.4. Промты
**Десктоп** (вход 1 — подложка, вход 2 — `product-catalog.jpg`):
```
[STYLE] [FIDELITY]
Image 1 is a layout plate: a woman's hand holds an open frosted-glass ISSEIMI
COLLAGEN BOOSTER bottle; above it floats the glass pipette with a golden drop
falling from its tip into the bottle mouth. Keep the bottle, its label, the
hand, the pipette glass and the drop exactly as in image 1. Image 2 shows the
same product closed: use it only as the exact reference for the dropper top.
Complete the pipette upwards along its own axis: clear straight glass, ending
in the polished gold collar and white rubber bulb exactly as in image 2, the
whole dropper floating in the air, slightly tilted as in image 1. Remove any
fingers holding the pipette. Extend the wrist naturally so the hand leaves
the frame only through the bottom edge. To the right of the bottle, add three
or four large glossy golden serum spheres of different sizes floating in the
air, perfectly smooth, with soft highlights from the upper left and the same
golden colour as the serum in the bottle.
Natural, well-groomed hand, nude pink manicure, real skin texture. Nothing
else in the frame.
[FRAME-DESKTOP]
Avoid: [negative с правкой для В], white blouse, black bow, fabric behind the
hand, satin, silk, second hand, cut-off pipette, pink spheres.
```
**Мобайл** (вход 1 — мобильная подложка без пипетки):
```
[STYLE] [FIDELITY]
Image 1 is a square layout plate: a woman's hand holds an open frosted-glass
ISSEIMI COLLAGEN BOOSTER bottle in the centre, the bottle about 60% of the
frame height. Keep the bottle, label and hand exactly. No pipette. Add a
single glossy golden drop of serum resting on the rim of the bottle neck and
running slightly down the outside of the neck. Extend the wrist so the hand
leaves the frame only through the bottom edge. Two large glossy golden serum
spheres float to the right of the bottle. Nothing else.
[FRAME-MOBILE]
Avoid: [negative с правкой для В], pipette, dropper, white blouse, black bow,
second hand, satin, silk.
```
**Превью** (вход — исходник, для цвета сыворотки):
```
Macro photograph of the tip of a clear glass pipette with a single large
round golden-yellow serum drop hanging from it, about to fall, colour as in
the input image. The drop catches a soft highlight from the upper left.
Smooth very light warm grey background (#F2F0F1). Tip and drop centred,
filling about 60% of the square. Nothing else, no text. Avoid: [negative].
```

---

## 9. Мобильная версия: формат и как встаёт

На телефоне (< 744) серый блок — **без розы**, сплошной `#E9E9E9`, шириной
«экран минус 44 px», высотой 180 px (≤ 430), 300 px (431–570), 350 px
(571–743). Мобильный файл ставим **фоном этого блока** и задаём блоку высоту
по пропорции файла; картинка занимает блок целиком. Отсюда:

- фон мобильного файла не вырезаем — края не видны, тени живые, нет
  артефактов вырезки;
- картинка больше не наползает на кнопку «Подробнее» и не режется справа
  на 360 px — два дефекта текущего слайда на телефоне уходят.

| Формат | Картинка на 390 px | Высота слайда* | Вердикт |
|---|---|---|---|
| **1:1, 1024×1024** | 346×346, туба ~280 px | ~800 px (+165) | **основной**: вертикальные туба и рука, и горизонтальная стопка коробок помещаются без ужимания |
| 4:3, 1024×768 | 346×260, туба ~210 px | ~715 px (+80) | запасной, если Герман не хочет удлинять слайд |
| 4:5, 750×900 | 346×432 | ~890 px (+250) | нет: слайд длиннее видимой области телефона (~660–750 px в Safari); низ товара уходит под сгиб, slick выравнивает слайды по самому высокому — старые слайды получат пустоту |

*Слайд = розовая плашка с заголовком в 5 строк (~475 px) + серый блок;
сейчас ~635 px.

CSS (готовит Claude, вставляет Герман): на < 744 скрыть
`.product__img--decorative` нужного слайда, блоку — фон, `aspect-ratio:1/1`
и соответствующий `padding-bottom` у `.main-slider__product`; адресовать
слайд через `:has(img[src*="<имя файла>"])`. Все три новых слайда — в одном
формате, иначе слайдер будет прыгать по высоте.

---

## 10. Почему такая раскладка и что делать, если пины подскажут другое

**Почему:**
- сетка выведена из реальной вёрстки, а не из пропорций файла: на
  1024–1300 и ≥ 1700 текст и превью заходят в картинку, поэтому левый
  верхний клин пустой у всех трёх;
- текущий язык слайдера (вырезанные товары на нижней кромке, без фона)
  сохранён — новые слайды встанут рядом со старыми без шва;
- свет со стороны текста и диагональ «низкий объект → герой» ведут взгляд
  от заголовка к товару;
- упаковка — всегда пиксели исходника, модель рисует только среду.

**Альтернатива 1 — «монолит».** Один товар крупно (85–90% высоты), один
элемент текстуры, никакого реквизита. Брать, если пины в
`slider-*/pins/` показывают минималистичную подачу. Плюс — максимум
читаемости и премиальности; минус — Б так не сделать (три серии). Сетка
зон та же; герой на x 50–80%.

**Альтернатива 2 — «подиум»** (пины её поддерживают: `slider-layout/pins/
pin-03`, `pin-04`, `slider-b/pins/pin-03`, `slider-a/pins/pin-05`). Низкий
белый матовый цилиндр (как в `slider-layout/pin-04`, который Hermes отметил
как самый близкий к BMG): высота 18–22% кадра, стоит на нижней кромке, x
40–92%; товар стоит на нём. Плюс, которого нет у основной раскладки: тени
падают на подиум, а он часть объекта, поэтому **тени переживают вырезку
фона**, а товар не висит на кромке. Минус: подиум забирает пятую часть
высоты — туба А уменьшится с 80% до ~60% кадра, стопка Б не поместится
под линией 30% (для Б — только широкая низкая плита 10–12%); В с рукой
подиум не нужен. Если Герман выберет подиум — для всей серии, кроме В.

Чего не брать из пинов, как бы ни нравилось: тёмные фоны, цветные градиенты,
брызги-короны, лепестки и спа-реквизит, лица крупным планом, текст на
картинке — это противоречит ТЗ и бренду. Конфликтуют пины между собой —
выбрать один доминирующий приём, не усреднять.

---

## 11. Приёмка (бинарно, по каждому файлу)

- [ ] Упаковка совпадает с исходником буква в букву (наложение исходника
      поверх, разница только в тенях).
- [ ] Нет текста, логотипов, водяных знаков вне упаковки.
- [ ] Наложение `slider-zones-867x616.png`: красные зоны пусты.
- [ ] Ничто не срезано левым, правым, верхним краем; низ стоит на кромке.
- [ ] Полупрозрачное — ниже 32%; белое — не выше 10% и правее 62% не выше 30%.
- [ ] Края вырезки без серого ореола на розовом и белом (проверить на
      заливке `#FFF1F4` и `#FFFFFF`).
- [ ] Мобайл 1024×1024, фон ровный серый, поля ~6%.
- [ ] Превью: круг d = 208, градиент `#F7F5F6`→`#EAE7E8`, объект
      читается на 122 px.
- [ ] brand-guard пройден.

---

## 12. Сверка с пинами Hermes (24.10)

Пины в `media/client/slider-*/pins/` — только идея, в генерацию не идут.

**А — подтверждают основу, одна замена.** Туба + текстура + цитрус —
`pin-05`, `pin-06`; текстура как главный акцент — `pin-03`, `pin-07`,
`pin-08`; превью-мазок на светлом — `pin-04`. Замена: **два тонких ломтика
грейпфрута → половинка срезом к камере** (`pin-05`): на 668 px тонкие
ломтики превращаются в рябь, половинка читается одним пятном. Не берём:
мраморный подиум и оранжевый фон (`pin-05`), лента геля прямо из горлышка
(`pin-03`, `pin-07`) — для неё тубу надо открыть и повернуть, то есть
перерисовать упаковку.

**Б — подтверждают «коробки + флаконы + дермапен», две замены.** Коробка
с флаконами в одном кадре — `pin-04`, `pin-05`; дермапен рядом с продуктом
— `pin-06`; пузыри — `pin-02`. Замены: **корпус дермапена — металл шампань /
розовое золото** вместо матового белого (`pin-06`, `pin-07`); **пузырьков
5–7, крупнее** вместо 8–10 мелких (`pin-02`). Арка-подиум (`pin-03`) — в
альтернативу 2. Процедура широким кадром (`pin-07`) в круге 122 px не
прочитается — в превью остаётся плотный кадр.

**В — подтверждают основу, одна замена.** Пипетка парит над открытым
флаконом, капля падает — `pin-01`, почти наша десктопная раскладка; капля с
пипетки для превью — `pin-03`, `pin-04`; жест руки с флаконом — `pin-08`.
Замена: **шёлк → 3–4 золотистые сферы сыворотки** (`pin-07`). Не берём:
лужу сыворотки на полу (`pin-02`) — под рукой в воздухе её некуда положить;
цветы и пионы (`pin-06`).

**Общая раскладка — подтверждают.** Текст слева, товар справа, светлый
фон, много воздуха — `pin-01`, `pin-03`, `pin-04`, `pin-06`. Подиум в трёх
пинах из восьми — усилил альтернативу 2 конкретными цифрами (§10), в основу
не беру: он съедает пятую часть высоты под товар. Не берём: тени от листьев
и окна (`pin-01`–`pin-03`) — падают на фон, который вырезается, и тянут в
«домашний спа»; ряд иконок преимуществ (`pin-02`) — в шаблоне слайда нет
места; модель сбоку (`pin-07`).

---

## ВОЗРАЖЕНИЕ

Подход из ТЗ «nano-banana-edit по фото товара → удаление фона» не
выполняет правило «упаковку не рисует нейросеть»: модель перерисовывает
весь кадр, мелкий текст этикеток («USO PROFESIONAL», «Vitalizante»,
свойства на коробках AQUA) поплывёт. А если отдать модели сырое фото, она
сама выберет масштаб и положение — и товар окажется в зоне текста.
Поэтому в спеке два шага, без которых конвейер не годится: подложка с
товаром в заданных координатах и возврат оригинального товара поверх
результата перед вырезкой фона.
Уверенность: уверен.
