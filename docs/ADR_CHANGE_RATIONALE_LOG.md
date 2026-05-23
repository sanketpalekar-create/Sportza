# ADR Change Rationale Log — Sportza

**Version:** 1.0
**Last updated:** Apr 2026

This document records the **thinking and reasoning behind every significant change or enhancement** made to the Sportza platform. Each entry follows the Architecture Decision Record (ADR) format:

- **Context** — what situation or problem drove the need for this decision
- **Decision** — what was chosen and why
- **Consequences** — what this change enables, what trade-offs were accepted, and what remains as follow-up

Each entry cross-links to the corresponding entry in [`CHANGE_LOG_LAST_30_DAYS.md`](CHANGE_LOG_LAST_30_DAYS.md).

---

## ADR-001 — Full Monorepo Rebuild (Turborepo + pnpm)

**Change log ref:** [CL-001](CHANGE_LOG_LAST_30_DAYS.md#cl-001)
**Date:** Mar 2026
**Status:** Accepted

### Context

The original Sportza codebase was a single Express + Mongoose (MongoDB) application. As the product scope grew — adding trainer, venue-owner, tournament, and stats surfaces — the codebase became difficult to manage:

- No clean boundary between shared UI logic and page-level logic
- No shared type safety between frontend and backend
- Ad hoc API client code duplicated across frontend pages
- No standard for design tokens or component reuse
- Deployment and infrastructure were informal and hard to reproduce

The product also needed to move from MongoDB to a relational database to support payment audit trails, commission ledgers, and referential integrity across booking → payment → refund chains.

### Decision

Rebuild the entire codebase from scratch as a **Turborepo monorepo** managed with pnpm. Choose a fresh-start approach over incremental migration.

**Stack decisions made as part of this:**

| Concern | Choice | Reasoning |
|---------|--------|-----------|
| Frontend | React 18 + Vite | Performance, ecosystem maturity |
| Styling | Tailwind CSS | Utility-first, design system friendly |
| Auth | Auth0 | Outsource auth complexity; supports OTP, social, JWT |
| State / data | TanStack Query | Caching, loading states, and mutations handled cleanly |
| Backend | Express + Zod | Lightweight, well-understood; Zod gives runtime + type safety |
| ORM | Prisma | Type-safe SQL queries; migration-first schema management |
| Database | MySQL | ACID transactions for payment flows; structured foreign keys |
| Jobs | BullMQ + Redis | Reliable async jobs for emails and refunds |
| Docs | OpenAPI | Auto-generated spec from route registrations; `/api/docs` UI |
| Shared packages | packages/tokens, packages/ui, packages/api-client | Enforce consistency; eliminate duplication |

**Why fresh start over migration:** The data model change (MongoDB → MySQL) was fundamental enough that a migration would require writing and running complex transformation scripts while trying to keep a hybrid system running. A clean rewrite produced a more consistent and testable result.

### Consequences

**Positive:**
- Single source of truth for types across API and web
- OpenAPI spec is always in sync with the actual route implementations
- Docker Compose gives reproducible local and production setup
- Shared `packages/ui` enforces consistent design across all surfaces
- `packages/api-client` hooks reduce per-page data fetching boilerplate

**Trade-offs accepted:**
- Large upfront investment; total feature parity required 7 discrete phases
- Some features from the old codebase were not ported immediately (Socket.io real-time, open-play T-30 cron, SMS OTP, edit profile, settings, split payments UI)
- Migration backlog was formally captured in `FUTURE_DEVELOPMENT.md` Section 1 to ensure nothing is forgotten

**Follow-up required:**
- Open-play T-30 confirmation BullMQ scheduled job (listed in migration backlog)
- Edit Profile and Settings screens
- SMS OTP via Auth0

---

## ADR-002 — Venue and Trainer Commission System

**Change log ref:** [CL-002](CHANGE_LOG_LAST_30_DAYS.md#cl-002)
**Date:** Mar 2026
**Status:** Accepted

### Context

Sportza's monetization model depends on taking a commission from both venue bookings and trainer batch fees. Without a formal commission model in the data layer, every payment calculation would require manual reconciliation — making monthly settlement error-prone and unsustainable as the number of venues and trainers grows.

There was also a design question: should add-ons (beverages, equipment rental) be subject to commission? Applying commission to add-ons would penalize venues for offering extra services and would create a disincentive to expand add-on catalogs.

### Decision

**Commission applies to base booking amount only — not add-ons.**

For each booking:
- `platformCommissionPercent` and `platformCommissionAmount` are computed and stored on the `Booking` row at the time of payment
- `venueNetAmount` = `totalAmount` (base) − `platformCommissionAmount` + add-on revenue (add-ons go entirely to venue)

For each batch fee payment:
- `BatchPayment` stores `platformCommissionPercent`, `platformCommissionAmount`, `trainerNetAmount`
- This makes each payment record self-describing for settlement without needing to re-derive amounts

**Monthly reports are time-bucketed by calendar month**, not rolling 30 days. This aligns with how venues and trainers expect to receive their statements.

### Consequences

**Positive:**
- Each booking and batch payment row is a complete settlement record — no need for post-processing to determine what goes to the venue/trainer
- Calendar-month bucketing matches industry norm; venues can reconcile against bank statements
- Add-on revenue fully accruing to the venue is a selling point for venue adoption
- Admin can view platform-wide commission in one API call with optional breakdown

**Trade-offs accepted:**
- Commission percent is stored at time of booking (snapshot), not always derived from current Venue config — this is correct behavior (historical records must not change if commission rate changes later) but may confuse if rate changes are not communicated clearly
- Batch `validationStatus` on `BatchPayment` suggests offline payment validation flow; this adds operational complexity (someone must mark payments as validated)

**Follow-up required:**
- Commission rate change audit trail (who changed it and when)
- Collections reminder for batch payments not yet validated
- Dashboard layer above the monthly reports API

---

## ADR-003 — Multi-Sport Real-Time Match Scoring

**Change log ref:** [CL-003](CHANGE_LOG_LAST_30_DAYS.md#cl-003)
**Date:** Mar 2026
**Status:** Accepted

### Context

Match scoring was previously stored as a generic JSON blob with no structure validation. This meant:
- Scores for a cricket match looked the same as scores for a football match at the schema level
- No server-side validation of whether a score update was valid for the sport
- No live broadcasting of score changes (clients had to poll)

The product vision requires the scoreboard to feel live and to work across all major sports. A single generic score field cannot support this.

### Decision

Introduce a `scoreType` discriminator field on `Match` to select the score structure and validation logic:

- `simple`, `cricket`, `tennis`, `padel`, `pickleball_rally`, `pickleball_service`
- The `scoring` service validates each PUT `/api/matches/:id/scores` payload against the selected scoreType
- Score type is set at match creation and cannot change mid-match

**Use Socket.io** for broadcasting score updates, not polling:
- Room: `match:<matchId>` (each match is its own Socket room)
- Events: `match:score` (score update), `match:status` (start/complete)
- The scoreboard web page subscribes to the room and updates without page reload

### Consequences

**Positive:**
- Sport-specific scoring structures are validated at the API layer — invalid score formats are rejected before persisting
- Sub-second score updates from player's phone to scoreboard screen
- The same Socket infrastructure later doubles as the scoreboard display channel (CL-008)
- `scoreSummary` in the GET match response allows frontends to show a human-readable summary without parsing raw scores JSON

**Trade-offs accepted:**
- scoreType validation adds complexity to the scoring service; each new sport format requires a new validation branch
- Socket.io adds a stateful server-side concern; horizontal scaling requires sticky sessions or a Redis adapter
- pickleball service mode (tracking `servingTeam` and `serverNumber`) is more complex than typical scoring and requires UI support

**Follow-up required:**
- Redis Socket.io adapter for multi-instance deployments
- Score undo / correction flow (currently scores can only go up or be overwritten)
- Spectator view (non-scorer read-only scoreboard session)

---

## ADR-004 — Discovery and Ratings (Venue and Trainer Reviews)

**Change log ref:** [CL-004](CHANGE_LOG_LAST_30_DAYS.md#cl-004)
**Date:** Mar 2026
**Status:** Accepted

### Context

Sportza's discovery surfaces (venue list, trainer list) showed raw venue and trainer data without trust signals. Players had no way to compare venues or trainers beyond location and price. This made the platform feel like a bare catalog rather than a trusted marketplace.

An uncontrolled review system (let anyone review anyone at any time) would produce gaming, fake reviews, and unfair ratings — especially for trainers who have ongoing batch relationships with their players.

### Decision

Add `VenueReview` and `TrainerReview` models with `averageRating` and `reviewCount` computed on the venue and trainer profile.

**For venue reviews:** Any user may review any venue at any time. The only guard is uniqueness (one review per user per venue).

**For trainer reviews:** A player may only submit a review after completing at least one month in a batch with that trainer. The enforcement mechanism uses `PlayerBatchReview` — if the trainer has submitted at least one monthly review for the player (proving ≥1 month of relationship), the review endpoint unlocks.

**Why this specific eligibility rule:** Using `PlayerBatchReview` as the gate rather than checking date-arithmetic on `BatchMembership.joinDate` means the system only unlocks the review when the trainer has actively engaged with the player. A player who joined but never attended would not be able to review the trainer. This is a better signal of a real relationship.

### Consequences

**Positive:**
- Trust signals on discovery surfaces drive conversion — a venue with 4.8 stars and 200 reviews is more likely to get bookings
- Trainer review eligibility rule protects trainers from unfair reviews by disengaged players
- Review moderation surface exists (DELETE endpoint allows review removal; admin can target specific reviews)

**Trade-offs accepted:**
- Venue reviews are open to anyone, which creates some risk of review bombing; moderation policy is needed
- The eligibility check creates API complexity: the POST /trainers/:id/reviews must query PlayerBatchReview before allowing the write
- averageRating on `TrainerProfile` is a stored field (rating, reviewCount) — it needs to be recomputed every time a new review is added or deleted to stay accurate

**Follow-up required:**
- Review moderation policy and admin tooling
- Review flag/report mechanism for players to flag suspicious reviews
- Display review count thresholds before showing average (e.g. show "New" instead of "0.0 from 0 reviews")

---

## ADR-005 — Trainer Monthly Player Reviews

**Change log ref:** [CL-005](CHANGE_LOG_LAST_30_DAYS.md#cl-005)
**Date:** Mar 2026
**Status:** Accepted

### Context

Training programs run in monthly cycles. Both trainers and players benefit from a structured feedback loop that tracks progress over time — not just whether the player attended. Without a formal review system, there is no structured way for a trainer to record player development and no way for a player to see their progress trajectory.

There was also a product design question: should reviews be per-session or per-month? Per-session reviews are high-overhead for trainers with many players in a batch. Per-month is more sustainable and creates a meaningful narrative timeline.

### Decision

Create a `PlayerBatchReview` model at the granularity of **one review per player per batch per calendar month**. Use `upsert` semantics so that a trainer can revise a review within the same month.

**Review parameters are not hardcoded** — they are fetched via `GET /api/batches/review-parameters`, allowing the system to evolve the parameter set (e.g. add `consistency` or `leadership`) without API changes.

**Player access:** `GET /api/stats/me/reviews` gives players a filterable view of their own reviews across batches — this is the core of the "player monthly batch progress" product surface.

**Why `PlayerBatchReview` also gates trainer reviews (CL-004):** Using the monthly review as the eligibility signal kills two birds with one stone — it enforces the training relationship AND incentivizes trainers to submit timely reviews (since it unlocks the player's ability to review the trainer).

### Consequences

**Positive:**
- Players can see month-on-month progress on specific skills — a sticky retention feature
- Trainers have a structured accountability mechanism that differentiates Sportza from generic batch scheduling tools
- The `PlayerBatchReview` record doubles as the eligibility proof for trainer reviews (CL-004)
- The review parameter API makes the rating categories extensible without schema changes

**Trade-offs accepted:**
- Monthly review submission is an added operational step for trainers; non-compliant trainers break the player progress feature
- Upsert semantics mean the most recent review for a given month overwrites the previous — no review history within a month

**Follow-up required:**
- Trainer reminder/notification when monthly reviews are due
- Aggregate review trends visualization for players (radar chart, bar chart)
- Admin report on batch review completion rates

---

## ADR-006 — Sport FK Added to 8 Models

**Change log ref:** [CL-006](CHANGE_LOG_LAST_30_DAYS.md#cl-006)
**Date:** Mar 2026
**Status:** Accepted

### Context

Sport was stored as a plain `String` field across many models (Booking, OpenPlay, Batch, Tournament, etc.). This had several consequences:
- No referential integrity — a booking could reference a sport name that no longer exists or was renamed
- Reporting and filtering by sport required string matching, which is error-prone (case sensitivity, typos)
- Future features like sport-specific analytics cannot work reliably if sport identity is a string

### Decision

Add a nullable `sportId Int?` FK to 8 models, pointing to the `Sport` table. Keep the existing `sport String` field alongside for denormalized reads (API response construction, search, display).

**Why nullable (Int?) and not required:** Adding a required FK to existing tables would break in-flight rows that predate this change. Making it nullable lets the system add the FK and progressively backfill existing data without a migration-blocking constraint.

**Why keep the String field:** API responses and filter queries already use the string field. Removing it would require coordinated frontend and backend changes. The string is now treated as a denormalized cache of `Sport.name` — set at write time, not independently updated.

### Consequences

**Positive:**
- Sport-based reporting can now JOIN on `sportId` reliably
- Referential integrity enforced at the DB level for new rows
- `Sport` model's reverse relations now correctly enumerate all models that use a sport

**Trade-offs accepted:**
- Dual fields (`sportId` and `sport`) create a consistency risk — if a sport is renamed, the `sport` string on old rows will be stale
- Nullable FK means the integrity guarantee only applies to rows created after this change
- 8 model updates means 8 places that must correctly set `sportId` on write

**Follow-up required:**
- Data backfill: set `sportId` on all existing rows where `sport` string can be matched to a Sport record
- Consider removing the `sport String` field once all rows are backfilled and frontends are updated
- Sport rename policy: if a sport's name changes, update all `sport String` fields via a migration

---

## ADR-007 — TrainerProfile ↔ TrainerReview Direct Relation

**Change log ref:** [CL-007](CHANGE_LOG_LAST_30_DAYS.md#cl-007)
**Date:** Mar 2026
**Status:** Accepted

### Context

`TrainerReview` existed with a `trainerId` FK pointing to `User.id`. To aggregate reviews for a trainer profile (for the discovery surface), the system had to join `TrainerReview` → `User` → `TrainerProfile`. This two-hop join is verbose and obscures the semantic intent: a review is about a trainer's professional profile, not their user account.

Additionally, `TrainerProfile.rating` and `reviewCount` needed a clear source to be computed from.

### Decision

Add `trainerProfileId Int?` directly to `TrainerReview`, with a corresponding `reviews TrainerReview[]` reverse relation on `TrainerProfile`. This makes `TrainerProfile` the direct owner of its review aggregation.

**Why nullable:** Same reasoning as CL-006 — backward compatibility for existing reviews that predate this change.

### Consequences

**Positive:**
- Querying `TrainerProfile` and including its reviews is now a single-level include in Prisma
- `averageRating` and `reviewCount` on `TrainerProfile` can be computed directly from the reverse relation without going through `User`
- Semantically clearer: a trainer review is about the professional profile, not the user account

**Trade-offs accepted:**
- Two FKs on `TrainerReview` now point to two different representations of the same person (`trainerId` → User, `trainerProfileId` → TrainerProfile); this must be kept consistent at write time
- Nullable field again reduces guaranteed integrity for old rows

**Follow-up required:**
- Backfill `trainerProfileId` on existing `TrainerReview` rows
- Potentially deprecate `trainerId` on `TrainerReview` once `trainerProfileId` is the established path

---

## ADR-008 — VenueDisplay and DisplayPairing (Scoreboard Pairing Infrastructure)

**Change log ref:** [CL-008](CHANGE_LOG_LAST_30_DAYS.md#cl-008)
**Date:** Mar 2026
**Status:** Accepted

### Context

The Smart Scoreboard (CL-009) requires a reliable way to bind a specific court's display screen to a specific live match — without requiring the venue owner or scorer to manually type a match ID into the TV browser.

A naive approach (hardcode a URL on the TV) breaks whenever the match ID changes. A QR-code pairing approach (like Apple AirPlay or Chromecast's setup flow) is intuitive and requires zero typing on the TV.

### Decision

Model the pairing as two separate concepts:

- **`VenueDisplay`** — the permanent, stable identity of a court's display device. It persists across matches. It knows which match is currently active (`currentMatchId`) and whether it is idle, awaiting, or live.
- **`DisplayPairing`** — a short-lived session token (48-char hex, expires in 60 minutes) that represents the act of linking a phone to a display. The TV watches the pairing token room on Socket.io; the phone scans a QR and calls the claim endpoint.

**Why separate the two models:** If pairing were stored on `VenueDisplay` directly, concurrent claim attempts or token refresh would overwrite court state. Keeping `DisplayPairing` as a separate row allows multiple pending sessions to exist (though only the newest is active per court) and gives a clean expiry mechanism without touching the permanent court record.

### Consequences

**Positive:**
- Zero-config TV setup: venue owner generates QR, TV scans or opens URL, phone claims it — no typing
- Old unclaimed pairings are automatically expired when a new one is generated for the same court
- `VenueDisplay.status` provides at-a-glance court state (idle / awaiting / live) for a future venue dashboard
- The token model is re-usable for other pairing or kiosk scenarios

**Trade-offs accepted:**
- Token security is only as strong as the expiry window (60 min default); a token intercepted within that window could be used to claim a match
- The system assumes 1 court = 1 active match; a court hosting back-to-back matches must be re-paired for each match
- `VenueDisplay.lastPingAt` requires the TV browser to periodically ping the server to show it is online

**Follow-up required:**
- Admin / venue-owner view of all court display states
- Configurable token expiry per venue
- Passive reconnect: if the TV loses connection mid-match, it should automatically rejoin the Socket room

---

## ADR-009 — Smart Scoreboard Product Definition

**Change log ref:** [CL-009](CHANGE_LOG_LAST_30_DAYS.md#cl-009)
**Date:** Mar 2026
**Status:** Accepted

### Context

Several product and hardware directions were possible for a live scoreboard: custom LED matrices, Raspberry Pi controllers, tablet apps, or web pages on existing TVs. The product risk in the wrong direction is high — hardware complexity creates a much longer go-to-market path and eliminates most venues from Phase 1 adoption.

The key insight was that most venues in the target market (Pune, India) already have Smart TVs or Android TVs on their courts. Buying new hardware for scoreboard purposes would be a non-starter for adoption.

### Decision

**The scoreboard is a web page, not a hardware product.**

Phase 1 constraints:
- TV browser opens `/scoreboard/:matchId` in fullscreen kiosk mode — no app install, no hardware purchase
- Scores are updated manually (1-tap in the Sportza app) and broadcast via Socket.io
- No AI scoring, no sensor integration, no LED matrix
- One court = one display = one active match
- Zero forced ads; venue-controlled ad slots only

**UI philosophy:** Glanceable reference, not entertainment. Visible from 10+ meters. High contrast, large text, no animations except smooth score transitions.

**Monetisation path:** Free (Phase 1, adoption) → SaaS ₹999–₹2,499/screen/month (Phase 2, revenue).

**Why this specific direction:** The zero-hardware approach removes every adoption barrier. The venue does not need to buy anything. The setup is opening a URL. If the scoreboard proves its value at zero cost, the SaaS upgrade conversation is much easier.

### Consequences

**Positive:**
- Any venue with a TV and a browser can use the scoreboard from Day 1
- No supply chain, no hardware support, no firmware updates
- The same web page is the MVP — the "display" model (CL-008) is the Phase 2 management layer
- Free Phase 1 builds habit and network effects before monetization pressure is introduced

**Trade-offs accepted:**
- Browser-based kiosk mode on Android TV has quirks (memory management, reconnection after sleep)
- 1-court-1-match constraint means multi-court venues must open the scoreboard URL per court
- Manual scoring introduces human delay — the "live feel" relies on scorers being engaged

**Follow-up required:**
- Reconnect handling: auto-rejoin Socket room if connection drops (no page reload)
- Edge cases: match pause, walkover, abandoned match
- TV browser compatibility testing (Chrome on Android TV, Silk on Fire Stick)

---

## ADR-010 — Cloudflared Tunnel Added

**Change log ref:** [CL-010](CHANGE_LOG_LAST_30_DAYS.md#cl-010)
**Date:** Mar 27, 2026
**Status:** Accepted

### Context

During development and demos, the team needed a way to share the running local app with external stakeholders (investors, venue partners, QA reviewers) without deploying to a production environment. Traditional approaches (deploying to a VPS, exposing ngrok) require additional setup and credentials.

Cloudflare Tunnel (`cloudflared`) provides a single-binary solution: run it, get an HTTPS URL, share it. No port forwarding, no firewall changes, no domain purchase required for quick demos.

### Decision

Add `cloudflared.exe` to the project root for direct developer use. Update `DEPLOYMENT.md` with guidance on running the tunnel alongside the dev server for sharing sessions.

**Why Cloudflare Tunnel over ngrok:** Cloudflare Tunnel does not require a ngrok account for short-lived tunnels, has better performance for webhook testing (Razorpay webhook in particular), and produces stable HTTPS URLs that can be registered as Razorpay webhook endpoints during testing.

### Consequences

**Positive:**
- Demo sharing is a one-command step: run `cloudflared.exe tunnel --url http://localhost:3000`
- Razorpay webhook testing is possible on local dev without a separate webhook proxy tool
- The tunnel endpoint also works for testing Auth0 callback URLs in dev

**Trade-offs accepted:**
- `cloudflared.exe` is a Windows binary committed to the repo root — it should not be on the production server and should be in `.gitignore` for non-Windows contributors
- Free Cloudflare Tunnel URLs are random subdomains (not stable); for persistent testing a named tunnel with auth is needed

**Follow-up required:**
- Add `cloudflared.exe` to `.gitignore`
- Document the named tunnel setup for persistent dev webhook testing

---

## ADR-011 — New Product Strategy and Planning Documentation Suite

**Change log ref:** [CL-011](CHANGE_LOG_LAST_30_DAYS.md#cl-011)
**Date:** Apr 2026
**Status:** Accepted

### Context

Sportza had strong technical documentation (BRD, FRD, TSD, Data Model, Architecture, Booking Flows) but lacked management-facing artifacts. As the product matured from active engineering to rollout preparation, the following gaps became apparent:

- No single document described the phased rollout plan with release gates
- No feature tracker existed to show what was implemented, in what depth, and what remained
- No market analysis was documented to inform go-to-market decisions
- No narrative progress document existed for stakeholder communication
- No optimization backlog existed to capture debt and improvement priorities

Without these, product conversations were happening ad hoc without a shared reference.

### Decision

Create five new management-facing documents in one batch:

| Document | Fills gap |
|----------|-----------|
| `FEATURE_ROLLOUT_AND_TRACKER.md` | Phase-by-phase rollout with release gates; feature-level tracker |
| `PRODUCT_MASTER_PLAN.md` | Vision, personas, KPIs, planning gaps |
| `PRODUCT_PROGRESS_HISTORY.md` | Management-facing narrative; what is done vs planned |
| `PRODUCT_OPTIMIZATION_PLAN.md` | Improvement backlog for product, UX, ops, monetization |
| `MARKET_RESEARCH_AND_STRATEGY.md` | Market landscape, segments, GTM direction |

**TRACEABILITY.md was updated to v1.4** to index all five new documents alongside existing ones.

**Why all at once:** Creating these documents in sequence from the existing technical docs and discussion history was more efficient than spacing them out. A full-day documentation sprint produced a complete management layer.

### Consequences

**Positive:**
- Product, engineering, and business stakeholders now have a single entry point per concern
- The rollout tracker is designed to be the weekly source of truth — not a one-time artifact
- Market research is on record; GTM decisions can reference it
- TRACEABILITY.md v1.4 is now a genuine navigation hub for all 26 docs

**Trade-offs accepted:**
- Five new documents increase maintenance burden — they must be updated as the product evolves
- The tracker has "Needs refresh" as a status but no formal cadence or owner assigned yet

**Follow-up required:**
- Assign a weekly tracker update owner
- Define the formal cadence for refreshing PRODUCT_PROGRESS_HISTORY and OPTIMIZATION_PLAN
- Run the tracker update as part of each release retrospective

---

## ADR-012 — Display and Matchmaking Confirmed as Implemented

**Change log ref:** [CL-012](CHANGE_LOG_LAST_30_DAYS.md#cl-012)
**Date:** Apr 2026
**Status:** Accepted

### Context

Between the March architecture work and the April planning docs, several features advanced from "in progress" or "pending" to "implemented" without a formal status update event. The April tracker (FEATURE_ROLLOUT_AND_TRACKER.md) served as the first authoritative status confirmation.

### Decision

Formally mark as Implemented in the tracker:
- Scoreboard page (`/scoreboard/:matchId`)
- Pair / claim display flows (`/display/pair/:token`, `/claim/:token`)
- Venue display management
- Matchmaking suggestions

This is primarily a documentation decision — it sets the canonical status and removes ambiguity about what is "done" vs "planned."

### Consequences

**Positive:**
- Clear line between what is shipped and what is next
- Avoids re-building or re-planning features that are already implemented
- The tracker's "Detail still required" column highlights what rollout and operational work remains even for implemented features

**Trade-offs accepted:**
- "Implemented" does not mean "production-ready" for all items. Scoreboard and displays are marked Medium depth — rollout SOPs, TV optimization validation, and security review are still needed
- Matchmaking is Medium depth — ranking logic, metrics, and lifecycle definition are not yet complete

**Follow-up required:**
- TV-mode browser compatibility testing for scoreboard
- Security review of display token claim flow
- Matchmaking ranking algorithm definition and success metrics

---

## ADR-013 — Root DEPLOYMENT.md Refreshed

**Change log ref:** [CL-013](CHANGE_LOG_LAST_30_DAYS.md#cl-013)
**Date:** Apr 17, 2026
**Status:** Accepted

### Context

The root-level `DEPLOYMENT.md` (the operational deployment guide, distinct from `docs/DEPLOYMENT.md` which is the formal deployment spec) had not been updated since the cloudflared tunnel was added and since various environment variable changes were made during the April docs sprint. Operators following the guide would encounter gaps.

### Decision

Refresh `DEPLOYMENT.md` at the root with current operational guidance including tunnel setup, updated env var reference, and any infrastructure changes made in the Apr sprint.

### Consequences

**Positive:**
- Operators following the guide will get a working setup without needing to cross-reference multiple sources
- Tunnel setup is documented alongside the standard deployment steps

**Trade-offs accepted:**
- Root `DEPLOYMENT.md` and `docs/DEPLOYMENT.md` still serve slightly different audiences (operational vs formal spec); their relationship should be clarified

**Follow-up required:**
- Add a header note to root `DEPLOYMENT.md` clarifying that `docs/DEPLOYMENT.md` is the formal spec and the root file is the operational quick-start
- Confirm whether both documents should be merged or kept separate

---

## ADR-014 — Peer Invites Feature Scoped and Planned

**Change log ref:** [CL-014](CHANGE_LOG_LAST_30_DAYS.md#cl-014)
**Date:** Apr 2026
**Status:** In planning

### Context

The platform has strong individual-player features (booking, stats, training) but lacks social coordination mechanics. Players who want to organize a game with a specific set of friends must do so outside the app (WhatsApp, calling). This creates a retention leak — the social coordination happens off-platform, and with it, the booking decision.

Peer invites would allow a player to invite specific friends to join an open play session or a future match. This creates a reason to return to the app for social coordination, not just transactional booking.

### Decision

Scope Peer Invites as the next community release (Phase 4 in the rollout plan) and create a Cursor planning artifact to drive the feature design. Formal implementation planning is underway but implementation has not started.

**Priority:** The feature is scoped at Medium depth in the tracker, meaning core direction is defined but execution details are incomplete. The following need resolution before implementation:
- Delivery mechanism (in-app notification vs push vs SMS vs share link)
- Anti-spam rules (max invites per user per day; block/mute flows)
- RSVP lifecycle (accept / decline / maybe; expiry)
- Success metrics (invitation acceptance rate, repeat bookings from invite flow)

### Consequences

**Positive:**
- When delivered, peer invites close the off-platform coordination leak
- Invite mechanism creates organic growth — each invite is a new-user acquisition touchpoint
- Builds social graph data (who invites whom) that can feed future matchmaking improvements

**Trade-offs accepted:**
- Social features increase abuse surface (spam, harassment); anti-spam design must come before launch
- Invitation lifecycle adds backend and notification complexity
- Without push notifications infrastructure (currently planned but not implemented), invite delivery relies on in-app only — limiting reach for users not actively in the app

**Follow-up required:**
- Resolve notification infrastructure before peer invite delivery design is finalized
- Complete the Cursor planning artifact and convert to implementation tickets
- Define "invite accepted" as a product metric and wire it to analytics

---

## Index

| ADR | Change | Date | Status |
|-----|--------|------|--------|
| [ADR-001](#adr-001) | Full Monorepo Rebuild | Mar 2026 | Accepted |
| [ADR-002](#adr-002) | Commission System | Mar 2026 | Accepted |
| [ADR-003](#adr-003) | Real-Time Match Scoring | Mar 2026 | Accepted |
| [ADR-004](#adr-004) | Discovery and Ratings | Mar 2026 | Accepted |
| [ADR-005](#adr-005) | Trainer Monthly Reviews | Mar 2026 | Accepted |
| [ADR-006](#adr-006) | Sport FK on 8 Models | Mar 2026 | Accepted |
| [ADR-007](#adr-007) | TrainerProfile-Review Relation | Mar 2026 | Accepted |
| [ADR-008](#adr-008) | VenueDisplay and DisplayPairing | Mar 2026 | Accepted |
| [ADR-009](#adr-009) | Smart Scoreboard Product Definition | Mar 2026 | Accepted |
| [ADR-010](#adr-010) | Cloudflared Tunnel | Mar 27, 2026 | Accepted |
| [ADR-011](#adr-011) | Planning Docs Suite | Apr 2026 | Accepted |
| [ADR-012](#adr-012) | Display and Matchmaking Confirmed | Apr 2026 | Accepted |
| [ADR-013](#adr-013) | Deployment Doc Refresh | Apr 17, 2026 | Accepted |
| [ADR-014](#adr-014) | Peer Invites Planned | Apr 2026 | In planning |

---

## References

- [`docs/CHANGE_LOG_LAST_30_DAYS.md`](CHANGE_LOG_LAST_30_DAYS.md) — Cross-referenced change log
- [`docs/DISCUSSION_LOG.md`](DISCUSSION_LOG.md) — Session discussion records
- [`docs/FEATURE_ROLLOUT_AND_TRACKER.md`](FEATURE_ROLLOUT_AND_TRACKER.md) — Feature status tracker
- [`docs/TRACEABILITY.md`](TRACEABILITY.md) — Document index

---

## Apr 27–28, 2026 Sprint — Architecture Decision Records

---

### ADR-015 — ELO-Based Skill Rating System

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-015](CHANGE_LOG_LAST_30_DAYS.md#cl-015)

#### Context

Sportza's matchmaking, leaderboards, and open-play/batch filtering all need a reliable sense of a player's skill level per sport. Without this, suggestions are based only on geography and schedule — producing poor matches between beginners and advanced players. Competitors (Playo, PlayOn) have no skill-based matching at all at this tier, creating a differentiator opportunity.

A bespoke ELO variant was chosen over a simpler win-rate percentage because:
1. ELO accounts for opponent strength (beating a weak player yields less gain than beating a strong one)
2. The 7-factor extension adds context that a pure win/loss ELO ignores (margin of victory, team size, smurf patterns)
3. ELO is a well-understood algorithm with predictable behaviour, making it easier to tune and explain to users

#### Decision

Implement a 7-factor ELO engine in pps/api/src/services/elo.ts:
- **Result** (win/draw/loss weight)
- **Expected score** (standard ELO probability from rating gap)
- **Base K = 32**, scaled by **confidence tier** (Provisional 1.5×, Regular 1.0×, Established 0.7×)
- **MOV normalised** (0–1) to reduce swing from lopsided wins
- **Team size** divisor (solo = full impact; team = shared)
- **Rating gap dampener** (wins vs. much weaker opponents capped at 50%)
- **Smurf dampener** (0.6× K for flagged accounts)

Store ratings per (userId, sportId, formatName) in SportSkillRating. Log every change to RatingHistory. Run monthly drift (0.5% pull to 1000) via 
atingDriftWorker.

#### Consequences

**Positive:**
- Matchmaking can now filter by skill band (skillRatingMin/Max on OpenPlay + Batch)
- Leaderboards become meaningful and sport/format-specific
- Rating history is auditable and displayable on player profiles

**Negative / Risks:**
- Cold-start: new users start at 1000 with Provisional confidence — suggestions are noisy for the first ~10 matches
- Inflation risk if anti-manipulation rules are not enforced consistently (mitigated by gain caps)
- Complexity: 7 factors require careful documentation and monitoring; a bug in any factor silently skews all future ratings

---

### ADR-016 — Peer Invites as a Structured Social Action

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-016](CHANGE_LOG_LAST_30_DAYS.md#cl-016)

#### Context

Players on Sportza want to organise casual games with known contacts, but the current flow requires them to create an open-play listing and hope the right person shows up, or share a booking link externally. There is no in-app way to say "play with me on Saturday." This reduces stickiness and forces social coordination to WhatsApp.

#### Decision

Build a structured Peer Invite system with a formal state machine:
pending → accepted / declined / cancelled / expired

Implement as a standalone API (/api/peer-invites) with a dedicated PeerPlayInvite schema model and a tabbed Inbox/Sent UI. Business rules are enforced server-side: one pending invite per sender-receiver-sport combination; only the sender can cancel; only the receiver can respond.

#### Consequences

**Positive:**
- Brings social coordination in-app; reduces dependency on WhatsApp for scheduling
- Naturally feeds into the PlayerConnection graph (an accepted invite triggers a connection upsert)
- Creates a conversion funnel: Invite → Accept → Book Venue → Match

**Negative / Risks:**
- Potential for invite spam if not rate-limited (not yet implemented — future work)
- No push notification on new invite yet (only in-app badge via Notification model — acceptable for Phase 1)

---

### ADR-017 — Rating-Aware Matchmaking Rebuild

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-017](CHANGE_LOG_LAST_30_DAYS.md#cl-017)

#### Context

The previous matchmaking endpoint returned players with little filtering beyond sport. With the ELO rating system live, matchmaking can now surface players within a meaningful skill band, making the suggestions dramatically more useful. Rebuilding the entire route family simultaneously (suggestions + network + skill-rating + history) avoids incremental half-states in the API.

#### Decision

Replace the single suggestions endpoint with six cohesive endpoints. The suggestion algorithm filters by sport/format and sorts by rating proximity (±200 pts default band). The network endpoint aggregates recently played, frequent opponents, venue connections, and nearby players into a single social-graph response to power a rich "People to Play With" UI.

#### Consequences

**Positive:**
- Suggestions are now skill-appropriate, reducing bad-match frustration
- Network endpoint enables a social graph view without a separate graph database
- initialize-ratings endpoint is a useful admin/debug tool for seeding ratings

**Negative / Risks:**
- More complex query logic increases latency on the suggestions endpoint for users with large networks (mitigated by paginating and caching in future)
- Rating proximity band (±200) is an arbitrary starting value; needs tuning based on actual usage data

---

### ADR-018 — Bidirectional PlayerConnection Social Graph (SQL, Not Graph DB)

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-018](CHANGE_LOG_LAST_30_DAYS.md#cl-018)

#### Context

Matchmaking network queries need to traverse a player graph: "show me people I've played with before." The question was whether to use a dedicated graph database (Neo4j, Amazon Neptune) or model the graph in MySQL.

At current scale (hundreds to low thousands of players), a graph database is overengineering. MySQL can handle shallow 1-hop traversals efficiently with proper indexing on (userId, connectedUserId).

#### Decision

Model the social graph as a PlayerConnection table in MySQL/Prisma. Enforce bidirectionality in the application layer (upsertConnection always stores the pair with lower userId first). Use playCount and lastActivityAt to rank connections by recency and frequency in network queries.

#### Consequences

**Positive:**
- No additional infrastructure dependency (no graph DB)
- Connections auto-build as players interact (match scoring, open play join, batch session) — no manual friend-add step
- Connection strength (playCount) enables ranked "frequent opponents" listing

**Negative / Risks:**
- 2-hop traversals (friends of friends) will become expensive at scale — acceptable for Phase 1 given small user base
- No explicit "block" mechanism yet — blocked players are not yet excluded from network results (future work)

---

### ADR-019 — In-App Notification System (Pull-Based, Phase 1)

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-019](CHANGE_LOG_LAST_30_DAYS.md#cl-019)

#### Context

As Sportza adds peer invites, booking confirmations, rating updates, and session reminders, players need a reliable way to receive these events without relying solely on email. Push notifications (FCM/APNs) require a native app or service worker setup; email requires an email service integration. A simple in-app notification store is the lowest-friction Phase 1 solution.

#### Decision

Build a pull-based in-app notification system: all notification events are written to the Notification table; the client polls GET /api/notifications/unread-count on mount and calls GET /api/notifications to fetch the list. No WebSocket push for notifications in Phase 1 (Socket.io is reserved for real-time scoring).

#### Consequences

**Positive:**
- No external service dependency (no FCM, no email provider for notification delivery)
- All notification data is queryable and auditable
- createNotification() service function is easy to call from any business logic layer

**Negative / Risks:**
- Pull-based means notifications are not instant — the user sees them only on next page load or explicit refresh (acceptable for non-urgent events like invite accepted)
- No push notification means low engagement for time-sensitive invites (future: FCM/APNs in Phase 2)
- Polling unread-count on every mount adds minor DB load; should be cached in future

---

### ADR-020 — Frontend-Side Scoring Engine Library

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-020](CHANGE_LOG_LAST_30_DAYS.md#cl-020)

#### Context

Sportza supports 11 different sports, each with materially different scoring rules (rally vs. service, sets vs. periods, innings vs. halves). Previously, scoring logic was embedded directly in page components — making it duplicated, untestable, and difficult to extend. The Smart Scoreboard (CL-008/CL-009) and new ScoreMatch.tsx page required a clean, typed, sport-specific state machine per sport.

#### Decision

Build a pps/web/src/lib/scoring/ library with one typed module per sport. Each module exports a pure state-machine: initialState() and pplyEvent(state, event) → 
ewState. The ScoreMatch.tsx page selects the correct module by sport name and only handles UI concerns (rendering state, dispatching events). Scoreboard.tsx receives state updates via Socket.io and re-renders without any scoring logic.

#### Consequences

**Positive:**
- Scoring logic is isolated, pure, and independently testable
- Adding a new sport requires only a new engine file — no changes to the UI layer
- The same engines run client-side (instant feedback) and can be replayed server-side for validation

**Negative / Risks:**
- Client-side state is authoritative until a match is submitted — a page crash could lose score data (mitigated by auto-save to localStorage in each engine)
- 11 separate files means bundle is slightly larger, but tree-shaking should eliminate unused engines per sport

---

### ADR-021 — Password Reset and Refresh Token Auth Extension

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-021](CHANGE_LOG_LAST_30_DAYS.md#cl-021)

#### Context

The original auth system supported only email/OTP and Google SSO. There was no password reset flow and no refresh token mechanism, meaning users who forgot their password had no self-service recovery path. Additionally, short-lived JWTs without refresh tokens forced frequent re-login — a poor UX for mobile users.

#### Decision

Extend pps/api/src/routes/auth.ts with:
1. Forgot-password + reset-password flows (token stored hashed in DB, 15-min TTL)
2. Refresh token support: a new RefreshToken table stores long-lived (7-day) tokens with rotation on use, revocation on logout and password reset

Implement corresponding frontend pages (ForgotPassword.tsx, ResetPassword.tsx).

#### Consequences

**Positive:**
- Self-service password recovery eliminates support overhead
- Refresh tokens improve session UX (no forced re-login every hour)
- Token rotation limits refresh token replay window to seconds

**Negative / Risks:**
- RefreshToken table grows over time — requires a periodic cleanup job for expired/revoked tokens (not yet implemented)
- Password reset email delivery depends on a working email service (SMTP/SES) being configured correctly in prod

---

### ADR-022 — WhatsApp Deep-Link Bridge (No API, No Cost)

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-022](CHANGE_LOG_LAST_30_DAYS.md#cl-022)

#### Context

Trainers frequently send payment reminders and session confirmations to players via WhatsApp outside the app, creating friction and no tracking. The options were:
1. **WhatsApp Business API** — requires approved account, message template approvals, per-message cost
2. **Deep-link (wa.me)** — free, instant, zero compliance overhead; the trainer's own device sends the message

For Phase 1, the volume is low enough that deep-links are perfectly sufficient. The trainer clicks a button; their WhatsApp opens with a pre-filled message; they tap Send.

#### Decision

Implement whatsappBridge.ts as a pure URL builder (no HTTP calls, no API keys). Generate three message templates (payment reminder, session reminder, progress share) with all relevant data encoded in the URL. Keep it frontend-openable via window.open.

#### Consequences

**Positive:**
- Zero cost, zero API approval, zero compliance risk
- Works on any device where WhatsApp is installed
- Templates ensure consistent, professional messages

**Negative / Risks:**
- Requires the trainer to manually send each message — not automatable
- No delivery tracking (no read receipts)
- Doesn't scale to bulk sends (WhatsApp will block deep-link abuse at high volume) — Phase 2 would need Business API

---

### ADR-023 — Frontend Pages Expansion (38 → 60+)

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-023](CHANGE_LOG_LAST_30_DAYS.md#cl-023)

#### Context

Multiple new feature areas (peer invites, matchmaking, ratings, notifications, venue management, trainer UX) each required dedicated UI pages. The existing ~38 pages were insufficient to surface the new backend capabilities. All new pages are React with TanStack Query for data fetching and Tailwind for styling, consistent with existing conventions.

#### Decision

Add 22+ new pages in a batch, grouped by product area. Each page integrates with its corresponding API endpoint(s) and follows the established component/page structure (src/pages/<Area>/<PageName>.tsx).

#### Consequences

**Positive:**
- All new backend APIs now have corresponding UI surfaces
- Users can access ratings, peer invites, matchmaking, venue management, and notifications from within the app

**Negative / Risks:**
- Rapid page addition increases routing complexity — router config needs to be kept tidy
- Some pages (e.g. VenueCalendar, VenueSchedule) are feature-heavy and may have incomplete edge-case handling in Phase 1

---

### ADR-024 — Six New Prisma Models for Apr Sprint Features

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-024](CHANGE_LOG_LAST_30_DAYS.md#cl-024)

#### Context

The five feature areas introduced in this sprint (ratings, peer invites, social graph, notifications, auth tokens) each required dedicated data models. Using generic JSON blobs in existing tables was rejected: proper relational models enable indexing, query optimisation, and clean Prisma relations.

#### Decision

Add six new Prisma models:
- SportSkillRating — per-user per-sport rating record
- RatingHistory — audit log of every rating change
- PlayerConnection — bidirectional social graph edge
- PeerPlayInvite — structured play invitation
- Notification — in-app notification item
- RefreshToken — JWT refresh token record

Extend User with relations to all six. Add skillRatingMin/Max to OpenPlay and Batch for skill-band filtering.

#### Consequences

**Positive:**
- All new features have clean, indexed, relational data storage
- Total model count moves from 47 to 53, reflecting the platform's growing depth

**Negative / Risks:**
- Schema migrations must be run carefully on prod (Prisma migrate deploy — non-destructive)
- RatingHistory and Notification tables will grow large over time — archival strategy needed in future

---

### ADR-025 — Production Deployment Automation (Ubuntu VPS)

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-025](CHANGE_LOG_LAST_30_DAYS.md#cl-025)

#### Context

Prior to this sprint, the production deployment process was undocumented and manual. The root DEPLOYMENT.md provided guidance, but no scripts existed to execute it. This created a single-point-of-failure: only the original developer knew the exact deployment steps. Any new team member or VPS rebuild would require piecing together the process from documentation.

#### Decision

Create a deploy/ directory with three idempotent shell scripts targeting Ubuntu 22.04:
1. ootstrap.sh — one-time server setup
2. setup-nginx.sh — Nginx config generation and SSL
3. deploy.sh — ongoing CI/CD deploy step

Scripts are designed to be idempotent (safe to run multiple times) and to fail loudly (set -euo pipefail) rather than silently.

#### Consequences

**Positive:**
- Any developer can deploy to a fresh Ubuntu VPS in under 30 minutes by running three scripts
- deploy.sh can be wired directly into GitHub Actions for automated deploys on push to main
- Nginx config handles /api → Express and / → Vite static in one config block

**Negative / Risks:**
- Scripts are Ubuntu/Debian-specific; won't work on other Linux distributions without modification
- No rollback mechanism yet — a failed deploy requires manual intervention

---

### ADR-026 — Workers, Utility Lib, and Infrastructure Routes

**Date:** Apr 27–28, 2026
**Status:** Implemented
**Change log:** [CL-026](CHANGE_LOG_LAST_30_DAYS.md#cl-026)

#### Context

As the platform adds more async jobs (rating drift, booking hold cleanup), reusable utility logic (socket setup, booking conflict checks, tournament stats, progress share tokens), and new route families (venue schedules, unauthenticated public endpoints), keeping these in ad-hoc locations creates maintenance debt. Centralising them into workers/, lib/, and dedicated 
outes/ files improves discoverability and separation of concerns.

#### Decision

- Add two BullMQ workers (
atingDriftWorker, holdCleanupWorker) to the existing workers pattern
- Add four lib utilities (socket.ts, ookingHelpers.ts, 	ournament-player-stats.ts, progressShareToken.ts) alongside existing lib files
- Add two new route files (schedules.ts, public.ts) following existing route conventions

All workers are registered in the main worker-startup file; all routes are mounted in the main Express app.

#### Consequences

**Positive:**
- ookingHelpers.ts eliminates duplicated slot-conflict logic that was previously copy-pasted across venue booking and open-play routes
- holdCleanupWorker prevents stale payment holds from blocking slot availability
- public.ts enables unauthenticated venue/player discovery — a prerequisite for public-facing landing pages and SEO

**Negative / Risks:**
- progressShareToken.ts generates time-limited tokens that need a signing secret in env vars — must be documented in deployment guide
- More workers increase the number of BullMQ queues to monitor; an admin queue dashboard should be added in future
