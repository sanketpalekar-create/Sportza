#!/bin/sh
# Railway / Docker API boot: sync schema then start.
# This repo does not have a full Prisma migrate history (only a couple of
# late migrations), so `migrate deploy` breaks on new databases.
# `db push` applies the current schema.prisma safely for Railway.

set -e

# Prefer Railway private MySQL networking inside the cluster.
# Public proxy hosts (*.proxy.rlwy.net) often cause Prisma auth failures
# when used from another Railway service.
normalize_database_url() {
  if [ -n "${MYSQLHOST:-}" ] && [ -n "${MYSQLPASSWORD:-}" ]; then
    USER="${MYSQLUSER:-root}"
    PORT="${MYSQLPORT:-3306}"
    DB="${MYSQLDATABASE:-railway}"
    export DATABASE_URL="mysql://${USER}:${MYSQLPASSWORD}@${MYSQLHOST}:${PORT}/${DB}"
    echo "[sportza-api] DATABASE_URL built from MYSQL* vars → ${MYSQLHOST}:${PORT}/${DB}"
    return
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[sportza-api] ERROR: DATABASE_URL is not set and MYSQLHOST/MYSQLPASSWORD are missing"
    exit 1
  fi

  case "$DATABASE_URL" in
    *proxy.rlwy.net*|*railway.proxy*)
      # Rewrite public TCP proxy → private hostname (same credentials)
      # mysql://user:pass@host:port/db  →  mysql://user:pass@mysql.railway.internal:3306/db
      REWRITTEN=$(printf '%s' "$DATABASE_URL" | sed -E \
        's#(@)[^/@]+:[0-9]+(/)#\1mysql.railway.internal:3306\2#')
      export DATABASE_URL="$REWRITTEN"
      echo "[sportza-api] Rewrote DATABASE_URL public proxy → mysql.railway.internal:3306"
      ;;
    *)
      echo "[sportza-api] Using DATABASE_URL as provided"
      ;;
  esac
}

normalize_database_url

echo "[sportza-api] Syncing Prisma schema (db push)..."
npx prisma db push --skip-generate --accept-data-loss=false

echo "[sportza-api] Starting server..."
exec npx tsx src/index.ts
