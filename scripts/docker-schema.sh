#!/bin/sh
set -eu
pnpm --filter @repo/db db:push
# Default first-run flow is registration. Seeding is explicit and preserves existing accounts.
if [ -n "${SEED_ADMIN_EMAIL:-}" ]; then
  pnpm seed
fi
