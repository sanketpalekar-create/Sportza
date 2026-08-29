/**
 * Picklethon August — Wipe fixtures + reseed official Draws schedule
 *
 * Updates existing "Picklethon August" tournament:
 *   1. Delete fixtures (and linked matches if any)
 *   2. Refresh stages (advancePerGroup: 4) + description
 *   3. Recreate M01–M40 group fixtures + R16→Final knockout bracket
 *
 * Run: pnpm --filter @sportza/api db:patch:picklethon-august
 */

import { PrismaClient } from "@prisma/client";
import {
  PICKLETHON_GROUP_LETTERS,
  PICKLETHON_GROUP_SCHEDULE,
  PICKLETHON_KNOCKOUT_BRACKET,
  PICKLETHON_STAGES,
} from "./data/picklethon-pools";

const prisma = new PrismaClient();
const PICKLETHON_NAME = "Picklethon August";

async function main() {
  console.log("🔧  Patching Picklethon August with official Draws…");

  const tournament = await prisma.tournament.findFirst({ where: { name: PICKLETHON_NAME } });
  if (!tournament) {
    console.error(`❌  Tournament "${PICKLETHON_NAME}" not found. Run db:seed first.`);
    process.exit(1);
  }

  const fixtures = await prisma.tournamentFixture.findMany({
    where: { tournamentId: tournament.id },
    select: { id: true, matchId: true },
  });
  const matchIds = fixtures.map((f) => f.matchId).filter((id): id is number => id != null);

  await prisma.tournamentFixture.deleteMany({ where: { tournamentId: tournament.id } });
  if (matchIds.length > 0) {
    await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  }
  console.log(`  ✓ Cleared ${fixtures.length} fixtures` + (matchIds.length ? ` + ${matchIds.length} matches` : ""));

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      description:
        "Picklethon August pickleball doubles tournament. 4 groups of 5 teams; top 4 per group advance to Round of 16.",
      stages: PICKLETHON_STAGES as object,
      format: "group_knockout",
      maxTeams: 20,
      status: "in_progress",
    },
  });
  console.log("  ✓ Updated stages (advancePerGroup: 4)");

  const groupIndexByLetter: Record<(typeof PICKLETHON_GROUP_LETTERS)[number], number> = {
    A: 0, B: 1, C: 2, D: 3,
  };

  for (const m of PICKLETHON_GROUP_SCHEDULE) {
    await prisma.tournamentFixture.create({
      data: {
        tournamentId: tournament.id,
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
        tournamentId: tournament.id,
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

  console.log("✅  Picklethon August patch complete.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
