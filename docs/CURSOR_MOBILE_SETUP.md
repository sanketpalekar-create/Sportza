# Cursor Mobile Setup for Sportza

Repo: [github.com/sanketpalekar-create/Sportza](https://github.com/sanketpalekar-create/Sportza)

This repo includes [`.cursor/environment.json`](../.cursor/environment.json) so Cloud Agents use Node 20, pnpm 9.15, and run `pnpm install` + Prisma generate automatically.

---

## Part 1: Connect GitHub in Cursor (desktop)

1. Open **Cursor** on Windows.
2. **Cursor Settings** → **Integrations** (or **Account** → **GitHub**).
3. Click **Connect GitHub** and sign in as `sanketpalekar-create`.
4. Grant access to **Sportza** (or all repos) with **read and write**.
5. Verify: [github.com/settings/installations](https://github.com/settings/installations) → **Cursor** app → includes **Sportza**.

**Requirements:** Same Cursor account on desktop and phone; [Pro plan](https://cursor.com/docs/cloud-agent) (or higher) for Cloud Agents.

---

## Part 2: Cloud environment

After GitHub is connected, the first Cloud Agent on this repo will use:

- [`.cursor/Dockerfile`](../.cursor/Dockerfile) — Node 20 + pnpm 9.15
- [`.cursor/install.sh`](../.cursor/install.sh) — `pnpm install` + `prisma generate`

**Optional secrets** (Cursor Settings → Cloud / Secrets): only needed for API integration tests (MySQL, Redis, Auth0, Razorpay). See [`.env.example`](../.env.example). Do not paste production keys into agent chat.

On first Cloud run, save the **environment snapshot** when prompted for faster future agents.

---

## Part 3: Phone — cursor.com/agents

1. Open **https://cursor.com/agents** (Safari/Chrome).
2. Sign in with the **same** Cursor account as desktop.
3. **New agent** → repo **sanketpalekar-create/Sportza** → branch **main**.
4. Optional PWA: iOS Share → **Add to Home Screen**; Android → **Install app**.

### Starter prompts

| Goal | Prompt |
|------|--------|
| Explore | Explain how venue booking works in `apps/api/src/routes/bookings.ts` and which web code calls it. |
| Web UI | In `apps/web`, add a loading state to the venue list using existing TanStack Query patterns. |
| API | In `apps/api`, add Zod validation for the open-play create endpoint. |
| Mobile | In `apps/mobile`, wire HomeScreen to `@sportza/api-client` for the sports list. |

---

## Part 4: Desktop handoff

After an agent finishes:

```powershell
cd C:\Users\user\Desktop\Sportza
git pull origin main
# or: git fetch origin && git checkout <agent-branch>
pnpm install
docker compose up -d mysql redis
pnpm dev
```

Review the agent diff or PR on GitHub before merging to `main`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Sportza missing in repo list | Reconnect GitHub; confirm Cursor app access to Sportza. |
| Agent won't start | Paid plan; same account on phone and desktop. |
| Build/test fails in cloud | Expected without DB secrets; scope to code-only tasks or add Cloud secrets. |
| PC out of date | `git pull origin main` or checkout the agent branch. |
