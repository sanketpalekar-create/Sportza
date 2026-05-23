# Migration Execution Plan (Web to Mobile)

## Objective
Deliver a production-ready mobile experience on top of the existing Sportza platform (`apps/web`, `apps/api`, `packages/api-client`, `packages/ui`, `packages/tokens`) without reducing reliability, conversion, or operational control.

## Success Criteria
- No regression in core journey quality (auth, booking, payment).
- Mobile closed-group rollout reaches stability thresholds before public release.
- API and client contract drift remains at zero for release branches.
- Migration documentation stays current and auditable.

## Program Structure: Three Parallel Tracks
All tracks run in parallel with a weekly release readiness review.

## Track A: API Contracts and Backend Stability
### Workstream
- Freeze and classify endpoint groups using `API_COMPATIBILITY_MATRIX.md`.
- Enforce contract-first updates via OpenAPI generation and `packages/api-client` regeneration.
- Harden critical mutation endpoints for idempotency and clear error semantics.

### Deliverables
- Updated compatibility status for launch-priority endpoint groups.
- Contract change log for each release increment.
- Backend rollback notes for auth and payments.

## Track B: Mobile Capability Readiness
### Workstream
- Build and validate adapters for auth persistence, Razorpay handoff, push subscriptions, maps providers, and deeplink routing.
- Ensure every risky capability is behind flags from `FEATURE_FLAG_CATALOG.md`.
- Validate fallback behavior for unsupported capability/device conditions.

### Deliverables
- Capability readiness report by platform and region.
- Feature flag rollout evidence (internal and closed-group stages).
- Recovery behavior checklist for each adapter.

## Track C: Quality, Operations, and Rollout Governance
### Workstream
- Define closed-group cohorts and expansion policy.
- Instrument migration KPIs and alert thresholds.
- Run release gates and rollback rehearsals before each cohort expansion.

### Deliverables
- Closed-group roster and staged ramp plan.
- Weekly risk register with active mitigations.
- Go/No-Go decision log per rollout phase.

## Phase Plan
| Phase | Duration (Guideline) | Primary Goal | Exit Gate |
|---|---|---|---|
| 0 - Baseline Lock | Week 1 | confirm contract baseline and launch scope | architecture + matrix + flag catalog approved |
| 1 - Internal Hardening | Weeks 2-3 | validate adapters and critical API paths with internal users | no P0/P1 issues, KPI baseline established |
| 2 - Closed Group Alpha | Weeks 4-5 | invite small external cohort, validate real-world reliability | auth/payment/push KPIs within threshold |
| 3 - Closed Group Beta | Weeks 6-7 | increase cohort and device/network diversity | stable metrics across cohorts for one full cycle |
| 4 - Public Readiness | Week 8 | finalize playbooks, support, and release controls | Go/No-Go approval signed by track owners |
| 5 - Public Rollout | Week 9+ | staged public release with active monitoring | no rollback trigger during staged ramp |

## Closed-Group Rollout Policy
- Start with trusted cohorts: staff, partners, high-feedback users.
- Add users by defined slices (region, OS version, network profile, feature usage intensity).
- Never scale cohort size and feature scope in the same release window.
- Maintain instant rollback ability through feature flags.

## Rollback Triggers (Mandatory)
- Auth success drops below agreed threshold for 30+ minutes.
- Payment order->verify conversion drops materially versus web baseline.
- Mobile API 5xx or timeout rates exceed release guardrails.
- Crash-free session rate breaches agreed reliability floor.
- Data integrity anomaly in bookings/payments/wallet reconciliation.

## Risk Management Register (Working Template)
| Risk ID | Risk | Likelihood | Impact | Detection | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R1 | Contract drift between API and mobile client | Medium | High | generated client diff + runtime contract checks | block release on contract mismatch | Track A | Open |
| R2 | Auth token lifecycle instability | Medium | High | 401 spike + forced logout telemetry | staged rollout + secure session fallback | Track B | Open |
| R3 | Payment completion regression | Low-Med | Critical | payment funnel and webhook mismatch alerts | native checkout flag rollback + web fallback | Track B | Open |
| R4 | Push permission and token churn | Medium | Medium | subscription success and churn dashboards | permission-aware onboarding + re-register logic | Track B | Open |
| R5 | Cohort rollout operational gaps | Medium | High | release checklist misses + support ticket spikes | strict go/no-go gate and owner sign-off | Track C | Open |

## Documentation Standards (Strict)
These rules are mandatory for migration work:
- Update all four migration docs in the same change when scope/contract/rollout changes.
- Every release checkpoint must include:
  - compatibility matrix updates,
  - flag status updates,
  - active risk register updates.
- Use consistent terms: `Internal`, `Closed Group`, `Public`; avoid ad-hoc labels.
- Every decision must include date, owner, and rationale.
- Any exception to process requires explicit approver and expiration date.

## Operating Cadence
- Daily: track-level standup with blocker and risk review.
- Weekly: cross-track readiness review and cohort decision.
- Per phase gate: formal Go/No-Go checklist with sign-off.

## Immediate Next Actions
1. Validate launch-priority endpoint groups in `API_COMPATIBILITY_MATRIX.md`.
2. Assign owners and initial statuses for all flags in `FEATURE_FLAG_CATALOG.md`.
3. Confirm phase durations and KPI thresholds with product and operations.
4. Begin Phase 0 baseline lock and schedule first weekly readiness review.
