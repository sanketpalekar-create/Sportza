# Sportza — Schema Refactor Proposal

> **STATUS: SUPERSEDED** — This proposal was written for the MongoDB/Mongoose schema. The database has been migrated to **MySQL with Prisma ORM**. The schema is now at `apps/api/prisma/schema.prisma` with 45 models. See `DATA_MODEL.md` for the current data architecture.

**Version:** 1.0  
**Last updated:** Mar 2026  
**Author:** Senior Database Architect

This document analyzes the current MongoDB/Mongoose schema, identifies structural issues against the three-layer architecture, and proposes minimal changes (max 2 iterations) to align with the finalized Sportza architecture.

---

## 1. Current Schema Analysis

### 1.1 Layer Mapping (Current vs Target)

| Target Layer | Target Collections | Current State |
|--------------|-------------------|---------------|
| **Infrastructure** | venues, facilities, slots | Venue exists; facilities embedded in Venue.sportFacilities; **no slots** |
| **Marketplace** | bookings, booking_payments, refunds | Booking exists; **payments embedded** in Booking.splitPayments; Refund exists |
| **Sports** | activities, participations, sport_events, player_activity_stats, player_career_stats | Activity exists (minimal); **no participations**; **no sport_events**; PlayerActivityStats exists; PlayerStats exists |

### 1.2 Current Model Summary

| Model | Key Fields | Layer Violations |
|-------|------------|------------------|
| **Venue** | owner, sports[], sportFacilities[], sportRates[], location, addOns, commissionPercent | Facilities embedded (should be separate for multi-venue queries) |
| **Booking** | user, venue, facilityId, sport, bookingDate, startTime, endTime, splitPayments[], status | Payment data embedded; status enum incomplete; no bookingType |
| **Refund** | booking, user, splitIndex, amountPaid, amountRefunded, platformFee, reason | Links to booking; no payment_id (target has payment_id) |
| **Activity** | type, sport, referenceId, date, participants[] | Missing: venue_id, facility_id, booking_id, created_by, start_time, end_time, status; types missing tournament_match, practice |
| **Match** | booking, tournament, sport, teams, scores, playerStats | **Not linked to Activity**; duplicate concept (Match vs Activity) |
| **OpenPlay** | booking, venue, sport, players[], status | Separate from Activity; should be Activity(type=open_play) + Booking |
| **PlayerActivityStats** | activity, player, sport, stats | Aligned |
| **PlayerStats** | player, sport, totalMatches, stats | Rename to player_career_stats conceptually |
| **Batch** | trainer, venue, sportFees, feeSchedules, capacity | Aligned; schedule embedded |
| **BatchSession** | batch, date, startTime, endTime, status | Aligned |
| **SessionAttendance** | session, player, status | Aligned (target: batch_attendance) |
| **BatchMembership** | batch, player, status, paymentStatus | Aligned |
| **BatchPayment** | batch, player, payer, amount | Aligned |
| **Tournament** | sport, venue, teams, status | Aligned |
| **TournamentFixture** | tournament, match | Links to Match; target links to activity_id |

### 1.3 Structural Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| **Booking status enum** | High | Schema has `confirmed, cancelled, completed, pending_open_play`; code uses `pending`, `fully_paid`, `cancelled_user`, `cancelled_conflict` |
| **No bookingType** | High | Cannot distinguish solo/split/open_play/batch for confirmation rules |
| **Embedded payments** | High | splitPayments in Booking prevents ACID payment tracking; no separate booking_payments |
| **No slots** | Medium | Target has slots as atomic resource; current uses (facilityId, date, startTime, endTime) implicitly |
| **Activity incomplete** | High | Missing venue, facility, booking, created_by, start/end time, status; types missing |
| **Match not Activity** | High | Match is separate; target: tournament_matches → activity_id |
| **No participations** | Medium | Activity.participants is flat array; target has role, team_id |
| **No sport_events** | Low | Target has atomic gameplay events; future AI analytics |
| **Refund missing payment ref** | Medium | Target: refunds.payment_id; current: razorpayPaymentId in Refund |
| **Facilities embedded** | Low | Works for single-venue; harder for cross-venue facility queries |

---

## 2. Refactored Schema (MongoDB/Mongoose)

### 2.1 Layer Organization

```
Infrastructure Layer:  Venue, Facility (new/extracted), Slot (new, optional)
Marketplace Layer:     Booking, BookingPayment (new), Refund
Sports Layer:          Activity, Participation (new), SportEvent (new), PlayerActivityStats, PlayerCareerStats (rename)
Supporting:            User, Sport, Batch, BatchSession, BatchMembership, BatchPayment, SessionAttendance,
                      Tournament, TournamentFixture, OpenPlay (deprecate → Activity), Match (link to Activity)
```

### 2.2 Iteration 1: Critical Fixes

#### A. Booking Schema Updates

```javascript
// Add to Booking schema
bookingType: {
  type: String,
  enum: ['solo', 'split', 'open_play', 'batch'],
  default: 'solo'
},
status: {
  type: String,
  enum: ['pending', 'pending_open_play', 'confirmed', 'fully_paid', 'cancelled_user', 'cancelled_conflict', 'completed'],
  default: 'pending'  // was 'confirmed'
},
paidAmount: {
  type: Number,
  default: 0
},
createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true
}
// Keep: user (booker), facilityId, facilityName, bookingDate, startTime, endTime, totalAmount, splitPayments (for backward compat during migration)
```

**Indexes:**
```javascript
{ venue: 1, facilityId: 1, bookingDate: 1, startTime: 1, endTime: 1, status: 1 }
{ status: 1, bookingDate: 1 }
{ razorpayOrderId: 1 }  // sparse, for webhook lookup
```

#### B. BookingPayment Collection (New)

Extract split payment rows into a separate collection for ACID and audit.

```javascript
const bookingPaymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['online', 'offline'], default: 'online' },
  paymentGatewayId: { type: String },  // razorpayPaymentId
  razorpayOrderId: { type: String },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  splitIndex: { type: Number },  // position in original splitPayments for migration
  createdAt: { type: Date, default: Date.now }
});
bookingPaymentSchema.index({ booking: 1, user: 1 });
bookingPaymentSchema.index({ booking: 1 });
bookingPaymentSchema.index({ razorpayOrderId: 1 }, { sparse: true });
```

**Migration:** Create BookingPayment docs from existing Booking.splitPayments; keep splitPayments for read path until full migration.

#### C. Activity Schema Updates

```javascript
// Add/update Activity schema
type: {
  enum: ['match', 'open_play', 'training', 'tournament_match', 'practice'],
  required: true
},
venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },  // or facilityId if Facility not extracted
booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
startTime: { type: Date, required: true },
endTime: { type: Date, required: true },
status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
// Keep: sport, referenceId (for Match/OpenPlay/BatchSession), participants (deprecate when Participation exists)
```

**Indexes:**
```javascript
{ type: 1, referenceId: 1 }, { unique: true }
{ sport: 1, startTime: 1 }
{ venue: 1, startTime: 1 }
{ booking: 1 }
```

#### D. Participation Collection (New)

```javascript
const participationSchema = new mongoose.Schema({
  activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['player', 'trainer', 'organizer'], default: 'player' },
  teamId: { type: String },  // e.g. 'team1', 'team2' or team subdoc _id
  createdAt: { type: Date, default: Date.now }
});
participationSchema.index({ activity: 1, user: 1 }, { unique: true });
participationSchema.index({ user: 1, activity: 1 });
```

#### E. Match → Activity Link

Add to Match schema:
```javascript
activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' }
```

**Flow:** When creating a Match (from booking or tournament), create an Activity(type=match or tournament_match) first, then create Match with activity FK. TournamentFixture continues to reference Match; Match references Activity.

#### F. Refund Schema Update

```javascript
// Add to Refund
payment: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingPayment' }
// Keep: booking, user, splitIndex, amountPaid, amountRefunded, platformFee, reason, razorpayPaymentId
```

#### G. PlayerStats Rename

Rename collection to `playercareerstats` (or keep `playerstats` with JSDoc as player_career_stats). No schema change.

---

### 2.3 Iteration 2: Slots, SportEvent, Extensions

#### A. Slot Collection (Optional)

Only if slot-based inventory is required for high concurrency.

```javascript
const slotSchema = new mongoose.Schema({
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ['available', 'reserved', 'booked'], default: 'available' },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  createdAt: { type: Date, default: Date.now }
});
slotSchema.index({ facility: 1, startTime: 1, endTime: 1 }, { unique: true });
slotSchema.index({ status: 1, startTime: 1 });
```

**Booking:** Add `slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' }`. Slot becomes source of truth for availability.

#### B. SportEvent Collection (New)

For atomic gameplay events (future AI analytics).

```javascript
const sportEventSchema = new mongoose.Schema({
  activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  player: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventType: { type: String, required: true },  // e.g. 'goal', 'run', 'point'
  value: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed }
});
sportEventSchema.index({ activity: 1, timestamp: 1 });
sportEventSchema.index({ player: 1, timestamp: 1 });
```

#### C. Facility Extraction (Optional)

Extract Venue.sportFacilities into Facility collection for cross-venue queries.

```javascript
const facilitySchema = new mongoose.Schema({
  venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  sport: { type: mongoose.Schema.Types.ObjectId, ref: 'Sport' },  // or sport name
  name: { type: String, required: true },
  surfaceType: { type: String },
  createdAt: { type: Date, default: Date.now }
});
facilitySchema.index({ venue: 1 });
facilitySchema.index({ venue: 1, sport: 1 });
```

---

## 3. Migration Strategy

### 3.1 Iteration 1 Migrations

| Step | Action | Rollback |
|------|--------|----------|
| 1 | Add new Booking fields (bookingType, paidAmount, createdBy); expand status enum | Remove fields |
| 2 | Backfill bookingType from batch/splitPayments/OpenPlay; backfill createdBy = user | — |
| 3 | Create BookingPayment from Booking.splitPayments for existing split bookings | Delete BookingPayment docs |
| 4 | Add activity, venue, facility, booking, createdBy, startTime, endTime, status to Activity | — |
| 5 | Create Participation from Activity.participants for existing activities | Delete Participation docs |
| 6 | Create Activity for existing Matches; set Match.activity | — |
| 7 | Add payment ref to Refund (nullable for old refunds) | — |

### 3.2 Migration Scripts

```
server/migrations/
  schema-v2-booking-updates.js
  schema-v2-booking-payments.js
  schema-v2-activity-updates.js
  schema-v2-participations.js
  schema-v2-match-activity-link.js
```

### 3.3 Backward Compatibility

- **Read path:** Support both Booking.splitPayments and BookingPayment for 1 release.
- **Write path:** New payments go to BookingPayment; sync to splitPayments for legacy clients if needed.
- **Conflict resolution:** Use Booking.paidAmount (sum of BookingPayment where status=paid) for ≥50% check.

---

## 4. Indexes for Performance

### 4.1 Conflict Resolution & Availability

| Collection | Index | Purpose |
|------------|-------|---------|
| Booking | `{ venue: 1, facilityId: 1, bookingDate: 1, startTime: 1, endTime: 1 }` | Same-slot query for resolveSlotConflict |
| Booking | `{ status: 1, bookingDate: 1 }` | Open-play confirmation job |
| Booking | `{ razorpayOrderId: 1 }` (sparse) | Webhook lookup |
| BookingPayment | `{ booking: 1, status: 1 }` | Sum paid amount |

### 4.2 Multi-City, Multi-Sport

| Collection | Index | Purpose |
|------------|-------|---------|
| Venue | `{ 'location.city': 1, isActive: 1 }` | City filter |
| Venue | `{ sports: 1, isActive: 1 }` | Sport filter |
| Activity | `{ sport: 1, startTime: 1 }` | Sport + date range |
| Activity | `{ venue: 1, startTime: 1 }` | Venue schedule |

### 4.3 Scalability

| Collection | Index | Purpose |
|------------|-------|---------|
| User | `{ email: 1 }` (unique) | Auth |
| Booking | `{ createdBy: 1, createdAt: -1 }` | User bookings |
| PlayerActivityStats | `{ player: 1, sport: 1 }` | Career aggregation |
| PlayerStats | `{ sport: 1, 'stats.<leaderboardField>': -1 }` | Leaderboard (dynamic) |

---

## 5. Race Condition Risks

### 5.1 Conflict Resolution

**Risk:** Two bookings for same slot both reach ≥50% concurrently; both call resolveSlotConflict.

**Mitigation:**
```javascript
// Use MongoDB transaction with findOneAndUpdate
const session = await mongoose.startSession();
session.startTransaction();
try {
  const winner = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: ['pending', 'pending_open_play'] } },
    { $set: { status: newStatus } },
    { session, new: true }
  );
  if (!winner) throw new Error('Booking already resolved');
  await Booking.updateMany(
    { /* same slot */, _id: { $ne: bookingId }, status: { $in: ['pending', 'pending_open_play'] } },
    { $set: { status: 'cancelled_conflict' } },
    { session }
  );
  await session.commitTransaction();
} catch (e) {
  await session.abortTransaction();
  throw e;
} finally {
  session.endSession();
}
```

### 5.2 Payment Update + Conflict

**Risk:** Webhook and verify both fire; both update payment and trigger conflict.

**Mitigation:** Idempotent payment application (already in place). Use `findOneAndUpdate` with status check so only first update wins.

### 5.3 Availability Check vs Create

**Risk:** Two users create booking for same slot simultaneously.

**Mitigation:** Unique compound index on (venue, facilityId, bookingDate, startTime, endTime) where status in (confirmed, fully_paid, completed). Create with status=pending; first to confirm wins. Alternative: use `findOneAndUpdate` with `$setOnInsert` for atomic create.

---

## 6. Booking Engine Reliability

### 6.1 ACID Guarantees

- **Payment update:** Run in transaction with conflict resolution.
- **Refund:** Create Refund doc in same transaction as booking status update when cancelling.

### 6.2 State Machine

| From | To | Trigger |
|------|-----|---------|
| pending | confirmed | ≥50% paid (split/open_play) |
| pending | fully_paid | 100% paid (solo/split) |
| pending_open_play | confirmed | ≥50% paid |
| pending_open_play | fully_paid | 100% paid |
| * | cancelled_user | User cancel |
| pending, pending_open_play | cancelled_conflict | Lost slot |
| confirmed, fully_paid | completed | Slot time passed (job) |

### 6.3 paidAmount Consistency

- **Source:** Sum of BookingPayment where booking=X and status='paid'.
- **Denormalization:** Update Booking.paidAmount on each payment success (in same transaction).
- **Validation:** Periodic job to reconcile paidAmount vs sum(BookingPayment).

---

## 7. Summary: Changes by Iteration

### Iteration 1

| Change | Type | Impact |
|--------|------|--------|
| Booking: bookingType, status enum, paidAmount, createdBy | Schema | Medium |
| BookingPayment collection | New | High |
| Activity: venue, facility, booking, createdBy, startTime, endTime, status, types | Schema | Medium |
| Participation collection | New | Medium |
| Match.activity FK | Schema | Medium |
| Refund.payment FK | Schema | Low |
| Indexes | Index | Low |

### Iteration 2

| Change | Type | Impact |
|--------|------|--------|
| Slot collection | New | High (optional) |
| SportEvent collection | New | Low |
| Facility extraction | Refactor | Medium (optional) |

---

## 8. Implementation Status

### Iteration 1 (Completed)

- **Booking:** bookingType, status enum, paidAmount, createdBy, slot (optional), indexes
- **BookingPayment:** New model
- **Activity:** venue, facilityId, booking, createdBy, startTime, endTime, status, types (tournament_match, practice)
- **Participation:** New model
- **Match:** activity FK
- **Refund:** payment FK
- **Routes:** bookings, openPlays, payments (as above)
- **bookingConflict:** MongoDB transaction for ACID conflict resolution; getPaidAmount uses paidAmount
- **Migration:** `node server/migrations/schema-v2-iteration1.js`

### Iteration 2 (Completed)

- **Facility:** New model — extracted from Venue.sportFacilities
- **Slot:** New model — atomic reservable resource
- **SportEvent:** New model — atomic gameplay events for AI analytics
- **Booking:** slot FK
- **Migration:** `node server/migrations/schema-v2-iteration2.js` (extracts facilities, backfills Activity, creates Participation)

### Documentation

See [SCHEMA_REFACTOR_IMPLEMENTATION.md](SCHEMA_REFACTOR_IMPLEMENTATION.md) for full implementation guide and migration instructions.

---

## References

- [DATA_MODEL.md](DATA_MODEL.md) — Current entity definitions
- [ARCHITECTURE_REFACTOR_PROPOSAL.md](ARCHITECTURE_REFACTOR_PROPOSAL.md) — Backend refactor
- [BOOKING_STATE_AND_FLOWS.md](BOOKING_STATE_AND_FLOWS.md) — Booking rules
