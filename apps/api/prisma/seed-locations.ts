/**
 * One-time backfill: reads old flat location strings from User/Venue/Match/Tournament/Batch,
 * creates Location rows, and sets locationId FK on each record.
 *
 * Uses Prisma $queryRaw/$executeRaw so it works with the already-running client DLL.
 * Run: node -r ts-node/register prisma/seed-locations.ts
 *  or: cd apps/api && npx ts-node --transpile-only --skip-project prisma/seed-locations.ts
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require("@prisma/client");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require("dotenv");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

// postalcodes-india via dynamic require
let findStateImpl: (code: string) => { isValid: boolean; state?: string } = () => ({
  isValid: false,
});
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pc = require("postalcodes-india");
  findStateImpl = pc.findState ?? pc.default?.findState ?? findStateImpl;
} catch {
  console.warn("postalcodes-india not loaded – states will default to Maharashtra");
}

function deriveState(pincode?: string | null): string {
  if (pincode) {
    try {
      const result = findStateImpl(pincode.trim());
      if (result.isValid && result.state) return result.state;
    } catch {
      // ignore
    }
  }
  return "Maharashtra";
}

interface LocationRow {
  country: string;
  state: string;
  city: string;
  pincode: string | null;
  address: string | null;
}

const cache = new Map<string, number>();

function key(r: LocationRow) {
  return `${r.country}|${r.state}|${r.city}|${r.pincode ?? ""}`;
}

async function findOrCreate(loc: LocationRow): Promise<number> {
  const k = key(loc);
  if (cache.has(k)) return cache.get(k)!;

  const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT id FROM locations WHERE country = ? AND state = ? AND city = ? AND (pincode = ? OR (pincode IS NULL AND ? IS NULL)) LIMIT 1`,
    loc.country,
    loc.state,
    loc.city,
    loc.pincode,
    loc.pincode
  );

  if (rows.length > 0) {
    cache.set(k, rows[0].id);
    return rows[0].id;
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO locations (country, state, city, pincode, address) VALUES (?, ?, ?, ?, ?)`,
    loc.country,
    loc.state,
    loc.city,
    loc.pincode,
    loc.address
  );

  const [{ id }] = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT LAST_INSERT_ID() AS id`
  );
  cache.set(k, id);
  return id;
}

async function backfillUsers() {
  const users = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT id FROM users WHERE locationId IS NULL`
  );

  console.log(`Backfilling ${users.length} users...`);
  const defaultLocId = await findOrCreate({
    country: "India",
    state: "Maharashtra",
    city: "Pune",
    pincode: null,
    address: null,
  });
  for (const u of users) {
    await prisma.$executeRawUnsafe(`UPDATE users SET locationId = ? WHERE id = ?`, defaultLocId, u.id);
  }
  console.log("  Users done.");
}

async function backfillVenues() {
  const venues = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT id FROM venues WHERE locationId IS NULL`
  );

  console.log(`Backfilling ${venues.length} venues...`);
  const defaultLocId = await findOrCreate({
    country: "India",
    state: "Maharashtra",
    city: "Pune",
    pincode: null,
    address: null,
  });
  for (const v of venues) {
    await prisma.$executeRawUnsafe(`UPDATE venues SET locationId = ? WHERE id = ?`, defaultLocId, v.id);
  }
  console.log("  Venues done.");
}

async function backfillJsonTable(table: string) {
  const rows = await prisma.$queryRawUnsafe<{ id: number; location: string | null }[]>(
    `SELECT id, location FROM ${table} WHERE locationId IS NULL AND location IS NOT NULL`
  );

  console.log(`Backfilling ${rows.length} ${table}...`);
  for (const row of rows) {
    let loc: Record<string, unknown> = {};
    try {
      loc = typeof row.location === "string" ? JSON.parse(row.location) : row.location ?? {};
    } catch {
      loc = {};
    }
    const city = ((loc.city ?? loc.locationCity ?? loc.name ?? "Pune") as string)?.trim() || "Pune";
    const pincode = ((loc.pincode ?? loc.pin ?? loc.locationPin ?? "") as string)?.trim() || null;
    const state = deriveState(pincode) || (loc.state as string) || "Maharashtra";
    const address = ((loc.address ?? loc.locationAddr ?? "") as string)?.trim() || null;

    const locId = await findOrCreate({ country: "India", state, city, pincode, address });
    await prisma.$executeRawUnsafe(`UPDATE ${table} SET locationId = ? WHERE id = ?`, locId, row.id);
  }
  console.log(`  ${table} done.`);
}

async function main() {
  console.log("=== Location backfill seed starting ===");
  await backfillUsers();
  await backfillVenues();
  await backfillJsonTable("matches");
  await backfillJsonTable("tournaments");
  await backfillJsonTable("batches");
  console.log("=== Done ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
