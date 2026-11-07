#!/bin/bash
# Run once in a local clone to prepare the two repository-owned MCP tools.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
command -v python3 >/dev/null
command -v node >/dev/null
command -v npm >/dev/null
command -v codex >/dev/null
python3 -c 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ required"'
for TOOL in tools/icon-mcp-server tools/nullume; do
  if [ ! -d "$TOOL/node_modules" ]; then
    npm ci --no-audit --no-fund --prefix "$TOOL"
  fi
done
codex plugin marketplace add "$ROOT/.codex"
codex plugin add friday-workflows@friday-local
python3 .codex/scripts/selftest.py
echo 'Ready. Start codex from this checkout; accept the normal project/hook trust prompts.'
