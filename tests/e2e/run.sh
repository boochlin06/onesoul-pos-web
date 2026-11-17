#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${DIR}/../.." && pwd)"

echo "🚀 Running OneSoul E2E Test Suite (Tiers 1-4)..."
cd "${ROOT_DIR}"

if [ -f "./backend/node_modules/.bin/vitest" ]; then
  ./backend/node_modules/.bin/vitest run --config tests/e2e/vitest.config.ts "$@"
else
  npx --prefix backend vitest run --config tests/e2e/vitest.config.ts "$@"
fi
