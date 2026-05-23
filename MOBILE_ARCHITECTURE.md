# Mobile Architecture for Web-to-Mobile Migration

## Purpose
Define a stable, contract-first architecture for adding a mobile app without degrading quality in the existing `apps/web` and `apps/api` stack.

## Scope and Constraints
- In scope: API contracts, shared package usage, rollout and operational controls, documentation standards.
- Out of scope: direct feature implementation in app code.
- Non-negotiable: no behavior regressions for current web users.

## Current Repository Baseline
- `apps/web`: React + Vite frontend using `@sportza/api-client`, `@sportza/ui`, `@sportza/tokens`.
- `apps/api`: Express + Prisma backend with OpenAPI generated from route schemas and served at `/api/docs` and `/api/docs.json`.
- `packages/api-client`: generated and curated API hooks/types (`orval` + custom axios mutator).
- `packages/ui`: reusable presentational components for web (reference patterns for mobile design parity).
- `packages/tokens`: shared design tokens (color, spacing, radii, shadows, typography) as the single visual source of truth.

## Architecture Principles
1. Contract-first before client development.
2. Reuse backend contracts, not endpoint forks.
3. Keep shared domain logic in packages, keep platform logic at app edges.
4. Feature-gate all mobile-only or risky behavior.
5. Roll out to closed cohorts before broad release.
6. Documentation is required for every interface and rollout decision.

## Target Mobile Architecture (Logical)
## 1) Contract Layer
- `apps/api` remains the system of record.
- OpenAPI from backend route schemas is the canonical API contract.
- Mobile consumes `packages/api-client` generated from `apps/api/openapi.json`.

## 2) Shared Domain and UI Foundations
- `packages/tokens` drives visual consistency between web and mobile.
- `packages/api-client` provides typed API interaction and auth token flow patterns.
- `packages/ui` is treated as a pattern reference for component behavior and states, not a direct runtime dependency for native UI.

## 3) Platform Adapter Layer (Mobile-Specific)
- Native wrappers for auth session persistence, push, maps SDK, deeplinks, and payment handoff.
- Adapter responsibilities:
  - translate native capability APIs to domain-level events,
  - enforce graceful fallback when capability is unavailable,
  - emit telemetry for rollout health.

## 4) Delivery and Observability Layer
- Feature flags control exposure by cohort and percentage.
- Endpoint-level compatibility status controls which features can go live on mobile.
- Migration KPIs: auth success, payment completion, push opt-in, crash-free sessions, API error rate, booking completion.

## Contract-First Process (Required)
1. Propose API change with contract delta (request, response, auth, errors).
2. Update backend schema/route docs and regenerate OpenAPI (`/api/docs.json`).
3. Regenerate `packages/api-client` and validate generated signatures.
4. Add compatibility classification in `API_COMPATIBILITY_MATRIX.md`.
5. Add/adjust feature flag record in `FEATURE_FLAG_CATALOG.md`.
6. Only then implement mobile consumer behavior.
7. Release gated to closed-group users first.

## Three Parallel Delivery Tracks
Run in parallel with a weekly integration checkpoint.

### Track A: Contract and Backend Hardening
- Owner: API/backend team.
- Goals:
  - stabilize endpoint contracts and error envelopes,
  - ensure idempotency for critical writes (bookings, payments),
  - document auth/session behaviors, rate limits, and retry rules.
- Exit criteria:
  - compatibility matrix updated to "Mobile Ready" for planned launch groups,
  - no undocumented breaking contract changes.

### Track B: Mobile Experience Foundation
- Owner: mobile/client team.
- Goals:
  - implement adapter layer for auth, payments, push, maps, deeplinks,
  - consume only typed `packages/api-client` interfaces,
  - implement offline/error UX for unstable network conditions.
- Exit criteria:
  - core journeys pass on reference devices and low-connectivity profile,
  - all mobile-risk features guarded by flags.

### Track C: Reliability, Rollout, and Governance
- Owner: QA + release + product operations.
- Goals:
  - define cohort strategy and rollback triggers,
  - track migration KPIs and on-call ownership,
  - enforce documentation quality gates.
- Exit criteria:
  - closed-group rollout checklist passed,
  - rollback runbook rehearsed.

## Closed-Group Rollout Strategy
1. Internal users only (team devices, test accounts).
2. Trusted external closed group (small invited cohort).
3. Expanded closed group by segment (region/device/network profile).
4. Public release only after KPI thresholds are sustained.

### Rollout Gates (Minimum)
- No P0/P1 open defects in auth, bookings, or payments.
- Mobile API 5xx rate does not exceed web baseline by agreed threshold.
- Payment verification success and webhook reconciliation remain stable.
- Push registration and delivery meet expected baseline.
- Crash-free session target achieved in closed group.

## Risk Management Model
For each migration risk, document trigger, owner, mitigation, and rollback.

| Risk | Trigger | Mitigation | Rollback |
|---|---|---|---|
| Contract drift between API and client | generated client/types mismatch or runtime parse failures | strict contract-first process + CI check for generated client freshness | disable affected feature flag, fall back to web journey |
| Auth/session instability | increased 401 refresh loops or forced logouts | token lifecycle tests, session telemetry, staged cohort release | disable mobile auth enhancements, force stable auth path |
| Payment failures | drop in create-order or verify success | idempotent retries, webhook monitoring, payment alerting | disable mobile payment flag and route users to web checkout |
| Push misconfiguration | low subscription success or delivery failures | capability checks + backend subscription validation | disable push enrollment flag |
| Maps/deeplink routing issues | high navigation failures or wrong intents | adapter validation + fallback URLs | disable maps/deeplink enhancements, use plain links |

## Strict Documentation Standards
All migration docs must follow these standards:
- Every change references impacted routes, flag keys, and rollout phase.
- Use explicit status values: `Draft`, `Ready`, `Blocked`, `Deprecated`.
- Every decision entry includes owner and date.
- Never merge migration work with stale docs; update docs in the same change set.
- Keep one source of truth per concern:
  - architecture: `MOBILE_ARCHITECTURE.md`
  - endpoint readiness: `API_COMPATIBILITY_MATRIX.md`
  - flags and rollback: `FEATURE_FLAG_CATALOG.md`
  - execution timeline: `MIGRATION_EXECUTION_PLAN.md`

## Definition of Done for Migration Readiness
- Contract-first workflow is used for all mobile-facing API changes.
- Priority endpoint groups are marked and reviewed in compatibility matrix.
- Required migration feature flags are defined with tested rollback.
- Closed-group rollout completed with stable quality metrics.
