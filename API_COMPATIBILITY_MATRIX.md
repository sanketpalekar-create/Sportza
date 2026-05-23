# API Compatibility Matrix for Mobile Migration

## Purpose
Track mobile readiness of major API endpoint groups mounted in `apps/api/src/index.ts`, and define the compatibility strategy for each group.

## Compatibility Levels
- `Ready`: existing contract can be consumed by mobile with no server contract change.
- `Ready with Adapters`: mobile-specific client adapters are required (auth persistence, native SDK handoff, platform permissions).
- `Partial`: usable for selected flows; contract or behavior hardening still needed.
- `Blocked`: not approved for mobile rollout until listed gaps are resolved.

## Matrix
| Endpoint Group | Representative Base Path | Mobile Compatibility | Strategy | Key Gaps to Close Before Broad Rollout |
|---|---|---|---|---|
| Health and docs | `/api/health`, `/api/docs.json` | Ready | Use for smoke checks, client generation, release validation | Keep docs generation in release checklist |
| Public discovery | `/api/public`, `/api/places` | Ready with Adapters | Wrap map/place responses with native location permission and fallback behavior | Standardize empty/error payload behavior for low-connectivity cases |
| Auth and profile | `/api/auth` | Ready with Adapters | Reuse token-refresh contract from `packages/api-client`, move storage to secure native store | Verify refresh edge-cases and account recovery UX on mobile |
| Venues and facilities | `/api/venues`, `/api/slots`, `/api/schedules` | Partial | Prioritize read-first flows (list/detail/availability), then owner mutations behind flags | Ensure timezone/slot precision parity and conflict messaging |
| Bookings | `/api/bookings` | Partial | Launch core create/cancel/instant booking first with strict idempotency handling | Confirm retry-safe writes and consistent booking state transitions |
| Payments and wallet | `/api/payments`, `/api/wallet` | Ready with Adapters | Native payment handoff adapter (Razorpay), webhook-verified completion, fallback to web | Define hard rollback criteria for payment success degradation |
| Sports and matches | `/api/sports`, `/api/matches`, `/api/stats` | Ready | Reuse existing read/write contracts via generated client | Validate scoreboard and live update behavior on mobile networks |
| Training and batches | `/api/trainings`, `/api/batches`, `/api/trainers` | Partial | Start with discovery and enrolled-user views, phase in trainer mutations | Harden validation errors and pagination consistency |
| Open play and tournaments | `/api/open-plays`, `/api/tournaments` | Partial | Release participation flows first, defer advanced admin/co-organizer actions | Reduce oversized payloads and verify long-running mutation feedback |
| Matchmaking and peers | `/api/matchmaking`, `/api/peer-invites`, `/api/peers` | Partial | Closed-group only initially; monitor social graph and invite reliability | Tune recommendation latency and invitation state reconciliation |
| Notifications and push | `/api/notifications`, `/api/notification-preferences`, `/api/push-subscriptions` | Ready with Adapters | Native push token/subscription bridge, permission-aware onboarding | Validate device token churn handling and opt-out consistency |
| Displays and reports | `/api/displays`, `/api/reports` | Blocked (Phase 1) | Keep web-first until mobile operational demand is confirmed | Define mobile use-cases and simplified payload contracts |
| Admin surfaces | `/api/admin/*` | Blocked (Phase 1) | Exclude from initial mobile release; maintain web operational tooling | Separate admin-mobile requirements and hardened authorization scope |

## Mobile Contract Rules by Endpoint Category
- Read endpoints: must provide stable filtering, pagination defaults, and timezone-safe values.
- Mutation endpoints: must be idempotent or provide duplicate-write protection.
- Authenticated endpoints: must clearly define 401/403 behavior and refresh expectations.
- Payment endpoints: must include deterministic reconciliation identifiers.
- Notification endpoints: must permit safe re-registration/unregistration on device reinstall.

## Versioning and Change Control
- No unannounced breaking changes on any endpoint marked `Ready` or `Ready with Adapters`.
- Any request/response shape change requires:
  1) OpenAPI update in `apps/api`,
  2) regenerated `packages/api-client`,
  3) matrix status review update.

## Test Expectations Before Upgrading a Group to Ready
- Contract tests pass against `apps/api` route handlers.
- Generated client typechecks with no manual patching.
- Mobile smoke tests pass for happy path and top 3 failure paths.
- Rollback switch (feature flag or route fallback) is validated.
