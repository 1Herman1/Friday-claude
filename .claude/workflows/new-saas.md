# Воркфлоу: Новый SaaS проект с нуля

## Шаги запуска

### 1. Определение продукта
- Что делает продукт (1-2 предложения)
- Целевая аудитория
- Монетизация (freemium / подписка / one-time)
- MVP фичи (список)

### 2. Стек и инфраструктура
```bash
# Создать Next.js проект
npx create-next-app@latest . --typescript --tailwind --app --src-dir

# Установить базовые зависимости
npm install prisma @prisma/client
npm install next-auth
npm install @stripe/stripe-js stripe
npm install zod react-hook-form
npm install zustand
npx shadcn@latest init
```

### 3. База данных (Prisma + PostgreSQL)
```bash
npx prisma init
# Описать схему в prisma/schema.prisma
npx prisma migrate dev --name init
```

### 4. Аутентификация
- Настроить NextAuth или Clerk
- Добавить провайдеры (Google, GitHub, email/password)
- Настроить сессии и middleware

### 5. Базовая структура страниц
```
/ — лендинг
/login — вход
/signup — регистрация
/dashboard — главная панель
/settings — настройки профиля
/billing — управление подпиской
```

### 6. Billing (Stripe)
- Создать продукты и цены в Stripe Dashboard
- Настроить webhooks
- Реализовать checkout и customer portal

### 7. Деплой
- Создать репозиторий на GitHub
- Подключить к Vercel
- Настроить переменные окружения
- Настроить домен

## Чеклист перед лончем
- [ ] Auth работает (вход / выход / защита роутов)
- [ ] Оплата проходит (тест-карта Stripe)
- [ ] Email уведомления отправляются
- [ ] Ошибки логируются (Sentry)
- [ ] SSL настроен
- [ ] Метрики настроены (Vercel Analytics)

## Правовой контур: до развёртывания, не после

Для проекта с российской аудиторией, который собирает персональные данные, —
прогнать `rkn-compliance` в **раннем** режиме на этапе выбора стека, до того как
развёрнута база и оформлен домен.

Проверяется необратимое: где физически стоит база и бэкапы, есть ли хостер в
реестре РКН, на кого оформлен домен, допустим ли способ входа, куда уходят
данные. Ответы записываются в раздел «Правовой контур» файла
`docs/projects/<проект>/project.md`.

Перед сдачей эти пункты уже не правка, а переезд.
