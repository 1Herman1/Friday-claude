#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
python3 .codex/scripts/selftest.py
exec codex -C "$ROOT" "$@"
