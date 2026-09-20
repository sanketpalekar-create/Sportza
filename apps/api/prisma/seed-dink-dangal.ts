/**
 * Dink Dangal — Completed historical pickleball doubles tournament
 *
 * League: 7 teams round-robin, rally point race to 15, best of 1 (21 matches)
 * Knockout: top 4 → SF (service race to 11 Bo1) → Final (service race to 11 Bo3)
 * Winner: Amar & Adnan
 *
 * Idempotent: wipe + rebuild fixtures/matches if tournament already exists.
 *
 * Run: pnpm --filter @sportza/api db:seed:dink-dangal
 */

import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const DEV_PASSWORD_HASH = bcrypt.hashSync("Sportza@123", 12);
export const DINK_DANGAL_NAME = "Dink Dangal";

const TEAMS: Array<{ name: string; players: [string, string] }> = [
  { name: "Amar & Adnan", players: ["Amarpreet", "Adnan"] },
  { name: "Binay & Karan", players: ["Binay", "Karan"] },
  { name: "Rohit & Aniket", players: ["Rohit", "Aniket"] },
  { name: "Rachit & Rajas", players: ["Rachit", "Rajas"] },
  { name: "Akshay & Dhruv", players: ["Akshay", "Dhruv"] },
  { name: "Atharva & Kunj", players: ["Atharva", "Kunj"] },
  { name: "Sanket & Rajat", players: ["Sanket", "Rajat"] },
];

/** League results: team1 = winner, team2 = loser. */
const LEAGUE_RESULTS: Array<{ winner: string; loser: string; scoreA: number; scoreB: number }> = [
  { winner: "Binay & Karan", loser: "Atharva & Kunj", scoreA: 15, scoreB: 14 },
  { winner: "Rohit & Aniket", loser: "Rachit & Rajas", scoreA: 15, scoreB: 10 },
  { winner: "Amar & Adnan", loser: "Akshay & Dhruv", scoreA: 15, scoreB: 7 },
  { winner: "Rohit & Aniket", loser: "Sanket & Rajat", scoreA: 15, scoreB: 10 },
  { winner: "Amar & Adnan", loser: "Binay & Karan", scoreA: 15, scoreB: 6 },
  { winner: "Atharva & Kunj", loser: "Sanket & Rajat", scoreA: 15, scoreB: 14 },
  { winner: "Rachit & Rajas", loser: "Akshay & Dhruv", scoreA: 15, scoreB: 10 },
  { winner: "Rohit & Aniket", loser: "Akshay & Dhruv", scoreA: 15, scoreB: 11 },
  { winner: "Amar & Adnan", loser: "Atharva & Kunj", scoreA: 15, scoreB: 6 },
  { winner: "Akshay & Dhruv", loser: "Sanket & Rajat", scoreA: 15, scoreB: 7 },
  { winner: "Binay & Karan", loser: "Rachit & Rajas", scoreA: 15, scoreB: 11 },
  { winner: "Binay & Karan", loser: "Rohit & Aniket", scoreA: 15, scoreB: 11 },
  { winner: "Amar & Adnan", loser: "Sanket & Rajat", scoreA: 15, scoreB: 11 },
  { winner: "Rachit & Rajas", loser: "Atharva & Kunj", scoreA: 15, scoreB: 14 },
  { winner: "Binay & Karan", loser: "Akshay & Dhruv", scoreA: 15, scoreB: 9 },
  { winner: "Amar & Adnan", loser: "Rachit & Rajas", scoreA: 15, scoreB: 9 },
  { winner: "Binay & Karan", loser: "Sanket & Rajat", scoreA: 15, scoreB: 5 },
  { winner: "Rohit & Aniket", loser: "Atharva & Kunj", scoreA: 15, scoreB: 14 },
  { winner: "Akshay & Dhruv", loser: "Atharva & Kunj", scoreA: 15, scoreB: 7 },
  { winner: "Rachit & Rajas", loser: "Sanket & Rajat", scoreA: 15, scoreB: 11 },
  { winner: "Amar & Adnan", loser: "Rohit & Aniket", scoreA: 15, scoreB: 10 },
];

const STAGES = [
  {
    stageOrder: 1,
    name: "League Stage",
    format: "round_robin",
    groupCount: 1,
    advancePerGroup: 4,
    bestOf: 1,
    scoringSystem: "rally",
    targetScore: 15,
    singleFormat: false,
    playersPerTeam: 2,
  },
  {
    stageOrder: 2,
    name: "Knockout",
    format: "knockout",
    groupCount: 1,
    advancePerGroup: 1,
    bestOf: 3,
    scoringSystem: "service",
    targetScore: 11,
    singleFormat: false,
    playersPerTeam: 2,
  },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function rallyBo1Scores(a: number, b: number) {
  return {
    config: {
      sport: "pickleball_rally",
      games: 1,
      pointsToWin: 15,
      winBy: 2,
      doubles: true,
      scoringSystem: "rally",
    },
    gamesWon: { A: 1, B: 0 },
    completedGames: [{ A: a, B: b }],
    currentGame: { A: 0, B: 0 },
    winner: "A",
    setupComplete: true,
    setupBaselineAck: { A: true, B: true },
    trackPositions: false,
  };
}

function serviceBo1Scores(a: number, b: number) {
  return {
    config: {
      sport: "pickleball_service",
      games: 1,
      pointsToWin: 11,
      winBy: 2,
      doubles: true,
      scoringSystem: "service",
    },
    gamesWon: { A: 1, B: 0 },
    completedGames: [{ A: a, B: b }],
    currentGame: { A: 0, B: 0 },
    winner: "A",
    setupComplete: true,
    setupBaselineAck: { A: true, B: true },
    trackPositions: false,
  };
}

function serviceBo3FinalScores() {
  return {
    config: {
      sport: "pickleball_service",
      games: 3,
      bestOf: 3,
      pointsToWin: 11,
      winBy: 2,
      doubles: true,
      scoringSystem: "service",
    },
    gamesWon: { A: 2, B: 0 },
    completedGames: [
      { A: 11, B: 8 },
      { A: 11, B: 9 },
    ],
    currentGame: { A: 0, B: 0 },
    winner: "A",
    setupComplete: true,
    setupBaselineAck: { A: true, B: true },
    trackPositions: false,
  };
}

export type SeedDinkDangalOptions = {
  /** When true, skip if tournament already exists (used by main db:seed). */
  createIfMissingOnly?: boolean;
  venueId?: number;
  createdById?: number;
  passwordHash?: string;
};

/**
 * Seed or rebuild Dink Dangal. Returns tournament id, or null if skipped.
 */
export async function seedDinkDangal(
  prisma: PrismaClient,
  opts: SeedDinkDangalOptions = {}
): Promise<number | null> {
  const passwordHash = opts.passwordHash ?? DEV_PASSWORD_HASH;
  const createIfMissingOnly = opts.createIfMissingOnly ?? false;

  const existing = await prisma.tournament.findFirst({ where: { name: DINK_DANGAL_NAME } });
  if (existing && createIfMissingOnly) {
    console.log(`  ⏭  Skipping "${DINK_DANGAL_NAME}" — already exists`);
    return null;
  }

  const sport = await prisma.sport.findFirst({
    where: { OR: [{ name: "pickleball" }, { name: "Pickleball" }] },
  });
  if (!sport) {
    throw new Error("Sport 'pickleball' not found. Run db:seed or db:seed:reference first.");
  }

  const organiser =
    opts.createdById != null
      ? await prisma.user.findUniqueOrThrow({ where: { id: opts.createdById } })
      : await prisma.user.upsert({
          where: { email: "dinkdangal@sportza.in" },
          update: {},
          create: {
            email: "dinkdangal@sportza.in",
            name: "Dink Dangal Organiser",
            role: "player",
            password: passwordHash,
          },
        });

  let venueId = opts.venueId ?? null;
  if (venueId == null) {
    let venue = await prisma.venue.findFirst({
      where: { OR: [{ name: { contains: "Pickleball" } }, { name: { contains: "pickleball" } }] },
    });
    if (!venue) {
      venue = await prisma.venue.create({
        data: {
          name: "Dink Dangal Courts",
          address: "Pune, Maharashtra",
          city: "Pune",
          state: "Maharashtra",
          country: "India",
          sportNames: ["pickleball"],
          createdById: organiser.id,
        },
      });
    }
    venueId = venue.id;
  }

  async function upsertPlayer(displayName: string, teamName: string) {
    const email = `${slug(displayName)}.${slug(teamName)}@dinkdangal.sportza.in`;
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: displayName,
        role: "player",
        password: passwordHash,
      },
    });
  }

  const playerNameByTeam = new Map<string, [string, string]>();
  const teamsJson: Array<{
    name: string;
    groupIndex: number;
    playerNames: [string, string];
    players: number[];
  }> = [];
  const playersJson: Array<{
    teamName: string;
    playerName: string;
    userId: number;
    username: string | null;
    jerseyNo: null;
    isPlaceholder: boolean;
    stats: Record<string, number>;
    goals: number;
    assists: number;
    points: number;
  }> = [];

  for (const team of TEAMS) {
    const [p1, p2] = await Promise.all([
      upsertPlayer(team.players[0], team.name),
      upsertPlayer(team.players[1], team.name),
    ]);
    playerNameByTeam.set(team.name, team.players);
    teamsJson.push({
      name: team.name,
      groupIndex: 0,
      playerNames: team.players,
      players: [p1.id, p2.id],
    });
    for (const [playerName, user] of [
      [team.players[0], p1] as const,
      [team.players[1], p2] as const,
    ]) {
      playersJson.push({
        teamName: team.name,
        playerName,
        userId: user.id,
        username: null,
        jerseyNo: null,
        isPlaceholder: false,
        stats: { putaways: 0, setups: 0, aces: 0 },
        goals: 0,
        assists: 0,
        points: 0,
      });
    }
  }
  console.log(`  ✓ ${teamsJson.length} teams, ${playersJson.length} players`);

  const championTeam = teamsJson.find((t) => t.name === "Amar & Adnan")!;
  const runnerTeam = teamsJson.find((t) => t.name === "Binay & Karan")!;

  const tournamentData = {
    description:
      "Historical pickleball doubles tournament. League rally-to-15 round robin (top 4 advance); knockout service-to-11 (SF best of 1, Final best of 3). Champions: Amar & Adnan.",
    sport: "pickleball",
    sportId: sport.id,
    format: "group_knockout",
    venueId,
    maxTeams: 7,
    status: "completed",
    startDate: new Date("2025-11-15"),
    endDate: new Date("2025-11-16"),
    teams: teamsJson as object,
    stages: STAGES as object,
    players: playersJson as object,
    winner: { name: championTeam.name, players: championTeam.players },
    runnerUp: { name: runnerTeam.name, players: runnerTeam.players },
  };

  let tournament = existing;
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: DINK_DANGAL_NAME,
        createdById: organiser.id,
        ...tournamentData,
      },
    });
    console.log(`  ✓ Created "${DINK_DANGAL_NAME}" (id=${tournament.id})`);
  } else {
    tournament = await prisma.tournament.update({
      where: { id: tournament.id },
      data: tournamentData,
    });
    console.log(`  ✓ Updated existing "${DINK_DANGAL_NAME}" (id=${tournament.id})`);

    const fixtures = await prisma.tournamentFixture.findMany({
      where: { tournamentId: tournament.id },
      select: { matchId: true },
    });
    const matchIds = fixtures.map((f) => f.matchId).filter((id): id is number => id != null);
    await prisma.tournamentFixture.deleteMany({ where: { tournamentId: tournament.id } });
    if (matchIds.length > 0) {
      await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
    }
    await prisma.match.deleteMany({ where: { tournamentId: tournament.id } });
    console.log(`  ✓ Cleared prior fixtures/matches`);
  }

  async function createCompletedMatch(optsM: {
    team1: string;
    team2: string;
    playerNames1: [string, string];
    playerNames2: [string, string];
    scoreType: "pickleball_rally" | "pickleball_service";
    scores: object;
    matchDate: Date;
    formatLabel: string;
  }) {
    return prisma.match.create({
      data: {
        sportId: sport.id,
        sportName: "pickleball",
        formatName: optsM.formatLabel,
        tournamentId: tournament!.id,
        venueId: venueId ?? undefined,
        playersPerTeam: 2,
        teams: {
          A: { name: optsM.team1, playerNames: optsM.playerNames1 },
          B: { name: optsM.team2, playerNames: optsM.playerNames2 },
        },
        scoreType: optsM.scoreType,
        scores: optsM.scores as Prisma.InputJsonValue,
        winnerTeam: "A",
        matchDate: optsM.matchDate,
        status: "completed",
        createdById: organiser.id,
        matchType: "COMPETITIVE",
        loggingMode: "QUICK_RESULT",
        statsProcessed: true,
      },
    });
  }

  const leagueDate = new Date("2025-11-15T10:00:00Z");
  let matchOrder = 0;

  for (const result of LEAGUE_RESULTS) {
    matchOrder++;
    const match = await createCompletedMatch({
      team1: result.winner,
      team2: result.loser,
      playerNames1: playerNameByTeam.get(result.winner)!,
      playerNames2: playerNameByTeam.get(result.loser)!,
      scoreType: "pickleball_rally",
      scores: rallyBo1Scores(result.scoreA, result.scoreB),
      matchDate: new Date(leagueDate.getTime() + matchOrder * 60 * 60 * 1000),
      formatLabel: `League · M${String(matchOrder).padStart(2, "0")}`,
    });
    await prisma.tournamentFixture.create({
      data: {
        tournamentId: tournament.id,
        stage: 1,
        round: 1,
        groupIndex: 0,
        matchOrder,
        team1Type: "team",
        team1Ref: { name: result.winner, matchId: `L${matchOrder}` },
        team2Type: "team",
        team2Ref: { name: result.loser, matchId: `L${matchOrder}` },
        matchId: match.id,
        status: "completed",
      },
    });
  }
  console.log(`  ✓ ${LEAGUE_RESULTS.length} league fixtures + matches`);

  const sf1Match = await createCompletedMatch({
    team1: "Amar & Adnan",
    team2: "Rachit & Rajas",
    playerNames1: playerNameByTeam.get("Amar & Adnan")!,
    playerNames2: playerNameByTeam.get("Rachit & Rajas")!,
    scoreType: "pickleball_service",
    scores: serviceBo1Scores(11, 6),
    matchDate: new Date("2025-11-16T10:00:00Z"),
    formatLabel: "Semi-finals · SF1",
  });
  await prisma.tournamentFixture.create({
    data: {
      tournamentId: tournament.id,
      stage: 2,
      round: 1,
      matchOrder: 1,
      team1Type: "team",
      team1Ref: { name: "Amar & Adnan", matchId: "SF1", seed: 1 },
      team2Type: "team",
      team2Ref: { name: "Rachit & Rajas", matchId: "SF1", seed: 4 },
      matchId: sf1Match.id,
      status: "completed",
    },
  });

  const sf2Match = await createCompletedMatch({
    team1: "Binay & Karan",
    team2: "Rohit & Aniket",
    playerNames1: playerNameByTeam.get("Binay & Karan")!,
    playerNames2: playerNameByTeam.get("Rohit & Aniket")!,
    scoreType: "pickleball_service",
    scores: serviceBo1Scores(11, 6),
    matchDate: new Date("2025-11-16T11:00:00Z"),
    formatLabel: "Semi-finals · SF2",
  });
  await prisma.tournamentFixture.create({
    data: {
      tournamentId: tournament.id,
      stage: 2,
      round: 1,
      matchOrder: 2,
      team1Type: "team",
      team1Ref: { name: "Binay & Karan", matchId: "SF2", seed: 2 },
      team2Type: "team",
      team2Ref: { name: "Rohit & Aniket", matchId: "SF2", seed: 3 },
      matchId: sf2Match.id,
      status: "completed",
    },
  });

  const finalMatch = await createCompletedMatch({
    team1: "Amar & Adnan",
    team2: "Binay & Karan",
    playerNames1: playerNameByTeam.get("Amar & Adnan")!,
    playerNames2: playerNameByTeam.get("Binay & Karan")!,
    scoreType: "pickleball_service",
    scores: serviceBo3FinalScores(),
    matchDate: new Date("2025-11-16T14:00:00Z"),
    formatLabel: "Final · Bo3",
  });
  await prisma.tournamentFixture.create({
    data: {
      tournamentId: tournament.id,
      stage: 2,
      round: 2,
      matchOrder: 1,
      team1Type: "team",
      team1Ref: { name: "Amar & Adnan", matchId: "FIN" },
      team2Type: "team",
      team2Ref: { name: "Binay & Karan", matchId: "FIN" },
      matchId: finalMatch.id,
      status: "completed",
    },
  });
  console.log("  ✓ 2 semi-finals + Final (Bo3)");

  return tournament.id;
}

async function main() {
  const prisma = new PrismaClient();
  const dbHost = process.env.DATABASE_URL?.match(/@([^/]+)\//)?.[1] ?? "(from Prisma schema/.env)";
  console.log(`🌱  Seeding Dink Dangal…  DB host: ${dbHost}`);
  try {
    const id = await seedDinkDangal(prisma);
    console.log(`✅  Dink Dangal seed complete (tournament id=${id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

// Only auto-run when this file is the entry script (not when imported by seed.ts)
const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes("seed-dink-dangal");
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
