# Бонусная программа Perfect Skin: спек для coder

Спек самодостаточный: coder применяет его без собственных решений. Код в файлы не писал. Прочитаны проектные документы (project.md, api-contract.md, security-profile.md, client/05-loyalty.md, client/06-cdek.md, legal/early-check-cdek-loyalty-2026-10-30.md), anti-patterns (security, database, typescript), схема и миграции, order/promo/admin-order сервисы, роуты заказов, доставки и админки, schemas/common.ts, purge-скрипт и его workflow, deploy-workflow, CheckoutPage, OrdersPage, AdminApp, тесты чекаута.

Деньги в проекте действительно хранятся в копейках (Int). Бонусы хранятся целыми «баллами», курс — отдельная настройка `kopecksPerBonus` (по умолчанию 100, то есть 1 бонус = 1 ₽).

---

## 0. Решения простыми словами (почему так)

1. **Журнал — источник истины, баланс — его быстрая копия.** Каждая операция пишется строкой в `BonusTransaction`. `BonusAccount.balance` хранит итог, чтобы не суммировать журнал при каждом чекауте. Баланс защищён тремя рубежами:
   - блокировка строки счёта (`SELECT … FOR UPDATE`) — все операции одного человека встают в очередь;
   - условное списание (`UPDATE … WHERE balance >= x`);
   - `CHECK (balance >= 0)` в базе.

   По-хоккейному: вратарь, защитник и штанга.
2. **Начисления — это «партии» со сроком годности.** У каждого начисления есть `remaining` (сколько от партии осталось) и `expiresAt`. Списание тратит партии по очереди, начиная с той, что сгорит раньше (FIFO). Сгорает только непотраченный остаток партии. Без партий честно посчитать «что сгорит 15 декабря» нельзя.
3. **Идемпотентность записана в базе, не в коде.** Пара `@@unique([orderId, type])` не даст начислить, списать или вернуть дважды по одному заказу. Для операций без заказа (приветственные, ручные, сгорание) есть `idempotencyKey @unique`.
   - Важная тонкость. Внутри транзакции Postgres нельзя «поймать P2002 и продолжить»: после ошибки транзакция считается прерванной. Поэтому порядок такой: блокировка счёта → проверка «уже есть?» → вставка. Уникальный индекс остаётся последним рубежом.
4. **Списание бонусов — только для вошедшего покупателя.** Важно: гостевой заказ привязывается к аккаунту по email, который ввёл сам гость (`routes/orders/index.ts`). Если разрешить гостю `bonusSpend`, любой потратит чужие бонусы, просто введя чужую почту. Начислять по гостевому заказу участнику клуба безопасно.
5. **Начисление за заказ замораживается в момент заказа.** Поле `Order.bonusAccrualPlanned`: покупателю обещали N бонусов, он их и получит, даже если потом поменяют процент. Зачисление происходит в момент из настроек: «доставлен» или «оплачен» плюс задержка N дней. Его делает ночная задача, а при задержке 0 — сразу в той же транзакции, что смена статуса.
6. **Порог бесплатной доставки считается до бонусов.** Бонусы — способ оплаты, а не скидка, которая лишает бесплатной доставки. Бонусами нельзя оплатить доставку: лимит считается от товаров после промокода.
7. **Все побочные эффекты смены статуса заказа — в одной функции** `changeOrderStatus(tx, …)`. Её вызывает и админка, и будущий вебхук СДЭК. Иначе возврат бонусов при отмене сработает из админки и молча не сработает из СДЭК. Это главный стык с интеграцией СДЭК.
8. **Вступление в клуб — явное действие с записью согласия** (`ConsentPurpose.loyalty`, версия текста, дата) — требование ранней правовой проверки, п. 8. Без вступления бонусы не копятся и не тратятся.
9. **Планировщик — тот же, что уже есть**: GitHub Actions по расписанию через SSH, как `perfect-skin-purge-pro-docs.yml`. Задача только догоняет то, что уже наступило. Пропущенный запуск ничего не ломает, следующий доделает. Сгоревшие партии к тому же исключаются «лениво» при каждом списании и при показе баланса.
10. **Программа выключена** (`enabled=false` по умолчанию в БД). Пока она выключена:
    - витрина прячет весь UI;
    - вступление и списание отвечают `BONUS_PROGRAM_DISABLED`;
    - в админке настройки и счета доступны (нужно для проверки).

---

## 1. Изменения `projects/perfect-skin/server/prisma/schema.prisma`

### 1.1 Перечисления (в секцию «Перечисления»)

```prisma
enum ConsentPurpose {
  pro_application
  marketing
  consultation
  health_data
  care
  account
  loyalty // принятие Правил Бьюти-клуба (участие в программе лояльности)
}

/// Тип операции бонусного счёта. review и birthday заложены на будущее:
/// код их не создаёт (отзывов нет, дату рождения не собираем — новая цель ПДн).
enum BonusTxType {
  welcome                // приветственные при вступлении (+)
  order_accrual          // начисление за заказ (+)
  order_spend            // списание в заказе (−)
  order_spend_refund     // возврат списанного при отмене/возврате (+)
  order_accrual_reversal // отмена начисления при возврате (−)
  expiration             // сгорание остатка партии (−)
  manual_adjustment      // ручная корректировка сотрудником (±), причина и автор обязательны
  review                 // задел: бонус за отзыв (+)
  birthday               // задел: бонус ко дню рождения (+)
}

/// От чего считается начисление.
enum BonusAccrualBase {
  paid_goods  // товары − промокод − бонусы (по умолчанию)
  after_promo // товары − промокод
  gross       // товары без скидок
}

/// Когда начисление становится доступным (+ accrualDelayDays).
enum BonusAccrualTrigger {
  delivered
  paid
}

/// Тип исходящего письма: для advertising согласие marketing проверяется в момент отправки.
enum MessageKind {
  service
  advertising
}
```

### 1.2 `Order`: новые поля

Добавить отдельным блоком **в конец скалярных полей**, перед `createdAt`, с комментарием-разделителем: так правки СДЭК в том же модели сливаются без конфликта (см. раздел 9).

```prisma
  // ── Бонусы ──
  bonusSpent          Int       @default(0) // списано бонусов (штуки)
  bonusDiscount       Int       @default(0) // те же бонусы в копейках по курсу на момент заказа
  bonusAccrualPlanned Int       @default(0) // обещано к начислению (штуки), заморожено при создании
  bonusAccrualDueAt   DateTime? // когда начислить; ставится при «доставлен»/«оплачен»
  bonusAccruedAt      DateTime? // когда фактически начислено
  deliveredAt         DateTime? // ставит ТОЛЬКО changeOrderStatus (и для СДЭК тоже)
```

В relations `Order` добавить `bonusTransactions BonusTransaction[]`, в индексы — `@@index([bonusAccrualDueAt])`.

### 1.3 `User`: обратные связи

```prisma
  bonusAccount           BonusAccount?
  bonusTxCreated         BonusTransaction[]      @relation("BonusTxCreatedBy")
  loyaltySettingsUpdated LoyaltySettings[]       @relation("LoyaltySettingsUpdatedBy")
  loyaltySettingsChanges LoyaltySettingsChange[]
```

### 1.4 `ConsentRecord`: SetNull вместо Cascade

Пункт 12 ранней правовой проверки:

```prisma
model ConsentRecord {
  id          String         @id @default(uuid())
  userId      String?        // null после удаления пользователя: запись остаётся доказательством согласия
  purpose     ConsentPurpose
  textVersion String
  grantedAt   DateTime       @default(now())
  revokedAt   DateTime?

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, purpose])
  @@map("consent_records")
}
```

### 1.5 Новые модели (новая секция «Бьюти-клуб» после «Промокоды»)

```prisma
/// Настройки Бьюти-клуба. Ровно одна строка (id = 1, CHECK в миграции).
/// Программа ВЫКЛЮЧЕНА по умолчанию: включает super_admin после ответов
/// клиента (docs/projects/perfect-skin/client/05-loyalty.md) и утверждения правил.
/// Деньги — копейки, бонусы — штуки, проценты — целые 0..100.
model LoyaltySettings {
  id                          Int                 @id @default(1)
  enabled                     Boolean             @default(false)
  accrualPercent              Int                 @default(5)
  accrualBase                 BonusAccrualBase    @default(paid_goods)
  accrualTrigger              BonusAccrualTrigger @default(delivered)
  accrualDelayDays            Int                 @default(0)
  excludeProfessionalProducts Boolean             @default(true)
  accrueWithPromo             Boolean             @default(false) // начислять ли по заказу с промокодом косметолога
  kopecksPerBonus             Int                 @default(100)   // курс: 100 = 1 бонус = 1 ₽
  maxSpendPercent             Int                 @default(30)    // доля товаров после промокода
  minOrderForSpend            Int                 @default(0)     // копейки, товары после промокода
  allowSpendWithPromo         Boolean             @default(false)
  bonusTtlDays                Int                 @default(365)   // срок жизни начислений; 0 = не сгорают
  refundMinTtlDays            Int                 @default(30)    // мин. срок жизни возвращённых при отмене
  welcomeBonus                Int                 @default(0)
  welcomeTtlDays              Int                 @default(60)
  reviewBonus                 Int                 @default(0)     // задел, не используется
  reviewTtlDays               Int                 @default(90)    // задел
  expiryNoticeKind            MessageKind         @default(advertising) // задел: писем о сгорании пока нет
  expiryNoticeDaysBefore      Int                 @default(7)            // задел
  createdAt                   DateTime            @default(now())
  updatedAt                   DateTime            @updatedAt
  updatedById                 String?

  updatedBy User? @relation("LoyaltySettingsUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)

  @@index([updatedById])
  @@map("loyalty_settings")
}

/// Журнал изменений настроек: кто, когда, что было и что стало. Только вставка.
model LoyaltySettingsChange {
  id          String   @id @default(uuid())
  changedById String
  before      Json
  after       Json
  createdAt   DateTime @default(now())

  changedBy User @relation(fields: [changedById], references: [id], onDelete: Restrict)

  @@index([createdAt])
  @@index([changedById])
  @@map("loyalty_settings_changes")
}

/// Бонусный счёт участника клуба. Создаётся при вступлении (принятии правил).
/// balance = сумма amount по журналу = сумма remaining у партий-начислений.
/// Меняется ТОЛЬКО в services/bonus.service.ts под блокировкой строки счёта.
/// При удалении пользователя userId обнуляется (SetNull), история остаётся обезличенной.
/// Мягкое удаление (users.deletedAt) обезличивает счёт ночная задача.
model BonusAccount {
  id           String    @id @default(uuid())
  userId       String?   @unique
  balance      Int       @default(0)
  joinedAt     DateTime  @default(now())
  leftAt       DateTime? // вышел из клуба: не копит и не тратит, остаток заморожен до правил программы
  anonymizedAt DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user         User?              @relation(fields: [userId], references: [id], onDelete: SetNull)
  transactions BonusTransaction[]

  @@index([leftAt])
  @@map("bonus_accounts")
}

/// Журнал бонусного счёта. Строки не удаляются и не правятся, кроме remaining у партий.
/// amount со знаком: + начисление, − списание/сгорание/отмена начисления.
/// Партия = строка с amount > 0: remaining — непотраченный остаток, expiresAt — когда он сгорит (null = бессрочно).
/// У списаний remaining и expiresAt пустые (CHECK).
model BonusTransaction {
  id                 String      @id @default(uuid())
  accountId          String
  type               BonusTxType
  amount             Int
  remaining          Int?
  expiresAt          DateTime?
  orderId            String?
  idempotencyKey     String?     @unique // welcome:<userId> | manual:<uuid> | expire:<lotId>
  reason             String?     // обязательна у manual_adjustment (CHECK); покупателю не показывается
  createdById        String?     // автор ручной корректировки
  sourceMaxExpiresAt DateTime?   // у order_spend: самый поздний срок потраченных партий (null = среди них была бессрочная)
  createdAt          DateTime    @default(now())

  account   BonusAccount @relation(fields: [accountId], references: [id], onDelete: Restrict)
  order     Order?       @relation(fields: [orderId], references: [id], onDelete: Restrict)
  createdBy User?        @relation("BonusTxCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)

  @@unique([orderId, type])
  @@index([accountId, createdAt])
  @@index([accountId, expiresAt])
  @@index([orderId])
  @@index([createdById])
  @@index([createdAt])
  @@map("bonus_transactions")
}
```

Почему у `createdById` и `orderId` стоит Restrict. Финансовый журнал не должен терять ссылки. Сотрудников не удаляют, а выключают (`isActive`); заказы на проде не удаляют. Тестовая уборка удаляет строки журнала первой (раздел 7.6).

---

## 2. Миграции

Две миграции, обе в коммите шага 2. Время в имени — `20261030…`; СДЭК берёт `20261031…` и позже (раздел 9).

### 2.1 `server/prisma/migrations/20261030000001_bonus_program/migration.sql`

```sql
-- AlterEnum (значение не используется в этой же миграции)
ALTER TYPE "ConsentPurpose" ADD VALUE 'loyalty';

-- CreateEnum
CREATE TYPE "BonusTxType" AS ENUM ('welcome','order_accrual','order_spend','order_spend_refund','order_accrual_reversal','expiration','manual_adjustment','review','birthday');
CREATE TYPE "BonusAccrualBase" AS ENUM ('paid_goods','after_promo','gross');
CREATE TYPE "BonusAccrualTrigger" AS ENUM ('delivered','paid');
CREATE TYPE "MessageKind" AS ENUM ('service','advertising');

-- AlterTable: константные DEFAULT — без перезаписи таблицы (PG 11+)
ALTER TABLE "orders"
  ADD COLUMN "bonusSpent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusDiscount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusAccrualPlanned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusAccrualDueAt" TIMESTAMP(3),
  ADD COLUMN "bonusAccruedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "orders_bonusAccrualDueAt_idx" ON "orders"("bonusAccrualDueAt");

-- CreateTable
CREATE TABLE "loyalty_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "accrualPercent" INTEGER NOT NULL DEFAULT 5,
  "accrualBase" "BonusAccrualBase" NOT NULL DEFAULT 'paid_goods',
  "accrualTrigger" "BonusAccrualTrigger" NOT NULL DEFAULT 'delivered',
  "accrualDelayDays" INTEGER NOT NULL DEFAULT 0,
  "excludeProfessionalProducts" BOOLEAN NOT NULL DEFAULT true,
  "accrueWithPromo" BOOLEAN NOT NULL DEFAULT false,
  "kopecksPerBonus" INTEGER NOT NULL DEFAULT 100,
  "maxSpendPercent" INTEGER NOT NULL DEFAULT 30,
  "minOrderForSpend" INTEGER NOT NULL DEFAULT 0,
  "allowSpendWithPromo" BOOLEAN NOT NULL DEFAULT false,
  "bonusTtlDays" INTEGER NOT NULL DEFAULT 365,
  "refundMinTtlDays" INTEGER NOT NULL DEFAULT 30,
  "welcomeBonus" INTEGER NOT NULL DEFAULT 0,
  "welcomeTtlDays" INTEGER NOT NULL DEFAULT 60,
  "reviewBonus" INTEGER NOT NULL DEFAULT 0,
  "reviewTtlDays" INTEGER NOT NULL DEFAULT 90,
  "expiryNoticeKind" "MessageKind" NOT NULL DEFAULT 'advertising',
  "expiryNoticeDaysBefore" INTEGER NOT NULL DEFAULT 7,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedById" TEXT,
  CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "loyalty_settings_updatedById_idx" ON "loyalty_settings"("updatedById");

CREATE TABLE "loyalty_settings_changes" (
  "id" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_settings_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "loyalty_settings_changes_createdAt_idx" ON "loyalty_settings_changes"("createdAt");
CREATE INDEX "loyalty_settings_changes_changedById_idx" ON "loyalty_settings_changes"("changedById");

CREATE TABLE "bonus_accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "anonymizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bonus_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bonus_accounts_userId_key" ON "bonus_accounts"("userId");
CREATE INDEX "bonus_accounts_leftAt_idx" ON "bonus_accounts"("leftAt");

CREATE TABLE "bonus_transactions" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "BonusTxType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "remaining" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "orderId" TEXT,
  "idempotencyKey" TEXT,
  "reason" TEXT,
  "createdById" TEXT,
  "sourceMaxExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bonus_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bonus_transactions_idempotencyKey_key" ON "bonus_transactions"("idempotencyKey");
CREATE UNIQUE INDEX "bonus_transactions_orderId_type_key" ON "bonus_transactions"("orderId","type");
CREATE INDEX "bonus_transactions_accountId_createdAt_idx" ON "bonus_transactions"("accountId","createdAt");
CREATE INDEX "bonus_transactions_accountId_expiresAt_idx" ON "bonus_transactions"("accountId","expiresAt");
CREATE INDEX "bonus_transactions_orderId_idx" ON "bonus_transactions"("orderId");
CREATE INDEX "bonus_transactions_createdById_idx" ON "bonus_transactions"("createdById");
CREATE INDEX "bonus_transactions_createdAt_idx" ON "bonus_transactions"("createdAt");
-- Живые партии для ночного сгорания (Prisma частичные индексы не выражает)
CREATE INDEX bonus_tx_live_lots_idx ON bonus_transactions ("expiresAt") WHERE "remaining" > 0 AND "expiresAt" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loyalty_settings_changes" ADD CONSTRAINT "loyalty_settings_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bonus_accounts" ADD CONSTRAINT "bonus_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bonus_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bonus_transactions" ADD CONSTRAINT "bonus_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK: дублируются в prisma/sql/01-constraints.sql
ALTER TABLE "loyalty_settings"
  ADD CONSTRAINT loyalty_settings_singleton CHECK ("id" = 1),
  ADD CONSTRAINT loyalty_settings_ranges CHECK (
    "accrualPercent" BETWEEN 0 AND 100 AND "accrualDelayDays" BETWEEN 0 AND 60
    AND "kopecksPerBonus" BETWEEN 1 AND 10000 AND "maxSpendPercent" BETWEEN 0 AND 100
    AND "minOrderForSpend" >= 0 AND "bonusTtlDays" BETWEEN 0 AND 1825
    AND "refundMinTtlDays" BETWEEN 1 AND 365
    AND "welcomeBonus" >= 0 AND "welcomeTtlDays" BETWEEN 1 AND 365
    AND "reviewBonus" >= 0 AND "reviewTtlDays" BETWEEN 1 AND 365
    AND "expiryNoticeDaysBefore" BETWEEN 1 AND 30
  );

ALTER TABLE "bonus_accounts"
  ADD CONSTRAINT bonus_account_balance_nonneg CHECK ("balance" >= 0);

ALTER TABLE "bonus_transactions"
  ADD CONSTRAINT bonus_tx_amount_nonzero CHECK ("amount" <> 0),
  ADD CONSTRAINT bonus_tx_shape CHECK (
    ("amount" > 0
      AND "type" IN ('welcome','order_accrual','order_spend_refund','manual_adjustment','review','birthday')
      AND "remaining" IS NOT NULL AND "remaining" BETWEEN 0 AND "amount")
    OR
    ("amount" < 0
      AND "type" IN ('order_spend','order_accrual_reversal','expiration','manual_adjustment')
      AND "remaining" IS NULL AND "expiresAt" IS NULL)
  ),
  ADD CONSTRAINT bonus_tx_order_link CHECK (
    "type" NOT IN ('order_accrual','order_spend','order_spend_refund','order_accrual_reversal') OR "orderId" IS NOT NULL
  ),
  ADD CONSTRAINT bonus_tx_manual_audit CHECK (
    "type" <> 'manual_adjustment' OR ("createdById" IS NOT NULL AND char_length(btrim("reason")) BETWEEN 3 AND 300)
  );

ALTER TABLE "orders"
  ADD CONSTRAINT order_bonus_nonneg CHECK ("bonusSpent" >= 0 AND "bonusDiscount" >= 0 AND "bonusAccrualPlanned" >= 0),
  ADD CONSTRAINT order_bonus_pair CHECK (("bonusSpent" = 0) = ("bonusDiscount" = 0)),
  ADD CONSTRAINT order_bonus_within_goods CHECK ("bonusDiscount" <= "subtotal" - "promoDiscount");

-- Строка настроек: программа выключена
INSERT INTO "loyalty_settings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
```

### 2.2 `server/prisma/migrations/20261030000002_consent_records_set_null/migration.sql`

```sql
-- Согласие переживает удаление пользователя как доказательство (как ConsultationConsent).
ALTER TABLE "consent_records" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_userId_fkey";
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "consent_records" VALIDATE CONSTRAINT "consent_records_userId_fkey";
```

Обе миграции укладываются в одну выкатку. Вторая вынесена отдельно, чтобы откатывать её независимо: обратный `SET NOT NULL` невозможен, если появятся строки с null.

### 2.3 Для migration-guard

- **Всё аддитивно.** Новые колонки nullable или с константным DEFAULT — без перезаписи таблицы. Старый код совместим с новой схемой: миграция идёт до сборки и перезапуска (`deploy-perfect-skin.yml`).
- **Блокировки.** `ADD CONSTRAINT CHECK` на `orders` сканирует таблицу под ACCESS EXCLUSIVE; заказов мало, сайт не запущен. FK на `consent_records` повешен через `NOT VALID` + `VALIDATE` — так блокировка легче.
- **`ALTER TYPE … ADD VALUE`** — прецедент в проекте уже есть (`20261015000001_add_concern_oxidative_stress`).
- **Откат.** Восстановление из `pg_dump`, который выкатка снимает перед миграцией. Ручной откат (DROP таблиц, колонок и типов) возможен; значение enum `loyalty` убрать нельзя, оно безвредно.

### 2.4 `server/prisma/sql/01-constraints.sql`

Дописать в конец новую секцию «Бьюти-клуб» с теми же `ADD CONSTRAINT`, что в 2.1, плюс `CREATE INDEX IF NOT EXISTS bonus_tx_live_lots_idx …`. Выкатка переприменяет файл, ошибки «already exists» игнорирует.

### 2.5 `server/src/lib/consents.ts`

Добавить `loyalty: '2026-10-30-draft', // принятие Правил Бьюти-клуба`.

---

## 3. Общая арифметика: `projects/perfect-skin/shared/`

### 3.1 `shared/src/order-totals.ts`

- `OrderCalcInput` получает `bonusDiscount?: number` (копейки, сервер уже проверил лимит).
- `OrderTotals` получает `bonusDiscount: number`.

В `calcOrderTotals`:

```ts
const goodsAfterDiscount = Math.max(0, subtotal - promoDiscount)
const deliveryCost = calcDeliveryCost(input.deliveryMethod, goodsAfterDiscount) // порог ДО бонусов
const bonusDiscount = Math.min(Math.floor(positiveAmount(input.bonusDiscount ?? 0)), goodsAfterDiscount)
return { subtotal, promoDiscount, bonusDiscount, deliveryCost, total: goodsAfterDiscount - bonusDiscount + deliveryCost }
```

Существующие 55 тестов не меняются: по умолчанию `bonusDiscount` равен 0.

### 3.2 Новый `shared/src/bonus.ts` (экспорт из `index.ts`)

```ts
export type BonusAccrualBase = 'paid_goods' | 'after_promo' | 'gross'
export type BonusSpendRules = { kopecksPerBonus: number; maxSpendPercent: number; minOrderForSpend: number; allowSpendWithPromo: boolean }
export type BonusAccrualRules = { accrualPercent: number; accrualBase: BonusAccrualBase; kopecksPerBonus: number; excludeProfessionalProducts: boolean; accrueWithPromo: boolean }
export type BonusSpendBlock = 'PROMO_CONFLICT' | 'MIN_ORDER' | 'EMPTY_BALANCE'

export function bonusValue(points: number, kopecksPerBonus: number): number // points * kopecksPerBonus

export function calcMaxBonusSpend(input: {
  goodsAfterDiscount: number; hasPromo: boolean; available: number; rules: BonusSpendRules
}): { maxSpend: number; block: BonusSpendBlock | null }

export function calcBonusAccrual(input: {
  items: { price: number; quantity: number; isProfessional: boolean }[]
  subtotal: number; promoDiscount: number; bonusDiscount: number; hasPromo: boolean; rules: BonusAccrualRules
}): number
```

Правила `calcMaxBonusSpend`, по порядку:
1. `hasPromo && !allowSpendWithPromo` → `{0, 'PROMO_CONFLICT'}`.
2. `goodsAfterDiscount < minOrderForSpend` → `{0, 'MIN_ORDER'}`.
3. `available <= 0` → `{0, 'EMPTY_BALANCE'}`.
4. Иначе `maxSpend = min(available, floor(goodsAfterDiscount * clamp(maxSpendPercent) / (100 * kopecksPerBonus)))`, `block: null`.

Правила `calcBonusAccrual`:
- `hasPromo && !accrueWithPromo` → 0; `subtotal <= 0` → 0.
- `eligible` = сумма `price*quantity` по позициям; при `excludeProfessionalProducts` позиции с `isProfessional` пропускаются.
- База:
  - `gross` → `eligible`;
  - `after_promo` → `floor(eligible*(subtotal−promo)/subtotal)`;
  - `paid_goods` → `floor(eligible*(subtotal−promo−bonus)/subtotal)`.
- Результат: `floor(base * clamp(accrualPercent) / (100 * kopecksPerBonus))`.

Только целочисленная арифметика, всё округляется вниз.

---

## 4. Сервер: сервисы

Общее для всех сервисов:
- без `any`;
- импорт `@ps/shared` типизированно: `import type * as PsShared from '@ps/shared'` и `const shared = ((psSharedNs as { default?: typeof PsShared }).default ?? psSharedNs) as typeof PsShared`;
- `type Tx = Prisma.TransactionClient`;
- время передаётся параметром `now: Date` — так тесты управляют временем.

### 4.1 `server/src/services/loyalty-settings.service.ts`

```ts
export type LoyaltySettingsData = Omit<LoyaltySettings, 'id' | 'createdAt' | 'updatedAt' | 'updatedById'>
export const loyaltySettingsService = {
  get(tx?: Tx): Promise<LoyaltySettings>,  // upsert({ where:{id:1}, create:{id:1}, update:{} })
  getWithHistory(): Promise<{ settings: LoyaltySettings & { updatedBy: {id,name}|null }; changes: Array<{ id; createdAt; changedBy:{id,name}; before; after }> }>, // changes: take 20, createdAt desc
  update(input: LoyaltySettingsData, expectedUpdatedAt: Date, actorId: string): Promise<…same as getWithHistory>,
}
```

Как работает `update`:
- в транзакции `updateMany({ where:{ id:1, updatedAt: expectedUpdatedAt }, data:{...input, updatedById: actorId} })`;
- `count===0` → `ApiError(409,'SETTINGS_CONFLICT','Настройки изменил другой сотрудник, обновите страницу')`;
- затем `loyaltySettingsChange.create({ before, after })`. Поля перечисляются явно, тело запроса целиком в `data` не уходит.

### 4.2 `server/src/services/bonus.service.ts` — единственное место, где меняется баланс

Инвариант порядка блокировок: `product_variants` → `bonus_accounts`. Счёт никогда не блокируется раньше остатков.

```ts
export type BonusPlan = { accountId: string | null; spendPoints: number; spendDiscount: number; accrualPlanned: number }

export const bonusService = {
  // ── чтение ──
  isEligible(viewer: PriceViewer): boolean,  // viewer есть && !isWholesaleViewer && !STAFF_ROLES.includes(role)
  getSummary(userId: string, viewer: PriceViewer, now: Date): Promise<BonusSummary>,
  listTransactions(userId: string, page: { limit: number; offset: number }): Promise<{ items: CustomerBonusTx[]; total: number }>,
  quoteForCart(owner: CartOwner, viewer: PriceViewer, promo: string | undefined, spend: number, now: Date): Promise<BonusCheckoutQuote>,

  // ── членство ──
  join(userId: string, viewer: PriceViewer, now: Date): Promise<void>,
  leave(userId: string, now: Date): Promise<void>,

  // ── заказ ──
  planOrderBonus(tx: Tx, input: {
    userId: string; viewer: PriceViewer; requestedPoints: number; hasPromo: boolean
    subtotal: number; promoDiscount: number
    items: { price: number; quantity: number; isProfessional: boolean }[]
    settings: LoyaltySettings; now: Date
  }): Promise<BonusPlan>,
  spendForOrder(tx: Tx, input: { accountId: string; orderId: string; points: number; now: Date }): Promise<void>,
  onOrderStatusChanged(tx: Tx, input: { orderId: string; from: OrderStatus; to: OrderStatus; now: Date }): Promise<void>,
  onOrderPaid(tx: Tx, input: { orderId: string; now: Date }): Promise<void>,
  accrueForOrder(tx: Tx, orderId: string, now: Date): Promise<'accrued' | 'skipped'>,

  // ── админ ──
  adjust(input: { userId: string; amount: number; reason: string; expiresInDays: number | null; idempotencyKey: string; actorId: string; now: Date }): Promise<{ transaction: AdminBonusTx; balance: number; replay: boolean }>,

  // ── задачи ──
  expireDueLots(tx: Tx, accountId: string, now: Date): Promise<number>, // вызывающий держит блокировку
}
```

Внутренние функции (не экспортировать):

- **`lockAccountByUser(tx, userId)` и `lockAccountById(tx, id)`.**
  `tx.$queryRaw<{ id: string; balance: number; leftAt: Date | null }[]>\`SELECT id, balance, "leftAt" FROM bonus_accounts WHERE "userId" = ${userId} FOR UPDATE\``.
  Это тегированный шаблон: Prisma параметризует подстановку, инъекции нет.

- **`credit(tx, { accountId, type, amount, expiresAt, orderId?, idempotencyKey?, reason?, createdById? })`.**
  `bonusAccount.update({ balance: { increment } })` плюс `bonusTransaction.create({ remaining: amount })`.

- **`debit(tx, { accountId, type, amount, now, orderId?, idempotencyKey?, reason?, createdById?, preferLotId? })`.** Шаги:
  1. `bonusAccount.updateMany({ where: { id, balance: { gte: amount } }, data: { balance: { decrement: amount } } })`; `count===0` → `ApiError(409,'BONUS_INSUFFICIENT','Недостаточно бонусов', { available })`.
  2. Живые партии: `findMany({ where: { accountId, amount: { gt: 0 }, remaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }], select: { id, remaining, expiresAt } })`. Партию `preferLotId` переставить в начало.
  3. Тратить по очереди: `updateMany({ where: { id, remaining: { gte: take } }, data: { remaining: { decrement: take } } })`. Если `count !== 1` или партий не хватило — `throw new Error('bonus ledger drift')`: это 500 с откатом, такого быть не должно.
  4. `create({ amount: -amount, … , sourceMaxExpiresAt })`. `sourceMaxExpiresAt` — максимум `expiresAt` потраченных партий; `null`, если среди них была бессрочная. Возвращает id.

- **`expireDueLots`.**
  - Партии `remaining > 0 AND expiresAt <= now`.
  - По каждой: `create({ type:'expiration', amount: -remaining, idempotencyKey: \`expire:${lot.id}\` })`, затем `updateMany({ where:{ id, remaining: lot.remaining }, data:{ remaining: 0 } })`.
  - После цикла — одно условное уменьшение баланса на сумму.

Сценарии:

- **`join`.**
  1. Программа выключена → `409 BONUS_PROGRAM_DISABLED`; `!isEligible` → `409 BONUS_NOT_ELIGIBLE`.
  2. Транзакция: `bonusAccount.upsert({ where:{ userId }, create:{ userId }, update:{ leftAt: null } })` — native upsert с ON CONFLICT, безопасен для параллельных вызовов.
  3. Блокировка счёта.
  4. Если нет активного `ConsentRecord{ purpose:'loyalty', textVersion: CONSENT_TEXT_VERSION.loyalty, revokedAt:null }` — создать.
  5. Если `welcomeBonus > 0` и нет строки с `idempotencyKey = welcome:${userId}` — `credit(type:'welcome', expiresAt: now + welcomeTtlDays)`.

- **`leave`.** Блокировка; `leftAt = now`; `consentRecord.updateMany({ userId, purpose:'loyalty', revokedAt:null } → revokedAt: now)`. Остаток замораживается: судьбу решат правила (клиент, п. 10 ранней проверки).

- **`planOrderBonus`.**
  - Программа выключена: `requestedPoints > 0` → `BONUS_PROGRAM_DISABLED`, иначе `{null,0,0,0}`.
  - `requestedPoints > 0 && !viewer` → `409 BONUS_AUTH_REQUIRED`.
  - Не участник (`!isEligible(viewer)` при наличии viewer): `requestedPoints > 0` → `BONUS_NOT_ELIGIBLE`; начисления нет.
  - Счёт: при `requestedPoints > 0` — `lockAccountByUser` и `expireDueLots`; иначе `findUnique` без блокировки. Нет счёта или `leftAt` → при списании `409 BONUS_NOT_MEMBER`, при начислении 0.
  - Лимит: `calcMaxBonusSpend({ goodsAfterDiscount: subtotal − promoDiscount, hasPromo, available: account.balance, rules })`. Если `requestedPoints > 0`:
    - `block === 'PROMO_CONFLICT'` → `409 BONUS_PROMO_CONFLICT`;
    - `'MIN_ORDER'` → `409 BONUS_MIN_ORDER { minOrderForSpend }`;
    - `requestedPoints > maxSpend` → `409 BONUS_LIMIT_EXCEEDED { maxSpend }`. Молча не обрезать: `expectedTotal` всё равно разойдётся.
  - `spendDiscount = bonusValue(requestedPoints, kopecksPerBonus)`; `accrualPlanned = calcBonusAccrual(…, bonusDiscount: spendDiscount)`.

- **`spendForOrder`.** `debit(type:'order_spend', orderId)`; счёт уже заблокирован в этой транзакции.

- **`onOrderStatusChanged`.**
  - **`to==='delivered'` и `accrualTrigger==='delivered'`** → `scheduleAccrual(tx, orderId, now + accrualDelayDays дней)`. Это `order.updateMany({ where:{ id, bonusAccrualDueAt:null, bonusAccrualPlanned:{gt:0} }, data:{ bonusAccrualDueAt } })`. Если задержка 0 — сразу `accrueForOrder(tx, orderId, now)`.
  - **`to==='cancelled'`:**
    1. **Возврат списания.** Найти `order_spend`; если есть и нет `order_spend_refund` (проверка после `lockAccountById`) — `credit(type:'order_spend_refund', amount: |spend.amount|, expiresAt: spend.sourceMaxExpiresAt === null ? null : max(spend.sourceMaxExpiresAt, now + refundMinTtlDays))`.
    2. **Отмена начисления.** Найти `order_accrual`; если есть и нет `order_accrual_reversal` — `expireDueLots`, затем `amt = min(accrual.amount, текущий balance)`. При `amt > 0` — `debit(type:'order_accrual_reversal', preferLotId: accrual.id, reason: amt < accrual.amount ? \`не списано ${accrual.amount − amt}: бонусы уже потрачены\` : null)`.
- **`onOrderPaid`.** При `accrualTrigger==='paid'` — то же `scheduleAccrual`.
- **`accrueForOrder`.**
  - Заказ `cancelled`, `bonusAccruedAt` заполнен или `bonusAccrualPlanned===0` → `'skipped'`.
  - `lockAccountByUser`; нет счёта или `leftAt` → `'skipped'` (останется ожидающим).
  - Уже есть `order_accrual` → проставить `bonusAccruedAt`.
  - Иначе `credit(type:'order_accrual', expiresAt: bonusTtlDays ? now + ttl : null)` и `order.updateMany({ where:{ id, bonusAccruedAt:null }, data:{ bonusAccruedAt: now } })`.
- **`adjust`.**
  - Пользователь без счёта → `404 BONUS_ACCOUNT_NOT_FOUND`.
  - Транзакция: блокировка; ключ `manual:${uuid}` уже есть → вернуть его с `replay: true`.
  - `amount > 0` → `credit(expiresAt: expiresInDays ? now + d : (bonusTtlDays ? now + bonusTtlDays : null))`.
  - `amount < 0` → `expireDueLots` + `debit` (`BONUS_INSUFFICIENT` при нехватке).
  - Корректировка работает и при выключенной программе. Лог: `request.log.info({ accountId, amount, actorId }, 'bonus manual adjustment')` — без ПДн.

### 4.3 `server/src/services/order-lifecycle.service.ts` — новый, общий со СДЭК

```ts
export async function changeOrderStatus(tx: Tx, input: { orderId: string; from: OrderStatus; to: OrderStatus; now: Date }): Promise<void>
// res = tx.order.updateMany({ where: { id, status: from }, data: { status: to, ...(to === 'delivered' ? { deliveredAt: now } : {}) } })
// res.count === 0 → ApiError(409, 'ORDER_STATUS_CONFLICT', 'Статус заказа уже изменён, обновите страницу')
// await bonusService.onOrderStatusChanged(tx, input)

export async function markOrderPaid(tx: Tx, input: { orderId: string; now: Date }): Promise<boolean>
// res = tx.order.updateMany({ where: { id, paymentStatus: { not: 'paid' } }, data: { paymentStatus: 'paid', paidAt: now } })
// if (res.count === 1) await bonusService.onOrderPaid(tx, input); return res.count === 1
```

Правило проекта, которое надо записать в `security-profile.md`: **`status`, `paymentStatus` и `deliveredAt` заказа меняются только через эти две функции.** Политика переходов (`ALLOWED_TRANSITIONS`, особые права super_admin) остаётся у вызывающего кода.

### 4.4 `server/src/services/admin-order.service.ts` — правка `updateOrder`

- Проверка переходов остаётся как есть, до транзакции.
- Дальше:

```ts
const updated = await db.$transaction(async (tx) => {
  const now = new Date()
  if (payload.status && payload.status !== order.status) await changeOrderStatus(tx, { orderId: id, from: order.status, to: payload.status, now })
  if (payload.markPaid) await markOrderPaid(tx, { orderId: id, now })
  const rest: Prisma.OrderUpdateInput = {}
  if (payload.deliveryTrackNumber !== undefined) rest.deliveryTrackNumber = payload.deliveryTrackNumber || null
  if (payload.adminNote !== undefined) rest.adminNote = payload.adminNote || null
  if (Object.keys(rest).length > 0) await tx.order.update({ where: { id }, data: rest })
  return tx.order.findUniqueOrThrow({ where: { id }, include: /* как сейчас */ })
})
```

- `formatAdminOrder` получает блок `bonus` (раздел 5.3).
- Возврат = переход `delivered → cancelled`; он и сейчас доступен только super_admin.

### 4.5 `server/src/services/order.service.ts` — правка `createOrder`

Дифф ~20 строк, точки вставки:

1. В тип `payload` добавить `bonusSpend?: number`.
2. До `$transaction`: `const settings = await loyaltySettingsService.get()`.
3. Внутри транзакции, **после шага 4 (промокод)**, вместо прямого вызова `calcOrderTotals`:

```ts
const now = new Date()
const pre = calcOrderTotals({ items: calcItems, priceList, promo, deliveryMethod })
const bonusPlan = await bonusService.planOrderBonus(tx, {
  userId: owner.customerId, viewer, requestedPoints: payload.bonusSpend ?? 0, hasPromo: promoData !== null,
  subtotal: pre.subtotal, promoDiscount: pre.promoDiscount,
  items: availableItems.map((i) => ({ price: resolvePrice(…), quantity: i.quantity, isProfessional: i.productVariant.product.isProfessional || i.productVariant.isProfessional })),
  settings, now,
})
const totals = calcOrderTotals({ …same, bonusDiscount: bonusPlan.spendDiscount })
```

4. В `TOTAL_MISMATCH.details` добавить `bonusDiscount: totals.bonusDiscount`.
5. В `order.create.data`: `bonusSpent: bonusPlan.spendPoints, bonusDiscount: totals.bonusDiscount, bonusAccrualPlanned: bonusPlan.accrualPlanned`.
6. После создания позиций и до очистки корзины: `if (bonusPlan.spendPoints > 0) await bonusService.spendForOrder(tx, { accountId: bonusPlan.accountId!, orderId: newOrder.id, points: bonusPlan.spendPoints, now })`. Если `accountId` равен null при `spendPoints > 0`, сначала выбросить `ApiError`, без `!`.
7. `formatOrderResponse` получает блок `bonus` (5.3).

Падение любого шага откатывает всю транзакцию, включая списание остатков.

### 4.6 Ночные задачи

**`server/src/lib/bonus-jobs.ts`:**

```ts
export async function runBonusAccruals(prisma: PrismaClient, now: Date, opts: { apply: boolean }): Promise<{ due: number; accrued: number; skipped: number; failed: number }>
// orders: { bonusAccrualDueAt: { lte: now }, bonusAccruedAt: null, bonusAccrualPlanned: { gt: 0 }, status: { not: 'cancelled' } }, take 500, select id
// каждый — своя транзакция prisma.$transaction(tx => bonusService.accrueForOrder(tx, id, now)); ошибку одного (вкл. P2002) ловить ВНЕ транзакции, считать failed, логировать id заказа, идти дальше
export async function runBonusExpirations(prisma, now, opts): Promise<{ accounts: number; expiredPoints: number }>
// distinct accountId из партий remaining>0 AND expiresAt<=now (take 500); каждый счёт: tx → lockAccountById → expireDueLots
export async function runBonusAnonymize(prisma, now, opts): Promise<{ anonymized: number }>
// bonusAccount.updateMany({ where: { userId: { not: null }, user: { deletedAt: { not: null } } }, data: { userId: null, anonymizedAt: now } })
export async function reconcileBonusBalances(prisma): Promise<{ mismatched: number }>
// $queryRaw: SELECT count(*)::int AS n FROM bonus_accounts a WHERE a.balance <> COALESCE((SELECT SUM(remaining) FROM bonus_transactions t WHERE t."accountId" = a.id AND t.amount > 0), 0)
```

**`server/prisma/bonus-jobs.ts`** — CLI по образцу `purge-pro-docs.ts`:
- клиент из `../../../../node_modules/.prisma/ps-client/index.js`;
- без `--apply` — сухой прогон;
- выполняет по порядку: сгорание → начисления → обезличивание → сверка;
- в лог пишутся только счётчики;
- `mismatched > 0` → `process.exit(1)`: workflow краснеет, GitHub шлёт письмо — это и есть оповещение.

**`server/package.json`**: `"bonus:jobs": "tsx prisma/bonus-jobs.ts"`.

**`.github/workflows/perfect-skin-bonus-jobs.yml`** — копия purge-workflow без шага `pg_dump`. Журнал только дописывается, его отменяют обратными записями; вдобавок purge снимает дамп в 02:30.
- `cron: '5 21 * * *'` — 00:05 МСК;
- `workflow_dispatch`;
- `concurrency: group: deploy-perfect-skin`, `cancel-in-progress: false`;
- скрипт: `cd /var/www/ps-src/projects/perfect-skin/server && set -a; . ./.env; set +a && npm run bonus:jobs -- --apply`.

Почему не таймер внутри процесса: PM2 перезапускает процесс, тогда таймер и состояние теряются; а при двух инстансах задача пойдёт дважды. Расписание в Actions уже есть в проекте.

---

## 5. API-контракт (`/api/v1/…`)

### 5.1 Покупатель — `server/src/routes/bonus/index.ts`

Файл — `fastifyPlugin`, регистрируется в `index.ts` после `ordersRoutes`. Везде `Cache-Control: no-store`, схемы ответа через `$ref`, zod `safeParse`.

| Метод | Путь | Что делает | Авторизация | Лимит |
|---|---|---|---|---|
| GET | `/api/v1/bonus` | Сводка: программа включена, участник, баланс, ближайшее сгорание, правила | `authenticate` | глобальный |
| GET | `/api/v1/bonus/transactions?limit&offset` | История своего счёта (limit 1..50, по умолчанию 20) | `authenticate` | глобальный |
| POST | `/api/v1/bonus/membership` | Вступить: `{ "acceptRules": true }` (`z.literal(true)`), пишет согласие `loyalty` | `authenticate` | 10/час на user.id |
| DELETE | `/api/v1/bonus/membership` | Выйти из клуба (отзыв `loyalty`, остаток заморожен) | `authenticate` | 10/час |
| GET | `/api/v1/bonus/checkout?promo&spend` | Лимит списания и прогноз начисления по текущей корзине | `authenticateOptional` | 60/мин |

`GET /api/v1/bonus`, схема `ps.bonusSummary` (POST и DELETE membership отдают её же):

```json
{ "programEnabled": true, "eligible": true, "member": true, "joinedAt": "…|null",
  "balance": 312, "balanceValue": 31200,
  "nextExpiration": { "amount": 120, "expiresAt": "…" },
  "rules": { "accrualPercent": 5, "accrualTrigger": "delivered", "accrualDelayDays": 0, "maxSpendPercent": 30,
             "minOrderForSpend": 0, "allowSpendWithPromo": false, "kopecksPerBonus": 100, "bonusTtlDays": 365 },
  "rulesVersion": "2026-10-30-draft" }
```

- `balance` — доступное: сумма `remaining` живых партий, просроченные уже исключены.
- `nextExpiration` — самая ранняя живая партия с `expiresAt`, иначе `null`.

`GET /api/v1/bonus/transactions` (`ps.bonusTxList`):
- элементы: `{ id, type, amount, remaining|null, expiresAt|null, createdAt, orderNumber|null }`;
- **поля `reason` и `createdBy` наружу не отдаются**: в них внутренняя заметка сотрудника.

`GET /api/v1/bonus/checkout` (`ps.bonusCheckout`):

```json
{ "canSpend": true, "reason": null, "available": 312, "maxSpend": 140, "kopecksPerBonus": 100,
  "goodsAfterDiscount": 467500, "minOrderForSpend": 0, "accrualPreview": 23 }
```

- `reason`: `PROGRAM_DISABLED | AUTH_REQUIRED | NOT_ELIGIBLE | NOT_MEMBER | PROMO_CONFLICT | MIN_ORDER | EMPTY_BALANCE | null`;
- `spend` — целое 0..1 000 000; для прогноза обрезается до `maxSpend`;
- пустая корзина → `409 CART_EMPTY`.

### 5.2 Админка — `server/src/routes/admin/bonus.ts`

Сигнатура: `export async function bonusRoutes(app, viewPreHandlers, ownerPreHandlers)`. Регистрация в `routes/admin/index.ts` с `prefix: '/api/v1/admin'`:
- `view = [authenticate, checkRole(['super_admin','orders_manager'])]`;
- `owner = [authenticate, checkRole(['super_admin'])]`.

| Метод | Путь | Что делает | Роли |
|---|---|---|---|
| GET | `/api/v1/admin/bonus/settings` | Настройки + последние 20 изменений | super_admin, orders_manager |
| PUT | `/api/v1/admin/bonus/settings` | Все поля + `expectedUpdatedAt`; 409 `SETTINGS_CONFLICT` | super_admin |
| GET | `/api/v1/admin/bonus/accounts?search&limit&offset` | Участники по email/телефону (`contains`, ≥ 3 символа), limit ≤ 100 | super_admin, orders_manager |
| GET | `/api/v1/admin/bonus/accounts/:userId?limit&offset` | Счёт + история (с `reason` и автором) | super_admin, orders_manager |
| POST | `/api/v1/admin/bonus/accounts/:userId/adjustments` | Ручная корректировка | super_admin, orders_manager; лимит 30/мин |

Тело PUT настроек (zod, все поля обязательны; `.strict()`):

| Поле | Правило |
|---|---|
| `enabled` | bool |
| `accrualPercent` | int 0..100 |
| `accrualBase` | enum |
| `accrualTrigger` | enum |
| `accrualDelayDays` | int 0..60 |
| `excludeProfessionalProducts`, `accrueWithPromo` | bool |
| `kopecksPerBonus` | int 1..10000 |
| `maxSpendPercent` | int 0..100 |
| `minOrderForSpend` | int 0..10 000 000 (копейки) |
| `allowSpendWithPromo` | bool |
| `bonusTtlDays` | int 0..1825 |
| `refundMinTtlDays` | int 1..365 |
| `welcomeBonus` | int 0..5000 |
| `welcomeTtlDays` | int 1..365 |
| `reviewBonus` | int 0..2000 |
| `reviewTtlDays` | int 1..365 |
| `expiryNoticeKind` | enum |
| `expiryNoticeDaysBefore` | int 1..30 |
| `expectedUpdatedAt` | ISO datetime |

Тело корректировки: `{ amount: int ≠ 0, |amount| ≤ 100000; reason: string trim 3..300; expiresInDays?: int 1..1825 (только при amount > 0); idempotencyKey: uuid }`.
- Ответ: `201 { transaction, balance }`; повтор с тем же ключом → `200`, та же запись.
- Ошибки: `404 BONUS_ACCOUNT_NOT_FOUND`, `409 BONUS_INSUFFICIENT`, `400 VALIDATION_ERROR`.

Аудит: строка журнала с `createdById`, `reason`, `createdAt` неизменяема (CHECK `bonus_tx_manual_audit`). Отдельная таблица не нужна.

### 5.3 Изменения существующих эндпоинтов

- **`POST /api/v1/orders`.** В zod и JSON-схему тела добавить `bonusSpend: z.number().int().min(0).max(1_000_000).optional()`. Ответ `ps.order` получает блок:

  `"bonus": { "spent": 140, "discount": 14000, "accrualPlanned": 23, "accrualStatus": "none|pending|accrued|cancelled" } | null`

  Блок `null`, если оба нуля. `accrualStatus`: `planned=0` → none; `status=cancelled` → cancelled; `bonusAccruedAt` → accrued; иначе pending.

  Новые ошибки — `409 BONUS_PROGRAM_DISABLED | BONUS_AUTH_REQUIRED | BONUS_NOT_ELIGIBLE | BONUS_NOT_MEMBER | BONUS_PROMO_CONFLICT | BONUS_MIN_ORDER {minOrderForSpend} | BONUS_LIMIT_EXCEEDED {maxSpend} | BONUS_INSUFFICIENT {available}`. В `TOTAL_MISMATCH.details` добавляется `bonusDiscount`.
- **`GET /api/v1/orders/:number`** — тот же блок `bonus`.
- **`ps.adminOrder`** — тот же блок плюс `bonusAccrualDueAt`, `deliveredAt`.
- **`PATCH /api/v1/admin/orders/:id`** — новая ошибка `409 ORDER_STATUS_CONFLICT`.

Новые схемы в `server/src/schemas/common.ts`, все с `additionalProperties: false` на каждом уровне: `ps.bonusSummary`, `ps.bonusTx`, `ps.bonusTxList`, `ps.bonusCheckout`, `ps.orderBonus`, `ps.adminBonusSettings`, `ps.adminBonusTx`, `ps.adminBonusAccount`, `ps.adminBonusAccountList`.

---

## 6. Клиент (`projects/perfect-skin/client/src/`)

Перед вёрсткой — `docs/core/design-principles.md`, `brand.md`, `design-system/MASTER.md`. Классы и токены — как у соседних блоков: `bg-card border-border rounded-block p-6`, `rounded-pill`, `min-h-11`. Суммы — через `formatPrice`, бонусы — через `pluralize(n, ['бонус','бонуса','бонусов'])`. Вложенных карточек не делать.

| Файл | Что |
|---|---|
| `lib/bonus-api.ts` (новый) | `fetchBonusSummary()`, `fetchBonusTransactions(limit, offset)`, `joinBonusClub()`, `leaveBonusClub()`, `fetchBonusCheckout(promo?, spend?)`; типы ответов |
| `components/account/BonusSection.tsx` (новый) | Блок на `OrdersPage` под `MarketingConsentSection`. `programEnabled=false && !member` → не рендерится. Не участник → «Бьюти-клуб» + чекбокс «Принимаю Правила Бьюти-клуба» (ссылка `/club/rules`, `<label>`) + кнопка «Вступить». Участник → баланс, ближайшее сгорание, ссылка «Мои бонусы» |
| `components/pages/BonusPage.tsx` (новый) | Маршрут `/bonus` в `App.tsx`; неавторизованного — на `/auth?next=/bonus`. Баланс, «N сгорят ДД.ММ.ГГГГ», правила из `rules`, история с пагинацией «Показать ещё» (подпись типа, сумма ±, дата, номер заказа ссылкой `/orders/:number`, у партий «сгорит …»), кнопка «Выйти из клуба» с подтверждением |
| `lib/bonus-labels.ts` (новый) | Подписи типов: welcome «Приветственные», order_accrual «За заказ», order_spend «Оплата заказа», order_spend_refund «Возврат за отменённый заказ», order_accrual_reversal «Отмена начисления», expiration «Сгорели», manual_adjustment «Корректировка» |
| `components/checkout/BonusSpendSection.tsx` (новый) | Пропсы: `{ promoCode: string \| null; value: number; onChange(n: number): void; onQuote(q: BonusCheckoutQuote \| null): void }`. Грузит `fetchBonusCheckout(promo, value)` (повтор с задержкой 300 мс после изменения). Не рендерится при `PROGRAM_DISABLED / NOT_ELIGIBLE / AUTH_REQUIRED` и при `NOT_MEMBER`, если баланс 0. Поле с `<label>` «Списать бонусы», `inputMode="numeric"`, кнопка «Все» (= `maxSpend`), подсказка «Доступно N, можно списать до M». `PROMO_CONFLICT` → «Бонусы не суммируются с промокодом» и `onChange(0)`. Строка «За заказ начислим ≈ N бонусов после получения» |
| `components/pages/CheckoutPage.tsx` (правка) | `const [bonusSpend, setBonusSpend] = useState(0)` и `bonusQuote`; `<BonusSpendSection>` между «Промокод» и «Комментарий»; `bonusDiscount = bonusSpend * (bonusQuote?.kopecksPerBonus ?? 0)`; `total = goodsAfterDiscount - bonusDiscount + deliveryCost`; в сводке строка «Бонусами −X ₽»; `if (bonusSpend > 0) body.bonusSpend = bonusSpend`; новые коды ошибок → понятные тексты и перезапрос котировки |
| `components/orders/OrderView.tsx` (правка) | Тип `OrderDetail.bonus`; строки «Оплачено бонусами: N (−X ₽)» и «Начислим N бонусов после получения» / «Начислено N» / «Начисление отменено» |
| `components/admin/pages/AdminBonusSettingsPage.tsx` (новый) | Маршрут `bonus/settings`. Форма всех полей: проценты целыми, `minOrderForSpend` вводится в рублях и переводится в копейки, сроки в днях. Переключатель «Программа включена» с предупреждением «включать после утверждения правил клиентом и юристом». При смене курса при включённой программе — предупреждение «меняет стоимость всех накопленных бонусов». Шлёт `expectedUpdatedAt`; на 409 — «обновите страницу». Ниже — история изменений (кто, когда, какие поля). orders_manager видит форму только для чтения |
| `components/admin/pages/AdminBonusAccountsPage.tsx` (новый) | Маршрут `bonus`: поиск по email/телефону, таблица участников, ссылка на счёт; вкладка или ссылка на настройки |
| `components/admin/pages/AdminBonusAccountPage.tsx` (новый) | Маршрут `bonus/:userId`: баланс, ближайшее сгорание, история с причиной и автором; форма корректировки (± сумма, причина 3..300 с подсказкой «без персональных данных», срок для начисления, подтверждение). `idempotencyKey = crypto.randomUUID()` при открытии формы и после успеха |
| `components/admin/AdminApp.tsx`, `AdminLayout.tsx` | Три маршрута; пункт меню «Бонусы» → `/admin/bonus` |
| `components/admin/pages/AdminOrderPage.tsx` | Блок «Бонусы»: списано, к начислению, статус и дата начисления |
| `lib/admin-api.ts` | `adminGetBonusSettings`, `adminUpdateBonusSettings`, `adminListBonusAccounts`, `adminGetBonusAccount`, `adminAdjustBonus`; поле `bonus` в `AdminOrderDetail` |

Демо-режим (`VITE_API_MODE=snapshot`): `BonusSection` и `BonusSpendSection` ничего не рендерят.

---

## 7. Тесты

### 7.1 `shared/src/bonus.test.ts`

- **`calcMaxBonusSpend`:** лимит по проценту; лимит по балансу; порядок блокировок (промокод → минимальная сумма → пустой баланс); округление вниз при `kopecksPerBonus=100` и `=50`; `maxSpendPercent=0` → `maxSpend 0, block null`.
- **`calcBonusAccrual`:** три базы; промокод при `accrueWithPromo=false` → 0; исключение кабинетных позиций; округление вниз; `subtotal=0` → 0.

### 7.2 `shared/src/order-totals.test.ts` (дополнить)

- `bonusDiscount` уменьшает `total`, но не стоимость доставки: заказ 6 000 ₽ в ПВЗ с бонусами 1 000 ₽ — доставка 0;
- обрезка `bonusDiscount` до `goodsAfterDiscount`;
- отрицательное и NaN значения → 0.

### 7.3 `server/src/test/bonus-ledger.integration.test.ts`

Сервисный уровень, `now` передаётся явно.
1. Вступление: счёт создан, `ConsentRecord{purpose:'loyalty', textVersion: CONSENT_TEXT_VERSION.loyalty}`, приветственные начислены один раз; повторное вступление второй раз не начисляет.
2. 5 параллельных `join` → один счёт, одно согласие, одно приветственное.
3. **Гонка:** баланс 100, `Promise.all` из двух транзакций `spend 100` → ровно одна успешна, вторая `BONUS_INSUFFICIENT`; баланс 0; `sum(amount)` по журналу равна balance.
4. **Гонка:** баланс 100, 10 параллельных `spend 30` → ровно 3 успеха, баланс 10.
5. FIFO: две партии с разными сроками — тратится сначала ранняя.
6. Ленивое сгорание: просроченная партия не тратится до запуска задачи, `spend` выше живого остатка → `BONUS_INSUFFICIENT`.
7. CHECK: `UPDATE bonus_accounts SET balance = -1` через `$executeRaw` → ошибка; `manual_adjustment` без причины → ошибка.

### 7.4 `server/src/test/bonus-checkout.integration.test.ts`

HTTP, сборка как в `checkout.integration.test.ts`.
1. Заказ с бонусами: верный `total`, `bonus.spent/discount`, журнал `order_spend`.
2. `expectedTotal` без учёта бонусов → `TOTAL_MISMATCH` с `details.bonusDiscount`.
3. Ошибки по каждому коду:
   - гость с `bonusSpend` → `BONUS_AUTH_REQUIRED`;
   - одобренный специалист → `BONUS_NOT_ELIGIBLE`;
   - промокод при `allowSpendWithPromo=false` → `BONUS_PROMO_CONFLICT`;
   - выше лимита → `BONUS_LIMIT_EXCEEDED`;
   - программа выключена → `BONUS_PROGRAM_DISABLED`;
   - не участник → `BONUS_NOT_MEMBER`.
4. **Гонка по HTTP:** два параллельных `POST /orders` одного пользователя, каждый на весь баланс; остаток фасовки 50 → один 201, второй 409 `BONUS_INSUFFICIENT`. Остаток фасовки уменьшен ровно на один заказ: проваленный заказ откатил списание товара.
5. `bonusAccrualPlanned` посчитан по базе `paid_goods`.
6. `GET /bonus/checkout` для гостя → `reason: 'AUTH_REQUIRED'`.

### 7.5 `server/src/test/bonus-lifecycle.integration.test.ts`

1. Отмена заказа с бонусами (PATCH админки) → один `order_spend_refund`, баланс восстановлен; срок возвращённой партии ≥ `now + refundMinTtlDays`.
2. Два параллельных PATCH «отменить» → один 200, один `409 ORDER_STATUS_CONFLICT`, ровно один возврат.
3. «Доставлен» при задержке 0 → начислено сразу; при задержке 14 → `bonusAccrualDueAt` проставлен. `runBonusAccruals` на `now+13д` ничего не делает, на `now+15д` начисляет; второй прогон — без дублей.
4. Super_admin `delivered → cancelled` после начисления → `order_accrual_reversal`. Если начисленное уже потрачено — списано не больше баланса, недостача записана в `reason`, баланс не ниже нуля.
5. `accrualTrigger='paid'` + `markPaid` → начисление по расписанию.
6. Вышедший из клуба: начисление пропущено, после повторного вступления начисляется.

### 7.6 `server/src/test/bonus-jobs.integration.test.ts`

1. Сгорание: партия с прошедшим сроком → строка `expiration`, баланс уменьшен, `remaining=0`; повторный прогон идемпотентен.
2. Сухой прогон без `--apply` ничего не пишет.
3. Обезличивание: у пользователя `deletedAt` → `bonus_accounts.userId = null`, `anonymizedAt` заполнен, журнал на месте.
4. Сверка: согласованные данные → 0; испорченный баланс через `$executeRaw` → 1.
5. `ConsentRecord`: после жёсткого удаления пользователя строка остаётся с `userId = null`.

### 7.7 `server/src/test/bonus-admin.integration.test.ts`

1. Значения по умолчанию после миграции: `enabled=false`.
2. PUT с устаревшим `expectedUpdatedAt` → 409; изменение записано в журнал (before/after, автор).
3. Права:
   - customer → 403 на всё;
   - content_manager → 403;
   - orders_manager → GET 200, PUT 403, корректировка 201.
4. Корректировка ±: причина и автор в журнале; минус больше баланса → `BONUS_INSUFFICIENT`; тот же `idempotencyKey` дважды → одна строка, второй ответ 200.
5. `GET /api/v1/bonus/transactions` покупателя не содержит `reason` и `createdBy`.

### 7.8 Общие правила тестов

- Тестовый домен почты — `@ps-bonus-test.local`.
- Уборка в `beforeAll` и `afterAll`, по порядку: `bonusTransaction` → `bonusAccount` → `loyaltySettingsChange` (по автору) → `orderItem` → `promoCodeRedemption` → `order` → `cart` → `consentRecord` → `otpCode` → `user`.
- В `afterAll` вернуть настройки к значениям по умолчанию (`enabled=false`): строка общая, файлы тестов идут последовательно (`fileParallelism: false`).
- `routes-boot.unit.test.ts` покроет регистрацию админских роутов автоматически.

---

## 8. Порядок шагов (каждый шаг — отдельный коммит)

| # | Что | Коммит | Проверка после шага |
|---|---|---|---|
| 1 | `shared`: `bonus.ts`, `bonusDiscount` в `calcOrderTotals`, тесты 7.1–7.2 | `feat(ps-shared): bonus spend and accrual math` | `npm run test --workspace=@ps/shared`, build |
| 2 | `schema.prisma` (раздел 1), две миграции, `01-constraints.sql`, `consents.ts` | `feat(ps-db): bonus ledger schema, loyalty consent, consent SetNull` | `prisma migrate deploy` на тестовой БД, `tsc`; **`database-reviewer` + `migration-guard`** |
| 3 | `loyalty-settings.service.ts`, `bonus.service.ts`, тесты 7.3 | `feat(ps-server): bonus ledger service with row locks and FIFO lots` | тесты, tsc |
| 4 | `order-lifecycle.service.ts`, правка `admin-order.service.ts`, тесты 7.5 (п. 1–2, 4–6) | `feat(ps-server): single order status entry point with bonus side effects` | тесты |
| 5 | `lib/bonus-jobs.ts`, `prisma/bonus-jobs.ts`, скрипт npm, workflow, раздел «Бонусы — ночные задачи» в `deploy/DEPLOY.md`, тесты 7.6 и 7.5 п. 3 | `feat(ps-server): nightly bonus accrual, expiry, anonymize, reconcile` | тесты; **`devops`** по workflow |
| 6 | `order.service.ts`, `routes/orders` (`bonusSpend`), `ps.order`/`ps.adminOrder`, `GET /bonus/checkout`, тесты 7.4 | `feat(ps-server): spend bonuses at checkout in order transaction` | все тесты сервера; **`security-business-logic`** |
| 7 | `routes/bonus/index.ts` (сводка, история, вступление и выход), схемы | `feat(ps-server): customer bonus endpoints` | тесты |
| 8 | `routes/admin/bonus.ts`, регистрация, тесты 7.7 | `feat(ps-server): admin bonus settings, accounts, adjustments` | тесты; **`security-auth-access`** |
| 9 | Клиент: `bonus-api`, `bonus-labels`, `BonusSection`, `BonusPage`, маршрут, `OrderView` | `feat(ps-client): account bonuses page` | `npm run build --workspace=@ps/client` |
| 10 | Клиент: `BonusSpendSection` + правки `CheckoutPage` | `feat(ps-client): bonus spend in checkout` | build |
| 11 | Клиент-админка: три страницы, меню, блок в `AdminOrderPage`, `admin-api` | `feat(ps-client): admin bonus pages` | build; **`design-reviewer` по снимкам** (временно включить программу на стенде) |
| 12 | Документация: `api-contract.md` (раздел «Бьюти-клуб» и коды ошибок), `security-profile.md` (новые поверхности гонок, правило про `changeOrderStatus`, ночные задачи), `project.md` («Правовой контур»: новая цель `loyalty`) | `docs(ps): bonus program contract and security notes` | **`documenter`** |

Выкатывать можно после каждого шага: программа выключена, и UI витрины не виден, пока `enabled=false`.

---

## 9. Пересечения с интеграцией СДЭК и как не столкнуться

| Общий файл | Что меняют бонусы | Что, вероятно, меняет СДЭК | Правило |
|---|---|---|---|
| `shared/src/order-totals.ts` | необязательный `bonusDiscount` во входе и выходе | стоимость доставки из котировки СДЭК вместо формулы | Бонусы заходят первыми (шаг 1, маленький). СДЭК добавляет своё поле рядом, например `deliveryCostOverride`, и не трогает строку `total` |
| `schema.prisma`, модель `Order` | блок `// ── Бонусы ──` в конце скалярных полей, включая **`deliveredAt`** | `cdekOrderUuid`, тариф, статус СДЭК и т. п. | СДЭК пишет свой блок `// ── СДЭК ──` сразу после `deliveryTrackNumber` и **не добавляет `deliveredAt`**: он уже есть. Миграции СДЭК — с отметкой `20261031…` и позже |
| `order.service.ts → createOrder` | ~20 строк в точках из 4.5 | расчёт доставки через API СДЭК **до** транзакции, новые поля ПВЗ | Внешний HTTP-вызов СДЭК — только до `$transaction`: держать блокировку счёта и остатков на сетевом запросе нельзя. Перед шагом 6 — `git fetch` и сверка этого файла |
| Смена статуса заказа | `changeOrderStatus` / `markOrderPaid` (шаг 4) | вебхук СДЭК: «в пути», «вручён», «возврат» | **Вебхук СДЭК меняет статус только через `changeOrderStatus(tx, …)`**, никогда `db.order.update({status})`. Иначе возврат и начисление бонусов молча не сработают. Внести в `security-profile.md` |
| `schemas/common.ts` (`ps.order`, `ps.adminOrder`) | поле `bonus` | поля доставки | соседние строки, конфликт решается при rebase |
| `CheckoutPage.tsx` | отдельный компонент + 6 точечных правок | замена блока ПВЗ виджетом и котировкой | бонусы — отдельной секцией между «Промокод» и «Комментарий», в блок доставки не заходят. Шаг 10 — после `git fetch` |
| Объявленная стоимость / наложенный платёж в СДЭК | — | сумма к оплате при получении | брать `order.total` (уже за вычетом бонусов), а не `subtotal` |
| `deliveredAt` / дата вручения | ставит `changeOrderStatus` | дата вручения из вебхука | если СДЭК хочет точную дату вручения, передаёт её как `now` в `changeOrderStatus` |

---

## 10. Развилки (решение за Гермесом или клиентом)

1. **Как вступать в клуб** (вопрос 23 клиенту не отвечен).
   - (а) Явно — кнопкой и чекбоксом в кабинете. Принято в спеке: самый чистый вариант с точки зрения права.
   - (б) Плюс чекбокс «Вступить и получить N бонусов за этот заказ» в чекауте — ещё один коммит, больше вступлений.
   - (в) Галочка при входе — смешивается с согласием на ПДн, юрист вряд ли одобрит.
2. **Порог бесплатной доставки — до бонусов** (принято). Иначе покупатель, списав бонусы, вдруг платит 200 ₽ за доставку.
3. **Частичного возврата товаров в системе нет:** возврат — это отмена заказа целиком (`delivered → cancelled`, только super_admin). Нужен возврат по позициям — отдельная задача.
4. **Выход из клуба замораживает остаток.** Сгорает он, сохраняется или обнуляется — решают правила программы (клиент, п. 10 ранней проверки).
5. **Страница `/club/rules`:** текст правил — клиент или юрист (вопрос 24). Пока программа выключена, ссылка ни на что не влияет; без страницы программу включать нельзя.
6. **Возражение (уверен):** приветственные бонусы фармятся новыми email-адресами, вход по OTP на почту дешёвый. В спеке `welcomeBonus=0` по умолчанию. Если клиент захочет 300–500 — включать вместе с `minOrderForSpend` и `maxSpendPercent`; это сдерживает, но не защищает.

---

## 11. Попутные находки в существующем коде (не в объёме задачи)

- **`CheckoutPage.tsx:181-187` — уверен, что это баг: курьерский заказ не оформится.** Клиент шлёт `address.index` и `apartment: null`. Сервер (`routes/orders/index.ts:14-23`) требует `postalCode` по `^\d{6}$`, а `apartment` — строку или отсутствие поля. Итог — `400 VALIDATION_ERROR` на любой заказ курьером. Чинится переименованием в `postalCode` и `apartment: address.apartment || undefined`. Удобно поправить в задаче СДЭК: она переделывает этот блок.
- **`order.service.ts:211-237`:** счётчик промокода увеличивается через `findUnique` и следующий за ним безусловный `update`. При одновременном исчерпании лимита сработает `CHECK promo_used_within_max`, и клиент получит 500 вместо `409 PROMO_EXHAUSTED`. Лечится условным `updateMany`, который уже написан в `promo.service.ts:68` (`incrementUsage`).
- **`admin-order.service.ts`:** отмена заказа не возвращает остатки на склад. Отдельная задача.
- **`schemas/common.ts:669`:** в `ps.order.status` перечислены `processing` и `shipped`, а в базе `packed` и `in_transit`. Ответ это не ломает (сериализатор enum не проверяет), но контракт разошёлся с базой.
- **Для оплаты (ЮKassa, 54-ФЗ):** скидки (промокод + бонусы) нужно распределить по позициям чека, чтобы сумма позиций сошлась с `total`. И `total` может стать 0, если `maxSpendPercent=100` и самовывоз: такой заказ надо пропускать мимо оплаты.

---

## 12. Правовой контур: обязательный выход

Ранняя проверка уже прошла (`docs/projects/perfect-skin/legal/early-check-cdek-loyalty-2026-10-30.md`), её пункты учтены:
- **п. 1 — тип писем:** `MessageKind`, `expiryNoticeKind=advertising` по умолчанию, писем пока нет.
  Правило на будущее: рекламное письмо уходит, только если активное `marketing` проверено в момент отправки (`activeRetailMarketingWhere`) и в письме есть отписка.
- **п. 7 — дата рождения:** не собираем, есть только задел в enum.
- **п. 8:** `ConsentPurpose.loyalty` с версией и датой.
- **п. 10:** счёт обезличивается — SetNull и ночная отвязка при `deletedAt`, без каскада.
- **п. 12:** `ConsentRecord` → SetNull.

Ограничение: в проекте пользователей удаляют мягко (`deletedAt`), поэтому SetNull сработает только при жёстком удалении. Мягкое закрывает ночное обезличивание.

Вопросы раздела A `docs/core/rkn-compliance.md` по этой фиче. Ответы — в раздел «Правовой контур» файла `docs/projects/perfect-skin/project.md`:
- **A1. Состав данных и цели.**
  - Новая цель — участие в программе лояльности: история покупок → начисления, баланс, история операций; хранится в `bonus_*`.
  - Срок хранения журнала после выхода из клуба и после удаления аккаунта — `[клиент]`, в правилах программы.
  - Причины ручных корректировок не должны содержать ПДн (подсказка в UI).
  - Цели «бонус ко дню рождения», «персональные предложения», «публикация отзывов» не включены.
- **A2. Размещение БД.** Новые таблицы в той же базе Timeweb (Россия), бэкапы там же. Задачи выполняются по SSH на том же сервере, данные из России не выходят.
- **A3. Способ авторизации.** Не меняется (OTP на email). Списание бонусов требует входа: гостю списание закрыто.
- **A4. Сторонние сервисы и трансграничная передача.** Новых получателей нет. GitHub Actions получает только счётчики в логах, без ПДн. Будущие письма о сгорании пойдут через почтовый сервис проекта: провайдер и его страна ещё не названы, и email ещё не перечислен в тексте согласия на рекламу (блокер 2, `[клиент]`).

Требую прогон `rkn-compliance` в раннем режиме: по этому спеку до шага 2 (схема) и по итогам — финальный, перед включением `enabled=true`.

---

## Файлы, на которые опирается спек

- /home/user/project_simba/projects/perfect-skin/server/prisma/schema.prisma
- /home/user/project_simba/projects/perfect-skin/server/prisma/sql/01-constraints.sql
- /home/user/project_simba/projects/perfect-skin/server/src/services/order.service.ts
- /home/user/project_simba/projects/perfect-skin/server/src/services/admin-order.service.ts
- /home/user/project_simba/projects/perfect-skin/server/src/services/promo.service.ts
- /home/user/project_simba/projects/perfect-skin/server/src/routes/orders/index.ts
- /home/user/project_simba/projects/perfect-skin/server/src/routes/admin/index.ts
- /home/user/project_simba/projects/perfect-skin/server/src/schemas/common.ts
- /home/user/project_simba/projects/perfect-skin/server/src/lib/consents.ts
- /home/user/project_simba/projects/perfect-skin/server/src/lib/account-consents.ts
- /home/user/project_simba/projects/perfect-skin/server/prisma/purge-pro-docs.ts (образец CLI задачи)
- /home/user/project_simba/.github/workflows/perfect-skin-purge-pro-docs.yml (образец расписания)
- /home/user/project_simba/.github/workflows/deploy-perfect-skin.yml (порядок «миграции → constraints → сборка»)
- /home/user/project_simba/projects/perfect-skin/shared/src/order-totals.ts
- /home/user/project_simba/projects/perfect-skin/client/src/components/pages/CheckoutPage.tsx
- /home/user/project_simba/projects/perfect-skin/client/src/components/pages/OrdersPage.tsx
- /home/user/project_simba/projects/perfect-skin/client/src/components/admin/AdminApp.tsx
- /home/user/project_simba/projects/perfect-skin/server/src/test/checkout.integration.test.ts (образец сборки тестов)
- /home/user/project_simba/docs/projects/perfect-skin/legal/early-check-cdek-loyalty-2026-10-30.md