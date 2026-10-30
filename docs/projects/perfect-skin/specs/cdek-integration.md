Сэр, спек интеграции СДЭК API v2 для Perfect Skin готов. В файлы я ничего не писал. Ниже: сначала объяснение простыми словами, потом спек по шагам. Каждый шаг — отдельный коммит.

---

## 0. Как это устроено, простыми словами

**Сервер — единственный, кто разговаривает со СДЭК.** Браузер покупателя напрямую в СДЭК не ходит. Он спрашивает наш сервер («какие есть города на "Каз"», «какие ПВЗ в городе 44», «сколько стоит доставка»), а сервер передаёт вопрос в СДЭК и запоминает ответ на время. Так получается по трём причинам:
- ключи СДЭК не попадают в браузер;
- IP покупателя не уходит третьей стороне — это вопрос 152-ФЗ;
- кэш защищает от лимитов СДЭК и держит цену одинаковой между показом и оформлением.

Аналогия: сервер — капитан. Только он говорит с судьёй (СДЭК), игроки (браузеры) к судье не подъезжают.

**Цена доставки считается дважды, и оба раза на сервере:** при показе на чекауте и при создании заказа. Клиентской цифре не верим, как и сейчас с `expectedTotal`. Расхождения между двумя расчётами не будет: ответ тарифа хранится в кэше 30 минут по ключу «город + вес + коробка». Ход в СДЭК делается **до** транзакции заказа, правило контракта «нет сетевых вызовов внутри транзакции» сохраняется.

**Пороги бесплатной доставки остаются в одном месте — в `@ps/shared`.** Туда добавляется только параметр «сколько стоит платная доставка»: по умолчанию 200 ₽, при включённой интеграции — тариф СДЭК. Правила 6 000 ₽ и 10 000 ₽ не дублируются.

**Без ключей сайт работает ровно как сейчас.** Если `PS_CDEK_CLIENT_ID` пуст или стоит `PS_CDEK=off`, функция `getCdek()` возвращает `null`, и все новые пути ведут в старое поведение: фиксированная цена, код ПВЗ вводится руками, трек вводит менеджер. Выключатель `PS_CDEK=off` обязателен: `upsert_env` в деплое пустым секретом значение не стирает, поэтому иначе интеграцию после включения не выключить.

**Вебхук СДЭК не подписан, поэтому его тело — только «звонок в дверь».** Защита в три слоя:
1. секрет в URL, сравнение за константное время, на неверный секрет ответ 404;
2. заказ должен быть наш (ищем по `cdekUuid` или `cdekNumber`), чужой — молча 200;
3. статус берём **повторным запросом** `GET /v2/orders/{uuid}`, а не из тела. Повторы раз в 30 секунд гасятся.

Подделанный вебхук максимум вызовет лишнее обновление статуса. Если вебхук потерялся, раз в 20 минут работает фоновая сверка.

**Настройки — в env, а не в БД.** Это осознанный выбор. Плюс: ноль новых экранов и моделей, значения меняются раз в год после ответов клиента. Минус: на смену нужна выкатка (около 3 минут). Таблица настроек с экраном в админке — отдельная задача, если клиент захочет переключать сам.

**Что я проверил, а что нет.** Сайт документации `api-docs.cdek.ru` из этой среды недоступен (DNS заблокирован; чтобы смотреть его, домен нужно разрешить в сетевых настройках сессии). Пути API, OAuth, `suggest/cities`, печать и **все номера тарифов** сверены по официальному open-source плагину СДЭК (`github.com/cdek-it/wordpress`, файлы `src/CdekApi.php`, `src/Config.php`, `src/Model/Tariff.php`). Помечено «⚠ сверить» и проверяется smoke-скриптом: формат тела вебхука, список кодов статусов, `GET /orders?im_number=`, формат `format` у штрихкодов, ссылка трекинга на cdek.ru.

Тарифы (подтверждено): 136 Посылка склад-склад, 137 склад-дверь, 138 дверь-склад, 139 дверь-дверь, 366 дверь-постамат, 368 склад-постамат. Экономичная посылка: 233, 234, 378. Экспресс: 480–486. `delivery_mode`: 1 д-д, 2 д-с, 3 с-д, 4 с-с, 6 д-постамат, 7 с-постамат. Город Москва — код 44.

---

## 1. Дефекты в текущем коде, найденные по ходу (чинятся в шаге 2)

1. **Курьерский заказ сейчас не оформляется.** `client/src/components/pages/CheckoutPage.tsx:181-187` шлёт `address.index` и `apartment: null`. Сервер (`server/src/routes/orders/index.ts:14-23`) ждёт `postalCode`, а `apartment` у него `string | undefined`, `null` не проходит. Итог: `400 VALIDATION_ERROR` на любом курьерском заказе. Тестов с `cdek_courier` в `checkout.integration.test.ts` нет.
2. **`ps.order.status` в схеме расходится с базой.** В `server/src/schemas/common.ts:669` перечислены `processing`, `shipped`, а в Prisma — `packed`, `in_transit`. В `ps.orderPayment.paymentStatus` (`:657`) нет `refunded`.
3. **`OrderView.tsx` читает несуществующие поля.** Он ждёт `address.index` и `pvzCode`, а API отдаёт `deliveryAddress` и `cdekPvzCode`. На /track и в «Моих заказах» адрес и ПВЗ не показываются. Трек-номера в `ps.order` нет вовсе: покупатель его не видит, даже если менеджер его ввёл.

---

## 2. Env-переменные

Читаются только в `server/src/services/cdek/config.ts`. Правило «`NODE_ENV` только в `lib/env.ts`» не нарушается: `NODE_ENV` здесь не нужен.

| Переменная | Дефолт | Где хранится | Смысл / вопрос клиенту (06-cdek.md) |
|---|---|---|---|
| `PS_CDEK` | `on` | GitHub **var** | выключатель; `off` = интеграция выключена при любых ключах |
| `PS_CDEK_CLIENT_ID` | `''` | **secret** | Account (А3). Пусто = выключено |
| `PS_CDEK_CLIENT_SECRET` | `''` | **secret** | Secure password (А3) |
| `PS_CDEK_BASE_URL` | `https://api.edu.cdek.ru/v2` | var | разрешены **только** `https://api.edu.cdek.ru/v2` и `https://api.cdek.ru/v2`, иное — отказ старта: токен не должен уйти на чужой хост |
| `PS_CDEK_WEBHOOK_SECRET` | `''` | **secret** | `openssl rand -hex 32`, не короче 32 символов. Пусто = вебхук не регистрируется, роут отдаёт 404, работает только фоновая сверка. **Для edu и прода — разные значения** (см. риски) |
| `PS_CDEK_FROM_CITY_CODE` | `44` | var | TODO-клиент Б4 |
| `PS_CDEK_FROM_POSTAL_CODE` | `''` | var | TODO-клиент Б4 |
| `PS_CDEK_FROM_ADDRESS` | `Москва, Звенигородское шоссе, 3Ас1` | var | TODO-клиент Б4 |
| `PS_CDEK_SHIPMENT_POINT` | `''` | var | код ПВЗ сдачи, TODO-клиент Б4. Если задан — `shipment_point`, иначе `from_location` |
| `PS_CDEK_TARIFF_PVZ` | `136` | var | TODO-клиент Г11 |
| `PS_CDEK_TARIFF_POSTAMAT` | `368` | var | TODO-клиент Г11/Г12 |
| `PS_CDEK_TARIFF_COURIER` | `137` | var | TODO-клиент Г11 |
| `PS_CDEK_BOX` | `20x15x10` | var | Д×Ш×В, см; TODO-клиент В7 |
| `PS_CDEK_BOX_WEIGHT_G` | `150` | var | TODO-клиент В7 |
| `PS_CDEK_ITEM_WEIGHT_G` | `300` | var | вес позиции, если у фасовки нет `weightGrams`; TODO-клиент В8 |
| `PS_CDEK_PAID_DELIVERY` | `tariff` | var | `tariff` или `fixed` (200 ₽ ниже порога); TODO-клиент Г9/Г10 |
| `PS_CDEK_AUTO_CREATE` | `off` | var | `off` или `on_paid`; TODO-клиент Е17 |
| `PS_CDEK_ORDER_PREFIX` | edu: `T<6 hex sha1(os.hostname())>-`, бой: `''` | var | на edu аккаунт общий для всех, номер `PS-000001` у кого-то уже есть |

**Строки в `.github/workflows/deploy-perfect-skin.yml`** — по образцу `SVC_SMTP_*`:

```yaml
# env:
          SVC_PS_CDEK: ${{ vars.PS_CDEK }}
          SVC_PS_CDEK_CLIENT_ID: ${{ secrets.PS_CDEK_CLIENT_ID }}
          SVC_PS_CDEK_CLIENT_SECRET: ${{ secrets.PS_CDEK_CLIENT_SECRET }}
          SVC_PS_CDEK_WEBHOOK_SECRET: ${{ secrets.PS_CDEK_WEBHOOK_SECRET }}
          SVC_PS_CDEK_BASE_URL: ${{ vars.PS_CDEK_BASE_URL }}
          SVC_PS_CDEK_FROM_CITY_CODE: ${{ vars.PS_CDEK_FROM_CITY_CODE }}
          SVC_PS_CDEK_FROM_POSTAL_CODE: ${{ vars.PS_CDEK_FROM_POSTAL_CODE }}
          SVC_PS_CDEK_FROM_ADDRESS: ${{ vars.PS_CDEK_FROM_ADDRESS }}
          SVC_PS_CDEK_SHIPMENT_POINT: ${{ vars.PS_CDEK_SHIPMENT_POINT }}
          SVC_PS_CDEK_TARIFF_PVZ: ${{ vars.PS_CDEK_TARIFF_PVZ }}
          SVC_PS_CDEK_TARIFF_POSTAMAT: ${{ vars.PS_CDEK_TARIFF_POSTAMAT }}
          SVC_PS_CDEK_TARIFF_COURIER: ${{ vars.PS_CDEK_TARIFF_COURIER }}
          SVC_PS_CDEK_BOX: ${{ vars.PS_CDEK_BOX }}
          SVC_PS_CDEK_BOX_WEIGHT_G: ${{ vars.PS_CDEK_BOX_WEIGHT_G }}
          SVC_PS_CDEK_ITEM_WEIGHT_G: ${{ vars.PS_CDEK_ITEM_WEIGHT_G }}
          SVC_PS_CDEK_PAID_DELIVERY: ${{ vars.PS_CDEK_PAID_DELIVERY }}
          SVC_PS_CDEK_AUTO_CREATE: ${{ vars.PS_CDEK_AUTO_CREATE }}
          SVC_PS_CDEK_ORDER_PREFIX: ${{ vars.PS_CDEK_ORDER_PREFIX }}
# envs: дописать через запятую все SVC_PS_CDEK_* выше
# script: после upsert_env PS_DADATA_API_KEY ...
            upsert_env PS_CDEK "$SVC_PS_CDEK"
            upsert_env PS_CDEK_CLIENT_ID "$SVC_PS_CDEK_CLIENT_ID"
            upsert_env PS_CDEK_CLIENT_SECRET "$SVC_PS_CDEK_CLIENT_SECRET"
            upsert_env PS_CDEK_WEBHOOK_SECRET "$SVC_PS_CDEK_WEBHOOK_SECRET"
            upsert_env PS_CDEK_BASE_URL "$SVC_PS_CDEK_BASE_URL"
            # ... и так же по каждой SVC_PS_CDEK_* переменной
```

Секреты — `secrets`, остальное — `vars` (Repository variables): значения открытые, их удобно видеть. Пустая var на сервере ничего не меняет, срабатывает дефолт из `config.ts`. На этапе теста в `PS_CDEK_CLIENT_ID` и `PS_CDEK_CLIENT_SECRET` кладутся **публичные тестовые учётные данные edu**: они в документации СДЭК и в `cdek-it/wordpress/src/Config.php` (`TEST_CLIENT_ID` / `TEST_CLIENT_SECRET`). Литералом в код и в `.env.example` их не вписывать. В `server/.env.example` и `deploy/env.production.example` — только пустые ключи с комментарием.

---

## 3. Схема БД — аддитивно, `server/prisma/schema.prisma`

```prisma
/// Состояние ПЕРЕДАЧИ заказа в СДЭК (наша сторона), не статус доставки.
enum CdekSyncState {
  creating // передача захвачена (защита от двойного нажатия), запрос в полёте
  accepted // СДЭК принял запрос, cdek_number ещё нет
  created  // есть cdek_number = трек
  invalid  // СДЭК отклонил, текст в cdekError; можно передать повторно
}

model Order {
  // ... существующие поля без изменений ...
  cdekCityCode     Int?            // код города назначения в справочнике СДЭК
  cdekTariffCode   Int?            // тариф, по которому считали (136/137/368…)
  deliveryPoint    Json?           // снимок ПВЗ на момент заказа: { code, type, name, address, city, cityCode, workTime }
  deliveryQuote    Json?           // снимок расчёта: { source, cdekSum (коп.), periodMin, periodMax, weightGrams, calculatedAt }
  cdekUuid         String?         @unique // uuid заказа в СДЭК
  cdekNumber       String?         @unique // номер СДЭК = трек-номер; дублируется в deliveryTrackNumber
  cdekState        CdekSyncState?
  cdekRequestedAt  DateTime?       // момент захвата передачи — для восстановления зависших
  cdekError        String?         // последняя ошибка СДЭК, ≤ 1000 символов
  cdekStatusCode   String?         // последний код статуса доставки СДЭК
  cdekStatusName   String?         // его русское название из ответа СДЭК (показываем покупателю)
  cdekStatusAt     DateTime?
  trackEmailSentAt DateTime?       // письмо с треком отправлено — идемпотентность
  cdekEvents       CdekStatusEvent[]

  @@index([cdekState, status])     // выборка фоновой сверки
}

/// История статусов доставки СДЭК. Только добавление (soft delete не нужен — журнал),
/// повторы вебхука и опроса отсекаются уникальным ключом.
model CdekStatusEvent {
  id         String   @id @default(uuid())
  orderId    String
  code       String
  name       String?
  city       String?
  occurredAt DateTime
  source     String   // webhook | poll | manual | submit
  createdAt  DateTime @default(now())

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@unique([orderId, code, occurredAt])
  @@index([orderId, occurredAt])
  @@map("cdek_status_events")
}

model ProductVariant {
  // ...
  weightGrams Int? // вес в упаковке, г; null = PS_CDEK_ITEM_WEIGHT_G
}
```

**Миграция** `server/prisma/migrations/20261031000001_cdek_integration/migration.sql`. Написана вручную (у `migrate dev` есть чужой дрейф схемы), сверено `migrate diff`, что внутри только:
- `CREATE TYPE "CdekSyncState"`;
- `ALTER TABLE "orders" ADD COLUMN ...` — все колонки nullable без DEFAULT, это мгновенно и без перезаписи таблицы;
- два `CREATE UNIQUE INDEX` (`cdekUuid`, `cdekNumber`) и `CREATE INDEX (cdekState, status)`;
- `ALTER TABLE "product_variants" ADD COLUMN "weightGrams" INTEGER`;
- `CREATE TABLE "cdek_status_events"`, его индексы и FK с CASCADE.

Ни одного DROP, RENAME или NOT NULL. Откат — удаление добавленного. Перед выкаткой — `migration-guard`.

В `prisma/sql/01-constraints.sql` (идемпотентно):
`ALTER TABLE product_variants ADD CONSTRAINT product_variants_weight_positive CHECK ("weightGrams" IS NULL OR "weightGrams" > 0);`

Правила `organizationId` и `@@index([organizationId])` неприменимы: мультитенантности нет.

---

## 4. Сервис `server/src/services/cdek/`

```
services/cdek/
├── config.ts         # parseCdekConfig, cdekConfig
├── http.ts           # CdekHttp: токен, таймауты, лимит ответа, предохранитель, ошибки
├── schemas.ts        # zod-схемы ответов СДЭК (ответ стороннего API не доверенный)
├── parse.ts          # чистые преобразования сырых ответов в наши типы
├── client.ts         # CdekClient: методы API v2
├── cache.ts          # CachedLoader: TtlCache + склейка одновременных промахов
├── registry.ts       # getCdek() / setCdekForTests()
├── quote.service.ts  # посылка, цена для покупателя, котировки, разрешение для заказа
├── status-map.ts     # код СДЭК → эффект на OrderStatus
└── order-sync.ts     # CdekOrderSync: передача, обновление, вебхук, сверка, письмо
```

### config.ts
```ts
export type CdekPaidMode = 'tariff' | 'fixed'
export type CdekAutoCreate = 'off' | 'on_paid'
export interface CdekBox { lengthCm: number; widthCm: number; heightCm: number; weightG: number }
export interface CdekConfig {
  baseUrl: string; isTest: boolean; clientId: string; clientSecret: string
  webhookSecret: string | null
  fromCityCode: number; fromPostalCode: string | null; fromAddress: string | null; shipmentPoint: string | null
  tariffs: { pvz: number; postamat: number; courier: number }
  box: CdekBox; itemWeightG: number
  paidMode: CdekPaidMode; autoCreate: CdekAutoCreate; orderNumberPrefix: string
}
export class CdekConfigError extends Error {}
/** null = интеграция выключена. Бросает CdekConfigError на кривые значения при включённой. */
export function parseCdekConfig(env: Record<string, string | undefined>, hostname?: string): CdekConfig | null
export const cdekConfig: CdekConfig | null
```
Проверки:
- целые > 0 у кодов, тарифов и весов;
- `PS_CDEK_BOX` по регулярке `^\d{1,3}x\d{1,3}x\d{1,3}$`;
- `webhookSecret` короче 32 символов → ошибка;
- `baseUrl` вне двух разрешённых → ошибка.

В `server/src/index.ts`: при `CdekConfigError` — `app.log.fatal` и `process.exit(1)`.

### http.ts
```ts
export class CdekUnavailableError extends Error {
  constructor(readonly reason: 'network' | 'timeout' | 'http_5xx' | 'bad_response' | 'too_large' | 'circuit_open', readonly httpStatus?: number)
}
export class CdekRejectedError extends Error {
  constructor(readonly httpStatus: number, readonly messages: string[])
}
export interface CdekRequestOptions<T> {
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  schema: z.ZodType<T>
  timeoutMs?: number   // дефолт 8000; deliverypoints 20000
  maxBytes?: number    // дефолт 1_000_000; deliverypoints 30_000_000
}
export class CdekHttp {
  constructor(cfg: Pick<CdekConfig, 'baseUrl' | 'clientId' | 'clientSecret'>, fetchImpl?: typeof fetch, now?: () => number)
  request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, opts: CdekRequestOptions<T>): Promise<T>
  downloadPdf(url: string, maxBytes?: number): Promise<Buffer>   // дефолт 10_000_000
}
export async function readBodyLimited(res: Response, maxBytes: number): Promise<string>
```

**Токен.** `POST {base}/oauth/token`, тело `application/x-www-form-urlencoded`: `grant_type=client_credentials&client_id=…&client_secret=…`. Плагин СДЭК шлёт те же параметры в query; если edu откажет телом, smoke это покажет — тогда переходим на query.
- Ответ: `{ access_token, expires_in }`.
- Кэш в памяти до `now + (expires_in − 60) * 1000`.
- Склейка одновременных запросов: один `Promise` на все.
- На `401` от любого метода — сбросить токен и повторить **один раз**.

**Ошибки.**
- Сеть, `AbortController`-таймаут, 5xx, ответ не прошёл zod, превышен `maxBytes` → `CdekUnavailableError`.
- 4xx с `errors[] | requests[].errors[]` → `CdekRejectedError(messages)`.
- Тексты ошибок и логи **никогда** не содержат `client_secret`, токен и тело запроса с ПДн. Логировать: метод, путь без query, http-статус, длительность.

**Предохранитель.** 3 подряд `CdekUnavailableError` → 30 секунд сразу бросаем `circuit_open`. Иначе при падении СДЭК каждый чекаут ждёт по 8 секунд.

**`downloadPdf`.** URL приходит из ответа СДЭК. Требуем `https:` и `new URL(url).host === new URL(baseUrl).host`, иначе `bad_response`: Bearer-токен не должен уехать на чужой хост. Ответ должен начинаться с `%PDF`.

### client.ts (пути подтверждены по `cdek-it/wordpress/src/CdekApi.php`, кроме помеченных)
```ts
export interface CdekCity { code: number; name: string }
export interface CdekPoint { code: string; type: 'PVZ' | 'POSTAMAT'; name: string; address: string; city: string; cityCode: number; workTime: string | null; metro: string | null; lat: number; lon: number }
export interface CdekPackage { weight: number; length: number; width: number; height: number }   // г, см
export interface CdekTariffQuote { tariffCode: number; deliverySumRub: number; periodMin: number; periodMax: number }
export interface CdekStatus { code: string; name: string | null; city: string | null; at: Date }
export interface CdekOrderInfo { uuid: string; number: string | null; cdekNumber: string | null; requestState: 'ACCEPTED' | 'WAITING' | 'SUCCESSFUL' | 'INVALID' | null; requestErrors: string[]; statuses: CdekStatus[] }

export class CdekClient {
  constructor(http: CdekHttp, cfg: CdekConfig)
  suggestCities(q: string): Promise<CdekCity[]>                 // GET /location/suggest/cities?name=&country_code=RU → [{ code, full_name }]
  listPoints(cityCode: number): Promise<CdekPoint[]>            // GET /deliverypoints?city_code=&country_code=RU&type=ALL&is_handout=true
  tariffList(toCityCode: number, pkg: CdekPackage): Promise<CdekTariffQuote[]>
      // POST /calculator/tarifflist { type: 1, currency: 1, lang: 'rus', from_location: { code: fromCityCode, postal_code? },
      //   to_location: { code: toCityCode }, packages: [pkg] } → tariff_codes[]
  createOrder(payload: CdekCreateOrderPayload): Promise<{ uuid: string }>   // POST /orders → entity.uuid (202)
  getOrder(uuid: string): Promise<CdekOrderInfo>                // GET /orders/{uuid}
  findOrderByNumber(number: string): Promise<CdekOrderInfo | null>          // GET /orders?im_number= ⚠ сверить
  createPrint(kind: 'waybill' | 'barcode', orderUuid: string): Promise<string>
      // waybill: POST /print/orders { orders: [{ order_uuid }], copy_count: 2 }
      // barcode: POST /print/barcodes { orders: [{ order_uuid }], copy_count: 1, format: 'A6' } ⚠ сверить format
  getPrint(kind: 'waybill' | 'barcode', printUuid: string): Promise<{ url: string | null; lastStatus: string | null }>   // GET /print/{orders|barcodes}/{uuid}
  downloadPdf(url: string): Promise<Buffer>
  listWebhooks(): Promise<{ uuid: string; type: string; url: string }[]>   // GET /webhooks
  createWebhook(url: string): Promise<string>                   // POST /webhooks { type: 'ORDER_STATUS', url }
  deleteWebhook(uuid: string): Promise<void>                    // DELETE /webhooks/{uuid}
}
```

### parse.ts (чистые функции, всё на фикстурах)
```ts
export function toPoints(raw: unknown): { points: CdekPoint[]; skipped: number }   // safeParse поштучно: битая точка пропускается, неизвестный type — тоже
export function toTariffs(raw: unknown): CdekTariffQuote[]
export function toCities(raw: unknown): CdekCity[]                                  // не больше 10
export function toOrderInfo(raw: unknown): CdekOrderInfo                            // cdek_number: string | number → String
export function collectErrors(raw: unknown): string[]                               // errors[].message + requests[].errors[].message, каждая ≤ 300 символов
export function parseCdekDateTime(s: string): Date   // СДЭК отдаёт "2026-10-30T12:00:00+0700" — смещение без двоеточия; вставить его до new Date()
```

### cache.ts
```ts
export class CachedLoader<V> {
  constructor(ttlMs: number, maxEntries: number)   // внутри lib/ttl-cache.ts + Map<string, Promise<V>> для склейки промахов
  get(key: string, load: () => Promise<V>): Promise<V>
}
```
| Кэш | Ключ | TTL | maxEntries |
|---|---|---|---|
| города | `q.trim().toLowerCase()` | 24 ч | 2000 |
| ПВЗ | `cityCode` | 6 ч | 100 (Москва — несколько тысяч точек, держим только узкие поля) |
| тарифы | `${toCityCode}\|${weightBucket}\|${LxWxH}` | 30 мин | 2000 |

Отказ СДЭК «нет тарифов в город» (`CdekRejectedError` или пустой список) кэшируется как `[]` на 10 минут. `CdekUnavailableError` не кэшируется: этим занимается предохранитель.

### registry.ts
```ts
export interface CdekServices { config: CdekConfig; client: CdekClient }
export function getCdek(): CdekServices | null      // null при cdekConfig === null
export function setCdekForTests(s: CdekServices | null): void
```

### quote.service.ts
```ts
export type QuoteSource = 'fixed' | 'cdek' | 'fallback' | 'free' | 'needs_city' | 'unavailable'
export interface ParcelItem { weightGrams: number | null; quantity: number }

/** вес = коробка + Σ(weightGrams ?? itemWeightG) × qty, округление ВВЕРХ до 250 г (минимум 250).
 *  Округлённый вес идёт и в ключ кэша, и в запрос калькулятора — цена при показе и при заказе совпадает. */
export function buildParcel(items: ParcelItem[], cfg: Pick<CdekConfig, 'box' | 'itemWeightG'>): CdekPackage
export function rublesToKopecksCeil(rub: number): number            // Math.ceil(rub) * 100 — до целого рубля вверх
export function tariffForPoint(type: 'PVZ' | 'POSTAMAT', cfg: CdekConfig): number
/** Порог — в @ps/shared. Здесь только «сколько стоит платная доставка» и источник. */
export function customerCost(input: {
  method: 'cdek_pvz' | 'cdek_courier'; goodsAfterDiscount: number
  tariff: CdekTariffQuote | null; cdekFailed: boolean; paidMode: CdekPaidMode
}): { cost: number | null; paidCost: number | null; source: QuoteSource }
```
Правила `customerCost`:
- `cdekFailed` → `paidCost = DELIVERY_COST`, `source = 'fallback'`;
- `tariff === null` → `cost = null`, `source = 'unavailable'`;
- `paidMode === 'fixed'` → `paidCost = DELIVERY_COST`, `source = 'fixed'`;
- иначе → `paidCost = rublesToKopecksCeil(tariff.deliverySumRub)`, `source = 'cdek'`;
- затем `cost = calcDeliveryCost(toCalcMethod(method), goods, paidCost)`; если `cost === 0` из-за порога → `source = 'free'`.

```ts
export class DeliveryQuoteService {
  constructor(cdek: CdekServices | null)
  cities(q: string): Promise<CdekCity[]>
  points(cityCode: number): Promise<CdekPoint[]>
  methods(input: { cityCode: number | null; items: ParcelItem[]; goodsAfterDiscount: number }): Promise<MethodQuote[]>
  resolveForOrder(input: { method: DeliveryMethod; cityCode: number | null; pvzCode: string | null; items: ParcelItem[]; goodsAfterDiscount: number }): Promise<ResolvedDelivery>
}
export interface ResolvedDelivery {
  paidCost: number            // в calcOrderTotals как deliveryPaidCost
  tariffCode: number | null; cityCode: number | null; point: CdekPoint | null
  quote: { source: QuoteSource; cdekSum: number | null; periodMin: number | null; periodMax: number | null; weightGrams: number | null; calculatedAt: string } | null
}
```
`resolveForOrder` по веткам:
- `pickup` → `paidCost 0`;
- интеграция выключена → `paidCost DELIVERY_COST`, всё остальное `null` (как сейчас);
- `cdek_pvz` → найти точку в `points(cityCode)` по `pvzCode`; нет → `409 PVZ_NOT_FOUND`. Тариф берётся по `point.type`;
- `cdek_courier` → тариф курьерский;
- нет тарифа → `409 DELIVERY_UNAVAILABLE`;
- `CdekUnavailableError` → fallback с `log.warn`.

### status-map.ts (⚠ коды по памяти, сверить smoke-ом и вебхуками на edu)
```ts
export type StatusEffect = { orderStatus: 'in_transit' | 'delivered' | null; problem: boolean }
export function effectOf(code: string): StatusEffect
export const FORWARD_FROM: Record<'in_transit' | 'delivered', OrderStatus[]>
//  in_transit ← [new, confirmed, packed];  delivered ← [new, confirmed, packed, in_transit]
```
| Коды | Эффект |
|---|---|
| `ACCEPTED`, `CREATED` | статус не меняем; `CREATED` = появился `cdek_number` |
| `RECEIVED_AT_SHIPMENT_WAREHOUSE`, `READY_FOR_SHIPMENT_IN_SENDER_CITY`, `TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY`, `SENT_TO_TRANSIT_CITY`, `ACCEPTED_IN_TRANSIT_CITY`, `ACCEPTED_AT_TRANSIT_WAREHOUSE`, `SENT_TO_RECIPIENT_CITY`, `ACCEPTED_IN_RECIPIENT_CITY`, `ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE`, `ACCEPTED_AT_PICK_UP_POINT`, `TAKEN_BY_COURIER`, `POSTOMAT_POSTED` | `in_transit` |
| `DELIVERED`, `POSTOMAT_RECEIVED` | `delivered` |
| `NOT_DELIVERED`, `RETURNED_TO_SENDER_CITY_WAREHOUSE`, `RETURNED_TO_RECIPIENT_CITY_WAREHOUSE`, `POSTOMAT_SEIZED`, `INVALID` | статус не меняем, `problem: true` → Telegram |
| неизвестный | только в историю, `log.info` |

Применение — только вперёд и атомарно: `db.order.updateMany({ where: { id, status: { in: FORWARD_FROM[target] } }, data: { status: target } })`. Из `cancelled` и `delivered` назад ничего не уводит.

### order-sync.ts
```ts
export interface CdekSyncDeps { db: PrismaClient; cdek: CdekServices; notifier: TelegramNotifier; mail: MailSender; log: FastifyBaseLogger; publicUrl: string; now?: () => number }
export function buildCreateOrderPayload(order: OrderForCdek, cfg: CdekConfig): CdekCreateOrderPayload   // чистая
export class CdekOrderSync {
  constructor(deps: CdekSyncDeps)
  submit(orderId: string, actor: 'manager' | 'auto'): Promise<void>              // бросает ApiError
  refresh(orderId: string, source: 'webhook' | 'poll' | 'manual'): Promise<void>
  applyOrderInfo(orderId: string, info: CdekOrderInfo, source: string): Promise<void>
  handleWebhook(body: CdekWebhookBody): Promise<'ignored' | 'refreshed' | 'debounced'>
  syncPending(limit?: number): Promise<{ checked: number; failed: number }>      // дефолт 50
  ensureWebhook(): Promise<void>
  onOrderPaid(orderId: string): Promise<void>                                     // только при autoCreate === 'on_paid'
  print(orderId: string, kind: 'waybill' | 'barcode'): Promise<Buffer>
  start(): () => void   // setInterval 20 мин (.unref()), возвращает stop для onClose
}
```

**`buildCreateOrderPayload`:**
```ts
{
  type: 1,
  number: cfg.orderNumberPrefix + order.number,
  tariff_code: order.cdekTariffCode,
  ...(cfg.shipmentPoint ? { shipment_point: cfg.shipmentPoint }
                        : { from_location: { code: cfg.fromCityCode, address: cfg.fromAddress, postal_code: cfg.fromPostalCode ?? undefined } }),
  ...(order.deliveryMethod === 'cdek_pvz'
     ? { delivery_point: order.cdekPvzCode }
     : { to_location: { code: order.cdekCityCode, address: `${street}, д. ${house}${apartment ? `, кв. ${apartment}` : ''}`, postal_code: postalCode ?? undefined } }),
  recipient: { name: order.recipientName, phones: [{ number: order.recipientPhone }] },  // email НЕ передаём — минимизация ПДн
  delivery_recipient_cost: { value: 0 },                 // наложенного платежа нет (Д14)
  packages: [{ number: '1', weight, length, width, height,   // вес реальный, без округления
    items: order.items.map(i => ({
      name: `${i.productName} ${i.volumeLabel}`.slice(0, 255),
      ware_key: i.productVariantId,
      payment: { value: 0 },
      cost: i.price / 100,             // объявленная стоимость, руб.; TODO-клиент Д13 (страховка)
      weight: i.weightGrams ?? cfg.itemWeightG,
      amount: i.quantity,
    })) }],
}
```
Комментарий покупателя в СДЭК не уходит: в нём может быть что угодно.

**`submit`** — защита от двойного нажатия атомарным захватом:
1. `updateMany({ where: { id, deliveryMethod: { not: 'pickup' }, status: { notIn: ['cancelled', 'delivered'] }, OR: [{ cdekState: null }, { cdekState: 'invalid' }, { cdekState: 'creating', cdekRequestedAt: { lt: now − 5 мин } }] }, data: { cdekState: 'creating', cdekRequestedAt: now, cdekError: null } })`. `count === 0` → разобрать причину и бросить `409 CDEK_ALREADY_SUBMITTED` или `CDEK_NOT_APPLICABLE`.
2. Если захватили зависший `creating`, сначала `findOrderByNumber(prefix + number)`. Нашёлся и `number` совпадает точно → «усыновить» и пропустить создание.
3. Нет `cdekTariffCode` или `cdekCityCode` (заказ создан до интеграции) → `409 CDEK_NOT_CONFIGURED` «у заказа нет города СДЭК», откат в `null`. Нет ни `shipmentPoint`, ни `fromAddress` — та же ошибка.
4. `createOrder` → `cdekUuid`, `cdekState = 'accepted'`. Затем до 3 раз `getOrder` с паузой 1.5 с (итого не больше 6 секунд), при `cdekNumber` → `applyOrderInfo`.
5. `CdekRejectedError` → `cdekState = 'invalid'`, `cdekError = messages.join('; ').slice(0, 1000)`, Telegram, `422 CDEK_REJECTED { messages }`.
6. `CdekUnavailableError` → `creating` остаётся (через 5 минут восстановится), `503 CDEK_UNAVAILABLE` «СДЭК не ответил, повторите через 5 минут».

Статус нашего заказа при передаче **не меняем**: его двигают статусы СДЭК.

**`applyOrderInfo`:**
- `requestState === 'INVALID'` → как Rejected;
- есть `cdekNumber` → `cdekState = 'created'`, `cdekNumber`, `deliveryTrackNumber = cdekNumber`;
- `cdekEventsCreateMany({ skipDuplicates: true })`;
- последний статус → `cdekStatusCode`, `cdekStatusName`, `cdekStatusAt`;
- эффект → переход вперёд, при `problem` — Telegram;
- письмо с треком: `updateMany({ where: { id, trackEmailSentAt: null, cdekNumber: { not: null } }, data: { trackEmailSentAt: now } })`, отправка только при `count === 1`. Адресат — `recipientEmail ?? user.email`.

Текст письма: «Заказ PS-000123 передан в СДЭК. Трек-номер: X. Отследить: https://www.cdek.ru/ru/tracking?order_id=X (⚠ сверить формат), статус на сайте: {publicUrl}/track?number=PS-000123».

**`handleWebhook`:**
- `type !== 'ORDER_STATUS'` → `ignored`;
- заказ ищется по `cdekUuid = body.uuid`, иначе по `cdekNumber = attributes.cdek_number`; **не по `number`** — на edu общий аккаунт;
- не нашли → `ignored`;
- `TtlCache<true>(30 с)` по `orderId` → `debounced`;
- иначе `refresh(orderId, 'webhook')`: статус из API, не из тела.

**`syncPending`:**
- выборка: `cdekState in (accepted, created)`, `status notIn (delivered, cancelled)`, `createdAt ≥ now − 60 дней`, сортировка `cdekStatusAt asc` (nulls first), `take 50`, последовательно;
- плюс зависшие `creating` старше 15 минут: `findOrderByNumber`, нашли → усыновить, нет → `cdekState = null` и Telegram «передача не прошла, нажмите снова».

**`ensureWebhook`** (при старте, без блокировки, ошибки в `warn`):
- запускается только при `webhookSecret` и непустом `publicUrl`;
- URL: `${publicUrl}/api/v1/delivery/cdek/webhook/${secret}`;
- есть точное совпадение → ничего;
- есть наши (тот же префикс пути) с другим секретом → удалить их и создать новый;
- **чужие не трогать**: на edu в списке будут вебхуки других людей.

**`print`:**
- требует `cdekUuid` и `cdekNumber`;
- uuid печатной формы кэшируется по `${orderId}|${kind}` на 1 час;
- до 5 опросов `getPrint` с паузой 2 с; `lastStatus === 'INVALID'` → `409 PRINT_FAILED`; нет `url` → `409 WAYBILL_NOT_READY` «попробуйте через минуту»;
- `downloadPdf`. Файл не храним, отдаём потоком.

**Telegram:** в `services/telegram/notifier.ts` добавить `onCdekProblem(orderId: string, reason: string)` и чистую `buildCdekProblemText({ number, reason })`. Текст без ПДн: номер заказа, код или текст проблемы, кнопка «Открыть заказ», как в `onNewOrder`.

**Автосоздание после оплаты:** в `admin-order.service.ts` `updateOrder`, когда `markPaid` перевёл заказ в `paid`, — `void sync.onOrderPaid(id)` с `.catch` → `log.warn` и Telegram. Тот же вызов позже повесить на вебхук ЮKassa. По умолчанию выключено (`off`).

---

## 5. Изменения `@ps/shared` (`shared/src/order-totals.ts`)

```ts
export function calcDeliveryCost(method: DeliveryMethod, goodsAfterDiscount: number, paidCost: number = DELIVERY_COST): number
// pickup → 0; goods ≥ порога → 0; иначе paidCost. paidCost не целый или < 0 → DELIVERY_COST
// (НЕ 0: битая котировка не должна давать бесплатную доставку)
export type OrderCalcInput = { /* … */ deliveryPaidCost?: number }   // передаётся в calcDeliveryCost
export function freeThreshold(method: DeliveryMethod): number | null  // pvz → FREE_PVZ_THRESHOLD, courier → FREE_COURIER_THRESHOLD, pickup → null
```

---

## 6. API-контракт новых и изменённых эндпоинтов

Все в формате `{ error: { code, message, details? } }`, у всех `schema.response` с `additionalProperties: false`. Новые общие схемы в `schemas/common.ts`: `ps.cdekCity`, `ps.cdekPoint`, `ps.orderDelivery`, `ps.adminCdek`.

**Публичные**, файл `server/src/routes/delivery/cdek.ts` (регистрируется рядом с `routes/delivery/index.ts`):

- `GET /api/v1/delivery/cities?q=` — подсказка города.
  - `q`: `^[\p{L}\d .()-]{2,64}$`u;
  - ответ `200 { items: [{ code, name }] }`, не больше 10;
  - `Cache-Control: public, max-age=300`;
  - ошибки: `400 VALIDATION_ERROR`, `409 CDEK_DISABLED`, `503 CDEK_UNAVAILABLE`, `429`;
  - лимит 60/мин по IP.
- `GET /api/v1/delivery/points?cityCode=&q=&type=ALL|PVZ|POSTAMAT&limit=30&offset=0` — ПВЗ города.
  - `cityCode` int 1…9 999 999, `q` ≤ 64 символов, `limit` 1…50, `offset` 0…5000;
  - фильтр на сервере: каждое слово `q` (lowercase) входит в `name + address + metro`; сортировка `address asc`;
  - ответ `200 { items: [{ code, type, name, address, workTime, metro, lat, lon }], total }`;
  - `Cache-Control: public, max-age=300`; ошибки как у `/cities`; лимит 60/мин по IP.
- `POST /api/v1/delivery/cdek/webhook/:token` — вебхук.
  - `bodyLimit: 65536`, лимит 120/мин по IP;
  - выключено, нет секрета или неверный токен (`timingSafeEqual` по sha256 обоих) → `404 NOT_FOUND`;
  - тело — zod `{ type: string, uuid?: uuid, attributes?: { cdek_number?: string | number, code?: string ≤ 64 } }`, не прошло → 400;
  - иначе `200 { ok: true }` **всегда**, даже если обновление упало (упавшее подберёт сверка), ошибка — в `warn`;
  - CSRF неприменим: кук нет, авторизации нет.

**Изменённый** `GET /api/v1/delivery/methods?promo=&cityCode=` (`routes/delivery/index.ts`). Лимит 60/мин, ключ `user.id → ps_sid → ip`. Ответ дополняется:
```json
{ "subtotal": 550000, "promo": null, "goodsAfterDiscount": 550000,
  "cdekEnabled": true,
  "methods": [
    { "code": "pickup", "...": "как сейчас", "available": true, "quoteSource": "fixed", "periodMin": null, "periodMax": null, "costByPointType": null, "requiresCity": false },
    { "code": "cdek_pvz", "title": "…", "hint": "Бесплатно от 6 000 ₽", "cost": 31000, "isFree": false, "freeFrom": 600000, "amountToFree": 50000,
      "requiresAddress": false, "requiresPvzCode": true, "requiresCity": true,
      "available": true, "quoteSource": "cdek", "periodMin": 2, "periodMax": 4,
      "costByPointType": { "PVZ": 31000, "POSTAMAT": 29000 } },
    { "code": "cdek_courier", "cost": null, "available": false, "quoteSource": "unavailable", "...": "…" }
  ] }
```
Правила:
- `cost: integer | null`: `null` при `needs_city` (интеграция включена, город не передан) и при `unavailable`;
- `costByPointType` — только у `cdek_pvz`, значение — `null`, если тариф для этого типа не возвращён;
- `cost` у `cdek_pvz` = `PVZ ?? POSTAMAT`;
- при выключенной интеграции ответ байт в байт как сейчас плюс `cdekEnabled: false` и новые поля с нейтральными значениями;
- `Cache-Control: no-store`.

**Изменённый** `POST /api/v1/orders`:
- новое поле `cdekCityCode: int` — обязательно при `cdekEnabled` и способе `cdek_*`, иначе `400 CITY_REQUIRED`;
- `address.postalCode` становится необязательным (`^\d{6}$`, если передан); `address.apartment` — `string ≤ 20 | null | undefined`;
- в `order.service.ts`: до `$transaction` предрасчёт `calcOrderTotals` для `goodsAfterDiscount`, затем `deliveryQuoteService.resolveForOrder(...)`; в транзакции — `calcOrderTotals({ ..., deliveryPaidCost: resolved.paidCost })`; в `order.create` пишутся `cdekCityCode`, `cdekTariffCode`, `deliveryPoint`, `deliveryQuote`;
- новые ошибки: `400 CITY_REQUIRED`, `409 PVZ_NOT_FOUND`, `409 DELIVERY_UNAVAILABLE`;
- `TOTAL_MISMATCH` работает как раньше.

**Изменённый `ps.order`** (используют `POST /orders`, `GET /orders/:number`, `GET /orders/track`):
- добавить `delivery: { trackNumber, trackUrl, carrierStatus, carrierStatusAt, point: { code, type, name, address, workTime } | null, periodMin, periodMax }`, все поля nullable;
- `trackNumber = deliveryTrackNumber`;
- `trackUrl` строится только при наличии `cdekNumber`;
- `carrierStatus = cdekStatusName`;
- исправить enum `status` на значения из Prisma, в `paymentStatus` добавить `refunded`;
- `formatOrderResponse` заполняет `delivery`.

**Админка**, файл `server/src/routes/admin/cdek.ts` → `cdekAdminRoutes(app, preHandlers)`. Регистрируется в `routes/admin/index.ts` с `ordersPreHandlers` (`super_admin`, `orders_manager`). Лимит 20/мин на `user.id`.
- `POST /api/v1/admin/orders/:id/cdek` — передать в СДЭК → `200 ps.adminOrder`. Ошибки: `404 ORDER_NOT_FOUND`, `409 CDEK_DISABLED | CDEK_ALREADY_SUBMITTED | CDEK_NOT_APPLICABLE | CDEK_NOT_CONFIGURED`, `422 CDEK_REJECTED { messages }`, `503 CDEK_UNAVAILABLE`.
- `POST /api/v1/admin/orders/:id/cdek/refresh` — обновить статус сейчас → `200 ps.adminOrder`.
- `POST /api/v1/admin/orders/:id/cdek/print` — тело `{ kind: 'waybill' | 'barcode' }`, ответ `application/pdf`, `Content-Disposition: attachment; filename="cdek-PS-000123-waybill.pdf"`, `Cache-Control: no-store`. Ошибки: `409 WAYBILL_NOT_READY | PRINT_FAILED`, `503`. Сделан POST, а не GET: GET с побочным эффектом у СДЭК при входе по lax-куке открывался бы чужой ссылкой.
- `ps.adminOrder` дополняется `cdek` (всегда объект): `{ enabled, state, uuid, number, statusCode, statusName, statusAt, error, tariffCode, cityCode, point, quote, canSubmit, history: [{ code, name, city, occurredAt }] }`. `history` — последние 50, только в `GET /admin/orders/:id`, в списке `[]`. `canSubmit` считает сервер.
- `PATCH /admin/orders/:id`: при непустом `cdekNumber` изменение `deliveryTrackNumber` → `409 TRACK_MANAGED_BY_CDEK`.

**Логи и Nginx:**
- в `server/src/lib/log-mask.ts` — `export function maskSensitiveUrl(url: string): string`, туда перенести маску `/api/v1/review/…` и добавить `/api/v1/delivery/cdek/webhook/[^/?]+` → `[скрыто]`; `index.ts` использует её в сериализаторе `req`;
- в `deploy/nginx-perfect-skin.conf` — блок `location /api/v1/delivery/cdek/webhook/ { access_log off; ...proxy как у /api/v1/review/ }`. Конфиг Nginx деплоем не перезаписывается: применить разово через `run-command-perfect-skin.yml` (`nginx -t && systemctl reload nginx`).

**Запуск в `server/src/index.ts`:**
- после `app.decorate('telegram')` при `getCdek()` создать `CdekOrderSync` и `app.decorate('cdekSync', sync)`, расширив `declare module`;
- `const stop = sync.start()`, `void sync.ensureWebhook()`, в `onClose` вызвать `stop()`.

---

## 7. Клиент

**Чекаут:**
- `client/src/lib/delivery-api.ts` (новый): `getCities(q): Promise<CityOption[]>`, `getPoints(cityCode, q, type, offset): Promise<{ items: PickupPoint[]; total: number }>` и типы.
- `client/src/lib/cart-api.ts`:
  - `getDeliveryMethods(promoCode?: string, cityCode?: number)`;
  - в `DeliveryMethod` добавить `cost: number | null`, `available`, `quoteSource`, `periodMin`, `periodMax`, `costByPointType`, `requiresCity`;
  - в `DeliveryQuote` добавить `cdekEnabled`;
  - `client/src/lib/cart-demo.ts` возвращает `cdekEnabled: false`.
- `client/src/components/checkout/CityPicker.tsx` (новый):
  - комбобокс по ARIA: `role="combobox"` + `listbox` / `option`, `aria-expanded`, `aria-activedescendant`, клавиши ↑ ↓ Enter Esc;
  - подпись «Город доставки», запрос с 2 символов, debounce 300 мс;
  - выбранное `{ code, name }` уходит наверх и запоминается в `localStorage` `ps_checkout_city` (только город, не ПДн);
  - цель касания ≥ 44 px.
- `client/src/components/checkout/PvzPicker.tsx` (новый):
  - поиск «Улица, метро или название пункта» с debounce 300 мс;
  - список — `radiogroup`: название, адрес, часы, метка «Постамат»; «Показать ещё» через `offset`;
  - выбранная точка сворачивается в карточку с кнопкой «Изменить»;
  - состояния: загрузка, пусто, ошибка `CDEK_UNAVAILABLE` («СДЭК временно недоступен» и кнопка «Повторить»).
- `client/src/components/pages/CheckoutPage.tsx`:
  - при `quote.cdekEnabled` над способами ставится `CityPicker`; `cityCode` входит в зависимости загрузки способов;
  - при `requiresPvzCode` — `PvzPicker` вместо текстового поля;
  - у курьера город берётся из пикера (только чтение), поля улица / дом / кв. / индекс (индекс необязателен);
  - цена ПВЗ = `costByPointType[point.type] ?? cost`; показывается срок «2–4 дня»;
  - `cost === null` → «Выберите город» или «Недоступно для этого города», радиокнопка отключена;
  - кнопка «Оформить» выключена, пока у `cdek_*` нет города (и точки для ПВЗ);
  - в тело уходит `cdekCityCode`;
  - **при `cdekEnabled: false` всё как сейчас.** Исправить `index` → `postalCode` и не слать `apartment: null` (пустое — не слать поле).
- Токены — из `docs/projects/perfect-skin/design-system/MASTER.md`. Карта — позже, отдельной задачей: виджет СДЭК или Яндекс.Карты — это сторонний скрипт, нужен новый правовой проход A4.

**Заказ и /track** — `client/src/components/orders/OrderView.tsx`:
- типы под реальный `ps.order` (`deliveryAddress`, `cdekPvzCode`, `delivery`);
- блок «Доставка»: трек-номер со ссылкой «Отследить на сайте СДЭК» (`rel="noopener noreferrer"`), статус перевозчика и дата, пункт выдачи с адресом и часами.

**Админка:**
- `client/src/lib/admin-api.ts`: `adminCdekSubmit(id)`, `adminCdekRefresh(id)`, `adminCdekPrint(id, kind): Promise<Blob>` (по образцу `downloadConsentDoc`), тип `AdminCdek` в `AdminOrderDetail`.
- `client/src/components/admin/orders/CdekPanel.tsx` (новый):
  - состояние словами («Не передан / Передаём… / Принят, ждём номер / Создан / Ошибка: …»), трек, статус и история;
  - кнопки «Передать в СДЭК» (при `canSubmit`; во время запроса выключена), «Обновить статус», «Накладная (PDF)», «Штрихкод (PDF)»;
  - подсветка ошибки `CDEK_REJECTED` построчно; предупреждение «Заказ отменён у нас — отмените его в кабинете СДЭК», если `status === 'cancelled'` и `state === 'created'`.
- `AdminOrderPage.tsx`: вставить `CdekPanel`; поле трек-номера `readOnly` при `cdek.number`.

---

## 8. Unit-тесты (vitest, без сети: `fetch` подменяется, фикстуры в `server/src/test/fixtures/cdek/*.json`)

1. `cdek-config.unit.test.ts`:
   - выключено при пустом id или `PS_CDEK=off`;
   - чужой `baseUrl` → ошибка; `http://` → ошибка;
   - разбор `20x15x10`, кривой формат коробки → ошибка;
   - дефолты тарифов 136 / 368 / 137;
   - `webhookSecret` короче 32 → ошибка;
   - на edu префикс по умолчанию непустой и стабильный для одного hostname, на бою — пустой.
2. `cdek-http.unit.test.ts`:
   - токен запрашивается один раз на 5 параллельных запросов;
   - после `expires_in − 60` запрашивается заново;
   - `401` → новый токен и ровно один повтор;
   - таймаут → `Unavailable('timeout')`; `502` → `http_5xx`;
   - `400` с `errors` → `Rejected` с текстами;
   - ответ больше `maxBytes` → `too_large`; несовпадение zod → `bad_response`;
   - в `message` ошибок нет секрета и токена;
   - предохранитель открывается после трёх сбоев и закрывается через 30 секунд (подменённый `now`).
3. `cdek-download.unit.test.ts`: другой хост → отказ; `http:` → отказ; не `%PDF` → отказ; нормальный PDF → `Buffer`.
4. `cdek-parse.unit.test.ts`:
   - `toPoints`: битые и `type=UNKNOWN` пропущены, `skipped` посчитан, поля сужены;
   - `toTariffs`, `toCities` (не больше 10);
   - `toOrderInfo`: `cdek_number` числом → строка; `requests[].state = INVALID` → ошибки собраны;
   - `parseCdekDateTime("2026-10-30T12:00:00+0700")` → верный UTC.
5. `cdek-quote.unit.test.ts`:
   - `buildParcel`: `null`-вес → дефолт, плюс коробка, округление вверх до 250 г, минимум 250;
   - `rublesToKopecksCeil(310.4)` → 31100;
   - `customerCost`: ПВЗ 5 999,99 ₽ → тариф; ровно 6 000 ₽ → 0 и `free`; курьер 9 999 → тариф, 10 000 → 0; режим `fixed` → 20 000; сбой → `fallback` 20 000; нет тарифа → `null` и `unavailable`;
   - `tariffForPoint` для PVZ и POSTAMAT;
   - `resolveForOrder`: неизвестный код ПВЗ → `PVZ_NOT_FOUND`; выключенная интеграция → поведение как сейчас.
6. `cdek-cache.unit.test.ts`: 10 одновременных промахов → один `load`; истечение TTL; ошибка `load` не кэшируется.
7. `cdek-status-map.unit.test.ts`: `DELIVERED` → `delivered`; транзитные → `in_transit`; из `cancelled` и `delivered` переходов нет; `NOT_DELIVERED` → `problem`; неизвестный код → без эффекта.
8. `cdek-payload.unit.test.ts`:
   - ПВЗ: есть `delivery_point`, нет `to_location`;
   - курьер: строка адреса с квартирой и без;
   - `shipment_point` против `from_location`; префикс номера;
   - `cost` в рублях; у `recipient` нет `email`; `name` обрезан до 255.
9. `cdek-webhook.unit.test.ts` (Fastify `inject`, подменённый `CdekOrderSync`):
   - неверный токен → 404; выключено → 404; битое тело → 400;
   - чужой заказ → 200 без `refresh`; свой → `refresh` вызван один раз; повтор в пределах 30 секунд → не вызван;
   - `maskSensitiveUrl` скрывает токен.
10. `order-totals.test.ts` (shared): `paidCost` передаётся; `NaN` или отрицательный → `DELIVERY_COST`; пороги не изменились; старые 55 тестов зелёные.
11. `routes-boot.unit.test.ts`: регистрация delivery-роутов (cities / points / webhook) и admin cdek без дублей и ошибок схем.
12. `telegram-notifier.unit.test.ts`: `buildCdekProblemText` без ПДн.

**Интеграционные (с базой, как `checkout.integration.test.ts`)** — `cdek.integration.test.ts`:
- два одновременных `submit` → ровно один `createOrder` у фейка;
- `invalid` → повтор разрешён;
- зависший `creating` → сначала `findOrderByNumber`;
- письмо с треком уходит ровно один раз при повторных `applyOrderInfo`;
- чекаут при включённом фейке пишет `cdekTariffCode`, `deliveryPoint`, `deliveryQuote`;
- `TOTAL_MISMATCH`, если цена тарифа сменилась;
- курьерский заказ без `postalCode` проходит (регресс дефекта 1.1).

---

## 9. Smoke-проверка вживую

`server/tools/cdek-smoke.ts`, скрипт в `server/package.json`: `"cdek:smoke": "tsx tools/cdek-smoke.ts"`. Использует только `services/cdek/{config,http,client,parse}`, без БД.

Шаги:
1. токен;
2. `suggestCities('Москва')` → есть код 44;
3. `listPoints(44)` → больше нуля, все коды проходят `^[A-Z0-9-]{2,20}$` (если нет — расширить регулярку в заказе);
4. `tariffList(44 → 137 СПб)` для дефолтной посылки → печать, каких из 136 / 137 / 368 нет;
5. с флагом `--create`: заказ `T…-SMOKE-<timestamp>` в первую ПВЗ СПб, `shipment_point` = первая точка Москвы с `is_reception`; опрос до 30 с до `cdek_number`; накладная → PDF начинается с `%PDF`; `DELETE /orders/{uuid}`;
6. с флагом `--shapes`: печатать **только ключи** ответов (без значений) — сверить фикстуры.

Токен и данные не печатаются. Выход с кодом 1 при любом провале.

Workflow `.github/workflows/perfect-skin-cdek-smoke.yml`:
- `workflow_dispatch` с вводом `create: boolean`;
- `ubuntu-latest`, `setup-node@v4` (node 20), `npm ci`, `npm run cdek:smoke --workspace=@ps/server -- ${{ inputs.create && '--create' || '' }}`;
- env: `PS_CDEK_BASE_URL=https://api.edu.cdek.ru/v2`, `PS_CDEK_CLIENT_ID=${{ secrets.PS_CDEK_TEST_CLIENT_ID }}`, `PS_CDEK_CLIENT_SECRET=${{ secrets.PS_CDEK_TEST_CLIENT_SECRET }}`.

Если СДЭК режет зарубежные IP раннеров GitHub, запасной путь — с сервера в России через `run-command-perfect-skin.yml`:
`cd projects/perfect-skin/server && set -a && . ./.env && set +a && npx tsx tools/cdek-smoke.ts`

---

## 10. Порядок шагов (каждый — отдельный коммит, перед пушем `fetch` и разбор чужого)

1. `feat(ps-shared): delivery paid cost parameter` — шаг 5 и его тесты.
2. `fix(ps): courier address fields and order schema enums` — дефекты 1.1–1.3, частично: клиентский `postalCode` и `apartment`, enum в `ps.order` и `ps.orderPayment`, поля `OrderView`. Ревью: `react-reviewer`.
3. `feat(ps-db): additive CDEK schema` — схема, миграция, constraint. Обязательно `database-reviewer` и `migration-guard`.
4. `feat(ps-cdek): API client with token cache and guards` — `config`, `http`, `schemas`, `parse`, `client`, `cache`, `registry`, фикстуры, тесты 1–4 и 6.
5. `chore(ps-cdek): live smoke script and workflow` — раздел 9. **Сразу прогнать** (GitHub Actions или сервер) и подправить фикстуры и схемы по `--shapes`, пока поверх ничего не построено.
6. `feat(ps-delivery): CDEK quotes, cities and pickup points API` — `quote.service`, `/cities`, `/points`, расширение `/methods`, лимиты, тесты 5 и 11.
7. `feat(ps-orders): server-side CDEK delivery pricing on checkout` — изменения `POST /orders` и интеграционные тесты чекаута.
8. `feat(ps-client): city and pickup point pickers in checkout` — раздел 7, чекаут. Ревью: `design-reviewer` по снимку трёх ширин и `react-reviewer`.
9. `feat(ps-cdek): order submission, status sync and webhook` — `status-map`, `order-sync`, вебхук-роут, `log-mask`, запуск в `index.ts`, Telegram, письмо, автосоздание, тесты 7–9 и 12, `cdek.integration.test.ts`. Ревью: `security-api-surface` (вебхук, SSRF при скачивании PDF) и `security-business-logic` (цена, двойная передача).
10. `feat(ps-admin): CDEK panel with submit, refresh and labels` — админ-роуты и `CdekPanel`.
11. `feat(ps): tracking number and carrier status for customers` — `ps.order.delivery`, `OrderView`, /track.
12. `chore(ps-deploy): CDEK env, nginx webhook location, docs`:
    - строки раздела 2 в `deploy-perfect-skin.yml`;
    - пустые ключи в `server/.env.example` и `deploy/env.production.example`;
    - блок в `deploy/nginx-perfect-skin.conf` и раздел в `deploy/DEPLOY.md` (как применить Nginx и как переключить edu → бой: сменить `PS_CDEK_BASE_URL`, ключи **и** `PS_CDEK_WEBHOOK_SECRET`);
    - обновить `docs/projects/perfect-skin/api-contract.md`: снять пункт «вызовы API СДЭК отложены», добавить разделы эндпоинтов;
    - обновить `security-profile.md`: §8 и §10 теперь применимы, где они в коде.

До выкатки: `npm run build` (shared, server, client), все тесты зелёные, `migration-guard` по шагу 3. На сервер сначала идут edu-ключи. Боевые ключи клиента — только после его ответов на А1–А3.

---

## 11. Риски и возражение

- **Общий edu-аккаунт.** Тестовые ключи публичные, поэтому `GET /v2/webhooks` на edu видят все, кто ими пользуется, — вместе с нашим секретом в URL. Вред ограничен: тело вебхука мы не доверяем, повторы гасим. Но секрет для edu и для боя должен быть разным, при переходе на бой — сменить. Номера заказов на edu тоже общие, отсюда обязательный префикс.
- **`publicUrl` сейчас пуст** (стенд только по IP). Вебхук не зарегистрируется, статусы придут сверкой раз в 20 минут. Для теста этого хватает, для боя нужен домен.
- **Fallback 200 ₽ при недоступном СДЭК** в дальний регион обходится дешевле реальной доставки. Принятый риск: заказ не теряется. `deliveryQuote.source = 'fallback'` виден менеджеру.
- **Тариф 368 на постамат и 136 на ПВЗ** — номера по коду самого СДЭК. Доступность для конкретного договора проверит smoke; если 368 не придёт, постаматы фактически пойдут по 136 — это ответ клиента на Г12.
- ВОЗРАЖЕНИЕ (уверен): в Москве у СДЭК несколько тысяч точек. Список с поиском по улице и метро работает, но для покупателя без карты это слабее, чем у конкурентов. Сейчас я бы карту не делал: она тянет сторонний скрипт (виджет СДЭК или Яндекс.Карты), а это ключ, правовой проход A4 и CSP. Но в план запуска её стоит поставить сразу после боевых ключей. Проверить просто: доля брошенных чекаутов на шаге выбора ПВЗ.

---

## 12. Правовой контур — обязательный ранний прогон `rkn-compliance`

Интеграция добавляет нового получателя ПДн. Прошу запустить `rkn-compliance` в **раннем** режиме по разделу A `docs/core/rkn-compliance.md` и зафиксировать ответы в разделе «Правовой контур» `docs/projects/perfect-skin/project.md`.

Вопросы раздела A применительно к СДЭК:

- **A1. Состав данных и цели.** В СДЭК уходят ФИО, телефон, адрес (курьер) или код ПВЗ, состав заказа и объявленная стоимость. Email и комментарий покупателя **не** уходят. Цель — исполнение договора доставки. Срок хранения у нас: `CdekStatusEvent` и снимки в заказе ПДн не содержат, ПДн остаются только в `Order`, как сейчас. Нужно решение: сколько хранить заказ с адресом после доставки.
- **A2. Размещение БД.** Без изменений: Timeweb, Россия. Новые таблицы там же, бэкапы там же. Ответы СДЭК (ПВЗ, тарифы) кэшируются только в памяти процесса.
- **A3. Способ авторизации.** Не меняется (email-OTP). Вход покупателя интеграция не затрагивает.
- **A4. Сторонние сервисы и трансграничная передача.** Новый получатель — СДЭК (Россия). Передача **не трансграничная**. Браузер с СДЭК напрямую не общается (сервер-прокси), сторонних скриптов на чекауте нет. Нужно `[клиент]`: внести СДЭК в политику ПДн как получателя или лицо, обрабатывающее по поручению (открытый вопрос 06-cdek п. 19 и 03-legal п. 9). Нужно `[студия]`: при появлении карты (виджет СДЭК или Яндекс) — новый проход A4 до встраивания.

Вопросы клиенту, которые влияют на дефолты, уже собраны в `docs/projects/perfect-skin/client/06-cdek.md`: А1–А3 (ключи), Б4 (точка отправки), В7–В8 (коробки и вес), Г9–Г12 (цена и тарифы), Д13–Д14 (страховка, наложенный платёж), Е17 (когда создавать заказ). Каждый дефолт в разделе 2 помечен своим номером.

---

Ключевые файлы, которые я читал:
- `/home/user/project_simba/projects/perfect-skin/server/src/services/order.service.ts`
- `/home/user/project_simba/projects/perfect-skin/server/src/routes/delivery/index.ts`
- `/home/user/project_simba/projects/perfect-skin/server/src/routes/orders/index.ts`
- `/home/user/project_simba/projects/perfect-skin/server/src/schemas/common.ts`
- `/home/user/project_simba/projects/perfect-skin/server/prisma/schema.prisma`
- `/home/user/project_simba/projects/perfect-skin/shared/src/order-totals.ts`
- `/home/user/project_simba/projects/perfect-skin/client/src/components/pages/CheckoutPage.tsx`
- `/home/user/project_simba/projects/perfect-skin/client/src/components/orders/OrderView.tsx`
- `/home/user/project_simba/.github/workflows/deploy-perfect-skin.yml`
- `/home/user/project_simba/projects/perfect-skin/deploy/nginx-perfect-skin.conf`
- `/home/user/project_simba/docs/projects/perfect-skin/client/06-cdek.md`
---

## 13. Проверено вживую 30.10.2026 (smoke на edu через GitHub Actions)

Workflow `perfect-skin-cdek-smoke.yml`, публичные тестовые ключи edu передаются inputs `client_id` / `client_secret` (в репозитории не хранятся).

| Проверка | Результат |
|---|---|
| Токен, `GET /location/suggest/cities` | ok, Москва = 44; поля `city_uuid`, `code` (number), `full_name`, `country_code` |
| `GET /deliverypoints` Москва | ok, 142 точки на edu; `location.city_code` — number, `phones`, `work_time_list` — массивы объектов |
| `POST /calculator/tarifflist` Москва → СПб | ok, 17 тарифов, все настроенные присутствуют; поля `tariff_code`, `delivery_sum`, `period_min/max`, `calendar_min/max` |
| `POST /orders` → `GET /orders/{uuid}` | ok, заказ принят, `cdek_number` (string) получен; `statuses` — массив объектов |
| Накладная `POST /print/orders` → PDF | ok, PDF 92 704 байт |
| Удаление тестового заказа | ok |

Не проверено вживую: вебхук (нужен публичный домен) и коды статусов `status-map.ts` — сверить по первым настоящим событиям.
