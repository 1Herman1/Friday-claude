# Задача для Hermes: Pinterest → библиотека вкуса Nullume под баннеры слайдера

Полное ТЗ баннеров — `briefs/slider-banners.md`. Материалы товаров уже в
`media/client/slider-a/` (PEELING INTENSIVO), `slider-b/` (AQUA O3 + дермапен),
`slider-c/` (COLLAGEN BOOSTER).

Цель — подобрать **варианты расположения** (композиции товара, текста и
объектов) для каждого баннера, чтобы дизайнер-агент выбрал раскладку до
генерации. Pinterest — по ADR-007 только с Mac Германа.

## Что сделать на Mac

1. `NULLUME_LOCAL_IMPORTERS=1`, сессия Pinterest в `~/.nullume/sessions/pinterest.json`
   (или `pinterest-api` с токеном).
2. Импорт по запросам (по 15–25 пинов на запрос), с тегом баннера:
   - **bmg-slider-a** (пилинг): `skincare peeling product banner`, `chemical peel
     tube texture swatch`, `exfoliant product photography citrus`,
     `cosmetic tube gel drop still life`.
   - **bmg-slider-b** (сыворотки AQUA O3): `ampoule serum product line banner`,
     `skincare boxes and vials composition`, `dermapen microneedling product
     banner`, `serum bubbles clean aesthetic`.
   - **bmg-slider-c** (Collagen Booster): `serum dropper drop banner`,
     `glass skin serum advertising`, `dropper bottle hand product photo`,
     `skincare banner text left product right`.
   - **bmg-slider-layout** (общее): `cosmetics website hero slider`,
     `beauty ecommerce banner layout pink`, `skincare hero banner mobile`.
3. `nullume lib clusters` по каждому тегу → оставить 5–8 лучших на баннер:
   светлый фон, белый/тёплый серый/пыльно-розовый, много воздуха, товар
   крупно, место под текст слева. Убрать: тёмные, неоновые, с чужими лицами
   крупным планом, перегруженные.
4. Превью отобранных — в репозиторий, ветка `claude/greeting-nnz368`:
   `media/client/slider-a/pins/`, `slider-b/pins/`, `slider-c/pins/`,
   `media/client/slider-layout-pins/`. Рядом `pins.txt`: ссылка на пин и
   одна строка «что взять» (раскладка, свет, объект, подача текста).
5. Коммит, сообщение Герману.

## Правила

- Пины — **только идея раскладки и подачи**. В генерацию как картинки не
  передаём, чужие товары и лица не копируем (по сайту уже была досудебная
  претензия за чужое фото).
- Без логотипов чужих брендов в отобранном, где можно.
