# Future Development — Sportza

**Version:** 2.3  
**Last updated:** Apr 28, 2026

This document captures **planned or exploratory features** that are out of scope for the current MVP but are intended for future releases. It also lists items that were present in the old codebase but are **not yet implemented** in the new Turborepo monorepo.

---

## 1. Migration Backlog

The following features were planned in the previous codebase or early monorepo phase and are tracked here. Status updated as of Apr 2026.

| Item | Description | Status (Apr 28, 2026) |
|------|-------------|-------------------|
| **Socket.io real-time match scoring** | Live score updates during matches via WebSocket — `match:<id>` room with `match:score`, `match:status` | ✅ **Implemented** (Mar 2026) |
| **Scoreboard page** | Web page at `/scoreboard/:matchId` for TV display | ✅ **Implemented** (Mar 2026) |
| **Display pairing flow** | VenueDisplay + DisplayPairing models; QR-based court-to-match pairing | ✅ **Implemented** (Mar 2026) |
| **Matchmaking** | Player matchmaking suggestions | ✅ **Implemented** (Apr 2026 — rating-aware, high depth: 6 endpoints, player network graph) |
| **Peer invites** | Invite friends to join open play / future match | ✅ **Implemented** (Apr 2026 — full API, schema, frontend pages) |
| **Notifications** | In-app notification preferences and history | ✅ **Implemented** (Apr 2026 — `Notification` model, 5 API endpoints, `Notifications.tsx` page) |
| **ELO Skill Rating** | Per-sport skill rating, rating history, matchmaking filtering | ✅ **Implemented** (Apr 2026 — 7-factor ELO, drift worker, `SportSkillRating` + `RatingHistory` models) |
| **Frontend scoring engine** | Typed per-sport scoring state machines | ✅ **Implemented** (Apr 2026 — 11 engines under `apps/web/src/lib/scoring/`) |
| **Edit Profile** | Edit user name, avatar, preferences | ✅ **Implemented** (Apr 2026 — `ProfileEdit.tsx`, `Settings.tsx`) |
| **Password reset / refresh tokens** | Self-service password recovery and session refresh | ✅ **Implemented** (Apr 2026 — forgot-password + reset-password flow; `RefreshToken` model) |
| **WhatsApp bridge** | Trainer-initiated WhatsApp reminders | ✅ **Implemented** (Apr 2026 — deep-link generator; no API cost) |
| **Production deploy scripts** | Automated Ubuntu VPS deployment | ✅ **Implemented** (Apr 2026 — `deploy/bootstrap.sh`, `setup-nginx.sh`, `deploy.sh`) |
| **Open play T-30 confirmation cron** | Scheduled job to confirm open-play bookings ~30 min before slot | ⬜ Not implemented — should be a BullMQ scheduled job |
| **SMS OTP** | Phone-based one-time password for auth | ⬜ Email OTP only; Auth0 supports SMS, not yet configured |
| **Splash screen** | App launch splash before auth/home | ⬜ Not present in new frontend |
| **Sponsor Monetization Module** | Sponsor, Tournament_Sponsors, placement types | ⬜ Planned — see SPONSOR_MONETIZATION_MODULE.md |
| **Dynamic pricing** | Smart slot fill / demand-based pricing | ⬜ Future — backend support unclear |
| **Split payments UI** | Full split payment configuration flow | ⬜ Backend supports SplitPayment; frontend lacks full flow |
| **Push notifications** | FCM / APNs for matches, bookings, reminders | ⬜ Not implemented (Phase 2) |
| **PWA support** | Service worker, offline, install prompt | ⬜ Not implemented |
| **Refresh token cleanup job** | Periodic removal of expired/revoked RefreshToken rows | ⬜ Not yet implemented |
| **Admin queue dashboard** | Visibility into BullMQ queue health and job history | ⬜ Not yet implemented |

---

## 2. Multi-Sport AI Video Analytics Engine

**Status:** Planned (future)  
**Theme:** Performance & engagement  
**Module:** AI Performance Intelligence  
**Product:** Sportza

### 2.1 Business objective

To build a scalable AI-powered video analytics engine capable of automatically extracting structured match statistics across multiple sports from recorded or uploaded match videos.

This feature will:

- Transform Sportza from booking platform → performance ecosystem
- Enable player skill tracking
- Support tournament analytics
- Unlock premium subscription revenue
- Attract academies and coaches

### 2.2 Problem statement

Across sports:

- Match statistics are manually recorded
- Amateur tournaments lack structured data
- Players have no reliable performance analytics

Sportza needs a unified AI system that:

- Analyzes match video
- Detects sport type
- Extracts sport-specific events
- Generates structured statistics

### 2.3 Scope — Phase 1 (MVP)

**Supported sports:**

- Tennis
- Badminton
- Cricket
- Football (5v5 / 7v7)

**Capabilities:**

- Upload or record match video
- AI detects sport type (or user selects)
- Event detection
- Generate match statistics
- Display analytics dashboard

### 2.4 Functional architecture model

Instead of building separate systems per sport:

| Layer | Description |
|-------|-------------|
| **Core Engine (Generic)** | Player detection, object tracking (ball/shuttle), pose estimation, event segmentation, timeline creation |
| **Sport-Specific Rules Engine** | Each sport has rule definitions, event mapping logic, metric calculations |

This allows scalability — new sports can be added via rule modules.

### 2.5 Related docs

- **Stats & matches:** [DATA_MODEL.md](DATA_MODEL.md) (PlayerStats, Match), [NAVIGATION.md](NAVIGATION.md) (Stats, Live Match)
- **UI/UX:** [UI_UX_REQUIREMENTS_SUMMARY.md](UI_UX_REQUIREMENTS_SUMMARY.md)

---

## 3. Strategic positioning

If Sportza supports multiple sports (cricket, football, badminton, tennis, etc.), the AI video analytics capability must be documented as a **Generic AI Video Analytics Engine** with **sport-specific rule modules**. This positions Sportza as:

> **India's first AI-powered community sports intelligence platform** — combining Booking + Tournament + Player Stats + AI Analytics.

---

## 4. Smart Scoreboard for Venues

**Status:** Planned (post-MVP, future feature)
**Theme:** Venue experience & monetisation
**Module:** Live Scoreboard Display
**Product:** Sportza

---

### 4.1 One-Line Definition

> Sportza Scoreboard = A zero-setup, real-time digital scoreboard that makes every court feel like a professional arena.

---

### 4.2 Product Philosophy (Non-Negotiables)

The scoreboard is **a reference point, not entertainment**. It is glanceable, not immersive.

| Must Be | Must Not Be |
|---------|-------------|
| Glanceable — readable in 1–2 seconds | Flashy animations |
| Clean and minimal | Crowd interaction gimmicks |
| Real-time (sub-1 sec updates) | Sound or audio feedback |
| Reliable — no flicker, no lag | Cluttered or stats-heavy UI |
| Passive — players don't depend on it | Dependency-heavy hardware |

**UI Rule:** *"If no one looks at it for 30 seconds, it should still be perfect."*

Design reference: badminton tournament boards, football stadium score ribbons — not entertainment screens.

---

### 4.3 MVP Architecture

**Core flow:**

```
Player logs event in app
  → API updates MatchEvent + Match.scores
  → Socket.io emits to room match:<matchId>
  → Scoreboard web client (TV browser) receives event
  → UI updates instantly (no reload)
```

**Key decision:** The scoreboard is a **web page**, not a hardware product.

**Display setup:**
- Smart TV / Android TV / Fire Stick running a browser in kiosk mode
- Opens: `/scoreboard/:matchId`
- Runs fullscreen — no controls visible
- Cost: ₹0 incremental (most venues already have TVs)

**Court mapping:**
```
1 Court → 1 Display → 1 Active Match
```

---

### 4.4 Scoreboard UI — MVP Layout

```
┌─────────────────────────────────────────┐
│                                         │
│   [ Team A ]    21  |  18   [ Team B ]  │
│                                         │
│          ⏱  Q3 — 14:32                  │
│                                         │
│   LAST EVENT                            │
│   ⚽ Goal — Rohan K  (Team A)            │
│                                         │
└─────────────────────────────────────────┘
```

**UI rules:**
- Large fonts, visible from 10+ metres
- Dark background, high contrast text
- Score change: smooth transition only (no flash)
- Last event fades after ~5 seconds
- No ads, no stats overload, no multi-match view in MVP

---

### 4.5 Scoring Experience

**Type:** Manual scoring with live feel (not AI auto-scoring)

**Quick Score Buttons (in app):**
- `+1 Point` / `Goal` / `Wicket` / `Ace` — sport-specific
- 1 tap → event logged → board updates in < 1 second

This friction reduction makes it *feel* automated without the complexity of actual automation.

**Explicitly not included:**
- AI / computer vision auto-scoring
- Sensor integrations (smart nets, goal sensors)

---

### 4.6 Venue Experience — MVP Setup

```
Venue opens /scoreboard/:matchId on TV → Fullscreen → Done.
```

No dashboard, no registration, no hardware configuration in Phase 1. Keep it lean — adoption first.

---

### 4.7 Build Status (Updated Apr 2026)

| Step | Item | Status |
|------|------|--------|
| 1 | `Match`, `MatchEvent` models | ✅ Done |
| 2 | Socket.io real-time match scoring (`match:<id>` room) | ✅ **Implemented** (Mar 2026) |
| 3 | `/scoreboard/:matchId` web page (fullscreen, TV-optimised) | ✅ **Implemented** (Mar 2026) |
| 4 | Reconnect handling + edge cases (match end, pause) | ⬜ Pending |
| 5 | `VenueDisplay` model + court mapping | ✅ **Implemented** (Mar 2026) |
| 6 | `DisplayPairing` QR pairing flow | ✅ **Implemented** (Mar 2026) |
| 7 | Venue display management (venue-owner control) | ✅ **Implemented** — medium depth |
| 8 | Venue control panel (Phase 3) | ⬜ Planned |

**Current state:** The Phase 1 Foundation is complete. Phase 2 (Stability — reconnect, edge cases) is the next build priority for the scoreboard.

---

### 4.8 Future Data Model (VenueDisplay — Phase 2)

```prisma
model VenueDisplay {
  id             Int     @id @default(autoincrement())
  venueId        Int
  courtId        String? // "Court 1", "Turf A"
  displayType    String  // smart_tv | android_tv | fire_stick | tablet
  deviceToken    String? // for authenticated display sessions
  currentMatchId Int?    // FK to Match
  isOnline       Boolean @default(false)
  lastPing       DateTime?
  createdAt      DateTime @default(now())

  venue        Venue  @relation(...)
  currentMatch Match? @relation(...)
}
```

Socket room upgrade path: `match:<id>` → `display:<venueDisplayId>` (when multiple courts need independent control).

---

### 4.9 Monetisation Strategy

| Phase | Model | Price | Goal |
|-------|-------|-------|------|
| Phase 1 | **Free** | ₹0 | Adoption, habit formation, venue onboarding |
| Phase 2 | **SaaS subscription** | ₹999–₹2,499/month/screen | Revenue |
| Phase 2 | **Hardware + SaaS bundle** | ₹1,499–₹3,999/month | Managed service |
| Phase 3 | **Freemium** | Free basic, paid branding + analytics | Upsell |

**Freemium hook:** Give clean scoreboard free → upsell venue-branded UI, advanced analytics, multi-court dashboard.

---

### 4.10 Advertising Policy

**Rule: Never force ads. Always give control to the venue.**

| Mode | Description |
|------|-------------|
| **No Ads (Default)** | Clean scoreboard. Safe for initial adoption. |
| **Venue-Owned Ads** | "Sponsored by XYZ Gym" — local business. Venue loves this. |
| **Shared Revenue Ads (Opt-in)** | Sportza brings sponsors, revenue split (e.g. 70% venue / 30% Sportza). Only after trust is built. |

Venues will not allow third-party ads on their physical space by default — this is their turf (literally). The opt-in model respects that.

---

### 4.11 Explicit De-scope (What This Is Not)

The following are **permanently out of scope** for this feature:

- Raspberry Pi or custom LED matrix hardware
- Crowd reactions, emoji bursts, social interaction
- AI / camera-based automatic scoring
- Multi-court dashboard view on the board
- Complex display management UI (Phase 1)
- Sound or audio feedback

---

### 4.12 Build Phases

```
Phase 1 — Foundation
  ├── Socket.io real-time events (match:<id> room)
  ├── /scoreboard/:matchId web page
  └── Clean, minimal scoreboard UI (TV-optimised)

Phase 2 — Stability
  ├── Reconnect + disconnect handling
  ├── Edge cases: match end, pause, walkover
  └── VenueDisplay model (court mapping)

Phase 3 — Control
  ├── Venue control panel (assign match to display)
  ├── Simple display management
  └── Branding options (venue logo)

Phase 4 — Monetisation
  ├── Subscription billing
  ├── Venue-controlled ad slots
  └── Optional Sportza revenue-share ads
```

---

### 4.13 Success Metrics

**Early signals:**
- % of matches using scoreboard view
- Avg time display is active per day per venue
- Repeat usage week-over-week

**Strong signal:**
> Venues ask: *"Can we get this on all our courts?"*

---

## 5. Apr 2026 Sprint — What Moved from Future to Implemented

The following items in the backlog above were fully delivered in the Apr 27–28, 2026 sprint:

| Feature | Evidence |
|---------|---------|
| ELO Skill Rating | `services/elo.ts`; `workers/ratingDriftWorker.ts`; `SportSkillRating` + `RatingHistory` models |
| Peer Invites | `routes/peer-invites.ts`; `PeerPlayInvite` model; `PeerInvites.tsx` + `PeerInviteSheet.tsx` |
| Matchmaking (high depth) | `routes/matchmaking.ts` (6 endpoints); `services/connections.ts`; `PlayerConnection` model |
| Notification System | `routes/notifications.ts`; `services/notificationService.ts`; `Notification` model; `Notifications.tsx` |
| Frontend Scoring Engine | `apps/web/src/lib/scoring/` — 11 typed engines; `ScoreMatch.tsx`; `Scoreboard.tsx` |
| Auth: password reset | `routes/auth.ts`; `ForgotPassword.tsx`; `ResetPassword.tsx`; `RefreshToken` model |
| WhatsApp Bridge | `services/whatsappBridge.ts`; `lib/whatsappClient.ts` |
| Edit Profile / Settings | `ProfileEdit.tsx`; `Settings.tsx` and other player pages |
| Production deploy scripts | `deploy/bootstrap.sh`; `deploy/setup-nginx.sh`; `deploy/deploy.sh` |

See `docs/CHANGE_LOG_LAST_30_DAYS.md` entries CL-015 through CL-026 and `docs/ADR_CHANGE_RATIONALE_LOG.md` entries ADR-015 through ADR-026 for full rationale.

---

## 6. Document Index

- **Traceability (all docs):** [TRACEABILITY.md](TRACEABILITY.md)
- **Implementation status (current scope):** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- **Rating system:** [RATING_SYSTEM.md](RATING_SYSTEM.md)
