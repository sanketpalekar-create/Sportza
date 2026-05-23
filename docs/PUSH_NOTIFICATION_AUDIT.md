# Push Notification Audit and Coverage Map

**Version:** 1.0  
**Last updated:** Apr 28, 2026  
**Status:** Current-state audit + implementation guidance

---

## 1. Purpose

This document answers two questions:

1. Where users currently receive notifications in Sportza.
2. Where push/in-app notifications should be added based on user-impacting events.

It also clarifies the current delivery reality: Sportza has in-app notifications and real-time sockets, but does not yet implement true device push (FCM/APNs/WebPush).

---

## 2. Notification Channels in Sportza (Current State)

### 2.1 In-app notification feed (implemented)

**Backend write service**
- `apps/api/src/services/notificationService.ts`
- Supports notification types:
  - `BATCH_ANNOUNCEMENT`
  - `BATCH_NEW_MEMBER`
  - `PAYMENT_RECORDED`
  - `PAYMENT_REMINDER`

**Backend read/update APIs**
- `apps/api/src/routes/notifications.ts`
  - `GET /notifications`
  - `GET /notifications/unread-count`
  - `PATCH /notifications/:id/read`
  - `PATCH /notifications/read-all`

**Frontend surfaces**
- `apps/web/src/pages/Notifications.tsx` (notification inbox/feed)
- `apps/web/src/pages/Profile.tsx` (entry point to Notifications page)
- `apps/web/src/pages/trainer/TrainerDashboard.tsx` (unread badge in trainer dashboard)

### 2.2 Real-time socket events (implemented, app-open only)

**Socket infrastructure**
- `apps/api/src/lib/socket.ts`

**Event groups**
- Booking lifecycle events from:
  - `apps/api/src/routes/bookings.ts`
  - `apps/api/src/services/bookingConflict.ts`
  - Events: `booking:created`, `booking:confirmed`, `booking:cancelled`, `booking:payment_update`
- Open play events from:
  - `apps/api/src/routes/open-plays.ts`
  - Events: `openplay:joined`, `openplay:left`
- Match live events from:
  - `apps/api/src/routes/matches.ts`
  - Events: `match:score`, `match:event`, `match:status`
- Venue schedule events from:
  - `apps/api/src/routes/schedules.ts`
  - Events: `schedule:updated`, `schedule:exception_added`, `schedule:exception_removed`, `schedule:bulk_blocked`
- Display pairing event from:
  - `apps/api/src/routes/displays.ts`
  - Event: `display:paired`

**Frontend socket consumers**
- `apps/web/src/hooks/useVenueOwnerSocket.ts`
- `apps/web/src/hooks/useMatchSocket.ts`
- `apps/web/src/hooks/usePairingSocket.ts`

### 2.3 Email channel (partially implemented)

- `apps/api/src/lib/email.ts`
- `apps/api/src/workers/emailWorker.ts`
- `apps/api/src/lib/queue.ts`

Used for auth flows and booking confirmation workflow.

### 2.4 WhatsApp bridge (implemented as deep-link)

- `apps/api/src/services/whatsappBridge.ts`
- Used from `apps/api/src/routes/batches.ts` (`/batches/:id/remind-payment`)

This is manual send by opening `wa.me` URL, not server-delivered push.

### 2.5 Push delivery (not implemented)

No implementation found for:
- FCM (Firebase Cloud Messaging)
- APNs
- WebPush service worker pipeline
- OneSignal / Expo notifications

`Notification` model exists (`apps/api/prisma/schema.prisma`) but there are no device/subscription token models or push dispatch workers.

---

## 3. Where Users Currently Receive Notification Events

## 3.1 Implemented in-app notification triggers

All currently implemented notification writes are in `apps/api/src/routes/batches.ts`:

1. **Batch join request / new member**
   - Trigger: player joins a batch
   - Recipient: trainer
   - Type: `BATCH_NEW_MEMBER`

2. **Batch payment recorded**
   - Trigger: trainer records payment
   - Recipient: player/payer
   - Type: `PAYMENT_RECORDED`

3. **Batch announcement**
   - Trigger: trainer posts announcement
   - Recipient: active members
   - Type: `BATCH_ANNOUNCEMENT`

4. **Batch payment reminder**
   - Trigger: trainer sends reminder
   - Recipient: player
   - Type: `PAYMENT_REMINDER`

## 3.2 Implemented real-time socket alerts (UI/live only)

1. **Venue-owner booking status updates** via socket + page toasts.
2. **Match live scoring/status updates** for scorers/spectators.
3. **Open play join/leave events** for connected clients.
4. **Schedule update events** for venue operations.

---

## 4. Where Push/In-app Notifications Are Needed

The following list prioritizes events where users should receive in-app now and true push later.

## 4.1 High priority (time-sensitive, conversion-critical)

1. **Peer invite lifecycle**
   - Files: `apps/api/src/routes/peer-invites.ts`, `apps/api/src/routes/peers.ts`
   - Needed events:
     - invite received (receiver)
     - invite accepted/declined/cancelled (sender + receiver where relevant)
     - peer request accepted/declined

2. **Booking lifecycle**
   - Files: `apps/api/src/routes/bookings.ts`, `apps/api/src/services/bookingConflict.ts`
   - Needed events:
     - booking created/confirmed/cancelled
     - payment status changed
     - conflict resolution result (winner/loser)

3. **Refund lifecycle**
   - File: `apps/api/src/workers/refundWorker.ts`
   - Needed events:
     - refund initiated
     - refund completed
     - refund failed (with reason)

4. **Open play lifecycle**
   - Files: `apps/api/src/routes/open-plays.ts`, `apps/api/src/workers/openPlayDeadlineWorker.ts`
   - Needed events:
     - join deadline approaching
     - session confirmed/cancelled
     - session full / spot reopened

## 4.2 Medium priority (retention and trust)

5. **Batch membership decisioning**
   - File: `apps/api/src/routes/batches.ts`
   - Needed events:
     - join request approved/rejected
     - member removed/left (to trainer and/or player as appropriate)

6. **Tournament lifecycle**
   - File: `apps/api/src/routes/tournaments.ts`
   - Needed events:
     - tournament announcements
     - fixture published/updated
     - match result posted

7. **Match confirmation workflow**
   - File: `apps/api/src/routes/matches.ts`
   - Needed events:
     - new confirmation request
     - acceptance/rejection summary to match creator

8. **Wallet and credits**
   - Files: `apps/api/src/routes/wallet.ts`, `apps/api/src/services/wallet.ts`
   - Needed events:
     - wallet credited/debited
     - low balance warning

## 4.3 Operational/quality reminders

9. **Trainer monthly review due reminders**
   - File: `apps/api/src/routes/batches.ts` (`/reviews` flow)
   - Needed events:
     - monthly review due
     - overdue reminder

10. **Ratings and milestone updates**
    - Files: `apps/api/src/services/elo.ts`, `apps/api/src/workers/ratingDriftWorker.ts`
    - Needed events:
      - significant rating changes
      - rank milestone reached

---

## 5. Frontend/Preference Gaps

1. `apps/web/src/pages/Settings.tsx` has notification preference toggles stored only in localStorage.
2. Preferences are not enforced server-side for delivery decisions.
3. Notification type styling in `apps/web/src/pages/Notifications.tsx` is batch/payment focused; future types (peer invites, booking, rating) need dedicated UI treatment.

---

## 6. Delivery Maturity Summary

| Layer | Status | Notes |
|------|--------|-------|
| In-app notification DB model | Implemented | `Notification` table and read APIs are live |
| In-app notification event coverage | Partial | Only batch-related triggers currently write notifications |
| Real-time socket delivery | Implemented | Works only for connected clients |
| Email notifications | Partial | Auth + parts of booking flow |
| WhatsApp reminders | Implemented (manual) | Deep-link bridge, not automated delivery |
| Device push (FCM/APNs/WebPush) | Not implemented | Planned as future phase |

---

## 7. Suggested Phase-2 Push Architecture

1. Add server-side delivery preferences (email/in-app/push flags per event class).
2. Add device/subscription token models (mobile/web).
3. Add push dispatch worker queue with retry + dead-letter strategy.
4. Extend notification event taxonomy beyond batch/payment into peer, booking, open play, refund, wallet, rating, tournament.
5. Keep `Notification` table as source-of-truth audit log for all channels.

---

## 8. References

- `apps/api/src/services/notificationService.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/routes/batches.ts`
- `apps/api/src/routes/bookings.ts`
- `apps/api/src/routes/open-plays.ts`
- `apps/api/src/routes/peer-invites.ts`
- `apps/api/src/routes/peers.ts`
- `apps/api/src/routes/tournaments.ts`
- `apps/api/src/routes/matches.ts`
- `apps/api/src/routes/wallet.ts`
- `apps/api/src/lib/socket.ts`
- `apps/api/prisma/schema.prisma`
- `apps/web/src/pages/Notifications.tsx`
- `apps/web/src/pages/Settings.tsx`
- `docs/FUTURE_DEVELOPMENT.md`
- `docs/ADR_CHANGE_RATIONALE_LOG.md`
- `docs/DATA_MODEL.md`
