# Feature Rollout And Tracker - Sportza

**Version:** 1.1  
**Last updated:** Apr 28, 2026

## 1. Purpose

This document is the execution-facing tracker for Sportza. It combines:

- Step-by-step feature rollout planning
- Feature-level progress tracking
- Requirement drill-down status
- What level of detailing is achieved vs still needed

Use this as the weekly planning board for product, engineering, and business review.

## 2. Status Legend

| Status | Meaning |
|--------|---------|
| Implemented | Present in app/API/docs with meaningful evidence |
| Partially implemented | Core pieces exist but productization or rollout is incomplete |
| Planned | Scoped in docs but not yet fully delivered |
| Future | Strategic backlog, not current release scope |
| Needs refresh | Exists, but documentation or rollout readiness is outdated |

## 3. Detail Depth Legend

| Depth | Meaning |
|-------|---------|
| High | Business, functional, technical, and product surfaces are largely defined |
| Medium | Core direction exists, but execution details or rollout details are incomplete |
| Low | Concept exists, but requirements are not yet drilled down enough |

## 4. Step-By-Step Rollout Plan

### Phase 0 - Control the source of truth

- Refresh current-state docs and tracker ownership
- Confirm feature status against live web routes and API mounts
- Freeze the next release train and success metrics

### Phase 1 - Core marketplace reliability

- Venue discovery
- Booking
- Payments and refunds
- Booking history and receipts
- Venue-owner booking and payout visibility

Release gate:

- Booking success, payment success, refund handling, and reporting must be reliable enough for repeat venue use.

### Phase 2 - Repeat play loops

- Open play
- Match scoring
- Stats and leaderboard
- Public progress and share surfaces

Release gate:

- Users should have a reason to come back after the initial booking.

### Phase 3 - Structured training and event operations

- Training discovery
- Batches
- Trainer dashboard, sessions, payments, reviews
- Tournaments, fixtures, standings

Release gate:

- Trainers and organizers should be able to run repeated programs with low admin effort.

### Phase 4 - Community and retention layer

- Matchmaking
- Player profile as social surface
- Peer invites
- Reminder / notification strategy

Release gate:

- The platform should start creating repeat local sports interactions, not just one-off transactions.

### Phase 5 - Venue differentiation

- Scoreboard
- Display pairing and claim
- Venue display management
- Venue-facing branding value

Release gate:

- At least a small pilot group of venues should perceive visible customer and operational value.

### Phase 6 - Monetization expansion

- Subscription packaging for venue operations or displays
- Sponsor inventory around tournaments and displays
- Premium reporting and business insights

Release gate:

- Core value is proven before monetization complexity expands.

### Phase 7 - Intelligence layer

- AI video analytics
- Premium performance insights
- Advanced benchmarking and player intelligence

Release gate:

- Only proceed after strong retention and clear willingness to pay.

## 5. Release Readiness Checklist

| Release gate | Required before launch |
|--------------|------------------------|
| Product | Clear user story, clear CTA, clear success metric |
| UX | Empty states, error states, permission states, mobile readability |
| API | Endpoint contract stable, validation and auth rules defined |
| Data | Model ownership, status transitions, analytics events |
| Operations | Logging, alerts, manual recovery path, support notes |
| Business | Monetization policy and ownership defined where relevant |
| Docs | BRD/FRD/technical doc or tracker row updated |

## 6. Master Feature Tracker

| Area | Feature | Status | Depth achieved | Detail still required | Priority | Dependencies | Primary evidence |
|------|---------|--------|----------------|-----------------------|----------|--------------|------------------|
| Identity | Auth0 login and protected access | Implemented | High | Activation analytics, support playbook | P0 | Auth provider, JWT, role guards | README, BRD, FRD, API/web routes |
| Identity | Profile and preferences management | Implemented | High | Notifications push, analytics | P1 | Auth, user model, UX flows | ProfileEdit.tsx, Settings.tsx, Privacy.tsx |
| Catalog | Sports and sport formats | Implemented | High | Sport admin governance | P0 | Sport model and APIs | README, FRD |
| Venues | Venue discovery and detail | Implemented | High | Ranking and personalization strategy | P0 | Venues, reviews, filters | BRD, FRD, App routes |
| Venues | Venue reviews and trust | Implemented | High | Moderation policy | P1 | Auth, review rules | BRD, FRD |
| Booking | Single-facility booking | Implemented | High | Funnel instrumentation | P0 | Slots, payments, pricing | BRD, FRD, booking docs |
| Booking | Multi-court booking | Implemented | High | Operational QA coverage | P1 | Booking grouping, payment handling | FRD, booking docs |
| Booking | Add-ons and GST-aware pricing | Implemented | High | More UX polish and analytics | P1 | Pricing rules, booking summary | BRD, FRD |
| Payments | Razorpay checkout and verify | Implemented | High | Failure recovery messaging | P0 | Payment gateway, webhooks | README, payment architecture |
| Payments | Refund workflows | Implemented | High | Ops runbook and support scripts | P0 | Refund worker, cancellation rules | FRD, booking state docs |
| Open play | Open play creation and join flows | Implemented | High | Retention messaging and reminder strategy | P1 | Bookings, player list, payments | BRD, FRD, App routes |
| Matches | Match creation and management | Implemented | High | Better organizer workflows | P1 | Bookings, tournaments | FRD, App routes |
| Matches | Live scoring and socket updates | Implemented | High | Event naming and docs consistency refresh | P0 | Match model, socket server | API index, FUTURE_DEVELOPMENT mismatch |
| Stats | Player stats and leaderboard | Implemented | High | Growth loops and sharing strategy | P1 | Matches, sport-specific stats | README, FRD, App routes |
| Training | Training discovery | Implemented | High | Better conversion funnel from discovery to join | P1 | Batches, trainers | App routes, FRD |
| Training | Player batch join experience | Implemented | Medium | Lifecycle comms and churn handling | P1 | Batch detail, payments | FRD, web pages |
| Trainer ops | Trainer dashboard and profile | Implemented | High | KPI standardization | P0 | Trainer routes, batch data | FRD, App routes |
| Trainer ops | Sessions and attendance | Implemented | High | Notifications and attendance insights | P1 | Batch sessions, attendance data | FRD, pages |
| Trainer ops | Batch payments and settlement | Implemented | High | Collections analytics and reminders | P0 | BatchPayment, reports | BRD, FRD |
| Trainer ops | Monthly player reviews and progress | Implemented | High | Better progress storytelling and retention loops | P1 | Review parameters, stats/reviews | DISCUSSION_LOG, FRD |
| Tournaments | Tournament create/list/detail | Implemented | High | Better shareability and organizer onboarding | P1 | Fixtures, matches | FRD, App routes |
| Tournaments | Fixtures and standings | Implemented | High | Sponsor attachment strategy | P1 | Tournament engine | TOURNAMENT_STAGES, FRD |
| Reports | Venue, trainer, platform reports | Implemented | High | Review cadence and dashboard layer | P0 | Booking and batch payment data | BRD, FRD, API routes |
| Venue-owner ops | Venue dashboard, bookings, facilities, payments | Implemented | High | Utilization insights and alerts | P0 | Venue and report data | Venue-owner pages, docs |
| Venue-owner ops | Venue reports | Implemented | Medium | Decision-support dashboards | P1 | Reports APIs | App routes, FRD |
| Public surfaces | Public player progress share | Implemented | Medium | Viral loop strategy and access policy | P2 | Stats, trainer reviews | App routes, API index |
| Matchmaking | Matchmaking suggestions | Implemented | High | Rate limiting, push notification on new match | P1 | Connections, player graph, ELO ratings | matchmaking.ts (6 endpoints), MatchmakingSuggestions.tsx |
| Matchmaking | Player network graph | Implemented | High | 2-hop traversal optimisation at scale | P1 | PlayerConnection model, connections.ts | matchmaking.ts /network, connections.ts |
| Matchmaking | Skill rating (ELO) | Implemented | High | Rating leaderboard page, smurf detection tuning | P1 | SportSkillRating, RatingHistory, elo.ts | RATING_SYSTEM.md, matchmaking.ts |
| Social | Player profiles | Implemented | High | Social identity and network surface strategy | P1 | Matchmaking, stats, invites | PlayerProfile.tsx, PublicPlayerProgress.tsx |
| Social | Peer invites for future play | Implemented | High | Rate-limit anti-spam, push notification on accept | P1 | Player profiles, PeerPlayInvite model | peer-invites.ts, PeerInvites.tsx |
| Platform | Notifications | Implemented | Medium | Push notifications (FCM/APNs), preference center | P1 | Notification model, notificationService | notifications.ts, Notifications.tsx |
| Displays | Scoreboard page | Implemented | Medium | TV optimization validation, reconnect edge cases | P2 | Socket events, match state | App routes, FUTURE_DEVELOPMENT |
| Displays | Pair / claim display flows | Implemented | Medium | Security, admin controls, venue training | P2 | Display tokens, auth, venue workflows | App routes, API index |
| Displays | Venue display management | Implemented | Medium | Rollout SOPs and business packaging | P2 | Displays routes, venue-owner mode | App routes, API index |
| Monetization | Sponsor module | Planned | Medium | Product package, sales workflow, data model execution | P3 | Tournament scale, inventory | SPONSOR_MONETIZATION_MODULE |
| Monetization | Dynamic pricing | Future | Low | Product rules, data signals, venue controls | P3 | Booking demand data | FUTURE_DEVELOPMENT |
| Platform | Push / PWA | Future | Low | Platform strategy and lifecycle value proof | P3 | Notifications, web app shell | FUTURE_DEVELOPMENT |
| Platform | WhatsApp bridge | Implemented | Medium | Bulk send (needs Business API), delivery tracking | P2 | whatsappBridge.ts, trainer UX | whatsappBridge.ts, whatsappClient.ts |
| Intelligence | AI video analytics | Future | Medium | MVP scope, capture workflow, pricing, ops | P3 | Match data, storage, model pipeline | FUTURE_DEVELOPMENT |

## 7. Requirement Drill-Down Tracker

This table tracks whether each major feature family has been detailed deeply enough.

| Feature family | Business doc | Functional doc | Technical doc | UX detail | Rollout detail | GTM detail | Current assessment |
|----------------|--------------|----------------|---------------|-----------|----------------|-----------|-------------------|
| Auth and roles | Yes | Yes | Yes | Medium | Low | Low | Strong product core, weak market narrative |
| Venues and booking | Yes | Yes | Yes | High | Medium | Medium | Strongest commercialization path |
| Payments and refunds | Yes | Yes | Yes | Medium | Medium | Low | Strong ops backbone, needs support playbooks |
| Open play | Yes | Yes | Medium | Medium | Low | Low | Good feature depth, lighter rollout planning |
| Matches and scoring | Yes | Yes | Medium | Medium | Low | Low | Technically meaningful, needs clearer packaging |
| Stats and leaderboard | Yes | Yes | Medium | Medium | Low | Medium | Good retention feature, under-positioned |
| Training and batches | Yes | Yes | Medium | Medium | Low | Medium | Strong value, can become a wedge |
| Trainer mode | Yes | Yes | Medium | Medium | Low | Medium | Strong B2B-adjacent opportunity |
| Tournaments | Yes | Yes | Medium | Medium | Low | Medium | Good operational depth, needs growth story |
| Matchmaking | High | High | High | Medium | Medium | Medium | Fully rebuilt rating-aware (Apr 2026); needs leaderboard and GTM |
| Peer invites | High | High | High | Medium | Medium | Medium | Fully implemented (Apr 2026); needs anti-spam and push notification |
| Skill rating (ELO) | High | High | High | Medium | Low | Low | Implemented (Apr 2026); needs leaderboard page and rollout story |
| Displays / scoreboard | Medium | Low | Medium | Medium | Medium | Medium | Strong differentiator, rollout discipline required |
| Sponsor monetization | Medium | Medium | Low | Low | Low | Medium | Strategic but premature |
| AI analytics | Medium | Low | Low | Low | Low | Medium | Future-facing and exploratory |

## 8. Immediate Action Queue (Updated Apr 28, 2026)

1. **Rating leaderboard page** — Build a public per-sport leaderboard using `SportSkillRating`.
2. **Anti-spam for peer invites** — Add rate limiting (max 5 pending invites per user per day).
3. **Push notifications (Phase 2)** — FCM/APNs for peer invite accepted, booking confirmed.
4. **Refresh token cleanup job** — Periodic pruning of expired/revoked `RefreshToken` rows.
5. **Open play T-30 confirmation cron** — BullMQ scheduled job still outstanding.
6. **Admin queue dashboard** — Visibility into BullMQ queue health (Bull Board or similar).
7. **Define north-star metrics** — 3–5 KPIs every release must tie back to (DAU, booking conversion, match completion rate).

## 9. References

- `docs/PRODUCT_MASTER_PLAN.md`
- `docs/PRODUCT_OPTIMIZATION_PLAN.md`
- `docs/PRODUCT_PROGRESS_HISTORY.md`
- `docs/MARKET_RESEARCH_AND_STRATEGY.md`
- `docs/TRACEABILITY.md`
- `c:\Users\user\.cursor\plans\peer_invite_feature_c9279b5d.plan.md`
