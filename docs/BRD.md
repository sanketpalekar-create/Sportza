# Business Requirements Document (BRD)

## Sportza — Business Requirements

**Version:** 1.3  
**Last updated:** Apr 2026

---

## 1. Executive summary

The platform enables **venue owners** to list and monetize sports facilities, **players** to discover and book slots, form **open plays** and **tournaments**, and track **match results** and **player statistics**. It supports multiple sports, flexible pricing (including batch/trainer discounts), split payments, venue add-ons, and structured tournaments with system-generated fixtures.

---

## 2. Vision and objectives

| Objective | Description |
|-----------|-------------|
| **Venue monetization** | Venues can offer multiple facilities per sport, set per-sport and time-slot pricing, and sell add-ons (beverages, equipment rent, eatables). At onboarding, a **platform commission %** is agreed; for every booking at that venue the platform keeps the commission and the venue receives the net payout. |
| **Trainer monetization** | Trainers run batches; at onboarding a **platform commission %** per batch can be agreed. For every batch fee payment recorded, the platform keeps the commission and the trainer receives the net amount. |
| **Player discovery** | Players discover venues (by sport, city, search), trainers (by sport, city), and batches (by sport, city). **One trainer can teach multiple sports** (trainer profile lists all sports they offer; each batch is one sport). Venue and trainer profiles show average rating and review count; players post reviews (venue: any time; trainer: only after completing ≥1 month in a batch with that trainer). Players can join a batch after viewing batch info and trainer ratings. |
| **Player discovery & booking** | Players can find venues by sport/location, check availability, and book slots with clear pricing (including GST). |
| **Flexible payment** | Support full payment (one payer) or split payment (each participant pays their share); add-on purchases are attributed to the purchaser and added to their share when split. |
| **Open play** | A booker can create a joinable “open play” for a format (e.g. 11-a-side); others join and pay. Confirmation is **payment-priority based**: first booking to reach **≥50% paid** wins the slot; no auto-cancel at T-30. See `docs/BOOKING_STATE_AND_FLOWS.md`. |
| **Tournaments** | Users can create tournaments (any location or venue), register teams/players, and let the system generate matchup slots (knockout or round-robin). Match scoring flows into player stats; winner and runner-up are recorded. **While tournaments are maintained and scaled, sponsor visibility increases, leading to monetization** (sponsor placements, branded inventory, partnership revenue). |
| **Real-time match scoring** | Match scores support multiple sports and formats (cricket, tennis, padel, pickleball rally/service, football). Live score updates via Socket.io; score structure and validation per sport/format. |
| **Trainer monthly reviews** | Trainers rate each player in their batch monthly on sport and cognitive parameters; players track month-on-month progress alongside match stats. |
| **Stats and leaderboards** | Per-sport stats (e.g. runs, goals) and match history drive leaderboards and player profiles. |

---

## 3. Stakeholders

| Role | Description |
|------|-------------|
| **Player** | Discovers venues, trainers, and batches (by sport/location); books facilities; joins batches and open plays; participates in matches and tournaments; posts venue/trainer reviews (trainer review only after ≥1 month with trainer); views stats and monthly batch progress. |
| **Venue owner** | Registers venues, sets facilities and pricing, manages add-ons, sees bookings and monthly commission/venue net reports. |
| **Trainer** | Runs batches, associates with venues, submits monthly player reviews, receives batch fee payments and monthly trainer net reports. |
| **Admin** | Manages sports, venues, and platform configuration; accesses platform monthly commission reports. |

---

## 4. Business capabilities (high-level)

1. **Venue and facility management** – Multi-facility venues; facilities can support multiple sports; per-sport and time-slot pricing with GST.
2. **Booking and payments** – Slot booking with conflict checks; full or split payment; integration with payment gateway; add-on purchases attached to booking and to the purchasing user in split mode.
3. **Open play** – Create open play from a booking; others discover and join; confirmation is payment-priority based (first to ≥50% paid wins); no auto-cancel at T-30. See `docs/BOOKING_STATE_AND_FLOWS.md`.
4. **Matches and scoring** – Create matches from a booking or from a tournament fixture; **real-time scoring** by sport/format (simple, cricket, tennis, padel, pickleball rally/service); record scores and per-player stats; live updates via Socket.io; complete match to update aggregated player stats.
5. **Tournaments** – Create tournament (venue or any location); register teams; generate fixture slots (knockout / round-robin); create matches from slots; record winner and runner-up.
6. **Batches** – Trainer-defined batches with optional venue link and per-player fees; dedicated venue bookings at discounted price; batch fee payments with platform commission and trainer net payout; **batch discovery** (sport, city) and **player join**; **monthly player reviews** by trainer (sport + cognitive parameters); players track month-on-month progress.
7. **Discovery and ratings** – Players discover venues, trainers, and batches by sport and location. **Venue reviews** and **trainer reviews** (rating 1–5 + optional text); average rating and review count on venue and trainer profiles. A player may review a **trainer only after completing at least 1 month** in a batch with that trainer (trainer must have submitted a monthly review for the player).
8. **Player stats** – Sport-specific stats and leaderboards driven by completed matches; player monthly batch progress (trainer reviews) as add-on.
9. **Monetization** – Per-venue commission % on bookings (platform vs venue net; add-ons not subject to commission); per-batch commission % on batch fee payments (platform vs trainer net). System calculates and stores commission and net amounts per booking and per batch payment. **Monthly reports** aggregate by calendar month: venue net revenue and platform commission per venue; trainer net revenue and platform commission per trainer; platform-wide commission report with optional breakdown. Commission and payouts are **settled month-wise** for transparency and clarity for trainers, venue owners, and the platform. **Tournament monetization:** As tournaments are maintained and scaled, **sponsor visibility** increases (in-app placements, fixture lists, results, leaderboards), which drives **sponsor-led monetization** (branded inventory, partnership deals, event sponsorship). See **`docs/SPONSOR_MONETIZATION_MODULE.md`** for the full Sponsor Monetization Module (tournament-based revenue engine): sponsor tiers, placements, contract logic, and sponsor dashboard.

---

## 5. Success criteria

- Venues can list facilities, set pricing, and receive bookings with correct amounts (including add-ons and split logic).
- Players can discover venues, trainers, and batches by sport and location; venue and trainer profiles show average rating and review count; trainer reviews are allowed only after the player has completed at least one month in a batch with that trainer.
- Open play and split bookings confirm when ≥50% paid (payment-priority: first to reach ≥50% wins); no auto-cancel at T-30. Solo and batch bookings confirm immediately on payment. Refunds: manual cancel 95% (5% fee); conflict 100%. See `docs/BOOKING_STATE_AND_FLOWS.md`.
- Monthly reports (venue, trainer, platform) correctly aggregate commission and net revenue by calendar month for settlement.
- Tournaments support configurable teams and system-generated slots; match results and winner/runner-up are stored and reflected in stats.
- Players can view their own and others’ stats and match history consistent with completed matches; players can view their monthly batch progress (trainer reviews).

---

## 6. Out of scope (for this BRD)

- Detailed UI/UX specifications (covered in FRD or design docs).
- Non-functional requirements (performance, security policy) as a separate NFR document.
- Mobile app specifics; BRD applies to the platform capabilities (API-first).

---

## 7. Application screens (MVP)

The following screens support the business capabilities above. Implemented in the mobile app (Figma dark theme) at `/app` and auth at `/login`, `/register`.

| Module | Screen | Purpose | Status |
|--------|--------|---------|--------|
| **Auth** | Login | Auth0 (Google SSO, Email OTP, Magic Link); link to Register | Designed |
| **Auth** | Register | Auth0 sign-up; Name, email, phone (optional), city (optional); minimal clicks | Designed |
| **Entry** | Splash | First screen before auth | Pending |
| **Entry** | Forgot password | Reset flow from Login | Pending |
| **Home** | Home tab | Welcome, quick actions, next game, featured venues (Book Now, See all) | Designed |
| **Home** | Venue List | Search, sport filters, venue cards; opens Venue Detail | Designed |
| **Booking** | Venue Detail | Image, name, rating, location, price; facility & date; Ratings & reviews block; Select Slot | Designed |
| **Booking** | Venue Reviews | Average rating, review count; list reviews; Write review (1–5 + text); delete own review | Designed |
| **Booking** | Time Slot | Slot grid (Morning/Afternoon/Evening); duration + total; Continue | Designed |
| **Booking** | Booking Summary | Details card, price breakdown, add-ons; Continue | Designed |
| **Booking** | Payment Type | Pay Full / Split; split: list players, editable amounts | Designed |
| **Booking** | Payment | Total, payment UI placeholder; Pay Now; nav hidden | Designed |
| **Booking** | Confirmation | Success, booking ID, Add to Calendar, Create Open Play, View Booking | Designed |
| **Bookings** | Bookings tab | Upcoming / Completed; booking cards; Details | Designed |
| **Bookings** | Booking Detail | Single booking; Cancel, Modify | Designed |
| **Bookings** | Payment History | List of past payments, receipts; period filter; total paid summary | Designed |
| **Open Play** | Open Play tab | Discover / My Open Plays; Host a Session; search, sport filters; session cards | Designed |
| **Open Play** | Open Play Detail | Session info; Join, Leave, View Players | Designed |
| **Open Play** | Create Open Play | Select Booking → Select Format → Publish (placeholder) | Placeholder |
| **Open Play** | Manage session | Edit max players/notes; View players; Cancel session (with confirm) | Designed |
| **Stats** | Stats overview | Sport filter, summary cards, performance chart, leaderboard preview, match history, sports breakdown, achievements | Designed |
| **Stats** | Leaderboard | Sport filter, ranked list with points | Designed |
| **Matches** | Match list | Upcoming / Live / Completed; Start or View score per match | Designed |
| **Matches** | Live Match | In-game scoring (simple, cricket, tennis); Start/Complete; nav hidden | Designed |
| **Profile** | Profile tab | User card, stats, menu (Edit Profile, Payment Methods, Notifications, Settings, Help, Log out) | Designed |
| **Discovery** | Trainer List | Search, sport/city filters; trainer cards (name, **sports** (can be multiple), city, rating, review count) | Designed |
| **Discovery** | Trainer Detail | Bio, **sports** (all offered), city, batches; Ratings & reviews block; View batches (placeholder) | Designed |
| **Discovery** | Trainer Reviews | Average rating, review count; list reviews; Write review only if ≥1 month in batch; delete own review | Designed |
| **Profile** | Edit Profile, My Sports, Settings, Notifications, Support | Account and preferences | Pending |
| **Other** | Create Tournament | Full flow | Pending |

---

## 8. References

- **Document index & traceability:** `docs/TRACEABILITY.md` — central index of all documents and BRD → FRD → TSD/implementation mapping.
- **Functional requirements:** `docs/FRD.md`, `docs/frd.html`
- **Technical specification:** `docs/TSD.md`, `docs/tsd.html`
- **Data model:** `docs/DATA_MODEL.md`, `docs/data-model.html`
- **Booking state & flows:** `docs/BOOKING_STATE_AND_FLOWS.md`, `docs/booking-state-and-flows.html` — master booking logic, 14 use cases, refund rules, payment-priority.
- **Navigation (UX):** `docs/NAVIGATION.md` — bottom nav (Home | Bookings | Open Play | Stats | Profile), when to hide nav, full app map; role switch (Venue Owner, Trainer).
- **Booking flow UX:** `docs/BOOKING_FLOW_UX.md` — screen-by-screen (Venue → Slot → Summary → Payment → Confirmation), pricing transparency.
- **Payment gateway architecture:** `docs/PAYMENT_GATEWAY_ARCHITECTURE.md`, `docs/payment-gateway-architecture.html` — Razorpay; UPI, Card, Net Banking, Wallet.
- **Venue Owner & Trainer views:** `docs/VENUE_OWNER_AND_TRAINER_VIEWS.md` — screen list, flows, APIs for Venue Owner (venues, bookings, reports) and Trainer (batches, payments, reviews, earnings).
- **Tournament stages:** `docs/TOURNAMENT_STAGES.md` — multi-stage tournaments (e.g. groups → knockout → final).
- **Sponsor monetization:** `docs/SPONSOR_MONETIZATION_MODULE.md` — tournament-based sponsor revenue, placements, tiers, Sponsor/Tournament_Sponsors, sponsor dashboard.
- **Implementation status:** `docs/IMPLEMENTATION_STATUS.md` — what is implemented vs missing (apps/api, apps/web, config).

---

## 9. Traceability

- **BRD → FRD:** Each business capability in §4 maps to one or more FRD modules (see `docs/TRACEABILITY.md` §2).
- **BRD → Implementation:** Via FRD and TSD; data model and `apps/api` routes implement the capabilities above. Platform built as Turborepo monorepo: `apps/web` (Vite, React, Tailwind, Auth0), `apps/api` (Express, Prisma/MySQL), `packages/ui`, `packages/api-client`.
