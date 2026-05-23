# Multi-Stage Tournaments — Different Formats per Round

**Version:** 1.1  
**Last updated:** Mar 2026

Tournaments can have **different formats for different stages**. For example:

- **Stage 1 — Group stage:** Round robin within groups (e.g. 4 groups of 4 teams; each team plays every other in its group).
- **Stage 2 — Knockout:** Top N from each group advance to a knockout bracket (e.g. quarter-finals → semi-finals).
- **Stage 3 — Finals:** Best-of-three (or best-of-N) for the final match.

The **format** can therefore vary by **stage**, not just a single format for the whole tournament.

---

## 1. Concepts

| Concept | Description |
|--------|--------------|
| **Stage** | A distinct phase of the tournament with its own **format** and (optionally) **groups**, **advance count**, or **bestOf**. |
| **Format per stage** | Each stage has a format: `round_robin` (within groups or overall), `knockout`, `league`, `group_knockout`, etc. |
| **Group stage** | Teams are split into groups; round robin is played **within each group**. Standings determine who advances. |
| **Knockout stage** | Single elimination; winners advance. Often fed by group winners. |
| **Best-of-N finals** | The final (or a specific round) is played as best of 3 (or N) matches; first to win ⌈N/2⌉ wins the round. |

---

## 2. Example: Group Stage → Knockout → Best-of-Three Final

| Stage | Name | Format | Notes |
|-------|------|--------|-------|
| 1 | Group stage | Round robin (within groups) | e.g. 16 teams → 4 groups of 4; each group plays round robin. Top 2 per group advance (8 teams). |
| 2 | Knockout | Knockout | 8 teams → QF (4 matches) → SF (2) → Final (1). |
| 3 | Final | Knockout with **bestOf: 3** | The final fixture is played as best of 3 matches; first to 2 wins. |

---

## 3. Data model (stages)

The **Tournament** model supports an optional **stages** array. When present, it defines the format (and options) for each stage. The top-level **format** remains for **single-format** tournaments (backward compatible).

### Stage definition (per stage)

| Field | Type | Description |
|-------|------|-------------|
| **stageOrder** | number | 1-based order of the stage (1 = first stage). |
| **name** | string | Display name (e.g. "Group stage", "Knockout", "Final"). |
| **format** | string | `round_robin`, `knockout`, `league`, `group_knockout`, `other`. |
| **groupCount** | number (optional) | For group stages: number of groups (e.g. 4). Teams are split into this many groups; round robin within each. |
| **advancePerGroup** | number (optional) | How many teams advance from each group (e.g. 2 → top 2 per group). |
| **bestOf** | number (optional) | For a specific stage (e.g. final): play best-of-N (e.g. 3 = first to 2 wins). |

### TournamentFixture and stage

Each **TournamentFixture** can have a **stage** (number) indicating which tournament stage it belongs to. Fixtures are generated **per stage** (e.g. generate stage 1 only; when stage 1 is complete, generate stage 2 from group winners, etc.).

---

## 4. Fixture generation (multi-stage)

1. **Stage 1 (e.g. group round robin):**  
   Split teams into `groupCount` groups. Generate round-robin fixtures **within each group**. No cross-group matches in stage 1.

2. **When stage 1 is complete:**  
   Compute standings per group; take top `advancePerGroup` from each group. These form the "teams" (or slots) for stage 2.

3. **Stage 2 (e.g. knockout):**  
   Generate knockout bracket from the advanced teams (e.g. 8 teams → QF, SF, Final). Fixtures use `team1Type: 'team'` / `team2Type: 'team'` with refs to **advanced slot indices** (or winner refs for later rounds).

4. **Stage 3 (e.g. best-of-three final):**  
   The final fixture may be marked **bestOf: 3**. The system can create **one fixture** with a flag, and the match scoring UI allows "Match 1", "Match 2", "Match 3" with the first to 2 winning the stage.

---

## 5. API (create / update)

- **POST /api/tournaments** — Body may include **stages**:  
  `stages: [{ stageOrder: 1, name: "Group stage", format: "round_robin", groupCount: 4, advancePerGroup: 2 }, { stageOrder: 2, name: "Knockout", format: "knockout" }, { stageOrder: 3, name: "Final", format: "knockout", bestOf: 3 }]`.

- **PUT /api/tournaments/:id** — Can update **stages** (e.g. when in draft).

- **POST /api/tournaments/:id/generate-fixtures** — When **stages** are defined, can generate **stage 1 only** (group round robin). A separate endpoint or same with `?stage=1` could generate stage 1; later, **POST generate-fixtures?stage=2** (or similar) generates knockout from group results. *(Exact API can be refined.)*

- **GET /api/tournaments/:id/fixtures** — Query param **stage** (optional): return only fixtures for that stage.

---

## 6. Summary

| Requirement | Support |
|-------------|---------|
| Different format per round/stage | **stages[]** with format per stage. |
| Group stage (round robin within groups) | **groupCount**, **advancePerGroup**; fixture gen splits teams into groups and generates round robin per group. |
| Knockout after groups | Stage 2 format **knockout**; input = advanced teams from stage 1. |
| Best-of-three (or N) finals | **bestOf** on the final stage; one fixture, match scoring tracks games until one side wins ⌈bestOf/2⌉. |

---

## 7. Implementation status

| Feature | Status | Notes |
|--------|--------|-------|
| **Stages schema** | Done | Tournament.stages[], TournamentFixture.stage, TournamentFixture.groupIndex |
| **Create/update stages via API** | Done | POST/PUT /api/tournaments accept `stages` |
| **GET fixtures by stage** | Done | GET /api/tournaments/:id/fixtures?stage=1 |
| **Create flow UI (multi-stage)** | Done | Checkbox + add/remove stages, name, format, groupCount, advancePerGroup, bestOf |
| **Stage 1: single format (knockout or round robin)** | Done | Uses first stage’s format when stages exist; sets fixture.stage = 1 |
| **Stage 1: group round robin** | Done | When stage 1 has groupCount, teams are split into groups; round-robin within each group; fixtures have stage + groupIndex |
| **Stage 2+ generation (knockout from group results)** | Planned | Requires group standings and “generate stage 2” (or POST generate-fixtures?stage=2); not yet implemented |
| **bestOf (e.g. best-of-3 final)** | Metadata only | Stored on stage; match UI can use it to show “Match 1 / 2 / 3”; no extra fixture slots created |

The current implementation supports **single-format** tournaments and **multi-stage** with **stage 1** as either full knockout, full round robin, or **group round robin** (when groupCount is set). Stage 2+ and knockout-from-advances are planned.

---

## 8. Backend services (Turborepo monorepo)

**Location:** `apps/api/src/services/tournamentFixtures.ts`

| Function | Purpose |
|----------|---------|
| **generateRoundRobin()** | League/round-robin format: generates fixtures so each team plays every other team once. Uses fixed-team algorithm. |
| **generateKnockout()** | Knockout format: builds power-of-2 bracket (e.g. 8 teams → 4 QF, 2 SF, 1 Final). First round pairs teams; later rounds reference winner slots. |
| **calculateStandings()** | League standings: W=3, D=1, L=0. Aggregates from completed matches; sorts by points then wins. |

---

## 9. Frontend (apps/web)

| Screen | Route | Purpose |
|--------|-------|---------|
| **TournamentList** | `/tournaments` | List tournaments with status filter (draft, registration, in progress, completed, cancelled). |
| **TournamentDetail** | `/tournaments/:id` | Tabbed view: **Fixtures** (matches by round), **Standings** (points table), **Teams** (participants). |
| **CreateTournament** | `/tournaments/create` | Create tournament with format, stages, teams, and generate fixtures. |
