# Sportza — Schema Refactor Implementation

> **STATUS: SUPERSEDED** — This document described MongoDB schema migrations. The database has been fully migrated to **MySQL with Prisma ORM** and the schema lives at `apps/api/prisma/schema.prisma`. Migration scripts from this document are no longer applicable. See `DATA_MODEL.md` for the current data model.

**Version:** 1.0  
**Last updated:** Mar 2026

This document describes the completed schema refactor (Iterations 1 & 2), migration scripts, and how to run them.

---

## Overview

The schema has been refactored to align with the three-layer architecture:

| Layer | Collections |
|-------|-------------|
| **Infrastructure** | Venue, Facility, Slot |
| **Marketplace** | Booking, BookingPayment, Refund |
| **Sports** | Activity, Participation, SportEvent, PlayerActivityStats, PlayerCareerStats (PlayerStats) |

---

## Iteration 1 (Completed)

### Schema Changes

| Model | Changes |
|-------|---------|
| **Booking** | bookingType, status enum (pending, pending_open_play, confirmed, fully_paid, cancelled_user, cancelled_conflict, completed), paidAmount, createdBy, slot (optional), indexes |
| **BookingPayment** | New model — marketplace payments |
| **Activity** | venue, facilityId, booking, createdBy, startTime, endTime, status, types (tournament_match, practice), indexes |
| **Participation** | New model — activity participants with role |
| **Match** | activity FK |
| **Refund** | payment FK to BookingPayment |

### Route Updates

- **Bookings:** Set createdBy, bookingType, initial status; use cancelled_user on cancel; include fully_paid in availability
- **OpenPlays:** Set bookingType: open_play on create
- **Payments:** Sync paidAmount on payment success; include cancelled in blocked statuses

### Conflict Resolution

- **bookingConflict.js:** Uses MongoDB transaction for ACID conflict resolution
- **getPaidAmount:** Aggregates from BookingPayment (source of truth); falls back to paidAmount/splitPayments for legacy

### Migration Script

```bash
node server/migrations/schema-v2-iteration1.js
```

**Actions:** Backfills createdBy, bookingType, paidAmount; maps cancelled → cancelled_user.

---

## Iteration 2 (Completed)

### Schema Changes

| Model | Changes |
|-------|---------|
| **Facility** | New model — extracted from Venue.sportFacilities |
| **Slot** | New model — atomic reservable resource |
| **SportEvent** | New model — atomic gameplay events for AI analytics |
| **Booking** | slot FK (optional) |

### Migration Script

```bash
node server/migrations/schema-v2-iteration2.js
```

**Actions:**
- Extracts Venue.sportFacilities into Facility collection
- Backfills Activity: venue, facilityId, createdBy, startTime, endTime from OpenPlay/Match
- Creates Participation from Activity.participants

---

## Structural Improvements (Mar 2026)

### A. Booking–Slot Constraint

**Partial unique index** ensures only ONE confirmed/fully_paid booking per slot:

```
{ venue, facilityId, bookingDate, startTime, endTime } — unique when status in [confirmed, fully_paid]
```

**Migration:**
```bash
node server/migrations/booking-slot-unique-index.js
```

Checks for duplicate confirmed bookings before creating index; aborts if found.

### B. Payment Aggregation

**Source of truth:** `SUM(BookingPayment where status='paid')` — not `Booking.paidAmount`.

- `getPaidAmount(booking)` is async; aggregates from BookingPayment when records exist
- Falls back to paidAmount/splitPayments for legacy bookings
- Payment capture creates BookingPayment records (payments.js)

### C. Participation

Already has `activity`, `user`, `role`, `teamId` — supports singles, doubles, team sports, tournaments.

### D. BatchMembership–BatchPayment

- **BatchPayment** is source of truth for batch fee payments
- **BatchMembership.paymentStatus** is derived; updated when BatchPayment is created

---

## Running Migrations

### Prerequisites

- MongoDB running
- `MONGODB_URI` in `.env` (or default `mongodb://localhost:27017/sports-venue-app`)

### Order

1. **Iteration 1** (required):
   ```bash
   node server/migrations/schema-v2-iteration1.js
   ```

2. **Iteration 2** (required for Facility/Participation backfill):
   ```bash
   node server/migrations/schema-v2-iteration2.js
   ```

3. **Booking slot constraint** (optional; adds DB-level unique):
   ```bash
   node server/migrations/booking-slot-unique-index.js
   ```

### Rollback

Migrations are additive. To rollback:

- **Iteration 1:** Revert Booking schema changes; remove BookingPayment, Participation if created
- **Iteration 2:** Delete Facility, SportEvent docs; Participation can remain

---

## New Models Reference

### Facility

```
venue, sports[], name, surfaceType, count
```

### Slot

```
facility, facilityId, venue, startTime, endTime, price, status (available|reserved|booked), booking
```

### SportEvent

```
activity, player, eventType, value, timestamp, metadata
```

### BookingPayment

```
booking, user, amount, paymentMethod, paymentGatewayId, razorpayOrderId, status, splitIndex
```

### Participation

```
activity, user, role (player|trainer|organizer), teamId
```

---

## Indexes Added

| Collection | Index |
|------------|-------|
| Booking | { venue, facilityId, bookingDate, startTime, endTime, status } |
| Booking | { venue, facilityId, bookingDate, startTime, endTime } — unique, partial (status in confirmed/fully_paid) |
| Booking | { status, bookingDate } |
| Booking | { razorpayOrderId } (sparse) |
| BookingPayment | { booking, user }, { booking, status }, { booking }, { razorpayOrderId } (sparse), { booking, paymentGatewayId } (sparse) |
| Activity | { type, referenceId } (unique, sparse), { sport, startTime }, { venue, startTime }, { booking } |
| Participation | { activity, user } (unique), { user, activity } |
| Facility | { venue }, { venue, sports } |
| Slot | { facility, startTime, endTime }, { venue, facilityId, startTime, endTime }, { status, startTime }, { booking } (sparse) |
| SportEvent | { activity, timestamp }, { player, timestamp }, { activity, eventType } |

---

## References

- [SCHEMA_REFACTOR_PROPOSAL.md](SCHEMA_REFACTOR_PROPOSAL.md) — Full proposal and rationale
- [DATA_MODEL.md](DATA_MODEL.md) — Entity definitions
- [ARCHITECTURE_REFACTOR_PROPOSAL.md](ARCHITECTURE_REFACTOR_PROPOSAL.md) — Backend architecture
