# Sportza Rating System

**Version**: 3.0
**Last updated**: April 2026
**Scope**: Backend algorithm, confidence tiers, anti-manipulation, drift, format separation, schema

---

## Implementation Status

| Feature | Status | File(s) |
|---|---|---|
| Elo backbone (result × expected score) | ✅ Live | `services/elo.ts` |
| Rating clamp (100–3000) | ✅ Live | `services/elo.ts` |
| Team average vs opponent | ✅ Live | `services/elo.ts` |
| Draw handling (result = 0.5) | ✅ Live | `services/elo.ts` |
| Gap dampener (4 tiers) | ✅ Live | `services/elo.ts` |
| Team size multiplier — per player's own team size | ✅ Live | `services/elo.ts` |
| MOV — scoreline-aware composite (completedGames) | ✅ Live | `services/elo.ts` |
| MOV applies only to winners; draws and losses get ×1.0 | ✅ Live | `services/elo.ts` |
| `scoreType` field drives sport detection for MOV | ✅ Live | `services/elo.ts` |
| `RatingHistory` linked to `Activity` via `activityId` | ✅ Live | `services/elo.ts` |
| Eligible match types: COMPETITIVE + TOURNAMENT only | ✅ Live | `services/elo.ts` |
| baseK — continuous decay formula | ✅ Live | `services/elo.ts` |
| Confidence — 7-tier system | ✅ Live | `services/elo.ts`, 3 frontend files |
| Daily gain cap (+80 per 24h per sport per format) | ✅ Live | `services/elo.ts` |
| Smurf account dampener | ✅ Live | `services/elo.ts`, schema |
| Format-based rating tracks (Singles vs Doubles) | ✅ Live | `services/elo.ts`, `routes/matchmaking.ts`, schema |
| Passive rating drift (0.5%/month) | ✅ Live | `workers/ratingDriftWorker.ts` |
| Auto-initialize ratings for all sports on signup | ✅ Live | `services/elo.ts`, `routes/auth.ts` |
| Login-time backfill (fills missing sport ratings) | ✅ Live | `routes/auth.ts` |
| City-level ranking display | 🔜 Planned | Frontend |

---

## 1. Overview

The Sportza Rating System assigns every player a numerical skill rating per **sport + format combination**. It is designed to:

- Accurately reflect a player's true skill level over time
- Reward performance quality, not just win/loss outcome
- Stabilise progressively as more match data is collected
- Resist gaming, manipulation, and artificial inflation

The system is built on the **Elo rating backbone** (used in chess, FIFA rankings, and competitive gaming) and extends it with sport-specific, community-specific, and anti-abuse adjustments.

---

## 2. Rating Basics

| Property | Value |
|---|---|
| Starting rating | **1000** for every new sport + format combination |
| Rating floor | **100** |
| Rating ceiling | **3000** |
| Rating update triggers | `COMPETITIVE` and `TOURNAMENT` match types only |
| Excluded match types | Friendly, casual, open-play |
| Rating tracks per format | Separate track per `sportId + formatName` |
| Default format | `"overall"` — assigned to all players at signup |

### Format Separation

Ratings are tracked **independently** per sport + format:

- Badminton Singles → `sportId=1, formatName="Singles"`
- Badminton Doubles → `sportId=1, formatName="Doubles"`
- Football 5-a-side → `sportId=3, formatName="5-a-side"`

The `"overall"` format is the default track, created automatically for every active sport when a player registers.

Format-specific tracks (Singles, Doubles, etc.) are created **lazily** — on first competitive match completion in that format. A player who has never played Doubles should not hold a Doubles rating.

### Auto-Initialization

When a player account is created via any registration path (email OTP, phone OTP, magic link, Google OAuth, Auth0), `initializeRatingsForAllSports()` runs immediately, creating one `SportSkillRating` row (`formatName = "overall"`, `rating = 1000`, `confidence = "unranked"`) for every active sport in the database.

### Login-Time Backfill

On every login, `initializeRatingsForAllSports()` is called again (idempotent — `getOrCreateRating` only inserts if no row exists). This ensures:

- Players who registered before auto-init was added receive ratings on their next login
- If new sports are added to the platform, all players receive a default rating row on their next login

---

## 3. The Formula

```
new rating = clamp(old + effectiveK × (result − expected), 100, 3000)

effectiveK = baseK
           × confidenceMultiplier
           × movMultiplier
           × teamSizeMultiplier
           × ratingGapDampener
```

---

## 4. Factor 1 — Result

| Outcome | Value |
|---|---|
| Win | 1.0 |
| Draw | 0.5 |
| Loss | 0.0 |

If `winnerTeam` on the match record is `null`, both teams receive `result = 0.5`.

---

## 5. Factor 2 — Expected Score

```
expected = 1 / (1 + 10^((opponentAvg − myRating) / 400))
```

`opponentAvg` = average rating of all players on the opposing team.

| Scenario | Expected score |
|---|---|
| Equal ratings (1000 vs 1000) | 0.50 |
| You are 200 points stronger | 0.76 |
| You are 400 points stronger | 0.91 |
| You are 200 points weaker | 0.24 |
| You are 400 points weaker | 0.09 |

**Key insight**: beating a much stronger opponent gives a huge gain. Losing to them loses almost nothing.

---

## 6. Factor 3 — Base K (Experience)

Continuous decay — no cliff edges:

```
baseK = max(8, round(32 / (1 + matchesPlayed / 40)))
```

| Matches | baseK |
|---|---|
| 0 | 32 |
| 10 | 24 |
| 20 | 21 |
| 40 | 16 |
| 80 | 11 |
| 120 | 9–10 |
| 200+ | 8 (floor) |

The floor of **8** ensures the rating never becomes completely immovable.

---

## 7. Factor 4 — Confidence Multiplier

Seven tiers, one every 20 matches:

```
tier = min(floor(matchesPlayed / 20), 6)
```

| Matches | Tier | Label | Multiplier | Colour |
|---|---|---|---|---|
| 0–19 | 0 | `unranked` | ×1.15 | Slate `#64748B` |
| 20–39 | 1 | `beginner` | ×1.05 | Orange `#F97316` |
| 40–59 | 2 | `developing` | ×0.95 | Amber `#F59E0B` |
| 60–79 | 3 | `established` | ×0.85 | Blue `#3B82F6` |
| 80–99 | 4 | `advanced` | ×0.75 | Green `#22C55E` |
| 100–119 | 5 | `expert` | ×0.65 | Indigo `#6366F1` |
| 120+ | 6 | `master` | ×0.55 | Purple `#A855F7` |

Stored as `VARCHAR(12)`. Legacy labels (`provisional`, `low`, `medium`, `high`) are mapped gracefully to the nearest v3 tier.

### Combined baseK × confidenceMultiplier

| Matches | baseK | confMult | Combined |
|---|---|---|---|
| 0 | 32 | ×1.15 | **36.8** |
| 20 | 21 | ×1.05 | **22.1** |
| 40 | 16 | ×0.95 | **15.2** |
| 80 | 11 | ×0.75 | **8.3** |
| 120+ | ~9 | ×0.55 | **~5.0** |

---

## 8. Factor 5 — Margin of Victory (MOV) Multiplier

MOV is only applied to the **winner**. Losers and draws always receive `movMultiplier = 1.0`.

```
movMultiplier = 1.0 + 0.35 × normalisedMargin     range: [1.00 → 1.35]
```

### Sport detection (driven by `match.scoreType`)

| `scoreType` | Score structure |
|---|---|
| `badminton`, `squash`, `pickleball`, `pickleball_rally`, `pickleball_service`, `tabletennis`, `table tennis`, `table-tennis` | `gamesWon: {A,B}` + `completedGames[]` composite |
| `tennis`, `volleyball` | `setsWon: {A,B}` + `completedSets[]` composite |
| `football`, `soccer`, `futsal`, `basketball`, `simple` | `scores: {A,B}` logistic normalisation |
| `cricket` | `completedInnings[]` run total difference |
| Unknown / malformed | Fallback → `0`, `movMultiplier = 1.0` |

### Scoreline-aware composite (racket/net sports)

When `completedGames` or `completedSets` data is present:

```
normalisedMargin = 0.4 × gameWinRatio
                 + 0.4 × totalPointDominance
                 + 0.2 × avgWonGameDominance
```

- `gameWinRatio = |gamesWon_A − gamesWon_B| / totalGames`
- `totalPointDominance = max((winnerPoints / allPoints − 0.5) / 0.5, 0)`
- `avgWonGameDominance = mean of |A−B|/(A+B) across winner's won games`

Falls back to game-win ratio only if `completedGames` is absent or empty.

**Example — Badminton 2–1 (11–2, 9–11, 13–11):**
- gameWinRatio = 0.333, pointDominance = 0.158, avgWonDominance = 0.349
- Composite = `0.4×0.333 + 0.4×0.158 + 0.2×0.349 = 0.264`
- movMultiplier = `1.092`

**Example — Badminton 2–0 (11–3, 11–5):**
- Composite ≈ `0.714`
- movMultiplier = `1.25`

---

## 9. Factor 6 — Team Size Multiplier

Each player uses **their own team's actual player count**:

| Players on my team | Multiplier |
|---|---|
| 1 (Singles) | ×1.0 |
| 2 (Doubles) | ×0.9 |
| 3+ (Team) | ×0.82 |

In a 2v3 match: team of 2 gets ×0.9; team of 3 gets ×0.82.

---

## 10. Factor 7 — Rating Gap Dampener

Applied to each player based on their personal gap to the opposing team average:

| Gap | Multiplier |
|---|---|
| < 150 | ×1.00 |
| 150–299 | ×0.95 |
| 300–499 | ×0.85 |
| 500+ | ×0.75 |

---

## 11. Rating History

Every rating event (match result or drift) writes a `RatingHistory` row:

| Field | Description |
|---|---|
| `userId` | The player |
| `sportId` | The sport |
| `formatName` | The format track (`"overall"`, `"Singles"`, etc.) |
| `oldRating` | Rating before the event |
| `newRating` | Rating after the event |
| `delta` | `newRating − oldRating` (signed) |
| `activityId` | Linked `Activity` record — `NULL` for drift entries |
| `createdAt` | Timestamp |

Powers rating trend charts and match analytics. Drift entries are identifiable by `activityId = null`.

---

## 12. Anti-Manipulation Measures

### 12.1 Daily Rating Gain Cap

Maximum **+80 rating points per sport per format per 24-hour window**. Excess gain is silently absorbed. Losses are never capped.

*Implementation*: queries `RatingHistory` for positive deltas in the last 24h for the player's `sportId + formatName` before writing a new rating.

*Protects against*: collusion, match fixing, arranged win streaks.

### 12.2 Smurf Account Dampener

Triggered when all three are simultaneously true:
- `matchesPlayed < 10`
- Win rate > 80% (tracked via `winsCount`)
- Average MOV across wins > 0.7 (tracked via `totalMOVSum / winsCount`)

MOV bonus coefficient is halved silently:

```
movMultiplier = 1.0 + 0.175 × normalisedMargin   (instead of ×0.35)
```

No flag shown to the player. Requires `winsCount` and `totalMOVSum` fields on `SportSkillRating`.

*Protects against*: experienced players creating new accounts to farm lower-rated players.

### 12.3 Natural Selectivity Penalty (built-in)

Against much weaker opponents `expected ≈ 1.0`, so `result − expected ≈ 0`. Playing only weak opponents gains almost nothing. The gap dampener further reduces K for large mismatches. No extra code required.

---

## 13. Passive Rating Drift

All ratings are pulled **0.5% toward 1000 per month**, applied to everyone equally:

```
newRating = round(oldRating + (1000 − oldRating) × 0.005)
```

| Time (starting at 1500) | Rating |
|---|---|
| Now | 1500 |
| 1 month | 1497 |
| 6 months | 1485 |
| 1 year | 1470 |
| 3 years | 1422 |

**Not a penalty for inactivity.** Applies to all players equally. The confidence label is unaffected — a Master who stops playing keeps their Master label.

*Implementation*: `workers/ratingDriftWorker.ts` — monthly schedule, batch size 500, writes `RatingHistory` with `activityId = null`.

---

## 14. City-Level Ranking *(Planned)*

Each player's rank within their city, using the same rating number filtered by `locationCity`. No separate calculation required.

---

## 15. Data Model

### `sport_skill_ratings`

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `INT` PK | auto | |
| `userId` | `INT` FK → `users` | — | |
| `sportId` | `INT` FK → `sports` | — | |
| `formatName` | `VARCHAR(100)` | `"overall"` | Format track |
| `rating` | `INT` | `1000` | Current Elo rating |
| `matchesPlayed` | `INT` | `0` | Rated matches in this sport+format |
| `winsCount` | `INT` | `0` | Wins — used by smurf dampener |
| `totalMOVSum` | `DOUBLE` | `0` | Sum of normalised margins across wins |
| `confidence` | `VARCHAR(12)` | `"unranked"` | Tier label derived from `matchesPlayed` |
| `lastUpdated` | `DATETIME` | `now()` | Auto-updated |

**Unique key**: `(userId, sportId, formatName)`
**Index**: `(sportId, formatName, rating)` — leaderboards and peer-matching

### `rating_history`

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `INT` PK | auto | |
| `userId` | `INT` FK → `users` | — | |
| `sportId` | `INT` FK → `sports` | — | |
| `formatName` | `VARCHAR(100)` | `"overall"` | Format at time of event |
| `oldRating` | `INT` | — | |
| `newRating` | `INT` | — | |
| `delta` | `INT` | — | Signed change |
| `activityId` | `INT` FK | `NULL` | `NULL` = drift entry |
| `createdAt` | `DATETIME` | `now()` | |

**Index**: `(userId, sportId, formatName, createdAt)` — per-player trend charts

---

## 16. Worked Example

**Match**: Badminton Doubles, Competitive — Team A wins 2–1 (11–2, 9–11, 13–11)

| Player | Team | Rating | Matches | Confidence | confMult |
|---|---|---|---|---|---|
| A1 | A | 1000 | 3 | `unranked` | ×1.15 |
| A2 | A | 950 | 1 | `unranked` | ×1.15 |
| B1 | B | 1200 | 25 | `beginner` | ×1.05 |
| B2 | B | 1100 | 8 | `unranked` | ×1.15 |

**avgA = 975 · avgB = 1150**

**MOV composite** (11–2, 9–11, 13–11): composite = 0.264 → movMultiplier = **1.092**

### A1 — winner

| Factor | Value |
|---|---|
| Expected vs 1150 | 0.297 |
| baseK (3 matches) | 30 |
| confidenceMultiplier | ×1.15 (`unranked`) |
| movMultiplier | ×1.092 |
| teamSizeMultiplier | ×0.9 (Doubles) |
| ratingGapDampener | ×0.95 (gap 150) |
| effectiveK | 30 × 1.15 × 1.092 × 0.9 × 0.95 ≈ **32.1** |
| delta | 32.1 × (1 − 0.297) ≈ **+22.6 → +23** |
| **New rating** | **1023** |

### B1 — loser

| Factor | Value |
|---|---|
| Expected vs 975 | 0.785 |
| baseK (25 matches) | 20 |
| confidenceMultiplier | ×1.05 (`beginner`) |
| movMultiplier | ×1.0 (loser) |
| teamSizeMultiplier | ×0.9 (Doubles) |
| ratingGapDampener | ×0.95 (gap 225) |
| effectiveK | 20 × 1.05 × 1.0 × 0.9 × 0.95 ≈ **18.0** |
| delta | 18.0 × (0 − 0.785) ≈ **−14.1 → −14** |
| **New rating** | **1186** |

---

## 17. Confidence Tier Reference

| Label | matchesPlayed | Multiplier | Colour |
|---|---|---|---|
| `unranked` | 0–19 | ×1.15 | Slate `#64748B` |
| `beginner` | 20–39 | ×1.05 | Orange `#F97316` |
| `developing` | 40–59 | ×0.95 | Amber `#F59E0B` |
| `established` | 60–79 | ×0.85 | Blue `#3B82F6` |
| `advanced` | 80–99 | ×0.75 | Green `#22C55E` |
| `expert` | 100–119 | ×0.65 | Indigo `#6366F1` |
| `master` | 120+ | ×0.55 | Purple `#A855F7` |

---

## 18. FAQ

**Why did my rating barely change even though I won?**
You were heavily favoured. The system expected it, so the reward is small. Beating a stronger opponent moves your rating significantly.

**Why did I lose a lot of rating from one loss?**
You were heavily favoured and lost to a weaker opponent. Expected score was close to 1.0, so the loss produces a large negative delta.

**Why does winning 2–0 give more rating than 2–1?**
The composite MOV considers individual point scores — a dominant 2–0 sweep produces a much higher normalised margin than a scraped 2–1.

**Does not playing affect my rating?**
A 0.5%/month pull toward 1000 applies to everyone equally. A 1500-rated player drifts to ~1470 after one year. Confidence tier is never affected.

**Why is my Doubles rating different from my Singles rating?**
They are tracked independently. Format-specific tracks are created on your first competitive match in that format.

**Can I farm rating by playing weaker opponents?**
Nearly pointless. Expected score is already ~0.95, so gains are near zero. The gap dampener cuts K further for large mismatches.

**What happens if match scores are not recorded?**
MOV defaults to 1.0. The win/loss result processes normally. Rating updates never fail due to missing score data.

**Which match types update ratings?**
Only `COMPETITIVE` and `TOURNAMENT`. Open-play, friendly, and casual matches do not affect ratings.

**Does a draw affect both teams equally?**
Both get `result = 0.5` and `movMultiplier = 1.0`. Expected scores still differ, so a higher-rated team in a draw typically loses small points; the lower-rated team gains slightly.

**Why do I see all sports on my profile even though I've never played them?**
Sportza creates a default rating (1000, `unranked`) for every active sport at signup. This ensures a complete profile from day one and enables matchmaking suggestions across all sports immediately.
