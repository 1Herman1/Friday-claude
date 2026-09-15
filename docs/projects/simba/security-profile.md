# Профиль безопасности: Симба

Карта стека для агентов `security-*`. Универсальные классы уязвимостей — в
`docs/core/anti-patterns/security.md`; здесь только то, как эти классы
выглядят в Симбе.

Собран из специфики, которая раньше была вшита в определения агентов.

---

## Стек

| Слой | Чем реализовано |
|---|---|
| Язык / рантайм | Node.js, TypeScript |
| Серверный фреймворк | Fastify |
| Клиент | React + Vite (`client/`), админка (`admin/`) |
| База и доступ к ней | PostgreSQL + Prisma |
| Хранилище файлов | MinIO (Docker) |
| Аутентификация | свой OTP (email/SMS) + JWT |
| Хостинг и выкатка | Timeweb VPS, PM2 + Nginx, выкатка через GitHub Actions |
| Фоновые задачи | нет отдельной очереди |
| Платежи | в разработке — при появлении обновить §11 и §10 |

Чего в проекте **нет** (чтобы агенты не искали): Next.js, Vercel, Supabase,
S3, NextAuth, `app/api/route.ts`, `getServerSession`.

## Где что лежит

| Что | Путь |
|---|---|
| Серверные роуты | `server/src/routes/**` |
| Middleware авторизации | `server/src/lib/auth.ts` |
| Модели / схема БД | `prisma/schema.prisma` |
| Клиентские страницы | `client/src/pages/**` |
| Админка | `admin/` |
| Конфигурация секретов | `.env` на сервере, `.env.example` в репозитории |
| Регистрация плагинов сервера | `server/src/index.ts` |
| Инфраструктура | `docker-compose.yml`, конфиг Nginx |

## Перевод классов в конкретику

| Класс | Что искать в Симбе |
|---|---|
| §3 Доступ без проверки владельца | Запрос к БД без фильтра по `userId` из токена. Правильно: `prisma.order.findFirst({ where: { id, userId: req.user.userId } })`. Особенно: заказы, адреса, бонусы, подписки |
| §3 Роут без авторизации | Отсутствие `preHandler: [authenticate]` (или `onRequest: [server.authenticate]`) на роуте с данными пользователя |
| §3 Роль из запроса | `req.body.role` вместо `req.user.role` |
| §3 Массовое присвоение | Передача всего тела запроса в `prisma.*.update({ data })` без явного перечисления полей |
| §4 SQL-инъекция | `$queryRawUnsafe`, `$executeRawUnsafe`, склейка строк в сырых запросах |
| §5 Сырой HTML | `dangerouslySetInnerHTML` в `client/` и `admin/` |
| §6 CSRF | **Ограниченно применимо:** токен передаётся заголовком из localStorage, не кукой. Зато цена XSS максимальна — украденный токен даёт полный доступ |
| §6 CORS | `@fastify/cors` в `server/src/index.ts`, `origin` не должен быть `'*'` |
| §5 Заголовки | `@fastify/helmet` в `server/src/index.ts` — CSP, X-Frame-Options, HSTS |
| §7 Загрузки | MinIO: политика бакета не публичная для приватных файлов, лимит размера тела запроса |
| §9 Rate limit | `@fastify/rate-limit`; OTP — 5 попыток / 15 минут, in-memory Map. Проверять, что реально применён к `/auth/otp/request` и `/auth/otp/verify` |
| §1 Тайминг | Сравнение OTP-кода и токенов — `crypto.timingSafeEqual`, не `===` |
| §2 JWT | `JWT_SECRET` из env, обязателен `expiresIn`. Токен в localStorage — принятый риск, см. ниже |
| §11 Платежи | Цена заказа считается на сервере; сумма из клиента не принимается |
| §12 Гонки | Остатки товара, купоны, бонусы, расчёт доставки — конкурентные операции. Правильно: условие в `UPDATE ... WHERE` или транзакция с блокировкой, не «прочитал-сравнил-записал» |
| §13 Секреты | `.env` на сервере. Специфичные сигнатуры — ниже |
| §17 Порты | `docker-compose.yml`: PostgreSQL `5432`, MinIO `9000`/`9001` не должны публиковаться наружу в проде |
| §22 Валидация | Zod на границе роута |

## Сигнатуры секретов, специфичные для стека

- `MINIO_ACCESS_KEY` / `MINIO_ROOT_USER` / `MINIO_SECRET_KEY` /
  `MINIO_ROOT_PASSWORD` со значением, не `${...}`
- `new Client({ accessKey: '...', secretKey: '...' })`
- `DATABASE_URL` с реальным паролем: `postgresql://user:password@host`
- Отдельный `prisma/.env` — Prisma создаёт его для миграций, легко минует
  `.gitignore`
- `JWT_SECRET` / `jwtSecret` строковым литералом; `sign(payload, 'секрет')`
- `SMTP_PASSWORD` / `MAIL_PASSWORD` со значением, `auth: { pass: '...' }`
- Приватные SSH-ключи (`-----BEGIN OPENSSH PRIVATE KEY-----`), пароль root

## Защита, встроенная в стек

| Риск | Закрыто стеком | Что всё равно проверять |
|---|---|---|
| SQL-инъекция | Prisma параметризует значения | Сырые запросы `$queryRawUnsafe` |
| XSS в разметке | React экранирует по умолчанию | `dangerouslySetInnerHTML` |
| Типы на границе | Zod-схемы роутов | Роуты без схемы |

## Команды проверки

```bash
npm audit --omit=dev          # уязвимости в зависимостях
npm test                      # 184 теста (server + client)
npm run build                 # сборка и проверка типов
```

## Доступ к боевому серверу

| Что | Как |
|---|---|
| Выполнить команду на сервере | workflow `run-command.yml`, рабочая директория `/var/www/simba-src` |
| Выкатка | пуш в `deploy/simba`, workflow `deploy-simba.yml` |
| Логи приложения | `pm2 logs simba-server`, `~/.pm2/logs/simba-server-error.log` |
| Логи веб-сервера | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| Логи хранилища | `mc admin trace myminio`, `mc admin logs myminio` |
| Логи системы | `journalctl -u nginx --since "1 hour ago"`, `last -20` |
| Домен боевого сайта | уточнить у владельца |
| Тестовый стенд | нет |

## На что смотреть при инциденте

Специфика e-commerce:

- Резкий рост заказов с одного IP — накрутка или фрод
- Много неудачных попыток OTP с одного контакта
- Аномальное скачивание файлов из MinIO — утечка фото товаров и документов
- Обращения к `/api/admin/*` с токенами обычных клиентов

## Известные и принятые риски

| Риск | Почему принят | Пересмотреть |
|---|---|---|
| JWT в `localStorage` вместо httpOnly-куки | Так устроен текущий клиент | При следующем заходе в авторизацию — перевести на httpOnly-куку через `@fastify/cookie` |
| Rate limit OTP в памяти процесса | Один инстанс PM2 | При масштабировании на несколько процессов — вынести в общее хранилище |
