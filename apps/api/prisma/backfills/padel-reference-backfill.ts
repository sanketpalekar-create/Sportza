/**
 * Padel Reference Backfill
 *
 * Safe, idempotent script that inserts/updates reference and configuration
 * rows for padel in the live database. It never touches transactional data
 * (bookings, matches, open plays, tournaments, batches, stats, ratings).
 *
 * What it does:
 *  1. Upsert the `sports` row for padel
 *  2. Upsert `sport_formats` rows (Singles + Doubles) for padel
 *  3. For every tennis-capable venue: add padel to the venue's sports JSON array
 *  4. For every padel-capable venue facility: add padel to its sports JSON array
 *  5. Upsert a `sport_rates` row for padel on each updated venue
 *  6. (Optional — INCLUDE_TRAINERS=true) Add padel to trainer_profiles where
 *     tennis is already listed
 *
 * Usage:
 *   pnpm --filter @sportza/api db:backfill:padel
 *   INCLUDE_TRAINERS=true pnpm --filter @sportza/api db:backfill:padel
 *
 * Re-runnable: all operations are guarded with findFirst / upsert / JSON-array
 * membership checks so duplicate runs are harmless.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PADEL_RATES = {
  morning:   700,
  afternoon: 800,
  evening:   1000,
} as const;

const PADEL_DISPLAY_NAME = "Padel";

const PADEL_RULEBOOK_TITLE = "How to Play Padel";
const PADEL_RULEBOOK_LINES = [
  "Padel is usually played as doubles on an enclosed court with glass walls.",
  "Scoring follows tennis: 15, 30, 40, game (deuce/advantage at 40-40).",
  "Players can use the walls after the ball bounces off the court, but not before.",
  "Sets are typically first to 6 games with a 2-game lead; a tie-break decides at 6-6.",
  "The serve must be underarm and bounce before being struck.",
];

const INCLUDE_TRAINERS = process.env.INCLUDE_TRAINERS === "true";

async function run() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Padel Reference Backfill");
  console.log(`  INCLUDE_TRAINERS = ${INCLUDE_TRAINERS}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // ── 1. Upsert Sport row ────────────────────────────────────────────────────
  const padelSport = await prisma.sport.upsert({
    where:  { name: "padel" },
    update: {
      displayName:         PADEL_DISPLAY_NAME,
      defaultPricePerHour: PADEL_RATES.morning,
      defaultRates:        PADEL_RATES,
      rulebookTitle:       PADEL_RULEBOOK_TITLE,
      rulebookLines:       PADEL_RULEBOOK_LINES,
      isActive:            true,
    },
    create: {
      name:                "padel",
      displayName:         PADEL_DISPLAY_NAME,
      defaultPricePerHour: PADEL_RATES.morning,
      defaultRates:        PADEL_RATES,
      rulebookTitle:       PADEL_RULEBOOK_TITLE,
      rulebookLines:       PADEL_RULEBOOK_LINES,
      isActive:            true,
    },
  });
  console.log(`✓ Sport: padel (id=${padelSport.id})`);

  // ── 2. Upsert SportFormat rows ─────────────────────────────────────────────
  const formats: Array<{ name: string; playersPerTeam: number }> = [
    { name: "Singles", playersPerTeam: 1 },
    { name: "Doubles", playersPerTeam: 2 },
  ];

  let formatsCreated = 0;
  for (const fmt of formats) {
    const existing = await prisma.sportFormat.findFirst({
      where: { sportId: padelSport.id, name: fmt.name },
    });
    if (!existing) {
      await prisma.sportFormat.create({
        data: {
          sportId:        padelSport.id,
          name:           fmt.name,
          playersPerTeam: fmt.playersPerTeam,
          minTeams:       2,
          maxTeams:       2,
        },
      });
      formatsCreated++;
    }
  }
  console.log(`✓ SportFormats: ${formatsCreated} created, ${formats.length - formatsCreated} already existed`);

  // ── 3. Find tennis-capable venues ─────────────────────────────────────────
  const allVenues = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sports: true },
  });

  const tennisCandidates = allVenues.filter((v) => {
    const sports = (v.sports as string[] | null) ?? [];
    return sports.includes("tennis") && !sports.includes("padel");
  });

  console.log(`\n  Tennis-capable venues eligible for padel: ${tennisCandidates.length}`);

  let venuesUpdated = 0;
  let facilitiesUpdated = 0;
  let ratesCreated = 0;

  for (const venue of tennisCandidates) {
    const sports = (venue.sports as string[]) ?? [];

    // 3a. Update venue sports array
    await prisma.venue.update({
      where: { id: venue.id },
      data:  { sports: [...sports, "padel"] },
    });
    venuesUpdated++;
    console.log(`  → Venue "${venue.name}" (id=${venue.id}): added padel to sports array`);

    // 3b. Update facility sports arrays for tennis/multi-sport courts at this venue
    const facilities = await prisma.facility.findMany({
      where: { venueId: venue.id },
      select: { id: true, name: true, sports: true },
    });

    for (const fac of facilities) {
      const facSports = (fac.sports as string[] | null) ?? [];
      if (facSports.includes("tennis") && !facSports.includes("padel")) {
        await prisma.facility.update({
          where: { id: fac.id },
          data:  { sports: [...facSports, "padel"] },
        });
        facilitiesUpdated++;
        console.log(`     Facility "${fac.name}" (id=${fac.id}): added padel`);
      }
    }

    // Also update SportFacility rows for this venue
    const sportFacilities = await prisma.sportFacility.findMany({
      where: { venueId: venue.id },
      select: { id: true, name: true, sports: true },
    });

    for (const sf of sportFacilities) {
      const sfSports = (sf.sports as string[] | null) ?? [];
      if (sfSports.includes("tennis") && !sfSports.includes("padel")) {
        await prisma.sportFacility.update({
          where: { id: sf.id },
          data:  { sports: [...sfSports, "padel"] },
        });
      }
    }

    // 3c. Upsert sport_rates for padel
    const rateExists = await prisma.sportRate.findFirst({
      where: { venueId: venue.id, sport: "padel" },
    });
    if (!rateExists) {
      await prisma.sportRate.create({
        data: {
          venueId:         venue.id,
          sport:           "padel",
          sportId:         padelSport.id,
          rates:           PADEL_RATES,
          minBookingHours: 1,
        },
      });
      ratesCreated++;
    }
  }

  // ── 4. (Optional) Update trainer sports arrays ─────────────────────────────
  let trainersUpdated = 0;
  if (INCLUDE_TRAINERS) {
    const trainerProfiles = await prisma.trainerProfile.findMany({
      select: { id: true, userId: true, sports: true },
    });

    for (const tp of trainerProfiles) {
      const tpSports = (tp.sports as string[] | null) ?? [];
      if (tpSports.includes("tennis") && !tpSports.includes("padel")) {
        await prisma.trainerProfile.update({
          where: { id: tp.id },
          data:  { sports: [...tpSports, "padel"] },
        });
        trainersUpdated++;
        console.log(`  → TrainerProfile (id=${tp.id}, userId=${tp.userId}): added padel`);
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Backfill complete. Summary:");
  console.log(`    Sport row:         1 upserted (id=${padelSport.id})`);
  console.log(`    SportFormats:      ${formatsCreated} created`);
  console.log(`    Venues updated:    ${venuesUpdated}`);
  console.log(`    Facilities updated:${facilitiesUpdated}`);
  console.log(`    SportRates created:${ratesCreated}`);
  if (INCLUDE_TRAINERS) {
    console.log(`    Trainers updated:  ${trainersUpdated}`);
  } else {
    console.log(`    Trainers:          skipped (set INCLUDE_TRAINERS=true to include)`);
  }
  console.log("═══════════════════════════════════════════════════════");
}

run()
  .catch((e) => {
    console.error("❌  Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
