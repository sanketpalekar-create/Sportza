/**
 * One-time idempotent seed: pickleball Doubles community ratings from sportza-ratings.html
 *
 * Prerequisite: copy data/pickleball-community-phones.example.json →
 *               data/pickleball-community-phones.json and fill all 19 phone numbers.
 *
 * Run:
 *   pnpm --filter @sportza/api db:seed:pickleball-ratings -- --dry-run
 *   pnpm --filter @sportza/api db:seed:pickleball-ratings
 */
import { PrismaClient, type User } from "@prisma/client";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import {
  PICKLEBALL_FINAL_RATINGS,
  PICKLEBALL_FORMAT,
  PICKLEBALL_PLAYER_NAMES,
} from "./data/pickleball-community-ratings";
import { getConfidence, initializeRatingsForAllSports } from "../src/services/elo";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

const PHONES_PATH = path.join(__dirname, "data", "pickleball-community-phones.json");
const HISTORY_SPAN_DAYS = 120;

const dryRun = process.argv.includes("--dry-run");

type PhoneEntry = string | { phone: string; displayName?: string };

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return raw;
}

function loadPhoneMap(): Map<string, { phone: string; displayName?: string }> {
  if (!fs.existsSync(PHONES_PATH)) {
    console.error(
      `Missing ${PHONES_PATH}\n` +
        `Copy prisma/data/pickleball-community-phones.example.json → pickleball-community-phones.json ` +
        `and fill all ${PICKLEBALL_PLAYER_NAMES.length} phone numbers.`
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(PHONES_PATH, "utf8")) as Record<string, PhoneEntry>;
  const map = new Map<string, { phone: string; displayName?: string }>();

  for (const name of PICKLEBALL_PLAYER_NAMES) {
    const entry = raw[name];
    if (!entry) continue;
    if (typeof entry === "string") {
      map.set(name, { phone: normalizePhone(entry) });
    } else if (entry && typeof entry.phone === "string") {
      map.set(name, {
        phone: normalizePhone(entry.phone),
        displayName: entry.displayName,
      });
    }
  }

  const missing = PICKLEBALL_PLAYER_NAMES.filter((n) => !map.has(n));
  if (missing.length > 0) {
    console.error(`pickleball-community-phones.json is missing entries for: ${missing.join(", ")}`);
    process.exit(1);
  }

  const placeholders = [...map.entries()].filter(
    ([, v]) => v.phone.includes("X") || v.phone.includes("x")
  );
  if (placeholders.length > 0) {
    console.error(
      `Replace placeholder phone numbers for: ${placeholders.map(([n]) => n).join(", ")}`
    );
    process.exit(1);
  }

  return map;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function historyTimestamp(matchIndex: number, totalMatches: number): Date {
  if (totalMatches <= 0) return new Date();
  const dayOffset =
    totalMatches === 1
      ? 0
      : Math.round((matchIndex / (totalMatches - 1)) * HISTORY_SPAN_DAYS);
  return daysAgo(HISTORY_SPAN_DAYS - dayOffset);
}

async function findUserByName(name: string): Promise<User | null> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { equals: name } },
        { name: { startsWith: `${name} ` } },
      ],
    },
  });
  if (users.length === 1) return users[0]!;
  if (users.length > 1) {
    const exact = users.filter((u) => u.name?.toLowerCase() === name.toLowerCase());
    if (exact.length === 1) return exact[0]!;
  }
  return null;
}

type ResolveResult = { user: User; method: "phone" | "name" | "created" };

async function resolveUser(
  name: string,
  phone: string,
  displayName?: string
): Promise<ResolveResult> {
  const byPhone = await prisma.user.findFirst({ where: { phone } });
  if (byPhone) return { user: byPhone, method: "phone" };

  const byName = await findUserByName(name);
  if (byName) return { user: byName, method: "name" };

  const label = displayName ?? name;
  const email = `phone_${phone.replace(/\D/g, "")}@sportza.local`;

  if (dryRun) {
    console.log(`  [dry-run] would create user ${label} (${phone}, ${email})`);
    return {
      user: { id: -1, name: label, email, phone, role: "player" } as User,
      method: "created",
    };
  }

  const user = await prisma.user.create({
    data: {
      name: label,
      email,
      phone,
      role: "player",
    },
  });
  await initializeRatingsForAllSports(user.id);
  return { user, method: "created" };
}

async function seedPlayerRatings(
  userId: number,
  sportId: number,
  spec: (typeof PICKLEBALL_FINAL_RATINGS)[number]
): Promise<void> {
  const finalRating = Math.round(spec.rating);
  const confidence = getConfidence(spec.mp);

  if (dryRun) {
    console.log(
      `  [dry-run] SportSkillRating Doubles: rating=${finalRating} mp=${spec.mp} wins=${spec.wins} confidence=${confidence}`
    );
    console.log(
      `  [dry-run] RatingHistory: ${spec.history.length - 1} rows (format ${PICKLEBALL_FORMAT})`
    );
    return;
  }

  await prisma.sportSkillRating.upsert({
    where: {
      userId_sportId_formatName: {
        userId,
        sportId,
        formatName: PICKLEBALL_FORMAT,
      },
    },
    update: {
      rating: finalRating,
      matchesPlayed: spec.mp,
      winsCount: spec.wins,
      confidence,
    },
    create: {
      userId,
      sportId,
      formatName: PICKLEBALL_FORMAT,
      rating: finalRating,
      matchesPlayed: spec.mp,
      winsCount: spec.wins,
      confidence,
    },
  });

  await prisma.ratingHistory.deleteMany({
    where: { userId, sportId, formatName: PICKLEBALL_FORMAT },
  });

  const matchCount = spec.history.length - 1;
  for (let i = 1; i < spec.history.length; i++) {
    const oldRating = Math.round(spec.history[i - 1]!);
    const newRating = Math.round(spec.history[i]!);
    await prisma.ratingHistory.create({
      data: {
        userId,
        sportId,
        formatName: PICKLEBALL_FORMAT,
        oldRating,
        newRating,
        delta: newRating - oldRating,
        createdAt: historyTimestamp(i - 1, matchCount),
      },
    });
  }
}

async function main() {
  console.log(dryRun ? "Pickleball ratings seed (dry-run)\n" : "Pickleball ratings seed\n");

  const phoneMap = loadPhoneMap();

  const sport = await prisma.sport.findUnique({ where: { name: "pickleball" } });
  if (!sport) {
    console.error('Sport "pickleball" not found. Run db:seed or ensure sports exist.');
    process.exit(1);
  }

  let created = 0;
  let byPhone = 0;
  let byName = 0;

  for (const spec of PICKLEBALL_FINAL_RATINGS) {
    const { phone, displayName } = phoneMap.get(spec.name)!;
    console.log(`\n${spec.name} (${phone})`);

    const { user, method } = await resolveUser(spec.name, phone, displayName);
    if (method === "created") created++;
    else if (method === "phone") byPhone++;
    else byName++;

    console.log(`  → ${method}${user.id > 0 ? ` (user #${user.id})` : ""}`);

    if (user.id > 0) {
      await seedPlayerRatings(user.id, sport.id, spec);
    }
  }

  console.log(
    `\nDone. ${PICKLEBALL_FINAL_RATINGS.length} players — ` +
      `${byPhone} by phone, ${byName} by name, ${created} created.`
  );
  if (dryRun) console.log("Re-run without --dry-run to apply changes.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
