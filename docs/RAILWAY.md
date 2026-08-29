# Sportza on Railway — fastest path

No Vercel. No cPanel. Four services, one project, done.

**Time:** ~15–20 minutes after GitHub is connected.

---

## What you will create

| Service | Role |
|---------|------|
| **MySQL** | Database (Railway plugin) |
| **Redis** | OTP / queues (Railway plugin) |
| **api** | Express backend (`apps/api`) |
| **web** | React frontend (`apps/web`) |

Repo already has Dockerfiles + `apps/*/railway.toml`. You mostly click and paste env vars.

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

Optional later: `RAZORPAY_*`, `SMTP_*`, `S3_*`, `MAPPLS_API_KEY`, etc.  
See `deploy/railway.env.example` for the full list.

5. **Settings → Networking → Generate Domain** → copy the URL  
   Example: `https://api-production-xxxx.up.railway.app`
6. Deploy / wait for success. Check:  
   `https://YOUR-API-URL/api/health` → should return ok/JSON.

Migrations run automatically on start (`prisma migrate deploy` in the Dockerfile).

---

## 3. Deploy the web app

1. **+ New** → **GitHub Repo** → same Sportza repo again.
2. Rename service to **`web`**.
3. **Settings**:
   - **Root Directory:** empty
   - **Builder:** Dockerfile
   - **Dockerfile path:** `apps/web/Dockerfile`
4. **Variables** (turn on **Available at Build Time** for every `VITE_*` var):

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://YOUR-API-URL/api` |
| `VITE_GOOGLE_CLIENT_ID` | same as API `GOOGLE_CLIENT_ID` |
| `VITE_RAZORPAY_KEY_ID` | your Razorpay key (or blank) |
| `VITE_MAP_PROVIDER` | `mappls` |
| `VITE_MAPPLS_API_KEY` | optional |

5. **Networking → Generate Domain** → copy web URL  
   Example: `https://web-production-xxxx.up.railway.app`
6. Redeploy web after variables are set (Vite bakes `VITE_*` at **build** time).

---

## 4. Wire CORS + Google OAuth (2 minutes)

1. On **api** Variables, set:
   ```text
   CLIENT_ORIGIN=https://YOUR-WEB-URL
   ```
   (no trailing slash). Redeploy **api** if it does not pick up the change automatically.

2. Google Cloud Console → your OAuth Web client → **Authorized JavaScript origins** → add:
   - `https://YOUR-WEB-URL`
3. If you use redirect URIs, add the web URL there too.

---

## 5. Smoke test

- [ ] `GET https://YOUR-API/api/health` works  
- [ ] `https://YOUR-WEB` loads the app  
- [ ] Browser Network tab shows API calls to `YOUR-API`, not `localhost`  
- [ ] Login / Google works (origins updated)  
- [ ] No CORS errors in the console  

---

## Rebuild / redeploy tips

| Change | Action |
|--------|--------|
| API code or API env | Redeploy **api** |
| `VITE_*` values | Change vars → **Redeploy web** (must rebuild) |
| DB schema | Push migration → redeploy **api** (migrate runs on boot) |

---

## Common failures (quick fixes)

| Problem | Fix |
|---------|-----|
| Web calls `localhost` | `VITE_API_URL` wrong or not **Available at Build Time** → set + redeploy web |
| CORS blocked | `CLIENT_ORIGIN` must exactly match the web HTTPS URL |
| API crash on boot | Check MySQL reference: `DATABASE_URL` must be a `mysql://…` URL Prisma accepts |
| Redis / OTP fails | Confirm `REDIS_URL` reference from Redis service |
| Healthcheck fails | Confirm Dockerfile path is `apps/api/Dockerfile` and domain is public |
| Google login broken | Add Railway web URL to Google Authorized JavaScript origins |

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
| `apps/api/Dockerfile` | API image + migrate + start |
| `apps/web/Dockerfile` | Vite build + nginx on `$PORT` |
| `apps/api/railway.toml` | Healthcheck / Dockerfile hints |
| `apps/web/railway.toml` | Healthcheck / Dockerfile hints |
| `deploy/railway.env.example` | Env checklist |

That’s the whole Railway path — no Vercel, no cPanel.
