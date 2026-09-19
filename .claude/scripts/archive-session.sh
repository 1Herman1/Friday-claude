#!/bin/bash
# Архиватор сессии. Вызывается хуками PreCompact / SessionEnd / Stop.
#
# Собирает из стенограммы сухой остаток: реплики пользователя, изменённые
# файлы проекта, запущенных агентов, ошибки и коммиты. Пишет в
# docs/archive/sessions/. LLM не задействован — только факты.
#
# Инкрементальность: смещение прочитанного хранится в .claude/.archive-state/,
# поэтому вызов на Stop (после каждого ответа) стоит доли секунды.
#
# Секреты маскируются перед записью — архив уходит в git.
#
# Две фазы, чтобы рабочее дерево git не грязнилось коммитом на каждый ответ:
#   накопление (stop) — фрагмент копится в черновик $STATE_DIR/*.pending,
#   который вне git (см. .gitignore, каталог .archive-state/);
#   сброс (precompact/sessionend/manual) — черновик одним заходом вливается
#   в docs/archive/sessions/, и только тогда происходит коммит.

set -uo pipefail

TRIGGER="${1:-manual}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

# Хук не имеет права ломать сессию: любая неожиданность — тихий выход.
INPUT=$(cat 2>/dev/null || echo '{}')
command -v jq >/dev/null 2>&1 || exit 0

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
[ -z "$SESSION_ID" ] && exit 0
[ -z "$CWD" ] && CWD="$PROJECT_DIR"

# Хуки не отдают путь к стенограмме. Кодировку имени папки не угадываем
# (Claude Code заменяет дефисом и слэш, и подчёркивание) — ищем файл по
# session_id: устойчиво к любым правилам именования.
TRANSCRIPT=""
for d in "$HOME/.claude/projects"/*/; do
  if [ -f "$d$SESSION_ID.jsonl" ]; then TRANSCRIPT="$d$SESSION_ID.jsonl"; break; fi
done
[ -n "$TRANSCRIPT" ] || exit 0

STATE_DIR="$PROJECT_DIR/.claude/.archive-state"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0
OFFSET_FILE="$STATE_DIR/$SESSION_ID.offset"
PENDING_FILE="$STATE_DIR/$SESSION_ID.pending"
OFFSET=0
[ -f "$OFFSET_FILE" ] && OFFSET=$(cat "$OFFSET_FILE" 2>/dev/null || echo 0)
case "$OFFSET" in ''|*[!0-9]*) OFFSET=0 ;; esac

SIZE=$(wc -c < "$TRANSCRIPT" 2>/dev/null || echo 0)
# Файл усечён или пересоздан — читаем заново.
[ "$SIZE" -lt "$OFFSET" ] && OFFSET=0

# Сброс — не только по Stop: на PreCompact/SessionEnd/ручном вызове нужно
# долить в архив то, что накопилось в черновике, даже если в стенограмме
# с прошлого раза не прибавилось ни байта.
RESET=0
case "$TRIGGER" in precompact|sessionend|manual) RESET=1 ;; esac
HAS_NEW=1
[ "$SIZE" -le "$OFFSET" ] && HAS_NEW=0

# Совсем нечего делать: ни новых байт стенограммы, ни черновика на сброс.
if [ "$HAS_NEW" -eq 0 ] && { [ "$RESET" -eq 0 ] || [ ! -s "$PENDING_FILE" ]; }; then
  exit 0
fi

# Маскировка секретов. Последний рубеж перед записью в git: в стенограммах
# реально встречаются вставленные в чат ключи.
redact() {
  sed -E \
    -e 's/\b[a-fA-F0-9]{32,}\b/[СКРЫТО]/g' \
    -e 's/\b(gh[pousr]_[A-Za-z0-9]{20,})/[СКРЫТО]/g' \
    -e 's/\b(sk-[A-Za-z0-9_-]{20,})/[СКРЫТО]/g' \
    -e 's/(KEY|TOKEN|SECRET|PASSWORD|PASSWD|APIKEY)("?[[:space:]]*[:=][[:space:]]*"?)[^ ",;]{8,}/\1\2[СКРЫТО]/gI'
}

if [ "$HAS_NEW" -eq 1 ]; then
  NEW=$(mktemp) || exit 0
  trap 'rm -f "$NEW"' EXIT
  tail -c "+$((OFFSET + 1))" "$TRANSCRIPT" > "$NEW" 2>/dev/null || exit 0

# --- реплики пользователя ---
# toolUseResult == null — надёжный признак настоящей реплики человека:
# результаты инструментов и отчёты субагентов приходят тем же типом "user",
# но всегда с этим полем.
USER_MSGS=$(jq -r 'select(.type=="user" and (.isMeta != true) and (.toolUseResult == null))
  | .message.content
  | (if type=="string" then . elif type=="array" then (map(select(.type=="text").text) | join(" ")) else "" end)
  | gsub("[\\r\\n\\t]+"; " ") | gsub("  +"; " ")' \
  "$NEW" 2>/dev/null \
  | grep -vE '^[[:space:]]*$' \
  | grep -vE '^[[:space:]]*<' \
  | grep -vE '<(command-name|command-message|command-args|local-command|system-reminder|bash-|user-prompt|untrusted|github-webhook|task-|tool-use-id|output-file|wake |webhook-)' \
  | grep -vE '^[[:space:]]*(Caveat:|The messages below|\[Request interrupted|\[Image:|✓|✗|Note:)' \
  | awk 'length > 12' \
  | uniq \
  | cut -c1-400 | redact)

# --- изменённые файлы: только внутри проекта, без временных ---
FILES=$(jq -r 'select(.type=="assistant") | .message.content[]?
  | select(.type=="tool_use") | select(.name=="Write" or .name=="Edit" or .name=="NotebookEdit")
  | .input.file_path // empty' "$NEW" 2>/dev/null \
  | grep -vE '^(/tmp/|/root/\.claude/|/var/)' \
  | sed "s|^$PROJECT_DIR/||" | sort -u)

# --- запущенные агенты ---
AGENTS=$(jq -r 'select(.type=="assistant") | .message.content[]?
  | select(.type=="tool_use") | select(.name=="Agent")
  | (.input.subagent_type // "general") + " — " + (.input.description // "")' \
  "$NEW" 2>/dev/null | sort -u | cut -c1-120)

# --- ход работы: что падало ---
ERRORS=$(jq -r 'select(.type=="user") | .message.content[]?
  | select(.type=="tool_result") | select(.is_error == true)
  | (if (.content|type)=="string" then .content else ((.content[]?|select(.type=="text").text) // "") end)' \
  "$NEW" 2>/dev/null | grep -vE '^[[:space:]]*$' | cut -c1-200 | head -20 | redact)

  # Фрагмент копится в черновик, а не в docs/archive/sessions/ — так дерево
  # git остаётся чистым между сбросами (см. заголовок файла).
  if [ -n "$USER_MSGS" ] || [ -n "$FILES" ]; then
    {
      echo
      echo "## Фрагмент ($(date +%H:%M), триггер: $TRIGGER)"
      if [ -n "$USER_MSGS" ]; then
        echo
        echo "### Просил"
        printf '%s\n' "$USER_MSGS" | sed 's/^/- /'
      fi
      if [ -n "$FILES" ]; then
        echo
        echo "### Изменённые файлы"
        printf '%s\n' "$FILES" | sed 's/^/- /'
      fi
      if [ -n "$AGENTS" ]; then
        echo
        echo "### Агенты"
        printf '%s\n' "$AGENTS" | sed 's/^/- /'
      fi
      if [ -n "$ERRORS" ]; then
        echo
        echo "### Споткнулись"
        printf '%s\n' "$ERRORS" | sed 's/^/- /'
      fi
    } >> "$PENDING_FILE"
  fi

  printf '%s' "$SIZE" > "$OFFSET_FILE"
fi

# --- сброс: черновик → архив → коммит (только PreCompact/SessionEnd/ручной) ---
if [ "$RESET" -eq 1 ] && [ -s "$PENDING_FILE" ]; then
  DATE=$(date +%Y-%m-%d)
  SHORT=$(printf '%s' "$SESSION_ID" | cut -c1-8)
  OUT="$PROJECT_DIR/docs/archive/sessions/$DATE--$SHORT.md"
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")

  # Ветка выкатки принимает только слияние рабочей ветки — свой коммит в ней
  # ломает ff-only на следующем деплое. Отсоединённый HEAD пушить некуда.
  # Выходим до записи: черновик уцелеет и уйдёт в архив на рабочей ветке.
  case "$BRANCH" in deploy/*|HEAD|'?') exit 0 ;; esac

  if [ ! -f "$OUT" ]; then
    {
      echo "---"
      echo "session: $SESSION_ID"
      echo "date: $DATE"
      echo "branch: $BRANCH"
      echo "status: raw"
      echo "---"
      echo
      echo "# Сессия $DATE"
    } 2>/dev/null > "$OUT" || exit 0
  fi

  # Черновик уйдёт в $OUT или не уйдёт никуда: при сбое записи выходим, не
  # удаляя его, чтобы фрагменты подобрал следующий сброс.
  cat "$PENDING_FILE" 2>/dev/null >> "$OUT" || exit 0

  # Коммиты берём из git, а не парсингом команд — надёжнее. Пересобираем
  # только на сбросе: черновик копит несколько фрагментов, а список
  # коммитов актуален один раз, в конце.
  COMMITS=$(git log --format='%h %s' --since='16 hours ago' 2>/dev/null | head -15)
  if [ -n "$COMMITS" ]; then
    TMP=$(mktemp)
    awk '/^## Коммиты сессии$/{skip=1} skip&&/^## /&&!/^## Коммиты сессии$/{skip=0} !skip' "$OUT" > "$TMP" 2>/dev/null
    mv "$TMP" "$OUT" 2>/dev/null
    { echo; echo "## Коммиты сессии"; printf '%s\n' "$COMMITS" | sed 's/^/- /'; } 2>/dev/null >> "$OUT"
  fi

  rm -f "$PENDING_FILE"

  # Коммитим и пушим ТОЛЬКО docs/archive/sessions/ — в дереве в момент хука
  # может лежать незавершённая работа, её трогать нельзя ни при каких условиях.
  # git commit -- <путь> сам по себе не подхватывает НОВЫЕ (untracked) файлы —
  # а архивный .md почти всегда новый файл (один на день+сессию), поэтому add
  # тоже делаем scoped-путём, а не -A/./-a: он не трогает ничего вне пути и
  # не поднимает то, что уже лежит в индексе от другой, незавершённой работы.
  if git status --porcelain -- docs/archive/sessions/ 2>/dev/null | grep -q .; then
    git add -- docs/archive/sessions/ 2>/dev/null
    git commit -m "Archive the ${SHORT} session log" -- docs/archive/sessions/ >/dev/null 2>&1
    # Сеть может лежать — это не повод ронять хук. Коммит останется локальным
    # и уйдёт со следующим успешным пушем (этим же хуком или вручную).
    # Таймаут короче лимита хука (15с у SessionEnd), чтобы скрипт не убили.
    timeout 10 git push origin HEAD >/dev/null 2>&1
  fi
fi

exit 0
