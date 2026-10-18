#!/bin/bash
# Обёртка для расписания (Hermes cron, no_agent): молчит при успехе, пишет в чат только при ошибке.
TP="$HOME/Friday-claude/trade-performance"
LOG="$TP/journal/data/logs/mexc_sync.log"
OUT=$("$TP/prop-agents/.venv/bin/python" "$TP/journal/importers/mexc_api_sync.py" 2>&1)
RC=$?
echo "$(date '+%F %T') rc=$RC $OUT" | tail -c 4000 >> "$LOG"
if [ $RC -ne 0 ]; then echo "⚠️ Дневник: синхронизация MEXC упала (rc=$RC)"; echo "$OUT" | tail -5; fi
