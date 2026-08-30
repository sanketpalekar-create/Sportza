/**
 * Clone prod-like broken KO slots onto local Picklethon August, then repair+sync.
 * Or set DATABASE_URL to production and pass --prod to repair live tournament id 3.
 *
 *   npx tsx scripts/repair-picklethon-ko-slots.ts
 *   DATABASE_URL="mysql://..." npx tsx scripts/repair-picklethon-ko-slots.ts --prod
 */
import prisma from "../src/lib/prisma";
import { repairKnockoutBracketSlots } from "../src/lib/tournament-bracket-repair";
import { syncKnockoutBracket } from "../src/lib/tournament-bracket-resolve";

const PROD_R16: Array<{
  matchOrder: number;
  t1: string;
  t2: string;
  winner: "A" | "B";
}> = [
  { matchOrder: 1, t1: "Hybrid Hitters", t2: "Fingine", winner: "A" },
  { matchOrder: 2, t1: "Pickleball Paradise", t2: "Tararara", winner: "B" },
  { matchOrder: 3, t1: "SA strikers", t2: "Fighters", winner: "A" },
  { matchOrder: 4, t1: "Acers", t2: "The Jadu", winner: "A" },
  { matchOrder: 5, t1: "Valerian 1", t2: "JS", winner: "A" },
  { matchOrder: 6, t1: "Dropshots", t2: "Josh", winner: "A" },
  { matchOrder: 7, t1: "Amarmanil", t2: "Net Ninjas", winner: "A" },
  { matchOrder: 8, t1: "Outer Team", t2: "Team name", winner: "A" },
];

async function printKo(tournamentId: number, label: string) {
  const fix = await prisma.tournamentFixture.findMany({
    where: { tournamentId, stage: 2 },
    orderBy: [{ round: "asc" }, { matchOrder: "asc" }],
  });
  console.log(`\n=== ${label} ===`);
  for (const f of fix) {
    const t1 = (f.team1Ref as any)?.name ?? JSON.stringify(f.team1Ref);
    const t2 = (f.team2Ref as any)?.name ?? JSON.stringify(f.team2Ref);
    console.log(`  R${f.round} M${f.matchOrder} [${f.team1Type}/${f.team2Type}] ${t1} vs ${t2} match=${f.matchId}`);
  }
}

async function seedLocalBrokenState(tournamentId: number, userId: number, sportId: number) {
  // Wipe KO fixtures + their matches
  const existing = await prisma.tournamentFixture.findMany({
    where: { tournamentId, stage: 2 },
  });
  const matchIds = existing.map((e) => e.matchId).filter((x): x is number => x != null);
  await prisma.tournamentFixture.deleteMany({ where: { tournamentId, stage: 2 } });
  if (matchIds.length) {
    await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  }

  // Create R16 in broken play order with completed matches
  for (const row of PROD_R16) {
    const match = await prisma.match.create({
      data: {
        sportId,
        sportName: "pickleball",
        formatName: "doubles",
        matchDate: new Date(),
        status: "completed",
        winnerTeam: row.winner,
        scores: { completedGames: [{ A: 11, B: 5 }] },
        teams: {
          A: { name: row.t1 },
          B: { name: row.t2 },
        },
        createdById: userId,
        tournamentId,
      },
    });
    await prisma.tournamentFixture.create({
      data: {
        tournamentId,
        stage: 2,
        round: 1,
        matchOrder: row.matchOrder,
        team1Type: "team",
        team1Ref: { name: row.t1 },
        team2Type: "team",
        team2Ref: { name: row.t2 },
        matchId: match.id,
        status: "completed",
      },
    });
  }

  // QF/SF/Final with GLOBAL matchOrder (the bug)
  let mo = 9;
  for (let i = 0; i < 4; i++) {
    await prisma.tournamentFixture.create({
      data: {
        tournamentId,
        stage: 2,
        round: 2,
        matchOrder: mo++,
        team1Type: "winner",
        team1Ref: { stage: 2, round: 1, match: i * 2 + 1 },
        team2Type: "winner",
        team2Ref: { stage: 2, round: 1, match: i * 2 + 2 },
        status: "upcoming",
      },
    });
  }
  for (let i = 0; i < 2; i++) {
    await prisma.tournamentFixture.create({
      data: {
        tournamentId,
        stage: 2,
        round: 3,
        matchOrder: mo++,
        team1Type: "winner",
        team1Ref: { stage: 2, round: 2, match: i * 2 + 1 },
        team2Type: "winner",
        team2Ref: { stage: 2, round: 2, match: i * 2 + 2 },
        status: "upcoming",
      },
    });
  }
  await prisma.tournamentFixture.create({
    data: {
      tournamentId,
      stage: 2,
      round: 4,
      matchOrder: mo++,
      team1Type: "winner",
      team1Ref: { stage: 2, round: 3, match: 1 },
      team2Type: "winner",
      team2Ref: { stage: 2, round: 3, match: 2 },
      status: "upcoming",
    },
  });
}

async function main() {
  const isProd = process.argv.includes("--prod");
  const t = await prisma.tournament.findFirst({
    where: isProd
      ? { id: 3 }
      : { name: "Picklethon August" },
    select: { id: true, name: true, createdById: true, sportId: true },
  });
  if (!t) throw new Error("Tournament not found");

  if (!isProd) {
    console.log("Seeding local broken state mimicking production…");
    const sportId = t.sportId ?? (await prisma.sport.findFirst({ where: { name: { contains: "pickle" } } }))?.id;
    if (!sportId) throw new Error("No sportId for pickleball");
    await seedLocalBrokenState(t.id, t.createdById, sportId);
  }

  await printKo(t.id, "BEFORE");
  const repair = await repairKnockoutBracketSlots(t.id);
  console.log("repair", repair);
  const sync = await syncKnockoutBracket(t.id);
  console.log("sync", sync);
  await printKo(t.id, "AFTER");

  // Assert expected QF
  const qf = await prisma.tournamentFixture.findMany({
    where: { tournamentId: t.id, stage: 2, round: 2 },
    orderBy: { matchOrder: "asc" },
  });
  const expect = [
    ["Hybrid Hitters", "Outer Team"],
    ["Amarmanil", "Tararara"],
    ["Valerian 1", "Acers"],
    ["SA strikers", "Dropshots"],
  ];
  for (let i = 0; i < 4; i++) {
    const names = new Set([
      ((qf[i].team1Ref as any)?.name ?? "").toLowerCase(),
      ((qf[i].team2Ref as any)?.name ?? "").toLowerCase(),
    ]);
    const ok = expect[i].every((n) => names.has(n.toLowerCase()));
    if (!ok) {
      throw new Error(
        `QF${i + 1} expected ${expect[i].join(" vs ")}, got ${JSON.stringify(qf[i].team1Ref)} / ${JSON.stringify(qf[i].team2Ref)}`
      );
    }
    console.log(`QF${i + 1} OK: ${expect[i].join(" vs ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
