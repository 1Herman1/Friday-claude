#!/bin/bash
# Читатель архива. Вызывается из session-start.sh.
# Печатает в stdout — при SessionStart это попадает прямо в контекст Claude.

set -uo pipefail
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

CONTEXT="docs/archive/CONTEXT.md"
SESSIONS="docs/archive/sessions"

[ -d "$SESSIONS" ] || exit 0

RAW_COUNT=$(grep -lE '^status: raw' "$SESSIONS"/*.md 2>/dev/null | wc -l | tr -d ' ')
LAST=$(ls -1t "$SESSIONS"/*.md 2>/dev/null | head -1)

[ -f "$CONTEXT" ] || [ -n "$LAST" ] || exit 0

echo "=== ПАМЯТЬ ПРОШЛЫХ СЕССИЙ ==="

if [ -f "$CONTEXT" ] && [ -s "$CONTEXT" ]; then
  # Свод от архивариуса — основной источник. Ограничиваем, чтобы не съесть контекст.
  # Порог держать выше длины свода: при head -70 хвост с разделом «Следующий шаг»
  # молча не доезжал до новой сессии, а это самая нужная его часть.
  head -130 "$CONTEXT"
else
  echo "Свода ещё нет. Сырые записи есть — попроси /archive, чтобы архивариус их свернул."
fi

if [ -n "$LAST" ]; then
  echo
  echo "Последняя сессия: $(basename "$LAST")"
  sed -n '/### Просил/,/^###/p' "$LAST" 2>/dev/null | grep '^- ' | tail -5
fi

if [ "$RAW_COUNT" -gt 0 ]; then
  echo
  echo "Необработанных записей: $RAW_COUNT. Свернуть — командой /archive."
fi

echo
echo "За подробностями по конкретной теме — Agent(archivist, \"справка: <тема>\")."
echo "=== КОНЕЦ ПАМЯТИ ==="
exit 0
