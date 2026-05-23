# Sponsor Monetization Module (Tournament-Based Revenue Engine)

**Version:** 1.1  
**Last updated:** Apr 2026

The platform is not just venue booking — it is a **local sports ecosystem** (Pune-first model). This document defines the **Sponsor Monetization Module**: tournament-based sponsor visibility, placements, and revenue models.

---

## 1. Business goal

Enable:

- **Local brands** to sponsor tournaments
- **In-app sponsor visibility** (banners, scorecards, leaderboards)
- **Performance-based sponsor placements** (tier, contract, analytics)
- **Revenue generation** from digital + physical presence

---

## 2. New module: Tournament + Sponsor Management

### 2.1 Features

| Feature | Description |
|--------|-------------|
| **Create Tournament** | Define sport, entry fee per team, maximum teams, dates |
| **Fixtures auto-generation** | System-generated knockout / round-robin slots |
| **Points table** | Per-tournament standings |
| **Knockout brackets** | Bracket view and winner/runner-up |
| **Prize pool tracking** | Entry fees, prize distribution, margin |

### 2.2 Entities

| Entity | Purpose |
|--------|---------|
| **Tournament** | Tournament definition (sport, format, entry fee, max teams, prize pool) |
| **Team** | Registered teams per tournament |
| **Sponsor** | Sponsor profile (name, logo, tier, contract dates) |
| **Fixtures** | TournamentFixture (match slots, results) |
| **Points Table** | Derived from fixtures / matches (standings) |

---

## 3. Sponsor visibility features

### 3.1 Digital sponsor placement (in-app)

| Placement | Description |
|-----------|-------------|
| **Home Page Banner** | Sponsored banner on home (e.g. “Pune Premier League – Powered by XYZ Fitness”) |
| **Tournament Page – Sponsored By** | “Sponsored by” block on tournament detail |
| **Match Scorecard Footer Logo** | Sponsor logo on live/past match scorecard |
| **Leaderboard – Top Sponsor** | Sponsor branding on leaderboard (e.g. top section) |
| **Push Notification Branding** | Sponsor mention in tournament/match push notifications |
| **Email Receipt – Sponsor Footer** | Sponsor logo/footer on booking/receipt emails |

### 3.2 Digital model (physical tournaments)

When tournaments are played physically:

- Sponsor logo on **digital scorecard**
- **Social media shoutouts** (tournament/match posts)
- **Livestream watermark** (when livestream is used)

---

## 4. Monetization models

| Model | Description |
|------|-------------|
| **Model A – Flat sponsorship fee** | Sponsor pays **₹X per tournament** (fixed). |
| **Model B – Tiered sponsorship** | Tiers with different cost and benefits (see table below). |
| **Model C – Revenue share** | Platform takes: % of **entry fee**, **sponsor fee**, **venue commission**. |

### 4.1 Tiered sponsorship (example)

| Tier | Cost (example) | Benefits |
|------|----------------|----------|
| **Gold** | ₹50,000 | App banner + push notifications |
| **Silver** | ₹25,000 | App banner + scorecard logo |
| **Bronze** | ₹10,000 | Scorecard footer |

---

## 5. System design changes required

### 5.1 New database tables (conceptual)

**Sponsors**

| Field | Description |
|-------|-------------|
| sponsor_id | PK |
| name | Sponsor name |
| logo_url | Logo asset URL |
| tier | Gold / Silver / Bronze (or custom) |
| contract_start | Contract start date |
| contract_end | Contract end date |

**Tournament_Sponsors** (junction)

| Field | Description |
|-------|-------------|
| tournament_id | FK to Tournament |
| sponsor_id | FK to Sponsor |
| placement_type | e.g. banner, scorecard_footer, leaderboard_top |

### 5.2 Important system considerations

- **Sponsor visibility logic must be dynamic:**
  - Based on **tier** (which placements the tier allows)
  - Based on **active contract** (contract_start ≤ today ≤ contract_end)
- **Prevent expired sponsor display** — do not show sponsors past contract_end.
- **Analytics for sponsors:**
  - Impressions
  - Clicks
  - Tournament reach

---

## 6. Sponsor dashboard (value add)

Allow sponsors to see:

- **Tournament views** (e.g. page views per tournament)
- **Player engagement** (e.g. unique users who saw placement)
- **Click-through rate** (CTR) on placements
- **Geo breakdown** (e.g. Pune area-wise)

This increases **sponsor retention** and justifies renewal.

---

## 7. Strategic advantage (Pune-first)

With a **Pune-first** focus, target:

- Local gyms  
- Sports shops  
- Protein brands  
- Coaching academies  
- Cafés near grounds  

**Hyperlocal sponsorship = higher conversion.**

---

## 8. Business insight – app revenue streams

The app revenue streams can be:

| Stream | Description |
|--------|-------------|
| **Venue booking commission** | 10–20% (existing) |
| **Tournament entry fee margin** | Platform share of entry fees |
| **Sponsor revenue** | Flat fee, tiered, or revenue share (this module) |
| **Featured venue promotion** | Paid promotion of venues in discovery |

---

## 9. Relation to existing docs

- **Tournaments:** Existing tournament model and fixtures (FRD §8, DATA_MODEL, TOURNAMENT_STAGES.md) form the base; this module adds **sponsor** and **placement** layer.
- **Monetization:** BRD §4 item 9 and DATA_MODEL “Monetization” already note tournament sponsor visibility; this doc is the **detailed design** for the Sponsor Monetization Module.
- **Implementation:** New entities (Sponsor, Tournament_Sponsors), placement rules (tier + contract), and sponsor dashboard are **to be implemented**; API and schema details to be added in FRD/TSD/DATA_MODEL when scope is locked.

---

## 10. References

- **BRD:** `docs/BRD.md` — business capabilities, tournament monetization
- **FRD:** `docs/FRD.md` §8 (FR-TOUR-8)
- **Data model:** `docs/DATA_MODEL.md` — Monetization section, Tournament
- **Document index:** `docs/TRACEABILITY.md`
- **Implementation status:** `docs/IMPLEMENTATION_STATUS.md`
