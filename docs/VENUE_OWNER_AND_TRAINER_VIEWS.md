# Venue Owner & Trainer View Pages — Design & Implementation

**Version:** 2.1  
**Last updated:** Mar 2026

This document designs the **Venue Owner** and **Trainer** view pages in the Sportza Turborepo monorepo. Entry is via **Profile → Switch Role**. All screens use **Tailwind CSS**, **@sportza/ui** components, and **@sportza/api-client** hooks for data fetching and mutations.

---

## 1. Entry and navigation

| Role | Entry | Routes | After switch |
|------|--------|--------|---------------|
| **Player** | Default | `/` | Bottom nav: Home, Bookings, Open Play, Stats, Profile |
| **Trainer** | Profile → **Switch Role** → Trainer | `/trainer/*` | Bottom nav: Dashboard, Batches, Sessions, Payments, Profile |
| **Venue Owner** | Profile → **Switch Role** → Venue Owner | `/venue-owner/*` | Bottom nav: Dashboard, Bookings, Facilities, Payments, Profile |
| **Back to Player** | Profile → Switch Role → Player | `/` | Returns to player nav |

- Role switching persists in `localStorage` (`sportza_mode`)
- Current mode displayed as badge in headers: "Trainer Mode" / "Venue Mode"
- All UI built with **Tailwind CSS** and **@sportza/ui** shared components
- Data fetching via **@sportza/api-client** (TanStack Query hooks)

---

## 2. Venue Owner view pages

### 2.1 Screen list

| Screen | Component | Route | Purpose |
|--------|-----------|-------|---------|
| **VenueDashboard** | VenueDashboard.tsx | `/venue-owner` | Today's bookings, revenue, slot occupancy, upcoming bookings |
| **VenueBookings** | VenueBookings.tsx | `/venue-owner/bookings` | Calendar week view, booking cards per day |
| **VenueFacilities** | VenueFacilities.tsx | `/venue-owner/facilities` | List facilities, edit pricing, toggle maintenance/availability |
| **VenuePayments** | VenuePayments.tsx | `/venue-owner/payments` | Revenue analytics, commission breakdown, transaction list |
| **Profile** | Profile (shared) | `/profile` | Account, Switch Role, Create Tournament |

### 2.2 Venue Owner navigation structure

```
/venue-owner/*
├── VenueDashboard (/venue-owner)
│      ├── Today's Bookings count
│      ├── Monthly Revenue
│      ├── Slot Occupancy
│      └── Upcoming Bookings list
├── VenueBookings (/venue-owner/bookings)
│      ├── Week Calendar (date selector)
│      └── Booking Cards (facility, time, player, type)
├── VenueFacilities (/venue-owner/facilities)
│      ├── Facility List (sport, surface, pricing)
│      ├── Edit Pricing
│      ├── Toggle Maintenance
│      └── Toggle Availability
├── VenuePayments (/venue-owner/payments)
│      ├── Total Revenue
│      ├── Commission Breakdown
│      ├── Daily Revenue Chart
│      └── Recent Transactions
└── Profile (/profile)
```

---

## 3. Trainer view pages

### 3.1 Purpose

Trainers create/manage batches, manage players, record attendance, track payments, post announcements, view reviews, and communicate with players.

### 3.2 Screen list

| Screen | Component | Route | Purpose |
|--------|-----------|-------|---------|
| **TrainerDashboard** | TrainerDashboard.tsx | `/trainer` | Active batches, total players, monthly revenue, attendance rate, today's sessions |
| **TrainerBatches** | TrainerBatches.tsx | `/trainer/batches` | List of batches; create new batch |
| **TrainerSessions** | TrainerSessions.tsx | `/trainer/sessions` | All sessions across batches; filter by All / Upcoming / Completed / Cancelled |
| **TrainerPayments** | TrainerPayments.tsx | `/trainer/payments` | Revenue summary, pending/collected, add offline payment, send reminders |
| **TrainerReviews** | TrainerReviews.tsx | `/trainer/reviews` | Player reviews and ratings for the trainer |
| **BatchDetail** | BatchDetail.tsx | `/trainer/batches/:id` | Batch detail with Players, Sessions, Attendance, Payments, Announcements tabs |
| **CreateBatch** | CreateBatch.tsx | `/trainer/batches/create` | Create new batch flow |
| **Profile** | Profile (shared) | `/profile` | Account, Switch Role |

### 3.3 Trainer navigation structure

```
/trainer/*
├── TrainerDashboard (/trainer)
│      ├── Active Batches count
│      ├── Total Players
│      ├── Monthly Revenue (net after commission)
│      ├── Attendance Rate
│      ├── Today's Sessions (with Attendance CTA)
│      └── Recent Announcements
├── TrainerBatches (/trainer/batches)
│      ├── Create New Batch → /trainer/batches/create
│      └── Batch Card → BatchDetail (/trainer/batches/:id)
│             ├── Players Tab (list, add, remove)
│             ├── Sessions Tab (mark completed, cancel)
│             ├── Attendance Tab (per-session, mark all present)
│             ├── Payments Tab (collected, pending, add offline)
│             └── Announcements Tab (post, view)
├── TrainerSessions (/trainer/sessions)
│      ├── All sessions across batches
│      └── Filter: All / Upcoming / Completed / Cancelled
├── TrainerPayments (/trainer/payments)
│      ├── Revenue Summary (Expected, Collected, Pending)
│      ├── Pending / Collected toggle
│      ├── Player Payment List
│      ├── Add Offline Payment
│      └── Send Reminders
├── TrainerReviews (/trainer/reviews)
│      ├── Review list with ratings
│      └── Filter by batch (optional)
└── Profile (/profile)
       └── My Tournaments → Tournament List
```

### 3.4 Batch Detail — Tab Details

| Tab | Features | API |
|-----|----------|-----|
| **Players** | List enrolled players with payment status, Add player, Remove player | `POST /api/batches/:id/players`, `DELETE /api/batches/:id/players/:playerId` |
| **Sessions** | List scheduled sessions, Mark completed, Cancel | `GET /api/batches/:id/sessions`, `PATCH /api/batches/sessions/:sessionId` |
| **Attendance** | Select session, player checkboxes, Mark All Present, Save | `POST /api/batches/sessions/:sessionId/attendance` |
| **Payments** | Expected/Collected/Pending summary, payment list, Add Offline | `GET /api/batches/:id/payments`, `POST /api/batches/:id/payments` |
| **Announcements** | Post announcement, view list | `POST /api/batches/:id/announcements`, `GET /api/batches/:id/announcements` |

### 3.5 API mapping (trainer) — Complete

| Screen / Action | API Endpoint | Method |
|-----------------|-------------|--------|
| Dashboard | `/api/trainers/me/dashboard` | GET |
| My Profile | `/api/trainers/me/profile` | GET |
| Update Profile | `/api/trainers/me/profile` | PATCH |
| Settlement Report | `/api/trainers/me/settlement?month=&year=` | GET |
| My Batches | `/api/batches` | GET |
| Batch Detail | `/api/batches/:id` | GET |
| Create Batch | `/api/batches` | POST |
| Update Batch | `/api/batches/:id` | PUT |
| Delete Batch | `/api/batches/:id` | DELETE |
| Add Player | `/api/batches/:id/players` | POST |
| Remove Player | `/api/batches/:id/players/:playerId` | DELETE |
| List Sessions | `/api/batches/:id/sessions` | GET |
| Generate Sessions | `/api/batches/:id/sessions/generate` | POST |
| Update Session | `/api/batches/sessions/:sessionId` | PATCH |
| Get Attendance | `/api/batches/sessions/:sessionId/attendance` | GET |
| Mark Attendance | `/api/batches/sessions/:sessionId/attendance` | POST |
| List Payments | `/api/batches/:id/payments` | GET |
| Record Payment | `/api/batches/:id/payments` | POST |
| List Announcements | `/api/batches/:id/announcements` | GET |
| Post Announcement | `/api/batches/:id/announcements` | POST |
| Trainer Reviews | `/api/trainers/me/reviews` | GET |
| My Venues | `/api/trainers/me/venues` | GET |
| Training Explore | `/api/trainings/explore` | GET |
| Trainer Detail (Player) | `/api/trainings/trainer/:trainerId` | GET |

---

## 4. Monorepo structure and tech stack

| Layer | Location | Technology |
|-------|----------|------------|
| **Web app** | `apps/web` | Vite + React + Tailwind + Auth0 + TanStack Query |
| **API** | `apps/api` | Express + Prisma + Zod + OpenAPI + Redis + BullMQ |
| **UI components** | `packages/ui` | Shared React components (Button, Card, Badge, etc.) |
| **API client** | `packages/api-client` | TanStack Query hooks, API types, OpenAPI-generated client |
| **Design tokens** | `packages/tokens` | Colors, spacing, typography tokens |

All Venue Owner and Trainer screens in `apps/web` import:

- `@sportza/ui` — shared components (e.g. `Button`, `Card`, `Badge`, `Table`)
- `@sportza/api-client` — hooks like `useVenueBookings`, `useTrainerDashboard`, `useBatches`, etc.
- Tailwind utility classes for layout and styling

---

## 5. Commission & Settlement

- **Commission %** is set per batch (`Batch.commissionPercent`)
- When a payment is recorded, commission is auto-calculated:
  - `platformCommissionAmount = amount × (commissionPercent / 100)`
  - `trainerNetAmount = amount - platformCommissionAmount`
- **Settlement reports** via `GET /api/trainers/me/settlement?month=&year=` return per-batch breakdown

---

## 6. Related documents

- **Navigation (role switch):** [NAVIGATION.md](NAVIGATION.md) §5
- **FRD (actors, batches, reports):** [FRD.md](FRD.md)
- **Data model:** [DATA_MODEL.md](DATA_MODEL.md)
- **UI/UX summary:** [UI_UX_REQUIREMENTS_SUMMARY.md](UI_UX_REQUIREMENTS_SUMMARY.md)
- **Implementation status:** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
