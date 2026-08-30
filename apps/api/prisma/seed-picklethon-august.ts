/**
 * Picklethon August — Create or patch (official Draws)
 *
 * Idempotent upsert for production or local:
 *   - Creates tournament + player users if missing
 *   - Or refreshes teams/stages/fixtures if it already exists
 *
 * Run (local):
 *   pnpm --filter @sportza/api db:seed:picklethon-august
 *
 * Run (production):
 *   $env:DATABASE_URL="mysql://..."   # Railway MySQL URL
 *   pnpm --filter @sportza/api db:seed:picklethon-august
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PICKLETHON_AUGUST_POOLS,
  PICKLETHON_GROUP_LETTERS,
  PICKLETHON_GROUP_SCHEDULE,
  PICKLETHON_KNOCKOUT_BRACKET,
  PICKLETHON_STAGES,
} from "./data/picklethon-pools";

const prisma = new PrismaClient();
const DEV_PASSWORD_HASH = bcrypt.hashSync("Sportza@123", 12);
const PICKLETHON_NAME = "Picklethon August";

const groupIndexByLetter: Record<(typeof PICKLETHON_GROUP_LETTERS)[number], number> = {
  A: 0, B: 1, C: 2, D: 3,
};

function picklethonSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

async function upsertPicklethonPlayer(displayName: string, teamName: string) {
  const email = `${picklethonSlug(displayName)}.${picklethonSlug(teamName)}@picklethon.sportza.in`;
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: displayName,
      role: "player",
      password: DEV_PASSWORD_HASH,
    },
  });
}

async function buildTeamsAndPlayers() {
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

  for (let gIdx = 0; gIdx < PICKLETHON_GROUP_LETTERS.length; gIdx++) {
    const letter = PICKLETHON_GROUP_LETTERS[gIdx];
    for (const team of PICKLETHON_AUGUST_POOLS[letter]) {
      const [p1, p2] = await Promise.all([
        upsertPicklethonPlayer(team.player1, team.name),
        upsertPicklethonPlayer(team.player2, team.name),
      ]);
      teamsJson.push({
        name: team.name,
        groupIndex: gIdx,
        playerNames: [team.player1, team.player2],
        players: [p1.id, p2.id],
      });
      for (const [playerName, user] of [
        [team.player1, p1] as const,
        [team.player2, p2] as const,
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
  }
  return { teamsJson, playersJson };
}

async function replaceFixtures(tournamentId: number) {
  const fixtures = await prisma.tournamentFixture.findMany({
    where: { tournamentId },
    select: { id: true, matchId: true },
  });
  const matchIds = fixtures.map((f) => f.matchId).filter((id): id is number => id != null);

  await prisma.tournamentFixture.deleteMany({ where: { tournamentId } });
  if (matchIds.length > 0) {
    await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  }
  console.log(`  ✓ Cleared ${fixtures.length} fixtures` + (matchIds.length ? ` + ${matchIds.length} matches` : ""));

  for (const m of PICKLETHON_GROUP_SCHEDULE) {
    await prisma.tournamentFixture.create({
      data: {
        tournamentId,
        stage: 1,
        round: 1,
        groupIndex: groupIndexByLetter[m.group],
        matchOrder: m.matchOrder,
        team1Type: "team",
        team1Ref: { name: m.team1, court: m.court, matchId: m.matchId },
        team2Type: "team",
        team2Ref: { name: m.team2, court: m.court, matchId: m.matchId },
        status: "upcoming",
      },
    });
  }
  console.log(`  ✓ ${PICKLETHON_GROUP_SCHEDULE.length} group fixtures (M01–M40)`);

  for (const m of PICKLETHON_KNOCKOUT_BRACKET) {
    await prisma.tournamentFixture.create({
      data: {
        tournamentId,
        stage: 2,
        round: m.round,
        matchOrder: m.matchOrder,
        team1Type: m.team1Type,
        team1Ref: { ...m.team1, court: m.court, matchId: m.matchId },
        team2Type: m.team2Type,
        team2Ref: { ...m.team2, court: m.court, matchId: m.matchId },
        status: "upcoming",
      },
    });
  }
  console.log(`  ✓ ${PICKLETHON_KNOCKOUT_BRACKET.length} knockout fixtures (R16 → Final)`);
}

async function resolveOrganiserId(): Promise<number> {
  const preferred = await prisma.user.findFirst({
    where: {
      OR: [
        { email: "arjun@sportza.dev" },
        { email: { contains: "sanket" } },
      ],
    },
    orderBy: { id: "asc" },
  });
  if (preferred) return preferred.id;

  const any = await prisma.user.findFirst({ orderBy: { id: "asc" } });
  if (any) return any.id;

  const created = await prisma.user.create({
    data: {
      email: "picklethon.organiser@sportza.in",
      name: "Picklethon Organiser",
      role: "player",
      password: DEV_PASSWORD_HASH,
    },
  });
  return created.id;
}

async function resolvePickleballSport() {
  const sport = await prisma.sport.findFirst({
    where: { OR: [{ name: "pickleball" }, { name: "Pickleball" }] },
  });
  if (!sport) {
    throw new Error("Sport 'pickleball' not found. Ensure sports are seeded on this database.");
  }
  return sport;
}

async function main() {
  const dbHost = process.env.DATABASE_URL?.match(/@([^/]+)\//)?.[1] ?? "(from Prisma schema/.env)";
  console.log(`🌱  Seeding Picklethon August…  DB host: ${dbHost}`);

  const sport = await resolvePickleballSport();
  const createdById = await resolveOrganiserId();
  const { teamsJson, playersJson } = await buildTeamsAndPlayers();
  console.log(`  ✓ ${teamsJson.length} teams, ${playersJson.length} players`);

  let tournament = await prisma.tournament.findFirst({ where: { name: PICKLETHON_NAME } });

  if (!tournament) {
    // Also adopt a loosely named "Picklethon" draft if that's the only one
    const loose = await prisma.tournament.findFirst({
      where: { name: { equals: "Picklethon" } },
    });
    if (loose) {
      tournament = await prisma.tournament.update({
        where: { id: loose.id },
        data: {
          name: PICKLETHON_NAME,
          description:
            "Picklethon August pickleball doubles tournament. 4 groups of 5 teams; top 4 per group advance to Round of 16.",
          sport: "pickleball",
          sportId: sport.id,
          format: "group_knockout",
          maxTeams: 20,
          status: "in_progress",
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-31"),
          teams: teamsJson as object,
          stages: PICKLETHON_STAGES as object,
          players: playersJson as object,
        },
      });
      console.log(`  ✓ Renamed existing "Picklethon" → "${PICKLETHON_NAME}" (id=${tournament.id})`);
    } else {
      tournament = await prisma.tournament.create({
        data: {
          name: PICKLETHON_NAME,
          description:
            "Picklethon August pickleball doubles tournament. 4 groups of 5 teams; top 4 per group advance to Round of 16.",
          sport: "pickleball",
          sportId: sport.id,
          format: "group_knockout",
          createdById,
          maxTeams: 20,
          status: "in_progress",
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-31"),
          teams: teamsJson as object,
          stages: PICKLETHON_STAGES as object,
          players: playersJson as object,
        },
      });
      console.log(`  ✓ Created "${PICKLETHON_NAME}" (id=${tournament.id})`);
    }
  } else {
    tournament = await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        description:
          "Picklethon August pickleball doubles tournament. 4 groups of 5 teams; top 4 per group advance to Round of 16.",
        sport: "pickleball",
        sportId: sport.id,
        format: "group_knockout",
        maxTeams: 20,
        status: "in_progress",
        teams: teamsJson as object,
        stages: PICKLETHON_STAGES as object,
        players: playersJson as object,
      },
    });
    console.log(`  ✓ Updated existing "${PICKLETHON_NAME}" (id=${tournament.id})`);
  }

  await replaceFixtures(tournament.id);
  console.log("✅  Picklethon August seed complete.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
