/**
 * Image-only seed: updates Venue.images for Nashik venues from Google Maps CSV exports.
 *
 * Run: npm run db:seed:venue-images
 * Prerequisite: venues exist (run npm run db:seed first if adding new directory rows).
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
import {
  loadGoogleMapsImageRows,
  normalizeVenueName,
  type GoogleMapsImageRow,
} from "./data/load-google-maps-images";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

type AvailabilityMeta = {
  googlePlaceId?: string;
  [key: string]: unknown;
};

function parseAvailability(raw: unknown): AvailabilityMeta {
  if (!raw || typeof raw !== "object") return {};
  return raw as AvailabilityMeta;
}

function findCsvRowForVenue(
  venueName: string,
  googlePlaceId: string | undefined,
  byPlaceId: Map<string, GoogleMapsImageRow>,
  byName: Map<string, GoogleMapsImageRow>
): GoogleMapsImageRow | undefined {
  if (googlePlaceId && byPlaceId.has(googlePlaceId)) {
    return byPlaceId.get(googlePlaceId);
  }
  const normalized = normalizeVenueName(venueName);
  if (byName.has(normalized)) return byName.get(normalized);

  // Partial name match (e.g. "Paradise Pickleball Hub" vs "Paradise Pickleball Hub Nashik")
  for (const [key, row] of byName.entries()) {
    if (normalized.includes(key) || key.includes(normalized)) return row;
  }
  return undefined;
}

async function main() {
  console.log("Seeding venue images from Google Maps CSV exports…\n");

  const csvRows = loadGoogleMapsImageRows();
  const byPlaceId = new Map(csvRows.map((r) => [r.placeId, r]));
  const byName = new Map(csvRows.map((r) => [normalizeVenueName(r.name), r]));

  const venues = await prisma.venue.findMany({
    where: { location: { city: "Nashik" } },
    select: {
      id: true,
      name: true,
      images: true,
      availability: true,
    },
  });

  console.log(`Found ${venues.length} Nashik venue(s) in database`);
  console.log(`Loaded ${csvRows.length} image row(s) from CSV\n`);

  let updated = 0;
  let skipped = 0;
  const matchedCsvPlaceIds = new Set<string>();

  for (const venue of venues) {
    const avail = parseAvailability(venue.availability);
    const csvRow = findCsvRowForVenue(
      venue.name,
      avail.googlePlaceId,
      byPlaceId,
      byName
    );

    if (!csvRow || csvRow.images.length === 0) {
      skipped++;
      console.log(`  skip  #${venue.id} ${venue.name} (no CSV match)`);
      continue;
    }

    matchedCsvPlaceIds.add(csvRow.placeId);
    await prisma.venue.update({
      where: { id: venue.id },
      data: { images: csvRow.images },
    });
    updated++;
    console.log(`  ok    #${venue.id} ${venue.name} (${csvRow.images.length} image(s))`);
  }

  const unmatchedCsv = csvRows.filter((r) => !matchedCsvPlaceIds.has(r.placeId));

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
  if (unmatchedCsv.length > 0) {
    console.log(`\nUnmatched CSV rows (${unmatchedCsv.length}) — venue may not exist in DB yet:`);
    for (const r of unmatchedCsv) {
      console.log(`  - ${r.name} (${r.placeId})`);
    }
    console.log("\nRun: npm run db:seed  then npm run db:seed:venue-images");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
