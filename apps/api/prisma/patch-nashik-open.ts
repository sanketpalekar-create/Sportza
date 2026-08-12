/**
 * Nashik Open — Full Wipe + Reseed Patch
 *
 * For each of the 3 Nashik Open tournaments:
 *   1. Delete all TournamentFixture rows (removes FK references to Match)
 *   2. Delete all Match rows linked to the tournament
 *   3. Rebuild tournament.teams JSON from new pool data (upsert player users)
 *   4. Update tournament.stages with new groupCount + correct scoring config
 *   5. Update tournament.maxTeams
 *   6. Re-create round-robin TournamentFixture rows for the new pools (stage 1)
 *
 * Safe to re-run — player user upserts are idempotent (email-based).
 *
 * Run:
 *   pnpm --filter @sportza/api exec ts-node prisma/patch-nashik-open.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEV_PASSWORD_HASH = bcrypt.hashSync("Sportza@123", 12);

// ── helpers ──────────────────────────────────────────────────────────────────

function nameToEmail(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") + "@nashikopen.sportza.in"
  );
}

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
    create: { email, name: displayName, role: "player", password: DEV_PASSWORD_HASH },
  });
}

function roundRobinPairs(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

// ── Updated pool data ─────────────────────────────────────────────────────────

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

// ── tournament configs ────────────────────────────────────────────────────────

const tournamentConfigs = [
  {
    name: "Nashik Open — 35+",
    pools: pools35Plus,
    groupCount: 4,
    maxTeams: 14,
    description: "Nashik Open pickleball tournament — 35+ doubles category. 4 pools, top 2 per pool advance to knockout.",
  },
  {
    name: "Nashik Open — Pro",
    pools: poolsPro,
    groupCount: 4,
    maxTeams: 18,
    description: "Nashik Open pickleball tournament — Pro doubles category. 4 pools, top 2 per pool advance to knockout.",
  },
  {
    name: "Nashik Open — Beginners",
    pools: poolsBeginners,
    groupCount: 8,
    maxTeams: 43,
    description: "Nashik Open pickleball tournament — Beginners doubles category. 8 pools, top 2 per pool advance to knockout.",
  },
];

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔧  Nashik Open — Full Wipe + Reseed patch…\n");

  for (const cfg of tournamentConfigs) {
    const tournament = await prisma.tournament.findFirst({ where: { name: cfg.name } });
    if (!tournament) {
      console.log(`  ⏭  "${cfg.name}" not found — skipping`);
      continue;
    }

    console.log(`  📋  Processing "${cfg.name}" (id=${tournament.id})…`);

    // ── Step 1: collect matchIds from existing fixtures ──────────────────────
    const fixtures = await prisma.tournamentFixture.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, matchId: true },
    });
    const matchIds = fixtures.map((f) => f.matchId).filter((id): id is number => id !== null);

    // ── Step 2: delete fixtures first (removes FK refs to Match) ────────────
    const deletedFixtures = await prisma.tournamentFixture.deleteMany({
      where: { tournamentId: tournament.id },
    });
    console.log(`     ↳  Deleted ${deletedFixtures.count} fixtures`);

    // ── Step 3: delete Match records (cascades MatchEvent/MatchConfirmation) ─
    if (matchIds.length > 0) {
      const deletedMatches = await prisma.match.deleteMany({
        where: { id: { in: matchIds } },
      });
      console.log(`     ↳  Deleted ${deletedMatches.count} match records`);
    }

    // ── Step 4: rebuild teams JSON ────────────────────────────────────────────
    const poolLetters = Object.keys(cfg.pools).sort();
    const teamsJson: Array<{
      name: string;
      groupIndex: number;
      playerNames: [string, string];
      players: number[];
    }> = [];

    for (let gIdx = 0; gIdx < poolLetters.length; gIdx++) {
      for (const teamName of cfg.pools[poolLetters[gIdx]]) {
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

    // ── Step 5: updated stages JSON ──────────────────────────────────────────
    const updatedStages = [
      {
        stageOrder: 1,
        name: "Group Stage",
        format: "round_robin",
        groupCount: cfg.groupCount,
        advanceCount: 2,
        bestOf: 1,
        singleFormat: false,
        scoringSystem: "service",
        playersPerTeam: 2,
        pointsToWin: 11,
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
        pointsToWin: 11,
      },
    ];

    // ── Step 6: update tournament record ─────────────────────────────────────
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        teams:       teamsJson     as object,
        stages:      updatedStages as object,
        maxTeams:    cfg.maxTeams,
        description: cfg.description,
        status:      "in_progress",
      },
    });
    console.log(`     ↳  Updated tournament record (${teamsJson.length} teams, ${cfg.groupCount} pools)`);

    // ── Step 7: re-create round-robin fixtures (stage 1) ─────────────────────
    let matchOrder = 1;
    for (let gIdx = 0; gIdx < poolLetters.length; gIdx++) {
      const teamNames = cfg.pools[poolLetters[gIdx]];
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
    console.log(`     ↳  Created ${matchOrder - 1} new group-stage fixtures\n`);
  }

  console.log("✅  Patch complete.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
