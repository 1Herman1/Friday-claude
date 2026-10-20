# Дневник — как запустить локально

Требования: PostgreSQL 17 (Postgres.app, порт 5432), `DATABASE_URL` в `trade-performance/.env`.

```bash
# 1. схема БД (Prisma — владелец миграций)
cd shared/db && npm install && npx prisma migrate deploy

# 2. импорт выгрузки MEXC (идемпотентно, можно гонять повторно)
prop-agents/.venv/bin/python journal/importers/mexc_xlsx_to_db.py journal/data/raw/<файл>.xlsx

# 3. веб (http://127.0.0.1:3100)
cd journal/web && npm install && npm run build && npm start
```

Синхронизация MEXC по API: `bash journal/importers/run_mexc_sync.sh` (Hermes cron раз в час; лог `journal/data/logs/mexc_sync.log`).

Заметки из Telegram (Т6): `prop-agents/.venv/bin/python journal/intake/tg_note.py recent` — последние сделки;
`... tg_note.py add --text "..." [--voice] [--trade auto|#N|day] [--reason ..] [--emotion-before ..] [--tags ..] --chat <chat_id> --msg <message_id>`; `--dry-run` для проверки.

Данные сделок (`journal/data/`) в git не попадают.
