#!/bin/sh
# Railway / Docker API boot: sync schema then start.
# This repo does not have a full Prisma migrate history (only a couple of
# late migrations), so `migrate deploy` breaks on new databases.
# `db push` applies the current schema.prisma safely for Railway.

set -e

echo "[sportza-api] Syncing Prisma schema (db push)..."
npx prisma db push --skip-generate --accept-data-loss=false

echo "[sportza-api] Starting server..."
exec npx tsx src/index.ts
