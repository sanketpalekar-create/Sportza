# Sportza — Deployment Guide

**Version:** 2.0  
**Last updated:** Mar 2026

This document describes how to deploy Sportza (Turborepo monorepo) for local development and production.

---

## 1. Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 9+
- **Docker** & **Docker Compose**
- **MySQL** 8.0+
- **Redis** 7+

---

## 2. Environment Variables

Copy `.env.example` to `.env` and set values. For production, ensure all required variables are set.

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | `mysql://user:pass@host:3306/sportza` |
| `REDIS_URL` | Yes | `redis://localhost:6379` or production Redis URL |
| `AUTH0_DOMAIN` | Yes | Auth0 tenant (e.g. `your-tenant.auth0.com`) |
| `AUTH0_AUDIENCE` | Yes | API identifier |
| `AUTH0_CLIENT_ID` | Yes | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | Yes | Auth0 application client secret |
| `RAZORPAY_KEY_ID` | For payments | From Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | For payments | From Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | For payments | For webhook HMAC verification |
| `S3_ENDPOINT` | For uploads | S3-compatible endpoint (AWS, MinIO) |
| `S3_BUCKET` | For uploads | Bucket name |
| `S3_ACCESS_KEY` | For uploads | Access key |
| `S3_SECRET_KEY` | For uploads | Secret key |
| `S3_REGION` | For uploads | Region (e.g. `ap-south-1`) |
| `SMTP_HOST` | For OTP/email | SMTP server |
| `SMTP_PORT` | For OTP/email | SMTP port |
| `SMTP_USER` | For OTP/email | SMTP username |
| `SMTP_PASS` | For OTP/email | SMTP password |
| `SMTP_FROM` | For OTP/email | From address |
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | API port (default 5000) |
| `CLIENT_ORIGIN` | Recommended | Frontend URL for CORS |

---

## 3. Docker Deployment

Start all services (MySQL, Redis, API, Web):

```bash
docker compose up -d
```

Or start only infrastructure for local dev:

```bash
docker compose up -d mysql redis
```

```mermaid
graph TB
    subgraph Docker["🐳 Docker Compose"]
        direction TB
        subgraph Services["Services"]
            WEB["🌐 Web\nNginx + Vite build\nPort 80"]
            API["⚙️ API\nNode.js + Express\nPort 5000"]
            MYSQL["🗄️ MySQL\nPort 3306"]
            REDIS["📮 Redis\nPort 6379"]
        end
    end

    USER["👤 User Browser"] -->|":80"| WEB
    WEB -->|"/api → :5000"| API
    API --> MYSQL
    API --> REDIS
    API -->|"HTTPS"| RAZORPAY["💰 Razorpay"]
    API -->|"HTTPS"| AUTH0["🔐 Auth0"]
    API -->|"SMTP"| EMAIL["📧 Email"]
    API -->|"HTTPS"| S3["☁️ S3"]

    style WEB fill:#dbeafe,stroke:#2563eb
    style API fill:#dcfce7,stroke:#16a34a
    style MYSQL fill:#fef3c7,stroke:#d97706
    style REDIS fill:#fee2e2,stroke:#dc2626
```

---

## 4. Local Development

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Start MySQL & Redis**
   ```bash
   docker compose up -d mysql redis
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Database setup**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. **Run development**
   ```bash
   pnpm dev
   ```

This runs `apps/web` (Vite on 5173) and `apps/api` (Express on 5000) via Turborepo.

---

## 5. Production Build

### 5.1 Build All

```bash
pnpm build
```

Builds `packages/tokens`, `packages/ui`, `packages/api-client`, then `apps/web` and `apps/api`.

### 5.2 Run API

The API runs with **tsx** (or compiled JS):

```bash
cd apps/api
pnpm start
```

Or from root:

```bash
pnpm --filter @sportza/api start
```

Ensure `DATABASE_URL` and `REDIS_URL` point to production.

### 5.3 Run Web (Static)

`apps/web` builds to `dist/` (or `build/`). Serve with **nginx** or any static host.

Example nginx config:

```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /path/to/apps/web/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  location /api {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

---

## 6. Dockerfiles

### apps/api/Dockerfile

- Base: Node 20
- Install deps, copy Prisma, generate client
- Copy source, build (or use tsx for dev)
- Start with `tsx src/index.ts` or compiled `node dist/index.js`

### apps/web/Dockerfile

- Multi-stage: Node for build, nginx for serve
- Build: `pnpm build` produces static files
- Serve: nginx serves `dist/` or `build/`

---

## 7. Razorpay Webhook (Production)

1. In Razorpay Dashboard: **Settings → Webhooks → Add new webhook**
2. **URL:** `https://your-api-domain.com/api/payments/webhook`
3. **Events:** Select **payment.captured**
4. Copy the **webhook secret** and set `RAZORPAY_WEBHOOK_SECRET` in `.env`

---

## 8. Health Check

- **GET** `/api/health`

Returns `{ "status": "ok", "timestamp": "..." }`.

---

## 9. Checklist Before Go-Live

- [ ] `NODE_ENV=production`
- [ ] Production `DATABASE_URL` and `REDIS_URL`
- [ ] Auth0 domain, audience, client ID/secret
- [ ] Razorpay keys and webhook URL + secret
- [ ] S3 credentials (if using uploads)
- [ ] SMTP credentials (OTP, magic link)
- [ ] `CLIENT_ORIGIN` set for CORS
- [ ] HTTPS via nginx/load balancer
- [ ] `.env` not committed (in `.gitignore`)

---

## 10. Related

- **Document index:** [TRACEABILITY.md](TRACEABILITY.md)
- **Implementation status:** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- **Backend architecture:** [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md)
