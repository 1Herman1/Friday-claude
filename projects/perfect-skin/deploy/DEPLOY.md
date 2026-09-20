# Деплой Perfect Skin на VPS Timeweb Cloud

Разворачиваем production-версию магазина на собственной базе с полным API.
Стек: Ubuntu 24.04 LTS, Docker (Postgres), Fastify под PM2, Nginx + Let's Encrypt.

Все команды выполняешь по SSH на сервере под root (или через `sudo`).
Если что-то падает — присылай вывод ошибки.

---

## 0. Требования к серверу

Заказать на Timeweb Cloud:
- **ОС:** Ubuntu 24.04 LTS
- **Ресурсы:** 2 vCPU / 4 ГБ RAM / 40 ГБ NVMe SSD
- **Регион:** Россия (локализация данных, 152-ФЗ)
- **Доступ:** SSH-ключ (публичный ключ добавить при создании, приватный сохранить локально)

После создания сервера:
1. Записать IP в GitHub Secrets как `PS_DEPLOY_HOST`
2. Записать пользователя (обычно `root`) в `PS_DEPLOY_USER`
3. Записать приватный SSH-ключ в `PS_DEPLOY_SSH_KEY`

---

## 1. Первичная настройка сервера (bootstrap)

Запускается через GitHub Actions: workflow **«Bootstrap Perfect Skin Server»**
→ **Run workflow**. Запусков будет **два**, и это не ошибка.

**Первый запуск.** Скрипт ставит окружение (Node 20, Docker, Nginx, certbot,
PM2), включает межсетевой экран (открыты только 22, 80, 443), создаёт каталоги
и генерирует на сервере ключ развёртывания. Дальше он **останавливается** и
печатает в логе открытый ключ примерно такого вида:

```
ssh-ed25519 AAAAC3NzaC1... perfect-skin-server
```

Репозиторий приватный, поэтому сервер должен получить к нему доступ. Ключ
нужно добавить: **репозиторий на GitHub → Settings → Deploy keys → Add deploy
key**, вставить строку целиком, галочку «Allow write access» **не ставить** —
серверу нужно только читать.

Закрытая половина ключа остаётся на сервере и никуда не уходит. Вариант с
токеном в адресе репозитория проще, но токен оседает в `.git/config` открытым
текстом — поэтому так не делаем.

**Второй запуск.** Тот же workflow, та же кнопка. Теперь он клонирует
репозиторий, создаёт `.env` со сгенерированными секретами, поднимает Postgres,
применяет миграции и ограничения уровня базы, засевает каталог товаров и
настраивает Nginx.

Скрипт **идемпотентен**: повторный запуск не перетирает уже созданные секреты
и не засевает каталог второй раз.

При ошибке — смотреть лог шага в GitHub Actions, исправить причину и запустить
снова.

---

## 2. Выпустить HTTPS сертификат

После успеха bootstrap подключиться по SSH и выполнить:

```bash
ssh root@<IP_СЕРВЕРА>

# Выпустить сертификат Let's Encrypt на текущий домен (new.perfect-skin.shop)
# certbot автоматически обновит конфиг Nginx и добавит редирект со старого на новый
sudo certbot --nginx -d new.perfect-skin.shop

# Проверить, что сертификат установлен
curl https://new.perfect-skin.shop
```

Ответ:
```
Server certificate:
	subject=CN = new.perfect-skin.shop
	issuer=C = US, O = Let's Encrypt, CN = R3
```

---

## 3. Первая выкатка кода

1. Убедиться, что ветка `deploy/perfect-skin` содержит готовый код
2. Открыть `.github/workflows/deploy-perfect-skin.yml`
3. Нажать **Run workflow** → **Run**

Скрипт:
- Заливает новый код на сервер
- Собирает `@ps/shared` → сервер → клиент (с правильным `VITE_API_URL`)
- Бэкапит БД перед миграциями
- Запускает миграции
- Перезагружает API через PM2
- Проверяет health-check: `GET /api/v1/health` → 200 OK

Если выкатка упала на health-check:
```bash
# Смотреть логи сервера
pm2 logs ps-server --lines 100
```

---

## 4. Переезд на боевой домен `perfect-skin.shop`

Когда сайт готов, переезжаем с тестового домена на боевой. **Порядок важен.**

### 4.1. Обновить Nginx конфиг

```bash
ssh root@<IP_СЕРВЕРА>

# Отредактировать /etc/nginx/sites-available/perfect-skin:
# server_name new.perfect-skin.shop;  →  server_name perfect-skin.shop;

sudo nano /etc/nginx/sites-available/perfect-skin
# Найти строку с server_name, поменять на: server_name perfect-skin.shop;
# Сохранить Ctrl+O, выход Ctrl+X

# Проверить синтаксис
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

### 4.2. Выпустить новый сертификат

```bash
# Сертификат на новый домен (certbot автоматически обновит конфиг)
sudo certbot --nginx -d perfect-skin.shop

# Проверить редирект со старого домена
curl -I https://new.perfect-skin.shop
# Ответ должен быть: 301 Moved Permanently → https://perfect-skin.shop
```

### 4.3. Пересобрать клиент с новым API URL

**ВАЖНО:** фронт-бандл содержит адрес API, поменять его в рантайме нельзя.

```bash
# Запустить выкатку с новым VITE_API_URL через GitHub Actions
# Workflow сам пересоберёт клиент с правильным адресом
```

1. Открыть `.github/workflows/deploy-perfect-skin.yml`
2. Поменять строку:
   ```bash
   VITE_API_URL=https://new.perfect-skin.shop npm run build --workspace=@ps/client
   ```
   на:
   ```bash
   VITE_API_URL=https://perfect-skin.shop npm run build --workspace=@ps/client
   ```
3. Поменять `PS_CORS_ORIGIN` в переменных окружения сервера (или через GitHub Secrets).

### 4.4. Снять защиту от индексации

По SSH:

```bash
ssh root@<IP_СЕРВЕРА>

sudo nano /etc/nginx/sites-available/perfect-skin
# Найти строку: add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
# Удалить её или заменить на: add_header X-Robots-Tag "noindex";  # временно, пока готовим

sudo nginx -t && sudo systemctl reload nginx
```

После индексации основного сайта можно снять и эту строку вообще.

---

## 5. Обслуживание

### Где искать логи

**API:**
```bash
pm2 logs ps-server
```

**Nginx (входящие запросы):**
```bash
tail -f /var/log/nginx/perfect-skin.access.log
tail -f /var/log/nginx/perfect-skin.error.log
```

**Cron-задачи:**
```bash
tail -f /var/log/ps-cleanup.log
```

### Где бэкапы БД

```bash
ls -la /var/backups/perfect-skin/
ps_backup_20260920_143052.dump  # <-- последний бэкап
```

Хранятся последние 10 дампов, остальные автоматически чистятся.

### Восстановление из бэкапа

```bash
# 1. Остановить приложение
pm2 stop ps-server

# 2. Восстановить БД из дампа
pg_restore -U ps -d perfect_skin -c /var/backups/perfect-skin/ps_backup_ХХХ.dump

# 3. Перезагрузить приложение
pm2 restart ps-server
```

### Команды PM2

```bash
# Статус приложения
pm2 status

# Перезагрузить
pm2 restart ps-server

# Остановить
pm2 stop ps-server

# Запустить
pm2 start ps-server

# Лог последних 100 строк
pm2 logs ps-server --lines 100
```

### Команды Postgres (в контейнере)

```bash
# Подключиться к БД
docker exec -it deploy-postgres-1 psql -U ps -d perfect_skin

# Примеры команд в psql:
\dt                   # список таблиц
SELECT COUNT(*) FROM users;  # количество пользователей
\q                    # выход
```

---

## 6. Откат выкатки

Если что-то упало, откатиться просто:

### Откат одного коммита

```bash
# На локальной машине
git log deploy/perfect-skin
# Найти коммит, который надо откатить

git revert COMMIT_SHA
git push origin <локальная_ветка>:deploy/perfect-skin
```

Сервер автоматически вытянет новый коммит и перезагрузит приложение.

### Полный откат на версию из бэкапа

```bash
# На сервере
pm2 stop ps-server

# Восстановить БД
pg_restore -U ps -d perfect_skin -c /var/backups/perfect-skin/ps_backup_ХХХ.dump

# Откатить код локально и пушить на deploy/perfect-skin
git reset --hard COMMIT_SHA
git push -f origin COMMIT_SHA:deploy/perfect-skin

# На сервере будет вытянут старый код и перезагружен
```

---

## 7. Переезд на новый сервер (горячая подмена)

Если появится нужда переезжать на новый сервер без простоя:

1. Запустить bootstrap на новом сервере
2. Залить последний бэкап старого сервера в новый:
   ```bash
   pg_restore -U ps -d perfect_skin -c /var/backups/perfect-skin/ps_backup_latest.dump
   ```
3. Обновить DNS на новый IP
4. Выпустить новый сертификат Let's Encrypt на новом сервере
5. Вывести старый из эксплуатации

---

## Готово!

Сайт доступен по адресу: https://new.perfect-skin.shop (тест) или https://perfect-skin.shop (боевой).

При вопросах — смотреть логи PM2 или Nginx, выше в этом файле примеры всех основных команд.
