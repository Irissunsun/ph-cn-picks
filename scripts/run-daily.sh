#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${PRODUCTHUNT_TOKEN:-}" ]]; then
  echo "Missing PRODUCTHUNT_TOKEN. Export it before running the daily job." >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-node}"
LOG_DIR="${LOG_DIR:-./logs}"
mkdir -p "$LOG_DIR"

"$NODE_BIN" scripts/fetch-producthunt.mjs --skip-existing "$@" 2>&1 | tee -a "$LOG_DIR/producthunt-daily.log"
"$NODE_BIN" scripts/generate-rss.mjs 2>&1 | tee -a "$LOG_DIR/producthunt-daily.log"
