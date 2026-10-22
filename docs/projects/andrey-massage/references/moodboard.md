# Мудборд презентации «Три пути» для Андрея (блок Б ТЗ v2)

Источник: Nullume, Pinterest (импортёр `pinterest-cookies`). 22.10.2026 выполнено 10 запросов из раздела 6 ТЗ, в библиотеку добавлено 283 новых референса, все просмотрены глазами.
Отобраны **3 семейства по 8 референсов** и 4 подсказки по вёрстке. Семейства лежат в библиотеке
со статусом `proposed` и тегом `andrey-massage`. Утвердить их можно в `nullume lib dashboard --open`.

Общий фильтр (`antiRefCheck`): без фиолетового, лотосов, свечей, камней-стопок, эзотерики,
«медицинских» картинок и стоковых портретов улыбающегося массажиста. По этому фильтру
отсеяно около 70 % выдачи: сток-фото массажа, йога-шаблоны, корпоративные буклеты.

Шрифты: все пары поддерживают кириллицу. Playfair Display / Inter взяты из
`docs/core/typography-pairs.md` (пара «Editorial»). Пара Cormorant Garamond / Manrope в этом
файле не указана, но кириллица есть у обоих шрифтов (Google Fonts); перед вёрсткой её
нужно проверить по правилу №1 из того же файла.

**Рекомендация:** основа презентации — **F1**. Для слайдов пути 1 подойдёт **F2**, для пути 3 — **F3**.
Все три семейства используют одну сетку и одну шрифтовую логику, поэтому их можно соединить
в одном документе: светлая база, тёмные разделители глав и ч/б вставки с руками.

---

## F1. Тёплый камень и лён — `andrey-massage-warm-stone-linen` (основной кандидат)

**Что это.** Светлый «тихий люкс»: травертин, штукатурка, лён, мягкий боковой дневной свет, много пустого пространства, мелкие подписи серифом.

- **Палитра:**
  - `#F3EEE6` — фон;
  - `#E4D9C8` — подложка;
  - `#2B2621` — текст;
  - `#9C7A55` — акцент (тёплая бронза);
  - `#8A8075` — второстепенный.
- **Типографика:**
  - заголовки — Cormorant Garamond 400, трекинг +0.02em;
  - текст — Manrope;
  - подписи — капителью;
  - шкала: 13 / 16 / 20 / 28 / 44 / 72.
- **Фотостиль:** натюрморты из материалов (камень, лён, дерево), пустые архитектурные интерьеры, свет из окна под острым углом, лёгкое плёночное зерно. Людей мало, они маленькие в кадре.
- **Композиция:** «воздух» занимает 50–60 % слайда, асимметрия, тонкие линейки, одна картинка на слайд.
- **Настроение:** спокойно, тактильно, светло, дорого без блеска.
- **Почему подходит.** Вкус тот же, что у премиальных спа-отелей, но без спа-клише. Ощущение рук и тела передают фактуры, поэтому не нужны фото процедуры, которые легко скатываются в сток или «медицину». Подходит для всех трёх путей.

Картинки (`img/`):
- `f1-warm-stone-linen-01.jpg` — фигура в пустом бежевом проёме;
- `f1-warm-stone-linen-02.jpg` — «Quiet Luxury», светлый зал;
- `f1-warm-stone-linen-03.jpg` — терраса над морем;
- `f1-warm-stone-linen-04.jpg` — изогнутый коридор со скрытой подсветкой;
- `f1-warm-stone-linen-05.jpg` — «Dust. Linen. Stone.» — эталон типографики;
- `f1-warm-stone-linen-06.jpg` — травертин и лён, «Texture»;
- `f1-warm-stone-linen-07.jpg` — стопка льна в свете окна;
- `f1-warm-stone-linen-08.jpg` — материалы с подписями (лён, дуб, известняк).

## F2. Тёмная земля, «вечерний Аман» — `andrey-massage-dark-earth`

**Что это.** Тёмный тёплый минимализм: глина, орех, терракота, мох. Одиночный луч света через арку. Тонкий светлый логотип по центру, крупная разрядка.

- **Палитра:**
  - `#2A211B` — фон;
  - `#4A3426` — подложка;
  - `#EFE6D8` — текст;
  - `#B07A4F` — акцент (терракота);
  - `#3F4636` — второстепенный (мох).
- **Типографика:**
  - заголовки — Cormorant Garamond 300, все прописные, трекинг +0.18em;
  - текст — Manrope.
- **Фотостиль:** кинематографичные тени, архитектура Aman (Марракеш, Бангкок), фактура дерева и глины крупным планом.
- **Композиция:** симметрия, центр, один элемент на слайде.
- **Настроение:** закрыто, вечер, статус, «для своих».
- **Почему подходит.** Это визуальный язык пути 1: клиенты по рекомендации, публичности нет. Хорош для обложки, разделителей глав и слайда «Тихий люкс». Для всей презентации слишком тёмный: читать таблицы на тёмном фоне тяжело.

Картинки (`img/`):
- `f2-dark-earth-aman-01.jpg` — лобби Aman Nai Lert;
- `f2-dark-earth-aman-02.jpg` — Amanjena, силуэт в арке;
- `f2-dark-earth-aman-03.jpg` — логотип Aman на тёмном дереве с лучом;
- `f2-dark-earth-aman-04.jpg` — тиснение на кожаной обложке;
- `f2-dark-earth-aman-05.jpg` — анфилада арок в Марокко;
- `f2-dark-earth-aman-06.jpg` — вода и тень, вёрстка спа-бренда;
- `f2-dark-earth-aman-07.jpg` — «Mirani», свет на стене;
- `f2-dark-earth-aman-08.jpg` — «The Gilt Room», зелёная лестница.

## F3. Руки и серифный журнал — `andrey-massage-hands-editorial`

**Что это.** Чёрно-белые крупные планы рук и кожи плюс журнальная вёрстка: огромный контрастный сериф, буквица, узкие колонки.

- **Палитра:**
  - `#F6F4F0` — фон;
  - `#111111` — текст;
  - `#7D7A74` — второстепенный;
  - `#8B5E3C` — акцент;
  - `#D9D5CE` — линии.
- **Типографика:**
  - заголовки — Playfair Display 400, трекинг −0.02em, до 112 px;
  - текст — Inter;
  - буквицы.
- **Фотостиль:** ч/б, направленный мягкий свет, зерно. Только руки и фрагменты тела, без лиц и процедуры.
- **Композиция:** журнальный разворот: фото на всю высоту, рядом колонка текста. Высокая вариативность.
- **Настроение:** ремесло, авторство, уверенность.
- **Почему подходит.** Говорит о мастерстве рук без медицинских коннотаций. Это язык пути 3 («Метод»: авторский протокол, имя как бренд) и раздела «кейсы рынка». Фото рук Андрея в этой стилистике можно снять самим: это дешевле и честнее стока.

Картинки (`img/`):
- `f3-hands-serif-editorial-01.jpg` … `-04.jpg` — ч/б руки и кожа;
- `f3-hands-serif-editorial-05.jpg` — «Luxury is something everyone deserves», журнальный разворот;
- `f3-hands-serif-editorial-06.jpg` — «The Power of Woman», буквица и колонки;
- `f3-hands-serif-editorial-07.jpg` — «The Good life», крупный сериф;
- `f3-hands-serif-editorial-08.jpg` — «Simpler», заголовок поверх ч/б фото.

## Подсказки по вёрстке (не семейство)

- `layout-01.jpg` — бежевая презентация бренда: сетка обложки, «about», галерея.
- `layout-02.jpg` — «Neutral Presentation»: светлые слайды с фото и цифрами.
- `layout-03.jpg` — тёмно-моховые слайды «Process / Result»: так можно делать слайды пути.
- `layout-04.jpg` — «Part I Foundation / Chapter Title»: разделители глав.

## Источники (страницы Pinterest)

| Файл | ID в Nullume | Pin |
|---|---|---|
| f1-01 | 66002695 | https://www.pinterest.com/pin/e1_AfqPShxCdKb8P-SaV9DPuyxfF4Rt4d8R3b084gm3JaaTdVuZef7gLA/ |
| f1-02 | 152e90ec | https://www.pinterest.com/pin/e1_AfqPShztg2VjGlxPeCO-h-En25Hv6cgMFcax68D79mrhOUOs7c34/ |
| f1-03 | 41bc091e | https://www.pinterest.com/pin/e1_AfqPShzuUImp6yzUD8-Xx2HILfJMkRMnc7qLmjqhyrINl1dvaMqx/ |
| f1-04 | c1168e2a | https://www.pinterest.com/pin/e1_AfqPShwuf05BGcNFMvbzs1I-anUcbLPuGegR1BEBjouCWiDqf2Zq/ |
| f1-05 | 515d2c78 | https://www.pinterest.com/pin/e1_AfqPShzRYPJmmY0WzDhHFXgesCMJRTr-N86y5J71VnX0LvTNDH7j/ |
| f1-06 | 3789ae5a | https://www.pinterest.com/pin/e1_AfqPShycNYl800qlNZtV17YhHbmap3lcz9GORvONjocj5kOY8SOO/ |
| f1-07 | 8f0dd269 | https://www.pinterest.com/pin/e1_AfqPShxku2xSoaT1ktXsOuLL80F1RlEwRfnN3DZtgw1Q5rZ4SVNC/ |
| f1-08 | 58604800 | https://www.pinterest.com/pin/e1_AfqPShxMX-Rm2i0XQZdchAWw3uNEqfQNic2E5uXDnqLPF5LXiRGx/ |
| f2-01 | 1d1fcd5c | https://www.pinterest.com/pin/e1_AfqPShyxSBIJ_kAvr8r7pJZNuXXr-YP1XNk6pMkjImtpwIA6Vaa2/ |
| f2-02 | 30589a5e | https://www.pinterest.com/pin/e1_AfqPShzXMRjpQoiMLv9LqLUQOTNrgBffbtpmMvB3rdFWbsDVYdJ3/ |
| f2-03 | 6116d98a | https://www.pinterest.com/pin/e1_AfqPShxUBBdQbscogZYBaJlMDBwiUqfeHBf8matME3UTU4ZurkwX/ |
| f2-04 | 525e733f | https://www.pinterest.com/pin/e1_AfqPShysAV-lyQ6kL1z8k98p5x7tyPybDdLRCYVSfDcd8zQr7X6m/ |
| f2-05 | fbc18361 | https://www.pinterest.com/pin/e1_AfqPShwZZwYtTl4uXVkZWAKLcTews2w1_BCFKeaBRew3wU9vGoI_/ |
| f2-06 | a57fba80 | https://www.pinterest.com/pin/e1_AfqPShznBbdmMQetxXTt8gUgfNt8WpuYKDfj5YPMcG4GCd8-Wl3G/ |
| f2-07 | 0ee3dabf | https://www.pinterest.com/pin/e1_AfqPShxI9-kcvGzuvc4-mdYz-y0l2TKZhaCMyn3WnGpa7oVxziuDPA/ |
| f2-08 | 50f6b6ef | https://www.pinterest.com/pin/e1_AfqPShw4ACJm8RdHRB1sypAuGFIY0uoPpAaQuEt3zXMST7V9rwA3/ |
| f3-01 | 50452584 | https://www.pinterest.com/pin/e1_AfqPShxmzoxCT73ods_JX-q6k91RVHm1QQMNM1a7aRPz2QKCn4I6/ |
| f3-02 | 012317f6 | https://www.pinterest.com/pin/e1_AfqPShyAvvZM4DdPKmyxB3MeSf3Ux1BwBKYUFmfaO45mYRWu9rVJ/ |
| f3-03 | e5a08056 | https://www.pinterest.com/pin/e1_AfqPShwlMwE3XqHvxfncDmQtf4lAAouSlP1cf5WpUeA9crKLlSmA/ |
| f3-04 | 06e27698 | https://www.pinterest.com/pin/e1_AfqPShzWxyKIudaVD2b4IIP7mnlaOu-K0iFTidL3hUMK0GlKjk8/ |
| f3-05 | 558fa485 | https://www.pinterest.com/pin/e1_AfqPShxglwG8-dP5QggA_B8h--joPrgquqx_tF-6t9ovNCTrlFOqdw/ |
| f3-06 | af8c3240 | https://www.pinterest.com/pin/e1_AfqPShzgKMVZ0r6vcdJwJ8hduv4v6qNOe2u8kVWFwo15G9UoZiXV/ |
| f3-07 | 637481b6 | https://www.pinterest.com/pin/e1_AfqPShytMZ1TMzFec0SWI-2FgD76E4rrJWQZ9meYc-52BeBuA74Q/ |
| f3-08 | aac84cb1 | https://www.pinterest.com/pin/e1_AfqPShyO3nyE2nVgczaCXkvFnX3ga7J2RiyQCLdOl2ypwoArB5tx/ |
| layout-01 | 801b7ca5 | https://www.pinterest.com/pin/e1_AfqPShwhX-2TddJSLQhxKd9rND8uisChSihwohm2A4pMSDwicBH4/ |
| layout-02 | 5d3bfeff | https://www.pinterest.com/pin/e1_AfqPShzaJV5T1MnsSivynDNJutrKaOi8ZwQ9BhwzBr9lWEsh6gnLWA/ |
| layout-03 | 1fc6b320 | https://www.pinterest.com/pin/e1_AfqPShxMawaMURxWUoNf9g7l5-dZhAf2LUpUsnqpS2vQvqDZJt8k/ |
| layout-04 | b62c0680 | https://www.pinterest.com/pin/e1_AfqPShwCK0xZ1iU5W3gToh4I7WcFmGbJWCx_IwD40LE6SA9MXxVaoQ/ |

Права: картинки — чужие работы с Pinterest. Они нужны только как внутренние референсы
для вёрстки. В презентацию для Андрея не вставлять: снимать своё или генерировать по
`prompt_fragment` из дескриптора (`nullume lib family show <id>`).
