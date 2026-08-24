# Deploy Sportza on Vercel

This monorepo is set up so **both the Vite frontend and the Express HTTP API** deploy to a single Vercel project.

| Piece | On Vercel? | Notes |
|-------|------------|--------|
| `apps/web` (SPA) | Yes | Static output `apps/web/dist` |
| Express `/api/*` | Yes | Serverless function `api/index.ts` |
| Socket.io | **No** | Still works locally / Docker; needs Ably/Pusher (or a tiny WS host) for production live features |
| BullMQ Workers | **No** | Hold cleanup + open-play deadline run via **Vercel Cron** |
| MySQL | External | PlanetScale, TiDB Cloud, RDS, etc. |
| Redis | External | Upstash recommended (`REDIS_URL`) |

## Architecture

```
Browser → sportza.in (Vercel)
            ├─ /*          → SPA (apps/web/dist)
            └─ /api/*      → Serverless Express (api/index.ts → createApp())
Cron     → /api/cron/*     → same function (Authorization: Bearer CRON_SECRET)
```

Local / Docker still uses `pnpm --filter @sportza/api dev` which runs [`apps/api/src/index.ts`](../apps/api/src/index.ts): listen + Socket.io + BullMQ.

## One-time setup

1. Import `sanketpalekar-create/Sportza` in [Vercel](https://vercel.com/new).
2. Framework: leave auto / other. Root directory: `.`
3. Build settings are in [`vercel.json`](../vercel.json) (override only if needed).
4. Set **Node.js 20.x** in Project → Settings → General.
5. Add environment variables (below) for Production + Preview.
6. Deploy. Confirm `https://<project>.vercel.app/api/health` returns `{ "status": "ok", "runtime": "vercel" }`.
7. Point Squarespace DNS `@` / `www` to Vercel (keep Google MX/TXT). Prefer **same-origin** `/api` (no separate `api.` subdomain) for cookies.

## Environment variables

### Frontend (`VITE_*` — baked in at build time; redeploy after changes)

| Variable | Production example |
|----------|-------------------|
| `VITE_API_URL` | `/api` (same-origin rewrite) **or** `https://sportza.in/api` |
| `VITE_GOOGLE_CLIENT_ID` | Same as `GOOGLE_CLIENT_ID` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key |
| `VITE_MAP_PROVIDER` | `mappls` or `google` |
| `VITE_MAPPLS_API_KEY` | Mappls REST key |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional |

### API / shared (server)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | MySQL URL; on serverless add `?connection_limit=1` (or host-specific pool params) |
| `REDIS_URL` | Yes | Upstash `redis://` / `rediss://` |
| `JWT_SECRET` | Yes | Strong secret in production |
| `CLIENT_ORIGIN` | Yes | `https://sportza.in,https://www.sportza.in` |
| `CRON_SECRET` | Yes on Vercel | Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` |
| `GOOGLE_CLIENT_ID` | If Google login | |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Payments | Webhook URL: `https://sportza.in/api/payments/webhook` |
| `S3_*` | Uploads | |
| `SMTP_*` | Email | Queued jobs still need a consumer (see below) |
| `NODE_ENV` | | `production` |

### Optional realtime (future)

Socket.io does **not** run on Vercel Functions. Live match / pairing / venue sockets will be silent until you add Ably/Pusher (or a small Fly/Railway WS service). Emit helpers already no-op when Socket.io is not initialised.

## Cron jobs

Configured in [`vercel.json`](../vercel.json):

| Path | Schedule | Job |
|------|----------|-----|
| `/api/cron/hold-cleanup` | every minute | Expire booking holds |
| `/api/cron/open-play-deadline` | every 5 minutes | Cancel/confirm open plays past deadline |

Set `CRON_SECRET` in Vercel. Manual test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://sportza.in/api/cron/hold-cleanup
```

## Local development (unchanged)

```powershell
pnpm install
pnpm --filter @sportza/api exec prisma generate
pnpm dev:all
```

- API: `http://localhost:5000/api` (Socket.io + BullMQ on)
- Web: `http://localhost:5173` with `VITE_API_URL=http://localhost:5000/api`

Simulate serverless locally:

```powershell
$env:SPORTZA_SERVERLESS="1"
pnpm --filter @sportza/api dev
```

## Email / refund queues

`addEmailJob` / `addRefundJob` still enqueue via BullMQ. Worker processes ([`emailWorker.ts`](../apps/api/src/workers/emailWorker.ts), [`refundWorker.ts`](../apps/api/src/workers/refundWorker.ts)) are **not** started on Vercel. Options:

1. Run workers on a small always-on host, or  
2. Add a later cron that drains Upstash / Inngest.

## Third-party checklist

- [ ] Google OAuth JS origins: `https://sportza.in`, `https://www.sportza.in`, preview `*.vercel.app`
- [ ] Razorpay webhook → `https://sportza.in/api/payments/webhook`
- [ ] Managed MySQL provisioned + Prisma schema applied (`db push` / migrate)
- [ ] Upstash Redis `REDIS_URL` set
- [ ] `CRON_SECRET` set and crons visible in Vercel → Settings → Cron Jobs

## Key source files

| File | Role |
|------|------|
| [`vercel.json`](../vercel.json) | Build, rewrites, crons, function limits |
| [`api/index.ts`](../api/index.ts) | Vercel serverless Express export |
| [`apps/api/src/app.ts`](../apps/api/src/app.ts) | `createApp()` — routes only |
| [`apps/api/src/index.ts`](../apps/api/src/index.ts) | Local listen + Socket.io + workers |
| [`apps/api/src/routes/cron.ts`](../apps/api/src/routes/cron.ts) | Cron handlers |
| [`apps/api/src/lib/runtime.ts`](../apps/api/src/lib/runtime.ts) | `isVercel` / `canRunPersistentWorkers` |
