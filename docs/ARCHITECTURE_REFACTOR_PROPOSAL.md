# Sportza — Architecture Refactor Proposal

> **STATUS: SUPERSEDED** — This proposal was written for the original Express + Mongoose architecture. As of March 2026, the Sportza codebase has been fully rebuilt as a **Turborepo monorepo** (apps/web, apps/api, packages/tokens, packages/ui, packages/api-client) with MySQL/Prisma, Auth0, Redis, BullMQ, Zod, OpenAPI, and Tailwind CSS. See `BACKEND_ARCHITECTURE.md` for the current architecture.

**Version:** 1.0  
**Last updated:** Mar 2026  
**Author:** Senior Backend Architect Review

This document analyzes the current codebase, identifies mismatches with the finalized product architecture, and proposes a minimal-disruption refactor strategy (max 2 iterations).

---

## Executive Summary

The current Sportza backend is a **flat Express + Mongoose** structure with routes, models, and services. The refactor aligns it with a **modular monolith** while preserving existing APIs and MongoDB. Key focus: centralize the **Booking Engine**, isolate **Payment Service**, and prepare for **Activity Engine** and **Stats Engine**.

---

## 1. Proposed New Project Folder Structure

```
server/
├── index.js                    # Entry point (unchanged)
├── socket.js                   # Real-time (unchanged)
├── middleware/
│   └── auth.js                 # (unchanged)
│
├── modules/
│   ├── auth/
│   │   ├── auth.controller.js  # POST register, login, OAuth, OTP, GET me
│   │   ├── auth.service.js     # JWT, password hash, OAuth logic
│   │   ├── auth.routes.js
│   │   └── types.js            # (optional) JSDoc types
│   │
│   ├── users/
│   │   ├── user.controller.js  # User CRUD, profile (if any)
│   │   ├── user.repository.js # User model access
│   │   ├── user.routes.js      # Mount under /api/users if needed
│   │   └── types.js
│   │
│   ├── venues/
│   │   ├── venue.controller.js
│   │   ├── venue.repository.js
│   │   ├── venue.service.js    # Rating aggregation, etc.
│   │   ├── venue.routes.js
│   │   └── types.js
│   │
│   ├── booking/                # BOOKING ENGINE — source of truth
│   │   ├── booking.controller.js
│   │   ├── booking.service.js  # create, cancel, add-ons, availability, estimate
│   │   ├── booking.repository.js
│   │   ├── bookingConflict.service.js  # resolveSlotConflict, getPaidPercent (moved)
│   │   ├── booking.routes.js
│   │   └── types.js
│   │
│   ├── payments/
│   │   ├── payment.controller.js
│   │   ├── payment.service.js  # Razorpay integration, verify, refunds
│   │   ├── payment.repository.js
│   │   ├── payment.routes.js
│   │   └── types.js
│   │
│   ├── activities/
│   │   ├── activity.controller.js
│   │   ├── activity.service.js # create, join, convert open_play → match
│   │   ├── activity.repository.js
│   │   ├── openPlay.controller.js  # OpenPlay = Activity + SplitBooking
│   │   ├── openPlay.routes.js
│   │   ├── activity.routes.js
│   │   └── types.js
│   │
│   ├── stats/
│   │   ├── stats.controller.js
│   │   ├── stats.service.js     # aggregation, leaderboard
│   │   ├── stats.repository.js
│   │   ├── stats.jobs.js        # background stats generation (future)
│   │   ├── stats.routes.js
│   │   └── types.js
│   │
│   └── notifications/
│       ├── notification.service.js  # email, SMS, push (stub)
│       ├── notification.jobs.js     # queue jobs (future)
│       └── types.js
│
├── models/                     # KEEP flat for Mongoose (shared)
│   ├── User.js
│   ├── Booking.js
│   ├── OpenPlay.js
│   ├── ... (all existing models)
│   └── index.js                # Optional: export all models
│
├── shared/
│   ├── events.js               # Event emitter for booking_created, etc.
│   ├── pricing.js              # From utils/pricing
│   └── constants.js            # Booking statuses, payment statuses
│
├── jobs/                       # Background jobs (replace setInterval)
│   ├── openPlayConfirmations.js
│   ├── index.js                # Job scheduler (cron or BullMQ)
│   └── (future) statsGeneration.js, refundProcessing.js
│
├── migrations/
└── seed/
```

**Migration path:** Phase 1 creates `modules/` and moves logic; Phase 2 adds events, jobs, and Payment→Booking decoupling. Existing `routes/` files become thin wrappers that delegate to module controllers until clients are updated.

---

## 2. Changes Required in Database Schema

### 2.1 MongoDB (Current) — Recommended for Minimal Disruption

**Keep MongoDB.** A PostgreSQL migration would require a full rewrite of models, queries, and migrations. Defer PostgreSQL to a future phase.

### 2.2 Booking Schema Fixes

| Issue | Current | Required |
|-------|---------|----------|
| **status enum** | `['confirmed', 'cancelled', 'completed', 'pending_open_play']` | Add: `pending`, `fully_paid`, `cancelled_user`, `cancelled_conflict` |
| **bookingType** | Implicit (inferred from batch, splitPayments, OpenPlay) | Add: `solo` \| `split` \| `open_play` \| `batch` for clarity |
| **initial status** | Default `confirmed` | Solo/Batch: `confirmed`; Split/OpenPlay: `pending` or `pending_open_play` |

**Proposed Booking.status enum:**
```javascript
enum: ['pending', 'pending_open_play', 'confirmed', 'fully_paid', 'cancelled_user', 'cancelled_conflict', 'completed']
```

**Proposed Booking.bookingType:**
```javascript
bookingType: { type: String, enum: ['solo', 'split', 'open_play', 'batch'], default: 'solo' }
```

### 2.3 Activity Model Alignment

- **Activity** already exists with `type: match | training | open_play`.
- **OpenPlay** should be treated as: `Activity(type=open_play)` + `Booking(paymentType=split)`.
- Option A: Keep OpenPlay as separate entity, add `activity` FK to link to Activity when created.
- Option B (future): Deprecate OpenPlay collection; use Activity + Booking only. Higher risk; defer.

### 2.4 Indexes for Reliability

| Collection | Index | Purpose |
|------------|-------|---------|
| Booking | `{ venue, facilityId, bookingDate, startTime, endTime, status }` | Conflict resolution, availability |
| Booking | `{ status: 1, bookingDate: 1 }` | Open-play confirmation job |
| Booking | `{ razorpayOrderId: 1 }` (sparse) | Webhook lookup |

---

## 3. New Services Required

| Service | Location | Responsibility |
|---------|----------|----------------|
| **BookingEngine** | `modules/booking/booking.service.js` | Centralize: create, cancel, state transitions, conflict resolution. Single source of truth. |
| **BookingConflictService** | `modules/booking/bookingConflict.service.js` | `resolveSlotConflict`, `getPaidPercent`, `getPaidAmount`. Used by Payment and OpenPlay. |
| **PaymentService** | `modules/payments/payment.service.js` | Razorpay: createOrder, verifySignature, processRefund. Does NOT update booking directly; calls BookingEngine.onPaymentSuccess(). |
| **ActivityService** | `modules/activities/activity.service.js` | Create Activity, manage participants, convert open_play → match. |
| **EventBus** | `shared/events.js` | Simple EventEmitter for `booking_created`, `booking_payment_update`, `booking_confirmed`, `booking_cancelled_conflict`, `booking_cancelled_user`, `openplay_joined`, `slot_update`. Socket.io and future consumers subscribe. |
| **NotificationService** | `modules/notifications/notification.service.js` | Stub: email, SMS. Integrate with jobs later. |

---

## 4. Changes Required in Existing APIs

### 4.1 API Contract Preservation

**No breaking changes to request/response shapes.** Controllers delegate to services; routes stay the same.

### 4.2 Behavioral Fixes

| API | Current Behavior | Required Change |
|-----|------------------|-----------------|
| `POST /api/bookings` | Creates with `status: confirmed` (schema default) | Set `status: pending` for split; `pending_open_play` when creating from open play flow |
| `PUT /api/bookings/:id/cancel` | Sets `status: cancelled` | Set `status: cancelled_user` (and trigger refund for paid bookings) |
| `POST /api/open-plays` | Requires booking `pending` or `confirmed` | Require `pending` or `confirmed`; set booking `status: pending_open_play` |
| `GET /api/open-plays/process-confirmations` | No auth | Add auth (admin or internal only) or remove public access |

### 4.3 New Internal Contract: Payment → Booking

**Current:** `payments.js` directly updates Booking and calls `resolveSlotConflict`.

**Required:** PaymentService verifies payment → calls `BookingEngine.onPaymentSuccess(bookingId, paymentDetails)` → BookingEngine updates booking and runs conflict resolution.

```javascript
// payment.service.js (after verify/webhook)
await bookingEngine.onPaymentSuccess(bookingId, { paymentId, orderId, splitIndex });
```

---

## 5. Race Condition Risks Detected

### 5.1 Critical: Concurrent Conflict Resolution

**Scenario:** Two open-play bookings for the same slot both reach ≥50% paid within milliseconds. Both call `resolveSlotConflict`. Neither uses a transaction or lock.

**Risk:** Both could "win" — one updates itself to confirmed, the other updates the first to cancelled_conflict, then the second becomes confirmed. Or both become confirmed.

**Mitigation:**
1. **MongoDB transaction:** Wrap `resolveSlotConflict` in `session.withTransaction()`. Read slot state, determine winner, update all affected bookings atomically.
2. **Optimistic lock:** Add `version` field to Booking; use `findOneAndUpdate` with `version` check.
3. **Pessimistic lock:** Use a distributed lock (Redis) on `slot:{venueId}:{facilityId}:{date}:{startTime}` before conflict resolution.

**Recommended:** MongoDB transaction (minimal infra change).

### 5.2 Webhook + Verify Idempotency

**Scenario:** Client calls verify; webhook also fires for same payment.

**Current:** Both paths call `applyPaymentCaptured`. Idempotent for same `paymentId` on same booking.

**Risk:** Low. Idempotency is implemented.

### 5.3 Open-Play Confirmation Job vs Manual Payment

**Scenario:** Job runs at T-30; user pays at T-29. Both could run `resolveSlotConflict`.

**Risk:** Same as 5.1 — non-atomic conflict resolution.

**Mitigation:** Same transaction/lock approach.

### 5.4 Availability Check vs Create

**Scenario:** User A checks availability (slot free). User B creates booking. User A creates booking.

**Current:** Availability check is a read; create does a check-then-insert. Two concurrent creates could both pass the check.

**Mitigation:** Use `findOneAndUpdate` with status conditions, or a unique compound index + upsert pattern. Alternatively, create with `status: pending` and run conflict resolution on first payment.

---

## 6. Suggested Improvements for Booking Engine Reliability

### 6.1 Centralize Booking State Machine

- Define explicit transitions: `pending` → `confirmed` | `fully_paid` | `cancelled_*`
- All state changes go through `BookingEngine.transition(bookingId, newStatus, reason)`.
- Log state changes for audit.

### 6.2 Transaction Wrapper for Conflict Resolution

```javascript
async function resolveSlotConflict(booking, newStatus) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Re-check no one else confirmed (with lock)
    // 2. Update winner
    // 3. Update losers
    await session.commitTransaction();
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}
```

### 6.3 Payment Success Flow (Decoupled)

```
Razorpay webhook/verify
    → PaymentService.verifyAndRecord()
    → PaymentService emits payment_captured (internal)
    → BookingEngine.onPaymentCaptured(bookingId, payload)
    → BookingEngine updates payment status
    → if ≥50%: BookingEngine.runConflictResolution(booking)
    → emit booking_confirmed / booking_cancelled_conflict
    → RefundService.processRefundsForLosers()
```

### 6.4 Event-Driven Real-Time Updates

- On `booking_confirmed`, `booking_cancelled_conflict`, etc., emit to Socket.io room `slot:{venueId}:{facilityId}:{date}`.
- Clients subscribed to slot get live updates without polling.

### 6.5 Background Jobs (BullMQ / Redis)

- Replace `setInterval` with BullMQ for `openPlayConfirmations`, `refundProcessing`, `statsGeneration`.
- Enables retries, visibility, and scaling.

### 6.6 Health Checks

- Add `GET /api/health/booking` — verifies Booking model, conflict resolution logic.
- Add `GET /api/health/payments` — verifies Razorpay connectivity.

---

## 7. Refactor Implementation Plan (2 Iterations)

### Iteration 1: Structure + Booking Centralization

1. Create `server/modules/` folder structure.
2. Move `bookingConflict.js` → `modules/booking/bookingConflict.service.js`.
3. Create `BookingEngine` (booking.service.js) — extract logic from `bookings.js` and `payments.js` applyPaymentCaptured.
4. Create `PaymentService` — extract Razorpay logic from `payments.js`.
5. Wire `payments.js` routes to call `PaymentService` → `BookingEngine.onPaymentSuccess`.
6. Fix Booking schema: add missing status values, add `bookingType`.
7. Fix initial status on create: split/open_play → `pending`/`pending_open_play`.
8. Add MongoDB transaction to `resolveSlotConflict`.

**Deliverable:** Booking logic centralized; payment decoupled; no API contract changes.

### Iteration 2: Events + Jobs + OpenPlay Alignment

1. Create `shared/events.js` — EventEmitter for booking events.
2. Emit events from BookingEngine; Socket.io subscribes for real-time.
3. Add `slot_update`, `booking_confirmed`, etc. to socket.
4. Move open-play confirmation to `jobs/`; add BullMQ if Redis available, else keep cron.
5. Secure `process-confirmations` endpoint (auth or internal only).
6. Add Activity creation when OpenPlay is created (link OpenPlay → Activity).
7. Add indexes on Booking for conflict and jobs.

**Deliverable:** Event-driven updates; jobs structure; OpenPlay–Activity link.

---

## 8. Summary: Mismatches Addressed

| Requirement | Current State | Proposal |
|-------------|---------------|----------|
| Modular monolith | Flat routes/services | `modules/{auth,users,venues,booking,payments,activities,stats,notifications}` |
| Booking Engine source of truth | Logic in bookings, payments, openPlays, openPlayConfirmations | Centralize in `BookingEngine` |
| PaymentService separate | Payment logic in payments.js, directly updates Booking | `PaymentService` → `BookingEngine.onPaymentSuccess` |
| OpenPlay = Activity + SplitBooking | OpenPlay separate entity | Link OpenPlay → Activity; treat as Activity(type=open_play) + Booking |
| Stats async | PlayerStats updated synchronously on match complete | Defer: keep sync for now; add jobs in Iteration 2 |
| Real-time events | Socket only for match scoring | Add booking/slot events |
| PostgreSQL | MongoDB | Keep MongoDB; document PostgreSQL as future migration |
| ACID booking transactions | No transactions | Add MongoDB transactions for conflict resolution |
| Background queue | setInterval | Structure for BullMQ; implement in Iteration 2 |

---

## References

- [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) — Current architecture
- [BOOKING_STATE_AND_FLOWS.md](BOOKING_STATE_AND_FLOWS.md) — Booking states and flows
- [DATA_MODEL.md](DATA_MODEL.md) — Entity definitions
