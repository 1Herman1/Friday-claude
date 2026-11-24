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

## BingX: импорт, визуальные разборы и скрины

Из `trade-performance/` (значения ключей Герман сохраняет сам в `.env`: `BINGX_API_KEY`, `BINGX_SECRET_KEY`; чтение, без торговли/вывода):

```bash
prop-agents/.venv/bin/python journal/importers/bingx_api_sync.py --dry-run
prop-agents/.venv/bin/python journal/importers/bingx_api_sync.py
# повтор должен дать fills_new=0, funding_new=0; сверить позиции и суммы в БД
prop-agents/.venv/bin/python journal/review/bingx_review.py --dry-run
prop-agents/.venv/bin/python journal/review/bingx_review.py --capture --workers 3 --out journal/data/reports/bingx-current
```

Для скринов нужен запущенный локальный веб на `127.0.0.1:3100`. Headless-браузер один раз:

```bash
cd journal/tools/shot
PLAYWRIGHT_BROWSERS_PATH="$HOME/.hermes/browser-cache/journal" PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium --only-shell
```

Разборы используют существующий ChatGPT login Codex CLI, не Claude и не API-ключ; `npx --offline --yes @openai/codex login status` проверяет именно CLI. Скриншоты автоматически построенных графиков не содержат личных рисунков из внешнего браузера. Все текущие позиции доступны по `/trades?venue=bingx`; открытые не включаются в статистику закрытых. Snapshot PnL не потоковый.

Данные сделок (`journal/data/`) в git не попадают.
