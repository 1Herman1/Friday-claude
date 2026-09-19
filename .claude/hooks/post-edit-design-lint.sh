#!/bin/bash
set -uo pipefail

CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$CLAUDE_PROJECT_DIR" || exit 0

INPUT=$(cat)

if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]*)"/\1/')
fi

[ -z "$FILE_PATH" ] && exit 0

# UI-файлы: компоненты и конфиг Tailwind
case "$FILE_PATH" in
  *.tsx|*.jsx|*tailwind.config.ts) ;;
  *) exit 0 ;;
esac

# Относится ли файл к коду какого-нибудь проекта — решает реестр
# (docs/projects/README.md), а не список в этом хуке. Прежний жёсткий список
# знал только про два каталога, и правка UI остальных проектов проходила мимо
# линта молча.
if ! node -e '
  import("./.claude/scripts/lib/projects.mjs")
    .then((m) => process.exit(m.isProjectCode(process.argv[1]) ? 0 : 1))
    .catch(() => process.exit(0));
' "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

OUTPUT=$(node "$CLAUDE_PROJECT_DIR/.claude/scripts/design-lint.mjs" "$FILE_PATH" 2>&1)

# Находок нет — молчим.
if echo "$OUTPUT" | grep -q "Проблем не обнаружено"; then
  exit 0
fi

# Находки есть — в stderr с кодом 2, иначе Claude их не увидит
# (при exit 0 stdout хука в модель не возвращается).
{
  echo "design-lint нашёл проблемы в $FILE_PATH — исправь их сейчас:"
  echo "$OUTPUT"
  echo "Правила: docs/core/design-principles.md, docs/core/motion.md,"
  echo "токены проекта: docs/projects/<проект>/design-system/MASTER.md"
} >&2

exit 2
