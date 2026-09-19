# Профиль безопасности: Perfect Skin

Карта стека для агентов `security-*`. Универсальные классы уязвимостей — в
`docs/core/anti-patterns/security.md`; здесь только то, как эти классы
выглядят **в Perfect Skin**.

Собран чтением кода `perfect-skin/` (сентябрь 2026). Стек похож на Симбу, но
**профиль Симбы здесь неприменим**: авторизация держится не только на заголовке,
а ещё и на httpOnly-куках, поэтому класс CSRF применим (см. ниже).

Все пути ниже — от корня репозитория.

---

## Стек

| Слой | Чем реализовано |
|---|---|
| Язык / рантайм | Node.js (ESM, `--env-file=.env`), TypeScript |
| Серверный фреймворк | Fastify 4 (`perfect-skin/server/`) |
| Клиент | React 18 + Vite + React Router 6 + Tailwind (`perfect-skin/client/`). Админки в проекте **нет** |
| Общий код | `perfect-skin/shared/` (`@ps/shared`) — расчёт итогов заказа |
| База и доступ к ней | PostgreSQL + Prisma 5, **собственный клиент** `node_modules/.prisma/ps-client` (реэкспорт в `server/src/lib/db.ts`), своя база `PS_DATABASE_URL` |
| Хранилище файлов | нет — загрузок файлов в коде нет (MinIO/S3 не подключены) |
| Аутентификация | OTP по **email** (6 цифр, bcrypt-хеш в БД) → JWT HS256, 7 дней. Токен отдаётся и в теле ответа, и в httpOnly-куке `ps_auth` |
| Хостинг и выкатка | **нет.** В `docs/projects/README.md` выкатка помечена «нет», workflow под проект в `.github/workflows/` отсутствует |
| Фоновые задачи | нет очереди; есть ручной скрипт `perfect-skin/server/tools/cleanup-guest-carts.mjs` |
| Платежи | **не подключены.** См. §11 ниже |

Чего в проекте **нет** (чтобы агенты не искали): Next.js, NextAuth, Vercel,
Supabase, MinIO/S3, multipart-загрузки, вебхуков, админки, SMS-провайдера
(интерфейс есть, реализация бросает ошибку), входа по паролю.

## Где что лежит

| Что | Путь |
|---|---|
| Точка сборки сервера, регистрация плагинов | `perfect-skin/server/src/index.ts` |
| Серверные роуты | `perfect-skin/server/src/routes/**` (auth, cart, orders, products, categories, brands, lines, promo, delivery) |
| Middleware авторизации | `perfect-skin/server/src/plugins/authenticate.ts` (`app.authenticate`, `app.authenticateOptional`) |
| Определение владельца корзины | `perfect-skin/server/src/services/cart.service.ts` → `resolveCartOwner()` |
| Проверка владельца заказа | `perfect-skin/server/src/routes/orders/index.ts` |
| Бизнес-логика заказа и цен | `perfect-skin/server/src/services/order.service.ts`, `perfect-skin/shared/src/order-totals.ts` |
| OTP | `perfect-skin/server/src/services/otp.service.ts`, роуты `routes/auth/send-otp.ts`, `routes/auth/verify-otp.ts` |
| Схема БД и миграции | `perfect-skin/server/prisma/schema.prisma`, `prisma/migrations/`, ограничения `prisma/sql/01-constraints.sql` |
| JSON-схемы ответов | `perfect-skin/server/src/schemas/common.ts` |
| Конфигурация секретов | `perfect-skin/server/.env.example` (боевого `.env` в репозитории нет) |
| Клиентский HTTP-слой и хранение токена | `perfect-skin/client/src/lib/api.ts`, `client/src/context/AuthContext.tsx` |
| Интеграционные тесты чекаута | `perfect-skin/server/src/test/checkout.integration.test.ts` |

## Как устроен вход и что лежит в куках

Две разные куки, их нельзя путать:

| Кука | Что внутри | Где ставится | Атрибуты |
|---|---|---|---|
| `ps_sid` | UUID **гостевой сессии корзины** (`randomUUID()`), подписанная кука (`signed: true`, секрет `PS_COOKIE_SECRET`). Это НЕ сессия входа | `server/src/routes/cart/index.ts` (`POST /api/v1/cart/items`, когда владелец не определён) | `httpOnly: true`, `sameSite: 'lax'`, `secure` только при `NODE_ENV=production`, `path: '/'`, `maxAge` 180 дней |
| `ps_auth` | **JWT входа** (payload `{ userId, role, tv }`, HS256, `expiresIn: '7 days'`) | `server/src/routes/auth/verify-otp.ts` | `httpOnly: true`, `sameSite: 'lax'`, `secure` только при `NODE_ENV=production`, `path: '/'`, `maxAge` 7 дней. Снимается в `routes/auth/logout.ts` |

Вход работает **двумя способами одновременно**: `verify-otp` и ставит куку
`ps_auth`, и возвращает `token` в теле ответа. Клиент кладёт его в
`localStorage` под ключом `ps_token` (`client/src/context/AuthContext.tsx`) и
шлёт заголовком `Authorization: Bearer`, при этом все запросы идут с
`credentials: 'include'` (`client/src/lib/api.ts`).

В `extractBearerToken` (`server/src/plugins/authenticate.ts`) **кука имеет
приоритет над заголовком**: сначала читается `request.cookies.ps_auth`, и
только если её нет — заголовок.

Отзыв сессий: у `User` есть `tokenVersion`; `authenticate` сверяет `payload.tv`
с текущим значением, `logout` инкрементирует его — выход гасит **все** токены
пользователя.

## Перевод классов в конкретику

| Класс (см. `anti-patterns/security.md`) | Что искать здесь |
|---|---|
| §3 Доступ без проверки владельца — заказы | `routes/orders/index.ts`. Список: `db.order.findMany({ where: { userId: request.user!.id } })`. Одиночный: `GET /api/v1/orders/:number` достаёт заказ по номеру и сверяет `order.userId !== request.user!.id` → 404. Отдельный публичный роут `GET /api/v1/orders/track` — пара «номер + email», без входа, лимит 20/15 мин, единый 404 |
| §3 Доступ без проверки владельца — корзина | `services/cart.service.ts`. Владелец — это `{ userId }` (из токена) **или** `{ sessionId }` (из подписанной `ps_sid`). `updateItem()` и `deleteItem()` сверяют `cart.id !== item.cartId` → 404. Правильный паттерн: никогда не работать с `cartItem` по `itemId` без этой сверки |
| §3 Роут без авторизации | Отсутствие `preHandler: app.authenticate` на роуте с данными пользователя. Внимание: `app.authenticateOptional` **молча пропускает гостя** — на `/api/v1/cart/*`, `/api/v1/orders` (POST), `/api/v1/promo/validate` это намеренно, где-либо ещё — находка |
| §3 Роль из запроса | `request.user.role` берётся из БД при каждом запросе (не из тела). Искать `req.body.role`, `data.role` в записях. Роли: `super_admin`, `orders_manager`, `products_manager`, `content_manager`, `customer`; роутов, разграничивающих по роли, пока нет |
| §3 Массовое присвоение | Тело запроса нигде не уходит в `prisma.*.update({ data })` целиком; поля перечисляются явно в `order.service.ts`. Искать отклонения от этого |
| §4 SQL-инъекция | Опасны только `$queryRawUnsafe` / `$executeRawUnsafe` / склейка строк — в коде их **нет**. `$executeRaw` в `server/src/services/product-prices.ts` — тегированный шаблон (`tx.$executeRaw\`...${productId}...\``), Prisma параметризует подстановки. **Это не инъекция, не репортить** |
| §5 Сырой HTML | `dangerouslySetInnerHTML` в `perfect-skin/client/src/**` — на момент составления ни одного вхождения |
| §6 CSRF | **ПРИМЕНИМ.** Состояние держится в куках `ps_auth` и `ps_sid`, браузер приложит их сам; CORS зарегистрирован с `credentials: true`. Единственная защита — `sameSite: 'lax'` и то, что изменяющие роуты не GET. Плагина `@fastify/csrf-protection` и CSRF-токенов в проекте нет. Проверять: нет ли изменяющих действий на GET; не появился ли `sameSite: 'none'`; не отключён ли allowlist `PS_CORS_ORIGIN` |
| §6 CORS | `@fastify/cors` в `server/src/index.ts`: `origin` = список из `PS_CORS_ORIGIN` (дефолт `http://localhost:3000`), `credentials: true`. `'*'` вместе с `credentials` недопустим |
| §5 Заголовки | `@fastify/helmet` в `server/src/index.ts`, зарегистрирован с `contentSecurityPolicy: false` (осознанно: это JSON-API, не HTML) |
| §7 Загрузка файлов | **Неприменимо:** multipart-плагина нет, ни одного обработчика загрузки в `server/src` нет. Появится (профи-документы по `project.md` — «загрузить документы») — раздел переписать |
| §8 Внешние запросы | **Неприменимо на данный момент:** ни `fetch`, ни HTTP-клиента на сервере нет. Доставка СДЭК считается локально (`server/src/lib/delivery.ts`, `routes/delivery/index.ts`), к API СДЭК не ходит |
| §10 Вебхуки | **Неприменимо:** входящих вебхуков нет ни одного роута |
| §11 Платежи | **Не подключены.** `Order.paymentStatus`/`paymentId` в схеме есть, но `order.service.ts` создаёт заказ с `paymentStatus: 'pending'`, `paymentId: null`, а `formatOrderResponse` отдаёт `payment: { status: 'not_implemented', provider: 'yookassa', confirmationUrl: null }`. Списаний, возвратов и подписи вебхука нет. Что проверять уже сейчас: цена считается **на сервере** (`calcOrderTotals`), клиентский `expectedTotal` только сверяется и при расхождении даёт ошибку — суммой из клиента платить нельзя |
| §12 Гонки | Конкурентны: остатки `ProductVariant.stock` при создании заказа, лимит применений промокода (`PromoCodeRedemption`, ключ пользователя — HMAC по `PS_PROMO_HMAC_SECRET` в `order.service.ts`), слияние гостевой корзины при входе (`mergeGuestCart` — в транзакции), `findOrCreateUser` (обрабатывает P2002). Правильный паттерн — условие в `UPDATE ... WHERE` или транзакция, не «прочитал-сравнил-записал» |
| §13 Секреты | `.env` рядом с сервером, шаблон `perfect-skin/server/.env.example`. Прод не поднимается без `PS_COOKIE_SECRET`, `JWT_SECRET`, `PS_PROMO_HMAC_SECRET`, `PS_DATABASE_URL`, `PS_CORS_ORIGIN` — проверка в начале `server/src/index.ts` отвергает пустые, `change-me` и `dev-secret`. Сигнатуры — ниже |
| §15 Хеширование паролей | `bcryptjs`. Внимание: пароли **не используются** — поле `User.passwordHash` объявлено «только сотрудники», роутов входа по паролю нет. `bcryptjs` реально применяется к **OTP-коду** (`otp.service.ts`, cost 10) |
| §1 Перебор и тайминг | OTP: 6 цифр из `randomInt` (CSPRNG), жизнь 10 минут, одноразовость `usedAt`. Счётчик неудач — на пользователе (`otpFailedCount`, блок 15 минут после 5). Лимиты: `send-otp` 5/15 мин по IP + 60 сек на email через БД; `verify-otp` 5/15 мин **с ключом по email** из тела. Сравнение кода — `bcrypt.compare` (константное по своей природе), `===` здесь быть не должно |
| §9 Rate limit | `@fastify/rate-limit` зарегистрирован глобально (120/мин) и переопределён точечно: заказы 10/час (ключ — `user.id` → `ps_sid` → IP), корзина 60/мин, промокод 20/мин, трекинг заказа 20/15 мин, OTP см. выше. Хранилище — память процесса |
| §2 JWT | `jsonwebtoken`, HS256 явно указан в `verify` (`algorithms: ['HS256']` — подмена на `none`/RS256 закрыта), `expiresIn: '7 days'`, отзыв через `tokenVersion` |
| §17 Порты | Сервер слушает `0.0.0.0:3000`. Docker-compose и конфига веб-сервера у проекта нет — наружу ничего не публикуется до появления деплоя |
| §19 OAuth | **Неприменимо:** внешних провайдеров входа нет |
| §22 Валидация | Двойная: JSON-схемы Fastify (`schema.body`/`params`/`querystring`, схемы ответов через `$ref` из `schemas/common.ts`) плюс `zod.safeParse` в обработчике. Искать роуты без обеих |

## Сигнатуры секретов, специфичные для стека

- `JWT_SECRET`, `PS_COOKIE_SECRET`, `PS_PROMO_HMAC_SECRET` со строковым литералом
  вместо `process.env`
- `PS_DATABASE_URL` с реальным паролем: `postgresql://user:password@host`
- Отдельный `perfect-skin/server/prisma/.env` — Prisma создаёт его для миграций,
  легко минует `.gitignore`
- `SMTP_PASS` / `SMTP_USER` / `SMTP_FROM` со значением, `auth: { pass: '...' }`
- `SMS_API_KEY` со значением (провайдер пока не подключён)
- `sign(payload, 'секрет')`, `createHmac('sha256', 'секрет')` с литералом

## Защита, встроенная в стек

Проверено по коду: не «пакет в зависимостях», а «плагин зарегистрирован».

| Риск | Закрыто стеком | Что всё равно проверять |
|---|---|---|
| SQL-инъекция | Prisma параметризует значения; `$executeRaw` в `services/product-prices.ts` — тегированный шаблон, безопасен | Появление `$queryRawUnsafe` / `$executeRawUnsafe` / конкатенации |
| XSS в разметке | React экранирует по умолчанию | `dangerouslySetInnerHTML` в `client/src/**` |
| Типы и форма запроса на границе | JSON-схемы Fastify + `zod` в обработчиках; ошибка валидации приведена к 400 в `setErrorHandler` | Роуты без `schema` и без `safeParse` |
| Заголовки безопасности | `@fastify/helmet` зарегистрирован в `server/src/index.ts` | CSP выключен осознанно — не репортить как находку для JSON-API |
| Частота запросов | `@fastify/rate-limit` зарегистрирован глобально + точечные лимиты на auth/orders/cart/promo | Новые изменяющие роуты без своего лимита; лимиты живут в памяти процесса |
| Хеш секретов входа | `bcryptjs` cost 10 для OTP-кода | Появление входа по паролю — там же должен быть bcrypt |
| Подделка гостевой сессии | `ps_sid` подписана (`signed: true`) и проверяется `unsignCookie().valid` | Чтение `ps_sid` без `unsignCookie` |
| Утечка токена через XSS | JWT лежит в httpOnly-куке `ps_auth` | Он **же** дублируется в `localStorage` клиента — см. принятые риски |
| Запуск прода с дефолтными секретами | `server/src/index.ts` отказывается стартовать | — |

## Команды проверки

```bash
# из корня репозитория
npm run test --workspace=@ps/server     # vitest: интеграционные тесты каталога и чекаута
npm run test --workspace=@ps/shared     # тесты расчёта итогов заказа
npm run build --workspace=@ps/server    # tsc, проверка типов
npm run build --workspace=@ps/client    # tsc --noEmit + vite build
npm audit --omit=dev                    # уязвимости в зависимостях (workspace общий)
```

## Доступ к боевому серверу

| Что | Как |
|---|---|
| Выполнить команду на сервере | **нет.** Проект не выкачен, workflow под Perfect Skin в `.github/workflows/` отсутствует |
| Логи приложения | нет (боевого запуска нет) |
| Домен боевого сайта | `perfect-skin.shop` — **действующий сайт на WordPress/WooCommerce**, к этому коду отношения не имеет. Проверять его как рантайм нового проекта нельзя |
| Домен тестового стенда | нет |

Следствие: рантайм-слой из `docs/core/security-runtime.md` для этого проекта
**пока не работает**. Доступны только чтение кода и тесты. Появится выкатка —
раздел заполнить, иначе «внешняя проверка» будет фикцией.

## На что смотреть при инциденте

Появится боевая среда — специфика та же, что у магазина: всплеск заказов с
одного IP, серии неудачных OTP на один email, перебор номеров заказа на
`/api/v1/orders/track`, перебор промокодов на `/api/v1/promo/validate`.

## Известные и принятые риски

| Риск | Почему принят | Пересмотреть |
|---|---|---|
| JWT дублируется в `localStorage` клиента при наличии httpOnly-куки | Так устроен текущий клиент: `verify-otp` отдаёт токен и телом, и кукой | При следующем заходе в авторизацию — оставить только куку, тогда цена XSS падает |
| Rate limit и счётчики в памяти процесса | Один инстанс, деплоя пока нет | При выкатке на несколько процессов — общее хранилище |
| SMS-канал OTP не реализован (`ProductionSmsSender` бросает ошибку) | Вход идёт по email; провайдер не выбран | При подключении SMS — перепроверить лимиты и §1 |
