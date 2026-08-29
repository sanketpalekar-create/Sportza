# Sportza on Railway — fastest path

No Vercel. No cPanel. Four services, one project, done.

**Time:** ~15–20 minutes after GitHub is connected.

---

## What you will create

| Service | Role |
|---------|------|
| **MySQL** | Database (Railway plugin) |
| **Redis** | OTP / queues (Railway plugin) |
| **api** | Express + **frontend SPA** (one service for `sportza.in`) |

Optional separate **web** service is only needed if you want a second URL. For `https://sportza.in`, attach the custom domain to **api** — the image builds `apps/web` and serves it on `/`, with the API under `/api`.

---

## 0. One-time prep

1. Push this repo to GitHub (if not already).
2. Sign up / log in at [railway.app](https://railway.app).
3. Have ready (from your local `.env` / `apps/api/.env` / `apps/web/.env`):
   - `JWT_SECRET` (long random string)
   - `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` (same value)
   - `RAZORPAY_*` keys (optional for first deploy)
   - Map / SMTP / S3 keys (optional for first deploy)

---

## 1. Create the project + database + Redis

1. Railway → **New Project** → **Deploy from GitHub repo** → pick **Sportza**.
2. If Railway auto-creates a random service, **delete it** (we will add the right ones).
3. In the project → **+ New** → **Database** → **MySQL**.
4. **+ New** → **Database** → **Redis**.

Wait until both show green/running.

---

## 2. Deploy the API

1. **+ New** → **GitHub Repo** → same Sportza repo.
2. Rename the service to **`api`** (click name → rename).
3. Open **api** → **Settings**:
   - **Root Directory:** leave empty (repo root)
   - **Builder:** Dockerfile
   - **Dockerfile path:** `apps/api/Dockerfile`
4. Open **api** → **Variables** → add:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | **Add Reference** → MySQL → `MYSQL_URL` (or `DATABASE_URL` if listed) |
| `REDIS_URL` | **Add Reference** → Redis → `REDIS_URL` |
| `JWT_SECRET` | long random string |
| `CLIENT_ORIGIN` | leave blank for now — set after web URL exists |
| `GOOGLE_CLIENT_ID` | your Google client id |
| `DEV_AUTH_FALLBACK` | `false` |

**Also set these as Build-time variables** (Vite bakes them into the SPA):

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `/api` |
| `VITE_GOOGLE_CLIENT_ID` | same as `GOOGLE_CLIENT_ID` |
| `VITE_RAZORPAY_KEY_ID` | your key (optional) |
| `VITE_MAP_PROVIDER` | `mappls` |

Optional later: `RAZORPAY_*`, `SMTP_*`, `S3_*`, `MAPPLS_API_KEY`, etc.  
See `deploy/railway.env.example` for the full list.

5. **Settings → Networking**:
   - Generate a Railway domain, **or**
   - **Custom Domain** → `sportza.in` + `www.sportza.in` (point DNS as Railway shows)
6. Deploy / wait for success. Check:
   - `https://sportza.in/` → **frontend HTML** (not JSON)
   - `https://sportza.in/api/health` → `{"status":"ok",...}`

Schema sync runs automatically on start (`prisma db push` — this repo does not have a full migrate history).

### If sportza.in shows `{"code":"NOT_FOUND","message":"Route not found"}`

The domain is on the API service but the image has **no SPA build** yet (old deploy). Redeploy **api** with the updated Dockerfile that copies `apps/web/dist` → `apps/api/public`. After deploy, `/` serves the React app.

### If you already see: “migrate found failed migrations…”

An earlier deploy ran `migrate deploy` and left a failed row. Fix **once**, then redeploy:

1. Railway → **MySQL** service → open a query console (or Data tab), run:

```sql
-- Clean partial table if it exists
DROP TABLE IF EXISTS `mobile_push_tokens`;

-- Clear the failed migration record so boot is not blocked
DELETE FROM `_prisma_migrations`
WHERE `migration_name` = '20260509110000_add_mobile_push_tokens';
```

2. Redeploy the **api** service (new Dockerfile uses `db push`, not `migrate deploy`).

Alternative from a machine with Railway `DATABASE_URL`:

```bash
cd apps/api
$env:DATABASE_URL="mysql://..."   # paste Railway MySQL URL
npx prisma migrate resolve --rolled-back 20260509110000_add_mobile_push_tokens
npx prisma db push
```

---

## 3. Separate web service (optional)

Not needed if `sportza.in` is on **api** (SPA is baked into that image). Only add a separate **web** service if you want a second frontend URL.

---

## 4. Wire CORS + Google OAuth (2 minutes)

1. On **api** Variables, set:
   ```text
   CLIENT_ORIGIN=https://sportza.in,https://www.sportza.in
   ```
   (no trailing slash). Redeploy **api** if needed.

2. Google Cloud Console → OAuth Web client → **Authorized JavaScript origins** → add:
   - `https://sportza.in`
   - `https://www.sportza.in`

---

## 5. Smoke test

- [ ] `https://sportza.in/` loads the **frontend** (HTML, not JSON)
- [ ] `https://sportza.in/api/health` returns ok
- [ ] Browser Network tab shows API calls to `/api/...` on the same host
- [ ] Login / Google works (origins updated)
- [ ] No CORS errors in the console

---

## Rebuild / redeploy tips

| Change | Action |
|--------|--------|
| API or SPA code | Redeploy **api** |
| `VITE_*` values | Change vars (build-time) → **Redeploy api** |
| DB schema | Update `schema.prisma` → redeploy **api** (`db push` on boot) |

---

## Common failures (quick fixes)

| Problem | Fix |
|---------|-----|
| `sportza.in` shows JSON `NOT_FOUND` | Old image without SPA — redeploy api with updated Dockerfile |
| Web calls wrong host | Set build-time `VITE_API_URL=/api` and redeploy api |
| CORS blocked | `CLIENT_ORIGIN` must include `https://sportza.in` |
| API crash on boot | Check MySQL reference: `DATABASE_URL` must be a `mysql://…` URL Prisma accepts |
| `migrate found failed migrations` | Clear failed row (SQL in §2 above) + redeploy api with updated Dockerfile |
| Redis / OTP fails | Confirm `REDIS_URL` reference from Redis service |
| Google login broken | Add `https://sportza.in` to Google Authorized JavaScript origins |

---

## Optional: Railway CLI

```bash
npm i -g @railway/cli
railway login
railway link
```

Useful later for logs (`railway logs`) — not required for the first deploy.

---

## Files this repo uses

| File | Purpose |
|------|---------|
| `apps/api/Dockerfile` | API image + `db push` + start |
| `apps/web/Dockerfile` | Vite build + nginx on `$PORT` |
| `apps/api/railway.toml` | Healthcheck / Dockerfile hints |
| `apps/web/railway.toml` | Healthcheck / Dockerfile hints |
| `deploy/railway.env.example` | Env checklist |

That’s the whole Railway path — no Vercel, no cPanel.
