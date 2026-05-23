# Functional Requirements Document (FRD)

## Sportza — Functional Requirements

**Version:** 1.5  
**Last updated:** Apr 2026

---

## 1. Introduction

This document describes **functional requirements** for **Sportza** (sports venue booking & tournament platform). It is aligned with the Data Model and BRD. Requirements are grouped by module and expressed as capabilities and API behaviour.

---

## 2. Actors

| Actor | Description |
|-------|-------------|
| **User (unauthenticated)** | Can view public info (e.g. sports list, venue list, leaderboard). |
| **User (authenticated)** | Logged-in user; role can be player, venue_owner, trainer, or admin. |
| **Player** | Books slots, creates/joins open plays, creates/plays matches and tournaments, views stats. |
| **Venue owner** | Creates/updates venues, views bookings for their venues. |
| **Trainer** | Creates batches, manages players, records attendance, tracks payments, posts announcements, manages profile. |
| **Admin** | Full access; can manage sports, venues, and users. |

---

## 3. Authentication and authorization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUTH-1 | Users register/login via **Auth0** (Google SSO, Email OTP via Redis, Magic Link). Auth0 JWT used for API auth. | Must |
| FR-AUTH-2 | Role-based access: player, venue_owner, trainer, admin. Endpoints enforce role where needed. | Must |
| FR-AUTH-3 | Venue owner can only modify their own venues; trainer only their batches; tournament creator only their tournament. | Must |

---

## 4. Sports and venues

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SPORT-1 | List active sports (formats, default pricing, stat fields). Create/update sport (admin). | Must |
| FR-SPORT-2 | Venue has multiple sport facilities; each facility can support multiple sports. Conflict check is per facility and time. | Must |
| FR-VENUE-1 | CRUD venues (venue_owner/admin). Set sportFacilities (including optional `surfaceType`), sportRates, location, gstRate, availability. | Must |
| FR-VENUE-2 | Venue can define add-ons (beverage, equipment_rent, eatable, other) with name, category, price, unit (per_item/per_hour/per_session), optional sport. | Must |
| FR-VENUE-3 | List venues with filters (sport, city, search). Get single venue with full details, addOns, **averageRating** and **reviewCount**. Venue reviews: GET /api/venues/:id/reviews (paginated), POST /api/venues/:id/reviews (auth: rating 1–5, review text), DELETE /api/venues/:id/reviews/me (auth). | Must |
| FR-VENUE-4 | Venue has commissionPercent (0–100); set at create/update (onboarding). Used for every booking at that venue to compute platform commission and venue net payout. | Must |

---

## 5. Booking and payments

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BOOK-1 | Create booking: venue, facilityId, facilityName, sport, bookingDate, startTime, endTime; optional batch for discount. System computes subtotal, GST, totalAmount and stores booking-time facility snapshot (`facilitySurfaceType` when available). | Must |
| FR-BOOK-1a | Create multi-court booking in one action: API accepts multiple facilities and creates grouped bookings atomically (`groupId`) so payment/conflict/cancel behavior is all-or-nothing at group level. | Must |
| FR-BOOK-2 | Support payment type **full** (one payer) or **split** (N participants with amounts). Split amounts must sum to totalAmount. | Must |
| FR-BOOK-3 | Add-on purchase: POST add-on to booking with addOnId and quantity; purchaser = current user. Total amount and (for split) purchaser’s share increase by add-on amount. | Must |
| FR-BOOK-4 | Get booking includes addOnPurchases with purchasedBy populated. | Must |
| FR-BOOK-5 | On booking create, system computes and stores platformCommissionPercent (from venue), platformCommissionAmount, venueNetAmount (base amount − commission). Add-ons are not subject to commission: when an add-on is added, totalAmount and venueNetAmount increase by the add-on amount; platformCommissionAmount stays unchanged. | Must |
| FR-BOOK-6 | Estimate endpoint returns total for given venue, sport, slot, optional batch (with discount). | Should |
| FR-BOOK-7 | Check-availability endpoint for venue + date + time range; supports single facility (`facilityId`) or multiple (`facilityIds[]`) with per-facility availability results. | Should |
| FR-PAY-1 | Create payment order (full or for one split participant); verify and capture payment; update booking/splitPayments status. Razorpay used for all payments. | Must |
| FR-PAY-2 | Get payment status for a booking (full or per split). | Must |
| FR-PAY-3 | **Payment methods:** UPI (GPay, PhonePe, Paytm, etc.), Card (credit/debit), Net Banking. Delivered via Razorpay Checkout; optional preferred method (`upi` \| `card` \| `netbanking`) may be sent when creating the order and used to pre-select the method in Checkout. | Must |
| FR-PAY-4 | **Refunds:** When a booking is cancelled (manual → **cancelled_user** or conflict → **cancelled_conflict**), the system creates **Refund** records and processes refunds via Razorpay: manual = 95% refund, 5% platform fee (proportional per payer for split); conflict = 100% refund, 0% fee. Booking paymentStatus set to **refunded**. GET /api/bookings/:id/refunds (booker/participant) and GET /api/payments/refunds (current user’s refunds). | Must |

---

## 6. Open play

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-OP-1 | Create open play from an existing booking (pending or confirmed); provide formatName. Booking status set to **pending_open_play**. | Must |
| FR-OP-2 | List open plays (filter by venue, sport, date, status). Get single open play. | Must |
| FR-OP-3 | Join/leave open play (auth). Creator cannot leave if others remain (or transfer creator). | Must |
| FR-OP-4 | Open-play (and split) confirmation is **payment-priority based**: **first to reach ≥50% paid** wins the slot; others → **cancelled_conflict** (100% refund). **No auto-cancel at T-30**; pending can remain. Optional job/GET process-confirmations at T-30 to confirm open-play bookings with ≥50% paid. See `docs/BOOKING_STATE_AND_FLOWS.md`. | Must |
| FR-OP-5 | Scheduled job and/or GET process-confirmations endpoint to run confirmation logic (confirm winner, cancel others for same slot). | Must |

---

## 7. Matches and scoring

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-MATCH-1 | Create match from **booking** (bookingId, formatName, teams) or from **tournament** (tournamentId, formatName or use tournament’s, teams, matchDate); optional **fixtureId** to link to a tournament slot. | Must |
| FR-MATCH-2 | When fixtureId is provided, match is linked to fixture (fixture.match set, status scheduled). For round-1 slots, teams filled from tournament.teams; for winner slots, teams passed in body. | Must |
| FR-MATCH-3 | Update match scores; structure depends on **scoreType** (simple, cricket, tennis, padel, pickleball_rally, pickleball_service). **PUT /api/matches/:id/scores** accepts validated payload; **PUT /api/matches/:id/start** sets status in_progress. Simple: team1/team2 numbers. Cricket: team1/team2 each { runs, wickets, overs? }, currentInnings. Tennis/padel: sets[], currentGame?, tiebreak?. **Pickleball rally**: team1/team2 (points) or games[]+currentGame (every rally scores). **Pickleball service**: team1, team2, servingTeam ('team1'\|'team2'), serverNumber (1\|2); only serving side can score. | Must |
| FR-MATCH-4 | Complete match: status = completed; aggregate player stats into PlayerStats; if tournament match, set linked fixture status = completed. | Must |
| FR-MATCH-5 | List/get matches (player sees matches they participate in); support filter by sport, status. Get match returns **scoreType** and **scoreSummary** for real-time UI. Populate tournament when present. | Must |
| FR-MATCH-6 | Real-time scoring: Socket.io room **match:&lt;matchId&gt;**; client subscribes with **match:subscribe**; server emits **match:score** (scores, scoreType, summary) on score update and **match:status** (status, match) on start/complete. | Must |

---

## 8. Tournaments

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TOUR-1 | Create tournament: name, sport, format (knockout, round_robin, league, group_knockout, other), optional venue or location (any place), matchFormatName, maxTeams, startDate, endDate. | Must |
| FR-TOUR-2 | Register teams: PUT teams with array of `{ name, players[] }` and optional maxTeams. Team count fixed after fixtures generated. | Must |
| FR-TOUR-3 | Generate fixtures: POST generate-fixtures. Knockout requires team count power of 2 (4, 8, 16); round_robin/league any ≥2. System creates all slots (TournamentFixture). | Must |
| FR-TOUR-4 | List fixtures for tournament with resolved labels (team name or “Winner of R2 M1”); each fixture may have match populated. | Must |
| FR-TOUR-5 | Delete fixtures (to re-register teams and regenerate). | Should |
| FR-TOUR-6 | Set winner and runner-up (name + id of team subdocument) when tournament is completed; updatable via PUT tournament. | Must |
| FR-TOUR-7 | List tournaments (filter sport, status). Get single tournament with place (venue or location), teams, winner, runnerUp. | Must |
| FR-TOUR-8 | **Monetization context:** As tournaments are maintained and scaled, sponsor visibility increases (tournament listings, fixtures, results, leaderboards). This drives sponsor-led monetization (branded placements, partnership deals). See **SPONSOR_MONETIZATION_MODULE.md** for placements (banner, scorecard, leaderboard, push, email), tiered sponsorship (Gold/Silver/Bronze), Sponsor + Tournament_Sponsors entities, contract-based visibility, and sponsor dashboard. Product and API to support sponsor slots and placement logic per that module. | Should |
| FR-TOUR-9 | **Tournament standings:** GET /api/tournaments/:id/standings returns format-specific standings: League/Round Robin → points table (W=3, D=1, L=0, GF, GA, GD); Knockout → bracket progression with round naming; Group+Knockout → per-group tables + knockout bracket. | Must |
| FR-TOUR-10 | **Tournament discoverability:** Players browse tournaments via TournamentListScreen with search, status filters (All, Live, Upcoming, Completed, My Tournaments). Entry from Profile → My Tournaments. | Must |
| FR-TOUR-11 | **Tournament detail:** Format-specific tabs (Overview, Standings, Bracket, Groups, Matches, Teams) with scoring rules display and match score update CTA for pending matches. | Must |

---

## 9. Batches and Trainer Mode

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BATCH-1 | CRUD batches (trainer). Set venue (optional) or location; sport; sportFees and/or feeSchedules (per-player fee by sport/day/time); commissionPercent (0–100) for platform commission on batch fee payments. | Must |
| FR-BATCH-2 | Get fee for batch by sport, day, time. Add/remove players. List batches. | Must |
| FR-BATCH-3 | When booking is created with batch id and venue matches batch.venue, apply batch venueDiscountPercent; booking.batch and discountPercent stored. | Must |
| FR-BATCH-4 | Trainer can associate with venues (list, add, update, remove). | Must |
| FR-BATCH-5 | Record batch fee payment: POST /api/batches/:id/payments with amount (and optional payer). System computes platformCommissionAmount and trainerNetAmount from batch.commissionPercent; stores BatchPayment. List payments: GET /api/batches/:id/payments (trainer or admin). | Must |
| FR-BATCH-6 | **Discovery:** GET /api/batches/discover (no auth) with query sport, city returns active batches with trainer (with **averageRating**), venue/location. GET /api/batches/:id (auth) returns batch with trainer rating for detail before join. POST /api/batches/:id/join (auth) lets a player join the batch. | Must |
| FR-BATCH-6a | **Trainer review eligibility:** A player may submit a trainer review (POST /api/trainers/:id/reviews) only after completing **at least one month** in a batch with that trainer. System enforces this by requiring a **PlayerBatchReview** (monthly review by that trainer for that player) to exist before allowing the trainer review. | Must |
| FR-BATCH-7 | Monthly player review: Trainer rates all players in a batch for a calendar month. GET /api/batches/review-parameters returns default rating parameters (sport + cognitive, e.g. skill, fitness, teamwork, attitude, 1–5 scale). POST /api/batches/:id/reviews (body: year, month, reviews: [{ playerId, ratings: {}, comment? }]); trainer only; upsert per player. GET /api/batches/:id/reviews (query year, month) lists reviews. Players track progress via GET /api/stats/me/reviews (query batch, year, month, or fromYear/fromMonth/toYear/toMonth). | Must |
| FR-REPORT-1 | Monthly venue report: GET /api/reports/venues/:venueId/monthly?year=&month= (venue owner or admin). Returns for that calendar month: booking count, total amount, platform commission, venue net revenue (from confirmed/completed bookings by bookingDate). For transparency and month-wise settlement. | Must |
| FR-REPORT-2 | Monthly trainer report: GET /api/reports/trainers/me/monthly?year=&month= (trainer) and GET /api/reports/trainers/:trainerId/monthly?year=&month= (admin). Returns for that month: payment count, total amount, platform commission, trainer net revenue (from completed BatchPayments by createdAt). For transparency and month-wise settlement. | Must |
| FR-REPORT-3 | Monthly platform report: GET /api/reports/platform/monthly?year=&month= (admin). Returns total platform commission from bookings and from batch payments, total venue net and trainer net; optional query breakdown=venue and/or breakdown=trainer for per-venue and per-trainer breakdown. For platform commission reporting and month-wise settlement. | Must |
| FR-TRAINER-1 | **Trainer Dashboard:** GET /api/trainers/me/dashboard returns aggregated: active batches count, total players, monthly revenue (net after commission), attendance rate, today's sessions, recent announcements. | Must |
| FR-TRAINER-2 | **Trainer Profile (extended):** GET/PATCH /api/trainers/me/profile for bio, years experience, sports with specialties, certifications, achievements. TrainerProfile model (one per user). | Must |
| FR-TRAINER-3 | **Session Management:** GET /api/batches/:id/sessions lists sessions. POST /api/batches/:id/sessions/generate auto-creates sessions from batch schedule. PATCH /api/batches/sessions/:sessionId updates session status (completed/cancelled). | Must |
| FR-TRAINER-4 | **Attendance Tracking:** GET /api/batches/sessions/:sessionId/attendance returns attendance. POST /api/batches/sessions/:sessionId/attendance accepts array of {playerId, status} to mark attendance. | Must |
| FR-TRAINER-5 | **Batch Announcements:** POST /api/batches/:id/announcements to broadcast messages. GET /api/batches/:id/announcements to list. Players can only view, not post. | Must |
| FR-TRAINER-6 | **Settlement Report:** GET /api/trainers/me/settlement?month=&year= returns per-batch commission breakdown with gross, commission, net amounts. | Must |
| FR-TRAINER-7 | **Training Explore (Player-facing):** GET /api/trainings/explore returns active batches with trainer profiles, searchable and filterable. GET /api/trainings/trainer/:trainerId returns trainer detail with batches. | Must |
| FR-TRAINER-8 | **Role-specific Navigation:** When user switches to Trainer mode, bottom nav changes to Dashboard, Batches, Sessions, Payments, Profile. Mode persisted in localStorage. | Must |

---

## 10. Player stats and leaderboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-STATS-1 | Per-sport stat fields defined on Sport (key, matchKey, label, type, aggregate, leaderboard). Match completion aggregates into PlayerStats per player per sport. | Must |
| FR-STATS-2 | Get player stats (by playerId, optional sport). Get current user’s stats. | Must |
| FR-STATS-3 | Leaderboard by sport (top N by configured leaderboard field). | Must |
| FR-STATS-4 | Get match history for a player (optional sport, status). | Must |
| FR-STATS-5 | Get current user's monthly batch reviews (month-on-month progress): GET /api/stats/me/reviews. Query: batch, year, month, or fromYear/fromMonth and toYear/toMonth for range. Returns reviews with batch and trainer populated. Adds on to player stats for progress tracking. | Must |

---

## 11. API summary (key endpoints)

| Module | Methods | Endpoints (key) |
|--------|--------|-----------------|
| Auth | POST | /api/auth/register, /api/auth/login |
| Sports | GET, POST, PUT | /api/sports, /api/sports/:id |
| Venues | GET, POST, PUT, DELETE | /api/venues, /api/venues/:id |
| Bookings | GET, POST, PUT | /api/bookings, /api/bookings/multi, /api/bookings/:id, /api/bookings/:id/refunds, /api/bookings/:id/add-ons, /api/bookings/estimate, /api/bookings/check-availability |
| Payments | GET, POST | /api/payments/booking/:bookingId, /api/payments/refunds, /api/payments/create-order, /api/payments/verify |
| Open plays | GET, POST | /api/open-plays, /api/open-plays/:id, /api/open-plays/process-confirmations |
| Open plays | POST, PATCH, DELETE | /api/open-plays (create), /api/open-plays/:id/join, /api/open-plays/:id/leave, PATCH :id |
| Matches | GET, POST, PUT | /api/matches, /api/matches/:id, /api/matches/:id/start, /api/matches/:id/scores, /api/matches/:id/player-stats, /api/matches/:id/complete |
| Tournaments | GET, POST, PUT | /api/tournaments, /api/tournaments/:id, /api/tournaments/:id/teams, /api/tournaments/:id/matches |
| Tournaments | POST, GET, DELETE | /api/tournaments/:id/generate-fixtures, /api/tournaments/:id/fixtures, /api/tournaments/:id/standings |
| Batches | GET, POST, PUT, DELETE | /api/batches, /api/batches/discover, /api/batches/review-parameters, /api/batches/:id, /api/batches/:id/join, /api/batches/:id/fee, /api/batches/:id/players, /api/batches/:id/reviews, /api/batches/:id/payments |
| Trainers | GET, POST, PUT, DELETE, PATCH | /api/trainers, /api/trainers/:id, /api/trainers/:id/reviews, /api/trainers/me/venues, /api/trainers/me/dashboard, /api/trainers/me/profile, /api/trainers/me/settlement |
| Trainings | GET | /api/trainings/explore, /api/trainings/trainer/:trainerId |
| Venues | GET, POST, PUT, DELETE | /api/venues (list + averageRating), /api/venues/:id (detail + averageRating), /api/venues/:id/reviews (list, POST auth, DELETE .../reviews/me) |
| Stats | GET | /api/stats/player/:playerId, /api/stats/me, /api/stats/me/reviews, /api/stats/leaderboard, /api/stats/player/:playerId/matches |
| Reports | GET | /api/reports/venues/:venueId/monthly, /api/reports/trainers/me/monthly, /api/reports/trainers/:trainerId/monthly, /api/reports/platform/monthly (admin; optional breakdown=venue,trainer) |

---

## 12. Application screens

Screens implemented in `apps/web/src/` (mobile-first, Figma dark theme). Routes: `/login`, `/register`, `/app` (tabs and stack views).

| Screen | Module | Purpose | Route / view | Status |
|--------|--------|---------|--------------|--------|
| Login | Auth | Auth0 (Google SSO, Email OTP, Magic Link); redirect to /app | /login | Designed |
| Register | Auth | Auth0 sign-up; Name, email, phone (opt), city (opt) | /register | Designed |
| Splash | Entry | First screen | — | Pending |
| Forgot password | Auth | Reset from Login | /forgot-password | Pending |
| Home tab | Home | Discovery, next game, featured venues | /app (tab) | Designed |
| Venue List | Home | Search, sport filters, venue list | view: venue-list | Designed |
| Venue Detail | Booking | Facility/date selection with facility surface labels, Ratings & reviews block, Select Slot | view: venue-detail | Designed |
| Venue Reviews | Booking | Avg rating, review count; list; write (1–5 + text); delete own | view: venue-reviews | Designed |
| Time Slot | Booking | Slot grid, per-facility availability, duration, total, Continue, surface display | view: time-slot | Designed |
| Booking Summary | Booking | Details, per-facility breakdown, add-ons, surface details | view: summary | Designed |
| Payment Type | Booking | Full / Split | view: payment-type | Designed |
| Payment | Booking | Pay Now; nav hidden | view: payment | Designed |
| Confirmation | Booking | Success, actions, selected facility surface details | view: confirmation | Designed |
| Bookings tab | Bookings | Upcoming, Completed | /app (tab) | Designed |
| Booking Detail | Bookings | Cancel, Modify | view: booking-detail | Designed |
| Payment History | Bookings | Past payments, receipts; period filter; total paid | view: payment-history | Designed |
| Open Play tab | Open Play | Discover, My Open Plays, Host | /app (tab) | Designed |
| Open Play Detail | Open Play | Join, Leave, View Players | view: openplay-detail | Designed |
| Create Open Play | Open Play | Select Booking → Format → Publish | view: create-open-play | Placeholder |
| Manage session | Open Play | Edit max players/notes; View players; Cancel session | view: manage-session | Designed |
| Stats overview | Stats | Sport filter, cards, chart, leaderboard preview, match history, achievements | /app (tab) | Designed |
| Leaderboard | Stats | Sport filter, ranked list | view: leaderboard | Designed |
| Match list | Matches | Upcoming / Live / Completed; Start or View score | view: match-list | Designed |
| Live Match | Matches | In-game scoring (simple, cricket, tennis); Start/Complete | view: live-match | Designed |
| Trainer List | Discovery | Search, sport/city filters; trainer cards (rating, review count) | view: trainer-list | Designed |
| Trainer Detail | Discovery | Bio, sport, city; Ratings & reviews block; View batches (placeholder) | view: trainer-detail | Designed |
| Trainer Reviews | Discovery | Avg rating, list; write review only if ≥1 month in batch; delete own | view: trainer-reviews | Designed |
| Sport Analytics Hub | Stats | Multi-sport selection with search/filters | view: sport-analytics | Designed |
| Sport Dashboard | Stats | KPI cards, charts, stat breakdowns, recent matches | view: sport-dashboard | Designed |
| Profile tab | Profile | User card, My Batches, My Tournaments, Switch Role | /app (tab) | Designed |
| Payment Receipt | Bookings | Ticket-style receipt with share/download | view: payment-receipt | Designed |
| Batch Detail (Player) | Training | Join batch flow with confirmation and success | view: batch-detail | Designed |
| Create Tournament | Tournaments | Multi-step: Details → Teams → Fixtures → Confirm | view: create-tournament | Designed |
| Tournament List | Tournaments | Browse, search, filter tournaments | view: tournament-list | Designed |
| Tournament Detail | Tournaments | Format-specific tabs: Overview, Standings, Bracket, Groups, Matches, Teams | view: tournament-detail | Designed |
| Trainer Dashboard | Trainer Mode | Today's sessions, stats, announcements | trainer-dashboard tab | Designed |
| Trainer Batches | Trainer Mode | List batches, create CTA | trainer-batches tab | Designed |
| Create Batch | Trainer Mode | Create with venue/custom location | view: create-batch | Designed |
| Trainer Batch Detail | Trainer Mode | 5 tabs: Players, Sessions, Attendance, Payments, Announcements | view: trainer-batch-detail | Designed |
| Trainer Sessions | Trainer Mode | Aggregated sessions across batches | trainer-sessions tab | Designed |
| Trainer Payments | Trainer Mode | Revenue summary, payment management | trainer-payments tab | Designed |
| Edit Profile, Settings, Notifications, Support | Profile | Account and preferences | — | Pending |

**Role-based screens:** Trainer Mode fully implemented (6 screens, backend wired). Venue Owner Mode UI designed (5 screens). See **docs/VENUE_OWNER_AND_TRAINER_VIEWS.md** for details.

---

## 13. Data model and payment reference

- Full entity and field definitions: **docs/DATA_MODEL.md**, **docs/data-model.html**
- Payment gateway (Razorpay, UPI, Card, Net Banking, Wallet; flow and API): **docs/PAYMENT_GATEWAY_ARCHITECTURE.md**, **docs/payment-gateway-architecture.html**
- Venue Owner and Trainer view design (screens, flows, APIs): **docs/VENUE_OWNER_AND_TRAINER_VIEWS.md**
- Multi-stage tournaments: **docs/TOURNAMENT_STAGES.md**
- Sponsor monetization (placements, tiers, entities, dashboard): **docs/SPONSOR_MONETIZATION_MODULE.md**
- Document index and traceability matrix: **docs/TRACEABILITY.md**

---

## 14. Traceability

- **BRD → FRD:** BRD capabilities (§4) map to FRD modules: Booking/payments → §5; Open play → §6; Matches → §7; Tournaments → §8; Batches → §9; Stats → §10; Reports → §11; Screens → §12. See **`docs/TRACEABILITY.md`** for the full matrix.
- **FRD → TSD / Implementation:** FRD requirements (FR-*) are implemented in `apps/api/src` routes, Prisma schema, and services; **`docs/DATA_MODEL.md`** is the source of truth for schema; **`docs/TSD.md`** describes architecture and components.
- **Refunds:** FR-PAY-4 → Refund model, `apps/api/src/services/refundService.js`, `apps/api/src/routes/bookings.js` (cancel), `apps/api/src/routes/payments.js` (conflict). **Booking state:** `docs/BOOKING_STATE_AND_FLOWS.md` → Booking.status, `apps/api/src/services/bookingConflict.js`.
