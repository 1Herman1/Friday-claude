#!/bin/bash
# Обёртка для расписания (Hermes cron, no_agent): молчит при успехе.
# Новые закрытые сделки → короткое уведомление в топик.
# Ошибка → в чат только если синхронизация падает 3 запуска подряд (разовые сбои MEXC — не повод будить).
TP="$HOME/Friday-claude/trade-performance"
PY="$TP/prop-agents/.venv/bin/python"
LOG="$TP/journal/data/logs/mexc_sync.log"
FAILS="$TP/journal/data/logs/mexc_sync.fails"
OUT=$("$PY" "$TP/journal/importers/mexc_api_sync.py" 2>&1)
RC=$?
echo "$(date '+%F %T') rc=$RC $OUT" | tail -c 4000 >> "$LOG"
if [ $RC -eq 0 ]; then
  rm -f "$FAILS"
  echo "$OUT" | tail -1 | "$PY" -c 'import sys,json; print(json.loads(sys.stdin.read()).get("closed_new") or "", end="")' 2>/dev/null
  # Ф2: детектор тильта — алерт только по новым срабатываниям у сделок за 48 ч
  "$PY" "$TP/journal/core/tilt.py" --alert 48 2>>"$LOG"
  # Ф2: сигналы детекторов → signals + привязка сделок (молча)
  "$PY" "$TP/journal/core/signals_sync.py" >>"$LOG" 2>&1
  # Ф2: сканер пампов MEXC (+50%/24ч) → signals, пересчёт исходов, привязка шортов (молча)
  "$PY" "$TP/journal/core/pump_scan.py" >>"$LOG" 2>&1
  exit 0
fi
N=$(( $(cat "$FAILS" 2>/dev/null || echo 0) + 1 )); echo $N > "$FAILS"
if [ $N -eq 3 ]; then echo "⚠️ Дневник: синхронизация MEXC падает 3 запуска подряд (rc=$RC)"; echo "$OUT" | tail -3; fi
exit 0
