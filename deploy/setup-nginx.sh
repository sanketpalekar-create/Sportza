#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Sportza Nginx + SSL Setup — run after deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMAIN="sportza.in"
APP_DIR="/opt/sportza"

echo "==> Writing Nginx config for $DOMAIN..."
cat > /etc/nginx/sites-available/sportza <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # API
    location /api/ {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # Socket.io WebSocket
    location /socket.io/ {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       \$host;
    }

    # Frontend static files (production build)
    location / {
        root       ${APP_DIR}/apps/web/dist;
        try_files  \$uri \$uri/ /index.html;
        expires    1h;
        add_header Cache-Control "public, must-revalidate";
    }
}
EOF

echo "==> Enabling site..."
ln -sf /etc/nginx/sites-available/sportza /etc/nginx/sites-enabled/sportza
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing Nginx config..."
nginx -t

echo "==> Reloading Nginx..."
systemctl reload nginx

echo "==> Obtaining SSL certificate from Let's Encrypt..."
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} \
  --non-interactive --agree-tos \
  --email admin@${DOMAIN} \
  --redirect

echo "==> Verifying auto-renewal..."
certbot renew --dry-run

echo ""
echo "==> Done! sportza.in is now live at https://${DOMAIN}"
echo "==> API: https://${DOMAIN}/api"
echo "==> Certbot will auto-renew SSL every 90 days."
