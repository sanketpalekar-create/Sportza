/**
 * Repair knockout bracket slot indices so winner/loser refs resolve correctly.
 *
 * Bugs this fixes:
 * 1. Global matchOrder across rounds (QF=9..12) while refs use within-round match numbers
 * 2. R16 fixtures filled in play/display order instead of official R16-1..8 slots
 *
 * Never deletes Match rows or scored fixtures — only remaps matchOrder and
 * resets unlocked later-round team refs, then caller should syncKnockoutBracket.
 */

import prisma from "./prisma";

type TeamPair = { a: string; b: string; matchId: string };

/** Official Picklethon August R16 slot → teams (as actually played where known). */
export const PICKLETHON_OFFICIAL_R16: Record<number, TeamPair> = {
  1: { matchId: "R16-1", a: "Hybrid Hitters", b: "Fingine" },
  2: { matchId: "R16-2", a: "Outer Team", b: "Team name" },
  // Played as Net Ninjas (SoT also mentions Alchemist); accept either as 4B/alt
  3: { matchId: "R16-3", a: "Amarmanil", b: "Net Ninjas" },
  4: { matchId: "R16-4", a: "Pickleball Paradise", b: "Tararara" },
  5: { matchId: "R16-5", a: "Valerian 1", b: "JS" },
  6: { matchId: "R16-6", a: "Acers", b: "The Jadu" },
  7: { matchId: "R16-7", a: "SA strikers", b: "Fighters" },
  8: { matchId: "R16-8", a: "Dropshots", b: "Josh" },
};

const R16_3_ALT: TeamPair = { matchId: "R16-3", a: "Amarmanil", b: "Alchemist" };

function norm(s: string | undefined | null): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/amarmanii/g, "amarmanil");
}

function teamsMatch(
  t1: string | undefined,
  t2: string | undefined,
  a: string,
  b: string
): boolean {
  const s = new Set([norm(t1), norm(t2)]);
  return s.has(norm(a)) && s.has(norm(b));
}

function refName(ref: unknown): string | undefined {
  if (!ref || typeof ref !== "object") return undefined;
  const n = (ref as any).name;
  return typeof n === "string" ? n : undefined;
}

function courtFor(matchId: string): string {
  if (matchId.startsWith("QF")) {
    const n = Number(matchId.replace("QF", ""));
    return ["Court 1", "Court 2", "Court 3", "Court 1"][n - 1] ?? "Court 1";
  }
  if (matchId === "SF1") return "Court 2";
  if (matchId === "SF2") return "Court 3";
  if (matchId === "FIN") return "Court 1";
  if (matchId === "3RD") return "Court 2";
  return "Court 1";
}

async function setMatchOrdersTempThenFinal(
  updates: Array<{ id: number; matchOrder: number }>
): Promise<void> {
  // Avoid unique collisions: move to high temp range first
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    await prisma.tournamentFixture.update({
      where: { id: u.id },
      data: { matchOrder: 10_000 + i },
    });
  }
  for (const u of updates) {
    await prisma.tournamentFixture.update({
      where: { id: u.id },
      data: { matchOrder: u.matchOrder },
    });
  }
}

function needsWithinRoundRenumber(
  byRound: Map<number, Array<{ id: number; matchOrder: number }>>
): boolean {
  for (const [, rows] of byRound) {
    const n = rows.length;
    if (rows.some((r) => r.matchOrder < 1 || r.matchOrder > n)) return true;
    const orders = new Set(rows.map((r) => r.matchOrder));
    if (orders.size !== n) return true;
  }
  return false;
}

/**
 * Remap R16 fixtures onto official slots by team pair (Picklethon).
 * Returns true if any matchOrder changed.
 */
async function remapPicklethonR16(
  tournamentId: number,
  stage: number
): Promise<boolean> {
  const r16 = await prisma.tournamentFixture.findMany({
    where: { tournamentId, stage, round: 1 },
  });
  if (r16.length < 8) return false;

  const assignments: Array<{ id: number; targetOrder: number; matchId: string }> = [];
  const used = new Set<number>();

  for (const [orderStr, pair] of Object.entries(PICKLETHON_OFFICIAL_R16)) {
    const targetOrder = Number(orderStr);
    const candidates = [pair];
    if (targetOrder === 3) candidates.push(R16_3_ALT);

    const fixture = r16.find((f) => {
      if (used.has(f.id)) return false;
      const t1 = refName(f.team1Ref);
      const t2 = refName(f.team2Ref);
      return candidates.some((c) => teamsMatch(t1, t2, c.a, c.b));
    });
    if (!fixture) continue;
    used.add(fixture.id);
    assignments.push({ id: fixture.id, targetOrder, matchId: pair.matchId });
  }

  if (assignments.length < 8) {
    console.warn(
      `[bracket-repair] Picklethon R16: only matched ${assignments.length}/8 official pairs — skipping R16 remap`
    );
    return false;
  }

  const alreadyOk = assignments.every((a) => {
    const f = r16.find((x) => x.id === a.id)!;
    return f.matchOrder === a.targetOrder;
  });
  if (alreadyOk) return false;

  await setMatchOrdersTempThenFinal(
    assignments.map((a) => ({ id: a.id, matchOrder: a.targetOrder }))
  );

  // Stamp matchId on refs for clarity (preserve names / scores)
  for (const a of assignments) {
    const f = await prisma.tournamentFixture.findUnique({ where: { id: a.id } });
    if (!f) continue;
    const t1 = { ...(asObj(f.team1Ref) ?? {}), matchId: a.matchId };
    const t2 = { ...(asObj(f.team2Ref) ?? {}), matchId: a.matchId };
    await prisma.tournamentFixture.update({
      where: { id: a.id },
      data: { team1Ref: t1 as object, team2Ref: t2 as object },
    });
  }

  return true;
}

function asObj(ref: unknown): Record<string, unknown> | null {
  if (!ref || typeof ref !== "object") return null;
  return { ...(ref as Record<string, unknown>) };
}

/** Compact each knockout round to matchOrder 1..n (sorted by current matchOrder). */
async function renumberWithinRounds(
  tournamentId: number,
  stage: number
): Promise<boolean> {
  const fixtures = await prisma.tournamentFixture.findMany({
    where: { tournamentId, stage },
    orderBy: [{ round: "asc" }, { matchOrder: "asc" }],
  });

  const byRound = new Map<number, typeof fixtures>();
  for (const f of fixtures) {
    (byRound.get(f.round) ?? byRound.set(f.round, []).get(f.round)!).push(f);
  }

  if (!needsWithinRoundRenumber(byRound)) return false;

  const updates: Array<{ id: number; matchOrder: number }> = [];
  for (const [, rows] of byRound) {
    rows
      .slice()
      .sort((a, b) => a.matchOrder - b.matchOrder)
      .forEach((f, i) => {
        updates.push({ id: f.id, matchOrder: i + 1 });
      });
  }

  await setMatchOrdersTempThenFinal(updates);
  return true;
}

/**
 * Reset unlocked QF/SF/Final/Bronze to official winner/loser pointers.
 * Creates missing Bronze when Final exists alone.
 */
async function resetUnlockedPointers(
  tournamentId: number,
  stage: number
): Promise<number> {
  const fixtures = await prisma.tournamentFixture.findMany({
    where: { tournamentId, stage },
    orderBy: [{ round: "asc" }, { matchOrder: "asc" }],
  });

  const byRound = new Map<number, typeof fixtures>();
  for (const f of fixtures) {
    (byRound.get(f.round) ?? byRound.set(f.round, []).get(f.round)!).push(f);
  }

  let updated = 0;
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const maxRound = rounds[rounds.length - 1] ?? 1;

  // Ensure bronze exists beside final when we have 2 SF + 1 final-only round-4
  const r4 = byRound.get(maxRound) ?? [];
  const r3 = byRound.get(maxRound - 1) ?? [];
  if (r3.length === 2 && r4.length === 1 && r4[0].matchId == null) {
    // Renumber final to matchOrder 2 and insert bronze as 1
    const finalFix = r4[0];
    await setMatchOrdersTempThenFinal([
      { id: finalFix.id, matchOrder: 2 },
    ]);
    await prisma.tournamentFixture.create({
      data: {
        tournamentId,
        stage,
        round: maxRound,
        matchOrder: 1,
        team1Type: "loser",
        team1Ref: {
          stage,
          round: maxRound - 1,
          match: 1,
          loserOf: "SF1",
          court: "Court 2",
          matchId: "3RD",
        },
        team2Type: "loser",
        team2Ref: {
          stage,
          round: maxRound - 1,
          match: 2,
          loserOf: "SF2",
          court: "Court 2",
          matchId: "3RD",
        },
        status: "upcoming",
      },
    });
    updated += 1;
  }

  const fresh = await prisma.tournamentFixture.findMany({
    where: { tournamentId, stage },
    orderBy: [{ round: "asc" }, { matchOrder: "asc" }],
  });
  const freshByRound = new Map<number, typeof fresh>();
  for (const f of fresh) {
    (freshByRound.get(f.round) ?? freshByRound.set(f.round, []).get(f.round)!).push(f);
  }

  for (const [round, rows] of freshByRound) {
    if (round <= 1) continue;
    for (const f of rows) {
      if (f.matchId != null) continue; // locked — keep played QF etc.

      const isBronze =
        round === maxRound &&
        rows.length > 1 &&
        f.matchOrder === 1 &&
        (f.team1Type === "loser" ||
          (asObj(f.team1Ref) as any)?.loserOf != null ||
          (asObj(f.team1Ref) as any)?.matchId === "3RD");

      const isFinal =
        round === maxRound &&
        (rows.length === 1 || f.matchOrder === Math.max(...rows.map((r) => r.matchOrder)));

      let team1Type = "winner";
      let team2Type = "winner";
      let matchLabel = `R${round}-M${f.matchOrder}`;
      let court = "Court 1";

      if (round === 2) {
        matchLabel = `QF${f.matchOrder}`;
        court = courtFor(matchLabel);
      } else if (round === maxRound - 1 || (maxRound >= 3 && round === 3 && maxRound === 4)) {
        matchLabel = `SF${f.matchOrder}`;
        court = courtFor(matchLabel);
      } else if (isBronze) {
        team1Type = "loser";
        team2Type = "loser";
        matchLabel = "3RD";
        court = "Court 2";
      } else if (isFinal) {
        matchLabel = "FIN";
        court = "Court 1";
      }

      const prevRound = round - 1;
      let m1: number;
      let m2: number;
      if (isBronze) {
        m1 = 1;
        m2 = 2;
      } else if (isFinal && rows.length >= 2) {
        // Final is usually matchOrder 2 when bronze is 1
        m1 = 1;
        m2 = 2;
      } else {
        // Standard: QF k ← R16 2k-1, 2k ; SF k ← QF 2k-1, 2k
        m1 = (f.matchOrder - 1) * 2 + 1;
        m2 = (f.matchOrder - 1) * 2 + 2;
      }

      // Final with only one fixture in round: winners of both semis
      if (isFinal && rows.length === 1) {
        m1 = 1;
        m2 = 2;
      }

      const team1Ref: Record<string, unknown> = {
        stage,
        round: prevRound,
        match: m1,
        court,
        matchId: matchLabel,
      };
      const team2Ref: Record<string, unknown> = {
        stage,
        round: prevRound,
        match: m2,
        court,
        matchId: matchLabel,
      };
      if (isBronze) {
        team1Ref.loserOf = "SF1";
        team2Ref.loserOf = "SF2";
      }

      await prisma.tournamentFixture.update({
        where: { id: f.id },
        data: {
          team1Type,
          team2Type,
          team1Ref: team1Ref as object,
          team2Ref: team2Ref as object,
          status: f.status === "completed" ? f.status : "upcoming",
        },
      });
      updated += 1;
    }
  }

  return updated;
}

export type RepairResult = {
  r16Remapped: boolean;
  renumbered: boolean;
  pointersReset: number;
};

/**
 * Full knockout slot repair for a tournament stage (default: detect KO stage).
 */
export async function repairKnockoutBracketSlots(
  tournamentId: number,
  opts?: { forcePicklethonR16?: boolean }
): Promise<RepairResult> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, stages: true },
  });
  if (!tournament) {
    return { r16Remapped: false, renumbered: false, pointersReset: 0 };
  }

  const stages = Array.isArray(tournament.stages) ? (tournament.stages as any[]) : [];
  let koStage = stages.findIndex((s) => s?.format === "knockout") + 1;
  if (koStage < 1) {
    // Fallback: stage with multi-round fixtures
    const any = await prisma.tournamentFixture.findFirst({
      where: { tournamentId, round: { gt: 1 } },
      select: { stage: true },
    });
    koStage = any?.stage ?? 2;
  }

  const isPicklethon = /picklethon/i.test(tournament.name ?? "");
  let r16Remapped = false;
  if (isPicklethon || opts?.forcePicklethonR16) {
    r16Remapped = await remapPicklethonR16(tournamentId, koStage);
  }

  // After R16 remap, renumber later rounds to within-round 1..n
  const renumbered = await renumberWithinRounds(tournamentId, koStage);
  const pointersReset = await resetUnlockedPointers(tournamentId, koStage);

  return { r16Remapped, renumbered, pointersReset };
}

/** True when later-round matchOrders look like a global counter (broken refs). */
export function knockoutMatchOrdersLookBroken(
  fixtures: Array<{ stage?: number | null; round: number; matchOrder: number }>
): boolean {
  const byKey = new Map<string, number[]>();
  for (const f of fixtures) {
    const key = `${f.stage ?? 0}:${f.round}`;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(f.matchOrder);
  }
  for (const [, orders] of byKey) {
    const n = orders.length;
    if (orders.some((o) => o > n)) return true;
  }
  return false;
}
