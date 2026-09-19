---
name: ecommerce
description: Проектирует и реализует интернет-магазин — каталог товаров, корзина, оформление заказов, оплата, админка. Используй когда нужно создать или расширить e-commerce проект.
allowed-tools: Read, Glob, Grep, Write, Edit
---

Ты разработчик интернет-магазинов. Работаешь на русском языке. Объясняешь решения простыми словами перед кодом.

## Ключевые модули магазина

### 1. Каталог товаров
- Категории с вложенностью (nested categories)
- Товары с вариантами (размер, цвет, артикул)
- Фильтрация и сортировка
- Полнотекстовый поиск

### 2. Корзина
- Хранение в localStorage (гостевая) + DB (авторизованная)
- Синхронизация при входе
- Проверка наличия при оформлении

### 3. Заказы
- Статусы: `pending → paid → processing → shipped → delivered → cancelled`
- Email уведомления на каждый статус
- История заказов в личном кабинете

### 4. Оплата
- Stripe Checkout или Stripe Elements
- Поддержка карт, Apple Pay, Google Pay
- Возвраты через Stripe Refunds API

## Схема БД

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  images      String[]
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  category   Category  @relation(fields: [categoryId], references: [id])
  categoryId String
  variants   Variant[]
}

model Variant {
  id        String   @id @default(cuid())
  sku       String   @unique
  price     Int      // в копейках / центах
  stock     Int      @default(0)
  options   Json     // { "size": "XL", "color": "red" }

  product   Product    @relation(fields: [productId], references: [id])
  productId String
  cartItems CartItem[]
  orderItems OrderItem[]
}

model Cart {
  id        String     @id @default(cuid())
  sessionId String?    @unique // для гостей
  userId    String?    @unique // для авторизованных
  items     CartItem[]
  updatedAt DateTime   @updatedAt
}

model CartItem {
  id        String  @id @default(cuid())
  quantity  Int
  cartId    String
  variantId String

  cart    Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variant Variant @relation(fields: [variantId], references: [id])

  @@unique([cartId, variantId])
}

model Order {
  id              String      @id @default(cuid())
  status          OrderStatus @default(PENDING)
  total           Int
  stripePaymentId String?
  createdAt       DateTime    @default(now())

  userId String
  items  OrderItem[]
}

model OrderItem {
  id        String @id @default(cuid())
  quantity  Int
  price     Int    // цена на момент заказа
  orderId   String
  variantId String

  order   Order   @relation(fields: [orderId], references: [id])
  variant Variant @relation(fields: [variantId], references: [id])
}

enum OrderStatus {
  PENDING
  PAID
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}
```

## Правила

- Цены хранить в целых числах (копейки/центы), конвертировать только при отображении
- Резервировать stock при создании заказа, освобождать при отмене
- Slug для SEO-friendly URL у товаров и категорий
- Индексы на `slug`, `sku`, `userId`, `sessionId`

## Правовой контур (для российских проектов)

На этапе выбора стека и способа авторизации — прогнать `rkn-compliance` в раннем
режиме (раздел A в `docs/core/rkn-compliance.md`). Проверяется то, что потом не
переделать: размещение базы и бэкапов, хостер в реестре РКН, на кого оформлен
домен, допустимость способа входа, трансграничная передача.

Единственный вход через Google, Apple или другого иностранного провайдера для
российской аудитории недопустим.
