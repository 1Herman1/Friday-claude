# Perfect Skin — контракт API, этап 1

Версия 1.0. Магазин B2C, одна цена (розничная). Pro-кабинета, профессионального
прайса и защиты профи-цен в этом контракте нет — соответствующие модели удаляются
параллельно, см. раздел 6.

Объём этапа: каталог, карточка, категории, бренды, корзина (гость + мерж),
оформление заказа, доставка СДЭК по порогам. Оплата (ЮKassa), Бьюти-клуб, блог,
админка — следующие этапы. Авторизация по СМС переносится из Симбы, здесь описан
только контракт и точки стыковки.

---

## 1. Общие правила

**Базовый префикс** — `/api/v1`. Регистрация: `app.register(catalogRoutes, { prefix: '/api/v1/products' })` и т. д. Версия в пути, не в заголовке.

**Деньги.** Все суммы — целые копейки (`Int`). `807700` = 8 077 ₽. Дробных денег в JSON нет нигде: ни на входе, ни на выходе. Форматирование в рубли — задача клиента.

**Единый формат ошибки.** Любой ответ с кодом ≥ 400:

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Недостаточно товара на складе", "details": { "itemId": "uuid", "available": 2 } } }
```

`details` — необязательный объект, присутствует только у ошибок, отмеченных в разделе 4. `message` — по-русски, для показа пользователю. `code` — машинный, `SCREAMING_SNAKE_CASE`, клиент ветвится только по нему.

Реализация: `server/src/lib/errors.ts` — класс `ApiError(status, code, message, details?)` и `app.setErrorHandler`. Ни один роут не отправляет `reply.status(400).send({ error: 'строка' })` (так в Симбе — не копировать).

**Валидация входа** — zod, `safeParse`, первая ошибка → `VALIDATION_ERROR` с `details: { field: "quantity" }`. Числа из query — через `z.coerce.number()`.

**Схемы ответов Fastify обязательны.** У каждого роута задан `schema.response` для всех отдаваемых кодов. Это сетка на выходе: сериализатор Fastify выбрасывает поля, не описанные в схеме. Профессиональных цен больше нет, но привычка остаётся — она же защищает от утечки `adminNote`, `passwordHash`, `otpFailedCount`, `externalId`.

Общие схемы регистрируются один раз через `app.addSchema` в `server/src/schemas/common.ts`:

```ts
app.addSchema({
  $id: 'ps.error',
  type: 'object', additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object', additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object', additionalProperties: true },
      },
    },
  },
})
```

Далее в роутах: `response: { 200: { $ref: 'ps.cart#' }, 404: { $ref: 'ps.error#' } }`.
`additionalProperties: false` — во всех схемах ответа без исключений.

**Пагинация** — `limit`/`offset` (не `page`, в отличие от Симбы). Дефолт `limit=24`, максимум `60`. Ответ листингов всегда:

```json
{ "items": [], "total": 57, "limit": 24, "offset": 0 }
```

**Множественные значения фильтров** — повтором параметра: `?need=hydration&need=firming`. Zod: `z.union([z.string(), z.array(z.string())]).transform(v => Array.isArray(v) ? v : [v])`. Запятая-разделитель не поддерживается (в значениях бывают дефисы и это провоцирует ошибки экранирования).

**Логика сочетания фильтров:** внутри одной группы — ИЛИ, между группами — И.
`?brand=isseimi&need=hydration&need=firming` = бренд ISSEIMI И (увлажнение ИЛИ лифтинг).

**Гостевая сессия.** Подписанная httpOnly-cookie `ps_sid`, значение — UUID v4.
`@fastify/cookie` с `secret: process.env.PS_COOKIE_SECRET`, параметры: `httpOnly: true`, `sameSite: 'lax'`, `secure: NODE_ENV === 'production'`, `path: '/'`, `maxAge: 180 * 24 * 3600`. Ставится сервером при первом создании корзины. `sessionId` **никогда** не читается из query или тела запроса — только из подписанной cookie: иначе чужая корзина открывается подбором строки.

**Авторизация.** JWT Bearer, срок 7 дней, payload `{ userId, role, tv }`, где `tv` — `User.tokenVersion`. `app.authenticate` при каждом запросе читает из БД `isActive`, `deletedAt`, `tokenVersion` и отклоняет токен при расхождении (`UNAUTHORIZED`). `app.authenticateOptional` — для каталога и корзины: гость это нормальный сценарий, а не ошибка.

**CORS** — `@fastify/cors`, `origin: process.env.PS_CORS_ORIGIN.split(',')`, `credentials: true` (обязательно, иначе cookie корзины не поедет).

**Rate limit** — `@fastify/rate-limit`, глобально 120 запросов/мин по IP. Персональные лимиты указаны у эндпоинтов. Счётчики попыток входа — в БД (`User.otpFailedCount`, `otpBlockedUntil`), не в `Map` в памяти процесса: при рестарте или втором инстансе защита из памяти обнуляется.

**Кеширование.** Каталог, категории, бренды, линейки: `Cache-Control: public, max-age=60, stale-while-revalidate=300`. Корзина, заказы, auth: `Cache-Control: no-store`.

---

## 2. Таблица эндпоинтов

| Метод | Путь | Назначение | Авторизация |
|---|---|---|---|
| GET | `/api/v1/products` | Листинг каталога: фильтры, сортировка, пагинация | нет |
| GET | `/api/v1/products/facets` | Счётчики значений фильтров при текущем наборе фильтров | нет |
| GET | `/api/v1/products/:slug` | Карточка товара | нет |
| GET | `/api/v1/categories/tree` | Дерево категорий с числом товаров | нет |
| GET | `/api/v1/categories/:slug` | Одна категория: имя, описание, SEO | нет |
| GET | `/api/v1/brands` | Список брендов с числом товаров | нет |
| GET | `/api/v1/brands/:slug` | Один бренд + его линейки | нет |
| GET | `/api/v1/lines` | Линейки (фильтр), опционально в рамках бренда | нет |
| GET | `/api/v1/cart` | Текущая корзина (гость по cookie, клиент по токену) | опциональная |
| POST | `/api/v1/cart/items` | Добавить фасовку в корзину | опциональная |
| PATCH | `/api/v1/cart/items/:itemId` | Изменить количество (0 = удалить) | опциональная |
| DELETE | `/api/v1/cart/items/:itemId` | Удалить позицию | опциональная |
| DELETE | `/api/v1/cart` | Очистить корзину | опциональная |
| GET | `/api/v1/delivery/methods` | Способы доставки и их стоимость по текущей корзине | опциональная |
| POST | `/api/v1/promo/validate` | Проверить промокод на текущей корзине | опциональная |
| POST | `/api/v1/orders` | Оформить заказ из корзины | обязательная |
| GET | `/api/v1/orders` | Свои заказы, список | обязательная |
| GET | `/api/v1/orders/:number` | Свой заказ по номеру | обязательная |
| POST | `/api/v1/auth/send-otp` | Выслать код входа по СМС | нет |
| POST | `/api/v1/auth/verify-otp` | Подтвердить код, выдать токен, слить корзину | нет |
| GET | `/api/v1/auth/me` | Текущий пользователь | обязательная |
| POST | `/api/v1/auth/logout` | Обесценить все токены (`tokenVersion++`) | обязательная |
| GET | `/api/v1/health` | Живость сервиса и доступность БД | нет |

---

## 3. Эндпоинты подробно

### 3.1 Переиспользуемые формы ответа

**`ps.variant`** — фасовка:

```json
{
  "id": "uuid",
  "volumeValue": 50,
  "volumeUnit": "ml",
  "volumeLabel": "50 мл",
  "retailPrice": 807700,
  "oldRetailPrice": 1189200,
  "stock": 12,
  "sku": "ISS-0042"
}
```

Типы: `volumeValue: number` (Prisma `Decimal(7,2)` → `Number(v)`, хвостовые нули срезать), `volumeUnit: 'ml'|'g'|'pcs'`, остальные `integer`, `oldRetailPrice` и `sku` — nullable.
`volumeLabel`: если в БД `null`, сервер собирает сам — `${volumeValue} ${{ml:'мл',g:'г',pcs:'шт'}[volumeUnit]}`. Клиент label никогда не собирает.

**`ps.productCard`** — карточка в листинге:

```json
{
  "id": "uuid",
  "slug": "krem-bee-venom",
  "name": "Подарочный набор «Bee Venom»…",
  "brand": { "id": "uuid", "name": "ISSEIMI", "slug": "isseimi" },
  "line":  { "id": "uuid", "name": "ISSEIMI Base", "slug": "isseimi-base" },
  "image": "https://…/bee-venom.jpg",
  "skinTypes": ["all_types"],
  "needs": ["firming", "radiance", "regeneration"],
  "minPrice": 1117600,
  "oldPrice": 1596600,
  "inStock": true,
  "variants": [ /* ps.variant */ ]
}
```

`brand`, `line`, `image`, `oldPrice` — nullable. `image` = `images[0]`. `minPrice` = минимальная `retailPrice` среди активных фасовок. `oldPrice` = `oldRetailPrice` фасовки с этой минимальной ценой, `null` если нет. `inStock` = сумма `stock` активных фасовок > 0.
Фасовки в `variants` отдаются в порядке `volumeValue asc`, только `isActive: true, deletedAt: null`.

---

### 3.2 `GET /api/v1/products`

Листинг каталога.

**Параметры запроса**

| Параметр | Тип / валидация | Дефолт | Смысл |
|---|---|---|---|
| `category` | `string`, `^[a-z0-9-]{1,64}$` | — | Slug категории. Учитываются товары самой категории и всех её потомков |
| `brand` | `string` или массив, тот же regex | — | Slug бренда, ИЛИ внутри группы |
| `line` | `string` или массив, тот же regex | — | Slug линейки |
| `need` | `enum Concern`, одиночный или массив | — | Ключевая потребность (`keyNeeds` из разметки) |
| `skin` | `enum SkinType` без `all_types`, одиночный или массив | — | Тип кожи |
| `minPrice` | `int`, 0 … 100 000 000, копейки | — | Нижняя граница цены фасовки |
| `maxPrice` | `int`, 0 … 100 000 000, копейки, ≥ `minPrice` | — | Верхняя граница |
| `sort` | `price_asc \| price_desc \| newest \| popular` | `newest` | Сортировка |
| `limit` | `int`, 1 … 60 | `24` | Размер страницы |
| `offset` | `int`, 0 … 5000 | `0` | Смещение |

`minPrice > maxPrice` → `VALIDATION_ERROR`, `details: { field: "maxPrice" }`.
Неизвестное значение `need`/`skin`/`sort` → `VALIDATION_ERROR` (не молчаливое игнорирование: иначе опечатка в клиенте даёт «фильтр не работает» без следа).

**Семантика фильтров**

- `category`: собрать `categoryId` по slug + рекурсивно `children` (в текущих данных дерево плоское, но обход обязателен), затем `categories: { some: { categoryId: { in: ids } } }`.
- Цена — по существованию подходящей фасовки: `variants: { some: { isActive: true, deletedAt: null, retailPrice: { gte, lte } } }`. Не по денормализованным `Product.minPrice/maxPrice`: у товара с фасовками 500 ₽ и 5 000 ₽ пересечение диапазонов дало бы ложное попадание в фильтр 1 000–2 000 ₽.
- `skin`: `skinTypes: { hasSome: [...запрошенные, 'all_types'] }` — универсальное средство обязано попадать в любой запрос по типу кожи.
- `need`: `concerns: { hasSome: [...] }`.
- Всегда добавляется база: `isActive: true, deletedAt: null` и `variants: { some: { isActive: true, deletedAt: null } }` (товар без живых фасовок в каталоге не показывается).

**Сортировки**

- `price_asc` / `price_desc` → `orderBy: [{ minPrice: 'asc'|'desc' }, { id: 'asc' }]` по денормализованному полю (см. 5.2). Второй ключ `id` обязателен: без него страницы 2 и 3 при равных ценах перемешиваются.
- `newest` → `[{ createdAt: 'desc' }, { id: 'asc' }]`.
- `popular` → продажи за 90 дней: `orderItem.groupBy({ by: ['productId'], _sum: { quantity: true }, where: { createdAt: { gte: -90д }, order: { status: { not: 'cancelled' } } } })`, результат кешируется в памяти на 10 минут. Итоговый порядок: `units desc → isFeatured desc → createdAt desc → id asc`. Реализация: выбрать `id` всех товаров, подходящих под фильтр, отсортировать в памяти, взять срез `limit/offset`, добрать `findMany({ where: { id: { in: pageIds } } })` и восстановить порядок по массиву. Ограничение: если отфильтрованных товаров > 1000, сортировка молча деградирует до `newest` и пишет `app.log.warn` — на каталоге в 57 позиций это недостижимо, но защищает от деградации при росте.

**Ответ 200**

```json
{ "items": [ /* ps.productCard */ ], "total": 57, "limit": 24, "offset": 0 }
```

**Ошибки:** `400 VALIDATION_ERROR`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR`.

---

### 3.3 `GET /api/v1/products/facets`

Счётчики для панели фильтров. Принимает **тот же набор параметров**, что и листинг, кроме `sort`, `limit`, `offset` (передача любого из трёх → `VALIDATION_ERROR`).

Правило подсчёта: счётчик каждой группы считается по фильтрам **всех остальных** групп, но без своей. Иначе выбор бренда ISSEIMI обнулил бы счётчик GLACÉE и второй бренд стал бы недоступен для клика.

**Ответ 200**

```json
{
  "categories": [ { "value": "syvorotki", "label": "Сыворотки", "count": 7 } ],
  "brands":     [ { "value": "isseimi", "label": "ISSEIMI", "count": 41 } ],
  "lines":      [ { "value": "isseimi-base", "label": "ISSEIMI Base", "count": 16 } ],
  "needs":      [ { "value": "hydration", "label": "Увлажнение", "count": 23 } ],
  "skinTypes":  [ { "value": "oily", "label": "Жирная / проблемная", "count": 9 } ],
  "price":      { "min": 145800, "max": 1468000 }
}
```

Все массивы отсортированы по `count desc`, затем `label asc`. Значения со счётчиком `0` отдаются тоже (клиент показывает их выключенными — исчезающие фильтры дезориентируют).
`price.min/max` — по активным фасовкам при остальных фильтрах, без учёта самих `minPrice/maxPrice`.

Реализация: один `findMany` с `select: { id, brandId, lineId, skinTypes, concerns, categories: { select: { categoryId } }, variants: { select: { retailPrice } } }` по базовым фильтрам, дальше агрегация в памяти. Допустимо, пока товаров < 500; при росте — материализованное представление. Порог зафиксировать комментарием в коде.

`label` берётся: категории/бренды/линейки — из БД; `needs`/`skinTypes` — из серверного словаря `server/src/lib/dictionaries.ts` (см. 5.3). Клиент словарь перечислений не хранит.

---

### 3.4 `GET /api/v1/products/:slug`

**Параметры:** `slug` в пути, `^[a-z0-9-]{1,120}$`.

**Ответ 200** — `ps.productCard` плюс:

```json
{
  "images": ["https://…/1.jpg"],
  "shortDescription": "string|null",
  "description": "string",
  "usage": "string|null",
  "inciText": "string|null",
  "ingredients": [ { "name": "Гиалуроновая кислота", "slug": "gialuronovaya-kislota", "concentration": "2%", "isKey": true } ],
  "categories": [ { "name": "Сыворотки", "slug": "syvorotki" } ],
  "seo": { "title": "string|null", "description": "string|null" }
}
```

`ingredients` сортируются `isKey desc, sortOrder asc, name asc`.
Товар с `isActive: false` или `deletedAt != null` → `404 PRODUCT_NOT_FOUND` (не 410: клиенту нужен один сценарий).

**Ошибки:** `400 VALIDATION_ERROR`, `404 PRODUCT_NOT_FOUND`.

---

### 3.5 `GET /api/v1/categories/tree`

Параметров нет.

**Ответ 200** — массив корней:

```json
[ { "id": "uuid", "name": "Кремы для лица и шеи", "slug": "kremy-dlya-litsa-i-shei", "image": "string|null", "productCount": 17, "children": [] } ]
```

`productCount` — активные товары самой категории и всех потомков (в текущих данных потомков нет, суммирование всё равно реализовать). Порядок: `sortOrder asc, name asc`. Отдаются только `isActive: true, deletedAt: null`. Категории с `productCount = 0` в выдачу **не попадают** — пункт меню, ведущий в пустой каталог, это дефект.

---

### 3.6 `GET /api/v1/categories/:slug`

**Ответ 200:**

```json
{ "id": "uuid", "name": "Сыворотки", "slug": "syvorotki", "description": "string|null", "image": "string|null", "productCount": 7,
  "parent": { "name": "string", "slug": "string" },
  "seo": { "title": "string|null", "description": "string|null" } }
```

`parent` — nullable. **Ошибки:** `404 CATEGORY_NOT_FOUND`.

---

### 3.7 `GET /api/v1/brands` и `GET /api/v1/brands/:slug`

Список:

```json
[ { "id": "uuid", "name": "ISSEIMI", "slug": "isseimi", "logo": "string|null", "productCount": 41 } ]
```

Только бренды, у которых есть активные товары. Порядок: `sortOrder asc, name asc`.

Один бренд:

```json
{ "id": "uuid", "name": "ISSEIMI", "slug": "isseimi", "logo": "string|null",
  "description": "string|null", "country": "Испания", "manufacturer": "Heber Farma",
  "productCount": 41,
  "lines": [ { "id": "uuid", "name": "ISSEIMI Base", "slug": "isseimi-base", "productCount": 16 } ],
  "seo": { "title": "string|null", "description": "string|null" } }
```

**Ошибки:** `404 BRAND_NOT_FOUND`. Отдельно отмечено: на действующем сайте `/isseimi/` и `/glacee-skincare/` отдают 404 — этот эндпоинт закрывает дефект, slug-и должны совпасть с историческими URL.

---

### 3.8 `GET /api/v1/lines`

**Параметры:** `brand` — slug, опционально.

**Ответ 200:**

```json
[ { "id": "uuid", "name": "ISSEIMI MD", "slug": "isseimi-md", "brand": { "name": "ISSEIMI", "slug": "isseimi" }, "productCount": 6 } ]
```

Порядок: бренд `sortOrder`, затем `ProductLine.sortOrder`, затем имя. Линейки без активных товаров не отдаются.
Ожидаемые 4 значения: `isseimi-base`, `isseimi-md`, `isseimi-nat-collection`, `glacee-skincare-man-line`. У 10 из 57 товаров линейки нет — это норма, фильтр их просто не покрывает.

---

### 3.9 Корзина: определение владельца

Единая функция `resolveCartOwner(request): { userId: string } | { sessionId: string }` в `server/src/services/cart.service.ts`:

1. Есть валидный Bearer-токен → `{ userId }`.
2. Иначе есть подписанная cookie `ps_sid` → `{ sessionId }`.
3. Иначе — владельца нет. На `GET` возвращается пустая корзина без записи в БД и без cookie. На пишущих методах сервер генерирует `sessionId = randomUUID()`, ставит cookie и создаёт `Cart`.

Корзина ищется как `cart.findUnique({ where: { userId } })` либо `{ sessionId }`.
Слияние гостевой корзины с пользовательской происходит **только** в `POST /auth/verify-otp`. `GET /cart` авторизованного пользователя гостевую корзину не подхватывает и не сливает: неявные слияния при каждом чтении дают непредсказуемые количества.

---

### 3.10 `GET /api/v1/cart`

Параметров нет. Заголовок `Cache-Control: no-store`.

**Ответ 200 (`ps.cart`)**

```json
{
  "id": "uuid|null",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "variantId": "uuid",
      "quantity": 2,
      "product": { "name": "string", "slug": "string", "image": "string|null", "brandName": "ISSEIMI" },
      "variant": { "volumeLabel": "50 мл", "retailPrice": 807700, "oldRetailPrice": null, "stock": 12 },
      "lineTotal": 1615400
    }
  ],
  "itemsCount": 2,
  "subtotal": 1615400,
  "warnings": [ { "code": "STOCK_REDUCED", "itemId": "uuid", "available": 1, "message": "Осталась 1 шт." } ]
}
```

`id: null` и пустой массив — если корзины ещё нет.
Цена позиции **не хранится** в БД, а читается из `ProductVariant.retailPrice` при каждом чтении (требование схемы).
`warnings` строится на чтении, ничего не меняя в БД:
- `STOCK_REDUCED` — `variant.stock < quantity` (`available` = текущий остаток);
- `ITEM_UNAVAILABLE` — фасовка деактивирована или мягко удалена (`available: 0`).
Позиции с предупреждениями остаются в выдаче и в `subtotal` не учитываются, если `ITEM_UNAVAILABLE`. Клиент показывает их отдельно; чистка происходит на оформлении.
`itemsCount` — сумма количеств (не число строк).

---

### 3.11 `POST /api/v1/cart/items`

**Тело:**

```json
{ "variantId": "uuid", "quantity": 1 }
```

`variantId` — `z.string().uuid()`, обязателен. `quantity` — `z.number().int().min(1).max(99)`.

**Логика:** фасовка должна быть `isActive: true, deletedAt: null`, у товара — `isActive: true, deletedAt: null`, `retailPrice > 0` (импорт заводит позиции без цены — продавать нельзя). Если строка с этой фасовкой уже есть, количества суммируются; итог проверяется по `stock`. Максимум 50 строк в корзине.

**Ответ 201** — `ps.cart` целиком (клиент не досчитывает состояние сам).
**Ошибки:** `400 VALIDATION_ERROR`, `404 VARIANT_NOT_FOUND`, `409 ITEM_UNAVAILABLE`, `409 OUT_OF_STOCK` (`details: { available }`), `409 CART_ITEM_LIMIT`.
**Лимит:** 60 запросов/мин по IP.

---

### 3.12 `PATCH /api/v1/cart/items/:itemId`

**Тело:** `{ "quantity": 3 }`, `z.number().int().min(0).max(99)`. `0` — удалить позицию.
`itemId` — uuid в пути.

Принадлежность позиции корзине текущего владельца обязательна. Чужая или несуществующая позиция → `404 CART_ITEM_NOT_FOUND` (не 403: 403 подтверждает существование чужого объекта).

**Ответ 200** — `ps.cart`.
**Ошибки:** `400 VALIDATION_ERROR`, `404 CART_ITEM_NOT_FOUND`, `409 OUT_OF_STOCK`.

Метод `PATCH`, а не `PUT` как в Симбе: тело содержит одно изменяемое поле, а не полное состояние позиции.

---

### 3.13 `DELETE /api/v1/cart/items/:itemId` и `DELETE /api/v1/cart`

Оба отдают `200` с `ps.cart` (после удаления — с пустым `items`).
`DELETE /cart/items/:itemId` — ошибки как у PATCH.
`DELETE /cart` — если корзины нет, всё равно `200` с пустой корзиной (идемпотентность).

---

### 3.14 `GET /api/v1/delivery/methods`

Стоимость доставки по текущей корзине. Внешних вызовов к API СДЭК на этапе 1 нет — только пороги из `@ps/shared`.

**Параметры:** `promo` — `string`, 3…32, `^[A-Za-z0-9_-]+$`, опционально.

**Логика:** взять корзину владельца, посчитать `subtotal` по живым позициям, применить промокод (если валиден), затем `calcDeliveryCost(method, goodsAfterDiscount)` из `@ps/shared`. Порог считается **после скидки** — зафиксированное допущение ADR.

Соответствие перечислений (функция `toCalcMethod` в `server/src/lib/delivery.ts`, единственное место связи):

| `DeliveryMethod` (Prisma / API) | Аргумент `@ps/shared` | Порог бесплатной |
|---|---|---|
| `pickup` | `'pickup'` | всегда 0 ₽ |
| `cdek_pvz` | `'pvz'` | `FREE_PVZ_THRESHOLD` = 600 000 коп. |
| `cdek_courier` | `'courier'` | `FREE_COURIER_THRESHOLD` = 1 000 000 коп. |

Платная доставка — `DELIVERY_COST` = 20 000 коп. Числа в код не вписывать, импортировать константы.

**Ответ 200:**

```json
{
  "subtotal": 550000,
  "promo": { "code": "ANNA15", "percent": 15, "discount": 82500 },
  "goodsAfterDiscount": 467500,
  "methods": [
    { "code": "pickup", "title": "Самовывоз", "hint": "Москва, Звенигородское шоссе, 3Ас1", "cost": 0, "isFree": true, "freeFrom": null, "amountToFree": 0, "requiresAddress": false, "requiresPvzCode": false },
    { "code": "cdek_pvz", "title": "СДЭК — пункт выдачи или постамат", "hint": "Бесплатно от 6 000 ₽", "cost": 20000, "isFree": false, "freeFrom": 600000, "amountToFree": 132500, "requiresAddress": false, "requiresPvzCode": true },
    { "code": "cdek_courier", "title": "СДЭК — курьер", "hint": "Бесплатно от 10 000 ₽", "cost": 20000, "isFree": false, "freeFrom": 1000000, "amountToFree": 532500, "requiresAddress": true, "requiresPvzCode": false }
  ]
}
```

`promo: null`, если код не передан или невалиден (эндпоинт при этом не падает — валидацию с внятной причиной делает `/promo/validate`).
`amountToFree` = `max(0, freeFrom - goodsAfterDiscount)`, для `pickup` всегда `0`. Это и есть строка «до бесплатной доставки не хватает столько-то» — клиент её не вычисляет.
Пустая корзина → `409 CART_EMPTY`.

---

### 3.15 `POST /api/v1/promo/validate`

**Тело:** `{ "code": "ANNA15" }`, `z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/)`. Перед поиском — `toUpperCase()` (в БД коды в верхнем регистре).

**Условия годности** (все обязательны): `isActive: true`, `deletedAt: null`, `startsAt == null || startsAt <= now`, `expiresAt == null || expiresAt >= now`, `maxRedemptions == null || usedCount < maxRedemptions`, `minOrderAmount == null || minOrderAmount <= subtotal`.

**Ответ 200:**

```json
{ "code": "ANNA15", "percent": 15, "discount": 82500, "subtotal": 550000 }
```

`discount = Math.round(subtotal * percent / 100)` — считать **только** через `calcOrderTotals` из `@ps/shared`, чтобы округление совпадало с заказом до копейки.

**Ошибки:** `400 VALIDATION_ERROR`, `404 PROMO_NOT_FOUND` (нет кода / неактивен / истёк — единый ответ, чтобы код нельзя было подбирать по разнице сообщений), `409 PROMO_MIN_AMOUNT` (`details: { minOrderAmount }`), `409 CART_EMPTY`.
**Лимит:** 20 запросов/мин по IP — перебор кодов.

---

### 3.16 `POST /api/v1/orders`

Оформление заказа. Авторизация **опциональна**: вошедший пользователь создаёт заказ из своей корзины, гость — из session-корзины. Заказ всегда привязывается к аккаунту пользователя (`Order.userId` не nullable): для вошедшего — это `request.user.id`, для гостя — аккаунт найден/создан по `recipient.email` (на его email придёт подтверждение заказа). Гостевая корзина очищается независимо от дальнейшей авторизации.

**Тело:**

```json
{
  "deliveryMethod": "cdek_pvz",
  "cdekPvzCode": "MSK123",
  "address": { "city": "Москва", "street": "Ленинский проспект", "house": "10", "apartment": "5", "postalCode": "119049" },
  "recipient": { "name": "Анна Рыбко", "phone": "+79996512551", "email": "a@example.com" },
  "promoCode": "ANNA15",
  "comment": "Позвонить перед доставкой",
  "expectedTotal": 487500
}
```

| Поле | Валидация | Обязательность |
|---|---|---|
| `deliveryMethod` | `z.enum(['pickup','cdek_pvz','cdek_courier'])` | всегда |
| `cdekPvzCode` | `^[A-Z0-9-]{2,20}$` | только при `cdek_pvz`, иначе поле запрещено |
| `address.city` | 2…80 | только при `cdek_courier` |
| `address.street` | 2…120 | только при `cdek_courier` |
| `address.house` | 1…20 | только при `cdek_courier` |
| `address.apartment` | ≤ 20 | опционально |
| `address.postalCode` | `^\d{6}$` | только при `cdek_courier` |
| `recipient.name` | 2…80 | всегда |
| `recipient.phone` | `^\+7\d{10}$` | всегда |
| `recipient.email` | `z.string().email()` | опционально |
| `promoCode` | как в 3.15 | опционально |
| `comment` | ≤ 500 | опционально |
| `expectedTotal` | `int ≥ 0`, копейки | всегда |

Проверки сочетаний: `cdek_pvz` без `cdekPvzCode` → `400 PVZ_CODE_REQUIRED`; `cdek_courier` без `address` → `400 ADDRESS_REQUIRED`; `pickup` с адресом или кодом ПВЗ → `400 VALIDATION_ERROR` (лишние данные молча не выбрасываем).

**Порядок выполнения** — одна транзакция `prisma.$transaction`, внешних HTTP-вызовов внутри нет (стоимость доставки считается формулой, держать транзакцию на сетевом вызове нельзя):

1. Взять корзину пользователя с позициями, товарами и фасовками. Пустая → `409 CART_EMPTY`.
2. Любая позиция с неактивной/удалённой фасовкой или товаром → `409 ITEM_UNAVAILABLE`, `details: { itemId, productName }`.
3. Условное списание остатков по каждой позиции: `productVariant.updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } })`. `count === 0` → `409 OUT_OF_STOCK`, `details: { itemId, productName }`. Предварительная проверка отдельным `SELECT` не заменяет условие в `UPDATE`: между чтением и записью второй покупатель забирает последнюю банку.
4. Промокод: повторная валидация внутри транзакции (данные из шага 3.15 доверия не имеют) + условный инкремент `promoCode.updateMany({ where: { id, OR: [{ maxRedemptions: null }, { usedCount: { lt: maxRedemptions } }] }, data: { usedCount: { increment: 1 } } })`. `count === 0` → `409 PROMO_EXHAUSTED`.
5. `calcOrderTotals({ items, priceList: 'retail', promo, deliveryMethod: toCalcMethod(...) })` из `@ps/shared`. `priceList` — жёсткая константа `'retail'`: второго прайса в B2C нет.
6. Сверка `expectedTotal !== total` → `409 TOTAL_MISMATCH`, `details: { subtotal, promoDiscount, deliveryCost, total }`. Допуск нулевой: все слагаемые детерминированы, расхождение означает устаревшую корзину у клиента.
7. Номер заказа: `SELECT nextval('order_number_seq')` → `PS-` + `String(n).padStart(6, '0')`.
8. Создать `Order` и `OrderItem[]` со снимками: `productName`, `brandName`, `volumeLabel` (уже отформатированный), `price` (розничная на момент заказа), `quantity`.
9. При примененном промокоде — `PromoCodeRedemption`: `orderId`, `userId`, `discountAmount`, `orderSubtotal`, `perUserKey` = HMAC-SHA256(`userId`, `PS_PROMO_HMAC_SECRET`) при `perUserLimit: true`, иначе `null`.
10. `cartItem.deleteMany({ where: { cartId } })`.

Отдельного ключа идемпотентности на этапе 1 нет: корзина очищается в той же транзакции, поэтому повторная отправка отдаёт `409 CART_EMPTY`, а не второй заказ. Кнопку клиент блокирует до ответа.

**Ответ 201:**

```json
{
  "id": "uuid",
  "number": "PS-000123",
  "status": "new",
  "createdAt": "2026-08-24T10:00:00.000Z",
  "deliveryMethod": "cdek_pvz",
  "cdekPvzCode": "MSK123",
  "deliveryAddress": { "city": "Москва", "street": "…", "house": "10", "apartment": "5", "postalCode": "119049" },
  "recipient": { "name": "Анна Рыбко", "phone": "+79996512551", "email": "a@example.com" },
  "items": [ { "productName": "…", "brandName": "ISSEIMI", "volumeLabel": "50 мл", "price": 807700, "quantity": 2, "lineTotal": 1615400, "productSlug": "…", "image": "string|null" } ],
  "subtotal": 550000,
  "promo": { "code": "ANNA15", "percent": 15, "discount": 82500 },
  "deliveryCost": 20000,
  "total": 487500,
  "comment": "string|null",
  "payment": { "status": "not_implemented", "provider": "yookassa", "confirmationUrl": null, "paymentStatus": "pending" }
}
```

**Заглушка оплаты.** Заказ создаётся с `paymentStatus: 'pending'`, `paymentId: null`. Блок `payment` присутствует в схеме ответа уже сейчас с фиксированным `status: 'not_implemented'` и `confirmationUrl: null` — чтобы подключение ЮKassa на следующем этапе было заменой значений, а не изменением контракта. Клиент при `not_implemented` показывает «Заказ принят, менеджер свяжется для оплаты».

**Ошибки:** `400 VALIDATION_ERROR | PVZ_CODE_REQUIRED | ADDRESS_REQUIRED`, `401 UNAUTHORIZED`, `409 CART_EMPTY | ITEM_UNAVAILABLE | OUT_OF_STOCK | TOTAL_MISMATCH | PROMO_NOT_FOUND | PROMO_MIN_AMOUNT | PROMO_EXHAUSTED`, `500 INTERNAL_ERROR`.
**Лимит:** 10 запросов/час на `userId`.

---

### 3.17 `GET /api/v1/orders` и `GET /api/v1/orders/:number`

Список: параметры `limit` (1…50, дефолт 20), `offset` (≥ 0).

```json
{ "items": [ { "id": "uuid", "number": "PS-000123", "status": "new", "paymentStatus": "pending", "createdAt": "…", "total": 487500, "itemsCount": 3, "previewImages": ["https://…/1.jpg"] } ],
  "total": 4, "limit": 20, "offset": 0 }
```

`previewImages` — до 3 картинок первых позиций. Порядок: `createdAt desc`.

Один заказ: `number` в пути, `^PS-\d{6}$`. Ответ — как у `POST /orders` (тот же `$ref`). Заказ другого пользователя → `404 ORDER_NOT_FOUND`. Поле `adminNote` наружу не отдаётся ни при каких условиях — его нет в схеме ответа.

---

### 3.18 Авторизация по СМС — точки интеграции

Механика переносится из Симбы без переизобретения. Здесь фиксируется только контракт и три обязательных отличия.

**`POST /api/v1/auth/send-otp`**
Тело: `{ "email": "anna@example.com" }`, email валидируется zod, максимум 254 символа. Нормализация: `trim().toLowerCase()`.
Ответ 200: `{ "channel": "email", "expiresIn": 600, "resendAfter": 60 }`.
Ответ одинаков и для нового, и для существующего email: пользователь создаётся при отсутствии (`findOrCreateCustomerByEmail`), чтобы по ответу нельзя было перебрать базу клиентов.
Ошибки: `400 VALIDATION_ERROR`, `429 OTP_RATE_LIMITED` (`details: { retryAfter }`).
Лимиты: 5 запросов/15 мин по IP **и** не чаще 1 раза в 60 секунд на email (проверка по `OtpCode.createdAt`).

**`POST /api/v1/auth/verify-otp`**
Тело: `{ "email": "anna@example.com", "code": "123456" }`, код — `^\d{6}$`.
Ответ 200:

```json
{ "token": "jwt", "user": { "id": "uuid", "name": "string", "phone": "string|null", "email": "anna@example.com", "role": "customer" }, "cartMerged": true }
```

Ошибки: `400 OTP_INVALID` (единый ответ и на неверный код, и на отсутствующего пользователя), `429 OTP_BLOCKED` (`details: { blockedUntil }`).

**Слияние корзины — здесь и только здесь.** В той же транзакции, что и пометка кода использованным:
1. Найти гостевую корзину по `sessionId` из подписанной cookie `ps_sid`. Нет — `cartMerged: false`, выход.
2. Найти или создать корзину пользователя.
3. По каждой гостевой позиции `cartItem.upsert` по составному ключу `cartId_productVariantId` с `quantity: { increment }`, итог обрезается по `stock` фасовки.
4. Удалить гостевую `Cart` (позиции уходят каскадом). Cookie не трогаем: после выхода из аккаунта на ней заведётся новая пустая корзина.
Повторный вызов идемпотентен — гостевой корзины уже нет.

**`GET /api/v1/auth/me`** → `{ "id", "name", "phone", "email", "role" }`. `401 UNAUTHORIZED` при просроченном токене или расхождении `tokenVersion`.

**`POST /api/v1/auth/logout`** → `{ "ok": true }`; инкремент `User.tokenVersion` (выход на всех устройствах).

**Три обязательных отличия от Симбы**
1. Канал — email, не СМС. Провайдер за интерфейсом `MailSender` (`server/src/services/mail/index.ts`), конфигурация: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. В `NODE_ENV=development` — заглушка, печатающая код в лог.
2. `OtpCode.codeHash` — **bcrypt (cost 10) или argon2id**, никакого sha256. У шестизначного кода миллион вариантов: быстрый хеш перебирается за секунды и не защищает ничего.
3. Счётчик неудач и блокировка — в БД (`User.otpFailedCount`, `User.otpBlockedUntil`), а не в `Map` в памяти. 5 неудач подряд → блокировка на 15 минут, успешный вход обнуляет счётчик.

---

## 4. Коды ошибок

| HTTP | `code` | Когда | `details` |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Вход не прошёл zod | `{ field }` |
| 400 | `PVZ_CODE_REQUIRED` | `cdek_pvz` без кода ПВЗ | — |
| 400 | `ADDRESS_REQUIRED` | `cdek_courier` без адреса | — |
| 400 | `OTP_INVALID` | Неверный или истёкший код входа | — |
| 401 | `UNAUTHORIZED` | Нет токена, истёк, `tokenVersion` разошёлся, пользователь заблокирован | — |
| 403 | `FORBIDDEN` | Роли не хватает (задел под админку) | — |
| 404 | `PRODUCT_NOT_FOUND` | Нет товара / неактивен / удалён | — |
| 404 | `CATEGORY_NOT_FOUND` | — | — |
| 404 | `BRAND_NOT_FOUND` | — | — |
| 404 | `CART_ITEM_NOT_FOUND` | Позиция чужая или не существует | — |
| 404 | `VARIANT_NOT_FOUND` | Фасовки нет | — |
| 404 | `ORDER_NOT_FOUND` | Заказ чужой или не существует | — |
| 404 | `PROMO_NOT_FOUND` | Кода нет / неактивен / истёк | — |
| 409 | `CART_EMPTY` | Действие требует непустой корзины | — |
| 409 | `CART_ITEM_LIMIT` | Больше 50 строк | `{ limit: 50 }` |
| 409 | `ITEM_UNAVAILABLE` | Товар или фасовка сняты с продажи | `{ itemId, productName }` |
| 409 | `OUT_OF_STOCK` | Остатка не хватает | `{ itemId, productName, available }` |
| 409 | `TOTAL_MISMATCH` | `expectedTotal` разошёлся с расчётом сервера | `{ subtotal, promoDiscount, deliveryCost, total }` |
| 409 | `PROMO_MIN_AMOUNT` | Сумма меньше минимальной для кода | `{ minOrderAmount }` |
| 409 | `PROMO_EXHAUSTED` | Лимит применений исчерпан | — |
| 429 | `RATE_LIMITED` | Общий лимит запросов | `{ retryAfter }` |
| 429 | `OTP_RATE_LIMITED` | Слишком частый запрос кода | `{ retryAfter }` |
| 429 | `OTP_BLOCKED` | Перебор кода | `{ blockedUntil }` |
| 500 | `INTERNAL_ERROR` | Необработанное исключение | — |

`500` наружу не выносит ни текст исключения, ни стек — только `"Внутренняя ошибка сервера"`; подробности уходят в `app.log.error` вместе с `request.id`.

---

## 5. Интеграция с БД

### 5.1 Эндпоинт → модели

| Эндпоинт | Читает | Пишет |
|---|---|---|
| `GET /products` | `Product`, `ProductVariant`, `Brand`, `ProductLine`, `ProductCategory`, `Category`; при `sort=popular` — `OrderItem`, `Order` | — |
| `GET /products/facets` | `Product`, `ProductVariant`, `ProductCategory`, `Category`, `Brand`, `ProductLine` | — |
| `GET /products/:slug` | `Product`, `ProductVariant`, `Brand`, `ProductLine`, `ProductCategory`, `Category`, `ProductIngredient`, `Ingredient` | — |
| `GET /categories/*` | `Category`, `ProductCategory`, `Product` | — |
| `GET /brands/*` | `Brand`, `ProductLine`, `Product` | — |
| `GET /lines` | `ProductLine`, `Brand`, `Product` | — |
| `GET /cart` | `Cart`, `CartItem`, `ProductVariant`, `Product`, `Brand` | — |
| `POST /cart/items` | `ProductVariant`, `Product`, `Cart` | `Cart` (создание), `CartItem` |
| `PATCH/DELETE /cart/items/:id` | `CartItem`, `Cart`, `ProductVariant` | `CartItem` |
| `DELETE /cart` | `Cart` | `CartItem` (удаление) |
| `GET /delivery/methods` | `Cart`, `CartItem`, `ProductVariant`, `PromoCode` | — |
| `POST /promo/validate` | `PromoCode`, `Cart`, `CartItem`, `ProductVariant` | — |
| `POST /orders` | `Cart`, `CartItem`, `ProductVariant`, `Product`, `Brand`, `PromoCode`, `User` | `ProductVariant.stock`, `PromoCode.usedCount`, `Order`, `OrderItem`, `PromoCodeRedemption`, `CartItem` (удаление), `order_number_seq` |
| `GET /orders*` | `Order`, `OrderItem`, `Product` | — |
| `POST /auth/send-otp` | `User`, `OtpCode` | `User` (создание), `OtpCode` |
| `POST /auth/verify-otp` | `OtpCode`, `User`, `Cart`, `CartItem` | `OtpCode.usedAt`, `User` (счётчики), `Cart`, `CartItem` |
| `POST /auth/logout` | `User` | `User.tokenVersion` |

Все чтения каталога обязаны нести `isActive: true, deletedAt: null` — вынести в константу `ACTIVE` в `server/src/lib/prisma-filters.ts` и не переписывать условие в каждом запросе.

### 5.2 Обязательные изменения схемы до старта разработки

**А. Удалить вместе с Pro-кабинетом** (модели `ProProfile`, `ProDocument`, `ProProfileStatusLog`, `ProDocumentAccessLog`, `VariantProPrice`, перечисление `ProStatus` — удаляются параллельной задачей):
- `Product.isProfessionalOnly` и индекс `@@index([isProfessionalOnly])` — в B2C-магазине «только для профи» товаров нет, линейка ISSEIMI MD продаётся всем по розничной цене;
- `ProductLine.isProfessional`;
- `PromoCode.proProfileId` и связанный индекс (промокод остаётся как обычный маркетинговый инструмент, владелец — `ownerId`, nullable);
- перечисление `PriceTier`, поля `Order.priceTier`, `OrderItem.priceTier` и CHECK-ограничение «pro без промокода» в `prisma/sql/01-constraints.sql`. Прайс один, снимок тира хранить не от чего. В вызов `calcOrderTotals` передаётся константа `priceList: 'retail'`.

**Б. Денормализация цены для сортировки:**

```prisma
model Product {
  minPrice Int @default(0) // минимальная розничная цена активных фасовок, копейки
  maxPrice Int @default(0)
  @@index([minPrice])
}
```

Prisma не умеет `orderBy` по агрегату связанной таблицы, а сортировка по цене в каталоге обязательна. Пересчёт — функция `recalcProductPrices(tx, productId)`, вызывается из сидера/импорта и из любой записи `ProductVariant` (админка следующего этапа). Значения `0` у товара без живых фасовок роли не играют: такой товар отфильтрован.

**В. Расширить перечисление `Concern`** — восемь новых значений, иначе разметка `keyNeeds` (14 значений) не ложится на 11 существующих:

```sql
ALTER TYPE "Concern" ADD VALUE 'regeneration';
ALTER TYPE "Concern" ADD VALUE 'radiance';
ALTER TYPE "Concern" ADD VALUE 'sebum_control';
ALTER TYPE "Concern" ADD VALUE 'hygiene';
ALTER TYPE "Concern" ADD VALUE 'barrier';
ALTER TYPE "Concern" ADD VALUE 'daily_care';
ALTER TYPE "Concern" ADD VALUE 'express_care';
ALTER TYPE "Concern" ADD VALUE 'intensive_care';
ALTER TYPE "Concern" ADD VALUE 'nourishing';
```

(9 команд — `nourishing` тоже новое.) `ADD VALUE` нельзя использовать в той же транзакции, где значение применяется, — отдельная миграция, до миграции с данными. Это блокер для `migration-guard`.

**Г. Расширить `SkinType` значением `all_types`:**

```sql
ALTER TYPE "SkinType" ADD VALUE 'all_types';
```

«Для всех типов кожи» — реальное значение разметки у большинства товаров. Пустой массив вместо него использовать нельзя: у части товаров разметка содержит и «для всех типов», и конкретные типы одновременно, и признак универсальности потерялся бы.

**Д. Последовательность номеров заказа** (в `prisma/sql/`, применяется миграцией):

```sql
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
```

**Е. Индексы под фильтры и сортировки:**

```sql
CREATE INDEX products_skin_types_gin ON products USING GIN ("skinTypes");
CREATE INDEX products_concerns_gin   ON products USING GIN ("concerns");
```

GIN нужен под `hasSome` по массивам перечислений — без него каждый фильтр по типу кожи и потребности даёт полный проход по таблице.

Дополнительно в `schema.prisma`:
- `ProductVariant` → `@@index([productId, isActive])` (выборка живых фасовок товара — самый частый запрос каталога);
- `OrderItem` → `@@index([productId, createdAt])` (группировка продаж за 90 дней для `sort=popular`; существующего `@@index([productId])` для диапазона по дате мало);
- `Product` → `@@index([isActive, deletedAt, createdAt])` (сортировка `newest` на отфильтрованном наборе).

Уже существуют и достаточны: `Category.slug`, `Category.parentId`, `Brand.slug`, `ProductLine.slug`, `Product.slug`, `Product.brandId`, `Product.lineId`, `ProductCategory.categoryId`, `ProductVariant.retailPrice`, `Cart.sessionId` (@unique), `CartItem` @@unique([cartId, productVariantId]), `Order.number` (@unique), `Order.userId+createdAt`.

**Ж. Уборка гостевых корзин.** Ежедневная задача: `cart.deleteMany({ where: { userId: null, updatedAt: { lt: now - 60 дней } } })`. Индекс `Cart.@@index([updatedAt])` уже есть.

### 5.3 Словари перечислений (`server/src/lib/dictionaries.ts`)

Отдаются как `label` в фасетах; клиент своих копий не держит.

`SkinType`: `normal` → Нормальная · `dry` → Сухая · `oily` → Жирная / проблемная · `combination` → Комбинированная · `sensitive` → Чувствительная · `mature` → Возрастная · `all_types` → Для всех типов кожи.

`Concern`: `hydration` Увлажнение · `firming` Укрепление и лифтинг · `regeneration` Регенерация · `radiance` Придание сияния коже · `pigmentation` Выравнивание цвета и рельефа · `sebum_control` Себорегуляция · `cleansing` Глубокое очищение и детоксикация · `hygiene` Гигиена · `sensitivity` Снятие признаков раздражения · `barrier` Повышение защитных свойств · `daily_care` Ежедневный уход · `express_care` Экспресс-уход · `intensive_care` Интенсивный уход · `nourishing` Питание · `anti_age` Антивозрастной уход · `acne` Проблемная кожа · `redness` Покраснения · `sun_protection` Защита от солнца · `eye_area` Зона вокруг глаз · `post_procedure` Постпроцедурный уход.

`DeliveryMethod`, `OrderStatus`, `PaymentStatus` — там же, значения из раздела 3.

### 5.4 Правила импорта `catalog-curated.json` (57 товаров, 11 категорий)

Сопоставление строго по `products.json.id == manifest.json.products[].externalId`; slug в манифесте усечён до 63 символов и для сопоставления непригоден (`_meta` файла).

- `Category` — 11 записей из блока `categories`, все корневые (`parentId: null`), `sortOrder` = порядок в файле.
- `Brand` — `ISSEIMI` → `isseimi`, `GLACÉE Skincare` → `glacee-skincare`. Написание с диакритикой сохранять как в дизайн-системе.
- `ProductLine` — 4: `ISSEIMI Base` → `isseimi-base`, `ISSEIMI MD` → `isseimi-md`, `ISSEIMI Nat Collection` → `isseimi-nat-collection`, `GLACÉE Skincare Man Line` → `glacee-skincare-man-line`. У 10 товаров `line: null` — это норма, `lineId` остаётся пустым.
- `Product.concerns` ← `keyNeeds` по таблице соответствия:

| Разметка | Значение |
|---|---|
| Увлажнение | `hydration` |
| Укрепление и лифтинг | `firming` |
| Регенерация | `regeneration` |
| Придание сияния коже | `radiance` |
| Выравнивание цвета и рельефа | `pigmentation` |
| Себорегуляция | `sebum_control` |
| Глубокое очищение и детоксикация | `cleansing` |
| Гигиена | `hygiene` |
| Снятие признаков раздражения кожи | `sensitivity` |
| Повышение защитных свойств кожи | `barrier` |
| Ежедневный уход | `daily_care` |
| Экспресс-уход | `express_care` |
| Интенсивный уход | `intensive_care` |
| Питание | `nourishing` |

Дополнительно: товарам категории `spf` добавляется `sun_protection`, категории `kremy-dlya-vek` — `eye_area`. Строка вне таблицы — импорт падает с ошибкой и печатает значение; молча пропускать нельзя, иначе фильтр тихо теряет товары.

- `Product.skinTypes` ← `skinTypes`: «Нормальная» → `normal`, «Сухая» → `dry`, «Чувствительная» → `sensitive`, «Жирная / Проблемная / Комбинированная» → **два** значения `oily` + `combination`, «Для всех типов кожи» → `all_types`. Массив дедуплицируется.
- `Product.description` ← `action`, `Product.usage` ← `application` (может быть `null`), `shortDescription` — первое предложение `action`, обрезка по 160 символам.
- `ProductIngredient`/`Ingredient` ← `ingredients` (строки), `isKey: true` для первых трёх, `concentration: null`. Slug — транслитерация, `Ingredient.name` уникален.
- `ProductVariant` — одна фасовка на товар: `retailPrice` ← `priceKopecks`, `oldRetailPrice` ← `oldPriceKopecks`, `volumeValue` ← `volume`, `volumeUnit: 'ml'`. При `volume: null` (наборы) — `volumeValue: 1`, `volumeUnit: 'pcs'`, `volumeLabel` = «набор» либо разобранный из `action` состав. `externalId` ← `externalId` (защита от дублей при повторном импорте), `stock` — 0 до первой поставки, для витрины на этапе разработки — 10.
- `secondaryTypes` в фильтрах этапа 1 не участвует — это задел под будущий фильтр «тип средства» через `Filter`/`FilterValue`. Импортом не заполнять.
- Цены после импорта: пересчитать `Product.minPrice/maxPrice` для всех товаров одним проходом.

---

## 6. Что переносится из Симбы

Переиспользуются паттерны, не пакеты. Импорт `@simba/shared` и `@prisma/client` Симбы в код Perfect Skin запрещён (ADR 2026-07-28). Prisma-клиент подключается из `.prisma/ps-client`, строка подключения — `PS_DATABASE_URL`.

| Файл-донор (Симба) | Куда | Что менять |
|---|---|---|
| `<корень репозитория>/server/src/index.ts` | `perfect-skin/server/src/index.ts` | Оставить порядок регистрации плагинов; префикс `/api/v1`; добавить `@fastify/cookie` (секрет `PS_COOKIE_SECRET`) и `@fastify/rate-limit`; выбросить регистрацию `quiz`, `bonuses`, `subscriptions`, `admin`; добавить `setErrorHandler` в едином формате |
| `server/src/plugins/prisma.ts` | `plugins/prisma.ts` | Импорт клиента из `.prisma/ps-client`, переменная `PS_DATABASE_URL` |
| `server/src/plugins/authenticate.ts` | `plugins/authenticate.ts` | Добавить сверку по БД: `isActive`, `deletedAt`, `tokenVersion` против `tv` в токене; ошибки в формате `{error:{code,message}}` вместо `{error:'Unauthorized'}` |
| `server/src/services/otp.service.ts` | `services/otp.service.ts` | `sendEmail` → `services/sms/`; `hashCode` sha256 → **bcrypt/argon2id**; `code` → `codeHash`; канал `sms` |
| `server/src/routes/auth/send-otp.ts` | `routes/auth/send-otp.ts` | E-mail → телефон и его нормализация; счётчики из `Map` → в БД (`User.otpFailedCount`, `otpBlockedUntil`); формат ответа из 3.18 |
| `server/src/routes/auth/verify-otp.ts` | `routes/auth/verify-otp.ts` | Удалить блок приветственных бонусов (`WELCOME_BONUS`, `applyBonusChange`) и всё про `bonusPoints`/`bonusLevel`; `guestToken` в теле → `sessionId` из подписанной cookie; вызов `mergeGuestCart` заменить на слияние по `sessionId`; добавить `tv` в payload токена |
| `server/src/routes/auth/guest-session.ts` | **не переносить** | Гостевой `User` в БД не заводим — в схеме для этого `Cart.sessionId` и cookie |
| `server/src/services/cart.service.ts` | `services/cart.service.ts` | Ключ владельца `userId` → `{userId} \| {sessionId}` (`resolveCartOwner`); убрать `isSubscription` и `subscriptionIntervalDays` (уникальный ключ становится `[cartId, productVariantId]`); цена из `variant.retailPrice`; `mergeGuestCart` — по гостевой корзине, а не по гостевому пользователю; вместо `throw new Error('строка')` — `ApiError` с кодом |
| `server/src/routes/cart/index.ts` | `routes/cart/index.ts` | `preHandler: app.authenticate` → `authenticateOptional` + cookie; `PUT` → `PATCH`; добавить схемы ответов Fastify; единый формат ошибок; отдавать `warnings` |
| `server/src/services/order.service.ts` (`createOrder`, строки 208–380) | `services/order.service.ts` | Сохранить каркас: котировка до транзакции, быстрый отказ, **условное списание `updateMany where stock >= qty`** (строки 361–374) — переносить дословно, это защита от гонки; удалить бонусы, подписки, `hasSpecialPackaging`, `paymentMethod`, вызовы внешних служб доставки; расчёт — `calcOrderTotals` из `@ps/shared`; добавить генерацию номера из последовательности, промокод и `PromoCodeRedemption` |
| `server/src/routes/orders/index.ts` | `routes/orders/index.ts` | Контракт из 3.16–3.17, схемы ответов, коды ошибок |
| `server/src/routes/products/list.ts` + `services/product.service.ts` | `routes/products/list.ts`, `services/catalog.service.ts` | Зоо-фильтры (`format`, `purpose`, `tags`, `isGrainFree`) → косметические (`need`, `skin`, `line`); `page` → `offset`; дефолт 20 → 24; рубли `* 100` из query убрать — на вход приходят копейки; `filters` строкой через запятую не переносить |
| `server/src/routes/categories/tree.ts` | `routes/categories/tree.ts` | Переносится почти дословно; добавить `deletedAt: null`, `productCount` и отсев пустых категорий |
| `server/src/routes/brands/index.ts` | `routes/brands/index.ts` | Переносится дословно; добавить `lines` в карточку бренда и схемы ответов |
| `server/src/services/popular-products.service.ts` (строки 46–70) | `services/popular.service.ts` | Приём `orderItem.groupBy` за окно дней; окно 60 → 90; вернуть только карту `productId → units` + кеш на 10 минут, без выборки товаров |
| `server/src/routes/delivery/index.ts`, `services/delivery/**` | **не переносить** | Провайдеры (СДЭК API, Достависта, Яндекс) на этапе 1 не нужны: стоимость определяется порогами из `@ps/shared`. Взять только форму ответа «список методов» |
| `server/src/middleware/check-role.ts` | отложено | Понадобится на этапе админки |
| `server/src/test/guest-checkout.integration.test.ts` | `test/guest-checkout.integration.test.ts` | Образец интеграционного теста: гость → корзина → вход → мерж → заказ. Переписать под cookie-сессию |

**Структура нового сервера**

```
perfect-skin/server/src/
├── index.ts                  # bootstrap, плагины, префиксы
├── plugins/                  # prisma, authenticate, cookie, cors, rate-limit
├── schemas/common.ts         # ps.error, ps.variant, ps.productCard, ps.cart, ps.order
├── lib/
│   ├── errors.ts             # ApiError + setErrorHandler
│   ├── dictionaries.ts       # подписи перечислений
│   ├── delivery.ts           # toCalcMethod, титулы способов
│   └── prisma-filters.ts     # константа ACTIVE
├── routes/{products,categories,brands,lines,cart,delivery,promo,orders,auth}/
├── services/{catalog,cart,order,promo,popular,otp,sms}.service.ts
└── test/
```

**Отложено сознательно (не реализовывать на этапе 1):** поиск по каталогу, «похожие товары» в карточке, избранное (`Favorite`), фильтры через `Filter`/`FilterValue`/`secondaryTypes`, оплата ЮKassa, вызовы API СДЭК (список ПВЗ приходит с виджета на клиенте), Бьюти-клуб, блог, админка, ключ идемпотентности заказа.
