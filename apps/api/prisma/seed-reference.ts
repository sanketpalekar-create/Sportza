/**
 * Production-safe reference seed — sports, formats, rulebooks + tournament sportId backfill.
 *
 * Does NOT create users, venues, bookings, or demo tournaments.
 * Safe to re-run (upsert / idempotent).
 *
 *   pnpm --filter @sportza/api db:seed:reference
 *
 * Railway Console (from apps/api cwd):
 *   pnpm db:seed:reference
 */

import { PrismaClient } from "@prisma/client";
import { resolveTournamentSport } from "../src/lib/tournament-sport";

const prisma = new PrismaClient();

const sportDefs = [
  { name: "badminton",  displayName: "Badminton",  price: 400,  rates: { morning: 400,  afternoon: 500,  evening: 600  } },
  { name: "cricket",    displayName: "Cricket",    price: 2000, rates: { morning: 2000, afternoon: 2000, evening: 2500 } },
  { name: "football",   displayName: "Football",   price: 1500, rates: { morning: 1500, afternoon: 1500, evening: 2000 } },
  { name: "tennis",     displayName: "Tennis",     price: 600,  rates: { morning: 600,  afternoon: 700,  evening: 900  } },
  { name: "padel",      displayName: "Padel",      price: 700,  rates: { morning: 700,  afternoon: 800,  evening: 1000 } },
  { name: "basketball", displayName: "Basketball", price: 800,  rates: { morning: 800,  afternoon: 900,  evening: 1100 } },
  { name: "swimming",   displayName: "Swimming",   price: 300,  rates: { morning: 300,  afternoon: 300,  evening: 400  } },
  { name: "pickleball", displayName: "Pickleball", price: 500,  rates: { morning: 500,  afternoon: 600,  evening: 750  } },
];

const rulebookData: Array<{ name: string; rulebookTitle: string; rulebookLines: string[] }> = [
  {
    name: "badminton",
    rulebookTitle: "How to Play Badminton",
    rulebookLines: [
      "Every rally = 1 point to the rally winner.",
      "First to 21 points wins the game, must win by 2.",
      "At 29-29 next point wins (sudden death cap).",
      "Match is best of 3 games.",
    ],
  },
  {
    name: "cricket",
    rulebookTitle: "How to Play Cricket",
    rulebookLines: [
      "Batting team scores runs each ball.",
      "Innings ends when overs run out or team is all out (10 wickets).",
      "Team with the most runs at the end wins.",
      "T10 = 10 overs per side · T20 = 20 overs per side.",
    ],
  },
  {
    name: "football",
    rulebookTitle: "How to Play Football",
    rulebookLines: [
      "Score by putting the ball into the opponent's goal.",
      "Each goal = 1 point.",
      "Team with more goals at full time wins (draw is possible).",
      "Match has 2 halves; played as 5-a-side, 7-a-side, or 11-a-side.",
    ],
  },
  {
    name: "tennis",
    rulebookTitle: "How to Play Tennis",
    rulebookLines: [
      "Points go: 0 → 15 → 30 → 40 → Game.",
      "At deuce (40-40) you must win 2 points in a row.",
      "First to 6 games wins the set (must lead by 2; tiebreak at 6-6).",
      "Match is best of sets — usually best of 3.",
    ],
  },
  {
    name: "padel",
    rulebookTitle: "How to Play Padel",
    rulebookLines: [
      "Padel is usually played as doubles on an enclosed court.",
      "Scoring follows tennis: 15, 30, 40, game (deuce/advantage at 40-40).",
      "Players can use the walls after the ball bounces, but not before.",
      "Sets are typically first to 6 games with a 2-game lead.",
    ],
  },
  {
    name: "basketball",
    rulebookTitle: "How to Play Basketball",
    rulebookLines: [
      "Score by shooting the ball through the hoop.",
      "Free throw = 1 pt · Normal shot = 2 pts · Beyond arc = 3 pts.",
      "Team with more points at the final buzzer wins.",
      "Played in 4 quarters or 2 halves.",
    ],
  },
  {
    name: "pickleball",
    rulebookTitle: "How to Play Pickleball",
    rulebookLines: [
      "Rally scoring: every rally = 1 point for the winner.",
      "Service scoring: only the serving team can score; fault = side-out.",
      "First to 11 points, win by 2 (best of 3 games).",
      "Volleying inside the kitchen (non-volley zone) is a fault.",
    ],
  },
  {
    name: "swimming",
    rulebookTitle: "How to Compete in Swimming",
    rulebookLines: [
      "Fastest time to complete the distance wins.",
      "Each race has a fixed stroke (freestyle, backstroke, etc.).",
      "False start = disqualification.",
      "Official timer result is final.",
    ],
  },
];

const formatDefs: Array<{
  sportName: string;
  name: string;
  playersPerTeam: number;
  desc?: string;
  config?: { scoringType?: string; pointsToWin?: number };
}> = [
  { sportName: "badminton",  name: "Singles",     playersPerTeam: 1 },
  { sportName: "badminton",  name: "Doubles",     playersPerTeam: 2 },
  { sportName: "cricket",    name: "T10",         playersPerTeam: 6,  desc: "10-over format" },
  { sportName: "cricket",    name: "T20",         playersPerTeam: 11, desc: "20-over format" },
  { sportName: "football",   name: "5-a-side",    playersPerTeam: 5 },
  { sportName: "football",   name: "7-a-side",    playersPerTeam: 7 },
  { sportName: "football",   name: "11-a-side",   playersPerTeam: 11 },
  { sportName: "tennis",     name: "Singles",     playersPerTeam: 1 },
  { sportName: "tennis",     name: "Doubles",     playersPerTeam: 2 },
  { sportName: "padel",      name: "Singles",     playersPerTeam: 1 },
  { sportName: "padel",      name: "Doubles",     playersPerTeam: 2 },
  { sportName: "basketball", name: "3×3",         playersPerTeam: 3 },
  { sportName: "basketball", name: "5×5",         playersPerTeam: 5 },
  {
    sportName: "pickleball",
    name: "Singles",
    playersPerTeam: 1,
    desc: "Rally scoring — every rally wins a point for the side you tap.",
    config: { scoringType: "pickleball_rally", pointsToWin: 11 },
  },
  {
    sportName: "pickleball",
    name: "Doubles",
    playersPerTeam: 2,
    desc: "Rally scoring — every rally wins a point for the side you tap.",
    config: { scoringType: "pickleball_rally", pointsToWin: 11 },
  },
  {
    sportName: "pickleball",
    name: "Doubles (service)",
    playersPerTeam: 2,
    desc: "Side-out scoring, Server 1/2 — optional court setup on live screen, or skip without player-side tracking.",
    config: { scoringType: "pickleball_service", pointsToWin: 11 },
  },
  {
    sportName: "pickleball",
    name: "Singles (service)",
    playersPerTeam: 1,
    desc: "Side-out scoring — only the server can add points.",
    config: { scoringType: "pickleball_service", pointsToWin: 11 },
  },
];

async function main() {
  const dbHost = process.env.DATABASE_URL?.match(/@([^/]+)\//)?.[1] ?? "(from Prisma schema/.env)";
  console.log(`🌱  Seeding reference data (sports / formats)…  DB host: ${dbHost}`);

  const sports: Record<string, { id: number }> = {};
  for (const s of sportDefs) {
    const row = await prisma.sport.upsert({
      where: { name: s.name },
      update: {
        displayName: s.displayName,
        defaultPricePerHour: s.price,
        defaultRates: s.rates,
        defaultMinBookingHrs: 1,
        isActive: true,
      },
      create: {
        name: s.name,
        displayName: s.displayName,
        defaultPricePerHour: s.price,
        defaultRates: s.rates,
        defaultMinBookingHrs: 1,
        isActive: true,
      },
    });
    sports[s.name] = { id: row.id };
  }
  console.log(`  ✓ ${sportDefs.length} sports`);

  for (const rb of rulebookData) {
    await prisma.sport.updateMany({
      where: { name: rb.name },
      data: {
        rulebookTitle: rb.rulebookTitle,
        rulebookLines: rb.rulebookLines as object,
      },
    });
  }
  console.log("  ✓ Sport rulebooks");

  let formatsCreated = 0;
  for (const f of formatDefs) {
    const sportId = sports[f.sportName]?.id;
    if (!sportId) continue;
    const exists = await prisma.sportFormat.findFirst({
      where: { sportId, name: f.name },
    });
    if (!exists) {
      await prisma.sportFormat.create({
        data: {
          sportId,
          name: f.name,
          playersPerTeam: f.playersPerTeam,
          description: f.desc,
          ...(f.config ? { config: f.config as object } : {}),
        },
      });
      formatsCreated++;
    }
  }
  console.log(`  ✓ Sport formats (${formatsCreated} new)`);

  // Backfill tournaments missing sportId (or still storing displayName as sport)
  const tournaments = await prisma.tournament.findMany({
    select: { id: true, name: true, sport: true, sportId: true },
  });
  let linked = 0;
  let skipped = 0;
  for (const t of tournaments) {
    const resolved = await resolveTournamentSport({
      sportId: t.sportId,
      sport: t.sport,
    });
    if (!resolved) {
      console.warn(`  ⚠ Tournament #${t.id} "${t.name}" — cannot resolve sport "${t.sport}"`);
      skipped++;
      continue;
    }
    if (t.sportId === resolved.id && t.sport === resolved.name) continue;
    await prisma.tournament.update({
      where: { id: t.id },
      data: { sportId: resolved.id, sport: resolved.name },
    });
    linked++;
    console.log(`  ✓ Linked tournament #${t.id} "${t.name}" → ${resolved.name} (id=${resolved.id})`);
  }
  console.log(`  ✓ Tournament sport backfill: ${linked} updated, ${skipped} unresolved`);

  console.log("✅  Reference seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
