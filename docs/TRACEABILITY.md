# Document Index & Traceability

## Sportza — Document Index & Traceability

**Version:** 1.7  
**Last updated:** Apr 28, 2026

This document is the **single entry point** for document navigation and requirement traceability across the project. Sportza is a **Turborepo + pnpm monorepo** with:

- **apps/web** — Vite + React + Tailwind + Auth0 + TanStack Query
- **apps/api** — Express + Prisma + Zod + OpenAPI + Redis + BullMQ
- **packages/tokens** — Design tokens
- **packages/ui** — Shared UI components
- **packages/api-client** — API client and TanStack Query hooks

---

## 1. Document index

All docs live in `docs/` at the project root. HTML versions exist for select docs in `docs/*.html`.

| Document | Path | Version | Purpose |
|----------|------|---------|---------|
| **Business Requirements (BRD)** | [BRD.md](BRD.md), [brd.html](brd.html) | 1.3 | Business vision, objectives, capabilities, success criteria, stakeholders, screens. |
| **Functional Requirements (FRD)** | [FRD.md](FRD.md), [frd.html](frd.html) | 1.5 | Functional requirements by module; API summary; screens; traceability to BRD. |
| **Technical Specification (TSD)** | [TSD.md](TSD.md), [tsd.html](tsd.html) | 1.4 | Architecture, tech stack, data model, security, deployment; bridges FRD to implementation. |
| **Data Model** | [DATA_MODEL.md](DATA_MODEL.md), [data-model.html](data-model.html) | 3.3 | Entities, relationships, fields; source of truth for schema (User, Venue, Booking, Refund, OpenPlay, Match, BatchMembership, SportSkillRating, PlayerConnection, PeerPlayInvite, Notification, etc.). |
| **Backend Architecture** | [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) | 2.2 | Folder structure, modules, API routes, database models, payment integration, real-time logic. Maps to `apps/api` in monorepo. |
| **Architecture Refactor Proposal** | [ARCHITECTURE_REFACTOR_PROPOSAL.md](ARCHITECTURE_REFACTOR_PROPOSAL.md) | 1.0 | Modular monolith refactor, module structure, booking engine centralization, payment decoupling. |
| **Schema Refactor Proposal** | [SCHEMA_REFACTOR_PROPOSAL.md](SCHEMA_REFACTOR_PROPOSAL.md) | 1.0 | Three-layer schema (Infrastructure, Marketplace, Sports), Booking/Activity/BookingPayment, migration strategy. |
| **Schema Refactor Implementation** | [SCHEMA_REFACTOR_IMPLEMENTATION.md](SCHEMA_REFACTOR_IMPLEMENTATION.md) | 1.0 | Completed schema refactor (Iterations 1 & 2), migration scripts, new models. |
| **Booking State & Flows** | [BOOKING_STATE_AND_FLOWS.md](BOOKING_STATE_AND_FLOWS.md), [booking-state-and-flows.html](booking-state-and-flows.html) | 2.2 | Master booking logic: states (pending, confirmed, cancelling, cancelled, refunded, completed), instant 3-tap flow, multi-court (groupId), pricing rules, GST, refund policy (48h/24h/6h), BullMQ refund worker. |
| **Booking Flow UX** | [BOOKING_FLOW_UX.md](BOOKING_FLOW_UX.md) | 1.2 | Screen-by-screen booking UX, pricing transparency, CTAs. |
| **Payment Gateway Architecture** | [PAYMENT_GATEWAY_ARCHITECTURE.md](PAYMENT_GATEWAY_ARCHITECTURE.md), [payment-gateway-architecture.html](payment-gateway-architecture.html) | 2.1 | Razorpay integration in apps/api; create-order, verify, webhook; crypto verification; BullMQ refund worker; frontend Razorpay Web SDK; receipt at /payments/receipt/:id. |
| **Navigation** | [NAVIGATION.md](NAVIGATION.md), [navigation.html](navigation.html) | 1.0 | Bottom nav, stack/modals, when to hide nav, full app map, role-based expansion. |
| **Traceability** | [TRACEABILITY.md](TRACEABILITY.md), [traceability.html](traceability.html) | 1.6 | This document: document index and requirement traceability. |
| **UI & UX Requirements Summary** | [UI_UX_REQUIREMENTS_SUMMARY.md](UI_UX_REQUIREMENTS_SUMMARY.md), [ui-ux-requirements-summary.html](ui-ux-requirements-summary.html) | 1.0 | Consolidated UI/UX requirements: philosophy, navigation, booking flow, real-time, screens, interaction rules. |
| **Implementation Status** | [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [implementation-status.html](implementation-status.html) | 2.0 | Server, client, and backend config: 53 models, 20 routes, 60+ pages, 4 workers. |
| **Product Master Plan** | [PRODUCT_MASTER_PLAN.md](PRODUCT_MASTER_PLAN.md) | 1.0 | Portfolio-level product plan: vision, scope, requirements themes, personas, KPIs, and planning gaps. |
| **Product Optimization Plan** | [PRODUCT_OPTIMIZATION_PLAN.md](PRODUCT_OPTIMIZATION_PLAN.md) | 1.0 | Improvement and optimization priorities across product, UX, operations, and monetization. |
| **Product Progress History** | [PRODUCT_PROGRESS_HISTORY.md](PRODUCT_PROGRESS_HISTORY.md) | 1.0 | Narrative of what has been discussed, what has been completed, and what still needs planning. |
| **Market Research and Strategy** | [MARKET_RESEARCH_AND_STRATEGY.md](MARKET_RESEARCH_AND_STRATEGY.md) | 1.0 | Market landscape, customer segments, competitive framing, positioning, and go-to-market direction. |
| **Feature Rollout and Tracker** | [FEATURE_ROLLOUT_AND_TRACKER.md](FEATURE_ROLLOUT_AND_TRACKER.md) | 1.1 | Step-by-step rollout plan plus feature-by-feature status, depth, and requirement drill-down tracking. |
| **Tournament Stages** | [TOURNAMENT_STAGES.md](TOURNAMENT_STAGES.md) | 1.1 | Multi-stage tournaments; league (generateRoundRobin), knockout (generateKnockout), standings (calculateStandings W=3/D=1/L=0); frontend TournamentList, TournamentDetail, CreateTournament. |
| **Venue Owner & Trainer views** | [VENUE_OWNER_AND_TRAINER_VIEWS.md](VENUE_OWNER_AND_TRAINER_VIEWS.md) | 2.1 | Screen list, routes (/venue-owner/*, /trainer/*), VenueFacilities, VenuePayments, TrainerSessions, TrainerPayments, TrainerReviews; Tailwind + @sportza/ui + @sportza/api-client. |
| **Sponsor Monetization Module** | [SPONSOR_MONETIZATION_MODULE.md](SPONSOR_MONETIZATION_MODULE.md) | 1.1 | Tournament-based sponsor revenue: placements, tiered sponsorship, sponsor dashboard. |
| **Brand** | [BRAND.md](BRAND.md) | 1.1 | Product name (Sportza), taglines, logo usage, built-with stack. |
| **Future Development** | [FUTURE_DEVELOPMENT.md](FUTURE_DEVELOPMENT.md) | 2.3 | Planned features and migration backlog; Apr 2026 sprint delivered items flagged as Implemented. |
| **Deployment** | [DEPLOYMENT.md](DEPLOYMENT.md) | 1.0 | Production deployment: env vars, build, health check, Razorpay webhook, optional PM2/nginx. |
| **Change Log (Last 30 Days)** | [CHANGE_LOG_LAST_30_DAYS.md](CHANGE_LOG_LAST_30_DAYS.md) | 2.0 | 26 change entries (CL-001 to CL-026) covering Mar 18 – Apr 28, 2026; workspace-evidence-based change audit. |
| **ADR Change Rationale Log** | [ADR_CHANGE_RATIONALE_LOG.md](ADR_CHANGE_RATIONALE_LOG.md) | 2.0 | 26 ADR-style entries (ADR-001 to ADR-026): Context, Decision, Consequences for every documented change. |
| **Rating System** | [RATING_SYSTEM.md](RATING_SYSTEM.md) | 3.0 | ELO-based Sportza skill rating: 7-factor formula, confidence tiers, MOV, smurf dampener, drift, data model. |
| **Push Notification Audit** | [PUSH_NOTIFICATION_AUDIT.md](PUSH_NOTIFICATION_AUDIT.md) | 1.0 | Notification coverage map: current in-app/socket/email/WhatsApp delivery, missing event triggers, and Phase-2 push roadmap. |

---

## 2. Traceability: BRD → FRD → TSD / Implementation

| BRD (capability / section) | FRD (section / requirements) | TSD / Implementation |
|----------------------------|------------------------------|------------------------|
| Venue and facility management | §4 Sports and venues (FR-SPORT-*, FR-VENUE-*) | §7 Data (Venue, Sport); `apps/api/src/routes/venues.ts`, Prisma models |
| Booking and payments | §5 Booking and payments (FR-BOOK-*, FR-PAY-*) | `apps/api/src/routes/bookings.ts`, `apps/api/src/routes/payments.ts` |
| Refunds (time-based policy, BullMQ) | FR-PAY-4; Booking State & Flows | `apps/api/src/services/refundService.ts`, `apps/api/src/workers/refundWorker.ts` |
| Open play | §6 Open play (FR-OP-*) | `apps/api/src/routes/open-plays.ts` |
| Booking state (pending, confirmed, cancelling, cancelled, refunded, completed) | BOOKING_STATE_AND_FLOWS.md | Prisma Booking model; `apps/api/src/routes/bookings.ts` |
| Matches and scoring | §7 Matches and scoring (FR-MATCH-*) | `apps/api/src/routes/matches.ts` |
| Tournaments | §8 Tournaments (FR-TOUR-*) | `apps/api/src/routes/tournaments.ts`, `apps/api/src/services/tournamentFixtures.ts` (generateRoundRobin, generateKnockout, calculateStandings) |
| Tournament management (UI) | FR-TOUR-9/10/11 | `apps/web` TournamentList, TournamentDetail (Fixtures/Standings/Teams tabs), CreateTournament |
| Batches | §9 Batches (FR-BATCH-*) | `apps/api/src/routes/batches.ts`, Prisma Batch, BatchPayment |
| Trainer Mode | §9 FR-TRAINER-* | `apps/api/src/routes/trainers.ts`, `apps/api/src/routes/batches.ts`; `apps/web` TrainerDashboard, TrainerBatches, TrainerSessions, TrainerPayments, TrainerReviews |
| Venue Owner views | FR-VENUE-* | `apps/web` VenueDashboard, VenueBookings, VenueFacilities, VenuePayments at /venue-owner/* |
| Discovery and ratings | §4 FR-VENUE-3; Trainers §10 | VenueReview, TrainerReview; `apps/api/src/routes/venues.ts`, `apps/api/src/routes/trainers.ts` |
| Player stats | §10 Stats (FR-STAT-*) | `apps/api/src/routes/stats.ts` |
| Monetization and reports | §11 Reports (FR-REPORT-*) | `apps/api/src/routes/reports.ts` |
| Payment gateway | FR-PAY-1, FR-PAY-3; Payment Gateway Architecture | Razorpay SDK in `apps/api`; Razorpay Web SDK in `apps/web`; BullMQ refund worker |
| Navigation and UX | FRD §12 Screens; NAVIGATION.md | `apps/web` routing, NavContext |
| Backend architecture | — | BACKEND_ARCHITECTURE.md; `apps/api/` |

---

## 3. Key requirement IDs (FRD)

| Module | Prefix | Examples |
|--------|--------|----------|
| Auth | FR-AUTH- | FR-AUTH-1, FR-AUTH-2 |
| Sports / Venues | FR-SPORT-, FR-VENUE- | FR-VENUE-1, FR-VENUE-3 |
| Booking / Payments | FR-BOOK-, FR-PAY- | FR-BOOK-1, FR-PAY-1, FR-PAY-4 (refunds) |
| Open play | FR-OP- | FR-OP-1 to FR-OP-5 |
| Matches | FR-MATCH- | FR-MATCH-* |
| Tournaments | FR-TOUR- | FR-TOUR-1 to FR-TOUR-11 |
| Batches | FR-BATCH- | FR-BATCH-* |
| Trainer Mode | FR-TRAINER- | FR-TRAINER-1 to FR-TRAINER-8 |
| Reports | FR-REPORT- | FR-REPORT-1, FR-REPORT-2, FR-REPORT-3 |

---

## 4. Implementation mapping (monorepo layout)

| Area | API (apps/api) | Web (apps/web) |
|------|----------------|-----------------|
| Bookings | `src/routes/bookings.ts` | Booking flow, PaymentScreen |
| Payments & Refunds | `src/routes/payments.ts`, `src/workers/refundWorker.ts` | PaymentScreen, `/payments/receipt/:id`, payment history |
| Open play | `src/routes/open-plays.ts` | OpenPlayTab, create/open play views |
| Venues / Reviews | `src/routes/venues.ts` | VenueDetailScreen, VenueReviewsScreen |
| Trainers / Reviews | `src/routes/trainers.ts` | TrainerListScreen, TrainerDetailScreen, TrainerReviewsScreen |
| Trainer Mode | `src/routes/trainers.ts`, `src/routes/batches.ts` | TrainerDashboard, TrainerBatches, TrainerSessions, TrainerPayments, TrainerReviews, BatchDetail, CreateBatch |
| Venue Owner | Venues, bookings APIs | VenueDashboard, VenueBookings, VenueFacilities, VenuePayments at /venue-owner/* |
| Tournaments | `src/routes/tournaments.ts`, `src/services/tournamentFixtures.ts` | TournamentList, TournamentDetail, CreateTournament |
| Matchmaking | `src/routes/matchmaking.ts`, `src/services/elo.ts`, `src/services/connections.ts` | MatchmakingSuggestions |
| Peer Invites | `src/routes/peer-invites.ts` | PeerInvites, PeerInviteSheet |
| Notifications | `src/routes/notifications.ts`, `src/services/notificationService.ts` | Notifications |
| Skill Ratings | `src/services/elo.ts`, `src/workers/ratingDriftWorker.ts` | Rating history (matchmaking routes) |
| Auth (extended) | `src/routes/auth.ts` | ForgotPassword, ResetPassword |
| Shared UI / API | — | `packages/ui`, `packages/api-client` |

---

## 5. Related document links (for each doc)

When updating any document, ensure **Related documents** or **References** include as applicable:

- **BRD** → FRD, Data Model, Navigation, Booking Flow UX, Booking State & Flows, Payment Gateway Architecture, TSD, **Traceability**
- **FRD** → BRD, Data Model, Booking State & Flows, Payment Gateway Architecture, TSD, **Traceability**
- **TSD** → BRD, FRD, Data Model, Booking State & Flows, Booking Flow UX, Navigation, Payment Gateway Architecture, **Traceability**
- **Data Model** → BRD, FRD, TSD, Booking State & Flows, **Traceability**
- **Booking State & Flows** → FRD, Data Model, Booking Flow UX, Navigation, Payment Gateway Architecture, **Traceability**
- **Payment Gateway Architecture** → FRD, TSD, Booking State & Flows, Data Model, **Traceability**
- **Navigation** → BRD, Booking Flow UX, VENUE_OWNER_AND_TRAINER_VIEWS, **Traceability**
- **UI & UX Requirements Summary** → Navigation, Booking Flow UX, Booking State & Flows, FRD §12, VENUE_OWNER_AND_TRAINER_VIEWS, **Traceability**
- **Venue Owner & Trainer views** → Navigation, FRD, Data Model, Implementation Status, **Traceability**
- **Sponsor Monetization Module** → BRD, FRD (§8 Tournaments), Data Model, Implementation Status, **Traceability**
- **Brand** → README, apps/web index.html, **Traceability**
- **Implementation Status** → FRD §12, TSD, VENUE_OWNER_AND_TRAINER_VIEWS, SPONSOR_MONETIZATION_MODULE, **Traceability**
- **Tournament stages** → FRD §8, DATA_MODEL, **Traceability**
- **Future Development** → DATA_MODEL, NAVIGATION, UI_UX_REQUIREMENTS_SUMMARY, **Traceability**
- **Change Log (Last 30 Days)** → Discussion Log, Feature Rollout Tracker, Data Model, **Traceability**
- **ADR Change Rationale Log** → Change Log (Last 30 Days), Discussion Log, **Traceability**
- **Rating System** → Data Model, Backend Architecture, Implementation Status, **Traceability**
- **Push Notification Audit** → Data Model, Backend Architecture, Implementation Status, Future Development, ADR Change Rationale Log, **Traceability**







