/**
 * Knockout bracket progression: fill winner/loser slots from completed fixtures.
 * Never deletes fixtures or Match rows — only patches downstream team refs.
 */

import prisma from "./prisma";

type TeamSide = "A" | "B";

type FixtureRef = Record<string, unknown> | null | undefined;

export type TournamentFixtureRow = {
  id: number;
  tournamentId: number;
  stage: number | null;
  round: number;
  matchOrder: number;
  team1Type: string;
  team1Ref: unknown;
  team2Type: string;
  team2Ref: unknown;
  matchId: number | null;
  status: string;
};

function asRef(ref: unknown): FixtureRef {
  if (!ref || typeof ref !== "object") return null;
  return ref as Record<string, unknown>;
}

/** True if this ref is a pointer to a prior fixture (winner/loser slot). */
export function isPointerRef(ref: unknown): boolean {
  const r = asRef(ref);
  if (!r) return true;
  if (r.bye === true) return false;
  if (typeof r.round === "number" && r.name == null) return true;
  return false;
}

function teamPayloadFromRef(ref: unknown, matchTeams: unknown, side: TeamSide): Record<string, unknown> | null {
  const r = asRef(ref);
  if (r?.name && typeof r.name === "string" && !isPointerRef(r)) {
    const out: Record<string, unknown> = { name: r.name };
    if (Array.isArray(r.playerNames)) out.playerNames = r.playerNames;
    if (r.court != null) out.court = r.court;
    if (r.matchId != null && typeof r.matchId === "string") out.matchId = r.matchId;
    if (Array.isArray(r.players)) out.players = r.players;
    return out;
  }

  const teams = matchTeams && typeof matchTeams === "object" ? (matchTeams as Record<string, any>) : null;
  const sideObj = teams?.[side];
  if (sideObj && typeof sideObj === "object" && sideObj.name) {
    const out: Record<string, unknown> = { name: String(sideObj.name) };
    if (Array.isArray(sideObj.playerNames)) out.playerNames = sideObj.playerNames;
    if (Array.isArray(sideObj.players)) out.players = sideObj.players;
    return out;
  }
  return null;
}

function pointerMatches(
  ref: unknown,
  source: { stage: number | null; round: number; matchOrder: number },
  sideType?: string
): boolean {
  const r = asRef(ref);
  if (!r) return false;

  // Filled slot that remembers where it came from (allows score corrections)
  const from = r.source && typeof r.source === "object" ? (r.source as Record<string, unknown>) : null;
  if (from && typeof from.round === "number" && typeof from.match === "number") {
    if (from.stage != null && source.stage != null && from.stage !== source.stage) return false;
    return from.round === source.round && from.match === source.matchOrder;
  }

  if (sideType !== "winner" && sideType !== "loser") return false;
  if (typeof r.round !== "number") return false;
  const refMatch = typeof r.match === "number" ? r.match : null;
  if (refMatch == null) return false;
  if (typeof r.stage === "number" && source.stage != null && r.stage !== source.stage) return false;
  return r.round === source.round && refMatch === source.matchOrder;
}

function mergeDisplayMeta(
  existing: unknown,
  team: Record<string, unknown>,
  source: { stage: number | null; round: number; matchOrder: number }
): Record<string, unknown> {
  const prev = asRef(existing) ?? {};
  const out: Record<string, unknown> = { ...team };
  if (prev.court != null && out.court == null) out.court = prev.court;
  if (prev.matchId != null && typeof prev.matchId === "string" && out.matchId == null) {
    out.matchId = prev.matchId;
  }
  out.source = {
    stage: source.stage,
    round: source.round,
    match: source.matchOrder,
  };
  return out;
}

/**
 * Propagate one completed fixture's result into any later winner/loser slots.
 * Skips sides on downstream fixtures that already have a started match (score retention).
 */
export async function propagateMatchResult(
  fixture: TournamentFixtureRow,
  winnerTeam: TeamSide,
  matchTeams?: unknown
): Promise<number> {
  const winnerPayload = teamPayloadFromRef(
    winnerTeam === "A" ? fixture.team1Ref : fixture.team2Ref,
    matchTeams,
    winnerTeam
  );
  const loserSide: TeamSide = winnerTeam === "A" ? "B" : "A";
  const loserPayload = teamPayloadFromRef(
    loserSide === "A" ? fixture.team1Ref : fixture.team2Ref,
    matchTeams,
    loserSide
  );

  if (!winnerPayload && !loserPayload) return 0;

  const source = {
    stage: fixture.stage,
    round: fixture.round,
    matchOrder: fixture.matchOrder,
  };

  const candidates = await prisma.tournamentFixture.findMany({
    where: { tournamentId: fixture.tournamentId },
  });

  let updates = 0;

  for (const dest of candidates) {
    if (dest.id === fixture.id) continue;
    // Never rewrite a fixture that already has a live/completed match linked
    const destLocked = dest.matchId != null;

    let nextTeam1Ref: object = dest.team1Ref as object;
    let nextTeam2Ref: object = dest.team2Ref as object;
    let nextTeam1Type = dest.team1Type;
    let nextTeam2Type = dest.team2Type;
    let changed = false;

    if (pointerMatches(dest.team1Ref, source, dest.team1Type)) {
      const payload = dest.team1Type === "loser" ? loserPayload : (
        dest.team1Type === "winner" ? winnerPayload : (
          asRef(dest.team1Ref)?.slotKind === "loser" ? loserPayload : winnerPayload
        )
      );
      if (payload && !destLocked) {
        const merged = mergeDisplayMeta(dest.team1Ref, payload, source);
        if (dest.team1Type === "loser") merged.slotKind = "loser";
        else if (dest.team1Type === "winner") merged.slotKind = "winner";
        else if (asRef(dest.team1Ref)?.slotKind) merged.slotKind = asRef(dest.team1Ref)!.slotKind;
        nextTeam1Ref = merged as object;
        nextTeam1Type = "team";
        changed = true;
      }
    }

    if (pointerMatches(dest.team2Ref, source, dest.team2Type)) {
      const payload = dest.team2Type === "loser" ? loserPayload : (
        dest.team2Type === "winner" ? winnerPayload : (
          asRef(dest.team2Ref)?.slotKind === "loser" ? loserPayload : winnerPayload
        )
      );
      if (payload && !destLocked) {
        const merged = mergeDisplayMeta(dest.team2Ref, payload, source);
        if (dest.team2Type === "loser") merged.slotKind = "loser";
        else if (dest.team2Type === "winner") merged.slotKind = "winner";
        else if (asRef(dest.team2Ref)?.slotKind) merged.slotKind = asRef(dest.team2Ref)!.slotKind;
        nextTeam2Ref = merged as object;
        nextTeam2Type = "team";
        changed = true;
      }
    }

    if (!changed) continue;

    await prisma.tournamentFixture.update({
      where: { id: dest.id },
      data: {
        team1Type: nextTeam1Type,
        team1Ref: nextTeam1Ref,
        team2Type: nextTeam2Type,
        team2Ref: nextTeam2Ref,
      },
    });
    updates += 1;
  }

  return updates;
}

function resolveWinnerTeam(
  winnerTeam: string | null | undefined,
  scores: unknown
): TeamSide | null {
  if (winnerTeam === "A" || winnerTeam === "B") return winnerTeam;
  if (!scores || typeof scores !== "object") return null;
  const s = scores as Record<string, any>;
  // Common shapes: { teamA, teamB } or { A, B } or completedGames
  if (typeof s.teamA === "number" && typeof s.teamB === "number") {
    if (s.teamA > s.teamB) return "A";
    if (s.teamB > s.teamA) return "B";
  }
  if (typeof s.A === "number" && typeof s.B === "number") {
    if (s.A > s.B) return "A";
    if (s.B > s.A) return "B";
  }
  const games = s.completedGames ?? s.completedSets;
  if (Array.isArray(games) && games.length > 0) {
    let aWins = 0;
    let bWins = 0;
    for (const g of games) {
      const a = g?.A ?? g?.a ?? 0;
      const b = g?.B ?? g?.b ?? 0;
      if (a > b) aWins++;
      else if (b > a) bWins++;
    }
    if (aWins > bWins) return "A";
    if (bWins > aWins) return "B";
  }
  return null;
}

/**
 * Walk all completed knockout fixtures (ordered) and propagate into later rounds.
 * Idempotent; safe to call on every match complete and for backfill.
 */
export async function syncKnockoutBracket(tournamentId: number): Promise<{ propagated: number }> {
  const fixtures = await prisma.tournamentFixture.findMany({
    where: {
      tournamentId,
      status: "completed",
      matchId: { not: null },
    },
    include: { match: { select: { winnerTeam: true, teams: true, scores: true, status: true } } },
    orderBy: [{ stage: "asc" }, { round: "asc" }, { matchOrder: "asc" }],
  });

  let propagated = 0;

  for (const f of fixtures) {
    const match = f.match;
    if (!match || match.status !== "completed") continue;
    const winner = resolveWinnerTeam(match.winnerTeam, match.scores);
    if (!winner) continue;

    const n = await propagateMatchResult(
      {
        id: f.id,
        tournamentId: f.tournamentId,
        stage: f.stage,
        round: f.round,
        matchOrder: f.matchOrder,
        team1Type: f.team1Type,
        team1Ref: f.team1Ref,
        team2Type: f.team2Type,
        team2Ref: f.team2Ref,
        matchId: f.matchId,
        status: f.status,
      },
      winner,
      match.teams
    );
    propagated += n;
  }

  return { propagated };
}

/** After a specific match completes, sync its fixture then full bracket (for backfill). */
export async function syncBracketAfterMatch(matchId: number): Promise<void> {
  const fixture = await prisma.tournamentFixture.findFirst({
    where: { matchId },
  });
  if (!fixture?.tournamentId) return;

  // Fix global matchOrder / mis-slotted R16 before propagating winners
  const { repairKnockoutBracketSlots } = await import("./tournament-bracket-repair");
  await repairKnockoutBracketSlots(fixture.tournamentId);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { winnerTeam: true, teams: true, scores: true, status: true, tournamentId: true },
  });
  if (!match || match.status !== "completed") return;

  const winner = resolveWinnerTeam(match.winnerTeam, match.scores);
  if (winner) {
    await propagateMatchResult(
      {
        id: fixture.id,
        tournamentId: fixture.tournamentId,
        stage: fixture.stage,
        round: fixture.round,
        matchOrder: fixture.matchOrder,
        team1Type: fixture.team1Type,
        team1Ref: fixture.team1Ref,
        team2Type: fixture.team2Type,
        team2Ref: fixture.team2Ref,
        matchId: fixture.matchId,
        status: fixture.status,
      },
      winner,
      match.teams
    );
  }

  // Full ordered sync fills any earlier completed R16 → QF gaps
  // Re-read fixture in case matchOrder was remapped
  const refreshed = await prisma.tournamentFixture.findFirst({ where: { matchId } });
  if (refreshed) {
    await syncKnockoutBracket(refreshed.tournamentId);
  } else {
    await syncKnockoutBracket(fixture.tournamentId);
  }
}
