#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Sportza VPS Bootstrap — run once as root on a fresh Ubuntu 22.04 server
# Usage: curl -sL https://<your-cdn>/bootstrap.sh | bash
#   OR:  scp this file to the VPS then: chmod +x bootstrap.sh && sudo ./bootstrap.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "==> Updating system packages..."
apt update && apt upgrade -y

echo "==> Installing dependencies..."
apt install -y \
  nginx \
  certbot python3-certbot-nginx \
  docker.io docker-compose-plugin \
  git curl unzip \
  build-essential

echo "==> Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "==> Installing pnpm and pm2..."
npm install -g pnpm pm2

echo "==> Enabling Docker on startup..."
systemctl enable docker
systemctl start docker

echo "==> Creating app directory..."
mkdir -p /opt/sportza

echo "==> Bootstrap complete. Now run deploy.sh"
