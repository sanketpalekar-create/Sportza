#!/bin/sh
set -e

export PORT="${PORT:-5173}"
# Default keeps docker-compose working; Railway leaves this unused when VITE_API_URL is absolute.
export API_UPSTREAM="${API_UPSTREAM:-http://api:5000}"

envsubst '${PORT} ${API_UPSTREAM}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
