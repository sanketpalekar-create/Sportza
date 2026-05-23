# Product Optimization Plan - Sportza

**Version:** 1.0  
**Last updated:** Apr 2026

## 1. Objective

This document identifies where Sportza can be improved, simplified, or optimized without changing the core product vision.

It focuses on four questions:

1. What can be improved now?
2. What should be simplified before scale?
3. What should be optimized to improve conversion, retention, and operations?
4. What should be delayed until the product has stronger proof of demand?

## 2. Optimization Themes

| Theme | Current opportunity | Recommended optimization | Impact | Effort |
|------|----------------------|--------------------------|--------|--------|
| Onboarding | Many modules exist, but first-time guidance appears light | Build role-aware onboarding and first success paths | High | Medium |
| Discovery | Venue/trainer/training discovery exists but can fragment attention | Add stronger filters, ranking logic, and saved preferences | High | Medium |
| Booking conversion | Booking is a key revenue funnel | Reduce steps, improve pricing clarity, add trust cues, show availability confidence | High | Low to Medium |
| Payment completion | Split/full payment complexity can create drop-off | Improve payment-state messaging, retries, pending states, receipts, failure recovery | High | Medium |
| Retention | Stats and progress exist but may not actively pull users back | Add reminders, streaks, nudges, invites, and meaningful post-match loops | High | Medium |
| Trainer retention | Trainer tools are strong, but operating cadence matters | Add recurring workflows, batch health alerts, and player engagement insights | Medium to High | Medium |
| Venue-owner retention | Venue ops exist, but owner ROI must be obvious | Add slot-fill insights, cancellation trends, and payout clarity | High | Medium |
| Matchmaking | Suggestions exist, but social conversion path is still early | Push invite actions on profile and discovery surfaces with low-friction follow-up | Medium to High | Medium |
| Scoreboard / display | Display groundwork exists, monetization path is future-facing | Use it first as adoption and venue-brand value, not paid complexity | Medium | Medium |
| Documentation | Existing docs are rich but unevenly current | Maintain one live rollout tracker and refresh stale status docs regularly | High | Low |

## 3. Highest-Leverage Improvisations

### 3.1 Product

- Make the first successful booking, first batch join, and first scored match feel guided.
- Turn stats from passive pages into active reasons to return.
- Treat matchmaking as retention infrastructure, not just a novelty feature.
- Use peer invites to convert player profiles into actionable community surfaces.

### 3.2 UX

- Reduce duplicate navigation paths where a user can reach the same outcome in too many ways.
- Standardize CTA hierarchy across booking, open play, matches, and invites.
- Improve empty states with clear next actions by role.
- Add status language that is consistent across booking, match, open play, payment, and invite flows.

### 3.3 Data and analytics

- Define one canonical funnel for each core motion:
  - discovery -> detail -> booking -> payment -> repeat
  - training discovery -> batch detail -> join -> payment -> review/progress
  - match create -> score -> complete -> stats view -> share / replay
- Add instrumentation for drop-off points before building more top-of-funnel features.

### 3.4 Technical

- Reconcile stale docs against current app/API reality on a regular cadence.
- Add stronger operational runbooks for jobs, refunds, and display pairing.
- Identify modules that need contract tests or happy-path smoke tests first: bookings, payments, match scoring, reports.

## 4. Priority Matrix

### 4.1 Do now

- Refresh current-state documentation and ownership
- Optimize booking conversion path
- Improve payment-state visibility and retries
- Add role-based onboarding and empty states
- Productize peer invites and make them visible from player surfaces

### 4.2 Do next

- Notifications and reminder framework
- Better discovery ranking and local relevance
- Venue-owner utilization insights
- Trainer batch health insights
- Scoreboard stabilization and rollout readiness

### 4.3 Do later

- Dynamic pricing
- Sponsor monetization operationalization
- Premium analytics packaging
- AI video analytics MVP exploration

## 5. Optimization By Business Goal

| Goal | What to optimize first | Why |
|------|------------------------|-----|
| More revenue | Booking funnel, payment completion, venue-owner reporting | Direct impact on GMV and trust |
| More retention | Stats loops, invites, reminders, training progress | Drives repeat use |
| More venue supply | Venue onboarding, payout clarity, scoreboard value proposition | Reduces supply-side friction |
| More trainer adoption | Batch setup, fee collection, progress proof | Makes trainer workflows sticky |
| Better product clarity | Docs, status ownership, rollout discipline | Prevents roadmap drift |

## 6. Areas To Simplify Before Scale

- Avoid launching too many growth surfaces before core conversion metrics stabilize.
- Keep scoreboard as a simple web experience before introducing device management overhead.
- Keep sponsor monetization document-led until tournament scale justifies operational complexity.
- Keep AI analytics as a strategic exploration, not a delivery dependency for current GMV growth.

## 7. Recommended 30-60-90 Day Optimization Plan

### First 30 days

- Clean up documentation drift
- Confirm current-state funnel metrics
- Improve booking and payment confidence states
- Finalize peer invite requirement scope

### Next 60 days

- Launch invite flow and simple inbox/outbox
- Add notifications or reminder primitives
- Improve venue-owner and trainer insight surfaces
- Stabilize scoreboard and display rollout assumptions

### Next 90 days

- Pilot display value with selected venues
- Introduce growth loops around stats, invites, and tournaments
- Package monetization experiments for sponsors or premium venue features

## 8. Risks If Optimization Is Ignored

- Product breadth grows faster than product clarity
- Strong features remain underused due to weak discovery
- Supply-side users do not perceive enough operational ROI
- Future roadmap gets shaped by interesting ideas instead of adoption data

## 9. Working Rule

Before building a net-new feature, ask:

1. Does it improve booking conversion?
2. Does it improve retention?
3. Does it improve venue or trainer stickiness?
4. Can we measure its value within one release cycle?

If the answer is "no" to all four, the feature should probably wait.

## 10. References

- `docs/PRODUCT_MASTER_PLAN.md`
- `docs/MARKET_RESEARCH_AND_STRATEGY.md`
- `docs/FEATURE_ROLLOUT_AND_TRACKER.md`
- `docs/FUTURE_DEVELOPMENT.md`
