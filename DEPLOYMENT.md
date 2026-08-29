# Sportza — Deployment & Sharing Guide

## Table of Contents
1. [Share with testers (ngrok)](#1-share-with-testers-ngrok)
2. [Share with testers (cloudflared — no account)](#2-share-with-testers-cloudflared--no-account)
3. [Environment variables reference](#3-environment-variables-reference)
4. [Production deployment](#4-production-deployment)
5. [Verification checklist](#5-verification-checklist)

---

## 1. Share with testers (ngrok)

### Prerequisites
- Install ngrok: https://ngrok.com/download
- (Optional) Create a free account to get a stable subdomain

### Steps

**Terminal 1 — Start the API**
```bash
pnpm dev:backend
```

**Terminal 2 — Expose the API**
```bash
ngrok http 5000
```
Copy the HTTPS URL shown, e.g. `https://abc123.ngrok-free.app`

**Update `apps/api/.env`**
```env
CLIENT_ORIGIN=http://localhost:5173,https://<frontend-ngrok-url>.ngrok-free.app
```

**Update `apps/web/.env`**
```env
VITE_API_URL=https://abc123.ngrok-free.app/api
```

**Terminal 3 — Start the frontend**
```bash
pnpm dev:frontend
```

**Terminal 4 — Expose the frontend**
```bash
ngrok http 5173
```
Share the frontend ngrok URL with testers.

> **Tip:** Run `pnpm dev:share` for a step-by-step checklist printed in your terminal.

---

## 2. Share with testers (cloudflared — no account)

No account or install needed — just download cloudflared.

```bash
# Backend
cloudflared tunnel --url http://localhost:5000

# Frontend (separate terminal)
cloudflared tunnel --url http://localhost:5173
```

Update your `.env` files the same way as above.

---

## 3. Environment Variables Reference

### `apps/api/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | API port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `CLIENT_ORIGIN` | Yes | Comma-separated allowed frontend origins |
| `DATABASE_URL` | Yes | MySQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `RAZORPAY_KEY_ID` | Payments | From Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | Payments | From Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Payments | From Razorpay Dashboard |

### `apps/web/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend base URL (include `/api`) |
| `VITE_RAZORPAY_KEY_ID` | Payments | Same as `RAZORPAY_KEY_ID` above |

---

## 4. Production Deployment

### Recommended Architecture

```
Users
  │
  ├─► Railway Web (recommended)  → apps/web (Docker + nginx)
  │     or Vercel (optional)
  │
  └─► Railway API                → apps/api (Docker)
           │
           ├─► Railway MySQL
           └─► Railway Redis
```

**Full Railway guide (fastest):** [docs/RAILWAY.md](docs/RAILWAY.md)

---

### Frontend → Vercel

1. Push repo to GitHub.
2. Import project in [vercel.com](https://vercel.com).
3. Set **Root Directory** to `apps/web`.
4. Set **Build Command** to `pnpm build` (or `cd ../.. && pnpm build --filter @sportza/web`).
5. Set **Output Directory** to `dist`.
6. Add **Environment Variables**:
   ```
   VITE_API_URL=https://your-api.onrender.com/api
   VITE_RAZORPAY_KEY_ID=rzp_live_...
   ```
7. Deploy.

---

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repo.
3. Set **Root Directory** to `apps/api`.
4. Set **Build Command**:
   ```bash
   pnpm install && pnpm --filter @sportza/api build
   ```
5. Set **Start Command**:
   ```bash
   node dist/index.js
   ```
6. Add **Environment Variables** (all from `apps/api/.env`):
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=mysql://...
   REDIS_URL=rediss://...
   JWT_SECRET=<strong-random-secret>
   CLIENT_ORIGIN=https://your-app.vercel.app
   RAZORPAY_KEY_ID=rzp_live_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   ```

---

### Database → Railway MySQL

1. Create a new MySQL service on [railway.app](https://railway.app).
2. Copy the `DATABASE_URL` from Railway dashboard.
3. Run migrations:
   ```bash
   DATABASE_URL=<railway-url> pnpm db:migrate
   ```

---

### Redis → Upstash

1. Create a Redis database on [upstash.com](https://upstash.com).
2. Copy the `REDIS_URL` (starts with `rediss://`).
3. Set it as `REDIS_URL` in your backend env.

---

## 5. Verification Checklist

After deploying or sharing via ngrok, verify each item:

- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Frontend loads at the public URL
- [ ] Login page renders correctly
- [ ] OTP flow completes successfully
- [ ] Booking list loads (authenticated API call succeeds)
- [ ] No CORS errors in the browser console
- [ ] Network tab shows requests going to the public backend URL (not localhost)
- [ ] Razorpay payment modal opens
- [ ] No secrets visible in page source or JS bundles
- [ ] Pickleball **service** scoring: `sport_formats` includes rows **Doubles (service)** and **Singles (service)** with `config.scoringType` = `pickleball_service` (run `pnpm --filter @sportza/api exec prisma db seed` after pulling if Create Match only shows rally doubles).

---

## Known Risks & Limitations

| Risk | Mitigation |
|---|---|
| ngrok free URLs reset on restart | Use a paid ngrok plan or cloudflared for stable URLs |
| `JWT_SECRET` in dev is weak | Use a strong random secret in production |
| MySQL on localhost not reachable in cloud | Use Railway/PlanetScale for cloud DB |
| Redis on localhost not reachable in cloud | Use Upstash for cloud Redis |
| Razorpay test keys work for testing only | Switch to live keys for real payments |
| `DEV_FALLBACK_USER_ID` bypasses auth | Remove or disable in production (`NODE_ENV=production`) |
