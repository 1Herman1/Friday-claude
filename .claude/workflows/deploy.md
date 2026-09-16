---
name: deploy
description: Чеклист деплоя на Timeweb VPS — подготовка, деплой, проверка после
---

# Воркфлоу: Деплой на продакшн

## Стек деплоя
- VPS: Timeweb (2 CPU / 4 GB / 50 GB)
- Веб-сервер: Nginx
- Процесс-менеджер: PM2
- БД: PostgreSQL
- Хранилище: MinIO

## Шаг 1 — Предеплойная проверка
Запусти параллельно:
- `performance-optimizer` — нет критичных проблем скорости
- `silent-failure-hunter` — нет тихих ошибок
- `security-secrets-scanner` — нет утечек секретов
- `rkn-compliance` — правовая обвязка (согласия, политика, cookie, реквизиты)

Находка уровня БЛОКЕР у `rkn-compliance` останавливает выкатку: сайт, собирающий
персональные данные без корректного согласия, в прод не уходит.

## Шаг 2 — Сборка
```bash
# На локальной машине или в CI
npm run build --workspace=client
npm run build --workspace=admin
```

## Шаг 3 — Деплой на VPS
```bash
# Подключиться по SSH
ssh user@your-vps-ip

# Обновить код
cd /var/www/simba
git pull origin рабочую ветку проекта

# Установить зависимости
npm install

# Миграции БД (осторожно — необратимо)
npx prisma migrate deploy

# Перезапустить сервер
pm2 restart simba-server
```

## Шаг 4 — Проверка после деплоя
- [ ] Сайт открывается без ошибок
- [ ] Авторизация работает (OTP)
- [ ] Каталог загружается
- [ ] Оформление заказа проходит
- [ ] Админка доступна
- [ ] Логи без критичных ошибок: `pm2 logs simba-server --lines 50`

## Шаг 5 — Откат (если что-то сломалось)
```bash
git revert HEAD
pm2 restart simba-server
```
