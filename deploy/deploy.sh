#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Sportza Full Deploy — run after bootstrap.sh on your Ubuntu VPS
# Edit the VARIABLES section below before running.
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── VARIABLES — fill these in ─────────────────────────────────────────────────
REPO_URL="https://github.com/YOUR_USERNAME/sportza.git"   # your git repo URL
APP_DIR="/opt/sportza"
DOMAIN="sportza.in"

DB_PASSWORD="$(openssl rand -base64 24)"   # auto-generates strong password
JWT_SECRET="$(openssl rand -base64 32)"

# Razorpay (get from dashboard.razorpay.com)
RAZORPAY_KEY_ID="rzp_live_REPLACE"
RAZORPAY_KEY_SECRET="REPLACE"
RAZORPAY_WEBHOOK_SECRET="REPLACE"
# ─────────────────────────────────────────────────────────────────────────────

echo "==> Cloning repository..."
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR && git pull
else
  git clone $REPO_URL $APP_DIR
fi
cd $APP_DIR

echo "==> Writing production .env..."
cat > apps/api/.env <<EOF
PORT=5000
NODE_ENV=production

CLIENT_ORIGIN=https://${DOMAIN},https://www.${DOMAIN}

DATABASE_URL="mysql://root:${DB_PASSWORD}@localhost:3306/sportza"
REDIS_URL=redis://localhost:6379

JWT_SECRET=${JWT_SECRET}

RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
RAZORPAY_WEBHOOK_SECRET=${RAZORPAY_WEBHOOK_SECRET}
EOF

echo "==> Writing docker-compose.prod.yml..."
cat > docker-compose.prod.yml <<EOF
services:
  mysql:
    image: mysql:8.0
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: sportza
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "127.0.0.1:3306:3306"

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"

volumes:
  mysql_data:
  redis_data:
EOF

echo "==> Starting MySQL and Redis..."
docker compose -f docker-compose.prod.yml up -d
sleep 10

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Generating Prisma client..."
pnpm --filter @sportza/api exec prisma generate

echo "==> Pushing database schema..."
pnpm --filter @sportza/api db:push

echo "==> Seeding database..."
pnpm --filter @sportza/api db:seed

echo "==> Building API..."
pnpm --filter @sportza/api build

echo "==> Building frontend..."
pnpm --filter @sportza/web build

echo "==> Starting API with PM2..."
pm2 delete sportza-api 2>/dev/null || true
pm2 start apps/api/dist/index.js --name sportza-api
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

echo ""
echo "==> Deploy complete. DB password saved to: $APP_DIR/apps/api/.env"
echo "==> Now run: sudo ./deploy/setup-nginx.sh"
