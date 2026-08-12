/**
 * Nashik Open — Pickleball Tournament Seed
 * Run: pnpm --filter @sportza/api db:seed:nashik-open
 *
 * Seeds 3 tournaments (Beginners, Pro, 35+) with real team/pool data
 * from the Nashik Open draw sheets. Creates a User record for each player
 * derived from the team name (e.g. "Farhan Hudda & Irfan Hudda").
 * All fixtures are created as "upcoming" with no match scores.
 * Status: in_progress (group stage underway).
 *
 * Safe to run multiple times — skips if tournament already exists.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEV_PASSWORD_HASH = bcrypt.hashSync("Sportza@123", 12);

// ── helpers ──────────────────────────────────────────────────────────────────

/** Convert a display name to a URL-safe email local part. */
function nameToEmail(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") + "@nashikopen.sportza.in"
  );
}

/** Parse "Player One & Player Two" or "Player One / Player Two" into [p1, p2]. */
function parsePlayerNames(teamName: string): [string, string] {
  const sep = teamName.includes("&") ? "&" : "/";
  const parts = teamName.split(sep).map((s) => s.trim());
  return [parts[0] ?? teamName, parts[1] ?? parts[0] ?? teamName];
}

async function upsertPlayerUser(displayName: string) {
  const email = nameToEmail(displayName);
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

/** Round-robin pairs for n teams (0-indexed). */
function roundRobinPairs(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding Nashik Open pickleball tournaments…");

  // ── Organiser ─────────────────────────────────────────────────────────────
  const organiser = await prisma.user.upsert({
    where: { email: "nashikopen@sportza.in" },
    update: {},
    create: {
      email: "nashikopen@sportza.in",
      name: "Nashik Open Organiser",
      role: "player",
      password: DEV_PASSWORD_HASH,
    },
  });

  // ── Sport ─────────────────────────────────────────────────────────────────
  const sport = await prisma.sport.findFirst({ where: { name: "pickleball" } });
  if (!sport) {
    console.error("❌  Sport 'pickleball' not found. Run the main seed first.");
    process.exit(1);
  }

  // ── Venue ─────────────────────────────────────────────────────────────────
  let venue = await prisma.venue.findFirst({ where: { name: { contains: "Pickleball" } } });
  if (!venue) {
    venue = await prisma.venue.create({
      data: {
        name: "Nashik Pickleball Arena",
        address: "Nashik, Maharashtra",
        city: "Nashik",
        state: "Maharashtra",
        country: "India",
        sportNames: ["pickleball"],
        createdById: organiser.id,
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Pool data
  // ════════════════════════════════════════════════════════════════════════════

  const pools35Plus: Record<string, string[]> = {
    A: [
      "Aditya Rathi & Abhishek Kshatriya",
      "Vipul & Swapnil",
      "Ratnakar & Ravi",
      "Sharany & Anand",
    ],
    B: [
      "Dev & Maddy",
      "Nitin Dahisaria & Dr Sanjay Kadam",
      "Farhaz & Irfan",
      "Ramesh & Piyush",
    ],
    C: [
      "Vivekraj Thakur & Haresh Pamnani",
      "Ankit Karwa & Rohit Kale",
      "Tushar & Shekhar",
    ],
    D: [
      "Nitin Dahisaria & Neepa Dahisaria",
      "Prashant Rathi & Jitendra",
      "Milind Gangurde & Saurabh Malabade",
    ],
  };

  const poolsPro: Record<string, string[]> = {
    A: [
      "Sahil Devkule & Deepesh Shah",
      "Sharav Patil & Suyash Nagpurkar",
      "Sudarshan Dhakne & Harshal Jadhav",
      "Pratik & Parimal",
    ],
    B: [
      "Haresh Pamnani & Saurabh Deshpande",
      "Sahil Rane & Vivek",
      "Manil Patel & Niru",
      "Arpit & Shiddhat",
      "Arnav & Swayam",
    ],
    C: [
      "Aditya Rao & Amarpreet Seble",
      "Ratnakar & Ravi",
      "Nil & Ansh",
      "Sanket & Akshay",
    ],
    D: [
      "Smayan Amle & Bhuvan",
      "Abhishek & Vivekraj Thakur",
      "Ravi & Rishab",
      "Taisw & Nakshu",
      "Prashant & Mukti Rathi",
    ],
  };

  const poolsBeginners: Record<string, string[]> = {
    A: [
      "Amarpreet & Suyash Nagpurkar",
      "Aavish Kewalramani & Ajay Kewalramani",
      "Sanket Palekar & Rachit Shinge",
      "Milind Gangurde & Anand Nagare",
      "Aashish Kewalramani & Aakash Kewalramani",
    ],
    B: [
      "Farhan Hudda & Irfan Hudda",
      "Alankar Bokil & Rishi Khairnar",
      "Pratik Malode & Yash Jadhav",
      "Piyush & Harsh",
      "Ekash & Aman",
      "Nirav Sakhalia & Aarav",
    ],
    C: [
      "Karan Lokwani & Rahul Karom Chordia",
      "Vishwesh & Harshvardhan",
      "Kush & Pranav",
      "Aditya Rao & Shaarav",
      "Niru & Aayush Shah",
    ],
    D: [
      "Vinay Nakwal & Prityush Gupta",
      "Hrithik & Sarthak",
      "Ravi & Ratnakar",
      "Tarun & Khizar Banatwalla",
      "Aditya & Sanket",
      "Dhruv & Yuvraj",
    ],
    E: [
      "Tanishka & Pratik",
      "Vijaya Maheshwari & Gaurav Mirani",
      "Abhishek & Vivek Thakur",
      "Yash & Sumant",
      "Rishi Malu & Harsh Maheshwari",
    ],
    F: [
      "Akash Chaudhari & Ajinkya Khalkar",
      "Rishabh Deshpande & Saurabh Deshpande",
      "Akshay Shinde & Binay",
      "Arhan Hudda & Saffaz Hudda",
      "Ravi Jadhav & Ganesh Jadhav",
      "Pratik & Parimal",
    ],
    G: [
      "Ravi Raj & Pawan",
      "Yash Dhameja & Harsh Dhameja",
      "Aprit & Siddhant",
      "Rahul Qazi & Aaditya Dangarikar",
      "Maddy & Harshal",
    ],
    H: [
      "Devesh & Deepesh",
      "Wajim & Adi",
      "Tanish & Nakshu",
      "Saurabh Luthra & Anand Rathi",
      "Ashun Patil & Siddhant Sable",
    ],
  };

  await seedTournament({
    name: "Nashik Open — 35+",
    description:
      "Nashik Open pickleball tournament — 35+ doubles category. 4 pools, top 2 per pool advance to knockout.",
    sport: "pickleball",
    sportId: sport.id,
    venueId: venue.id,
    createdById: organiser.id,
    maxTeams: 14,
    pools: pools35Plus,
    groupCount: 4,
    advanceCount: 2,
  });

  await seedTournament({
    name: "Nashik Open — Pro",
    description:
      "Nashik Open pickleball tournament — Pro doubles category. 4 pools, top 2 per pool advance to knockout.",
    sport: "pickleball",
    sportId: sport.id,
    venueId: venue.id,
    createdById: organiser.id,
    maxTeams: 18,
    pools: poolsPro,
    groupCount: 4,
    advanceCount: 2,
  });

  await seedTournament({
    name: "Nashik Open — Beginners",
    description:
      "Nashik Open pickleball tournament — Beginners doubles category. 8 pools, top 2 per pool advance to knockout.",
    sport: "pickleball",
    sportId: sport.id,
    venueId: venue.id,
    createdById: organiser.id,
    maxTeams: 43,
    pools: poolsBeginners,
    groupCount: 8,
    advanceCount: 2,
  });

  console.log("✅  Nashik Open seeding complete.");
  await prisma.$disconnect();
}

// ── seedTournament ────────────────────────────────────────────────────────────

interface SeedTournamentArgs {
  name: string;
  description: string;
  sport: string;
  sportId: number;
  venueId: number;
  createdById: number;
  maxTeams: number;
  pools: Record<string, string[]>;
  groupCount: number;
  advanceCount: number;
}

async function seedTournament({
  name,
  description,
  sport,
  sportId,
  venueId,
  createdById,
  maxTeams,
  pools,
  groupCount,
  advanceCount,
}: SeedTournamentArgs) {
  const existing = await prisma.tournament.findFirst({ where: { name } });
  if (existing) {
    console.log(`  ⏭  Skipping "${name}" — already exists (run patch script to update)`);
    return;
  }

  const poolLetters = Object.keys(pools).sort();

  // Create player users and build teams JSON
  const teamsJson: Array<{
    name: string;
    groupIndex: number;
    playerNames: [string, string];
    players: number[];
  }> = [];

  for (let gIdx = 0; gIdx < poolLetters.length; gIdx++) {
    for (const teamName of pools[poolLetters[gIdx]]) {
      const [p1Name, p2Name] = parsePlayerNames(teamName);
      const [p1, p2] = await Promise.all([
        upsertPlayerUser(p1Name),
        upsertPlayerUser(p2Name),
      ]);
      teamsJson.push({
        name: teamName,
        groupIndex: gIdx,
        playerNames: [p1Name, p2Name],
        players: [p1.id, p2.id],
      });
    }
  }

  // Stage config: doubles pickleball (service scoring), playersPerTeam = 2
  const stagesJson = [
    {
      stageOrder: 1,
      name: "Group Stage",
      format: "round_robin",
      groupCount,
      advanceCount,
      bestOf: 1,
      singleFormat: false,
      scoringSystem: "service",
      playersPerTeam: 2,
    },
    {
      stageOrder: 2,
      name: "Knockout",
      format: "knockout",
      groupCount: 1,
      advanceCount: 1,
      bestOf: 3,
      singleFormat: false,
      scoringSystem: "service",
      playersPerTeam: 2,
    },
  ];

  const tournament = await prisma.tournament.create({
    data: {
      name,
      description,
      sport,
      sportId,
      venueId,
      createdById,
      maxTeams,
      status: "in_progress",
      startDate: new Date("2026-06-07"),
      endDate:   new Date("2026-06-08"),
      teams:  teamsJson  as object,
      stages: stagesJson as object,
    },
  });

  // Generate round-robin fixtures per pool (stage 1)
  let matchOrder = 1;
  for (let gIdx = 0; gIdx < poolLetters.length; gIdx++) {
    const teamNames = pools[poolLetters[gIdx]];
    for (const [i, j] of roundRobinPairs(teamNames.length)) {
      await prisma.tournamentFixture.create({
        data: {
          tournamentId: tournament.id,
          stage:        1,
          round:        1,
          groupIndex:   gIdx,
          matchOrder:   matchOrder++,
          team1Type:    "team",
          team1Ref:     { name: teamNames[i] },
          team2Type:    "team",
          team2Ref:     { name: teamNames[j] },
          status:       "upcoming",
        },
      });
    }
  }

  console.log(
    `  ✓  "${name}" — ${teamsJson.length} teams, ${poolLetters.length} pools, ${matchOrder - 1} group fixtures, ${teamsJson.length * 2} player accounts`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
