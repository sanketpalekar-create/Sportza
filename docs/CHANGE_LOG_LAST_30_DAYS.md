# Change Log — Last 30 Days

## Sportza — Change Log (Mar 18 – Apr 17, 2026)

**Version:** 2.0
**Last updated:** Apr 28, 2026

---

## Evidence and Methodology

> **Note:** This project does not have git version control in the current workspace snapshot. This change log is reconstructed from **best-available local evidence**:
> - Document version headers and `Last updated` fields in `docs/`
> - Filesystem modification timestamps on doc and config files
> - Narrative recorded in `docs/DISCUSSION_LOG.md` (Parts 1, 2, and 3)
> - Feature status entries in `docs/FEATURE_ROLLOUT_AND_TRACKER.md`
>
> Confidence levels per entry: **High** = multiple doc sources agree / **Medium** = single source with strong internal consistency / **Low** = inferred from indirect evidence.

---

## Summary

| Period | Major area | Description |
|--------|-----------|-------------|
| Mar 18–26 | Architecture | Full rebuild as Turborepo monorepo (pnpm), MySQL/Prisma, Auth0 |
| Mar 18–26 | Schema | 45+ Prisma models; VenueDisplay and DisplayPairing added; Sport FK added to 8 models |
| Mar 18–26 | Monetization | Venue and trainer commission system; monthly settlement reports |
| Mar 18–26 | Match scoring | Multi-sport real-time scoring via Socket.io |
| Mar 18–26 | Reviews | VenueReview, TrainerReview with eligibility rules |
| Mar 18–26 | Training | PlayerBatchReview (monthly player reviews by trainer) |
| Mar 18–26 | Scoreboard | Smart Scoreboard product definition; VenueDisplay pairing flow |
| Mar 27 | Infrastructure | Cloudflared tunnel added for dev sharing |
| Apr 16–17 | Documentation | New strategy and planning docs suite; DEPLOYMENT.md refresh |
| Apr 16 | Display & Matchmaking | Scoreboard, display pairing, and matchmaking confirmed as Implemented |

---

## Detailed Change Entries

---

### CL-001 — Full Monorepo Rebuild (Turborepo + pnpm)

**Date:** Mar 2026
**Area:** Architecture / Infrastructure
**Confidence:** High
**Evidence:** `docs/DISCUSSION_LOG.md` Part 3; `docs/BACKEND_ARCHITECTURE.md` v2.0; `docs/TRACEABILITY.md` v1.4; `turbo.json`, `pnpm-workspace.yaml`, `docker-compose.yml` (all dated Mar 26 2026)

**What changed:**

The entire Sportza codebase was rebuilt from scratch as a Turborepo monorepo managed with pnpm. The previous Express + Mongoose (MongoDB) single-repo architecture was replaced.

**New monorepo structure:**

| Package | Technology |
|---------|-----------|
| `apps/web` | React 18 + Vite + Tailwind CSS + Auth0 + TanStack Query |
| `apps/api` | Express + Prisma + Zod + OpenAPI + Redis + BullMQ |
| `packages/tokens` | Design tokens (Tailwind preset) |
| `packages/ui` | Shared component library (9 components) |
| `packages/api-client` | Axios + TanStack Query hooks (40+ hooks) |

**Scope of rewrite:**
- 14 API route files with Zod validation and OpenAPI registration
- 38 frontend pages across all domains
- 7 backend services (bookingConflict, refundService, scoring, matchLogging, tournamentFixtures, openPlayConfirmations, trainerService)
- 2 BullMQ workers (email, refund)
- Docker Compose (4 services: mysql, redis, api, web)

**Database migration:** MongoDB → MySQL 8.0 with Prisma ORM (integer IDs, SQL relations).

**Link to rationale:** [ADR-001](ADR_CHANGE_RATIONALE_LOG.md#adr-001)

---

### CL-002 — Venue and Trainer Commission System

**Date:** Mar 2026
**Area:** Monetization / Backend
**Confidence:** High
**Evidence:** `docs/DISCUSSION_LOG.md` Part 1 (pre-session context); `docs/BRD.md` v1.2 §9 Monetization; `docs/DATA_MODEL.md` v3.1 Booking, BatchPayment models; `docs/IMPLEMENTATION_STATUS.md`

**What changed:**

A full commission and settlement system was designed and implemented.

**Venue commission:**
- `Venue.commissionPercent` set at venue onboarding (0–100)
- Per booking: `Booking.platformCommissionPercent`, `Booking.platformCommissionAmount`, `Booking.venueNetAmount`
- Add-ons are NOT subject to commission; they increase `totalAmount` and `venueNetAmount` only

**Trainer/batch commission:**
- `Batch.commissionPercent` per batch agreement
- `BatchPayment` model: `platformCommissionPercent`, `platformCommissionAmount`, `trainerNetAmount`, `validationStatus`
- POST/GET batch payments: `POST /api/batches/:id/payments`, `GET /api/batches/:id/payments`

**Monthly settlement reports:**
- `GET /api/reports/venues/:venueId/monthly` — venue net revenue and platform commission
- `GET /api/reports/trainers/me/monthly` — trainer net revenue and commission
- `GET /api/reports/trainers/:trainerId/monthly` — admin access
- `GET /api/reports/platform/monthly` — platform-wide (admin; optional `breakdown=venue,trainer`)

**Link to rationale:** [ADR-002](ADR_CHANGE_RATIONALE_LOG.md#adr-002)

---

### CL-003 — Multi-Sport Real-Time Match Scoring

**Date:** Mar 2026
**Area:** Match Engine / Real-time Infrastructure
**Confidence:** High
**Evidence:** `docs/DISCUSSION_LOG.md` Part 1; `docs/DATA_MODEL.md` v3.1 Match model; `docs/BRD.md` v1.2 §4 capability 4; `docs/FEATURE_ROLLOUT_AND_TRACKER.md` ("Live scoring and socket updates: Implemented")

**What changed:**

The match model and scoring engine were extended to support multi-sport score structures with live broadcasting.

**scoreType values:**
- `simple` — basic point tracking (all sports default)
- `cricket` — runs, wickets, overs per innings
- `tennis` — games and sets
- `padel` — games and sets (padel rules)
- `pickleball_rally` — every rally scores
- `pickleball_service` — only server scores; `servingTeam`, `serverNumber` tracked

**Model changes:**
- `Match.scoreType` (String) added
- `Match.scores` (JSON/Mixed) — structure varies by scoreType
- PUT `/api/matches/:id/start` — mark match live
- PUT `/api/matches/:id/scores` — validated update per scoreType
- GET match response now includes `scoreType` and `scoreSummary`

**Socket.io integration:**
- Room: `match:<matchId>`
- Events emitted: `match:score` (score update), `match:status` (start/complete)
- Scoreboard web page subscribes and renders live

**Link to rationale:** [ADR-003](ADR_CHANGE_RATIONALE_LOG.md#adr-003)

---

### CL-004 — Discovery and Ratings (Venue and Trainer Reviews)

**Date:** Mar 2026
**Area:** Discovery / Reviews
**Confidence:** High
**Evidence:** `docs/DISCUSSION_LOG.md` Part 1; `docs/DATA_MODEL.md` v3.1 VenueReview, TrainerReview models; `docs/BRD.md` v1.2 §4 capability 7; `docs/FRD.md`

**What changed:**

Venue and trainer discovery were enhanced with rating and review capabilities.

**VenueReview model:** `userId`, `venueId`, `rating` (1–5), `review` text, `createdAt`
**TrainerReview model:** `userId`, `trainerId`, `trainerProfileId`, `rating` (1–5), `review` text, `createdAt`

**APIs added:**
- `GET /api/venues` and `GET /api/venues/:id` — now include `averageRating`, `reviewCount`
- `GET /api/venues/:id/reviews`, `POST /api/venues/:id/reviews`, `DELETE /api/venues/:id/reviews/me`
- `GET /api/trainers` and `GET /api/trainers/:id` — now include `averageRating`, `reviewCount`
- `GET /api/trainers/:id/reviews`, `POST /api/trainers/:id/reviews`, `DELETE /api/trainers/:id/reviews/me`
- `GET /api/batches/discover` (no auth; sport, city filter) — with trainer averageRating and location
- `POST /api/batches/:id/join` — player self-join

**Trainer review eligibility rule:** A player may submit a trainer review only after completing at least one month in a batch with that trainer. Enforcement: system requires a `PlayerBatchReview` to exist for that trainer-player combination before allowing the `POST /api/trainers/:id/reviews` call.

**Link to rationale:** [ADR-004](ADR_CHANGE_RATIONALE_LOG.md#adr-004)

---

### CL-005 — Trainer Monthly Player Reviews

**Date:** Mar 2026
**Area:** Training / Player Progress
**Confidence:** High
**Evidence:** `docs/DISCUSSION_LOG.md` Part 1; `docs/DATA_MODEL.md` v3.1 PlayerBatchReview model; `docs/FRD.md` FR-BATCH-6a; `docs/FEATURE_ROLLOUT_AND_TRACKER.md` ("Monthly player reviews: Implemented")

**What changed:**

A new monthly review system was added allowing trainers to rate each player per batch per month.

**PlayerBatchReview model:** `batchId`, `playerId`, `trainerId`, `year`, `month`, `ratings` (JSON — e.g. skill, fitness, teamwork, attitude), `comment`

**Uniqueness:** One review per player per batch per month (upsert on year+month+batch+player).

**APIs added:**
- `GET /api/batches/review-parameters` — returns rating categories (skill, fitness, etc.)
- `POST /api/batches/:id/reviews` — trainer submits reviews for all players (body: year, month, reviews array)
- `GET /api/batches/:id/reviews` — trainer reads reviews for the batch
- `GET /api/stats/me/reviews` — player reads their own monthly progress (query: batch, year, month or date range)

**Link to rationale:** [ADR-005](ADR_CHANGE_RATIONALE_LOG.md#adr-005)

---

### CL-006 — Schema: Sport FK Added to 8 Models

**Date:** Mar 2026
**Area:** Data Model / Schema
**Confidence:** High
**Evidence:** `docs/DISCUSSION_LOG.md` Part 3 "Schema improvements"; `docs/DATA_MODEL.md` v3.1 (sportId fields visible across models)

**What changed:**

Previously, the Sport field in many models was stored as a plain `String` with no foreign key integrity. A `sportId` FK (`Int?`) was added to 8 models:

- `Booking.sportId`
- `OpenPlay.sportId`
- `Batch.sportId`
- `Tournament.sportId`
- `Activity.sportId`
- `SportRate.sportId`
- `PlayerStats.sportId`
- `PlayerActivityStats.sportId`

All are nullable (`Int?`) to avoid breaking existing data. The existing `sport String` field is retained alongside for denormalized reads. The `Sport` model's reverse relation count grew from 2 to 10.

**Link to rationale:** [ADR-006](ADR_CHANGE_RATIONALE_LOG.md#adr-006)

---

### CL-007 — Schema: TrainerProfile → TrainerReview Direct Relation

**Date:** Mar 2026
**Area:** Data Model / Schema
**Confidence:** High
**Evidence:** `docs/DISCUSSION_LOG.md` Part 3 "TrainerProfile ↔ TrainerReview direct relation"; `docs/DATA_MODEL.md` v3.1 TrainerReview model

**What changed:**

A direct FK from `TrainerReview` to `TrainerProfile` was added:

- `TrainerReview.trainerProfileId Int?` FK column added
- `TrainerProfile.reviews TrainerReview[]` reverse relation added
- `TrainerProfile.rating` and `reviewCount` can now be computed directly from linked `TrainerReview` records

Previously, reviews could only be joined through the `User` model via `trainerId`. The direct `trainerProfileId` link makes aggregation cleaner and avoids an extra join.

**Link to rationale:** [ADR-007](ADR_CHANGE_RATIONALE_LOG.md#adr-007)

---

### CL-008 — VenueDisplay and DisplayPairing (Scoreboard Pairing Infrastructure)

**Date:** Mar 2026
**Area:** Display / Scoreboard / Data Model
**Confidence:** High
**Evidence:** `docs/DATA_MODEL.md` v3.1 Display/Scoreboard section; `docs/FEATURE_ROLLOUT_AND_TRACKER.md` (Displays: Implemented)

**What changed:**

Two new models were added to support the venue display / scoreboard pairing flow:

**VenueDisplay** — permanent court-level identity:
- `venueId`, `courtName`, `status` (idle/awaiting/live), `currentMatchId`, `lastPingAt`, `createdAt`, `updatedAt`

**DisplayPairing** — dynamic session token:
- `displayId`, `token` (UK — 48-char hex), `matchId`, `claimedAt`, `expiresAt`, `createdAt`

**Pairing flow:**
1. Venue owner generates a pairing session → fresh `DisplayPairing` with a unique token
2. TV browser opens `/display/pair/:token` — joins socket room `pairing:<token>`
3. Phone user scans QR → opens `/claim/:token` → selects match → calls `POST /api/displays/claim/:token`
4. Server marks `DisplayPairing.claimedAt`, sets `VenueDisplay.currentMatchId = matchId`, emits `display:paired`
5. TV navigates to `/scoreboard/:matchId`

Old unclaimed pairings for the same court are expired when a new pairing is generated.

**APIs added:** `/api/displays/*` route family (generate, claim, status)

**Link to rationale:** [ADR-008](ADR_CHANGE_RATIONALE_LOG.md#adr-008)

---

### CL-009 — Smart Scoreboard Product Definition

**Date:** Mar 2026
**Area:** Product / Planning
**Confidence:** High
**Evidence:** `docs/DISCUSSION_LOG.md` Part 3 "Smart Scoreboard — Product Definition"; `docs/FUTURE_DEVELOPMENT.md` v2.1 Section 4

**What changed:**

The Smart Scoreboard was fully defined as a product — hardware choice, UX philosophy, monetisation strategy, build phases, and dependency chain — and documented in `FUTURE_DEVELOPMENT.md`.

**Key decisions locked:**

| Decision | Outcome |
|----------|---------|
| Hardware | Smart TV / Android TV in kiosk mode (no custom hardware) |
| Display type | Web page at `/scoreboard/:matchId` (fullscreen, TV-optimised) |
| Scoring | Manual 1-tap with live feel — not AI/sensor auto-scoring |
| Court mapping | 1 court = 1 display = 1 active match |
| UI philosophy | Glanceable reference, not entertainment |
| Monetisation path | Free Phase 1 → SaaS ₹999–₹2,499/month/screen Phase 2 |
| Ads policy | Never forced; venue-controlled first; revenue-share opt-in later |
| Phase 1 de-scope | No dashboard, no hardware, no multi-court view, no AI |

**Link to rationale:** [ADR-009](ADR_CHANGE_RATIONALE_LOG.md#adr-009)

---

### CL-010 — Cloudflared Tunnel Added

**Date:** Mar 27, 2026
**Area:** Infrastructure / Developer Experience
**Confidence:** Medium
**Evidence:** `cloudflared.exe` filesystem timestamp Mar 27, 2026; `DEPLOYMENT.md` (root) updated Apr 17, 2026 (likely includes tunnel guidance)

**What changed:**

`cloudflared.exe` was added to the project root, enabling the Cloudflare Tunnel tool for exposing the local development server to the internet without manual port forwarding or NAT configuration.

**Use case:** Allows sharing a live dev build with external stakeholders (e.g. for demos, QA reviews) by creating a secure HTTPS tunnel to `localhost`.

**Link to rationale:** [ADR-010](ADR_CHANGE_RATIONALE_LOG.md#adr-010)

---

### CL-011 — New Product Strategy and Planning Documentation Suite

**Date:** Apr 16, 2026
**Area:** Documentation / Product Management
**Confidence:** High
**Evidence:** Filesystem timestamps Apr 16, 2026 on all five files; content cross-references match current product state

**What changed:**

Five new management and product documentation files were created, and TRACEABILITY.md was updated to v1.4 to index them:

| Document | Purpose |
|----------|---------|
| `FEATURE_ROLLOUT_AND_TRACKER.md` | 7-phase rollout plan + feature-level status tracker with depth ratings |
| `PRODUCT_MASTER_PLAN.md` | Portfolio-level product plan: vision, personas, KPIs, planning gaps |
| `PRODUCT_PROGRESS_HISTORY.md` | Management-facing narrative of what is done, in progress, and planned |
| `PRODUCT_OPTIMIZATION_PLAN.md` | Improvement and optimization priorities across product, UX, operations, monetization |
| `MARKET_RESEARCH_AND_STRATEGY.md` | Market landscape, customer segments, competitive framing, GTM direction |

**TRACEABILITY.md updated:** Version bumped to 1.4 with all new docs added to the index table.
**README.md updated:** Root-level readme refreshed Apr 16.
**package.json updated:** Root package.json touched Apr 16 (likely version or script changes).

**Link to rationale:** [ADR-011](ADR_CHANGE_RATIONALE_LOG.md#adr-011)

---

### CL-012 — Display and Matchmaking Confirmed as Implemented

**Date:** Apr 2026
**Area:** Display / Social / Feature Status
**Confidence:** High
**Evidence:** `docs/FEATURE_ROLLOUT_AND_TRACKER.md` Apr 16, 2026

**What changed:**

The April tracker update confirmed the following features as fully Implemented (previously unconfirmed or in flight):

| Feature | Status confirmed |
|---------|----------------|
| Scoreboard page | Implemented |
| Pair / claim display flows | Implemented |
| Venue display management | Implemented |
| Matchmaking suggestions | Implemented (Medium depth) |

This means the `VenueDisplay` / `DisplayPairing` data model, `/scoreboard/:matchId` web page, socket-based pairing, and matchmaking API are all live in the codebase.

**Link to rationale:** [ADR-012](ADR_CHANGE_RATIONALE_LOG.md#adr-012)

---

### CL-013 — Root DEPLOYMENT.md Refreshed

**Date:** Apr 17, 2026
**Area:** Operations / Documentation
**Confidence:** High
**Evidence:** Filesystem timestamp Apr 17, 2026 on root-level `DEPLOYMENT.md`

**What changed:**

The root-level `DEPLOYMENT.md` was updated (most recent file change in the entire workspace). This document covers production deployment: environment variables, build steps, health checks, Razorpay webhook, PM2/nginx options, and (likely) cloudflared tunnel guidance added after CL-010.

**Link to rationale:** [ADR-013](ADR_CHANGE_RATIONALE_LOG.md#adr-013)

---

### CL-014 — Peer Invites Feature Scoped and Planned

**Date:** Apr 2026
**Area:** Social / Community
**Confidence:** Medium
**Evidence:** `docs/FEATURE_ROLLOUT_AND_TRACKER.md` ("Peer invites: Planned, Medium depth"); Cursor plan file referenced in multiple docs

**What changed:**

Peer Invites was scoped as the next community release target. A Cursor planning artifact was created (`peer_invite_feature_c9279b5d.plan.md`) and the feature was formally tracked in the rollout tracker.

**Current scope gaps (as documented):**
- Delivery mechanism not finalized
- Reminder policy and anti-spam rules needed
- Metrics for measuring peer invite effectiveness not yet defined
- Implementation not yet started

**Link to rationale:** [ADR-014](ADR_CHANGE_RATIONALE_LOG.md#adr-014)

---

## Change Inventory by Document

| Document | Version (before) | Version (after) | Type of change |
|----------|-----------------|----------------|----------------|
| `docs/DATA_MODEL.md` | 2.2 (pre-Mar) | 3.1 (Mar 2026) | VenueDisplay, DisplayPairing, Sport FKs, TrainerProfile relation, domain ER diagrams |
| `docs/BRD.md` | 1.0 (pre-Mar) | 1.2 (Mar 2026) | Player discovery, real-time scoring, trainer monthly reviews added |
| `docs/FRD.md` | 1.0 (pre-Mar) | 1.2 (Mar 2026) | FR-BATCH-6a (trainer review eligibility), Reports API row added |
| `docs/BACKEND_ARCHITECTURE.md` | unknown | 2.0 (Mar 2026) | Full rewrite for Turborepo monorepo |
| `docs/FUTURE_DEVELOPMENT.md` | unknown | 2.1 (Mar 2026) | Smart Scoreboard product definition (Section 4) |
| `docs/TRACEABILITY.md` | 1.0–1.3 | 1.4 (Apr 2026) | New docs indexed; version table updated |
| `docs/FEATURE_ROLLOUT_AND_TRACKER.md` | n/a | 1.0 (Apr 2026) | New document |
| `docs/PRODUCT_MASTER_PLAN.md` | n/a | 1.0 (Apr 2026) | New document |
| `docs/PRODUCT_PROGRESS_HISTORY.md` | n/a | 1.0 (Apr 2026) | New document |
| `docs/PRODUCT_OPTIMIZATION_PLAN.md` | n/a | 1.0 (Apr 2026) | New document |
| `docs/MARKET_RESEARCH_AND_STRATEGY.md` | n/a | 1.0 (Apr 2026) | New document |
| `DEPLOYMENT.md` (root) | unknown | current (Apr 17 2026) | Refreshed; likely cloudflared guidance added |
| `README.md` | unknown | current (Apr 16 2026) | Refreshed |

---

## Known Gaps and Limitations

| Gap | Notes |
|-----|-------|
| No git history | Exact commit dates, authors, and per-file diffs are not available in this workspace |
| HTML companion files | `docs/*.html` files were not regenerated after Mar 26 Markdown updates — they may be stale |
| FRD.md detailed version | FRD is listed as v1.2 in the TRACEABILITY index table but internal header should be verified |
| Socket.io migration status | `FUTURE_DEVELOPMENT.md` Section 4.7 says Socket.io is "Not yet implemented" (written Mar 2026) but FEATURE_ROLLOUT_AND_TRACKER.md (Apr 2026) marks it as Implemented — the FUTURE_DEVELOPMENT.md dependency table needs updating |
| IMPLEMENTATION_STATUS.md model count | Lists 45 models; DATA_MODEL.md documents 47 (VenueDisplay, DisplayPairing added post-writeup) |

---

## References

- `docs/DISCUSSION_LOG.md`
- `docs/FEATURE_ROLLOUT_AND_TRACKER.md`
- `docs/DATA_MODEL.md`
- `docs/TRACEABILITY.md`
- `docs/ADR_CHANGE_RATIONALE_LOG.md` (new)


---

## Apr 27–28, 2026 Sprint Additions

---

### CL-015 — ELO-Based Sportza Rating System

**Date:** Apr 27–28, 2026
**Area:** Rating / ELO / Data Model / Workers
**Confidence:** High
**Evidence:** pps/api/src/services/elo.ts; pps/api/src/workers/ratingDriftWorker.ts; pps/api/prisma/schema.prisma (SportSkillRating, RatingHistory); docs/RATING_SYSTEM.md v3.0

**What changed:**

A full sport-skill rating system (inspired by ELO) was implemented from scratch. Every registered user now has a SportSkillRating record per sport/format, initialised at 1000 on signup or first login.

**Core formula — calcNewRating (7 factors):**

| Factor | Description |
|--------|-------------|
| Result | 1 = win, 0.5 = draw, 0 = loss |
| Expected score | Standard ELO probability using opponent avg rating |
| Base K factor | 32, scaled by confidence tier |
| Confidence multiplier | Provisional (0–9 matches) 1.5×, Regular (10–29) 1.0×, Established (30+) 0.7× |
| MOV (Margin of Victory) | Normalised 0–1; reduces swing for lopsided wins |
| Team size | Solo = full impact; each extra teammate reduces weight (÷ playerCount) |
| Rating gap dampener | If winning by >400 pts, award is capped at 50% base to prevent farming |

**Anti-manipulation:**
- Daily gain cap: +80 pts max per calendar day
- Smurf dampener: detected smurf accounts get 0.6× K

**Passive drift:** 
atingDriftWorker runs monthly via BullMQ, pulling every rating 0.5% towards 1000 and writing a RatingHistory delta entry.

**Matchmaking gate:** OpenPlay and Batch now have skillRatingMin / skillRatingMax fields for skill-band filtering.

**Link to rationale:** [ADR-015](ADR_CHANGE_RATIONALE_LOG.md#adr-015)

---

### CL-016 — Peer Invites (Implemented)

**Date:** Apr 27–28, 2026
**Area:** Social / Peer Play
**Confidence:** High
**Evidence:** pps/api/src/routes/peer-invites.ts; pps/web/src/pages/matchmaking/PeerInvites.tsx; pps/web/src/components/matchmaking/PeerInviteSheet.tsx; pps/api/prisma/schema.prisma (PeerPlayInvite model)

**What changed:**

Peer Invites — previously only scoped (CL-014) — was fully implemented.

**API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/peer-invites | Send a new invite (with conflict-check) |
| GET | /api/peer-invites/received | Inbox: invites you received |
| GET | /api/peer-invites/sent | Outbox: invites you sent |
| PATCH | /api/peer-invites/:id/respond | Accept or decline |
| PATCH | /api/peer-invites/:id/cancel | Cancel as sender |

**Schema (PeerPlayInvite):** senderId, receiverId, sportId, sport, message (≤1000 chars), proposedDate, proposedStartTime, proposedEndTime, status (pending/accepted/declined/cancelled/expired), respondedAt.

**Business rules:** Only one pending invite per sender-receiver-sport combination at a time; only the sender can cancel; only the receiver can respond.

**Frontend:** PeerInvites.tsx page with tabbed Inbox/Sent views; PeerInviteSheet.tsx bottom sheet for composing invites.

**Link to rationale:** [ADR-016](ADR_CHANGE_RATIONALE_LOG.md#adr-016)

---

### CL-017 — Matchmaking Fully Rebuilt (Rating-Aware)

**Date:** Apr 27–28, 2026
**Area:** Matchmaking / Discovery / Social
**Confidence:** High
**Evidence:** pps/api/src/routes/matchmaking.ts; pps/api/src/services/connections.ts; pps/web/src/pages/matchmaking/MatchmakingSuggestions.tsx

**What changed:**

The matchmaking API was rebuilt from medium-depth suggestions to a comprehensive, rating-aware system.

**New endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/matchmaking/suggestions | Skill-band filtered player suggestions (sport/format) |
| GET | /api/matchmaking/network | Social graph: recently played, frequent opponents, venue connections, nearby |
| GET | /api/matchmaking/skill-rating | Current user's skill ratings (all sports) |
| GET | /api/matchmaking/rating-history | Paginated rating history with delta/activity |
| POST | /api/matchmaking/initialize-ratings | Seed SportSkillRating rows for all sports on demand |

**Suggestion algorithm:** Filters by sport, format; sorts candidates by rating proximity to the requesting user; excludes already-connected and blocked players.

**Link to rationale:** [ADR-017](ADR_CHANGE_RATIONALE_LOG.md#adr-017)

---

### CL-018 — Player Network / Social Graph (PlayerConnection)

**Date:** Apr 27–28, 2026
**Area:** Social / Data Model / Services
**Confidence:** High
**Evidence:** pps/api/src/services/connections.ts; pps/api/prisma/schema.prisma (PlayerConnection model)

**What changed:**

A bidirectional PlayerConnection graph was introduced to power the matchmaking network endpoint.

**PlayerConnection schema:** userId, connectedUserId, connectionType (match / open_play / venue), playCount (incremented on each shared activity), lastActivityAt, venueId (optional anchor for venue-type connections).

**connections.ts service:**
- upsertConnection(userA, userB, type, venueId?) — idempotent upsert; increments playCount and refreshes lastActivityAt on each shared activity
- Connections are bidirectional: one record per pair (lower userId always in the userId field)

**Integration:** Called from match scoring, open play join, and batch session flows to automatically maintain the graph without any manual player action.

**Link to rationale:** [ADR-018](ADR_CHANGE_RATIONALE_LOG.md#adr-018)

---

### CL-019 — In-App Notification System

**Date:** Apr 27–28, 2026
**Area:** Notifications / API / Frontend
**Confidence:** High
**Evidence:** pps/api/src/routes/notifications.ts; pps/api/src/services/notificationService.ts; pps/web/src/pages/Notifications.tsx; pps/api/prisma/schema.prisma (Notification model)

**What changed:**

A full in-app notification system was built.

**API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/notifications/unread-count | Fast integer count for badge rendering |
| GET | /api/notifications | Paginated list (with unread count in response) |
| PATCH | /api/notifications/read-all | Mark all as read |
| PATCH | /api/notifications/:id/read | Mark single notification as read |
| DELETE | /api/notifications/:id | Delete a notification |

**Notification schema:** userId, type, title, body, data (JSON blob for deep-link metadata), isRead, readAt.

**
otificationService.ts:** Provides createNotification(userId, type, title, body, data?) helper called from other service layers (peer invite accept, batch booking confirmation, etc.).

**Frontend:** Notifications.tsx page with grouped list, unread badge, and mark-all-read action.

**Link to rationale:** [ADR-019](ADR_CHANGE_RATIONALE_LOG.md#adr-019)

---

### CL-020 — Frontend Multi-Sport Scoring Engine

**Date:** Apr 27–28, 2026
**Area:** Frontend / Match Scoring / UX
**Confidence:** High
**Evidence:** pps/web/src/lib/scoring/ directory (11 engine files); pps/web/src/pages/matches/ScoreMatch.tsx; pps/web/src/pages/matches/Scoreboard.tsx

**What changed:**

A typed frontend scoring engine library was built under pps/web/src/lib/scoring/, replacing ad-hoc scoring logic.

**Engines implemented (one file each):**

| Sport | File | Notes |
|-------|------|-------|
| Tennis | 	ennis.ts | Sets/games/points with deuce/ad |
| Badminton | adminton.ts | 21-pt rally scoring, 3-game format |
| Squash | squash.ts | 11-pt PAR, best-of-5 |
| Table Tennis | 	abletennis.ts | 11-pt, best-of-5/7 |
| Volleyball | olleyball.ts | 25-pt rally, 5th set to 15 |
| Basketball | asketball.ts | Timed periods, running score |
| Football | ootball.ts | Timed match, goals |
| Cricket | cricket.ts | Overs/balls/wickets, innings logic |
| Pickleball Rally | pickleballRally.ts | 11-pt rally |
| Pickleball Service | pickleballService.ts | Traditional side-out scoring |
| Simple | simple.ts | Generic point-based fallback |

**ScoreMatch.tsx:** Dynamically selects the correct engine by sport; renders a touch-friendly scoring UI with real-time state.
**Scoreboard.tsx:** Display-optimised fullscreen view receiving score updates via Socket.io.

**Link to rationale:** [ADR-020](ADR_CHANGE_RATIONALE_LOG.md#adr-020)

---

### CL-021 — Auth Enhancements (Password Reset, Refresh Tokens)

**Date:** Apr 27–28, 2026
**Area:** Authentication / Security
**Confidence:** High
**Evidence:** pps/api/src/routes/auth.ts (updated Apr 28); pps/web/src/pages/ForgotPassword.tsx; pps/web/src/pages/ResetPassword.tsx; pps/api/prisma/schema.prisma (RefreshToken model)

**What changed:**

The authentication system was extended with two major additions:

**1. Password Reset Flow:**
- POST /api/auth/forgot-password — sends a time-limited reset link to the user's email
- POST /api/auth/reset-password — validates token, hashes new password, invalidates all refresh tokens for the user
- ForgotPassword.tsx and ResetPassword.tsx frontend pages added

**2. Refresh Token Support:**
- POST /api/auth/refresh — exchanges a valid refresh token for a new access token
- RefreshToken model: userId, token (hashed), expiresAt, revokedAt, userAgent, ipAddress
- Logout now revokes the refresh token in addition to clearing the session

**Security properties:** Reset tokens are short-lived (15 min); refresh tokens are long-lived (7 days) but rotated on each use (rotation prevents replay); all tokens are stored hashed.

**Link to rationale:** [ADR-021](ADR_CHANGE_RATIONALE_LOG.md#adr-021)

---

### CL-022 — WhatsApp Integration (Deep-Link Bridge)

**Date:** Apr 27–28, 2026
**Area:** Communications / Notifications / Trainer UX
**Confidence:** High
**Evidence:** pps/api/src/services/whatsappBridge.ts; pps/web/src/lib/whatsappClient.ts

**What changed:**

A WhatsApp deep-link bridge was added to enable quick reminder and progress-share actions without a WhatsApp Business API subscription.

**whatsappBridge.ts (backend):** Generates https://wa.me/<phone>?text=<encoded> URLs for three templates:
- **Payment reminder** — batch fee due, amount, due date, payment link
- **Session reminder** — upcoming training session details
- **Progress share** — public progress URL for player to share with contacts

**whatsappClient.ts (frontend):** Thin wrapper that calls the backend URL generator and then opens the resulting link in a new tab (window.open).

**Design choice:** Deep-link only (no outbound API calls from server). The trainer or admin clicks a button; their own WhatsApp client sends the message. Zero cost, zero compliance risk for Phase 1.

**Link to rationale:** [ADR-022](ADR_CHANGE_RATIONALE_LOG.md#adr-022)

---

### CL-023 — New Frontend Pages Batch (22+ pages)

**Date:** Apr 27–28, 2026
**Area:** Frontend / UX
**Confidence:** High
**Evidence:** pps/web/src/pages/ directory scan; new .tsx files with Apr 27–28 timestamps

**What changed:**

22+ new React pages were added, taking the total from ~38 pages to 60+.

**By area:**

| Area | New Pages |
|------|-----------|
| Auth | ForgotPassword.tsx, ResetPassword.tsx |
| Player | ProfileEdit.tsx, Settings.tsx, PlayerProfile.tsx, PublicPlayerProgress.tsx, Privacy.tsx |
| Matchmaking | MatchmakingSuggestions.tsx, PeerInvites.tsx |
| Matches | ScoreMatch.tsx, Scoreboard.tsx, MatchSumula.tsx |
| Tournaments | TournamentRegister.tsx, TournamentSpectator.tsx, EditTournament.tsx |
| Venue Owner | MyVenues.tsx, CreateVenue.tsx, VenueDetailOwner.tsx, VenueCalendar.tsx, VenueSchedule.tsx, VenueDisplays.tsx, VenueReports.tsx, VenueBookingDetail.tsx |
| Trainer | TrainerProfile.tsx, TrainerBatchCalendar.tsx, PlayerProgressCard.tsx |
| Stats | ProgressRadarChart component |
| Notifications | Notifications.tsx |

**Link to rationale:** [ADR-023](ADR_CHANGE_RATIONALE_LOG.md#adr-023)

---

### CL-024 — Schema: 6 New Prisma Models

**Date:** Apr 27–28, 2026
**Area:** Data Model / Schema
**Confidence:** High
**Evidence:** pps/api/prisma/schema.prisma (all models with Apr 28 timestamp)

**What changed:**

Six new models were added to the Prisma schema, plus significant extensions to the User, OpenPlay, and Batch models.

**New models:**

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| SportSkillRating | userId, sportId, formatName, rating, matchesPlayed, winsCount, totalMOVSum, confidence | Per-user per-sport ELO rating |
| RatingHistory | userId, sportId, oldRating, newRating, delta, activityId | Audit log of every rating change |
| PlayerConnection | userId, connectedUserId, connectionType, playCount, lastActivityAt | Bidirectional social graph |
| PeerPlayInvite | senderId, receiverId, sportId, status, proposedDate/Time | Peer-to-peer play invitations |
| Notification | userId, type, title, body, data JSON, isRead, readAt | In-app notifications |
| RefreshToken | userId, token, expiresAt, revokedAt, userAgent, ipAddress | JWT refresh token store |

**User model additions:** Relations to all 6 new models (skillRatings, ratingHistory, playerConnections, sentPeerInvites, receivedPeerInvites, notifications, refreshTokens).

**OpenPlay + Batch additions:** skillRatingMin Int? and skillRatingMax Int? for skill-band filtering.

**Total model count:** 47 → 53.

**Link to rationale:** [ADR-024](ADR_CHANGE_RATIONALE_LOG.md#adr-024)

---

### CL-025 — Production Deployment Scripts (Ubuntu VPS)

**Date:** Apr 27–28, 2026
**Area:** Infrastructure / DevOps / Operations
**Confidence:** High
**Evidence:** deploy/deploy.sh, deploy/setup-nginx.sh, deploy/bootstrap.sh

**What changed:**

A complete production deployment automation suite was added under deploy/:

| Script | Purpose |
|--------|---------|
| ootstrap.sh | One-time server bootstrap: installs Node, pnpm, MySQL, Redis, Nginx, PM2, certbot |
| setup-nginx.sh | Generates and installs Nginx server block for the API and web app with SSL |
| deploy.sh | Full deploy: git pull → pnpm install → Prisma migrate → build → PM2 restart |

**Deployment flow:**
1. ootstrap.sh run once on a fresh Ubuntu 22.04 VPS
2. setup-nginx.sh configures reverse proxy (/api → Express port 3000; / → Vite static or SSR)
3. deploy.sh is the ongoing CI/CD entry point (can be called from GitHub Actions or manually)

**Link to rationale:** [ADR-025](ADR_CHANGE_RATIONALE_LOG.md#adr-025)

---

### CL-026 — New Workers, Infrastructure, and Utility Routes

**Date:** Apr 27–28, 2026
**Area:** Backend Infrastructure / Workers / Routes
**Confidence:** High
**Evidence:** pps/api/src/workers/holdCleanupWorker.ts; pps/api/src/routes/schedules.ts; pps/api/src/routes/public.ts; pps/api/src/lib/bookingHelpers.ts; pps/api/src/lib/tournament-player-stats.ts; pps/api/src/lib/progressShareToken.ts; pps/api/src/lib/socket.ts

**What changed:**

Several backend infrastructure components were added to support new and existing features:

**Workers:**

| Worker | Purpose |
|--------|---------|
| 
atingDriftWorker.ts | Monthly BullMQ job: 0.5% pull of all skill ratings toward 1000 |
| holdCleanupWorker.ts | BullMQ job: cleans up expired booking holds (payments that timed out without completion) |

**New routes:**

| Route file | Purpose |
|-----------|---------|
| schedules.ts | Venue schedule management endpoints (availability windows, slot generation) |
| public.ts | Unauthenticated public endpoints (venue discovery, player public profiles, progress share by token) |

**New lib files:**

| File | Purpose |
|------|---------|
| socket.ts | Socket.io server singleton setup and room management helpers |
| ookingHelpers.ts | Shared logic for slot availability checks, hold creation, and conflict detection |
| 	ournament-player-stats.ts | Stat aggregation: W/L, points, NRR, goals etc. across tournament formats |
| progressShareToken.ts | Generates and validates time-limited public-share tokens for player progress pages |

**Link to rationale:** [ADR-026](ADR_CHANGE_RATIONALE_LOG.md#adr-026)

---

## Updated Change Inventory by Document (as of Apr 28, 2026)

| Document | Version (before) | Version (after) | Type of change |
|----------|-----------------|----------------|----------------|
| docs/DATA_MODEL.md | 2.2 (pre-Mar) | 3.3 (Apr 2026) | +6 new models, User/OpenPlay/Batch extensions |
| docs/BRD.md | 1.0 (pre-Mar) | 1.3 (Apr 2026) | Player discovery, rating system, peer invites |
| docs/BACKEND_ARCHITECTURE.md | unknown | 2.2 (Apr 2026) | New routes, services, workers, lib files |
| docs/IMPLEMENTATION_STATUS.md | 45 models | 53 models (Apr 2026) | +6 models, +22 pages, +6 routes, +2 workers |
| docs/FUTURE_DEVELOPMENT.md | 2.1 (Mar) | 2.3 (Apr 2026) | Peer invites, notifications moved to implemented |
| docs/FEATURE_ROLLOUT_AND_TRACKER.md | 1.0 (Apr) | updated Apr 2026 | Peer invites + rating system + matchmaking updated |
| docs/TRACEABILITY.md | 1.5 | 1.6 (Apr 2026) | RATING_SYSTEM.md added; all versions refreshed |
| docs/RATING_SYSTEM.md | n/a | 3.0 (Apr 2026) | New document — ELO formula + factors + models |
