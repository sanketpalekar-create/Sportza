# Product Master Plan - Sportza

**Version:** 1.0  
**Last updated:** Apr 2026

## 1. Purpose

This document consolidates the product plan for Sportza at a portfolio level. It is meant to answer:

- What the full product is intended to become
- What requirements are already defined
- What additional requirements are likely needed before broader rollout
- Which product areas are mature, emerging, or still exploratory

This document complements the BRD, FRD, TSD, and feature-specific docs. It does not replace them.

## 2. Product Definition

Sportza is a multi-sport community platform that combines:

- Venue discovery and booking
- Training discovery and trainer operations
- Open play and peer coordination
- Match creation, scoring, and statistics
- Tournament operations
- Venue-owner operations and reporting
- Future social, display, and intelligence layers

Working product line:

> Book. Train. Track.

Extended product ambition:

> Sportza becomes the operating system for community sports participation, venue commerce, coaching, match intelligence, and local sports networks.

## 3. Product Vision

### 3.1 Near-term vision

Create the best sport-specific workflow for a player to:

1. Discover where to play
2. Book or join a session
3. Track match outcomes and progress
4. Return frequently because the platform retains history, relationships, and utility

### 3.2 Mid-term vision

Create the best operating system for:

- Venue owners managing bookings, pricing, payments, reports, and displays
- Trainers managing batches, attendance, reviews, and earnings
- Communities organizing open play, peer invites, and tournaments

### 3.3 Long-term vision

Evolve from sports marketplace to sports intelligence platform with:

- Smart venue displays
- Richer player graph and matchmaking
- Premium analytics
- AI-assisted video analysis
- Sponsor-led monetization around events and competition

## 4. Core Personas

| Persona | Primary job-to-be-done | Success signal |
|---------|-------------------------|----------------|
| Player | Find a venue/session/trainer and keep playing consistently | Faster booking, more sessions played, better personal stats |
| Venue owner | Fill slots, reduce manual work, improve revenue visibility | Higher utilization, fewer support calls, clear payouts |
| Trainer | Run batches efficiently and show player improvement | Better attendance, predictable fee collection, visible progress tracking |
| Tournament organizer | Structure events and keep results updated | Faster setup, fewer manual errors, shareable standings |
| Admin / platform operator | Keep data, commerce, and quality under control | Reliable operations, growth in GMV, better reporting |

## 5. Product Pillars

| Pillar | Why it matters | Representative modules |
|--------|----------------|------------------------|
| Commerce | Revenue foundation of the platform | Venues, bookings, payments, refunds, reports |
| Participation | Keeps users active and retained | Open play, matchmaking, peer invites, tournaments |
| Performance | Differentiates beyond booking | Match scoring, stats, progress tracking, leaderboard |
| Operations | Makes B2B sides sticky | Trainer mode, venue-owner mode, displays, settlement |
| Network | Increases repeat usage and social pull | Player discovery, invites, relationships, local surfaces |

## 6. Planned Product Scope

| Domain | Product intent | Current state | Likely maturity target |
|-------|----------------|---------------|------------------------|
| Identity and access | Secure login, role-aware experiences, profile ownership | Implemented core auth and roles | Mature MVP |
| Sports catalog | Multi-sport support with format-specific behavior | Implemented | Mature MVP |
| Venue discovery | Browse, filter, compare, review | Implemented | Mature MVP |
| Venue booking | Fast booking, multi-court support, add-ons, GST-aware pricing | Implemented | Mature MVP |
| Payments and refunds | Razorpay order, verify, receipts, refund handling | Implemented | Mature MVP |
| Open play | Publish and join community sessions | Implemented | Mature MVP |
| Match scoring | Sport-aware manual scoring and live updates | Implemented | Mature MVP |
| Stats and leaderboard | Match-driven personal and comparative insights | Implemented | Mature MVP |
| Trainer ecosystem | Discovery, batches, attendance, reviews, payments | Implemented | Mature MVP |
| Tournament operations | Setup, fixtures, standings, result tracking | Implemented | Mature MVP |
| Matchmaking | Suggestions based on adjacency and relevance | Implemented | Emerging |
| Peer invites | Future-play intent between players | Planned / recently scoped | Emerging |
| Venue displays | Pairing, claiming, scoreboard surfaces | Partially implemented | Emerging |
| Sponsor monetization | Event-led sponsor inventory and revenue | Planned in docs | Future |
| AI analytics | Video-led performance intelligence | Planned in docs | Future |

## 7. Product Requirements Snapshot

### 7.1 Must-have requirements

These are foundational for product-market fit in the current Sportza shape.

- Auth must support secure login, token-based API access, and role-based permissions.
- Sports must remain configurable enough to support sport-specific scoring and stats.
- Venue booking must remain the fastest high-confidence flow in the system.
- Payments must be reliable, reconcilable, and auditable.
- Refund logic must be predictable and visible to platform operators.
- Match scoring must be usable during real play, not just after the event.
- Stats must connect directly to real match outcomes, not manual spreadsheets.
- Trainer workflows must support batch operations end-to-end.
- Venue-owner workflows must expose bookings, payments, and reports clearly.

### 7.2 Should-have requirements

- Better profile editing and user preferences
- Notification center and reminder strategy
- Stronger onboarding for new users and new venues
- Better recommendations across venue, trainer, and player discovery
- Better dashboarding for venue utilization and trainer retention
- Full split-payment UX polish
- Safer and clearer dispute / support handling

### 7.3 Could-have requirements

- Push notifications
- PWA support
- Dynamic pricing
- Venue branding on scoreboard displays
- Premium analytics packages
- Sponsor packages per tournament or venue network

## 8. Possible Additional Requirements To Formalize

These are not yet consistently drilled down across all docs and should be planned explicitly.

### 8.1 Product and UX

- First-time user onboarding by role
- Empty-state strategy for zero venues, zero batches, zero matches
- Invite acceptance / decline / reminder UX
- Profile completeness scoring
- Support and dispute flows

### 8.2 Data and policy

- Data retention rules for inactive accounts
- Rating abuse prevention and moderation policies
- Venue-owner refund override policy
- Duplicate entity management for venues and trainers
- Audit logs for financial and operational actions

### 8.3 Operations and scale

- Production observability and alert thresholds
- Scheduled jobs ownership and failure handling
- Payment reconciliation runbooks
- Display device lifecycle and claim security
- KPI dashboard definitions for product and business review

### 8.4 Growth

- Referral loops for players and venues
- Batch / league / tournament acquisition funnels
- Re-engagement campaigns for dormant users
- Conversion funnel ownership by channel

## 9. Non-Functional Requirements To Track

| Area | Requirement direction |
|------|-----------------------|
| Reliability | Booking, payment, and scoring paths should have clear retry and recovery behavior |
| Performance | Venue search, booking creation, and live scoring should feel immediate on mobile networks |
| Security | Auth, payments, and private role data must be access-controlled and auditable |
| Scalability | Multi-sport and multi-city growth should not force a redesign of routing or data models |
| Maintainability | Feature docs should map cleanly to route files, hooks, pages, and data models |
| Analytics | Key conversion and retention events should be explicitly defined before broad launch |

## 10. Business Outcomes To Measure

| Outcome | Leading indicators |
|---------|--------------------|
| Player growth | New registrations, first booking rate, repeat booking rate |
| Venue success | Venue onboarding rate, slot utilization, monthly GMV per venue |
| Trainer success | Active batches, paid batch memberships, trainer retention |
| Community depth | Open play joins, tournament creation, peer invites sent/accepted |
| Product stickiness | Weekly active users, matches scored, stats views, progress-card shares |
| Monetization | Booking GMV, commissions, subscription upsell readiness for displays and premium analytics |

## 11. Open Planning Questions

- Which module is the primary wedge in go-to-market: booking, training, or venue operations?
- Is peer networking a retention feature, or a new growth surface that deserves its own roadmap?
- What is the minimum reporting depth required before onboarding larger venues?
- When should scoreboard displays move from free adoption tool to paid product?
- Which metrics must be visible weekly to decide what to build next?

## 12. Recommended Documentation Follow-up

1. Keep `BRD.md`, `FRD.md`, and `TSD.md` as source-of-truth requirement docs.
2. Use `FEATURE_ROLLOUT_AND_TRACKER.md` as the live execution board.
3. Use `PRODUCT_PROGRESS_HISTORY.md` as the planning and milestone narrative.
4. Use `MARKET_RESEARCH_AND_STRATEGY.md` for positioning, GTM, and monetization decisions.

## 13. References

- `docs/BRD.md`
- `docs/FRD.md`
- `docs/TSD.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/FUTURE_DEVELOPMENT.md`
- `docs/TRACEABILITY.md`
