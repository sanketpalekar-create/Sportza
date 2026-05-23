#!/usr/bin/env bash
set -euo pipefail

echo "Installing Sportza monorepo dependencies..."
pnpm install

echo "Generating Prisma client (placeholder DATABASE_URL)..."
export DATABASE_URL="${DATABASE_URL:-mysql://placeholder:placeholder@localhost:3306/placeholder}"
pnpm --filter @sportza/api exec prisma generate

echo "Cloud environment install complete."
