#!/bin/bash
set -eu
ROOT="$(dirname "$0")/.."
cd "$ROOT"

# Check if dist exists (npm installed) or use tsx for development
if [ -f dist/mcp/index.js ]; then
  exec node dist/mcp/index.js
else
  if [ ! -d node_modules ]; then
    npm ci || npm install
  fi
  exec npx tsx src/mcp/index.ts
fi
