export type StandingRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  placement?: "champion" | "runner_up";
};

/**
 * Recursively flatten any scoring-engine state to a simple { a, b } pair.
 */
export function flatEngineScore(raw: unknown): { a: number; b: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, any>;
  if (typeof s.A === "number" && typeof s.B === "number") {
    if (s.A === 0 && s.B === 0) return null; // suppress initial-state zeros
    return { a: s.A, b: s.B };
  }
  if (s.scores) return flatEngineScore(s.scores);
  if (s.gamesWon) return flatEngineScore(s.gamesWon);
  if (s.setsWon) return flatEngineScore(s.setsWon);
  if (typeof s.team1 === "number" && typeof s.team2 === "number") {
    if (s.team1 === 0 && s.team2 === 0) return null;
    return { a: s.team1, b: s.team2 };
  }
  if (typeof s.teamA === "number" && typeof s.teamB === "number") {
    if (s.teamA === 0 && s.teamB === 0) return null;
    return { a: s.teamA, b: s.teamB };
  }
  return null;
}

/** Sum of points across completed games/sets, or flat score fallback. */
export function extractAccumulatedPoints(raw: unknown): { a: number; b: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, any>;

  const games = s.completedGames ?? s.completedSets;
  if (Array.isArray(games) && games.length > 0) {
    let a = 0;
    let b = 0;
    for (const g of games) {
      if (typeof g.A === "number") a += g.A;
      if (typeof g.B === "number") b += g.B;
    }
    return { a, b };
  }

  if (s.scores) return extractAccumulatedPoints(s.scores);
  return flatEngineScore(raw);
}

export function computeStandings(
  matches: Array<Record<string, any>>,
  teams: Array<Record<string, any>>
): StandingRow[] {
  /** Map snapshot / alias names → current Tournament.teams[].name */
  const aliasToCanonical = new Map<string, string>();
  for (const t of teams) {
    const name = (t?.name as string) || "";
    if (!name) continue;
    aliasToCanonical.set(name, name);
    const aliases = Array.isArray(t.aliases) ? t.aliases : [];
    for (const a of aliases) {
      if (typeof a === "string" && a) aliasToCanonical.set(a, name);
    }
  }
  const resolveName = (raw: string): string => aliasToCanonical.get(raw) ?? raw;

  const standings: Record<
    string,
    { played: number; won: number; drawn: number; lost: number; points: number; pointsFor: number; pointsAgainst: number }
  > = {};

  for (const t of teams) {
    const name = (t?.name as string) || "";
    if (!name) continue;
    standings[name] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0, pointsFor: 0, pointsAgainst: 0 };
  }

  for (const m of matches) {
    if (m.status !== "completed") continue;

    const teamsData = (m.teams as Record<string, any>) ?? {};
    const t1Raw =
      teamsData.A?.name ??
      (typeof teamsData.A === "string" ? teamsData.A : null) ??
      teamsData.team1?.name ??
      (typeof teamsData.team1 === "string" ? teamsData.team1 : null) ??
      "";
    const t2Raw =
      teamsData.B?.name ??
      (typeof teamsData.B === "string" ? teamsData.B : null) ??
      teamsData.team2?.name ??
      (typeof teamsData.team2 === "string" ? teamsData.team2 : null) ??
      "";

    if (!t1Raw || !t2Raw) continue;
    const t1 = resolveName(t1Raw);
    const t2 = resolveName(t2Raw);

    if (!standings[t1]) standings[t1] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0, pointsFor: 0, pointsAgainst: 0 };
    if (!standings[t2]) standings[t2] = { played: 0, won: 0, drawn: 0, lost: 0, points: 0, pointsFor: 0, pointsAgainst: 0 };

    standings[t1].played++;
    standings[t2].played++;

    const accum = extractAccumulatedPoints(m.scores);
    if (accum) {
      standings[t1].pointsFor += accum.a;
      standings[t1].pointsAgainst += accum.b;
      standings[t2].pointsFor += accum.b;
      standings[t2].pointsAgainst += accum.a;
    }

    const winner = m.winnerTeam as string | undefined;
    if (winner === "A") {
      standings[t1].won++;
      standings[t2].lost++;
      standings[t1].points += 3;
    } else if (winner === "B") {
      standings[t2].won++;
      standings[t1].lost++;
      standings[t2].points += 3;
    } else {
      const flat = flatEngineScore(m.scores);
      const scoreA = flat?.a ?? 0;
      const scoreB = flat?.b ?? 0;
      if (scoreA > scoreB) {
        standings[t1].won++;
        standings[t2].lost++;
        standings[t1].points += 3;
      } else if (scoreB > scoreA) {
        standings[t2].won++;
        standings[t1].lost++;
        standings[t2].points += 3;
      } else {
        standings[t1].drawn++;
        standings[t2].drawn++;
        standings[t1].points += 1;
        standings[t2].points += 1;
      }
    }
  }

  return Object.entries(standings)
    .map(([team, s]) => ({
      team,
      ...s,
      pointDiff: s.pointsFor - s.pointsAgainst,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.pointDiff - a.pointDiff ||
        b.won - b.lost - (a.won - a.lost)
    );
}

export type TournamentStandingsInput = {
  teams: Array<Record<string, any>>;
  stages: Array<Record<string, any>>;
  matches: Array<Record<string, any>>;
  fixtures: Array<Record<string, any>>;
};

/** Standings with multi-stage champion/runner-up pinning (same logic as GET /standings). */
export function computeTournamentStandings(input: TournamentStandingsInput): StandingRow[] {
  const teams = input.teams ?? [];
  const stages = input.stages ?? [];
  const matches = input.matches ?? [];
  const fixtures = input.fixtures ?? [];

  const aliasToCanonical = new Map<string, string>();
  for (const t of teams) {
    const name = (t?.name as string) || "";
    if (!name) continue;
    aliasToCanonical.set(name, name);
    const aliases = Array.isArray(t.aliases) ? t.aliases : [];
    for (const a of aliases) {
      if (typeof a === "string" && a) aliasToCanonical.set(a, name);
    }
  }
  const resolveName = (raw: string): string => aliasToCanonical.get(raw) ?? raw;

  if (stages.length >= 2) {
    const lastStageNum = stages.length;
    const finalFixtures = fixtures.filter((f) => f.stage === lastStageNum);
    let champion: string | null = null;
    let runnerUp: string | null = null;

    for (const f of finalFixtures) {
      if (!f.matchId) continue;
      const m = matches.find((match) => match.id === f.matchId);
      if (m?.winnerTeam) {
        const t1 = (f.team1Ref as any)?.name as string | undefined;
        const t2 = (f.team2Ref as any)?.name as string | undefined;
        if (t1 && t2) {
          champion = resolveName(m.winnerTeam === "A" ? t1 : t2);
          runnerUp = resolveName(m.winnerTeam === "A" ? t2 : t1);
        }
        break;
      }
    }

    if (champion && runnerUp) {
      const finalMatchIds = new Set(finalFixtures.map((f) => f.matchId).filter(Boolean));
      const groupMatches = matches.filter((m) => !finalMatchIds.has(m.id));
      const groupStandings = computeStandings(groupMatches, teams);
      const rest = groupStandings.filter((s) => s.team !== champion && s.team !== runnerUp);

      const makeRow = (base: StandingRow | undefined, team: string, placement: "champion" | "runner_up"): StandingRow => ({
        ...(base ?? {
          team,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          points: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointDiff: 0,
        }),
        team,
        placement,
      });

      const champRow = groupStandings.find((s) => s.team === champion);
      const runnerRow = groupStandings.find((s) => s.team === runnerUp);

      return [makeRow(champRow, champion, "champion"), makeRow(runnerRow, runnerUp, "runner_up"), ...rest];
    }
  }

  return computeStandings(matches, teams);
}
