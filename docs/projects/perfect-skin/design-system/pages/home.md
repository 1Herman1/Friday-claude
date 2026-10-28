# Главная (`/`)

Дельты к `../MASTER.md` для главной страницы. Всё, что здесь не упомянуто, —
по MASTER.

## Исключения из чек-листа

### P2: свёрнутые колонки мобильной гармошки «Специалистам»

**Где:** `client/src/components/home/ProSection.tsx`, `ProAccordion` (только
телефон, < 768 px).

**Что:** свёрнутые колонки товаров — 21–27 px шириной при экране 360–412 px
(замер: 21,8 / 24,5 / 26,5 px на 360 / 390 / 412), высота 416 px. Это меньше
P2 из MASTER (≥ 44×44) — осознанное исключение.

**Почему допустимо:**
- WCAG 2.2, критерий 2.5.8 Target Size (Minimum), уровень AA, выполнен:
  колонки ≥ 24 px, а там, где уже (360 px), срабатывает условие отступа —
  зазор `gap-2` 8 px, круг 24 px вокруг центра колонки соседей не задевает.
- Выбор товара продублирован эквивалентными контролами: ползунок `#pro-pick`
  высотой 44 px на всю ширину (с клавиатуры — стрелки, Home/End) и свайп по
  всей строке высотой 416 px. Тап по колонке — дополнительный путь, не
  единственный.

**Почему не 44 px:** три свёрнутые колонки по 44 px сжали бы раскрытую панель
до ~138 px на экране 390 px (сейчас 196 px) — в неё не помещаются заголовок
товара и кнопка «Открыть оптовую цену».

Решение 12.10.2026.

### MOTION: сцена «Бестселлеры» перехватывает прокрутку

**Где:** `client/src/components/home/BestsellerScene.tsx`.

**Что:** MASTER §6 запрещает scroll-hijack и авто-анимации, а сцена — именно
перехват. Пока она закреплена на экране, колесо и свайп не листают страницу:
один жест запускает один ролик (рука берёт следующий товар), остановка — на
товаре с карточкой. Длина сцены 520vh. Осознанное исключение, решение владельца.

**Чем смягчено:**
- выход всегда в один жест: после 4-го товара — вниз, до 1-го — вверх; есть
  кнопка «Пропустить»;
- нажатие на флакон или деление прогресса сразу ставит нужный товар, без роликов;
- `prefers-reduced-motion` — роликов нет, статичный список товаров;
- пока роликов нет в памяти — стоп-кадры, пустого экрана быть не должно;
- под сценой — обычная сетка «Популярное», которой управляет клиент.

**Ограничение, которое надо помнить:** четыре товара сцены впечатаны в ролики.
Замена товара — пересъёмка у студии. Если товар снят с сайта, карточка в сцене
говорит «Сейчас нет в продаже» и ведёт в каталог бренда.

**Не поднимать в ревью как находки (решения владельца):** длина 520vh; остановка
только на товаре; карточка меняется во время движения руки; телефонный ролик
3→4 не переснимаем; в карточке нет строки «зачем» и ссылки «Все бестселлеры»;
названия товаров как в каталоге.

Решение 06.10.2026, записано 15.10.2026.

---

## Секции: видеоотзывы, блог, новости (23.10.2026)

Спек для вёрстки. Всё, что не названо, — по MASTER. Значения окончательные:
если класс записан, он и ставится. Классы-константы `LABEL`, `LINK_MORE` —
из `client/src/components/about/classes.ts`. Тексты заголовков и подзаголовков
утверждены этим спеком, менять их — правка спека.

### 0. Общее для трёх секций

**Порядок на главной** (`client/src/components/pages/HomePage.tsx`):

```
HeroSection → BrandsSection → CategoryAccordion → BestsellerScene
→ PopularSection → CtaTiles → VideoReviewsSection → ProSection → AboutHome
→ BlogSection → FaqSection
```

Почему так: сетка товаров → сразу соцдоказательство (профиль E-commerce,
`docs/core/design-profiles.md`) → вход для специалистов. Журнал стоит перед FAQ:
статьи закрывают те же вопросы «как подобрать», что и FAQ. Подбор и консультация
стоят после сетки товаров: сначала покупатель видит товар, затем помощь с выбором,
если не определился (28.10.2026; на первом экране уже есть кнопка подбора).

**Ритм секции** — как у соседей (`PopularSection`, `FaqSection`, `ProSection`):
`<section className="bg-background py-10 md:py-14">`, внутри `container-app`.
40/56 px не из шкалы MASTER, но это фактический ритм главной; новые секции его
повторяют, а не «чинят» поодиночке.

**Шапка секции** (блог и видео; у новостей своя, см. §2):

```tsx
<div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
  <div className="max-w-[46ch]">
    <p className={`${LABEL} text-primary`}>{eyebrow}</p>
    <h2 id={titleId} className="mt-3 text-h2 [text-wrap:balance]">{title}</h2>
    <p className="mt-3 text-body text-muted-foreground [text-wrap:pretty]">{sub}</p>
  </div>
  {link && (
    <Link to={link.to} className={LINK_MORE}>
      {link.text}
      <span aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">→</span>
    </Link>
  )}
</div>
```

`<section aria-labelledby={titleId}>` у каждой секции.

**Дата** (блог и новости): `publishedAt ?? createdAt`, формат
`new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(' г.', '')`
→ «12 октября 2026». Разметка `<time dateTime={iso} className={`${LABEL} text-muted-foreground`}>`.

**Базовые стили `h3` из `index.css`** (`text-h3 font-bold leading-[1.12]`)
внутри карточек перебиваются явными классами из спека — не полагаться на базу.

**Загрузка и ошибки.** Пока идёт запрос — `return null` (секции ниже первого
экрана, скелетон не нужен). Ошибка сети или меньше минимума данных — `return null`,
секция не рендерится вовсе: ни заголовка, ни пустой рамки.

| Секция | Минимум, чтобы показать | Максимум |
|---|---|---|
| VideoReviewsSection | 3 ролика (после фильтра битых) | 12 |
| BlogSection | 3 поста (статьи и новости вместе) | 3 |

Блог при 1–2 статьях скрыт: сетка «большая + две» с дыркой читается как
недостроенная, а ссылка на `/blog` остаётся в навигации.

**Данные — для сведения `coder`/`architect`:** в `model Post`
(`server/prisma/schema.prisma`) поля `kind` сейчас нет, `coverImage` есть.
Спек предполагает `kind: 'article' | 'news'` и выборку «последние N по
`publishedAt desc`». Модели видеоотзывов нет; нужная форма:
`{ id, videoUrl, posterUrl, authorName, caption, product: { slug, name } | null }`.
Ролик без `videoUrl` или `posterUrl` отбрасывается до подсчёта минимума.

---

### 1. BlogSection

> Дельта 26.10.2026: плашка `md:w-[min(24rem,44%)]`, заголовок целиком на md+ (`md:line-clamp-none`; заголовки длиннее 90 символов — кегль 1.125rem), ховер серет заголовок вместо подчёркивания (§1.4). Значения ниже обновлены.

**Тексты.** Eyebrow «Журнал». H2 «Статьи об уходе». Подзаголовок «Разбираем
составы, порядок нанесения и уход по типу кожи.» Ссылка «Все статьи» → `/blog`.
`titleId = "home-blog-title"`. На `<section>` дополнительно `data-home="blog"`
(нужен новостям, §2).

**Композиция: одна главная статья + две.** Взято у референса: ряд плиток, где
одна плитка вдвое шире (у них «Бестселлеры»), и у бренда — карточка, наложенная
поверх фото. Не три одинаковые карточки.

Сетка: `grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4`

| Ширина | Контейнер (контент) | Главная (статья 1) | Статьи 2–3 |
|---|---|---|---|
| 390 | 342 px | на всю ширину: фото `aspect-[3/2]` (342×228), текст ниже фото на `bg-card` | строки 342 px: миниатюра 112×75 слева (`w-28 aspect-[3/2]`) |
| 768 | 672 px | `md:col-span-2`, `md:aspect-[3/2]` (672×448), плашка слева внизу | 2 колонки по 324 px, обложка `aspect-[3/2]` (324×216) |
| 1024 | 928 px | `md:aspect-[3/2]` (928×619) | 2 колонки по 452 px, обложка 452×301 |
| 1440 | 1248 px | `xl:col-span-2` (612 px), фото 612×408 (3:2), плашка 269×160 | по 294 px, обложка `aspect-[3/2]` (294×196) |
| 1920 | 1248 px (контейнер упирается в 1440) | как 1440 | как 1440 |

На `xl` сетка из 4 колонок: главная занимает 2, статьи 2 и 3 — по одной, все
в одном ряду одинаковой высоты (grid stretch).

#### 1.1 Главная статья с обложкой — фото целиком + плашка поверх

Обложки сгенерированы 3:2 (1600×1074): `object-cover` в рамке 3:2 показывает
кадр целиком. Левая треть кадра пустая под плашку, товар — в правых двух третях.

- **≥ 768:** рамка `aspect-[3/2]`, плашка абсолютная, слева внизу, шириной не
  больше `min(24rem, 44%)`, только дата и заголовок. Заголовок виден целиком
  (замер: 1440 — 269×160 из 612×408, 4 строки; 768 — 296×136 из 672×448).
  Длинный заголовок (> 90 символов) — кегль 1.125rem, на md+ без clamp: на 1440
  плашка 269×215 (≈ половина высоты кадра), текст не обрезан; яблоко у плашки
  не перекрыто, бутылка открыта. Решение по снимкам 390/768/1024/1440.
- **< 768:** фото 3:2 сверху целиком, текст (дата, заголовок, анонс в 2 строки)
  ниже фото на `bg-card`, без наложения.

```
article.group.relative.overflow-hidden.rounded-block.bg-muted
        md:col-span-2 md:aspect-[3/2] xl:col-span-2
        transition-transform duration-200 ease-out hover:-translate-y-1 active:scale-97
        motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100
  img  block aspect-[3/2] w-full object-cover md:absolute md:inset-0 md:aspect-auto md:h-full   alt=""  loading="lazy" decoding="async"
  div (плашка) bg-card p-5 md:absolute md:left-4 md:bottom-4 md:w-[min(24rem, 44%)] md:rounded-media md:p-4
    time  (LABEL, text-muted-foreground)
    h3    mt-2 font-heading text-[1.125rem] md:text-[1.25rem] font-bold leading-[1.2] text-foreground line-clamp-3 md:line-clamp-none
      Link (растянутая ссылка, см. 1.4)
    p     mt-2 text-body-sm leading-body text-muted-foreground line-clamp-2 md:hidden   (анонс только < 768)
    PostAdNote  mt-2
```

Плашка сплошная `bg-card` — контраст текста не зависит от фото (16.5:1 /
6.4:1). Это приём бренда «карточка поверх фото», а не карточка в карточке:
у плашки нет рамки и тени.

#### 1.2 Главная статья без обложки — типографская плитка

Та же геометрия (`aspect-*`, `xl:min-h-[26rem]`, hover), но:
`bg-accent text-accent-foreground flex flex-col justify-between p-6 md:p-8`.
- сверху `time` — `LABEL text-accent-foreground` (не muted: на золоте `muted-foreground` даёт 4.3:1 — ниже 4.5 для 11 px);
- снизу: `h3` `font-heading text-h3 font-bold leading-[1.12] [text-wrap:balance]`
  (20 → 32 px), под ним `p` `mt-3 max-w-[46ch] text-body leading-body line-clamp-3`.
  Весь текст `text-accent-foreground` (11.1:1). Золото здесь — крупная заливка,
  как разрешает MASTER; текстом золото не становится.

#### 1.3 Статьи 2 и 3

**< 768 — строка:**
```
article.group.relative.grid.grid-cols-[7rem_minmax(0,1fr)].items-center.gap-4
        rounded-block bg-card p-3  (+ те же hover/active, что у главной)
  img  w-28 aspect-[3/2] rounded-media object-cover  alt=""   (112×75, кадр целиком, без обрезки товара)
  div
    time (LABEL, text-muted-foreground)
    h3   mt-1 font-heading text-body font-semibold leading-[1.3] line-clamp-3
```
Анонс на телефоне у строк не показывается (`hidden md:line-clamp-3`) — иначе три
строки текста в 96-пиксельной строке, а он доступен на странице статьи.

**Без обложки — синяя типографская плитка** (значения из отчёта дизайнера, D2/D3):
`article`: `group relative flex flex-col rounded-block bg-primary p-5 text-primary-foreground md:p-6`
(+ hover/active как у карточки, на телефоне и на ≥ 768 одинаково);
`time`: `LABEL text-primary-foreground/80`;
`h3`: `mt-3 text-[1.25rem] leading-[1.2] font-bold [text-wrap:balance] line-clamp-4`
(шрифт заголовка — из базы `h3`);
анонс: `mt-3 text-body-sm leading-body text-primary-foreground/80 line-clamp-5`;
`PostAdNote` с `tone="text-primary-foreground/80"`;
ссылка-подпись `Читать статью →` (только ≥ 768, прижата вниз `mt-auto`):
`span aria-hidden="true" mt-auto hidden items-center gap-2 pt-6 font-heading text-body-sm font-semibold md:inline-flex`,
стрелка сдвигается на hover (`group-hover:translate-x-1`, с `motion-reduce` — без сдвига).
Текстовый блок — `flex flex-1 flex-col`. Карточка с обложкой остаётся `bg-card`.

**≥ 768 — вертикальная карточка:**
```
article.group.relative.flex.flex-col.overflow-hidden.rounded-block.bg-card  (+ hover/active)
  img  w-full object-cover aspect-[3/2]  alt=""   (без своего радиуса — режет карточка; 3:2 на всех ширинах, без xl-варианта)
  div  flex flex-1 flex-col p-5
    time (LABEL, text-muted-foreground)
    h3   mt-2 font-heading text-[1.0625rem] font-semibold leading-[1.25] line-clamp-3
    p    mt-2 text-body-sm leading-body text-muted-foreground line-clamp-3
```
Без обложки — плитка из раздела выше (картинки нет, карточка тянется по высоте
ряда, подпись «Читать статью» прижата вниз).

Один компонент, не два: строка становится карточкой классами `md:`.
`article`: `grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 p-3 md:flex md:flex-col md:items-stretch md:gap-0 md:p-0 md:overflow-hidden`;
`img`: `w-28 aspect-[3/2] rounded-media object-cover md:size-auto md:w-full md:aspect-[3/2] md:rounded-none`;
текстовый `div`: `md:flex md:flex-1 md:flex-col md:p-5`; `h3`: `text-body leading-[1.3] md:mt-2 md:text-[1.0625rem] md:leading-[1.25]`;
анонс: `hidden md:mt-2 md:line-clamp-3` (`line-clamp` сам ставит `display: -webkit-box`, `md:block` не добавлять).

#### 1.4 Ссылка, состояния, a11y

- Карточка — `<article>`, ссылка — в `h3`: `<Link to={`/blog/${slug}`}>` с
  растягиванием на всю карточку:
  `after:absolute after:inset-0 after:rounded-block after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring`.
  Имя ссылки = заголовок; дата и анонс не зачитываются внутри ссылки.
  У главной статьи с обложкой плашка абсолютная, и растянутая ссылка накрывает
  только её. Поэтому рядом с плашкой стоит второй оверлей на всю карточку:
  `<Link tabIndex={-1} aria-hidden="true" className="absolute inset-0">` (без фокуса,
  клик по фото ведёт на статью).
- Hover: подъём `-translate-y-1` 200 мс (как у карточки товара) + заголовок серет
  без подчёркивания, `transition-colors duration-200 ease-out motion-reduce:transition-none`:
  светлая карточка — `group-hover:text-muted-foreground` (6.4:1 на `bg-card`),
  плитка без обложки — `text-accent-foreground/70` (5.1:1 на `accent`),
  синяя плитка — `text-primary-foreground/70` (5.9:1 на `primary`).
- Фокус с клавиатуры: тот же цвет через `focus-visible:text-*` на самой ссылке
  (ссылка и есть фокусируемый элемент) + кольцо `after:outline` на всю карточку.
  У плитки без обложки контейнер без `overflow-hidden`, иначе кольцо обрезается.
- Active: `active:scale-97`, тот же transition 200 мс.
- Обложки `alt=""`: смысл несёт заголовок рядом, иначе скринридер читает
  его дважды. `width`/`height` на `<img>` проставлять (1200×800 по умолчанию),
  чтобы не было сдвига.
- Тач-цель — вся карточка, ≥ 96 px в высоту.

---

### 2. NewsSection — убрана 28.10.2026

С 28.10.2026 статьи и новости на главной в одной секции «Журнал» (`BlogSection`: метка «Статья / Новость» у даты, ссылки «Все статьи» → `/blog`, «Все новости» → `/news`; адреса постов — `postPath`, `/blog/<slug>` или `/news/<slug>`). Ниже — прежний спек для истории.


**Тексты.** H2 «Новости». Подзаголовок «Поступления, акции и изменения в работе
магазина.» Ссылка «Все новости» → `/blog?kind=news`. Eyebrow нет — секция
читается продолжением «Журнала». `titleId = "home-news-title"`.

**Связка с блогом.** Новости — одна белая панель сразу под блогом, как плитки
референса. `<section className="bg-background py-10 md:py-14 [[data-home=blog]+&]:pt-0">`:
если блог отрисован, верхний отступ снимается и панель встаёт на 40/56 px под
сеткой статей; если блог скрыт — у новостей обычный отступ.

**Панель:**
```
div.rounded-block.bg-card.p-6.md:p-8.xl:p-12.lg:grid.lg:grid-cols-12.lg:gap-6
  header  lg:col-span-4
    h2   text-h3 [text-wrap:balance]        (h2 по семантике, размер h3 — младше «Журнала»)
    p    mt-3 max-w-[32ch] text-body-sm leading-body text-muted-foreground
    Link mt-2 lg:mt-6 {LINK_MORE}  «Все новости →»
  ul      mt-2 -mb-4 lg:col-span-8 lg:-mt-4 divide-y divide-border
```

| Ширина | Раскладка | Ширина строки |
|---|---|---|
| 390 | шапка над списком | 294 px |
| 768 | шапка над списком | 608 px |
| 1440 / 1920 | шапка 4/12 слева, список 8/12 справа | ≈ 808 px |

**Строка новости:**
```
li
  Link.group.grid.items-center.gap-4.py-4.min-h-11.rounded-media
       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
       grid-cols-[4rem_minmax(0,1fr)] md:grid-cols-[5rem_minmax(0,1fr)_auto]      — с миниатюрами
       grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_auto]               — без миниатюр
    img   size-16 md:size-20 rounded-media object-cover  alt=""     (если миниатюры включены)
    div
      time  (LABEL, text-muted-foreground)
      h3    mt-1 font-heading text-body md:text-[1.125rem] font-semibold leading-[1.3] line-clamp-2
            group-hover:text-muted-foreground transition-colors (без подчёркивания)
      p     hidden md:mt-1 md:line-clamp-1 text-body-sm leading-body text-muted-foreground
    IconArrowRight size={20}  hidden md:block text-primary
            transition-transform duration-200 ease-out group-hover:translate-x-1
            motion-reduce:transition-none motion-reduce:group-hover:translate-x-0
```

**Правило миниатюр — всё или ничего:** миниатюры показываются, только если
обложка есть у **каждой** из выводимых новостей. Иначе — у всех без миниатюр.
Рваный столбец картинок через строку — хуже, чем список без картинок.

Строка без анонса (`excerpt` пуст) — просто без `p`, высоту не резервировать.
Тач-цель — вся строка, ≥ 72 px.

---

### 3. VideoReviewsSection

**Тексты.** Eyebrow «Отзывы». H2 «Покупатели о средствах». Подзаголовок
«Показывают средства, которыми пользуются, и рассказывают, как они подошли коже.»
Ссылки «все» нет. `titleId = "home-video-title"`.

**Структура:**
```
section.bg-background.py-10.md:py-14.overflow-x-clip   aria-labelledby="home-video-title"
  div.container-app → шапка секции (§0)
  div (сцена, во всю ширину секции, вне контейнера)
     role="region" aria-roledescription="карусель" aria-label="Видеоотзывы" tabIndex={0}
     className="relative mx-auto h-[calc(var(--vr-w)*16/9)] touch-pan-y select-none
                [--vr-w:14rem] md:[--vr-w:16.25rem] xl:[--vr-w:18.75rem] min-[1680px]:[--vr-w:21.25rem]
                focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring rounded-block"
     слайды …
  div.container-app → подпись и управление (§3.4)
```

#### 3.1 Размер активного ролика

| Ширина экрана | `--vr-w` | Активный ролик (9:16) | Видно соседей с каждой стороны |
|---|---|---|---|
| 390 (< 768) | 14rem | 224×398 px | 1 (±1, ≈ 83 px полосой) |
| 768 (768–1279) | 16.25rem | 260×462 px | 2 (±1, ±2) |
| 1440 (1280–1679) | 18.75rem | 300×533 px | 3 |
| 1920 (≥ 1680) | 21.25rem | 340×604 px | 3 |

Предел видимости `maxVisible`: `< 768 → 1`, `768–1279 → 2`, `≥ 1280 → 3`
(`useMediaQuery` из `hooks/useMediaQuery.ts`). Полный веер ±3 занимает
3,62 ширины ролика: 1086 px на 1440, 1231 px на 1920 — в экран влезает.

#### 3.2 Позиции coverflow

Слайд: `absolute top-0 left-[calc(50%_-_var(--vr-w)/2)] w-[var(--vr-w)] aspect-[9/16] rounded-block overflow-hidden bg-muted origin-center`
+ `shadow-[0_24px_48px_-24px_rgb(20_32_46_/_0.45)]` (тень статичная, не анимируется).
Трансформ инлайн: `transform: translateX(X) scale(S)`; `translateX` в % считается
от собственной ширины слайда (= `--vr-w`), потому что translate стоит в
записи первым.

`rel` — позиция относительно активного по кругу:
`rel = ((i - active) % n + n) % n; if (rel > n / 2) rel -= n`.

| rel | translateX | scale | Вуаль `bg-background`, opacity | z-index | Card opacity | Blur |
|---|---|---|---|---|---|---|
| 0 | 0% | 1 | 0 | 40 | 1 | нет |
| ±1 | ±62% | 0.84 | 0.35 | 30 | 1 | нет |
| ±2 | ±112% | 0.70 | 0.55 | 20 | 1 | нет |
| ±3 | ±152% | 0.58 | 0.75 | 10 | 1 | нет |
| \|rel\| > maxVisible | ±176% (знак rel) | 0.48 | 0.75 | 0 | 0, `pointer-events-none` | нет |

При чётном `n` слайд с `rel = n/2` всегда скрыт (opacity 0) — веер остаётся
симметричным.

Проверка «пирамидки»: каждый следующий выглядывает из-за предыдущего на одну и
ту же долю своей ширины (≈ 60%): ±1 — 0.54W из 0.84W, ±2 — 0.43W из 0.70W,
±3 — 0.34W из 0.58W.

**Вуаль, а не затемнение.** `absolute inset-0 pointer-events-none bg-background`
с инлайн `opacity`. Дальние ролики «уходят в туман» цвета страницы — на светлой
секции это читается глубиной; чёрное затемнение дало бы грязные серые пятна.
**Blur не используется:** `filter` на видео и постерах — не transform/opacity,
MASTER анимировать его запрещает, и это дорого на телефонах.

**Переход:** слайд и вуаль —
`transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none`
(`ease-out` = `cubic-bezier(0.23, 1, 0.32, 1)`). Прерываемость даёт сам CSS:
новый клик посреди перехода перенацеливает его с текущей точки.

**Перескок через шов круга.** Слайд, который за шаг меняет сторону
(`|newRel - oldRel| > n / 2`), не летит через всю сцену: на один кадр ему
ставится `transition: none`, `opacity: 0` и новая позиция, со следующего кадра
(`requestAnimationFrame` ×2) переход возвращается и он проявляется по opacity
300 мс на месте.

#### 3.3 Что играет

- `<video>` монтируется **только у активного**; у остальных — `<img src={posterUrl} alt="" className="h-full w-full object-cover" loading="lazy">`.
  Видео с тем же `poster` встаёт на место картинки без вспышки.
- Атрибуты: `muted={isMuted} playsInline loop preload="metadata" poster={posterUrl}`
  `aria-label={`Видеоотзыв: ${authorName}${product ? `, ${product.name}` : ''}`}`.
- Автозапуск активного — только если одновременно: сцена видна ≥ 50%
  (`IntersectionObserver`, `threshold: 0.5`), вкладка видима (`visibilitychange`),
  нет `prefers-reduced-motion: reduce`, нет `navigator.connection?.saveData`.
- Ушла из вида / вкладка скрыта → `pause()`. Вернулась → `play()`, но только
  если пользователь сам не ставил паузу.
- Смена активного: старый ролик размонтируется (то есть останавливается),
  новый стартует по тем же условиям.
- **Звук — состояние секции**, не слайда: включил звук — следующий активный тоже
  играет со звуком. По умолчанию `muted`.
- Автоперелистывания нет. Ролик крутится по кругу, листает только человек.

**Кнопки на активном ролике** (только на нём):
`absolute top-3 right-3 z-10 flex gap-2`, каждая
`inline-flex size-11 items-center justify-center rounded-pill bg-dark/70 text-dark-foreground backdrop-blur-sm hover:bg-dark/85 transition-transform duration-160 ease-out active:scale-97 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card`,
иконка 20 px.
1. Пауза/воспроизведение — `aria-label="Поставить на паузу"` / `"Воспроизвести"`.
   Обязательна: WCAG 2.2.2, движущийся контент дольше 5 секунд.
2. Звук — `aria-label="Включить звук"` / `"Выключить звук"`, `aria-pressed={!isMuted}`.

Тап по самому активному ролику (вне кнопок) — тоже пауза/воспроизведение.
При `prefers-reduced-motion` или `saveData` активный стоит на постере, по центру
кнопка 56 px `size-14` с иконкой play и `aria-label="Воспроизвести отзыв"` (тот же
стиль `bg-dark/70`).

Иконок звука и паузы в `components/icons/index.tsx` нет — добавить четыре по
образцу существующих (stroke 2, 24×24, контуры lucide):
`IconPlay` `<polygon points="6 3 20 12 6 21 6 3"/>`;
`IconPause` `<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>`;
`IconVolume` `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>`;
`IconVolumeOff` `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>`.

Видео-файлы: MP4 H.264, 720×1280, до 45 с, до 4 МБ; постер WebP 720×1280.
Если в ролике речь — желательно поле `captionsUrl` и `<track kind="captions" srcLang="ru">`.

#### 3.4 Подпись и управление

Под сценой, в `container-app`:
```
div.mx-auto.mt-6.grid.max-w-[34rem].grid-cols-[auto_minmax(0,1fr)_auto].items-start.gap-3.md:gap-6
  button «назад»
  div.text-center   (смена по ключу активного: opacity 0→1, 200 мс ease-out, motion-reduce:transition-none)
    p     font-heading text-body-sm font-semibold tabular-nums text-muted-foreground   «3 / 8»
    p     mt-2 font-heading text-body font-semibold text-foreground                   {authorName}
    p     mt-1 text-body-sm leading-body text-muted-foreground line-clamp-2           {caption}
    Link  mt-3 inline-flex min-h-11 items-center gap-2 rounded-pill border border-border-strong px-4
          text-body-sm font-semibold text-primary hover:bg-primary/5
          transition-transform duration-160 ease-out active:scale-97 motion-reduce:transition-none
          to={`/product/${product.slug}`}   {product.name} <span aria-hidden="true">→</span>
          (нет product — ссылки нет)
  button «вперёд»
p.sr-only aria-live="polite"   «Отзыв 3 из 8: {authorName}»
```

Кнопки-стрелки:
`inline-flex size-12 shrink-0 items-center justify-center rounded-pill border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-transform duration-160 ease-out active:scale-97 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`,
иконка `IconArrowRight size={20}` (у «назад» — `className="rotate-180"`),
`aria-label="Предыдущий отзыв"` / `"Следующий отзыв"`. Круг замкнут — кнопки
никогда не `disabled`. На 390 колонка подписи — 222 px.

#### 3.5 Листание

- **Стрелки** — ±1.
- **Клик/тап по боковому ролику** — он становится активным (шаг = его `rel`,
  все сдвигаются на столько же позиций одним переходом). Поверх бокового слайда
  `button absolute inset-0 z-[5] cursor-pointer` с
  `aria-label={`Показать отзыв ${i + 1}: ${authorName}`}` и `tabIndex={-1}` —
  с клавиатуры листают стрелками, лишние табы не нужны.
- **Клавиатура** — `ArrowLeft`/`ArrowRight` на `onKeyDown` сцены и блока
  подписи (ловится, где бы внутри ни был фокус), `preventDefault`.
- **Свайп** — Pointer Events на сцене, `touch-action: pan-y` (`touch-pan-y`):
  горизонталь > 40 px или скорость > 0.3 px/мс → шаг ±1 на отпускании.
  Карточка за пальцем не едет — дискретный шаг (MOTION 3). Вертикальный жест
  отдаётся странице.
- **Семантика слайда:** `role="group" aria-roledescription="слайд" aria-label="3 из 8"`;
  у неактивных `aria-hidden="true"`.

#### 3.6 `prefers-reduced-motion: reduce`

Позиции, масштаб и вуаль — те же (пирамида — это раскладка, а не движение),
но `transition-none`: смена мгновенная. Перескок через шов — без проявления.
Подпись — без fade. Автозапуска нет (§3.3). Hover-сдвиг стрелки ссылки и
`active:scale` — выключены.

#### 3.7 Исключение из `MOTION_INTENSITY=3`

**Что:** MASTER §6 разрешает только hover/active и короткие переходы без
авто-анимаций. Coverflow двигает до семи крупных элементов одним переходом,
а активный ролик воспроизводится сам.

**Почему допустимо:**
- Переход сцены — это пространственная связность, а не украшение: человек видит,
  куда ушёл предыдущий отзыв и с какой стороны пришёл новый. Мгновенная
  перестановка семи карточек без движения теряет ориентацию — непонятно, листнул
  ли ты вперёд или назад.
- Длительность и easing — из токенов MASTER (`duration-300`, `ease-out`), как у
  шторки корзины; анимируются только `transform` и `opacity`.
- Двигается только в ответ на действие человека: автоперелистывания нет.
- Видео — это содержимое отзыва, а не декор. Смягчено: без звука, только активный,
  только в зоне видимости, кнопка паузы, при reduced-motion и saveData — стоп.

Решение 23.10.2026.

#### 3.8 Объёмное кольцо (24.10)

Заменяет плоский веер §3.2: ролики стоят по дуге выпуклого кольца — «как вокруг
шара». Активный — в первом ряду лицом к зрителю; соседи уходят за край шара,
каждый следующий глубже, мельче, сильнее повёрнут и сильнее в «тумане». При
листании все карточки одновременно едут по дуге на соседнее место. Значения
проверены по снимку (вписаны инлайн-стилями в демо `?demo=sections`, 390 / 768 /
1440 / 1920). Где §3.8 расходится с §3.2, §3.6, §3.7, — действует §3.8.

**Сцена** (тот же `div` из §3, добавить два класса):
`[perspective:calc(var(--vr-w)*4)] [perspective-origin:50%_50%] motion-reduce:[perspective:none]`.

**`transform-style: preserve-3d` не ставить — ни на сцену, ни на слайды.**
Перспективы родителя хватает, чтобы у всех слайдов была общая точка схода, а
порядок наложения тогда задаёт `z-index` (пирамида). С `preserve-3d` браузер
сортирует слайды по глубине и режет пересекающиеся плоскости: на снимке
внутренний край ролика ±2 вылез поверх ролика ±1, `z-index` перестал работать,
под активным появился прямоугольный обрез тени.

**Слайд** — классы §3.2 плюс `[backface-visibility:hidden]`; переход меняется на
`transition-[transform,opacity] duration-[400ms] ease-out motion-reduce:transition-none`
(вуаль — тот же `duration-[400ms]`). Трансформ инлайн, порядок функций строго
такой (проценты `translateX` считаются от ширины слайда, только пока он первый):

```
transform: translateX(±X%) translateZ(calc(var(--vr-w) * -D)) rotateY(±R deg) scale(S)
```

Знак берётся от `rel`: справа (`rel > 0`) — `+X`, `+R`; слева — `−X`, `−R`.
`rotateY(+R)` уводит в глубину правый, внешний, край — кольцо выпуклое, внешние
края уходят за шар. Перевернуть знак `R` — получится вогнутый «амфитеатр»
(классический coverflow), это другой образ, не путать.

Позиции в долях ширины ролика `W = --vr-w` (одинаковы на всех ширинах):

| rel | translateX | translateZ | rotateY | scale | Вуаль | z-index | opacity |
|---|---|---|---|---|---|---|---|
| 0 | 0% | 0 | 0° | 1 | 0 | 40 | 1 |
| ±1 | ±72% | −0.30W | ±25° | 0.92 | 0.35 | 30 | 1 |
| ±2 | ±130% | −0.65W | ±38° | 0.84 | 0.55 | 20 | 1 |
| ±3 | ±176% | −1.05W | ±48° | 0.76 | 0.75 | 10 | 1 |
| \|rel\| > maxVisible (за шаром) | ±195% | −1.50W | ±56° | 0.68 | 0.75 | 0 | 0, `pointer-events-none` |

То же в пикселях (`translateZ` пишется через `calc(var(--vr-w) * -D)`, пиксели —
для сверки):

| Экран | `--vr-w` | perspective | Z ±1 | Z ±2 | Z ±3 | Z «за шаром» | Видно соседей |
|---|---|---|---|---|---|---|---|
| 390 | 224 | 896 px | −67 | — | — | −336 | ±1 |
| 768 | 260 | 1040 px | −78 | −169 | — | −390 | ±1, ±2 |
| 1440 | 300 | 1200 px | −90 | −195 | −315 | −450 | ±1…±3 |
| 1920 | 340 | 1360 px | −102 | −221 | −357 | −510 | ±1…±3 |

Что получается на экране (перспектива × scale): видимый масштаб центра соседей
≈ 0.86 / 0.72 / 0.60 — та же пирамидка, что в §3.2 (0.84 / 0.70 / 0.58).
Каждый сосед выглядывает из-за предыдущего на ~70% своей видимой ширины,
полосы сужаются к краю шара: 0.51W / 0.32W / 0.20W. Внешний край веера —
1.01W (±1), 1.33W (±2), 1.53W (±3) от центра: на 768 веер ±2 занимает 692 из
768 px, на 1440 веер ±3 — 916 px, на 1920 — 1038 px. На 390 сосед ±1 по-прежнему
режется краем экрана (`overflow-x-clip` секции), видна полоса ≈ 83 px — как в §3.1.

**Движение.** `400ms`, `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`), только
`transform` и `opacity`. Почему не 300 из §3.2: путь стал длиннее (сдвиг +
глубина + поворот), а у этого `ease-out` 80% пути проходит в первую треть — на
300 мс поворот читается рывком, и «прокрутка по шару» теряется. 400 мс — в
пределах 500 мс из `docs/core/motion.md` для крупных поверхностей. Все слайды
переходят одновременно, без задержек-лесенки: шар крутится целиком. Прерывание —
CSS сам перенацеливает переход с текущей точки (§3.2). Каждая функция
трансформа интерполируется отдельно, поэтому карточка поворачивается и уходит
в глубину на ходу — дуга читается без вычисления траектории.

**Карточка, перескакивающая через шов кольца** (`|newRel − oldRel| > n / 2`).
Через сцену не летит — уходит за шар и выходит с другой стороны:
1. Если старая поза видимая: на этот слайд ставится
   `transition: transform 160ms var(--ease-out), opacity 160ms var(--ease-out)`
   и поза «за шаром» на **старой** стороне, `opacity: 0`.
2. Через 160 мс (`setTimeout`, id в ref) — `transition: none`, поза «за шаром»
   на **новой** стороне, `opacity: 0`.
3. Через `requestAnimationFrame` ×2 — `transition` 240 мс `ease-out`, целевая
   поза и её `opacity`. Итого те же 400 мс, что у остального кольца.
Если старая поза уже была «за шаром» (`opacity: 0`), шаг 1 пропускается: сразу
шаг 2, затем шаг 3 с полными 400 мс. Новое листание посреди фаз — `clearTimeout`
и `cancelAnimationFrame`, слайд сразу идёт с шага 2. На последнем шаге
записывать в `style.transform` ровно ту строку, что рендерит React: React не
перезаписывает неизменившийся инлайн-стиль, и рассинхрон останется до
следующего листания. Этот механизм заменяет абзац «Перескок через шов круга» из
§3.2. Заметно на малом `n`: при `n = 2·maxVisible + 1` (5 роликов на 768,
7 на 1440) ролик с края уходит за шар и выходит с другого края у всех на виду.

**`backface-visibility: hidden`** — на слайде. Поворот не больше 56°, обратная
сторона штатно не видна; это страховка на шаги 2–3 и против мерцания
видеослоя в Safari при повороте. `will-change` постоянно не ставить.

**Тень** слайда остаётся статичной из §3.2 и поворачивается вместе с ним —
это правильно: тень «лежит» под карточкой на шаре.

**`prefers-reduced-motion: reduce`** — объёма нет: `perspective: none`,
`translateZ(0)`, `rotateY(0)`, раскладка и вуали — ровно плоская таблица §3.2
(62 / 112 / 152%, 0.84 / 0.70 / 0.58), `transition-none`, смена мгновенная,
шов — без фаз (сразу целевая поза). В коде: `pose()` выбирает таблицу кольца
или плоскую по `reduced`, строку трансформа собирает одна функция.

#### 3.9 Пометка «Пример отзыва» в режиме макета

Когда ролики демонстрационные (`?demo=sections`), на **каждой** карточке —
пометка «Пример отзыва». Признак один на секцию и берётся из того же условия,
по которому загружается `DEMO_VIDEOS` (`loadVideoReviews` возвращает и список,
и флаг `demo`; `VideoCoverflow` получает проп `demo: boolean`) — не по `id`
и не вторым вызовом `isDemoSections()` в разметке, чтобы пометка не разошлась
с данными, когда режим включат на проде.

**Место:** левый нижний угол карточки. Правый верх занят паузой и звуком
(§3.3), центр — кнопкой «Воспроизвести отзыв» при reduced-motion/saveData; низ
слева свободен на всех состояниях. Ширина пометки ≈ 130 px — на 390 (карточка
224 px) помещается с запасом.

```tsx
{demo && (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute bottom-3 left-3 rounded-pill bg-dark/70 px-3 py-1.5 font-heading text-label font-semibold uppercase tracking-wide text-dark-foreground backdrop-blur-sm"
  >
    Пример отзыва
  </span>
)}
```

Порядок в DOM: после `<video>/<img>`, **до** вуали — на боковых карточках
пометка уходит в туман вместе с роликом, а не висит поверх пирамиды
наклейкой. Контраст на активной: `#ECE5D5` на `dark/70` поверх светлого
постера ≈ 6:1.

Для экранного диктора визуальная пометка скрыта, текст — в именах:
`aria-label` видео — `Пример отзыва. Видеоотзыв: …`; live-строка —
`Отзыв 3 из 8 (пример): {authorName}`.

---

### 4. Что взято у референса (cosmomedica.shop) и что нет

**Взято:** скруглённые плитки на фоне страницы с узким зазором (у нас `gap-3` на
телефоне); одна плитка ряда вдвое шире остальных (главная статья); белая панель
со списком внутри (новости); спокойный заголовок плитки в левом верхнем углу;
много воздуха вокруг крупного медиа; отзывы как отдельный визуальный блок с
именем автора и датой/подписью.

**Не взято:** их серо-голубая палитра, их гротеск и регистр (у нас Montserrat
капсом в H2), пунктирная пагинация-«чёрточки» (у нас счётчик «3 / 8» — точнее и
доступнее), отзывы-карусель с обрезанным текстом и «Ещё».

### 5. Перед выкаткой

- Снимки 390 / 768 / 1440 / 1920 (`node .claude/scripts/screenshot.mjs`) —
  ревью `design-reviewer` по снимку, отдельно сцена видео с `--wait 400`.
- `ACTIVE_PROJECT=perfect-skin node .claude/scripts/design-lint.mjs <файлы>`.
- `rkn-compliance`: лица и имена покупателей в роликах — нужно письменное
  согласие на публикацию изображения (ст. 152.1 ГК РФ) и на обработку ПД.
  Зона `[клиент]`.

## Подбор ухода и консультация (`CtaTiles`, 28.10.2026)

Вариант C, утверждён владельцем (`references/cta-variant-c.png`), с правкой правой зоны.
- Одна плитка `press-tile grid overflow-hidden rounded-block bg-accent lg:grid-cols-12`: слева 5/12 — метка «Подбор ухода · 6 вопросов», h2, абзац, «Начать подбор» (растяжка на всю плитку); справа 7/12 — цельная сгенерированная картинка «ритуал из трёх шагов» `/photos/cta/quiz-ritual.webp` (1600×900, `-800.webp`; исходник `docs/projects/perfect-skin/media/cta/quiz-products-v2.png`), `pointer-events-none`, плашка `figcaption` «Программа ухода / Очищение · Сыворотка · Крем». На <lg картинка 16:9 под текстом.
- Консультация — строка-кнопка под плиткой, открывает `ConsultationPopup`: окно `max-w-md` по центру на md+, нижний лист на телефоне; телефон и часы — из `ContactsPopover`; кнопка `tel:`, вторичная ссылка на `/consultation`. Логика диалога — общий хук `hooks/useDialog.ts` (тот же, что у `SideDrawer`).

## FAQ «Вопросы и ответы» (`#faq`)

`client/src/components/home/FaqSection.tsx`. Заголовок и список — `max-w-3xl mx-auto`
(768px), центр контейнера на всех ширинах; заголовок выровнен по левому краю
списка (`text-left`, решение по снимку 1440). Телефон (< 768) не меняется: список
на всю ширину. Стрелка и выезд ответа, `<details>`, JSON-LD — без изменений.
Варианты раскладки на десктопе — в отчёте, не внедрены.
