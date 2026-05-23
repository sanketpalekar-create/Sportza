# Implementation Status — Sportza Monorepo

**Last updated:** Apr 28, 2026  
**Version:** 2.0  
**HTML:** [implementation-status.html](implementation-status.html)  
**Deployment:** [DEPLOYMENT.md](DEPLOYMENT.md)

This document reflects the current state of the Sportza Turborepo monorepo after the architecture rebuild. All items listed are **implemented**.

---

## 1. Backend (`apps/api`)

### 1.1 Route Files (20)

| Route File | Prefix | Status |
|------------|--------|--------|
| `auth.ts` | `/api/auth` | Done |
| `sports.ts` | `/api/sports` | Done |
| `venues.ts` | `/api/venues` | Done |
| `slots.ts` | `/api/slots` | Done |
| `bookings.ts` | `/api/bookings` | Done |
| `payments.ts` | `/api/payments` | Done |
| `matches.ts` | `/api/matches` | Done |
| `stats.ts` | `/api/stats` | Done |
| `batches.ts` | `/api/batches` | Done |
| `trainers.ts` | `/api/trainers` | Done |
| `open-plays.ts` | `/api/open-plays` | Done |
| `tournaments.ts` | `/api/tournaments` | Done |
| `reports.ts` | `/api/reports` | Done |
| `trainings.ts` | `/api/trainings` | Done |
| `displays.ts` | `/api/displays` | Done |
| `peer-invites.ts` | `/api/peer-invites` | Done |
| `matchmaking.ts` | `/api/matchmaking` | Done |
| `notifications.ts` | `/api/notifications` | Done |
| `schedules.ts` | `/api/schedules` | Done |
| `public.ts` | `/api/public` | Done |

### 1.2 Prisma Models (53)

User, Otp, TrainerProfile, TrainerVenue, Sport, SportFormat, Venue, SportFacility, SportRate, VenueAddOn, Facility, Slot, FacilityPricingRule, VenueReview, TrainerReview, Booking, SplitPayment, BookingAddOn, BookingPayment, Refund, OpenPlay, OpenPlayPlayer, Match, MatchEvent, MatchConfirmation, Tournament, TournamentFixture, Batch, BatchMembership, BatchSession, SessionAttendance, BatchPayment, BatchAnnouncement, PlayerBatchReview, Activity, ActivityParticipant, Participation, SportEvent, PlayerActivityStats, PlayerStats, **VenueDisplay**, **DisplayPairing**, **SportSkillRating**, **RatingHistory**, **PlayerConnection**, **PeerPlayInvite**, **Notification**, **RefreshToken**, and related entities.

> **VenueDisplay** and **DisplayPairing** (Mar 2026): smart scoreboard pairing flow.  
> **SportSkillRating**, **RatingHistory** (Apr 2026): ELO-based skill rating system.  
> **PlayerConnection** (Apr 2026): bidirectional social graph for matchmaking.  
> **PeerPlayInvite** (Apr 2026): structured peer-to-peer play invitations.  
> **Notification** (Apr 2026): in-app notification store.  
> **RefreshToken** (Apr 2026): JWT refresh token store for auth.

### 1.3 Services (12)

| Service | Purpose |
|---------|---------|
| `bookingConflict` | Slot conflict resolution (payment-priority) |
| `openPlayConfirmations` | T-30 open-play confirmation logic |
| `refundService` | Razorpay refunds |
| `scoring` | Score validation (simple, cricket, tennis, padel, pickleball rally/service) |
| `matchLogging` | Match event logging |
| `tournamentFixtures` | Fixture generation (round-robin, knockout, standings) |
| `trainerService` | Sessions, settlement, commission, monthly reviews |
| `elo` | 7-factor ELO rating calculation engine |
| `connections` | `PlayerConnection` bidirectional social graph upsert |
| `notificationService` | `createNotification()` helper; write-to-Notification-table |
| `whatsappBridge` | WhatsApp deep-link URL generator (payment, session, progress templates) |
| `bookingHelpers` | Shared slot availability checks, hold creation, conflict detection |

### 1.4 Middleware

| Middleware | Purpose |
|------------|---------|
| Auth0 JWT | `jwtCheck`, `attachUser`, `requireAuth` for protected routes |
| `validate` | Zod-based request validation |
| `errorHandler` | Structured error responses, AppError handling |

### 1.5 Workers (4)

| Worker | Queue | Purpose |
|--------|-------|---------|
| Email worker | `email` | OTP and magic-link delivery |
| Refund worker | `refunds` | Async Razorpay refund processing |
| `ratingDriftWorker` | `rating-drift` | Monthly 0.5% rating pull toward 1000 |
| `holdCleanupWorker` | `hold-cleanup` | Expire stale booking holds from timed-out payments |

### 1.6 Infrastructure

| Component | Status |
|-----------|--------|
| Redis | OTP/session storage (ioredis) |
| BullMQ | Email, refund, rating-drift, hold-cleanup workers |
| S3 (Multer) | File uploads (venue images, etc.) |
| Nodemailer | OTP emails, magic links, password reset |
| OpenAPI / Swagger | Auto-generated spec, `/api/docs` UI |
| Socket.io | Real-time match scoring rooms; display pairing events |

---

## 2. Frontend (`apps/web`)

### 2.1 Pages by Domain (60+ total)

| Domain | Pages | Status |
|--------|-------|--------|
| **Home / Auth** | Home, Login, Register, Profile, ForgotPassword, ResetPassword | Done |
| **Venues** | VenueList, VenueDetail | Done |
| **Booking** | InstantBook, BookingHistory, BookingDetail | Done |
| **Matches** | MatchList, LiveMatch, ScoreMatch, Scoreboard, MatchSumula | Done |
| **Open Play** | OpenPlayList, OpenPlayDetail, CreateOpenPlay, ManageSession | Done |
| **Stats** | StatsOverview, SportAnalyticsHub, SportDashboard, MatchAnalytics, Leaderboard, ProgressRadarChart | Done |
| **Trainer** | TrainerDashboard, TrainerBatches, CreateBatch, BatchDetail, TrainerSessions, TrainerPayments, TrainerReviews, TrainerProfile, TrainerBatchCalendar, PlayerProgressCard | Done |
| **Tournaments** | TournamentList, TournamentDetail, CreateTournament, TournamentRegister, TournamentSpectator, EditTournament | Done |
| **Venue Owner** | VenueDashboard, VenueBookings, VenueFacilities, VenuePayments, MyVenues, CreateVenue, VenueDetailOwner, VenueCalendar, VenueSchedule, VenueDisplays, VenueReports, VenueBookingDetail | Done |
| **Payments** | PaymentHistory, PaymentReceipt | Done |
| **Training** | TrainingDiscovery, TrainingBatchDetail | Done |
| **Display / Scoreboard** | Scoreboard (`/scoreboard/:matchId`), PairDisplay (`/display/pair/:token`), ClaimDisplay (`/claim/:token`) | Done |
| **Player** | ProfileEdit, Settings, PlayerProfile, PublicPlayerProgress, Privacy | Done |
| **Matchmaking** | MatchmakingSuggestions, PeerInvites | Done |
| **Notifications** | Notifications | Done |

### 2.2 Layouts & Components

- MainLayout, AuthLayout, AuthGuard, BottomNav
- Role-based navigation (player, trainer, venue_owner)

---

## 3. Packages

### 3.1 `packages/tokens`

- Colors, spacing, radii, fonts, shadows
- Tailwind preset for design system
- **Status:** Done

### 3.2 `packages/ui` (9 components)

Button, Input, Modal, Card, Badge, Table, DatePicker, Rating, StatCard  
**Status:** Done

### 3.3 `packages/api-client` (50+ hooks)

- Axios instance with base URL and auth
- TanStack React Query hooks for: auth, venues, bookings, payments, matches, sports, batches, trainers, open-plays, tournaments, stats, reports, trainings, matchmaking, peer-invites, notifications, skill-ratings
- **Status:** Done

---

## 4. Infrastructure

| Item | Status |
|------|--------|
| Docker Compose | mysql, redis, api, web (4 services) |
| apps/api/Dockerfile | Node + Prisma + tsx |
| apps/web/Dockerfile | Node build + nginx for static |
| pnpm-workspace.yaml | apps/*, packages/* |
| turbo.json | build, dev, lint, typecheck |
| .env.example | DATABASE_URL, REDIS_URL, AUTH0_*, RAZORPAY_*, S3_*, SMTP_* |

---

## 5. Summary Table

| Layer | Count | Status |
|-------|-------|--------|
| API route files | 20 | Done |
| Prisma models | 53 | Done |
| Services / lib | 12 | Done |
| BullMQ workers | 4 | Done |
| Frontend pages | 60+ | Done |
| UI components | 9 | Done |
| API client hooks | 50+ | Done |
| Docker services | 4 | Done |
| Scoring engines (frontend) | 11 | Done |
| Deploy scripts | 3 | Done |

---

## 6. Recent Additions

### Mar 2026

| Item | Detail |
|------|--------|
| VenueDisplay model | Court-level display identity; status: idle / awaiting / live |
| DisplayPairing model | QR-based session token for pairing phone to display |
| Display routes | `/api/displays/*` — generate pairing, claim, status |
| Scoreboard page | `/scoreboard/:matchId` — real-time TV display via Socket.io |
| Socket.io integration | `match:<matchId>` room; events: match:score, match:status |
| Matchmaking API | Implemented (medium depth); rebuilt to high depth in Apr 2026 |
| Sport FKs | `sportId Int?` added to 8 models for referential integrity |
| TrainerProfile–Review relation | Direct `trainerProfileId` FK on TrainerReview |
| Monthly reports | `/api/reports/venues/:venueId/monthly`, `/api/reports/trainers/me/monthly`, `/api/reports/platform/monthly` |
| Player batch reviews | `/api/batches/:id/reviews`, `/api/batches/review-parameters`, `/api/stats/me/reviews` |

### Apr 27–28, 2026

| Item | Detail |
|------|--------|
| ELO Rating System | `elo.ts` (7-factor); `SportSkillRating` + `RatingHistory` models; monthly drift worker |
| Peer Invites | Full API (5 endpoints) + `PeerPlayInvite` model + frontend pages |
| Matchmaking rebuild | 6 endpoints; rating-aware suggestions; player network graph |
| `PlayerConnection` graph | Bidirectional social graph; auto-built from match/openplay/batch interactions |
| Notification system | 5 endpoints; `Notification` model; `notificationService`; frontend page |
| Frontend scoring engines | 11 typed engines under `apps/web/src/lib/scoring/` |
| ScoreMatch + Scoreboard pages | Touch-friendly scoring UI + Socket.io-driven TV display |
| Auth enhancements | Forgot-password + reset-password + refresh tokens; `RefreshToken` model |
| WhatsApp bridge | Deep-link generator (payment, session, progress templates) |
| 22+ new frontend pages | ProfileEdit, Settings, PlayerProfile, MatchmakingSuggestions, PeerInvites, Notifications, VenueCalendar, VenueSchedule, VenueDisplays, VenueReports, TournamentRegister, TournamentSpectator, EditTournament, TrainerBatchCalendar, PlayerProgressCard, PublicPlayerProgress, Privacy, ForgotPassword, ResetPassword, MatchSumula, CreateVenue, VenueDetailOwner |
| Production deploy scripts | `deploy/bootstrap.sh`, `deploy/setup-nginx.sh`, `deploy/deploy.sh` |
| `schedules.ts` route | Venue schedule management (availability windows, slot generation) |
| `public.ts` route | Unauthenticated venue/player discovery and progress share |
| `holdCleanupWorker` | BullMQ job: expire stale booking holds from timed-out payments |

See `docs/CHANGE_LOG_LAST_30_DAYS.md` for full change log.

---

## 7. Recommended Next Steps

1. **Open play confirmation cron** — BullMQ repeatable job for T-30 confirmations (in migration backlog).
2. **Push notifications** — FCM/APNs for time-sensitive invite and booking alerts (Phase 2).
3. **Refresh token cleanup job** — Periodic removal of expired/revoked RefreshToken rows.
4. **Admin queue dashboard** — Visibility into BullMQ queues (email, refund, rating-drift, hold-cleanup).
5. **Rating leaderboards** — Public per-sport leaderboard pages using `SportSkillRating`.
6. **Splash screen** — Add splash component before redirecting to Login or /app (low priority).
